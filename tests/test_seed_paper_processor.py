import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_module(module_name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


class _StubGenerateDocs:
    ensure_text_content_calls = []
    glance_calls = []

    @staticmethod
    def extract_pdf_text(pdf_path):
        return f"extracted from {Path(pdf_path).name}"

    @staticmethod
    def build_markdown_content(paper, section, zh_title, zh_abstract, tags_list):
        return "\n".join(
            [
                f"# {paper.get('title') or ''}",
                "",
                f"section: {section}",
                f"tags: {', '.join(tags_list)}",
                f"link: {paper.get('link') or ''}",
                "",
                paper.get("abstract") or "",
            ]
        )

    @staticmethod
    def generate_glance_overview(title, abstract, paper_text="", max_retries=3):
        _StubGenerateDocs.glance_calls.append(
            {"title": title, "abstract": abstract, "paper_text": paper_text, "max_retries": max_retries}
        )
        return "\n".join(
            [
                f"**TLDR**：{title} 讲了什么、方法为什么有效、值不值得继续细读。 \\",
                "**Research Question**：这篇工作具体在解决什么问题。 \\",
                "**Core Idea**：核心方法由哪些关键模块组成。 \\",
                "**Evidence**：实验里最值得关注的结果信号是什么。 \\",
                "**Reading Guide**：如果继续精读，优先看方法和实验两部分。",
            ]
        )

    @staticmethod
    def build_glance_fallback(paper):
        return f"fallback: {paper.get('title') or ''}"

    @staticmethod
    def generate_deep_summary(md_path, txt_path):
        return "\n".join(
            [
                "### 问题定义与背景",
                f"- deep summary from {Path(txt_path).name}",
                "### 方法拆解",
                "- 方法细节一",
                "### 实验与证据",
                "- 关键实验结论",
                "### 局限与启发",
                "- 局限说明",
            ]
        )

    @staticmethod
    def upsert_auto_block(md_path, heading, content):
        path = Path(md_path)
        existing = path.read_text(encoding="utf-8") if path.exists() else ""
        path.write_text(
            existing + f"\n\n## {heading}\n{content}\n",
            encoding="utf-8",
        )

    @staticmethod
    def ensure_text_content(pdf_url, txt_path):
        _StubGenerateDocs.ensure_text_content_calls.append({"pdf_url": pdf_url, "txt_path": txt_path})
        Path(txt_path).write_text(f"downloaded from {pdf_url}", encoding="utf-8")
        return f"downloaded from {pdf_url}"


class _StubReranker:
    model = "stub-rerank-model"

    def __init__(self, results):
        self._results = list(results)
        self.calls = []

    def rerank(self, query, documents, top_n=None, model=None):
        self.calls.append(
            {
                "query": query,
                "documents": list(documents),
                "top_n": top_n,
                "model": model,
            }
        )
        return {"results": list(self._results)}


class _EmptySeedTextGenerateDocs(_StubGenerateDocs):
    @staticmethod
    def extract_pdf_text(pdf_path):
        return "   "


class SeedPaperProcessorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        cls.mod = _load_module("seed_paper_processor_mod", src_dir / "seed_paper_processor.py")

    def setUp(self):
        _StubGenerateDocs.ensure_text_content_calls = []
        _StubGenerateDocs.glance_calls = []

    def _write_request(self, root: Path, payload: dict, request_id: str = "demo-request"):
        request_dir = root / "archive" / "seed-papers" / request_id
        request_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = request_dir / "seed-paper.pdf"
        pdf_path.write_bytes(b"%PDF-1.4\n")
        request_path = request_dir / "request.json"
        request_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return request_path, pdf_path

    def test_load_request_parses_valid_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": " Seed Paper.pdf ",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 3,
                    "selected_tags": [" RL ", "", "Security", "RL"],
                    "mode": "DEEP",
                    "notes": " focus on methods ",
                },
            )

            request = self.mod.load_request(str(request_path), root_dir=str(root))

            self.assertEqual(request["request_id"], "demo-request")
            self.assertEqual(request["file_name"], "Seed Paper.pdf")
            self.assertEqual(Path(request["seed_pdf_path"]).resolve(), pdf_path.resolve())
            self.assertEqual(request["related_count"], 3)
            self.assertEqual(request["selected_tags"], ["RL", "Security"])
            self.assertEqual(request["mode"], "deep")
            self.assertEqual(request["notes"], "focus on methods")

    def test_load_request_derives_archive_root_without_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": ["RL"],
                    "mode": "skim",
                    "notes": "",
                },
            )

            request = self.mod.load_request(str(request_path))

            self.assertEqual(request["request_id"], "demo-request")
            self.assertEqual(Path(request["seed_pdf_path"]).resolve(), pdf_path.resolve())

    def test_load_request_rejects_legacy_request_tree_without_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_dir = root / "requests" / "seed_papers" / "demo-request"
            request_dir.mkdir(parents=True, exist_ok=True)
            (request_dir / "seed-paper.pdf").write_bytes(b"%PDF-1.4\n")
            request_path = request_dir / "request.json"
            request_path.write_text(
                json.dumps(
                    {
                        "file_name": "Seed Paper.pdf",
                        "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                        "related_count": 2,
                        "selected_tags": [],
                        "mode": "skim",
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "Unexpected request path"):
                self.mod.load_request(str(request_path))

    def test_load_request_rejects_legacy_request_tree_with_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_dir = root / "requests" / "seed_papers" / "demo-request"
            request_dir.mkdir(parents=True, exist_ok=True)
            archive_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            archive_pdf.parent.mkdir(parents=True, exist_ok=True)
            archive_pdf.write_bytes(b"%PDF-1.4\n")
            request_path = request_dir / "request.json"
            request_path.write_text(
                json.dumps(
                    {
                        "file_name": "Seed Paper.pdf",
                        "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                        "related_count": 2,
                        "selected_tags": [],
                        "mode": "skim",
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            with self.assertRaisesRegex(ValueError, "Unexpected request path"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_load_request_rejects_request_path_outside_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp, tempfile.TemporaryDirectory() as other_tmp:
            root = Path(tmp)
            other_root = Path(other_tmp)
            request_path, _ = self._write_request(
                other_root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": [],
                    "mode": "skim",
                },
            )
            archive_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            archive_pdf.parent.mkdir(parents=True, exist_ok=True)
            archive_pdf.write_bytes(b"%PDF-1.4\n")

            with self.assertRaisesRegex(ValueError, "Unexpected request path"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_load_request_rejects_archive_subdir_as_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, _ = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": [],
                    "mode": "skim",
                },
            )

            with self.assertRaisesRegex(ValueError, "Unexpected request path"):
                self.mod.load_request(str(request_path), root_dir=str(root / "archive"))

    def test_load_request_rejects_nested_archive_request_path_under_explicit_root_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            nested_root = root / "tmp"
            request_path, _ = self._write_request(
                nested_root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": [],
                    "mode": "skim",
                },
            )
            archive_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            archive_pdf.parent.mkdir(parents=True, exist_ok=True)
            archive_pdf.write_bytes(b"%PDF-1.4\n")

            with self.assertRaisesRegex(ValueError, "Unexpected request path"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_load_request_rejects_invalid_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, _ = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 3,
                    "selected_tags": [],
                    "mode": "weird",
                },
            )

            with self.assertRaisesRegex(ValueError, "Unsupported mode"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_load_request_rejects_source_path_escape(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, _ = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/../other/seed-paper.pdf",
                    "related_count": 3,
                    "selected_tags": [],
                    "mode": "skim",
                },
            )

            with self.assertRaisesRegex(ValueError, "Unexpected source_path"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_load_request_rejects_missing_seed_pdf(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 3,
                    "selected_tags": [],
                    "mode": "skim",
                },
            )
            pdf_path.unlink()

            with self.assertRaisesRegex(ValueError, "Missing seed PDF"):
                self.mod.load_request(str(request_path), root_dir=str(root))

    def test_select_related_outputs_reuses_same_top_n_for_both_mode(self):
        ranked = [
            {"id": "p1", "title": "Paper 1"},
            {"id": "p2", "title": "Paper 2"},
            {"id": "p3", "title": "Paper 3"},
        ]

        result = self.mod.select_related_outputs(ranked, mode="both", related_count=2)

        self.assertEqual([item["id"] for item in result["deep_dive"]], ["p1", "p2"])
        self.assertEqual([item["id"] for item in result["quick_skim"]], ["p1", "p2"])

    def test_render_seed_workspace_writes_seed_and_related_docs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["RL", "Security"],
                "mode": "both",
                "related_count": 2,
                "notes": "",
            }
            selection = {
                "deep_dive": [
                    {
                        "id": "p1",
                        "title": "Related One",
                        "abstract": "first abstract",
                        "link": "https://example.com/p1.pdf",
                        "llm_tags": ["query:RL"],
                        "llm_score": 9.5,
                    }
                ],
                "quick_skim": [
                    {
                        "id": "p1",
                        "title": "Related One",
                        "abstract": "first abstract",
                        "link": "https://example.com/p1.pdf",
                        "llm_tags": ["query:RL"],
                        "llm_score": 9.5,
                    },
                    {
                        "id": "p2",
                        "title": "Related Two",
                        "abstract": "second abstract",
                        "link": "",
                        "llm_tags": ["query:Security"],
                        "llm_score": 8.4,
                    },
                ],
            }

            written = self.mod.render_seed_workspace(
                request,
                seed_text="seed paper full text",
                selection=selection,
                docs_dir=str(docs_dir),
                generate_docs_module=_StubGenerateDocs,
            )

            workspace = docs_dir / "seed-papers" / "demo-request"
            self.assertTrue((workspace / "index.md").exists())
            self.assertTrue((workspace / "seed-paper.md").exists())
            self.assertTrue((workspace / "seed-paper.txt").exists())
            self.assertEqual(Path(written["workspace_dir"]).resolve(), workspace.resolve())
            seed_md = (workspace / "seed-paper.md").read_text(encoding="utf-8")
            self.assertIn("Seed Paper", seed_md)
            self.assertIn("archive/seed-papers/demo-request/seed-paper.pdf", seed_md)
            self.assertNotIn(str(seed_pdf), seed_md)
            self.assertIn("## 速览", seed_md)
            self.assertIn("**Research Question**：", seed_md)
            self.assertIn("**Reading Guide**：", seed_md)
            self.assertIn("## 精读", seed_md)
            self.assertIn("### 方法拆解", seed_md)
            self.assertEqual(_StubGenerateDocs.glance_calls[0]["abstract"], "seed paper full text")
            self.assertEqual(_StubGenerateDocs.glance_calls[0]["paper_text"], "seed paper full text")
            related_files = sorted((workspace / "related").glob("*.md"))
            self.assertEqual(len(related_files), 2)
            related_one_md = (workspace / "related" / "p1.md").read_text(encoding="utf-8")
            self.assertIn("## 速览", related_one_md)
            self.assertIn("**Research Question**：", related_one_md)
            self.assertIn("## 精读", related_one_md)
            self.assertEqual(_StubGenerateDocs.glance_calls[1]["abstract"], "first abstract")
            self.assertEqual(_StubGenerateDocs.glance_calls[1]["paper_text"], "first abstract")
            related_two_md = (workspace / "related" / "p2.md").read_text(encoding="utf-8")
            self.assertIn("## 速览", related_two_md)
            self.assertIn("**Reading Guide**：", related_two_md)
            self.assertNotIn("## 精读", related_two_md)
            index_text = (workspace / "index.md").read_text(encoding="utf-8")
            self.assertIn("seed-paper.md", index_text)
            self.assertIn("related/", index_text)

    def test_render_seed_workspace_sanitizes_related_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["RL"],
                "mode": "both",
                "related_count": 1,
                "notes": "",
            }
            selection = {
                "deep_dive": [
                    {
                        "id": "../nested/p1",
                        "title": "Dangerous Related",
                        "abstract": "first abstract",
                        "link": "",
                        "llm_tags": ["query:RL"],
                    }
                ],
                "quick_skim": [],
            }

            self.mod.render_seed_workspace(
                request,
                seed_text="seed paper full text",
                selection=selection,
                docs_dir=str(docs_dir),
                generate_docs_module=_StubGenerateDocs,
            )

            workspace = docs_dir / "seed-papers" / "demo-request"
            related_files = sorted((workspace / "related").glob("*.md"))
            self.assertEqual(len(related_files), 1)
            self.assertEqual(related_files[0].parent, workspace / "related")
            self.assertNotIn("..", related_files[0].name)
            self.assertNotIn("/", related_files[0].name)

    def test_render_seed_workspace_rejects_invalid_request_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")

            request = {
                "request_id": "../demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["RL"],
                "mode": "both",
                "related_count": 1,
                "notes": "",
            }

            with self.assertRaisesRegex(ValueError, "Unexpected request_id"):
                self.mod.render_seed_workspace(
                    request,
                    seed_text="seed paper full text",
                    selection={"deep_dive": [], "quick_skim": []},
                    docs_dir=str(docs_dir),
                    generate_docs_module=_StubGenerateDocs,
                )

    def test_update_seed_navigation_inserts_latest_request_links(self):
        with tempfile.TemporaryDirectory() as tmp:
            docs_dir = Path(tmp) / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            (docs_dir / "README.md").write_text("# Home\n", encoding="utf-8")
            (docs_dir / "_sidebar.md").write_text("* Home\n* Daily Papers\n", encoding="utf-8")

            self.mod.update_seed_navigation(
                docs_dir=str(docs_dir),
                request_id="demo-request",
                title="Seed Paper",
            )

            readme = (docs_dir / "README.md").read_text(encoding="utf-8")
            sidebar = (docs_dir / "_sidebar.md").read_text(encoding="utf-8")
            self.assertIn("<!--dpr-seed-papers:start-->", readme)
            self.assertIn("/seed-papers/demo-request/index", readme)
            self.assertIn("<!--dpr-seed-papers:start-->", sidebar)
            self.assertIn("#/seed-papers/demo-request/index", sidebar)

    def test_update_seed_navigation_rejects_invalid_request_id(self):
        with tempfile.TemporaryDirectory() as tmp:
            docs_dir = Path(tmp) / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)

            with self.assertRaisesRegex(ValueError, "Unexpected request_id"):
                self.mod.update_seed_navigation(
                    docs_dir=str(docs_dir),
                    request_id="../demo-request",
                    title="Seed Paper",
                )

    def test_retrieve_related_papers_disables_rpc_filter_sources_for_single_source_backends(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            request_dir = root / "archive" / "seed-papers" / "demo-request"
            request_dir.mkdir(parents=True, exist_ok=True)
            seed_pdf = request_dir / "seed-paper.pdf"
            seed_pdf.write_bytes(b"%PDF-1.4\n")
            (root / "config.yaml").write_text("subscriptions: {}\n", encoding="utf-8")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["LLM"],
                "notes": "focus on methods",
                "related_count": 1,
                "mode": "both",
            }

            bm25_calls = []
            embedding_calls = []

            class _StubSourceConfig:
                @staticmethod
                def load_config_with_source_migration(path, write_back=False):
                    return {"subscriptions": {}}

                @staticmethod
                def get_source_backend(config, source_key):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "use_vector_rpc": True,
                        "vector_rpc_exact": f"match_{source_key}_papers_exact",
                    }

            class _StubRouter:
                @staticmethod
                def group_queries_by_source(queries):
                    return {"arxiv": list(queries)}

                @staticmethod
                def merge_pipeline_results(results):
                    merged_queries = []
                    merged_papers = {}
                    for result in results:
                        merged_queries.extend(result.get("queries") or [])
                        merged_papers.update(result.get("papers") or {})
                    return {
                        "queries": merged_queries,
                        "papers": merged_papers,
                        "total_hits": len(merged_papers),
                        "non_empty_queries": sum(1 for item in merged_queries if item.get("sim_scores")),
                    }

            class _StubBM25:
                @staticmethod
                def rank_papers_for_queries_via_supabase(queries, **kwargs):
                    bm25_calls.append(kwargs)
                    return {
                        "queries": [
                            {
                                "query_text": queries[0]["query_text"],
                                "sim_scores": {"paper-1": {"score": 0.7, "rank": 1}},
                            }
                        ],
                        "papers": {
                            "paper-1": {
                                "id": "paper-1",
                                "title": "Paper One",
                                "abstract": "first abstract",
                            }
                        },
                        "total_hits": 1,
                        "non_empty_queries": 1,
                    }

            class _StubEmbedding:
                @staticmethod
                def rank_papers_for_queries_via_supabase(model, queries, **kwargs):
                    embedding_calls.append({"model": model, **kwargs})
                    return {
                        "queries": [
                            {
                                "query_text": queries[0]["query_text"],
                                "sim_scores": {"paper-2": {"score": 0.8, "rank": 1}},
                            }
                        ],
                        "papers": {
                            "paper-2": {
                                "id": "paper-2",
                                "title": "Paper Two",
                                "abstract": "second abstract",
                            }
                        },
                        "total_hits": 1,
                        "non_empty_queries": 1,
                    }

            class _StubFilter:
                class EmbeddingCoarseFilter:
                    def __init__(self, model_name, top_k, device):
                        self.model = f"stub::{model_name}::{top_k}::{device}"

            original_loader = self.mod._load_retrieval_helpers
            self.mod._load_retrieval_helpers = lambda: {
                "source_config": _StubSourceConfig,
                "router": _StubRouter,
                "bm25": _StubBM25,
                "embedding": _StubEmbedding,
                "filter": _StubFilter,
            }
            try:
                result = self.mod.retrieve_related_papers(request, "seed paper body text")
            finally:
                self.mod._load_retrieval_helpers = original_loader

            self.assertEqual(len(bm25_calls), 1)
            self.assertEqual(bm25_calls[0]["query_filter_sources"], False)
            self.assertEqual(len(embedding_calls), 1)
            self.assertEqual(embedding_calls[0]["query_filter_sources"], False)
            self.assertIn("paper-1", result["papers"])
            self.assertIn("paper-2", result["papers"])

    def test_retrieve_related_papers_falls_back_to_multi_source_rpcs_when_source_rpc_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")
            (root / "config.yaml").write_text("subscriptions: {}\n", encoding="utf-8")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["LLM"],
                "notes": "focus on methods",
                "related_count": 1,
                "mode": "both",
            }

            bm25_calls = []
            embedding_calls = []

            class _StubSourceConfig:
                @staticmethod
                def load_config_with_source_migration(path, write_back=False):
                    return {"subscriptions": {}}

                @staticmethod
                def get_source_backend(config, source_key):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "use_vector_rpc": True,
                        "bm25_rpc": f"match_{source_key}_papers_bm25",
                        "vector_rpc_exact": f"match_{source_key}_papers_exact",
                    }

            class _StubRouter:
                @staticmethod
                def group_queries_by_source(queries):
                    return {"iclr": list(queries)}

                @staticmethod
                def merge_pipeline_results(results):
                    merged_queries = []
                    merged_papers = {}
                    for result in results:
                        merged_queries.extend(result.get("queries") or [])
                        merged_papers.update(result.get("papers") or {})
                    return {
                        "queries": merged_queries,
                        "papers": merged_papers,
                        "total_hits": len(merged_papers),
                        "non_empty_queries": sum(1 for item in merged_queries if item.get("sim_scores")),
                    }

            class _StubBM25:
                @staticmethod
                def resolve_multi_source_bm25_backend(config, queries):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "bm25_rpc": "match_multi_source_papers_bm25",
                    }

                @staticmethod
                def rank_papers_for_queries_via_supabase(queries, **kwargs):
                    bm25_calls.append(kwargs)
                    if not kwargs.get("query_filter_sources"):
                        raise RuntimeError("PGRST202: Could not find the function public.match_iclr_papers_bm25 in the schema cache")
                    return {
                        "queries": [
                            {
                                "query_text": queries[0]["query_text"],
                                "sim_scores": {"paper-1": {"score": 0.7, "rank": 1}},
                            }
                        ],
                        "papers": {
                            "paper-1": {
                                "id": "paper-1",
                                "title": "Paper One",
                                "abstract": "first abstract",
                            }
                        },
                        "total_hits": 1,
                        "non_empty_queries": 1,
                    }

            class _StubEmbedding:
                @staticmethod
                def resolve_multi_source_vector_backend(config, queries):
                    return {
                        "enabled": True,
                        "use_vector_rpc": True,
                        "vector_rpc_exact": "match_multi_source_papers_exact",
                    }

                @staticmethod
                def rank_papers_for_queries_via_supabase(model, queries, **kwargs):
                    embedding_calls.append({"model": model, **kwargs})
                    if not kwargs.get("query_filter_sources"):
                        raise RuntimeError("PGRST202: Could not find the function public.match_iclr_papers_exact in the schema cache")
                    return {
                        "queries": [
                            {
                                "query_text": queries[0]["query_text"],
                                "sim_scores": {"paper-2": {"score": 0.8, "rank": 1}},
                            }
                        ],
                        "papers": {
                            "paper-2": {
                                "id": "paper-2",
                                "title": "Paper Two",
                                "abstract": "second abstract",
                            }
                        },
                        "total_hits": 1,
                        "non_empty_queries": 1,
                    }

            class _StubFilter:
                class EmbeddingCoarseFilter:
                    def __init__(self, model_name, top_k, device):
                        self.model = f"stub::{model_name}::{top_k}::{device}"

            original_loader = self.mod._load_retrieval_helpers
            self.mod._load_retrieval_helpers = lambda: {
                "source_config": _StubSourceConfig,
                "router": _StubRouter,
                "bm25": _StubBM25,
                "embedding": _StubEmbedding,
                "filter": _StubFilter,
            }
            try:
                with patch.dict("os.environ", {"DPR_ENABLE_MULTI_SOURCE_RPC": "true"}, clear=False):
                    result = self.mod.retrieve_related_papers(request, "seed paper body text")
            finally:
                self.mod._load_retrieval_helpers = original_loader

            self.assertEqual([call["query_filter_sources"] for call in bm25_calls], [False, True])
            self.assertEqual(bm25_calls[1]["supabase_conf"]["bm25_rpc"], "match_multi_source_papers_bm25")
            self.assertEqual([call["query_filter_sources"] for call in embedding_calls], [False, True])
            self.assertEqual(embedding_calls[1]["supabase_conf"]["vector_rpc_exact"], "match_multi_source_papers_exact")
            self.assertIn("paper-1", result["papers"])
            self.assertIn("paper-2", result["papers"])

    def test_retrieve_related_papers_reraises_missing_function_errors_when_multi_source_rpc_disabled(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")
            (root / "config.yaml").write_text("subscriptions: {}\n", encoding="utf-8")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["LLM"],
                "notes": "focus on methods",
                "related_count": 1,
                "mode": "both",
            }

            class _StubSourceConfig:
                @staticmethod
                def load_config_with_source_migration(path, write_back=False):
                    return {"subscriptions": {}}

                @staticmethod
                def get_source_backend(config, source_key):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "use_vector_rpc": False,
                        "bm25_rpc": f"match_{source_key}_papers_bm25",
                    }

            class _StubRouter:
                @staticmethod
                def group_queries_by_source(queries):
                    return {"iclr": list(queries)}

                @staticmethod
                def merge_pipeline_results(results):
                    return {"queries": [], "papers": {}, "total_hits": 0, "non_empty_queries": 0}

            class _StubBM25:
                @staticmethod
                def resolve_multi_source_bm25_backend(config, queries):
                    raise AssertionError("multi-source resolver should not run when feature flag is disabled")

                @staticmethod
                def rank_papers_for_queries_via_supabase(queries, **kwargs):
                    raise RuntimeError("PGRST202: Could not find the function public.match_iclr_papers_bm25 in the schema cache")

            class _StubEmbedding:
                @staticmethod
                def rank_papers_for_queries_via_supabase(model, queries, **kwargs):
                    raise AssertionError("embedding should not run")

            class _StubFilter:
                class EmbeddingCoarseFilter:
                    def __init__(self, model_name, top_k, device):
                        self.model = f"stub::{model_name}::{top_k}::{device}"

            original_loader = self.mod._load_retrieval_helpers
            self.mod._load_retrieval_helpers = lambda: {
                "source_config": _StubSourceConfig,
                "router": _StubRouter,
                "bm25": _StubBM25,
                "embedding": _StubEmbedding,
                "filter": _StubFilter,
            }
            try:
                with patch.dict("os.environ", {}, clear=True):
                    with self.assertRaisesRegex(RuntimeError, "PGRST202"):
                        self.mod.retrieve_related_papers(request, "seed paper body text")
            finally:
                self.mod._load_retrieval_helpers = original_loader

    def test_retrieve_related_papers_reraises_missing_function_errors_when_multi_source_backend_unavailable(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")
            (root / "config.yaml").write_text("subscriptions: {}\n", encoding="utf-8")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["LLM"],
                "notes": "focus on methods",
                "related_count": 1,
                "mode": "both",
            }

            class _StubSourceConfig:
                @staticmethod
                def load_config_with_source_migration(path, write_back=False):
                    return {"subscriptions": {}}

                @staticmethod
                def get_source_backend(config, source_key):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "use_vector_rpc": False,
                        "bm25_rpc": f"match_{source_key}_papers_bm25",
                    }

            class _StubRouter:
                @staticmethod
                def group_queries_by_source(queries):
                    return {"iclr": list(queries)}

                @staticmethod
                def merge_pipeline_results(results):
                    return {"queries": [], "papers": {}, "total_hits": 0, "non_empty_queries": 0}

            class _StubBM25:
                @staticmethod
                def resolve_multi_source_bm25_backend(config, queries):
                    return None

                @staticmethod
                def rank_papers_for_queries_via_supabase(queries, **kwargs):
                    raise RuntimeError("PGRST202: Could not find the function public.match_iclr_papers_bm25 in the schema cache")

            class _StubEmbedding:
                @staticmethod
                def rank_papers_for_queries_via_supabase(model, queries, **kwargs):
                    raise AssertionError("embedding should not run")

            class _StubFilter:
                class EmbeddingCoarseFilter:
                    def __init__(self, model_name, top_k, device):
                        self.model = f"stub::{model_name}::{top_k}::{device}"

            original_loader = self.mod._load_retrieval_helpers
            self.mod._load_retrieval_helpers = lambda: {
                "source_config": _StubSourceConfig,
                "router": _StubRouter,
                "bm25": _StubBM25,
                "embedding": _StubEmbedding,
                "filter": _StubFilter,
            }
            try:
                with patch.dict("os.environ", {"DPR_ENABLE_MULTI_SOURCE_RPC": "true"}, clear=False):
                    with self.assertRaisesRegex(RuntimeError, "PGRST202"):
                        self.mod.retrieve_related_papers(request, "seed paper body text")
            finally:
                self.mod._load_retrieval_helpers = original_loader

    def test_retrieve_related_papers_reraises_non_schema_errors(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")
            (root / "config.yaml").write_text("subscriptions: {}\n", encoding="utf-8")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["LLM"],
                "notes": "focus on methods",
                "related_count": 1,
                "mode": "both",
            }

            class _StubSourceConfig:
                @staticmethod
                def load_config_with_source_migration(path, write_back=False):
                    return {"subscriptions": {}}

                @staticmethod
                def get_source_backend(config, source_key):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "use_vector_rpc": False,
                        "bm25_rpc": f"match_{source_key}_papers_bm25",
                    }

            class _StubRouter:
                @staticmethod
                def group_queries_by_source(queries):
                    return {"iclr": list(queries)}

                @staticmethod
                def merge_pipeline_results(results):
                    return {"queries": [], "papers": {}, "total_hits": 0, "non_empty_queries": 0}

            class _StubBM25:
                @staticmethod
                def resolve_multi_source_bm25_backend(config, queries):
                    return {
                        "enabled": True,
                        "use_bm25_rpc": True,
                        "bm25_rpc": "match_multi_source_papers_bm25",
                    }

                @staticmethod
                def rank_papers_for_queries_via_supabase(queries, **kwargs):
                    raise RuntimeError("network down")

            class _StubEmbedding:
                @staticmethod
                def rank_papers_for_queries_via_supabase(model, queries, **kwargs):
                    raise AssertionError("embedding should not run")

            class _StubFilter:
                class EmbeddingCoarseFilter:
                    def __init__(self, model_name, top_k, device):
                        self.model = f"stub::{model_name}::{top_k}::{device}"

            original_loader = self.mod._load_retrieval_helpers
            self.mod._load_retrieval_helpers = lambda: {
                "source_config": _StubSourceConfig,
                "router": _StubRouter,
                "bm25": _StubBM25,
                "embedding": _StubEmbedding,
                "filter": _StubFilter,
            }
            try:
                with patch.dict("os.environ", {"DPR_ENABLE_MULTI_SOURCE_RPC": "true"}, clear=False):
                    with self.assertRaisesRegex(RuntimeError, "network down"):
                        self.mod.retrieve_related_papers(request, "seed paper body text")
            finally:
                self.mod._load_retrieval_helpers = original_loader

    def test_rank_related_papers_excludes_seed_and_reranks_candidates(self):
        request = {
            "request_id": "demo-request",
            "file_name": "Seed Paper.pdf",
            "selected_tags": ["RL", "Security"],
            "notes": "focus on methods",
            "related_count": 2,
            "mode": "both",
        }
        recall_payload = {
            "queries": [
                {
                    "query_text": "seed paper RL security focus on methods",
                    "sim_scores": {
                        "seed-paper": {"score": 0.99, "rank": 1},
                        "paper-b": {"score": 0.92, "rank": 2},
                        "paper-a": {"score": 0.91, "rank": 3},
                    },
                },
                {
                    "query_text": "reinforcement learning methods",
                    "sim_scores": {
                        "paper-a": {"score": 0.97, "rank": 1},
                        "paper-c": {"score": 0.88, "rank": 2},
                    },
                },
            ],
            "papers": {
                "seed-paper": {
                    "id": "seed-paper",
                    "title": "Seed Paper",
                    "abstract": "seed abstract",
                    "source": "arxiv",
                    "link": "https://example.com/seed.pdf",
                },
                "paper-a": {
                    "id": "paper-a",
                    "title": "Paper A",
                    "abstract": "paper a abstract",
                    "source": "arxiv",
                    "link": "https://example.com/a.pdf",
                },
                "paper-b": {
                    "id": "paper-b",
                    "title": "Paper B",
                    "abstract": "paper b abstract",
                    "source": "arxiv",
                    "link": "https://example.com/b.pdf",
                },
                "paper-c": {
                    "id": "paper-c",
                    "title": "Paper C",
                    "abstract": "paper c abstract",
                    "source": "arxiv",
                    "link": "https://example.com/c.pdf",
                },
            },
        }
        reranker = _StubReranker(
            [
                {"index": 1, "relevance_score": 0.93},
                {"index": 0, "relevance_score": 0.87},
                {"index": 2, "relevance_score": 0.41},
            ]
        )

        ranked = self.mod.rank_related_papers(
            request,
            seed_text="seed paper body text",
            retrieve_related=lambda req, seed_text: recall_payload,
            reranker=reranker,
            seed_identity={"seed-paper", "Seed Paper"},
        )

        self.assertEqual([item["id"] for item in ranked], ["paper-a", "paper-b", "paper-c"])
        self.assertEqual([item["llm_score"] for item in ranked], [0.93, 0.87, 0.41])
        self.assertEqual(len(reranker.calls), 1)
        self.assertEqual(
            reranker.calls[0]["query"],
            self.mod._build_query_summary(request, "seed paper body text"),
        )
        self.assertEqual(reranker.calls[0]["top_n"], 3)
        self.assertEqual(len(reranker.calls[0]["documents"]), 3)
        self.assertTrue(all("Seed Paper" not in doc for doc in reranker.calls[0]["documents"]))

    def test_rank_related_papers_rejects_empty_retrieval_candidates(self):
        reranker = _StubReranker([])

        with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "retrieval returned no query lanes"):
            self.mod.rank_related_papers(
                {
                    "request_id": "demo-request",
                    "file_name": "Seed Paper.pdf",
                    "selected_tags": [],
                    "notes": "",
                    "related_count": 2,
                    "mode": "skim",
                },
                seed_text="seed paper body text",
                retrieve_related=lambda req, seed_text: {"queries": [], "papers": {}},
                reranker=reranker,
                seed_identity={"seed-paper"},
            )

        self.assertEqual(reranker.calls, [])

    def test_rank_related_papers_rejects_rerank_without_scored_results(self):
        reranker = _StubReranker([])

        with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "rerank returned no scored results"):
            self.mod.rank_related_papers(
                {
                    "request_id": "demo-request",
                    "file_name": "Seed Paper.pdf",
                    "selected_tags": ["RL"],
                    "notes": "",
                    "related_count": 2,
                    "mode": "skim",
                },
                seed_text="seed paper body text",
                retrieve_related=lambda req, seed_text: {
                    "queries": [
                        {
                            "query_text": "seed paper related query",
                            "sim_scores": {
                                "paper-1": {"score": 0.8, "rank": 1},
                            },
                        }
                    ],
                    "papers": {
                        "paper-1": {
                            "id": "paper-1",
                            "title": "Related One",
                            "abstract": "first abstract",
                            "source": "arxiv",
                            "link": "https://example.com/p1.pdf",
                        },
                    },
                },
                reranker=reranker,
                seed_identity={"seed-paper"},
            )

        self.assertEqual(len(reranker.calls), 1)

    def test_rank_related_papers_rejects_empty_recalled_papers(self):
        reranker = _StubReranker([])

        with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "retrieval returned no recalled papers"):
            self.mod.rank_related_papers(
                {
                    "request_id": "demo-request",
                    "file_name": "Seed Paper.pdf",
                    "selected_tags": ["RL"],
                    "notes": "",
                    "related_count": 2,
                    "mode": "skim",
                },
                seed_text="seed paper body text",
                retrieve_related=lambda req, seed_text: {
                    "queries": [
                        {
                            "query_text": "seed paper related query",
                            "sim_scores": {},
                        }
                    ],
                    "papers": {},
                },
                reranker=reranker,
                seed_identity={"seed-paper"},
            )

        self.assertEqual(reranker.calls, [])

    def test_rank_related_papers_rejects_missing_candidate_ids(self):
        reranker = _StubReranker([])

        with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "retrieval produced no candidate ids"):
            self.mod.rank_related_papers(
                {
                    "request_id": "demo-request",
                    "file_name": "Seed Paper.pdf",
                    "selected_tags": ["RL"],
                    "notes": "",
                    "related_count": 2,
                    "mode": "skim",
                },
                seed_text="seed paper body text",
                retrieve_related=lambda req, seed_text: {
                    "queries": [
                        {
                            "query_text": "seed paper related query",
                            "sim_scores": {},
                            "top_ids": [],
                        }
                    ],
                    "papers": {
                        "paper-1": {
                            "id": "paper-1",
                            "title": "Related One",
                            "abstract": "first abstract",
                            "source": "arxiv",
                            "link": "https://example.com/p1.pdf",
                        },
                    },
                },
                reranker=reranker,
                seed_identity={"seed-paper"},
            )

        self.assertEqual(reranker.calls, [])

    def test_rank_related_papers_rejects_seed_only_candidates(self):
        reranker = _StubReranker([])

        with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "retrieval only returned seed-paper matches"):
            self.mod.rank_related_papers(
                {
                    "request_id": "demo-request",
                    "file_name": "Seed Paper.pdf",
                    "selected_tags": ["RL"],
                    "notes": "",
                    "related_count": 2,
                    "mode": "skim",
                },
                seed_text="seed paper body text",
                retrieve_related=lambda req, seed_text: {
                    "queries": [
                        {
                            "query_text": "seed paper related query",
                            "sim_scores": {
                                "seed-paper": {"score": 0.8, "rank": 1},
                            },
                        }
                    ],
                    "papers": {
                        "seed-paper": {
                            "id": "seed-paper",
                            "title": "Seed Paper",
                            "abstract": "seed abstract",
                            "source": "arxiv",
                            "link": "https://example.com/seed.pdf",
                        },
                    },
                },
                reranker=reranker,
                seed_identity={"seed-paper", "Seed Paper"},
            )

        self.assertEqual(reranker.calls, [])

    def test_rank_related_papers_excludes_seed_without_manual_identity_override(self):
        request = {
            "request_id": "demo-request",
            "file_name": "Seed Paper.pdf",
            "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
            "seed_pdf_path": "/tmp/demo-request/seed-paper.pdf",
            "selected_tags": ["RL"],
            "notes": "",
            "related_count": 99,
            "mode": "skim",
        }
        recall_payload = {
            "queries": [
                {
                    "query_text": "seed paper related query",
                    "sim_scores": {
                        "seed-copy": {"score": 0.99, "rank": 1},
                        "paper-b": {"score": 0.91, "rank": 2},
                        "paper-c": {"score": 0.88, "rank": 3},
                    },
                }
            ],
            "papers": {
                "seed-copy": {
                    "id": "seed-copy",
                    "title": "Seed Paper",
                    "abstract": "different abstract but same paper",
                    "source": "arxiv",
                    "link": "https://example.com/files/seed-paper.pdf",
                },
                "paper-b": {
                    "id": "paper-b",
                    "title": "Paper B",
                    "abstract": "paper b abstract",
                    "source": "arxiv",
                    "link": "https://example.com/b.pdf",
                },
                "paper-c": {
                    "id": "paper-c",
                    "title": "Paper C",
                    "abstract": "paper c abstract",
                    "source": "arxiv",
                    "link": "https://example.com/c.pdf",
                },
            },
        }
        reranker = _StubReranker(
            [
                {"index": 0, "relevance_score": 0.95},
                {"index": 1, "relevance_score": 0.83},
            ]
        )

        ranked = self.mod.rank_related_papers(
            request,
            seed_text="seed paper body text",
            retrieve_related=lambda req, seed_text: recall_payload,
            reranker=reranker,
        )

        self.assertEqual([item["id"] for item in ranked], ["paper-b", "paper-c"])
        self.assertEqual(
            reranker.calls[0]["query"],
            self.mod._build_query_summary(request, "seed paper body text"),
        )
        self.assertEqual(reranker.calls[0]["top_n"], 2)
        self.assertEqual(len(reranker.calls[0]["documents"]), 2)
        self.assertTrue(all("Seed Paper" not in doc for doc in reranker.calls[0]["documents"]))
        self.assertEqual(self.mod._normalize_related_count(99), 20)

    def test_build_seed_queries_limits_tags_notes_and_query_size(self):
        request = {
            "request_id": "demo-request",
            "file_name": "Seed Paper.pdf",
            "selected_tags": [f"tag-{idx}-" + ("x" * 80) for idx in range(20)],
            "notes": "n" * 1000,
        }

        normalized_tags = self.mod._normalize_tags(request["selected_tags"])
        normalized_notes = self.mod._normalize_notes(request["notes"])
        normalized_request = {
            **request,
            "selected_tags": normalized_tags,
            "notes": normalized_notes,
        }
        seed_text = ("transformer diffusion graph learning " * 200)
        queries = self.mod._build_seed_queries(normalized_request, seed_text=seed_text)

        self.assertLessEqual(len(normalized_tags), 8)
        self.assertTrue(all(len(tag) <= 48 for tag in normalized_tags))
        self.assertLessEqual(len(normalized_notes), 400)
        self.assertTrue(queries)
        self.assertTrue(all(len(query["query_text"]) <= 800 for query in queries))
        self.assertEqual(queries[0]["query_text"], self.mod._build_query_summary(normalized_request, seed_text))

    def test_rank_related_papers_uses_summary_instead_of_first_query_order(self):
        request = {
            "request_id": "demo-request",
            "file_name": "Seed Paper.pdf",
            "selected_tags": ["RL", "Security"],
            "notes": "focus on methods",
            "related_count": 2,
            "mode": "both",
        }
        recall_payload = {
            "queries": [
                {
                    "query_text": "keyword only fallback text",
                    "sim_scores": {
                        "paper-b": {"score": 0.92, "rank": 1},
                        "paper-a": {"score": 0.91, "rank": 2},
                    },
                },
                {
                    "query_text": "semantic intent text that should not be order-dependent",
                    "sim_scores": {
                        "paper-a": {"score": 0.97, "rank": 1},
                        "paper-c": {"score": 0.88, "rank": 2},
                    },
                },
            ],
            "papers": {
                "paper-a": {
                    "id": "paper-a",
                    "title": "Paper A",
                    "abstract": "paper a abstract",
                    "source": "arxiv",
                    "link": "https://example.com/a.pdf",
                },
                "paper-b": {
                    "id": "paper-b",
                    "title": "Paper B",
                    "abstract": "paper b abstract",
                    "source": "arxiv",
                    "link": "https://example.com/b.pdf",
                },
                "paper-c": {
                    "id": "paper-c",
                    "title": "Paper C",
                    "abstract": "paper c abstract",
                    "source": "arxiv",
                    "link": "https://example.com/c.pdf",
                },
            },
        }
        reranker = _StubReranker([
            {"index": 0, "relevance_score": 0.95},
            {"index": 1, "relevance_score": 0.84},
            {"index": 2, "relevance_score": 0.63},
        ])

        self.mod.rank_related_papers(
            request,
            seed_text="seed paper body text",
            retrieve_related=lambda req, seed_text: recall_payload,
            reranker=reranker,
            seed_identity={"seed-paper", "Seed Paper"},
        )

        self.assertEqual(
            reranker.calls[0]["query"],
            self.mod._build_query_summary(request, "seed paper body text"),
        )
        self.assertNotEqual(reranker.calls[0]["query"], recall_payload["queries"][0]["query_text"])

    def test_render_seed_workspace_uses_local_related_abstract_for_deep_mode(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            seed_pdf = root / "archive" / "seed-papers" / "demo-request" / "seed-paper.pdf"
            seed_pdf.parent.mkdir(parents=True, exist_ok=True)
            seed_pdf.write_bytes(b"%PDF-1.4\n")

            request = {
                "request_id": "demo-request",
                "file_name": "Seed Paper.pdf",
                "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                "seed_pdf_path": str(seed_pdf),
                "selected_tags": ["RL"],
                "mode": "deep",
                "related_count": 1,
                "notes": "",
            }
            selection = {
                "deep_dive": [
                    {
                        "id": "p1",
                        "title": "Related One",
                        "abstract": "deep abstract only",
                        "link": "https://malicious.example/internal.pdf",
                        "llm_tags": ["query:RL"],
                    }
                ],
                "quick_skim": [],
            }

            self.mod.render_seed_workspace(
                request,
                seed_text="seed paper full text",
                selection=selection,
                docs_dir=str(docs_dir),
                generate_docs_module=_StubGenerateDocs,
            )

            workspace = docs_dir / "seed-papers" / "demo-request"
            related_txt = workspace / "related" / "p1.txt"
            self.assertEqual(related_txt.read_text(encoding="utf-8"), "deep abstract only")
            self.assertEqual(_StubGenerateDocs.ensure_text_content_calls, [])

    def test_process_request_rejects_empty_seed_text(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": ["RL"],
                    "mode": "skim",
                    "notes": "",
                },
            )
            pdf_path.write_bytes(b"%PDF-1.4\nseed")

            with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "text extraction returned empty text"):
                self.mod.process_request(
                    str(request_path),
                    request_id="demo-request",
                    root_dir=str(root),
                    docs_dir=str(docs_dir),
                    generate_docs_module=_EmptySeedTextGenerateDocs,
                    ranked_related=[
                        {
                            "id": "paper-1",
                            "title": "Fixture Related One",
                            "abstract": "fixture abstract one",
                            "link": "https://arxiv.org/abs/1234.5678",
                        }
                    ],
                )

    def test_process_request_builds_workspace_navigation_and_related_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": ["RL"],
                    "mode": "skim",
                    "notes": "",
                },
            )
            pdf_path.write_bytes(b"%PDF-1.4\nseed")
            (docs_dir / "README.md").write_text("# Home\n", encoding="utf-8")
            (docs_dir / "_sidebar.md").write_text("* Home\n", encoding="utf-8")
            reranker = _StubReranker(
                [
                    {"index": 1, "relevance_score": 0.91},
                    {"index": 0, "relevance_score": 0.82},
                ]
            )

            result = self.mod.process_request(
                str(request_path),
                request_id="demo-request",
                root_dir=str(root),
                docs_dir=str(docs_dir),
                seed_mode="both",
                generate_docs_module=_StubGenerateDocs,
                retrieve_related=lambda req, seed_text: {
                    "queries": [
                        {
                            "query_text": "seed paper related query",
                            "sim_scores": {
                                "paper-1": {"score": 0.8, "rank": 1},
                                "paper-2": {"score": 0.7, "rank": 2},
                            },
                        }
                    ],
                    "papers": {
                        "paper-1": {
                            "id": "paper-1",
                            "title": "Related One",
                            "abstract": "first abstract",
                            "source": "arxiv",
                            "link": "https://example.com/p1.pdf",
                        },
                        "paper-2": {
                            "id": "paper-2",
                            "title": "Related Two",
                            "abstract": "second abstract",
                            "source": "arxiv",
                            "link": "https://example.com/p2.pdf",
                        },
                    },
                },
                reranker=reranker,
            )

            workspace = docs_dir / "seed-papers" / "demo-request"
            self.assertEqual(result["request"]["mode"], "both")
            self.assertEqual(Path(result["workspace_dir"]).resolve(), workspace.resolve())
            self.assertTrue((workspace / "index.md").exists())
            related_files = sorted((workspace / "related").glob("*.md"))
            self.assertEqual([path.name for path in related_files], ["paper-1.md", "paper-2.md"])
            self.assertIn("demo-request", (docs_dir / "README.md").read_text(encoding="utf-8"))
            self.assertIn("demo-request", (docs_dir / "_sidebar.md").read_text(encoding="utf-8"))
            self.assertEqual(len(reranker.calls), 1)
            self.assertEqual(reranker.calls[0]["top_n"], 2)
            self.assertEqual(result["related_page_paths"], ["related/paper-2.md", "related/paper-1.md"])

    def test_process_request_rejects_empty_ranked_related_fixture(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": ["RL"],
                    "mode": "both",
                    "notes": "",
                },
            )
            pdf_path.write_bytes(b"%PDF-1.4\nseed")

            with self.assertRaisesRegex(self.mod.SeedPaperProcessingError, "selection produced no related outputs"):
                self.mod.process_request(
                    str(request_path),
                    request_id="demo-request",
                    root_dir=str(root),
                    docs_dir=str(docs_dir),
                    generate_docs_module=_StubGenerateDocs,
                    ranked_related=[],
                )

    def test_main_exits_cleanly_on_request_validation_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            invalid_request_path = Path(tmp) / "request.json"
            invalid_request_path.write_text("{}", encoding="utf-8")
            original_argv = list(sys.argv)
            try:
                sys.argv = ["seed_paper_processor.py", "--request-path", str(invalid_request_path)]
                with self.assertRaisesRegex(SystemExit, "Unexpected request path"):
                    self.mod.main()
            finally:
                sys.argv = original_argv

    def test_process_request_accepts_ranked_related_fixture_bypass(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            docs_dir = root / "docs"
            docs_dir.mkdir(parents=True, exist_ok=True)
            request_path, pdf_path = self._write_request(
                root,
                {
                    "file_name": "Seed Paper.pdf",
                    "source_path": "archive/seed-papers/demo-request/seed-paper.pdf",
                    "related_count": 2,
                    "selected_tags": ["RL"],
                    "mode": "both",
                    "notes": "",
                },
            )
            pdf_path.write_bytes(b"%PDF-1.4\nseed")
            (docs_dir / "README.md").write_text("# Home\n", encoding="utf-8")
            (docs_dir / "_sidebar.md").write_text("* Home\n", encoding="utf-8")

            result = self.mod.process_request(
                str(request_path),
                request_id="demo-request",
                root_dir=str(root),
                docs_dir=str(docs_dir),
                generate_docs_module=_StubGenerateDocs,
                ranked_related=[
                    {
                        "id": "paper-9",
                        "title": "Fixture Related One",
                        "abstract": "fixture abstract one",
                        "link": "https://arxiv.org/abs/1234.5678",
                        "llm_tags": ["query:RL"],
                        "llm_score": 0.95,
                    },
                    {
                        "id": "paper-8",
                        "title": "Fixture Related Two",
                        "abstract": "fixture abstract two",
                        "link": "https://openreview.net/forum?id=test-paper",
                        "llm_tags": ["query:RL"],
                        "llm_score": 0.88,
                    },
                ],
            )

            workspace = docs_dir / "seed-papers" / "demo-request"
            related_files = sorted((workspace / "related").glob("*.md"))
            self.assertEqual([path.name for path in related_files], ["paper-8.md", "paper-9.md"])
            self.assertEqual(result["related_page_paths"], ["related/paper-9.md", "related/paper-8.md"])
            self.assertIn("Fixture Related One", (workspace / "index.md").read_text(encoding="utf-8"))

    def test_load_ranked_related_fixture_parses_list_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture_path = Path(tmp) / "ranked-related.json"
            fixture_path.write_text(
                json.dumps([
                    {"id": "paper-1", "title": "Fixture A", "link": "https://arxiv.org/abs/1111.1111"},
                    {"id": "paper-2", "title": "Fixture B", "llm_tags": ["query:test"]},
                ]),
                encoding="utf-8",
            )

            ranked = self.mod._load_ranked_related_fixture(str(fixture_path))

            self.assertEqual([item["id"] for item in ranked], ["paper-1", "paper-2"])
            self.assertEqual(ranked[0]["link"], "https://arxiv.org/abs/1111.1111")
            self.assertEqual(ranked[1]["llm_tags"], ["query:test"])

    def test_load_ranked_related_fixture_rejects_non_list_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture_path = Path(tmp) / "ranked-related.json"
            fixture_path.write_text(json.dumps({"id": "paper-1"}), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Expected ranked related fixture list"):
                self.mod._load_ranked_related_fixture(str(fixture_path))

    def test_load_ranked_related_fixture_rejects_missing_id_or_title(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture_path = Path(tmp) / "ranked-related.json"
            fixture_path.write_text(json.dumps([{"id": "paper-1"}]), encoding="utf-8")

            with self.assertRaisesRegex(ValueError, "Expected ranked related fixture item with id/title"):
                self.mod._load_ranked_related_fixture(str(fixture_path))


if __name__ == "__main__":
    unittest.main()
