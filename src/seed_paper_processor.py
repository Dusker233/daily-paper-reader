from __future__ import annotations

import argparse
import importlib.util
import json
import re
import shutil
from collections import Counter
from functools import lru_cache
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import urlparse


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
    if mode in {"skim", "both"}:
        glance = generate_docs_module.generate_glance_overview(title, clean_seed_text, clean_seed_text)
        if not _normalize_text(glance):
            glance = generate_docs_module.build_glance_fallback(paper)
        _upsert_auto_block(generate_docs_module, md_path, "速览", glance)
    if mode in {"deep", "both"}:
        deep_summary = generate_docs_module.generate_deep_summary(str(md_path), str(txt_path))
        _upsert_auto_block(generate_docs_module, md_path, "精读", deep_summary)

    return md_path


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
    written: list[dict[str, str]] = []
    for record in _build_related_records(selection):
        paper = record["paper"]
        paper_title = record["title"]
        md_path = _build_related_output_path(related_dir, record["basename"], ".md")
        txt_path = _build_related_output_path(related_dir, record["basename"], ".txt")
        tags = list(paper.get("llm_tags") or [])
        md_path.write_text(
            generate_docs_module.build_markdown_content(
                paper,
                "related-paper",
                paper_title,
                _normalize_text(paper.get("abstract")),
                tags,
            ),
            encoding="utf-8",
        )

        paper_text = ""
        if record["include_deep"]:
            if not txt_path.exists():
                txt_path.write_text(_normalize_text(paper.get("abstract")), encoding="utf-8")
            paper_text = _normalize_text(txt_path.read_text(encoding="utf-8"))

        if record["include_quick"]:
            glance = generate_docs_module.generate_glance_overview(
                _normalize_text(paper.get("title")),
                _normalize_text(paper.get("abstract")),
                paper_text,
            )
            if not _normalize_text(glance):
                glance = generate_docs_module.build_glance_fallback(paper)
            _upsert_auto_block(generate_docs_module, md_path, "速览", glance)

        if record["include_deep"]:
            deep_summary = generate_docs_module.generate_deep_summary(str(md_path), str(txt_path))
            _upsert_auto_block(generate_docs_module, md_path, "精读", deep_summary)

        written.append({"title": paper_title, "path": f"related/{md_path.name}"})
    return written


def _build_index_content(request: dict[str, Any], related_pages: list[dict[str, str]]) -> str:
    title = _paper_title_from_filename(request.get("file_name") or "")
    related_lines = [
        f"- [{_escape_markdown_text(page['title'])}]({page['path']})" for page in related_pages
    ]
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
            "- [Open seed paper](seed-paper.md)",
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

    seed_page = _render_seed_page(request, seed_text, workspace_dir, generate_docs_module)
    related_pages = _render_related_pages(selection, related_dir, generate_docs_module)
    index_path = workspace_dir / "index.md"
    index_path.write_text(_build_index_content(request, related_pages), encoding="utf-8")

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
            f"  * [{clean_title}](#/seed-papers/{clean_request_id}/index)",
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


def _normalize_recall_results(result: dict[str, Any]) -> dict[str, Any]:
    papers_by_id: dict[str, dict[str, Any]] = {}
    for paper_id, paper in (result.get("papers") or {}).items():
        source_paper = paper.to_dict() if hasattr(paper, "to_dict") else dict(paper or {})
        normalized = {**source_paper, "id": _normalize_text(source_paper.get("id") or paper_id)}
        if normalized["id"]:
            papers_by_id[normalized["id"]] = normalized
    return {
        "queries": list(result.get("queries") or []),
        "papers": papers_by_id,
        "total_hits": int(result.get("total_hits") or 0),
        "non_empty_queries": int(result.get("non_empty_queries") or 0),
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
        return {"queries": [], "papers": {}, "total_hits": 0, "non_empty_queries": 0}

    grouped_queries = router_module.group_queries_by_source(queries)
    merged_results: list[dict[str, Any]] = []
    embedding_model_name = _default_embedding_model_name(config)
    coarse_filter = None

    def get_embedding_model():
        nonlocal coarse_filter
        if coarse_filter is None:
            coarse_filter = filter_module.EmbeddingCoarseFilter(model_name=embedding_model_name, top_k=50, device="cpu")
        return coarse_filter.model

    for source_key, source_queries in grouped_queries.items():
        backend = source_config_module.get_source_backend(config, source_key)
        if not backend or not backend.get("enabled"):
            continue
        source_results: list[dict[str, Any]] = []
        if backend.get("use_bm25_rpc"):
            bm25_result = bm25_module.rank_papers_for_queries_via_supabase(
                source_queries,
                top_k=max(_normalize_related_count(request.get("related_count")) * 8, 10),
                supabase_conf=backend,
                start_dt=None,
                end_dt=None,
                query_filter_sources=True,
            )
            source_results.append(_normalize_recall_results(bm25_result))
        if backend.get("use_vector_rpc"):
            embedding_result = embedding_module.rank_papers_for_queries_via_supabase(
                get_embedding_model(),
                source_queries,
                top_k=max(_normalize_related_count(request.get("related_count")) * 8, 10),
                supabase_conf=backend,
                start_dt=None,
                end_dt=None,
                rpc_name_override=str(backend.get("vector_rpc_exact") or backend.get("vector_rpc") or "").strip() or None,
                rpc_mode="exact",
                query_filter_sources=True,
            )
            source_results.append(_normalize_recall_results(embedding_result))
        if source_results:
            merged_results.append(router_module.merge_pipeline_results(source_results))

    if not merged_results:
        return {"queries": [], "papers": {}, "total_hits": 0, "non_empty_queries": 0}
    return _normalize_recall_results(router_module.merge_pipeline_results(merged_results))


def _build_rerank_documents(papers_by_id: dict[str, dict[str, Any]], paper_ids: list[str]) -> list[str]:
    documents: list[str] = []
    for paper_id in paper_ids:
        paper = dict(papers_by_id.get(paper_id) or {})
        if paper:
            documents.append(_format_rerank_document(paper))
        else:
            documents.append(f"[Missing paper {paper_id}]")
    return documents


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
) -> list[dict[str, Any]]:
    recall = (retrieve_related or retrieve_related_papers)(request, seed_text)
    papers_by_id = {str(paper_id): dict(paper or {}) for paper_id, paper in (recall.get("papers") or {}).items()}
    queries = list(recall.get("queries") or [])
    if not queries:
        raise SeedPaperProcessingError("retrieval returned no query lanes")
    if not papers_by_id:
        raise SeedPaperProcessingError("retrieval returned no recalled papers")

    candidate_ids = _build_candidate_ids(queries, _normalize_related_count(request.get("related_count")))
    if not candidate_ids:
        raise SeedPaperProcessingError("retrieval produced no candidate ids")
    effective_seed_identity = set(seed_identity or _seed_identity_values(request, seed_text))
    filtered_ids = [paper_id for paper_id in candidate_ids if paper_id in papers_by_id and not _paper_matches_seed(papers_by_id[paper_id], effective_seed_identity)]
    if not filtered_ids:
        raise SeedPaperProcessingError("retrieval only returned seed-paper matches")

    documents = _build_rerank_documents(papers_by_id, filtered_ids)
    active_reranker = _resolve_reranker(reranker)
    query_text = _build_query_summary(request, seed_text) or _paper_title_from_filename(request.get("file_name") or "")
    rerank_model = _normalize_text(getattr(active_reranker, "model", "")) or None
    response = active_reranker.rerank(query=query_text, documents=documents, top_n=len(documents), model=rerank_model)
    results = (response.get("output") or {}).get("results") if isinstance(response, dict) and "output" in response else response.get("results", [])
    ranked = sorted(results or [], key=lambda item: item.get("relevance_score", item.get("score", 0.0)), reverse=True)

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
        llm_tags = list(paper.get("tags") or paper.get("llm_tags") or [])
        ordered.append(
            {
                **paper,
                "id": _normalize_text(paper.get("id") or paper_id),
                "title": _normalize_text(paper.get("title")) or paper_id,
                "abstract": _normalize_text(paper.get("abstract")),
                "link": _validate_related_link(paper.get("link")),
                "llm_tags": llm_tags,
                "llm_score": item.get("relevance_score", item.get("score", 0.0)),
            }
        )
    if not ordered:
        raise SeedPaperProcessingError("rerank returned no scored results")
    for paper_id in filtered_ids:
        if paper_id in seen_ids:
            continue
        paper = dict(papers_by_id.get(paper_id) or {})
        ordered.append(
            {
                **paper,
                "id": _normalize_text(paper.get("id") or paper_id),
                "title": _normalize_text(paper.get("title")) or paper_id,
                "abstract": _normalize_text(paper.get("abstract")),
                "link": _validate_related_link(paper.get("link")),
                "llm_tags": list(paper.get("tags") or paper.get("llm_tags") or []),
                "llm_score": None,
            }
        )
    return ordered


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
    resolved_ranked_related = list(ranked_related) if ranked_related is not None else rank_related_papers(
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
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
