import importlib.util
import pathlib
import sys
import unittest


def _load_module(module_name: str, path: pathlib.Path):
    spec = importlib.util.spec_from_file_location(module_name, path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    return mod


class QueryTagFlowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        cls.refine_mod = _load_module("llm_refine_mod", src_dir / "4.llm_refine_papers.py")
        cls.select_mod = _load_module("select_mod", src_dir / "5.select_papers.py")

    def test_build_user_requirements_keep_query_tag(self):
        config = {
            "subscriptions": {
                "intent_profiles": [
                    {
                        "id": "p1",
                        "tag": "SR",
                        "enabled": True,
                        "keywords": [
                            {
                                "id": "q1",
                                "keyword": "Symbolic Regression",
                                "query": "symbolic regression with rl",
                                "enabled": True,
                            },
                        ],
                    }
                ]
            }
        }
        reqs = self.refine_mod.build_user_requirements(config, [])
        self.assertEqual(len(reqs), 1)
        self.assertEqual(reqs[0]["tag"], "query:sr")
        self.assertEqual(reqs[0]["id"], "req-1")

    def test_build_user_requirements_include_intent_queries(self):
        config = {
            "subscriptions": {
                "schema_migration": {"stage": "A"},
                "intent_profiles": [
                    {
                        "id": "p1",
                        "tag": "SR",
                        "keywords": [
                            {"keyword": "Symbolic Regression", "query": "symbolic regression", "enabled": True},
                        ],
                        "intent_queries": [
                            {"query": "symbolic regression with reinforcement learning", "enabled": True},
                            {"query": "equation discovery for physical systems", "enabled": True},
                        ],
                    }
                ]
            }
        }
        reqs = self.refine_mod.build_user_requirements(config, [])
        self.assertEqual(len(reqs), 4)
        self.assertEqual(reqs[0]["tag"], "query:sr")
        self.assertTrue(reqs[1]["tag"].startswith("query:sr"))
        self.assertTrue(reqs[2]["tag"].startswith("query:sr"))
        self.assertEqual(reqs[3]["tag"], "query:sr:composite")
        req_texts = [r["query"] for r in reqs]
        self.assertIn("symbolic regression with reinforcement learning", req_texts)
        self.assertIn("equation discovery for physical systems", req_texts)
        self.assertIn("Papers central to", reqs[3]["query"])
        self.assertEqual(reqs[3]["kind"], "composite")

    def test_build_user_requirements_adds_profile_composite_requirement(self):
        config = {
            "subscriptions": {
                "intent_profiles": [
                    {
                        "tag": "SCI",
                        "description": "科学发现",
                        "enabled": True,
                        "keywords": [
                            {"keyword": "model discovery", "query": "llm based model discovery", "enabled": True},
                            {"keyword": "equation discovery", "query": "scientific equation discovery", "enabled": True},
                        ],
                        "intent_queries": [
                            {"query": "scientific discovery via embodied actions", "enabled": True},
                        ],
                    }
                ]
            }
        }

        reqs = self.refine_mod.build_user_requirements(config, [])
        composite = [item for item in reqs if item.get("kind") == "composite"]
        self.assertEqual(len(composite), 1)
        self.assertEqual(composite[0]["tag"], "query:sci:composite")
        self.assertIn("llm based model discovery", composite[0]["query"].lower())
        self.assertIn("scientific equation discovery", composite[0]["query"].lower())
        self.assertIn("embodied actions", composite[0]["query"].lower())

    def test_build_scored_papers_fallback_match_tag(self):
        papers = [{"id": "p-1", "title": "t", "abstract": "a"}]
        llm_ranked = [
            {
                "paper_id": "p-1",
                "score": 8.8,
                "evidence_cn": "相关",
                "tldr_cn": "摘要",
                "tags": [],
                "matched_query_tag": "query:sr-rl",
                "matched_query_text": "symbolic regression with reinforcement learning",
                "matched_requirement_id": "req-2",
            }
        ]
        out = self.select_mod.build_scored_papers(papers, llm_ranked)
        self.assertEqual(len(out), 1)
        self.assertIn("query:sr-rl", out[0].get("llm_tags") or [])
        self.assertEqual(out[0].get("matched_requirement_id"), "req-2")

    def test_build_scored_papers_preserves_dimension_scores_and_assessment_tags(self):
        papers = [{"id": "p-1", "title": "t", "abstract": "a"}]
        llm_ranked = [
            {
                "paper_id": "p-1",
                "score": 7.6,
                "relevance_score": 9.0,
                "quality_score": 6.0,
                "reliability_score": 5.0,
                "practicality_score": 3.0,
                "evidence_cn": "方法相关但落地弱",
                "tldr_cn": "偏研究型，实用性有限。",
                "tags": ["query:sr"],
                "matched_query_tag": "query:sr-rl",
                "matched_query_text": "symbolic regression with reinforcement learning",
                "matched_requirement_id": "req-2",
            }
        ]
        out = self.select_mod.build_scored_papers(papers, llm_ranked)
        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertEqual(paper.get("llm_relevance_score"), 9.0)
        self.assertEqual(paper.get("llm_quality_score"), 6.0)
        self.assertEqual(paper.get("llm_reliability_score"), 5.0)
        self.assertEqual(paper.get("llm_practicality_score"), 3.0)
        self.assertIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_build_scored_papers_keeps_missing_dimension_scores_absent(self):
        papers = [{"id": "p-1", "title": "t", "abstract": "a"}]
        llm_ranked = [
            {
                "paper_id": "p-1",
                "score": 8.2,
                "relevance_score": 9.1,
                "evidence_cn": "高度相关。",
                "tldr_cn": "缺少分维度打分。",
                "tags": ["query:sr"],
            }
        ]
        out = self.select_mod.build_scored_papers(papers, llm_ranked)
        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertEqual(paper.get("llm_relevance_score"), 9.1)
        self.assertIsNone(paper.get("llm_quality_score"))
        self.assertIsNone(paper.get("llm_reliability_score"))
        self.assertIsNone(paper.get("llm_practicality_score"))
        self.assertNotIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_build_scored_papers_treats_non_finite_dimension_scores_as_missing(self):
        papers = [{"id": "p-1", "title": "t", "abstract": "a"}]
        llm_ranked = [
            {
                "paper_id": "p-1",
                "score": 8.2,
                "relevance_score": "NaN",
                "quality_score": "inf",
                "reliability_score": "-inf",
                "evidence_cn": "分数非法。",
                "tldr_cn": "非法分数应视为缺失。",
                "tags": ["query:sr"],
            }
        ]
        out = self.select_mod.build_scored_papers(papers, llm_ranked)
        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertIsNone(paper.get("llm_relevance_score"))
        self.assertIsNone(paper.get("llm_quality_score"))
        self.assertIsNone(paper.get("llm_reliability_score"))
        self.assertIsNone(paper.get("llm_practicality_score"))
        self.assertNotIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_build_scored_papers_treats_non_finite_primary_score_as_zero(self):
        papers = [{"id": "p-1", "title": "t", "abstract": "a"}]
        llm_ranked = [
            {
                "paper_id": "p-1",
                "score": "NaN",
                "evidence_cn": "主分非法。",
                "tldr_cn": "主分应回退为 0。",
                "tags": ["query:sr"],
            }
        ]
        out = self.select_mod.build_scored_papers(papers, llm_ranked)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0].get("llm_score"), 0.0)

    def test_build_selection_bucket_tags_excludes_assessment_tags(self):
        tags = self.select_mod.build_selection_bucket_tags(
            {
                "llm_tags": [
                    "query:sr",
                    "assessment:low-practicality",
                    "assessment:low-reliability",
                ]
            }
        )
        self.assertEqual(tags, ["query:sr"])

    def test_build_selection_bucket_tags_falls_back_to_untagged_for_assessment_only(self):
        tags = self.select_mod.build_selection_bucket_tags(
            {
                "llm_tags": [
                    "assessment:low-practicality",
                    "assessment:low-reliability",
                ]
            }
        )
        self.assertEqual(tags, ["untagged"])

    def test_round_robin_select_does_not_create_assessment_only_bucket(self):
        tag_map = self.select_mod.build_tag_map(
            [
                {
                    "id": "p-1",
                    "llm_score": 8.9,
                    "llm_tags": ["query:sr", "assessment:low-practicality"],
                },
                {
                    "id": "p-2",
                    "llm_score": 8.7,
                    "llm_tags": ["query:sr"],
                },
                {
                    "id": "p-3",
                    "llm_score": 8.5,
                    "llm_tags": ["assessment:low-quality"],
                },
            ]
        )
        self.assertIn("query:sr", tag_map)
        self.assertIn("untagged", tag_map)
        self.assertNotIn("assessment:low-practicality", tag_map)
        self.assertNotIn("assessment:low-quality", tag_map)


if __name__ == "__main__":
    unittest.main()
