from __future__ import annotations

import argparse
import importlib.util
import json
import os
import re
import shutil
from collections import Counter
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import urlparse
import sys

import requests


SEED_NAV_START = "<!--dpr-seed-papers:start-->"
SEED_NAV_END = "<!--dpr-seed-papers:end-->"
ALLOWED_MODES = {"skim", "deep", "both"}
MAX_RELATED_COUNT = 20
MAX_SELECTED_TAGS = 8
MAX_TAG_LENGTH = 48
MAX_NOTES_LENGTH = 400
MAX_QUERY_KEYWORDS = 24
MAX_QUERY_TEXT_LENGTH = 800
REQUEST_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
COMMON_QUERY_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "with",
}


class SeedPaperProcessingError(RuntimeError):
    pass


class RecallLaneFailure(SeedPaperProcessingError):
    def __init__(self, reason: str, public_message: str, *, diagnostic_messages: list[str] | None = None):
        super().__init__(public_message)
        self.reason = _normalize_text(reason).lower()
        self.diagnostic_messages = [
            _normalize_text(message)
            for message in (diagnostic_messages or [])
            if _normalize_text(message)
        ]


def _normalize_text(value: Any) -> str:
    return str(value or "").strip()


def _normalize_mode(value: Any) -> str:
    mode = _normalize_text(value).lower() or "skim"
    if mode not in ALLOWED_MODES:
        raise ValueError(f"Unsupported mode: {value}")
    return mode


def _normalize_related_count(value: Any) -> int:
    try:
        count = int(value)
    except (TypeError, ValueError):
        count = 1
    return min(MAX_RELATED_COUNT, max(1, count))


def _normalize_tags(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    seen: set[str] = set()
    result: list[str] = []
    for item in value:
        tag = _normalize_text(item)[:MAX_TAG_LENGTH].strip()
        if not tag or tag in seen:
            continue
        seen.add(tag)
        result.append(tag)
        if len(result) >= MAX_SELECTED_TAGS:
            break
    return result


def _normalize_notes(value: Any) -> str:
    return _normalize_text(_normalize_text(value)[:MAX_NOTES_LENGTH])


def _normalize_request_id(value: Any) -> str:
    request_id = _normalize_text(value)
    if not REQUEST_ID_RE.fullmatch(request_id):
        raise ValueError(f"Unexpected request_id: {value}")
    return request_id


def _resolve_under_root(root: Path, *parts: str) -> Path:
    root_resolved = root.resolve()
    output_path = (root_resolved.joinpath(*parts)).resolve()
    if output_path != root_resolved and root_resolved not in output_path.parents:
        raise ValueError(f"Unexpected output path: {output_path}")
    return output_path


def _escape_markdown_text(value: Any) -> str:
    text = _normalize_text(value)
    return re.sub(r"([\\`*_{}\[\]()#+!<>|-])", r"\\\1", text)


def _validate_related_link(value: Any) -> str:
    url = _normalize_text(value)
    if not url:
        return ""
    parsed = urlparse(url)
    if parsed.scheme != "https" or not parsed.netloc:
        return ""
    host = (parsed.hostname or "").lower()
    if host not in {"arxiv.org", "www.arxiv.org", "export.arxiv.org", "openreview.net", "pdfs.semanticscholar.org"}:
        return ""
    return url


def _tokenize_query_terms(*parts: Any) -> list[str]:
    tokens: list[str] = []
    for part in parts:
        for token in re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", _normalize_text(part).lower()):
            if token in COMMON_QUERY_STOPWORDS:
                continue
            tokens.append(token)
    return tokens


def _build_query_summary(request: dict[str, Any], seed_text: str) -> str:
    title = _paper_title_from_filename(request.get("file_name") or "")
    tags = list(request.get("selected_tags") or [])
    notes = _normalize_text(request.get("notes"))
    counter = Counter(_tokenize_query_terms(title, seed_text, notes, *tags))
    ranked_terms = [token for token, _ in counter.most_common(MAX_QUERY_KEYWORDS)]
    summary_parts = [title]
    if ranked_terms:
        summary_parts.append("Keywords: " + ", ".join(ranked_terms))
    if tags:
        summary_parts.append("Tags: " + ", ".join(tags))
    if notes:
        summary_parts.append("Notes: " + notes)
    return " | ".join(part for part in summary_parts if part)[:MAX_QUERY_TEXT_LENGTH]


def _validate_request_path(request_path: Path) -> Path:
    resolved = request_path.resolve()
    if (
        resolved.name != "request.json"
        or resolved.parent.parent.name != "seed-papers"
        or resolved.parent.parent.parent.name != "archive"
    ):
        raise ValueError(f"Unexpected request path: {resolved}")
    return resolved


def _derive_request_root(request_path: Path, root_dir: str | None) -> Path:
    resolved = _validate_request_path(request_path)
    derived_root = resolved.parent.parent.parent.parent
    if root_dir:
        root_resolved = Path(root_dir).resolve()
        if root_resolved != derived_root:
            raise ValueError(f"Unexpected request path: {resolved}")
        return root_resolved
    return derived_root


def _validate_source_path(source_path: str, request_id: str) -> PurePosixPath:
    relative_path = PurePosixPath(source_path)
    expected_prefix = PurePosixPath("archive") / "seed-papers" / request_id
    if relative_path.parent != expected_prefix or relative_path.suffix.lower() != ".pdf":
        raise ValueError(f"Unexpected source_path: {source_path}")
    if any(part in {"", ".", ".."} for part in relative_path.parts):
        raise ValueError(f"Unexpected source_path: {source_path}")
    return relative_path


def load_request(request_path: str, root_dir: str | None = None) -> dict[str, Any]:
    request_file = _validate_request_path(Path(request_path))
    root = _derive_request_root(request_file, root_dir)
    payload = json.loads(request_file.read_text(encoding="utf-8"))

    request_id = _normalize_request_id(request_file.parent.name)
    source_path = _normalize_text(payload.get("source_path"))
    relative_pdf_path = _validate_source_path(source_path, request_id)
    seed_pdf_path = _resolve_under_root(root, *relative_pdf_path.parts)
    if not seed_pdf_path.is_file():
        raise ValueError(f"Missing seed PDF: {seed_pdf_path}")

    return {
        "request_id": request_id,
        "file_name": _normalize_text(payload.get("file_name")),
        "source_path": source_path,
        "seed_pdf_path": str(seed_pdf_path),
        "related_count": _normalize_related_count(payload.get("related_count")),
        "selected_tags": _normalize_tags(payload.get("selected_tags")),
        "mode": _normalize_mode(payload.get("mode")),
        "notes": _normalize_notes(payload.get("notes")),
    }


def select_related_outputs(
    ranked_papers: list[dict[str, Any]],
    mode: str,
    related_count: int,
) -> dict[str, list[dict[str, Any]]]:
    normalized_mode = _normalize_mode(mode)
    top_items = list(ranked_papers[: _normalize_related_count(related_count)])
    if normalized_mode == "deep":
        return {"deep_dive": top_items, "quick_skim": []}
    if normalized_mode == "skim":
        return {"deep_dive": [], "quick_skim": top_items}
    return {"deep_dive": list(top_items), "quick_skim": list(top_items)}


def _paper_title_from_filename(file_name: str) -> str:
    title = Path(file_name or "seed-paper.pdf").stem.replace("_", " ").replace("-", " ").strip()
    return title or "Seed Paper"


def _upsert_auto_block(generate_docs_module: Any, md_path: Path, heading: str, content: str) -> None:
    clean_content = _normalize_text(content)
    if not clean_content:
        return
    generate_docs_module.upsert_auto_block(str(md_path), heading, clean_content)


def _upsert_frontmatter_evidence(generate_docs_module: Any, md_path: Path, glance_fields: dict[str, Any]) -> None:
    """
    Sync evidence/tldr from glance overview back into front matter fields.
    This ensures the related page top meta (which reads front matter) gets the
    structured evidence even though it was generated after the initial markdown write.
    """
    yaml_escape = getattr(generate_docs_module, "yaml_escape_value", lambda s: s)
    # Read existing front matter
    try:
        with open(md_path, "r", encoding="utf-8") as f:
            content = f.read()
    except (OSError, IOError):
        return

    if not content.startswith("---"):
        return

    end_idx = content.find("\n---\n", 3)
    if end_idx == -1:
        return

    fm_text = content[3:end_idx]
    body = content[end_idx + 4:]

    # Parse existing front matter lines
    lines = fm_text.splitlines()
    fm_dict = {}
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            fm_dict[key.strip()] = val.strip()

    # Sync from glance fields if front matter is missing these
    if "evidence" not in fm_dict:
        ev = glance_fields.get("evidence") or ""
        if ev:
            fm_dict["evidence"] = yaml_escape(str(ev))

    if "tldr" not in fm_dict:
        tldr = glance_fields.get("tldr") or ""
        if tldr:
            fm_dict["tldr"] = yaml_escape(str(tldr))

    if "motivation" not in fm_dict:
        motivation = glance_fields.get("motivation") or ""
        if motivation:
            fm_dict["motivation"] = yaml_escape(str(motivation))

    if "method" not in fm_dict:
        method = glance_fields.get("method") or ""
        if method:
            fm_dict["method"] = yaml_escape(str(method))

    if "result" not in fm_dict:
        result = glance_fields.get("result") or ""
        if result:
            fm_dict["result"] = yaml_escape(str(result))

    if "conclusion" not in fm_dict:
        conclusion = glance_fields.get("conclusion") or ""
        if conclusion:
            fm_dict["conclusion"] = yaml_escape(str(conclusion))

    if "key_findings" not in fm_dict:
        key_findings = glance_fields.get("key_findings") or ""
        if key_findings:
            if isinstance(key_findings, list):
                # Serialize as YAML inline sequence: [item1, item2]
                items = [yaml_escape(str(item)) for item in key_findings]
                fm_dict["key_findings"] = "[" + ", ".join(items) + "]"
            else:
                fm_dict["key_findings"] = yaml_escape(str(key_findings))

    if "limitations" not in fm_dict:
        limitations = glance_fields.get("limitations") or ""
        if limitations:
            fm_dict["limitations"] = yaml_escape(str(limitations))

    # Rebuild front matter
    new_fm_lines = []
    for k, v in fm_dict.items():
        new_fm_lines.append(f"{k}: {v}")
    new_fm = "\n".join(new_fm_lines)

    new_content = "---\n" + new_fm + "\n---\n" + body
    try:
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(new_content)
    except (OSError, IOError):
        return


def _render_seed_page(
    request: dict[str, Any],
    seed_text: str,
    workspace_dir: Path,
    generate_docs_module: Any,
) -> Path:
    title = _paper_title_from_filename(request.get("file_name") or "")
    txt_path = workspace_dir / "seed-paper.txt"
    clean_seed_text = _normalize_text(seed_text)
    txt_path.write_text(clean_seed_text, encoding="utf-8")

    paper = {
        "title": title,
        "abstract": clean_seed_text,
        "link": request.get("source_path") or "",
        "llm_tags": [f"query:{tag}" for tag in request.get("selected_tags") or []],
        "llm_score": None,
    }
    md_path = workspace_dir / "seed-paper.md"
    md_path.write_text(
        generate_docs_module.build_markdown_content(
            paper,
            "seed-paper",
            title,
            clean_seed_text,
            request.get("selected_tags") or [],
        ),
        encoding="utf-8",
    )

    mode = _normalize_mode(request.get("mode"))
    seed_glance_fields: dict[str, str] = {}
    if mode in {"skim", "both"}:
        glance = generate_docs_module.generate_glance_overview(title, clean_seed_text, clean_seed_text)
        if not _normalize_text(glance):
            glance = generate_docs_module.build_glance_fallback(paper)
        _upsert_auto_block(generate_docs_module, md_path, "速览", glance)
        if glance:
            seed_glance_fields = generate_docs_module.parse_glance_overview_fields(glance)
            _upsert_frontmatter_evidence(generate_docs_module, md_path, seed_glance_fields)
    if mode in {"deep", "both"}:
        deep_summary = generate_docs_module.generate_deep_summary(str(md_path), str(txt_path))
        _upsert_auto_block(generate_docs_module, md_path, "精读", deep_summary)

    return md_path, seed_glance_fields


def _related_key(paper: dict[str, Any]) -> str:
    return _normalize_text(paper.get("id")) or _normalize_text(paper.get("title"))


def _iter_unique_related(selection: dict[str, Any]) -> list[dict[str, Any]]:
    unique: dict[str, dict[str, Any]] = {}
    for bucket_name in ("quick_skim", "deep_dive"):
        for item in selection.get(bucket_name) or []:
            paper_key = _related_key(item)
            if not paper_key or paper_key in unique:
                continue
            unique[paper_key] = item
    return list(unique.values())


def _sanitize_related_basename(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", _normalize_text(value))
    normalized = normalized.strip(" .-_")
    return normalized or "related-paper"


def _build_related_records(selection: dict[str, Any]) -> list[dict[str, Any]]:
    quick_keys = {_related_key(item) for item in selection.get("quick_skim") or [] if _related_key(item)}
    deep_keys = {_related_key(item) for item in selection.get("deep_dive") or [] if _related_key(item)}

    used_basenames: set[str] = set()
    records: list[dict[str, Any]] = []
    for paper in _iter_unique_related(selection):
        paper_key = _related_key(paper)
        base_name = _sanitize_related_basename(paper_key)
        candidate = base_name
        suffix = 2
        while candidate in used_basenames:
            candidate = f"{base_name}-{suffix}"
            suffix += 1
        used_basenames.add(candidate)
        records.append(
            {
                "paper": paper,
                "key": paper_key,
                "basename": candidate,
                "title": _normalize_text(paper.get("title")) or candidate,
                "include_quick": paper_key in quick_keys,
                "include_deep": paper_key in deep_keys,
                "score": paper.get("llm_score"),
                "evidence": paper.get("canonical_evidence") or paper.get("llm_tldr_cn") or paper.get("llm_tldr") or paper.get("llm_tldr_en") or "",
            }
        )
    return records


def _build_related_output_path(related_dir: Path, basename: str, suffix: str) -> Path:
    related_root = related_dir.resolve()
    output_path = _resolve_under_root(related_root, f"{basename}{suffix}")
    if output_path.parent != related_root:
        raise ValueError(f"Unexpected related output path: {basename}")
    return output_path


def _render_related_pages(
    selection: dict[str, Any],
    related_dir: Path,
    generate_docs_module: Any,
) -> list[dict[str, str]]:
    """
    PR3: Refactored to use full-text priority + aligned with PR2 body contract.

    Text source priority (per PR2 spec):
    - Prefer: ensure_text_content(pdf_url, txt_path) → full text
    - Fallback: abstract (never interrupt workspace for a single related failure)

    Body contract (per PR2 spec):
    - All related pages now have 4-section skim body (like main链路)
    - Generated via generate_skim_body(), not abstract-only build_markdown_content
    - Existing pages migrated via upsert_skim_body_in_text (inline, not tail)
    """
    written: list[dict[str, str]] = []
    for record in _build_related_records(selection):
        paper = record["paper"]
        paper_title = record["title"]
        md_path = _build_related_output_path(related_dir, record["basename"], ".md")
        txt_path = _build_related_output_path(related_dir, record["basename"], ".txt")
        tags = list(paper.get("llm_tags") or [])
        abstract = _normalize_text(paper.get("abstract"))
        # Use validated URL for text extraction (only allowed hosts: arxiv, openreview, semanticscholar)
        # PR3 fix: if link fails validation, fall back to pdf_url field
        link_url = _normalize_text(paper.get("link") or "")
        pdf_url_field = _normalize_text(paper.get("pdf_url") or "")
        if link_url:
            pdf_url = _validate_related_link(link_url) or (pdf_url_field if pdf_url_field and _validate_related_link(pdf_url_field) else "")
        else:
            pdf_url = _validate_related_link(pdf_url_field)

        # PR3: Prepare paper_text for both quick and deep modes
        # Priority: full text (ensure_text_content) > abstract fallback
        paper_text = ""
        if record["include_quick"] or record["include_deep"]:
            if pdf_url and hasattr(generate_docs_module, "ensure_text_content"):
                try:
                    paper_text = generate_docs_module.ensure_text_content(pdf_url, str(txt_path))
                except Exception:
                    paper_text = ""
            # Fallback: use abstract if text extraction failed or no pdf_url
            if not paper_text:
                # PR3 fix: always write fallback to txt_path (even if file already exists from failed ensure_text_content)
                txt_path.write_text(abstract, encoding="utf-8")
                paper_text = abstract

        # PR3: Generate skim body using full paper_text (全文优先)
        # generate_skim_body() returns skeleton from LLM or _build_skim_body_fallback
        # This skim body is stored in paper["_skim_body"] and used by build_markdown_content
        skim_body = ""
        if hasattr(generate_docs_module, "generate_skim_body"):
            try:
                skim_body = generate_docs_module.generate_skim_body(
                    paper_title,
                    abstract,
                    paper_text,
                ) or ""
            except Exception:
                skim_body = ""

        paper_with_body = dict(paper)
        if skim_body:
            paper_with_body["_skim_body"] = skim_body

        md_content = generate_docs_module.build_markdown_content(
            paper_with_body,
            "related-paper",
            paper_title,
            abstract,
            tags,
            paper_text,  # PR3 fix: pass paper_text for fallback path
        )

        # PR3 fix: DO NOT call upsert_skim_body_in_text here.
        # render_seed_workspace() always clears and recreates the related/ directory,
        # so all related files are NEW — no old ## 正文层速读 wrapper exists to migrate.
        # build_markdown_content() with _skim_body already outputs inline skeleton
        # (positioned before ## Abstract). Calling upsert_skim_body_in_text would
        # add a ## 正文层速读 wrapper around the same skeleton, creating double-write.
        # Old-wrapper migration for seed paper files is handled separately in
        # process_paper() → upsert_skim_body_in_text().
        md_path.write_text(md_content, encoding="utf-8")

        # Upsert glance (速览) block - uses same paper_text for full-text priority
        if record["include_quick"]:
            glance = ""
            if hasattr(generate_docs_module, "generate_glance_overview"):
                try:
                    glance = generate_docs_module.generate_glance_overview(
                        paper_title,
                        abstract,
                        paper_text,
                    ) or ""
                except Exception:
                    glance = ""
            if not _normalize_text(glance):
                glance = generate_docs_module.build_glance_fallback(paper)
            _upsert_auto_block(generate_docs_module, md_path, "速览", glance)
            # Sync glance evidence/tldr back into front matter so related page top meta can show it
            if glance:
                glance_fields = generate_docs_module.parse_glance_overview_fields(glance)
                _upsert_frontmatter_evidence(generate_docs_module, md_path, glance_fields)

        # Upsert deep summary (精读) block
        if record["include_deep"]:
            deep_summary = generate_docs_module.generate_deep_summary(str(md_path), str(txt_path))
            _upsert_auto_block(generate_docs_module, md_path, "精读", deep_summary)

        written.append({
            "title": paper_title,
            "path": f"related/{md_path.name}",
            "score": record.get("score"),
            "evidence": record.get("evidence") or "",
            "tldr": glance_fields.get("tldr") or "" if glance else "",
        })
    return written


def _build_index_content(request: dict[str, Any], related_pages: list[dict[str, str]], seed_glance_fields: dict[str, str] | None = None) -> str:
    request_id = _normalize_request_id(request.get("request_id"))
    title = _paper_title_from_filename(request.get("file_name") or "")

    # Build seed paper section with glance fields (tldr, evidence, etc.)
    seed_lines = [f"- [Open seed paper](#/seed-papers/{request_id}/seed-paper)"]
    if seed_glance_fields:
        tldr = seed_glance_fields.get("tldr") or ""
        evidence = seed_glance_fields.get("evidence") or ""
        method = seed_glance_fields.get("method") or ""
        result = seed_glance_fields.get("result") or ""
        conclusion = seed_glance_fields.get("conclusion") or ""
        if tldr:
            seed_lines.append(f"  - TLDR: {_escape_markdown_text(tldr)}")
        if evidence:
            seed_lines.append(f"  - Evidence: {_escape_markdown_text(evidence)}")
        if method:
            seed_lines.append(f"  - Method: {_escape_markdown_text(method)}")
        if result:
            seed_lines.append(f"  - Result: {_escape_markdown_text(result)}")
        if conclusion:
            seed_lines.append(f"  - Conclusion: {_escape_markdown_text(conclusion)}")
    seed_block = "\n".join(seed_lines)

    # Build related papers section
    related_lines = []
    for page in related_pages:
        score_str = f" [{page.get('score', '-')}]" if page.get('score') else ""
        # Prefer tldr from generated glance; fall back to raw evidence
        related_tldr = page.get('tldr') or page.get('evidence') or ""
        tldr_str = f" - {_escape_markdown_text(related_tldr)}" if related_tldr else ""
        # Convert related/foo.md to #/seed-papers/{request_id}/related/foo
        page_path = page.get('path', '')
        if page_path.startswith('related/'):
            slug = page_path[len('related/'):].replace('.md', '')
            page_path = f"#/seed-papers/{request_id}/related/{slug}"
        related_lines.append(
            f"- [{_escape_markdown_text(page['title'])}]({page_path}){score_str}{tldr_str}"
        )
    related_block = "\n".join(related_lines) if related_lines else "- None"
    return "\n".join(
        [
            f"# {_escape_markdown_text(title)}",
            "",
            f"- Request ID: `{_escape_markdown_text(request.get('request_id'))}`",
            f"- Mode: `{_escape_markdown_text(request.get('mode'))}`",
            f"- Related count: `{request.get('related_count')}`",
            "",
            "## Seed paper",
            seed_block,
            "",
            "## Related papers",
            related_block,
            "",
        ]
    )


def render_seed_workspace(
    request: dict[str, Any],
    seed_text: str,
    selection: dict[str, Any],
    docs_dir: str,
    generate_docs_module: Any,
) -> dict[str, Any]:
    docs_root = Path(docs_dir).resolve()
    request_id = _normalize_request_id(request.get("request_id"))
    workspace_dir = _resolve_under_root(docs_root, "seed-papers", request_id)
    related_dir = _resolve_under_root(workspace_dir, "related")
    if related_dir.exists():
        shutil.rmtree(related_dir)
    related_dir.mkdir(parents=True, exist_ok=True)

    seed_page, seed_glance_fields = _render_seed_page(request, seed_text, workspace_dir, generate_docs_module)
    related_pages = _render_related_pages(selection, related_dir, generate_docs_module)

    # PR1: Disk invariant check - fail early if related pages missing
    actual_related_files = sorted([f.name for f in related_dir.glob("*.md")])
    expected_count = len(related_pages)
    actual_count = len(actual_related_files)
    if actual_count != expected_count:
        raise SeedPaperProcessingError(
            f"related page count mismatch: expected {expected_count} (from selection), "
            f"but found {actual_count} files on disk: {actual_related_files}"
        )
    if actual_count == 0:
        raise SeedPaperProcessingError(
            f"no related pages generated at {related_dir}; cannot publish seed request "
            f"with zero related papers"
        )

    index_path = workspace_dir / "index.md"
    index_path.write_text(_build_index_content(request, related_pages, seed_glance_fields), encoding="utf-8")

    return {
        "workspace_dir": str(workspace_dir),
        "index_path": str(index_path),
        "seed_page_path": str(seed_page),
        "related_page_paths": [page["path"] for page in related_pages],
    }


def _replace_or_append_block(text: str, block: str) -> str:
    if SEED_NAV_START in text and SEED_NAV_END in text:
        before, remainder = text.split(SEED_NAV_START, 1)
        _, after = remainder.split(SEED_NAV_END, 1)
        updated = before.rstrip()
        suffix = after.lstrip("\n")
        parts = [updated, block.rstrip()]
        if suffix:
            parts.append(suffix.rstrip())
        return "\n\n".join(part for part in parts if part) + "\n"
    base = text.rstrip()
    return (base + "\n\n" if base else "") + block.rstrip() + "\n"


def update_seed_navigation(docs_dir: str, request_id: str, title: str) -> None:
    docs_root = Path(docs_dir)
    readme_path = docs_root / "README.md"
    sidebar_path = docs_root / "_sidebar.md"

    readme_text = readme_path.read_text(encoding="utf-8") if readme_path.exists() else ""
    sidebar_text = sidebar_path.read_text(encoding="utf-8") if sidebar_path.exists() else ""

    clean_request_id = _normalize_request_id(request_id)
    clean_title = _escape_markdown_text(title) or clean_request_id
    readme_block = "\n".join(
        [
            SEED_NAV_START,
            "## Seed Papers",
            f"- [Latest: {clean_title}](/seed-papers/{clean_request_id}/index)",
            SEED_NAV_END,
        ]
    )
    sidebar_block = "\n".join(
        [
            SEED_NAV_START,
            "* Seed Papers",
            f'  * <a class="dpr-sidebar-root-link dpr-sidebar-noactive-link" href="javascript:void(0)" data-dpr-hash="#/seed-papers/{clean_request_id}/index">{clean_title}</a>',
            SEED_NAV_END,
        ]
    )

    readme_path.write_text(_replace_or_append_block(readme_text, readme_block), encoding="utf-8")
    sidebar_path.write_text(_replace_or_append_block(sidebar_text, sidebar_block), encoding="utf-8")


def _load_generate_docs_module() -> Any:
    module_path = Path(__file__).with_name("6.generate_docs.py")
    spec = importlib.util.spec_from_file_location("seed_generate_docs_module", module_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Unable to load generate docs module: {module_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _extract_seed_text(request: dict[str, Any], generate_docs_module: Any) -> str:
    extract_pdf_text = getattr(generate_docs_module, "extract_pdf_text", None)
    if not callable(extract_pdf_text):
        raise RuntimeError("generate_docs_module.extract_pdf_text is required")
    seed_text = _normalize_text(extract_pdf_text(request["seed_pdf_path"]))
    if not seed_text:
        raise SeedPaperProcessingError("text extraction returned empty text")
    return seed_text


@lru_cache(maxsize=1)
def _load_retrieval_helpers() -> dict[str, Any]:
    helper_specs = {
        "bm25": "2.1.retrieval_papers_bm25.py",
        "embedding": "2.2.retrieval_papers_embedding.py",
        "rank": "3.rank_papers.py",
        "router": "source_backend_router.py",
        "source_config": "source_config.py",
        "filter": "filter.py",
        "llm": "llm.py",
    }
    loaded: dict[str, Any] = {}
    for name, file_name in helper_specs.items():
        module_path = Path(__file__).with_name(file_name)
        spec = importlib.util.spec_from_file_location(f"seed_{name}_module", module_path)
        if not spec or not spec.loader:
            raise RuntimeError(f"Unable to load helper module: {module_path}")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        loaded[name] = module
    return loaded


def _build_seed_queries(request: dict[str, Any], seed_text: str) -> list[dict[str, Any]]:
    title = _paper_title_from_filename(request.get("file_name") or "")
    notes = _normalize_text(request.get("notes"))
    tags = list(request.get("selected_tags") or [])
    base_query = _build_query_summary(request, seed_text)
    semantic_query = {
        "type": "intent_query",
        "tag": tags[0] if tags else "seed-paper",
        "paper_tag": f"query:{tags[0] if tags else 'seed-paper'}",
        "paper_sources": ["arxiv", "neurips", "iclr", "icml", "acl", "emnlp", "aaai", "biorxiv"],
        "query_text": base_query,
        "logic_cn": "",
        "boolean_expr": "",
    }
    queries = [semantic_query]
    keyword_parts = [title]
    if tags:
        keyword_parts.append(" ".join(tags))
    if notes:
        keyword_parts.append(notes)
    keyword_query = " ".join(part for part in keyword_parts if _normalize_text(part))[:MAX_QUERY_TEXT_LENGTH]
    if keyword_query and keyword_query != base_query:
        queries.append(
            {
                "type": "keyword",
                "tag": tags[0] if tags else "seed-paper",
                "paper_tag": f"query:{tags[0] if tags else 'seed-paper'}",
                "paper_sources": list(semantic_query["paper_sources"]),
                "query_text": keyword_query,
                "logic_cn": "",
                "boolean_expr": "",
            }
        )
    return queries


def _seed_identity_values(request: dict[str, Any], seed_text: str) -> set[str]:
    values = {
        _normalize_text(request.get("request_id")),
        _paper_title_from_filename(request.get("file_name") or ""),
        _normalize_text(request.get("file_name")),
        _normalize_text(Path(request.get("seed_pdf_path") or "").name),
        _normalize_text(Path(request.get("source_path") or "").name),
        _normalize_text(seed_text[:256]),
    }
    normalized_values: set[str] = set()
    for value in values:
        clean_value = _normalize_text(value)
        if not clean_value:
            continue
        normalized_values.add(clean_value)
        normalized_values.add(clean_value.lower())
    return normalized_values


def _paper_matches_seed(paper: dict[str, Any], seed_identity: set[str]) -> bool:
    if not seed_identity:
        return False
    candidates = {
        _normalize_text(paper.get("id")),
        _normalize_text(paper.get("title")),
        _normalize_text(paper.get("link")),
        _normalize_text(paper.get("pdf_url")),
        _normalize_text(Path(_normalize_text(paper.get("link"))).name),
        _normalize_text(Path(_normalize_text(paper.get("pdf_url"))).name),
        _normalize_text(paper.get("abstract"))[:256],
    }
    normalized_candidates: set[str] = set()
    for value in candidates:
        clean_value = _normalize_text(value)
        if not clean_value:
            continue
        normalized_candidates.add(clean_value)
        normalized_candidates.add(clean_value.lower())
    return any(value in seed_identity for value in normalized_candidates)


def _resolve_request_root(request: dict[str, Any], root_dir: str | None = None) -> Path:
    return _derive_request_root(Path(request["seed_pdf_path"]).resolve().with_name("request.json"), root_dir)


def _default_embedding_model_name(config: dict[str, Any]) -> str:
    profiles = (((config or {}).get("subscriptions") or {}).get("intent_profiles") or [])
    for profile in profiles:
        caches = []
        caches.extend((profile.get("keywords") or []))
        caches.extend((profile.get("intent_queries") or []))
        for item in caches:
            cache = item.get("embedding_cache") if isinstance(item, dict) else None
            model_name = _normalize_text((cache or {}).get("model"))
            if model_name:
                return model_name
    return "BAAI/bge-small-en-v1.5"


def _normalize_failure_messages(messages: Any) -> list[str]:
    if messages is None:
        return []
    if isinstance(messages, str):
        values = [messages]
    elif isinstance(messages, (list, tuple)):
        values = list(messages)
    elif isinstance(messages, set):
        values = sorted(messages, key=lambda item: _normalize_text(item))
    else:
        values = [messages]
    return [_normalize_text(message) for message in values if _normalize_text(message)]


def _normalize_recall_results(result: dict[str, Any]) -> dict[str, Any]:
    papers_by_id: dict[str, dict[str, Any]] = {}
    for paper_id, paper in (result.get("papers") or {}).items():
        source_paper = paper.to_dict() if hasattr(paper, "to_dict") else dict(paper or {})
        normalized = {**source_paper, "id": _normalize_text(source_paper.get("id") or paper_id)}
        if normalized["id"]:
            papers_by_id[normalized["id"]] = normalized
    failure_messages = _normalize_failure_messages(result.get("failure_messages"))
    return {
        "queries": list(result.get("queries") or []),
        "papers": papers_by_id,
        "total_hits": int(result.get("total_hits") or 0),
        "non_empty_queries": int(result.get("non_empty_queries") or 0),
        "failure_messages": failure_messages,
    }


def _get_top_ids(query_obj: dict[str, Any]) -> list[str]:
    sim_scores = query_obj.get("sim_scores") or {}
    top_ids = query_obj.get("top_ids") or []
    if not top_ids and isinstance(sim_scores, dict) and sim_scores:
        top_ids = sorted(sim_scores.keys(), key=lambda pid: (sim_scores[pid].get("rank", 10**9), pid))
    return [_normalize_text(item) for item in top_ids if _normalize_text(item)]


def _unique_keep_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for item in items:
        clean_item = _normalize_text(item)
        if not clean_item or clean_item in seen:
            continue
        seen.add(clean_item)
        ordered.append(clean_item)
    return ordered


def _build_candidate_ids(queries: list[dict[str, Any]], related_count: int) -> list[str]:
    score_map: dict[str, float] = {}
    hit_count: dict[str, int] = {}
    guaranteed_ids: list[str] = []
    lane_top_k = max(_normalize_related_count(related_count) * 4, 10)
    guaranteed_per_lane = max(_normalize_related_count(related_count), 1)
    global_limit = max(_normalize_related_count(related_count) * 8, 10)
    rrf_k = 60

    for query in queries:
        top_ids = _get_top_ids(query)[:lane_top_k]
        if not top_ids:
            continue
        guaranteed_ids.extend(top_ids[:guaranteed_per_lane])
        for rank_idx, paper_id in enumerate(top_ids, start=1):
            score_map[paper_id] = score_map.get(paper_id, 0.0) + 1.0 / (rrf_k + rank_idx)
            hit_count[paper_id] = hit_count.get(paper_id, 0) + 1

    ranked_ids = [
        paper_id
        for paper_id, _ in sorted(
            score_map.items(),
            key=lambda item: (-item[1], -hit_count.get(item[0], 0), item[0]),
        )
    ]
    return _unique_keep_order(guaranteed_ids + ranked_ids[:global_limit])


def _empty_recall_results(*, failure_messages: list[str] | None = None) -> dict[str, Any]:
    return {
        "queries": [],
        "papers": {},
        "total_hits": 0,
        "non_empty_queries": 0,
        "failure_messages": list(failure_messages or []),
    }


def _has_recalled_papers(result: dict[str, Any]) -> bool:
    return bool((result or {}).get("papers"))


def _error_message(error: Exception) -> str:
    if isinstance(error, RecallLaneFailure):
        return " | ".join(error.diagnostic_messages) if error.diagnostic_messages else _normalize_text(error)
    return _normalize_text(error)


def _build_recall_lane_error(result: dict[str, Any]) -> RecallLaneFailure | None:
    messages = _normalize_failure_messages((result or {}).get("failure_messages"))
    if not messages:
        return None
    joined_messages = " | ".join(messages)
    if "pgrst202" in joined_messages.lower() or "could not find the function" in joined_messages.lower() or (
        "schema cache" in joined_messages.lower() and "function" in joined_messages.lower()
    ):
        return RecallLaneFailure(
            "missing_function",
            "seed recall backend is missing required RPC support",
            diagnostic_messages=messages,
        )
    if (
        "57014" in joined_messages.lower()
        or "statement timeout" in joined_messages.lower()
        or "canceling statement due to statement timeout" in joined_messages.lower()
    ):
        return RecallLaneFailure(
            "statement_timeout",
            "seed recall timed out",
            diagnostic_messages=messages,
        )
    return RecallLaneFailure(
        "backend_error",
        "seed recall backend request failed",
        diagnostic_messages=messages,
    )


def _is_missing_supabase_function_error(error: Exception) -> bool:
    message = _error_message(error).lower()
    return (isinstance(error, RecallLaneFailure) and error.reason == "missing_function") or (
        bool(message)
        and (
            "pgrst202" in message
            or "could not find the function" in message
            or ("schema cache" in message and "function" in message)
        )
    )


def _is_statement_timeout_error(error: Exception) -> bool:
    message = _error_message(error).lower()
    return (isinstance(error, RecallLaneFailure) and error.reason == "statement_timeout") or (
        bool(message)
        and (
            "57014" in message
            or "statement timeout" in message
            or "canceling statement due to statement timeout" in message
        )
    )


def _safe_error_summary(error: Exception) -> str:
    if isinstance(error, RecallLaneFailure):
        if error.reason == "missing_function":
            return "missing required RPC support"
        if error.reason == "statement_timeout":
            return "statement timeout"
        if error.reason:
            return error.reason.replace("_", " ")
    summary = _normalize_text(error).splitlines()[0]
    lowered_summary = summary.lower()
    if lowered_summary in {"rerank 未启用", "rerank_enabled=false"}:
        return "rerank disabled"
    return summary[:200] if summary else type(error).__name__


def _warn_recall_lane_error(source_key: str, lane_name: str, error: Exception) -> None:
    print(
        f"[WARN] seed recall {lane_name} failed for {source_key}: {_safe_error_summary(error)}",
        file=sys.stderr,
    )


def _resolve_multi_source_backend(module: Any, resolver_name: str, config: dict[str, Any], queries: list[dict[str, Any]]) -> dict[str, Any] | None:
    resolver = getattr(module, resolver_name, None)
    if not callable(resolver):
        return None
    return resolver(config, queries)


def _multi_source_rpc_enabled() -> bool:
    return _normalize_text(os.getenv("DPR_ENABLE_MULTI_SOURCE_RPC")).lower() in {"1", "true", "yes", "on"}


def _extract_year(value: Any) -> str:
    text = _normalize_text(value)
    match = re.search(r"\b(19|20)\d{2}\b", text)
    return match.group(0) if match else ""


def _format_rerank_document(paper: dict[str, Any]) -> str:
    lines: list[str] = []
    source = _normalize_text(paper.get("source"))
    venue = _normalize_text(paper.get("venue_id") or paper.get("venue"))
    year = _extract_year(paper.get("published") or paper.get("year") or venue)
    title = _normalize_text(paper.get("title"))
    abstract = _normalize_text(paper.get("abstract"))
    if source:
        lines.append(f"Source: {source}")
    if venue:
        lines.append(f"Venue: {venue}")
    if year:
        lines.append(f"Year: {year}")
    lines.append(f"Title: {title}")
    lines.append(f"Abstract: {abstract}")
    return "\n".join(lines).strip()


def retrieve_related_papers(request: dict[str, Any], seed_text: str) -> dict[str, Any]:
    helpers = _load_retrieval_helpers()
    source_config_module = helpers["source_config"]
    router_module = helpers["router"]
    bm25_module = helpers["bm25"]
    embedding_module = helpers["embedding"]
    filter_module = helpers["filter"]

    request_root = _resolve_request_root(request)
    config_path = request_root / "config.yaml"
    config = source_config_module.load_config_with_source_migration(str(config_path), write_back=False)
    queries = _build_seed_queries(request, seed_text)
    if not queries:
        return _empty_recall_results()

    grouped_queries = router_module.group_queries_by_source(queries)
    merged_results: list[dict[str, Any]] = []
    collected_failure_messages: list[str] = []
    related_top_k = max(_normalize_related_count(request.get("related_count")) * 8, 10)
    embedding_model_name = _default_embedding_model_name(config)
    multi_source_enabled = _multi_source_rpc_enabled()
    multi_source_bm25_backend = (
        _resolve_multi_source_backend(
            bm25_module,
            "resolve_multi_source_bm25_backend",
            config,
            queries,
        )
        if multi_source_enabled
        else None
    )
    multi_source_vector_backend = (
        _resolve_multi_source_backend(
            embedding_module,
            "resolve_multi_source_vector_backend",
            config,
            queries,
        )
        if multi_source_enabled
        else None
    )
    recall_window_resolver = getattr(bm25_module, "resolve_supabase_recall_window", None)
    if not callable(recall_window_resolver):
        recall_window_resolver = getattr(embedding_module, "resolve_supabase_recall_window", None)
    recall_start_dt, recall_end_dt = recall_window_resolver(config) if callable(recall_window_resolver) else (None, None)
    coarse_filter = None

    def get_embedding_model():
        nonlocal coarse_filter
        if coarse_filter is None:
            coarse_filter = filter_module.EmbeddingCoarseFilter(model_name=embedding_model_name, top_k=50, device="cpu")
        return coarse_filter.model

    def run_bm25_recall(source_queries: list[dict[str, Any]], backend: dict[str, Any]) -> dict[str, Any]:
        return _normalize_recall_results(
            bm25_module.rank_papers_for_queries_via_supabase(
                source_queries,
                top_k=related_top_k,
                supabase_conf=backend,
                start_dt=recall_start_dt,
                end_dt=recall_end_dt,
                query_filter_sources=False,
            )
        )

    def run_vector_recall(
        source_queries: list[dict[str, Any]],
        backend: dict[str, Any],
        *,
        query_filter_sources: bool = False,
    ) -> dict[str, Any]:
        return _normalize_recall_results(
            embedding_module.rank_papers_for_queries_via_supabase(
                get_embedding_model(),
                source_queries,
                top_k=related_top_k,
                supabase_conf=backend,
                start_dt=recall_start_dt,
                end_dt=recall_end_dt,
                rpc_name_override=str(backend.get("vector_rpc_exact") or backend.get("vector_rpc") or "").strip() or None,
                rpc_mode="exact",
                query_filter_sources=query_filter_sources,
            )
        )

    def run_multi_source_bm25_recall(source_queries: list[dict[str, Any]], error: Exception) -> dict[str, Any]:
        if not multi_source_bm25_backend:
            raise error
        return _normalize_recall_results(
            bm25_module.rank_papers_for_queries_via_supabase(
                source_queries,
                top_k=related_top_k,
                supabase_conf=multi_source_bm25_backend,
                start_dt=recall_start_dt,
                end_dt=recall_end_dt,
                query_filter_sources=True,
            )
        )

    def run_multi_source_vector_recall(source_queries: list[dict[str, Any]], error: Exception) -> dict[str, Any]:
        if not multi_source_vector_backend:
            raise error
        return run_vector_recall(source_queries, multi_source_vector_backend, query_filter_sources=True)

    def execute_recall_lane(
        source_key: str,
        lane_name: str,
        primary_runner: Callable[[], dict[str, Any]],
        fallback_runner: Callable[[Exception], dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        def public_lane_error(error: Exception) -> Exception:
            if isinstance(error, RecallLaneFailure):
                return error
            if _is_missing_supabase_function_error(error):
                return RecallLaneFailure(
                    "missing_function",
                    "seed recall backend is missing required RPC support",
                    diagnostic_messages=[_error_message(error)],
                )
            return error

        def handle_lane_error(error: Exception) -> dict[str, Any]:
            if _is_missing_supabase_function_error(error) and fallback_runner is not None:
                try:
                    return fallback_runner(error)
                except Exception as fallback_exc:
                    if _is_statement_timeout_error(fallback_exc):
                        _warn_recall_lane_error(source_key, lane_name, fallback_exc)
                        return _empty_recall_results(failure_messages=[_error_message(fallback_exc)])
                    raise public_lane_error(fallback_exc)
            if _is_statement_timeout_error(error):
                _warn_recall_lane_error(source_key, lane_name, error)
                return _empty_recall_results(failure_messages=[_error_message(error)])
            raise public_lane_error(error)

        try:
            result = primary_runner()
        except Exception as exc:
            return handle_lane_error(exc)
        if _has_recalled_papers(result):
            return result
        lane_error = _build_recall_lane_error(result)
        if lane_error is None:
            return result
        return handle_lane_error(lane_error)

    for source_key, source_queries in grouped_queries.items():
        backend = source_config_module.get_source_backend(config, source_key)
        if not backend or not backend.get("enabled"):
            continue
        source_results: list[dict[str, Any]] = []
        if backend.get("use_bm25_rpc"):
            bm25_result = execute_recall_lane(
                source_key,
                "bm25",
                lambda: run_bm25_recall(source_queries, backend),
                lambda exc: run_multi_source_bm25_recall(source_queries, exc),
            )
            collected_failure_messages.extend(_normalize_failure_messages(bm25_result.get("failure_messages")))
            if _has_recalled_papers(bm25_result):
                source_results.append(bm25_result)
        if backend.get("use_vector_rpc"):
            embedding_result = execute_recall_lane(
                source_key,
                "vector",
                lambda: run_vector_recall(source_queries, backend),
                lambda exc: run_multi_source_vector_recall(source_queries, exc),
            )
            collected_failure_messages.extend(_normalize_failure_messages(embedding_result.get("failure_messages")))
            if _has_recalled_papers(embedding_result):
                source_results.append(embedding_result)
        if source_results:
            merged_results.append(router_module.merge_pipeline_results(source_results))

    if not merged_results:
        return _empty_recall_results(failure_messages=collected_failure_messages)
    merged = _normalize_recall_results(router_module.merge_pipeline_results(merged_results))
    merged["failure_messages"] = _normalize_failure_messages(
        [*merged.get("failure_messages", []), *collected_failure_messages]
    )
    return merged


def _build_rerank_documents(papers_by_id: dict[str, dict[str, Any]], paper_ids: list[str]) -> list[str]:
    documents: list[str] = []
    for paper_id in paper_ids:
        paper = dict(papers_by_id.get(paper_id) or {})
        if paper:
            documents.append(_format_rerank_document(paper))
        else:
            documents.append(f"[Missing paper {paper_id}]")
    return documents


def _build_ranked_related_paper(paper_id: str, paper: dict[str, Any], llm_score: Any) -> dict[str, Any]:
    llm_tags = list(paper.get("tags") or paper.get("llm_tags") or [])
    return {
        **paper,
        "id": _normalize_text(paper.get("id") or paper_id),
        "title": _normalize_text(paper.get("title")) or paper_id,
        "abstract": _normalize_text(paper.get("abstract")),
        "link": _validate_related_link(paper.get("link")),
        "llm_tags": llm_tags,
        "llm_score": llm_score,
    }


def _build_retrieval_order_fallback(
    papers_by_id: dict[str, dict[str, Any]],
    filtered_ids: list[str],
) -> list[dict[str, Any]]:
    return [
        _build_ranked_related_paper(paper_id, dict(papers_by_id.get(paper_id) or {}), None)
        for paper_id in filtered_ids
    ]


def _warn_rerank_fallback(error: Exception) -> None:
    print(
        f"[WARN] seed rerank unavailable, falling back to retrieval order: {_safe_error_summary(error)}",
        file=sys.stderr,
    )


def _is_rerank_fallback_error(error: Exception) -> bool:
    message = _error_message(error).lower()
    if isinstance(error, requests.exceptions.Timeout):
        return True
    if isinstance(error, requests.exceptions.ConnectionError):
        return True
    if isinstance(error, requests.exceptions.HTTPError):
        response = getattr(error, "response", None)
        status_code = getattr(response, "status_code", None)
        if isinstance(status_code, int) and status_code >= 500:
            return True
        return "non-json rerank response" in message
    return bool(message) and (
        message == "rerank 未启用"
        or message == "rerank_enabled=false"
        or "timed out" in message
        or "timeout" in message
        or "non-json rerank response" in message
        or "rerank 未命中可用 base" in message
    )


def _resolve_reranker(reranker: Any | None = None) -> Any:
    if reranker is not None:
        return reranker
    helpers = _load_retrieval_helpers()
    llm_module = helpers["llm"]
    rerank_model = helpers["rank"].resolve_default_rerank_model()
    return llm_module.ClientFactory.from_env(scope="rerank", model_override=rerank_model, default_model=rerank_model)


def rank_related_papers(
    request: dict[str, Any],
    seed_text: str,
    *,
    retrieve_related: Callable[[dict[str, Any], str], dict[str, Any]] | None = None,
    reranker: Any | None = None,
    seed_identity: set[str] | None = None,
) -> tuple[list[dict[str, Any]], str]:
    """Returns (ranked_papers, rerank_status) where rerank_status is 'full_success', 'degraded_success', or 'skipped'."""
    recall = (retrieve_related or retrieve_related_papers)(request, seed_text)
    papers_by_id = {str(paper_id): dict(paper or {}) for paper_id, paper in (recall.get("papers") or {}).items()}
    queries = list(recall.get("queries") or [])
    if not queries:
        recall_error = _build_recall_lane_error(recall)
        if recall_error is not None:
            raise SeedPaperProcessingError(str(recall_error))
        raise SeedPaperProcessingError("retrieval returned no query lanes")
    if not papers_by_id:
        recall_error = _build_recall_lane_error(recall)
        if recall_error is not None:
            raise SeedPaperProcessingError(str(recall_error))
        raise SeedPaperProcessingError("retrieval returned no recalled papers")

    candidate_ids = _build_candidate_ids(queries, _normalize_related_count(request.get("related_count")))
    if not candidate_ids:
        raise SeedPaperProcessingError("retrieval produced no candidate ids")
    effective_seed_identity = set(seed_identity or _seed_identity_values(request, seed_text))
    filtered_ids = [paper_id for paper_id in candidate_ids if paper_id in papers_by_id and not _paper_matches_seed(papers_by_id[paper_id], effective_seed_identity)]
    if not filtered_ids:
        raise SeedPaperProcessingError("retrieval only returned seed-paper matches")

    documents = _build_rerank_documents(papers_by_id, filtered_ids)
    try:
        active_reranker = _resolve_reranker(reranker)
        query_text = _build_query_summary(request, seed_text) or _paper_title_from_filename(request.get("file_name") or "")
        rerank_model = _normalize_text(getattr(active_reranker, "model", "")) or None
        response = active_reranker.rerank(query=query_text, documents=documents, top_n=len(documents), model=rerank_model)
        results = (response.get("output") or {}).get("results") if isinstance(response, dict) and "output" in response else response.get("results", [])
        ranked = sorted(results or [], key=lambda item: item.get("relevance_score", item.get("score", 0.0)), reverse=True)
    except Exception as exc:
        if not _is_rerank_fallback_error(exc):
            raise SeedPaperProcessingError(_error_message(exc) or "rerank failed") from exc
        _warn_rerank_fallback(exc)
        return (_build_retrieval_order_fallback(papers_by_id, filtered_ids), "degraded_success")

    ordered: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for item in ranked:
        index = item.get("index")
        if not isinstance(index, int) or index < 0 or index >= len(filtered_ids):
            continue
        paper_id = filtered_ids[index]
        if paper_id in seen_ids:
            continue
        seen_ids.add(paper_id)
        paper = dict(papers_by_id.get(paper_id) or {})
        ordered.append(
            _build_ranked_related_paper(
                paper_id,
                paper,
                item.get("relevance_score", item.get("score", 0.0)),
            )
        )
    if not ordered:
        return (_build_retrieval_order_fallback(papers_by_id, filtered_ids), "degraded_success")
    for paper_id in filtered_ids:
        if paper_id in seen_ids:
            continue
        paper = dict(papers_by_id.get(paper_id) or {})
        ordered.append(_build_ranked_related_paper(paper_id, paper, None))
    return (ordered, "full_success")


def _load_ranked_related_fixture(fixture_path: str) -> list[dict[str, Any]]:
    payload = json.loads(Path(fixture_path).read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Expected ranked related fixture list: {fixture_path}")
    ranked_related: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            raise ValueError(f"Expected ranked related fixture item dict: {fixture_path}")
        paper_id = _normalize_text(item.get("id"))
        paper_title = _normalize_text(item.get("title"))
        if not paper_id or not paper_title:
            raise ValueError(f"Expected ranked related fixture item with id/title: {fixture_path}")
        llm_tags = item.get("llm_tags") if isinstance(item.get("llm_tags"), list) else []
        llm_score = item.get("llm_score")
        ranked_related.append(
            {
                "id": paper_id,
                "title": paper_title,
                "abstract": _normalize_text(item.get("abstract")),
                "link": _validate_related_link(item.get("link")),
                "llm_tags": [_normalize_text(tag) for tag in llm_tags if _normalize_text(tag)],
                "llm_score": llm_score,
            }
        )
    return ranked_related


def process_request(
    request_path: str,
    *,
    request_id: str | None = None,
    root_dir: str | None = None,
    docs_dir: str | None = None,
    seed_mode: str | None = None,
    generate_docs_module: Any | None = None,
    retrieve_related: Callable[[dict[str, Any], str], dict[str, Any]] | None = None,
    reranker: Any | None = None,
    ranked_related: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    request = load_request(request_path, root_dir=root_dir)
    if _normalize_text(request_id):
        expected_request_id = _normalize_request_id(request_id)
        if request["request_id"] != expected_request_id:
            raise ValueError(f"Unexpected request_id: {request_id}")
        request = {**request, "request_id": expected_request_id}
    if _normalize_text(seed_mode):
        request = {**request, "mode": _normalize_mode(seed_mode)}

    request_root = _derive_request_root(Path(request_path).resolve(), root_dir)
    docs_root = Path(docs_dir).resolve() if docs_dir else _resolve_under_root(request_root, "docs")
    docs_root.mkdir(parents=True, exist_ok=True)

    docs_module = generate_docs_module or _load_generate_docs_module()
    seed_text = _extract_seed_text(request, docs_module)
    if ranked_related is not None:
        resolved_ranked_related = list(ranked_related)
        rerank_status = "skipped"
    else:
        resolved_ranked_related, rerank_status = rank_related_papers(
            request,
            seed_text,
            retrieve_related=retrieve_related,
            reranker=reranker,
        )
    selection = select_related_outputs(resolved_ranked_related, mode=request["mode"], related_count=request["related_count"])
    if not _iter_unique_related(selection):
        raise SeedPaperProcessingError("selection produced no related outputs")
    written = render_seed_workspace(
        request,
        seed_text=seed_text,
        selection=selection,
        docs_dir=str(docs_root),
        generate_docs_module=docs_module,
    )
    update_seed_navigation(
        docs_dir=str(docs_root),
        request_id=request["request_id"],
        title=_paper_title_from_filename(request.get("file_name") or ""),
    )
    return {
        "request": request,
        "seed_text": seed_text,
        "rerank_status": rerank_status,
        **written,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Process a seed paper request and write docs outputs.")
    parser.add_argument("--request-path", required=True, help="Path to archive/seed-papers/<id>/request.json")
    parser.add_argument("--request-id", default="", help="Expected request id slug")
    parser.add_argument("--root-dir", default="", help="Optional repository root override")
    parser.add_argument("--docs-dir", default="", help="Optional docs output directory override")
    parser.add_argument("--seed-mode", default="", help="Optional mode override: skim/deep/both")
    parser.add_argument(
        "--ranked-related-fixture",
        default="",
        help="Optional JSON file containing a ranked related-paper list to bypass live retrieval/rerank",
    )
    args = parser.parse_args()

    ranked_related = None
    if args.ranked_related_fixture:
        ranked_related = _load_ranked_related_fixture(args.ranked_related_fixture)

    try:
        result = process_request(
            args.request_path,
            request_id=args.request_id or None,
            root_dir=args.root_dir or None,
            docs_dir=args.docs_dir or None,
            seed_mode=args.seed_mode or None,
            ranked_related=ranked_related,
        )
    except (SeedPaperProcessingError, ValueError) as exc:
        raise SystemExit(str(exc)) from exc
    print(
        json.dumps(
            {
                "request_id": result["request"]["request_id"],
                "mode": result["request"]["mode"],
                "workspace_dir": result["workspace_dir"],
                "index_path": result["index_path"],
                "seed_page_path": result.get("seed_page_path", ""),
                "related_page_paths": result.get("related_page_paths", []),
                "related_count": len(result.get("related_page_paths", [])),
                "rerank_status": result["rerank_status"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
