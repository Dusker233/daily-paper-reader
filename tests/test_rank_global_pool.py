import importlib.util
import json
import pathlib
import sys
import tempfile
import unittest
from unittest.mock import patch


def _load_module(module_name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


class RankGlobalPoolTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        cls.mod = _load_module("rank_mod", src_dir / "3.rank_papers.py")

    def test_resolve_global_pool_budget_scales_with_total_papers(self):
        self.assertEqual(
            self.mod.resolve_global_pool_budget(1000, 4),
            (30, 8, 120),
        )
        self.assertEqual(
            self.mod.resolve_global_pool_budget(3000, 4),
            (50, 12, 200),
        )
        self.assertEqual(
            self.mod.resolve_global_pool_budget(10000, 4),
            (120, 20, 300),
        )

    def test_build_global_candidate_ids_keeps_intent_lane_top_and_global_top(self):
        queries = [
            {
                "type": "intent_query",
                "paper_tag": "query:AHD",
                "query_text": "how to automate",
                "sim_scores": {
                    "p1": {"rank": 1, "score": 0.9},
                    "p3": {"rank": 2, "score": 0.7},
                },
            },
            {
                "type": "keyword",
                "paper_tag": "keyword:AHD",
                "query_text": "Automated Algorithm Design",
                "sim_scores": {
                    "p2": {"rank": 1, "score": 1.0},
                    "p4": {"rank": 2, "score": 0.6},
                },
            },
        ]

        ids = self.mod.build_global_candidate_ids(
            queries,
            lane_top_k=30,
            guaranteed_per_lane=1,
            global_limit=3,
        )

        self.assertEqual(ids, ["p1", "p3"])

    def test_build_global_candidate_ids_keeps_legacy_llm_queries(self):
        queries = [
            {
                "type": "llm_query",
                "paper_tag": "query:AHD",
                "query_text": "how to automate",
                "sim_scores": {
                    "p1": {"rank": 1, "score": 0.9},
                    "p2": {"rank": 2, "score": 0.8},
                },
            },
            {
                "type": "keyword",
                "paper_tag": "keyword:AHD",
                "query_text": "Automated Algorithm Design",
                "sim_scores": {
                    "k1": {"rank": 1, "score": 1.0},
                },
            },
        ]

        ids = self.mod.build_global_candidate_ids(
            queries,
            lane_top_k=30,
            guaranteed_per_lane=1,
            global_limit=10,
        )

        self.assertEqual(ids, ["p1", "p2"])

    def test_is_intent_rerank_query_normalizes_case_and_whitespace(self):
        self.assertTrue(self.mod._is_intent_rerank_query({"type": " LLM_QUERY "}))
        self.assertTrue(self.mod._is_intent_rerank_query({"type": "Intent_Query"}))
        self.assertFalse(self.mod._is_intent_rerank_query({"type": "keyword"}))

    def test_build_global_candidate_ids_respects_lane_top_k(self):
        queries = [
            {
                "type": "intent_query",
                "paper_tag": "query:AHD",
                "query_text": "how to automate",
                "sim_scores": {
                    "p1": {"rank": 1, "score": 0.9},
                    "p2": {"rank": 2, "score": 0.8},
                    "p3": {"rank": 3, "score": 0.7},
                    "p4": {"rank": 4, "score": 0.6},
                },
            },
            {
                "type": "keyword",
                "paper_tag": "keyword:AHD",
                "query_text": "Automated Algorithm Design",
                "sim_scores": {
                    "k1": {"rank": 1, "score": 1.0},
                    "k2": {"rank": 2, "score": 0.9},
                    "k3": {"rank": 3, "score": 0.8},
                    "k4": {"rank": 4, "score": 0.7},
                },
            },
        ]

        ids = self.mod.build_global_candidate_ids(
            queries,
            lane_top_k=2,
            guaranteed_per_lane=1,
            global_limit=10,
        )

        self.assertEqual(ids, ["p1", "p2"])
        self.assertNotIn("p3", ids)
        self.assertNotIn("k1", ids)
        self.assertNotIn("k3", ids)

    def test_build_documents_includes_source_venue_and_year_metadata(self):
        docs = self.mod.build_documents(
            {
                "p1": {
                    "id": "p1",
                    "title": "Conference paper",
                    "abstract": "ranking with venue-aware metadata",
                    "source": "iclr-2026-poster",
                    "venue_id": "ICLR.cc/2026/Conference",
                    "published": "2026-05-01T00:00:00+00:00",
                }
            },
            ["p1"],
        )

        self.assertEqual(len(docs), 1)
        self.assertIn("Source: iclr-2026-poster", docs[0])
        self.assertIn("Venue: ICLR.cc/2026/Conference", docs[0])
        self.assertIn("Year: 2026", docs[0])
        self.assertIn("Title: Conference paper", docs[0])
        self.assertIn("Abstract: ranking with venue-aware metadata", docs[0])

    def test_process_file_reranks_intent_query_on_global_pool(self):
        payload = {
            "generated_at": "2026-03-11T00:00:00+00:00",
            "papers": [
                {
                    "id": "p1",
                    "title": "Intent paper",
                    "abstract": "intent abstract",
                    "source": "iclr-2026-poster",
                    "venue_id": "ICLR.cc/2026/Conference",
                    "published": "2026-05-01T00:00:00+00:00",
                },
                {
                    "id": "p2",
                    "title": "Keyword only paper",
                    "abstract": "keyword abstract",
                    "source": "neurips-2025-poster",
                    "published": "2025-12-01T00:00:00+00:00",
                },
                {"id": "p3", "title": "Intent tail paper", "abstract": "tail abstract"},
            ],
            "queries": [
                {
                    "type": "keyword",
                    "tag": "AHD",
                    "paper_tag": "keyword:AHD",
                    "query_text": "Automated Algorithm Design",
                    "sim_scores": {
                        "p2": {"rank": 1, "score": 1.0},
                    },
                },
                {
                    "type": "intent_query",
                    "tag": "AHD",
                    "paper_tag": "query:AHD",
                    "query_text": "how to automate the discovery of new optimization algorithms",
                    "sim_scores": {
                        "p1": {"rank": 1, "score": 0.9},
                        "p3": {"rank": 2, "score": 0.8},
                    },
                },
            ],
        }

        saved, reranker = self._run_process_file(payload)

        queries = saved.get("queries") or []
        intent_queries = [q for q in queries if q.get("type") == "intent_query"]
        self.assertEqual(len(intent_queries), 1)
        ranked = intent_queries[0].get("ranked") or []
        ranked_ids = [item.get("paper_id") for item in ranked]
        self.assertEqual(ranked_ids, ["p3", "p1"])
        self.assertEqual(saved.get("global_candidate_ids"), ["p1", "p3"])
        self.assertEqual(saved.get("global_pool_lane_top_k"), 30)
        self.assertEqual(saved.get("global_pool_limit"), 60)
        self.assertEqual(saved.get("global_pool_guaranteed_per_lane"), 8)
        self.assertEqual(len(reranker.last_documents), 2)
        self.assertTrue(any("Source: iclr-2026-poster" in doc for doc in reranker.last_documents))
        self.assertTrue(any("Venue: ICLR.cc/2026/Conference" in doc for doc in reranker.last_documents))
        self.assertTrue(any("tail abstract" in doc for doc in reranker.last_documents))
        self.assertFalse(any("Keyword only paper" in doc for doc in reranker.last_documents))
        self.assertFalse(any("Year: 2025" in doc for doc in reranker.last_documents))

    def test_process_file_reranks_legacy_llm_query_on_global_pool(self):
        payload = {
            "generated_at": "2026-03-11T00:00:00+00:00",
            "papers": [
                {"id": "p1", "title": "Legacy intent paper", "abstract": "legacy abstract"},
                {"id": "p2", "title": "Keyword only paper", "abstract": "keyword abstract"},
                {"id": "p3", "title": "Legacy tail paper", "abstract": "tail abstract"},
            ],
            "queries": [
                {
                    "type": "keyword",
                    "tag": "AHD",
                    "paper_tag": "keyword:AHD",
                    "query_text": "Automated Algorithm Design",
                    "sim_scores": {
                        "p2": {"rank": 1, "score": 1.0},
                    },
                },
                {
                    "type": "llm_query",
                    "tag": "AHD",
                    "paper_tag": "query:AHD",
                    "query_text": "legacy llm query text",
                    "sim_scores": {
                        "p1": {"rank": 1, "score": 0.9},
                        "p3": {"rank": 2, "score": 0.8},
                    },
                },
            ],
        }

        saved, reranker = self._run_process_file(payload)

        queries = saved.get("queries") or []
        llm_queries = [q for q in queries if q.get("type") == "llm_query"]
        self.assertEqual(len(llm_queries), 1)
        ranked = llm_queries[0].get("ranked") or []
        ranked_ids = [item.get("paper_id") for item in ranked]
        self.assertEqual(ranked_ids, ["p3", "p1"])
        self.assertEqual(saved.get("global_candidate_ids"), ["p1", "p3"])
        self.assertEqual(len(reranker.last_documents), 2)
        self.assertFalse(any("Keyword only paper" in doc for doc in reranker.last_documents))

    def _run_process_file(self, payload):
        class FakeReranker:
            def rerank(self, **kwargs):
                documents = kwargs.get("documents") or []
                self.last_documents = documents
                return {
                    "results": [
                        {"index": 1, "relevance_score": 0.95},
                        {"index": 0, "relevance_score": 0.80},
                    ]
                }

        reranker = FakeReranker()

        with tempfile.TemporaryDirectory() as tmp:
            input_path = pathlib.Path(tmp) / "input.json"
            output_path = pathlib.Path(tmp) / "output.json"
            input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            with patch.object(self.mod.random, "shuffle", side_effect=lambda items: None):
                self.mod.process_file(
                    reranker=reranker,
                    input_path=str(input_path),
                    output_path=str(output_path),
                    top_n=None,
                    rerank_model="fake-model",
                )

            saved = json.loads(output_path.read_text(encoding="utf-8"))

        return saved, reranker


if __name__ == "__main__":
    unittest.main()
