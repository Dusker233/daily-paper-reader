import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class GenerateDocsMetaParseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._env_patch = patch.dict(
            "os.environ",
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
            },
            clear=True,
        )
        cls._env_patch.start()
        root = Path(__file__).resolve().parents[1]
        if "fitz" not in sys.modules:
            import types

            fitz_stub = types.ModuleType("fitz")
            fitz_stub.open = lambda *args, **kwargs: None
            sys.modules["fitz"] = fitz_stub
        if "llm" not in sys.modules:
            import types

            llm_stub = types.ModuleType("llm")

            class DummyLLMClient:
                def __init__(self, *args, **kwargs):
                    self.kwargs = {}

                def chat(self, *args, **kwargs):
                    return {"content": ""}

                def chat_structured(self, *args, **kwargs):
                    return {}

            class DummyClientFactory:
                @staticmethod
                def from_env(*args, **kwargs):
                    return DummyLLMClient()

            llm_stub.LLMClient = DummyLLMClient
            llm_stub.ClientFactory = DummyClientFactory
            sys.modules["llm"] = llm_stub

        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        if "paper_figures" not in sys.modules:
            import types

            paper_figures_stub = types.ModuleType("paper_figures")
            paper_figures_stub.ensure_paper_figures = lambda **kwargs: []
            sys.modules["paper_figures"] = paper_figures_stub

        src_path = src_dir / "6.generate_docs.py"
        spec = importlib.util.spec_from_file_location("gen6_mod", src_path)
        cls.mod = importlib.util.module_from_spec(spec)
        assert spec and spec.loader
        spec.loader.exec_module(cls.mod)

    @classmethod
    def tearDownClass(cls):
        if cls._env_patch is not None:
            cls._env_patch.stop()
            cls._env_patch = None

    def test_parse_meta_from_front_matter(self):
        md_path = Path("docs/201706/12/1706.03762v1-attention-is-all-you-need.md")
        item = self.mod._parse_generated_md_to_meta(str(md_path), "pid", "quick")
        self.assertEqual(item["title_en"], "Attention Is All You Need")
        self.assertTrue(item["authors"].startswith("Ashish Vaswani"))
        self.assertIn("query:transformer", item["tags"])
        self.assertEqual(item["date"], "20170612")
        self.assertIn("https://arxiv.org/pdf", item["pdf"])
        self.assertEqual(item["selection_source"], "fresh_fetch")

    def test_parse_fallback_to_legacy_meta_lines(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "paper.md"
            path.write_text(
                "\n".join(
                    [
                        "---",
                        "selection_source: fresh_fetch",
                        "title: Legacy title",
                        "---",
                        "**Authors**: Legacy A, Legacy B",
                        "**Date**: 20260301",
                        "**PDF**: https://example.com/paper.pdf",
                        "**TLDR**: legacy tldr text",
                        "",
                        "## Abstract",
                        "abstract body",
                    ]
                ),
                encoding="utf-8",
            )
            item = self.mod._parse_generated_md_to_meta(
                str(path),
                "legacy",
                "deep",
                "cache_hint",
            )
            self.assertEqual(item["authors"], "Legacy A, Legacy B")
            self.assertEqual(item["date"], "20260301")
            self.assertEqual(item["pdf"], "https://example.com/paper.pdf")
            self.assertEqual(item["tldr"], "legacy tldr text")
            self.assertEqual(item["selection_source"], "cache_hint")

    def test_parse_source_from_front_matter(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "paper.md"
            path.write_text(
                "\n".join(
                    [
                        "---",
                        "title: Test title",
                        "source: biorxiv",
                        "selection_source: fresh_fetch",
                        "---",
                        "## Abstract",
                        "abstract body",
                    ]
                ),
                encoding="utf-8",
            )
            item = self.mod._parse_generated_md_to_meta(str(path), "pid", "quick")
            self.assertEqual(item["source"], "biorxiv")
            self.assertEqual(item["selection_source"], "fresh_fetch")

    def test_extract_sidebar_tags_hides_composite_suffix(self):
        paper = {
            "llm_score": 8.0,
            "llm_tags": [
                "query:sr:composite",
                "query:sr",
                "keyword:equation-discovery",
            ],
        }
        tags = self.mod.extract_sidebar_tags(paper)
        self.assertEqual(tags[0], ("score", "8.0"))
        self.assertIn(("query", "sr"), tags)
        self.assertIn(("query", "equation-discovery"), tags)
        self.assertNotIn(("query", "sr:composite"), tags)
        self.assertEqual(tags.count(("query", "sr")), 1)

    def test_build_markdown_content_writes_figures_json_front_matter(self):
        paper = {
            "title": "Figure Test",
            "authors": ["Ada Lovelace"],
            "published": "2026-03-26T00:00:00+00:00",
            "link": "https://arxiv.org/pdf/1234.5678",
            "abstract": "abstract body",
            "source": "arxiv",
            "_figure_assets": [
                {
                    "url": "assets/figures/arxiv/1234.5678/fig-001.webp",
                    "caption": "",
                    "page": 2,
                    "index": 1,
                    "width": 1280,
                    "height": 720,
                }
            ],
        }
        md = self.mod.build_markdown_content(paper, "quick", "", "", [])
        meta = self.mod._parse_front_matter(md)
        self.assertIn("figures_json", meta)
        figures = json.loads(meta["figures_json"])
        self.assertEqual(len(figures), 1)
        self.assertEqual(figures[0]["url"], "assets/figures/arxiv/1234.5678/fig-001.webp")

    def test_maybe_generate_paper_figures_accepts_biorxiv(self):
        calls = []

        def fake_ensure_paper_figures(**kwargs):
            calls.append(kwargs)
            return [{"url": "assets/figures/biorxiv/pid/fig-001.webp"}]

        original = self.mod.ensure_paper_figures
        self.mod.ensure_paper_figures = fake_ensure_paper_figures
        try:
            figures = self.mod.maybe_generate_paper_figures(
                {
                    "id": "biorxiv-abc",
                    "source": "biorxiv",
                },
                docs_dir="docs",
                paper_id="202603/26/biorxiv-abc",
                pdf_url="https://www.biorxiv.org/content/test.full.pdf",
            )
        finally:
            self.mod.ensure_paper_figures = original

        self.assertEqual(len(figures), 1)
        self.assertEqual(calls[0]["source_key"], "biorxiv")

    def test_import_surfaces_workflow_init_error_in_global_state(self):
        root = Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        src_path = src_dir / "6.generate_docs.py"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        llm_module = sys.modules["llm"]
        with patch.object(
            llm_module.ClientFactory,
            "from_env",
            side_effect=ValueError("缺少 workflow LLM base_url"),
        ):
            spec = importlib.util.spec_from_file_location("gen6_mod_missing_base", src_path)
            module = importlib.util.module_from_spec(spec)
            assert spec and spec.loader
            spec.loader.exec_module(module)

        self.assertIsNone(module.LLM_CLIENT)
        self.assertIn("workflow LLM base_url", module.LLM_CLIENT_ERROR)


if __name__ == "__main__":
    unittest.main()
