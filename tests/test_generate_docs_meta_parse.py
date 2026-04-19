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
        cls._original_modules = {
            "fitz": sys.modules.get("fitz"),
            "llm": sys.modules.get("llm"),
            "paper_figures": sys.modules.get("paper_figures"),
        }
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
        for name, module in cls._original_modules.items():
            if module is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = module

    def test_parse_meta_from_front_matter(self):
        md_path = Path(__file__).resolve().parents[1] / "docs/201706/12/1706.03762v1-attention-is-all-you-need.md"
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

    def test_extract_sidebar_tags_keeps_assessment_tags(self):
        paper = {
            "llm_score": 7.6,
            "llm_tags": [
                "query:sr",
                "assessment:low-practicality",
                "assessment:low-reliability",
                "assessment:low-quality",
            ],
        }
        tags = self.mod.extract_sidebar_tags(paper)
        self.assertEqual(tags[0], ("score", "7.6"))
        self.assertIn(("assessment", "low-practicality"), tags)
        self.assertIn(("assessment", "low-reliability"), tags)
        self.assertIn(("assessment", "low-quality"), tags)

    def test_build_day_report_markdown_includes_entry_summaries(self):
        content = self.mod.build_day_report_markdown(
            date_str="20260326",
            date_label="2026-03-26",
            deep_entries=[
                {
                    "paper_id": "202603/26/paper-a",
                    "title": "Deep Paper",
                    "tags": [("score", "9.2"), ("query", "sr")],
                    "summary_cn": "这是一篇精读摘要。",
                }
            ],
            quick_entries=[
                {
                    "paper_id": "202603/26/paper-b",
                    "title": "Quick Paper",
                    "tags": [("score", "8.1"), ("assessment", "low-practicality")],
                    "summary_cn": "这是一篇速读摘要。",
                }
            ],
            recommend_exists=True,
        )
        self.assertIn("1. [Deep Paper](/202603/26/paper-a)（9.2/10）", content)
        self.assertIn("摘要：这是一篇精读摘要。", content)
        self.assertIn("1. [Quick Paper](/202603/26/paper-b)（8.1/10）", content)
        self.assertIn("摘要：这是一篇速读摘要。", content)

    def test_build_latest_report_section_includes_entry_summaries(self):
        content = self.mod.build_latest_report_section(
            date_str="20260326",
            date_label="2026-03-26",
            generated_at="2026-03-26 00:00:00 UTC",
            recommend_exists=True,
            deep_entries=[
                {
                    "paper_id": "202603/26/paper-a",
                    "title": "Deep Paper",
                    "tags": [("score", "9.2"), ("query", "sr")],
                    "summary_cn": "精读区一句话总结。",
                }
            ],
            quick_entries=[
                {
                    "paper_id": "202603/26/paper-b",
                    "title": "Quick Paper",
                    "tags": [("score", "8.1"), ("assessment", "low-practicality")],
                    "summary_cn": "速读区一句话总结。",
                }
            ],
            paper_evidence_by_id={
                "202603/26/paper-a": "evidence a",
                "202603/26/paper-b": "evidence b",
            },
        )
        self.assertIn("摘要：精读区一句话总结。", content)
        self.assertIn("摘要：速读区一句话总结。", content)
        self.assertIn("标签：评分：8.1/10、assessment:low-practicality", content)

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

    def test_resolve_entry_summary_prefers_glance_overview_tldr(self):
        summary = self.mod._resolve_entry_summary(
            {
                "llm_tldr_cn": "旧的一句话摘要",
                "_glance_overview": "\n".join(
                    [
                        "**TLDR**：新的速览 TLDR。 \\",
                        "**Research Question**：问题。 \\",
                        "**Core Idea**：方法。 \\",
                        "**Evidence**：结果。 \\",
                        "**Reading Guide**：导读。",
                    ]
                ),
            }
        )
        self.assertEqual(summary, "新的速览 TLDR。")

    def test_resolve_entry_summary_falls_back_to_legacy_tldr_without_glance(self):
        summary = self.mod._resolve_entry_summary(
            {
                "llm_tldr_cn": "旧的一句话摘要",
            }
        )
        self.assertEqual(summary, "旧的一句话摘要。")

    def test_build_markdown_content_maps_new_glance_labels_to_legacy_frontmatter_fields(self):
        paper = {
            "title": "Glance Mapping Test",
            "authors": ["Ada Lovelace"],
            "published": "2026-03-26T00:00:00+00:00",
            "link": "https://arxiv.org/pdf/9999.9999",
            "abstract": "abstract body",
            "source": "arxiv",
            "_glance_overview": "\n".join(
                [
                    "**TLDR**：新的速览 TLDR。 \\",
                    "**Research Question**：新的问题定义。 \\",
                    "**Core Idea**：新的方法拆解。 \\",
                    "**Evidence**：新的关键证据。 \\",
                    "**Reading Guide**：新的继续阅读建议。",
                ]
            ),
        }
        md = self.mod.build_markdown_content(paper, "quick", "", "", [])
        meta = self.mod._parse_front_matter(md)
        self.assertEqual(meta.get("tldr"), "新的速览 TLDR。")
        self.assertEqual(meta.get("motivation"), "新的问题定义。")
        self.assertEqual(meta.get("method"), "新的方法拆解。")
        self.assertEqual(meta.get("result"), "新的关键证据。")
        self.assertEqual(meta.get("conclusion"), "新的继续阅读建议。")

    def test_build_markdown_content_prefers_new_glance_labels_over_legacy_duplicates(self):
        paper = {
            "title": "Glance Duplicate Test",
            "authors": ["Ada Lovelace"],
            "published": "2026-03-26T00:00:00+00:00",
            "link": "https://arxiv.org/pdf/9999.9999",
            "abstract": "abstract body",
            "source": "arxiv",
            "_glance_overview": "\n".join(
                [
                    "**TLDR**：新的速览 TLDR。 \\",
                    "**Motivation**：旧的问题定义。 \\",
                    "**Research Question**：新的问题定义。 \\",
                    "**Method**：旧的方法拆解。 \\",
                    "**Core Idea**：新的方法拆解。 \\",
                    "**Result**：旧的关键证据。 \\",
                    "**Evidence**：新的关键证据。 \\",
                    "**Conclusion**：旧的阅读建议。 \\",
                    "**Reading Guide**：新的继续阅读建议。",
                ]
            ),
        }
        md = self.mod.build_markdown_content(paper, "quick", "", "", [])
        self.assertEqual(md.count("\nmotivation:"), 1)
        self.assertEqual(md.count("\nmethod:"), 1)
        self.assertEqual(md.count("\nresult:"), 1)
        self.assertEqual(md.count("\nconclusion:"), 1)
        meta = self.mod._parse_front_matter(md)
        self.assertEqual(meta.get("motivation"), "新的问题定义。")
        self.assertEqual(meta.get("method"), "新的方法拆解。")
        self.assertEqual(meta.get("result"), "新的关键证据。")
        self.assertEqual(meta.get("conclusion"), "新的继续阅读建议。")

    def test_prepare_glance_source_text_respects_requested_budget(self):
        text = "a" * 5000 + "b" * 5000 + "c" * 5000
        prepared = self.mod._prepare_glance_source_text("", text, max_chars=120)
        self.assertLessEqual(len(prepared), 120)
        self.assertIn("[...中间内容已省略...]", prepared)
        self.assertTrue(prepared.startswith("a"))
        self.assertTrue(prepared.endswith("c"))

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
