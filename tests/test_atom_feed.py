import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class AtomFeedTest(unittest.TestCase):
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
                def __init__(self, *args, **kwargs): pass
                def chat(self, *args, **kwargs): return {"content": ""}
                def chat_structured(self, *args, **kwargs): return {}
            class DummyClientFactory:
                def __init__(self, *args, **kwargs): pass
            llm_stub.ClientFactory = DummyClientFactory
            llm_stub.LLMClient = DummyLLMClient
            sys.modules["llm"] = llm_stub
        if "paper_figures" not in sys.modules:
            import types
            sys.modules["paper_figures"] = types.ModuleType("paper_figures")

        spec = importlib.util.spec_from_file_location(
            "g", root / "src" / "6.generate_docs.py"
        )
        cls._mod = importlib.util.module_from_spec(spec)
        sys.modules["g"] = cls._mod
        spec.loader.exec_module(cls._mod)

    @classmethod
    def tearDownClass(cls):
        cls._env_patch.stop()
        for name, mod in cls._original_modules.items():
            if mod is None:
                sys.modules.pop(name, None)
            else:
                sys.modules[name] = mod

    def test_parse_generated_at_utc(self):
        """UTC timestamp '2026-04-21 20:46:20 UTC' parses to RFC3339."""
        with tempfile.TemporaryDirectory() as tmpdir:
            readme = Path(tmpdir) / "README.md"
            readme.write_text("- 生成时间：2026-04-21 20:46:20 UTC\n")
            result = self._mod._parse_generated_at_from_readme(str(readme))
            self.assertEqual(result, "2026-04-21T20:46:20Z")

    def test_parse_generated_at_no_timezone(self):
        """Timestamp without timezone uses date only."""
        with tempfile.TemporaryDirectory() as tmpdir:
            readme = Path(tmpdir) / "README.md"
            readme.write_text("- 生成时间：2026-04-21 20:46:20\n")
            result = self._mod._parse_generated_at_from_readme(str(readme))
            self.assertEqual(result, "2026-04-21T20:46:20Z")

    def test_parse_generated_at_missing(self):
        """Missing file returns empty string."""
        result = self._mod._parse_generated_at_from_readme("/nonexistent/README.md")
        self.assertEqual(result, "")

    def test_read_day_report_summary_with_ai_heading(self):
        """AI brief heading ## 今日简报（AI）is extracted correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            readme = Path(tmpdir) / "README.md"
            readme.write_text(
                "# 日报 · 2026-04-22\n"
                "- 生成时间：2026-04-22 20:09:01 UTC\n"
                "## 今日简报（AI）\n"
                "今天成功完成了16篇论文的精读与速读。\n"
                "值得关注的两篇涉及LLM在安全运营中的应用。\n"
                "## 精读区\n"
            )
            result = self._mod._read_day_report_summary(str(readme))
            self.assertIn("今天成功完成了16篇论文", result)
            self.assertNotIn("生成时间", result)

    def test_read_day_report_summary_fallback(self):
        """Fallback extracts first non-heading paragraph."""
        with tempfile.TemporaryDirectory() as tmpdir:
            readme = Path(tmpdir) / "README.md"
            # Add double-newline between metadata and content to trigger fallback
            readme.write_text(
                "# 日报 · 2026-04-22\n"
                "- 生成时间：2026-04-22 20:09:01 UTC\n\n"
                "This is the AI summary content that appears as a paragraph.\n"
                "It should be extracted by the fallback mechanism.\n"
            )
            result = self._mod._read_day_report_summary(str(readme))
            self.assertIn("AI summary content", result)

    def test_build_atom_feed_url_single_day(self):
        """Single-day report URL uses href directly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            readme = Path(tmpdir) / "README.md"
            readme.write_text("- 生成时间：2026-04-22 20:09:01 UTC\n")
            # Create docs/YYYYMM/DD structure
            ymdir = Path(tmpdir) / "202604"
            ymdir.mkdir()
            daydir = ymdir / "22"
            daydir.mkdir()
            dayreadme = daydir / "README.md"
            dayreadme.write_text("- 生成时间：2026-04-22 20:09:01 UTC\n## 今日简报（AI）\nAI brief text here.\n## 精读区\n")
            content = self._mod.build_atom_feed_content(tmpdir, "https://example.com", max_items=5)
            self.assertIn("https://example.com/#/202604/22/README", content)
            self.assertIn("日报 · 2026-04-22", content)

    def test_build_atom_feed_url_range(self):
        """Range report URL preserves full range path."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create range dir
            rangedir = Path(tmpdir) / "20260401-20260415"
            rangedir.mkdir()
            rangereadme = rangedir / "README.md"
            rangereadme.write_text("- 生成时间：2026-04-15 12:00:00 UTC\n## 今日简报（AI）\nRange brief.\n## 精读区\n")
            content = self._mod.build_atom_feed_content(tmpdir, "https://example.com", max_items=5)
            self.assertIn("https://example.com/#/20260401-20260415/README", content)
            self.assertIn("日报 · 2026-04-01 ~ 2026-04-15", content)

    def test_build_atom_feed_entries_sorted_newest_first(self):
        """Entries are sorted by updated timestamp descending."""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create two day dirs: one older, one newer
            ymdir1 = Path(tmpdir) / "202604"
            ymdir1.mkdir()
            d1 = ymdir1 / "01"
            d1.mkdir()
            (d1 / "README.md").write_text(
                "- 生成时间：2026-04-01 08:00:00 UTC\n## 今日简报（AI）\nOld report.\n## 精读区\n"
            )
            d2 = ymdir1 / "22"
            d2.mkdir()
            (d2 / "README.md").write_text(
                "- 生成时间：2026-04-22 20:00:00 UTC\n## 今日简报（AI）\nNew report.\n## 精读区\n"
            )
            content = self._mod.build_atom_feed_content(tmpdir, "https://example.com", max_items=5)
            idx1 = content.find("2026-04-01")
            idx2 = content.find("2026-04-22")
            self.assertLess(idx2, idx1, "Newer entry should appear before older in sorted output")

    def test_build_atom_feed_entry_ids_unique(self):
        """Entry IDs are unique per report (not per month)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ymdir = Path(tmpdir) / "202604"
            ymdir.mkdir()
            for day in ["21", "22"]:
                d = ymdir / day
                d.mkdir()
                (d / "README.md").write_text(
                    f"- 生成时间：2026-04-{day} 12:00:00 UTC\n## 今日简报（AI）\nReport {day}.\n## 精读区\n"
                )
            content = self._mod.build_atom_feed_content(tmpdir, "https://example.com", max_items=5)
            # Extract urn:uuid values
            import re
            uuids = re.findall(r"<id>urn:uuid:([a-f0-9]+)</id>", content)
            self.assertEqual(len(uuids), len(set(uuids)), f"Duplicate UUIDs found: {uuids}")

    def test_build_atom_feed_no_import_error(self):
        """build_atom_feed_content runs without NameError (hashlib imported)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ymdir = Path(tmpdir) / "202604"
            ymdir.mkdir()
            d = ymdir / "22"
            d.mkdir()
            (d / "README.md").write_text(
                "- 生成时间：2026-04-22 20:00:00 UTC\n## 今日简报（AI）\nBrief.\n## 精读区\n"
            )
            # Should not raise NameError
            content = self._mod.build_atom_feed_content(tmpdir, "https://example.com", max_items=5)
            self.assertIn("<feed", content)
            self.assertIn("</feed>", content)

    def test_write_atom_feed_returns_path(self):
        """write_atom_feed returns the path to docs/feed.xml."""
        with tempfile.TemporaryDirectory() as tmpdir:
            ymdir = Path(tmpdir) / "202604"
            ymdir.mkdir()
            d = ymdir / "22"
            d.mkdir()
            (d / "README.md").write_text(
                "- 生成时间：2026-04-22 20:00:00 UTC\n## 今日简报（AI）\nBrief.\n## 精读区\n"
            )
            path = self._mod.write_atom_feed(tmpdir, "https://example.com", max_items=5)
            self.assertEqual(path, os.path.join(tmpdir, "feed.xml"))
            self.assertTrue(os.path.exists(path))

    def test_feed_xml_valid(self):
        """Written feed.xml is valid XML."""
        import xml.etree.ElementTree as ET
        with tempfile.TemporaryDirectory() as tmpdir:
            ymdir = Path(tmpdir) / "202604"
            ymdir.mkdir()
            d = ymdir / "22"
            d.mkdir()
            (d / "README.md").write_text(
                "- 生成时间：2026-04-22 20:00:00 UTC\n## 今日简报（AI）\nBrief text.\n## 精读区\n"
            )
            self._mod.write_atom_feed(tmpdir, "https://example.com", max_items=5)
            ET.parse(os.path.join(tmpdir, "feed.xml"))


if __name__ == "__main__":
    unittest.main()