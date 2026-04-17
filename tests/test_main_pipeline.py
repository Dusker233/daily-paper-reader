import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


def _load_module(module_name: str = "main_pipeline_mod", path: Path | None = None):
    root = Path(__file__).resolve().parents[1]
    src_dir = root / "src"
    if str(src_dir) not in sys.path:
        sys.path.insert(0, str(src_dir))
    src_path = path or (root / "src" / "main.py")
    spec = importlib.util.spec_from_file_location(module_name, src_path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class MainPipelineTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = _load_module()

    def _write_rrf_input(self, root: Path, token: str) -> Path:
        filtered_dir = root / "archive" / token / "filtered"
        filtered_dir.mkdir(parents=True, exist_ok=True)
        path = filtered_dir / f"arxiv_papers_{token}.json"
        payload = {
            "generated_at": "2026-03-10T00:00:00+00:00",
            "papers": [
                {"id": "p1", "title": "Paper 1", "abstract": "A"},
                {"id": "p2", "title": "Paper 2", "abstract": "B"},
                {"id": "p3", "title": "Paper 3", "abstract": "C"},
            ],
            "queries": [
                {
                    "type": "intent_query",
                    "tag": "query:test",
                    "paper_tag": "query:test",
                    "query_text": "test query",
                    "sim_scores": {
                        "p1": {"score": 0.9, "rank": 1},
                        "p2": {"score": 0.6, "rank": 2},
                        "p3": {"score": 0.2, "rank": 3},
                    },
                }
            ],
        }
        path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return path

    def test_build_scored_papers_propagates_dimension_scores(self):
        root = Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        select_mod = _load_module("select_mod_dimensions", src_dir / "5.select_papers.py")

        out = select_mod.build_scored_papers(
            [{"id": "p-1", "title": "Paper 1", "abstract": "A"}],
            [
                {
                    "paper_id": "p-1",
                    "score": 7.8,
                    "relevance_score": 9.1,
                    "quality_score": 6.2,
                    "reliability_score": 5.8,
                    "practicality_score": 3.6,
                    "evidence_cn": "高度相关但落地有限",
                    "tldr_cn": "一篇偏研究导向的工作。",
                    "tags": ["query:test"],
                }
            ],
        )

        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertEqual(paper["llm_relevance_score"], 9.1)
        self.assertEqual(paper["llm_quality_score"], 6.2)
        self.assertEqual(paper["llm_reliability_score"], 5.8)
        self.assertEqual(paper["llm_practicality_score"], 3.6)
        self.assertIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_build_scored_papers_does_not_tag_missing_dimension_scores_as_low(self):
        root = Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        select_mod = _load_module("select_mod_missing_dimensions", src_dir / "5.select_papers.py")

        out = select_mod.build_scored_papers(
            [{"id": "p-1", "title": "Paper 1", "abstract": "A"}],
            [
                {
                    "paper_id": "p-1",
                    "score": 8.4,
                    "relevance_score": 9.1,
                    "evidence_cn": "高度相关",
                    "tldr_cn": "未返回分维度打分。",
                    "tags": ["query:test"],
                }
            ],
        )

        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertEqual(paper["llm_relevance_score"], 9.1)
        self.assertIsNone(paper["llm_quality_score"])
        self.assertIsNone(paper["llm_reliability_score"])
        self.assertIsNone(paper["llm_practicality_score"])
        self.assertNotIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_build_scored_papers_does_not_tag_non_finite_dimension_scores_as_low(self):
        root = Path(__file__).resolve().parents[1]
        src_dir = root / "src"
        if str(src_dir) not in sys.path:
            sys.path.insert(0, str(src_dir))
        select_mod = _load_module("select_mod_non_finite_dimensions", src_dir / "5.select_papers.py")

        out = select_mod.build_scored_papers(
            [{"id": "p-1", "title": "Paper 1", "abstract": "A"}],
            [
                {
                    "paper_id": "p-1",
                    "score": 8.4,
                    "relevance_score": "NaN",
                    "quality_score": "inf",
                    "reliability_score": "-inf",
                    "evidence_cn": "分数非法",
                    "tldr_cn": "非法分数应视为缺失。",
                    "tags": ["query:test"],
                }
            ],
        )

        self.assertEqual(len(out), 1)
        paper = out[0]
        self.assertIsNone(paper["llm_relevance_score"])
        self.assertIsNone(paper["llm_quality_score"])
        self.assertIsNone(paper["llm_reliability_score"])
        self.assertIsNone(paper["llm_practicality_score"])
        self.assertNotIn("assessment:low-practicality", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-reliability", paper.get("llm_tags") or [])
        self.assertNotIn("assessment:low-quality", paper.get("llm_tags") or [])

    def test_resolve_summary_step_env_prefers_workflow_config(self):
        with patch.dict(
            os.environ,
            {
                "BLT_API_KEY": "base-key",
                "SUMMARY_API_KEY": "summary-key",
                "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                "SUMMARY_MODEL": "summary-model",
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "RERANK_ENABLED": "true",
                "RERANK_API_KEY": "rerank-key",
                "RERANK_BASE_URL": "https://rerank.example.com/v1",
                "RERANK_MODEL": "qwen-rerank",
                "DPR_FILTER_CONCURRENCY": "3",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://workflow.example.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "gpt-4.1-mini")
        self.assertEqual(env["DPR_FILTER_CONCURRENCY"], "3")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("RERANK_API_KEY", env)
        self.assertNotIn("RERANK_BASE_URL", env)
        self.assertNotIn("RERANK_MODEL", env)
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("Reranker_LLM_API_KEY", env)
        self.assertNotIn("Reranker_LLM_BASE_URL", env)
        self.assertNotIn("Reranker_LLM_MODEL", env)
        self.assertNotIn("SUMMARY_API_KEY", env)
        self.assertNotIn("SUMMARY_BASE_URL", env)
        self.assertNotIn("SUMMARY_MODEL", env)
        self.assertNotIn("BLT_API_KEY", env)
        self.assertNotIn("BLT_API_BASE", env)
        self.assertNotIn("BLT_SUMMARY_MODEL", env)

    def test_resolve_summary_step_env_uses_summary_fallback(self):
        with patch.dict(
            os.environ,
            {
                "BLT_API_KEY": "base-key",
                "BLT_API_BASE": "https://api.bltcy.ai/v1",
                "SUMMARY_API_KEY": "summary-key",
                "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                "SUMMARY_MODEL": "gpt-4.1-mini",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "summary-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://summary.example.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "gpt-4.1-mini")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("BLT_API_KEY", env)
        self.assertNotIn("BLT_API_BASE", env)
        self.assertNotIn("BLT_PRIMARY_BASE_URL", env)
        self.assertNotIn("LLM_PRIMARY_BASE_URL", env)
        self.assertNotIn("BLT_SUMMARY_MODEL", env)

    def test_resolve_summary_step_env_excludes_local_rerank_fields(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://api.openai.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "gpt-4.1-mini")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("RERANK_MODEL", env)
        self.assertNotIn("RERANK_API_KEY", env)
        self.assertNotIn("RERANK_BASE_URL", env)

    def test_resolve_rerank_step_env_excludes_workflow_credentials_but_keeps_runtime_cache_vars(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "SUMMARY_API_KEY": "summary-key",
                "BLT_API_KEY": "workflow-key",
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
                "HF_ENDPOINT": "https://hf-mirror.example.com",
                "HF_HUB_BASE_URL": "https://hf-mirror.example.com",
                "HF_TOKEN": "hf-secret-token",
                "HF_HOME": "/tmp/hf-cache",
                "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                "PYTHONUNBUFFERED": "1",
                "PATH": "/usr/bin",
                "DPR_RUN_DATE": "20260310",
            },
            clear=True,
        ):
            env = self.mod.resolve_rerank_step_env()

        self.assertEqual(env["RERANK_ENABLED"], "true")
        self.assertEqual(env["RERANK_PROVIDER"], "local")
        self.assertEqual(env["RERANK_MODEL"], "BAAI/bge-reranker-v2-m3")
        self.assertEqual(env["HF_ENDPOINT"], "https://hf-mirror.example.com")
        self.assertEqual(env["HF_HUB_BASE_URL"], "https://hf-mirror.example.com")
        self.assertEqual(env["HF_TOKEN"], "hf-secret-token")
        self.assertEqual(env["HF_HOME"], "/tmp/hf-cache")
        self.assertEqual(env["HUGGINGFACE_HUB_CACHE"], "/tmp/hf-cache")
        self.assertEqual(env["DPR_RUN_DATE"], "20260310")
        self.assertNotIn("WORKFLOW_LLM_API_KEY", env)
        self.assertNotIn("WORKFLOW_LLM_BASE_URL", env)
        self.assertNotIn("SUMMARY_API_KEY", env)
        self.assertNotIn("BLT_API_KEY", env)

    def test_resolve_rerank_step_env_remote_mode_excludes_local_hf_runtime(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_ENABLED": "true",
                "RERANK_API_KEY": "rerank-key",
                "RERANK_BASE_URL": "https://rerank.example.com/v1",
                "RERANK_MODEL": "qwen3-reranker-4b",
                "HF_ENDPOINT": "https://hf-mirror.example.com",
                "HF_HUB_BASE_URL": "https://hf-mirror.example.com",
                "HF_TOKEN": "hf-secret-token",
                "HF_HOME": "/tmp/hf-cache",
                "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                "RERANK_LOCAL_DEVICE": "cuda",
                "PYTHONUNBUFFERED": "1",
                "PATH": "/usr/bin",
                "DPR_RUN_DATE": "20260310",
            },
            clear=True,
        ):
            env = self.mod.resolve_rerank_step_env()

        self.assertEqual(env["RERANK_ENABLED"], "true")
        self.assertEqual(env["RERANK_PROVIDER"], "blt")
        self.assertEqual(env["RERANK_API_KEY"], "rerank-key")
        self.assertEqual(env["RERANK_BASE_URL"], "https://rerank.example.com/v1")
        self.assertEqual(env["RERANK_MODEL"], "qwen3-reranker-4b")
        self.assertEqual(env["DPR_RUN_DATE"], "20260310")
        self.assertNotIn("HF_ENDPOINT", env)
        self.assertNotIn("HF_HUB_BASE_URL", env)
        self.assertNotIn("HF_TOKEN", env)
        self.assertNotIn("HF_HOME", env)
        self.assertNotIn("HUGGINGFACE_HUB_CACHE", env)
        self.assertNotIn("RERANK_LOCAL_DEVICE", env)

    def test_resolve_rerank_step_env_disabled_local_mode_excludes_local_hf_runtime(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_ENABLED": "false",
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
                "HF_ENDPOINT": "https://hf-mirror.example.com",
                "HF_HUB_BASE_URL": "https://hf-mirror.example.com",
                "HF_TOKEN": "hf-secret-token",
                "HF_HOME": "/tmp/hf-cache",
                "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                "RERANK_LOCAL_DEVICE": "cuda",
                "PYTHONUNBUFFERED": "1",
                "PATH": "/usr/bin",
                "DPR_RUN_DATE": "20260310",
            },
            clear=True,
        ):
            env = self.mod.resolve_rerank_step_env()

        self.assertEqual(env["RERANK_ENABLED"], "false")
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("HF_ENDPOINT", env)
        self.assertNotIn("HF_HUB_BASE_URL", env)
        self.assertNotIn("HF_TOKEN", env)
        self.assertNotIn("HF_HOME", env)
        self.assertNotIn("HUGGINGFACE_HUB_CACHE", env)
        self.assertNotIn("RERANK_LOCAL_DEVICE", env)

    def test_resolve_rerank_step_env_invalid_local_model_excludes_local_hf_runtime(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "evil/model",
                "HF_ENDPOINT": "https://hf-mirror.example.com",
                "HF_HUB_BASE_URL": "https://hf-mirror.example.com",
                "HF_TOKEN": "hf-secret-token",
                "HF_HOME": "/tmp/hf-cache",
                "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                "RERANK_LOCAL_DEVICE": "cuda",
                "PYTHONUNBUFFERED": "1",
                "PATH": "/usr/bin",
                "DPR_RUN_DATE": "20260310",
            },
            clear=True,
        ):
            env = self.mod.resolve_rerank_step_env()

        self.assertEqual(env["RERANK_ENABLED"], "false")
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("HF_ENDPOINT", env)
        self.assertNotIn("HF_HUB_BASE_URL", env)
        self.assertNotIn("HF_TOKEN", env)
        self.assertNotIn("HF_HOME", env)
        self.assertNotIn("HUGGINGFACE_HUB_CACHE", env)
        self.assertNotIn("RERANK_LOCAL_DEVICE", env)

    def test_resolve_summary_step_env_limits_to_step4_inputs(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
                "FILTER_MODEL": "filter-model",
                "DPR_FILTER_CONCURRENCY": "3",
                "DPR_FILTER_PROFILE_TAG": "ml",
                "DPR_RUN_DATE": "20260310",
                "RERANK_API_KEY": "rerank-key",
                "RERANK_BASE_URL": "https://rerank.example.com/v1",
                "RERANK_MODEL": "qwen-rerank",
                "RERANK_PROVIDER": "blt",
                "PDFFIGURES2_JAR": "/tmp/pdffigures2.jar",
                "DOCS_DIR": "/tmp/docs",
                "SECRET_TOKEN": "should-not-leak",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://workflow.example.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "workflow-model")
        self.assertEqual(env["FILTER_MODEL"], "filter-model")
        self.assertEqual(env["DPR_FILTER_CONCURRENCY"], "3")
        self.assertEqual(env["DPR_FILTER_PROFILE_TAG"], "ml")
        self.assertEqual(env["DPR_RUN_DATE"], "20260310")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("RERANK_API_KEY", env)
        self.assertNotIn("RERANK_BASE_URL", env)
        self.assertNotIn("RERANK_MODEL", env)
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("Reranker_LLM_API_KEY", env)
        self.assertNotIn("Reranker_LLM_BASE_URL", env)
        self.assertNotIn("Reranker_LLM_MODEL", env)
        self.assertNotIn("SUMMARY_API_KEY", env)
        self.assertNotIn("SUMMARY_BASE_URL", env)
        self.assertNotIn("SUMMARY_MODEL", env)
        self.assertNotIn("BLT_API_KEY", env)
        self.assertNotIn("BLT_API_BASE", env)
        self.assertNotIn("BLT_SUMMARY_MODEL", env)
        self.assertNotIn("PDFFIGURES2_JAR", env)
        self.assertNotIn("DOCS_DIR", env)
        self.assertNotIn("SECRET_TOKEN", env)

    def test_resolve_docs_step_env_limits_to_step6_inputs(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
                "DOCS_DIR": "/tmp/docs",
                "PDFFIGURES2_JAR": "/tmp/pdffigures2.jar",
                "JAVA_HOME": "/tmp/java",
                "DPR_DEBUG_STEP6": "1",
                "DPR_RUN_DATE": "20260310",
                "FILTER_MODEL": "filter-model",
                "SECRET_TOKEN": "should-not-leak",
            },
            clear=True,
        ):
            env = self.mod.resolve_docs_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://workflow.example.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "workflow-model")
        self.assertEqual(env["DOCS_DIR"], "/tmp/docs")
        self.assertEqual(env["PDFFIGURES2_JAR"], "/tmp/pdffigures2.jar")
        self.assertEqual(env["JAVA_HOME"], "/tmp/java")
        self.assertEqual(env["DPR_DEBUG_STEP6"], "1")
        self.assertEqual(env["DPR_RUN_DATE"], "20260310")
        self.assertNotIn("SUMMARY_API_KEY", env)
        self.assertNotIn("SUMMARY_BASE_URL", env)
        self.assertNotIn("SUMMARY_MODEL", env)
        self.assertNotIn("BLT_API_KEY", env)
        self.assertNotIn("BLT_API_BASE", env)
        self.assertNotIn("BLT_SUMMARY_MODEL", env)
        self.assertNotIn("FILTER_MODEL", env)
        self.assertNotIn("SECRET_TOKEN", env)

    def test_resolve_non_llm_step_envs_limit_scope(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
                "REWRITE_MODEL": "rewrite-model",
                "DPR_RUN_DATE": "20260310",
                "DPR_FILTER_PROFILE_TAG": "ml",
                "DPR_PROFILE_TAG": "ml",
                "DPR_FORCE_PAPER_SOURCES": "iclr,neurips",
                "DPR_APPEND_PAPER_SOURCES": "acl",
                "DPR_ENABLE_MULTI_SOURCE_RPC": "true",
                "DPR_MULTI_SOURCE_BM25_RPC": "match_multi_source_papers_bm25_custom",
                "DPR_MULTI_SOURCE_VECTOR_RPC_EXACT": "match_multi_source_papers_exact_custom",
                "DPR_ENABLE_ICLR_BACKEND": "true",
                "DPR_ICLR_URL": "https://supabase.example.com",
                "DPR_ICLR_ANON_KEY": "anon-key",
                "DPR_ICLR_SCHEMA": "public",
                "HF_ENDPOINT": "https://hf-mirror.example.com",
                "HF_HOME": "/tmp/hf-cache",
                "HF_TOKEN": "hf-secret-token",
                "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                "DPR_EMBED_API_TIMEOUT": "60",
                "DPR_DEBUG_HF": "1",
                "GITHUB_ACTIONS": "true",
                "RERANK_API_KEY": "rerank-key",
                "RERANK_BASE_URL": "https://rerank.example.com/v1",
                "RERANK_MODEL": "qwen3-reranker-4b",
                "BLT_API_KEY": "legacy-key",
                "SUMMARY_API_KEY": "summary-key",
                "SECRET_TOKEN": "should-not-leak",
            },
            clear=True,
        ):
            enrich_env = self.mod.resolve_enrich_step_env()
            fetch_env = self.mod.resolve_fetch_step_env()
            bm25_env = self.mod.resolve_bm25_step_env()
            embedding_env = self.mod.resolve_embedding_step_env()
            rrf_env = self.mod.resolve_rrf_step_env()
            select_env = self.mod.resolve_select_step_env()

        self.assertEqual(enrich_env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(enrich_env["WORKFLOW_LLM_BASE_URL"], "https://workflow.example.com/v1")
        self.assertEqual(enrich_env["WORKFLOW_LLM_MODEL"], "workflow-model")
        self.assertEqual(enrich_env["REWRITE_MODEL"], "rewrite-model")
        self.assertNotIn("BLT_API_KEY", enrich_env)
        self.assertNotIn("SUMMARY_API_KEY", enrich_env)
        self.assertNotIn("RERANK_API_KEY", enrich_env)
        self.assertNotIn("HF_TOKEN", enrich_env)
        self.assertNotIn("SECRET_TOKEN", enrich_env)

        self.assertEqual(fetch_env["DPR_RUN_DATE"], "20260310")
        self.assertNotIn("DPR_FILTER_PROFILE_TAG", fetch_env)
        self.assertNotIn("DPR_ENABLE_MULTI_SOURCE_RPC", fetch_env)
        self.assertNotIn("DPR_ICLR_URL", fetch_env)
        self.assertNotIn("WORKFLOW_LLM_API_KEY", fetch_env)
        self.assertNotIn("HF_TOKEN", fetch_env)
        self.assertNotIn("SECRET_TOKEN", fetch_env)

        self.assertEqual(bm25_env["DPR_RUN_DATE"], "20260310")
        self.assertEqual(bm25_env["DPR_FILTER_PROFILE_TAG"], "ml")
        self.assertEqual(bm25_env["DPR_PROFILE_TAG"], "ml")
        self.assertEqual(bm25_env["DPR_FORCE_PAPER_SOURCES"], "iclr,neurips")
        self.assertEqual(bm25_env["DPR_APPEND_PAPER_SOURCES"], "acl")
        self.assertEqual(bm25_env["DPR_ENABLE_MULTI_SOURCE_RPC"], "true")
        self.assertEqual(bm25_env["DPR_MULTI_SOURCE_BM25_RPC"], "match_multi_source_papers_bm25_custom")
        self.assertEqual(bm25_env["DPR_ENABLE_ICLR_BACKEND"], "true")
        self.assertEqual(bm25_env["DPR_ICLR_URL"], "https://supabase.example.com")
        self.assertEqual(bm25_env["DPR_ICLR_ANON_KEY"], "anon-key")
        self.assertNotIn("WORKFLOW_LLM_API_KEY", bm25_env)
        self.assertNotIn("RERANK_API_KEY", bm25_env)
        self.assertNotIn("HF_TOKEN", bm25_env)
        self.assertNotIn("SECRET_TOKEN", bm25_env)

        self.assertEqual(embedding_env["DPR_RUN_DATE"], "20260310")
        self.assertEqual(embedding_env["DPR_FILTER_PROFILE_TAG"], "ml")
        self.assertEqual(embedding_env["DPR_MULTI_SOURCE_VECTOR_RPC_EXACT"], "match_multi_source_papers_exact_custom")
        self.assertEqual(embedding_env["DPR_ENABLE_ICLR_BACKEND"], "true")
        self.assertEqual(embedding_env["DPR_ICLR_URL"], "https://supabase.example.com")
        self.assertEqual(embedding_env["HF_ENDPOINT"], "https://hf-mirror.example.com")
        self.assertEqual(embedding_env["HF_HOME"], "/tmp/hf-cache")
        self.assertEqual(embedding_env["HF_TOKEN"], "hf-secret-token")
        self.assertEqual(embedding_env["HUGGINGFACE_HUB_CACHE"], "/tmp/hf-cache")
        self.assertEqual(embedding_env["DPR_EMBED_API_TIMEOUT"], "60")
        self.assertEqual(embedding_env["DPR_DEBUG_HF"], "1")
        self.assertEqual(embedding_env["GITHUB_ACTIONS"], "true")
        self.assertNotIn("WORKFLOW_LLM_API_KEY", embedding_env)
        self.assertNotIn("RERANK_API_KEY", embedding_env)
        self.assertNotIn("SECRET_TOKEN", embedding_env)

        self.assertEqual(rrf_env, {"DPR_RUN_DATE": "20260310"})
        self.assertEqual(select_env["DPR_RUN_DATE"], "20260310")
        self.assertEqual(select_env["DPR_FILTER_PROFILE_TAG"], "ml")
        self.assertEqual(select_env["DPR_PROFILE_TAG"], "ml")
        self.assertEqual(select_env["DPR_FORCE_PAPER_SOURCES"], "iclr,neurips")
        self.assertEqual(select_env["DPR_APPEND_PAPER_SOURCES"], "acl")
        self.assertNotIn("DPR_ENABLE_MULTI_SOURCE_RPC", select_env)
        self.assertNotIn("DPR_ICLR_URL", select_env)
        self.assertNotIn("WORKFLOW_LLM_API_KEY", select_env)
        self.assertNotIn("HF_TOKEN", select_env)
        self.assertNotIn("SECRET_TOKEN", select_env)

    def test_main_passes_restricted_envs_to_non_llm_steps(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "should_skip_fetch", return_value=False
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py", "--run-enrich"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                    "WORKFLOW_LLM_MODEL": "workflow-model",
                    "REWRITE_MODEL": "rewrite-model",
                    "DPR_FILTER_PROFILE_TAG": "ml",
                    "DPR_FORCE_PAPER_SOURCES": "iclr,neurips",
                    "DPR_APPEND_PAPER_SOURCES": "acl",
                    "DPR_ENABLE_MULTI_SOURCE_RPC": "true",
                    "DPR_MULTI_SOURCE_BM25_RPC": "match_multi_source_papers_bm25_custom",
                    "DPR_MULTI_SOURCE_VECTOR_RPC_EXACT": "match_multi_source_papers_exact_custom",
                    "DPR_ENABLE_ICLR_BACKEND": "true",
                    "DPR_ICLR_URL": "https://supabase.example.com",
                    "DPR_ICLR_ANON_KEY": "anon-key",
                    "HF_ENDPOINT": "https://hf-mirror.example.com",
                    "HF_HOME": "/tmp/hf-cache",
                    "HF_TOKEN": "hf-secret-token",
                    "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                    "DPR_EMBED_API_TIMEOUT": "60",
                    "DPR_DEBUG_HF": "1",
                    "GITHUB_ACTIONS": "true",
                    "RERANK_API_KEY": "rerank-key",
                    "RERANK_BASE_URL": "https://rerank.example.com/v1",
                    "RERANK_MODEL": "qwen3-reranker-4b",
                    "SUMMARY_API_KEY": "summary-key",
                    "DOCS_DIR": "/tmp/docs",
                    "PDFFIGURES2_JAR": "/tmp/pdffigures2.jar",
                    "JAVA_HOME": "/tmp/java",
                    "DPR_DEBUG_STEP6": "1",
                    "SECRET_TOKEN": "should-not-leak",
                },
                clear=True,
            ):
                self.mod.main()

            call_map = {label: (args, env) for label, args, env in calls}

            step0_env = call_map["Step 0 - enrich config"][1]
            self.assertEqual(step0_env["WORKFLOW_LLM_API_KEY"], "workflow-key")
            self.assertEqual(step0_env["REWRITE_MODEL"], "rewrite-model")
            self.assertNotIn("RERANK_API_KEY", step0_env)
            self.assertNotIn("HF_TOKEN", step0_env)
            self.assertNotIn("SECRET_TOKEN", step0_env)

            step1_env = call_map["Step 1 - fetch arxiv"][1]
            self.assertEqual(step1_env, {"DPR_RUN_DATE": token})

            step21_env = call_map["Step 2.1 - BM25"][1]
            self.assertEqual(step21_env["DPR_RUN_DATE"], token)
            self.assertEqual(step21_env["DPR_FILTER_PROFILE_TAG"], "ml")
            self.assertEqual(step21_env["DPR_FORCE_PAPER_SOURCES"], "iclr,neurips")
            self.assertEqual(step21_env["DPR_APPEND_PAPER_SOURCES"], "acl")
            self.assertEqual(step21_env["DPR_MULTI_SOURCE_BM25_RPC"], "match_multi_source_papers_bm25_custom")
            self.assertEqual(step21_env["DPR_ICLR_URL"], "https://supabase.example.com")
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step21_env)
            self.assertNotIn("RERANK_API_KEY", step21_env)
            self.assertNotIn("HF_TOKEN", step21_env)
            self.assertNotIn("SECRET_TOKEN", step21_env)

            step22_env = call_map["Step 2.2 - Embedding"][1]
            self.assertEqual(step22_env["DPR_RUN_DATE"], token)
            self.assertEqual(step22_env["DPR_MULTI_SOURCE_VECTOR_RPC_EXACT"], "match_multi_source_papers_exact_custom")
            self.assertEqual(step22_env["DPR_ICLR_URL"], "https://supabase.example.com")
            self.assertEqual(step22_env["HF_ENDPOINT"], "https://hf-mirror.example.com")
            self.assertEqual(step22_env["HF_HOME"], "/tmp/hf-cache")
            self.assertEqual(step22_env["HF_TOKEN"], "hf-secret-token")
            self.assertEqual(step22_env["DPR_EMBED_API_TIMEOUT"], "60")
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step22_env)
            self.assertNotIn("RERANK_API_KEY", step22_env)
            self.assertNotIn("SECRET_TOKEN", step22_env)

            step23_env = call_map["Step 2.3 - RRF"][1]
            self.assertEqual(step23_env, {"DPR_RUN_DATE": token})

            step5_env = call_map["Step 5 - Select"][1]
            self.assertEqual(step5_env["DPR_RUN_DATE"], token)
            self.assertEqual(step5_env["DPR_FILTER_PROFILE_TAG"], "ml")
            self.assertEqual(step5_env["DPR_FORCE_PAPER_SOURCES"], "iclr,neurips")
            self.assertEqual(step5_env["DPR_APPEND_PAPER_SOURCES"], "acl")
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step5_env)
            self.assertNotIn("RERANK_API_KEY", step5_env)
            self.assertNotIn("HF_TOKEN", step5_env)
            self.assertNotIn("SECRET_TOKEN", step5_env)

            step6_env = call_map["Step 6 - Generate Docs"][1]
            self.assertEqual(step6_env["WORKFLOW_LLM_API_KEY"], "workflow-key")
            self.assertEqual(step6_env["WORKFLOW_LLM_BASE_URL"], "https://workflow.example.com/v1")
            self.assertEqual(step6_env["WORKFLOW_LLM_MODEL"], "workflow-model")
            self.assertEqual(step6_env["DOCS_DIR"], "/tmp/docs")
            self.assertEqual(step6_env["PDFFIGURES2_JAR"], "/tmp/pdffigures2.jar")
            self.assertEqual(step6_env["JAVA_HOME"], "/tmp/java")
            self.assertEqual(step6_env["DPR_DEBUG_STEP6"], "1")
            self.assertEqual(step6_env["DPR_RUN_DATE"], token)
            self.assertNotIn("DPR_FILTER_PROFILE_TAG", step6_env)
            self.assertNotIn("RERANK_API_KEY", step6_env)
            self.assertNotIn("HF_TOKEN", step6_env)
            self.assertNotIn("SECRET_TOKEN", step6_env)

    def test_resolve_summary_step_env_clears_stale_rerank_model_when_local_model_invalid(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "evil/model",
                "Reranker_LLM_MODEL": "stale-reranker",
                "BLT_RERANK_MODEL": "stale-blt-reranker",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "workflow-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://api.openai.com/v1")
        self.assertEqual(env["WORKFLOW_LLM_MODEL"], "gpt-4.1-mini")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("RERANK_PROVIDER", env)
        self.assertNotIn("RERANK_MODEL", env)
        self.assertNotIn("Reranker_LLM_MODEL", env)
        self.assertNotIn("BLT_RERANK_MODEL", env)

    def test_resolve_summary_step_env_uses_legacy_blt_as_last_workflow_fallback(self):
        with patch.dict(
            os.environ,
            {
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://legacy.example.com/v1",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["WORKFLOW_LLM_API_KEY"], "legacy-key")
        self.assertEqual(env["WORKFLOW_LLM_BASE_URL"], "https://legacy.example.com/v1")
        self.assertNotIn("RERANK_ENABLED", env)
        self.assertNotIn("BLT_API_KEY", env)
        self.assertNotIn("BLT_API_BASE", env)

    def test_resolve_summary_step_env_surfaces_missing_workflow_base_url(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ValueError, "workflow LLM base_url"):
                self.mod.resolve_summary_step_env()

    def test_main_skips_rerank_without_explicit_rerank_config_and_builds_fallback(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertNotIn("Step 3 - Rerank", labels)
            self.assertIn("Step 4 - LLM refine", labels)
            step4_call = next(item for item in calls if item[0] == "Step 4 - LLM refine")
            self.assertEqual(step4_call[2]["WORKFLOW_LLM_BASE_URL"], "https://api.openai.com/v1")
            self.assertNotIn("PDFFIGURES2_JAR", step4_call[2])

            step6_call = next(item for item in calls if item[0] == "Step 6 - Generate Docs")
            self.assertEqual(step6_call[2]["WORKFLOW_LLM_BASE_URL"], "https://api.openai.com/v1")
            self.assertNotIn("FILTER_MODEL", step6_call[2])
            self.assertNotIn("DPR_FILTER_CONCURRENCY", step6_call[2])

            rerank_path = root / "archive" / token / "rank" / f"arxiv_papers_{token}.json"
            self.assertTrue(rerank_path.exists())
            data = json.loads(rerank_path.read_text(encoding="utf-8"))
            ranked = data["queries"][0]["ranked"]
            self.assertEqual([item["paper_id"] for item in ranked], ["p1", "p2", "p3"])
            self.assertEqual(ranked[0]["star_rating"], 5)
            self.assertGreaterEqual(ranked[1]["star_rating"], ranked[2]["star_rating"])

    def test_main_keeps_rerank_with_independent_rerank_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "SUMMARY_API_KEY": "summary-key",
                    "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                    "SUMMARY_MODEL": "summary-model",
                    "BLT_API_KEY": "legacy-key",
                    "BLT_API_BASE": "https://legacy.example.com/v1",
                    "BLT_RERANK_MODEL": "legacy-rerank-model",
                    "RERANK_ENABLED": "true",
                    "RERANK_API_KEY": "rerank-key",
                    "RERANK_BASE_URL": "https://rerank.example.com/v1",
                    "RERANK_MODEL": "qwen3-reranker-4b",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            step3_call = next(item for item in calls if item[0] == "Step 3 - Rerank")
            self.assertEqual(step3_call[2]["RERANK_API_KEY"], "rerank-key")
            self.assertEqual(step3_call[2]["RERANK_BASE_URL"], "https://rerank.example.com/v1")
            self.assertEqual(step3_call[2]["RERANK_MODEL"], "qwen3-reranker-4b")
            self.assertEqual(step3_call[2]["RERANK_PROVIDER"], "blt")
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step3_call[2])
            self.assertNotIn("SUMMARY_API_KEY", step3_call[2])
            self.assertNotIn("HF_TOKEN", step3_call[2])
            self.assertNotIn("HF_HOME", step3_call[2])
            self.assertNotIn("HUGGINGFACE_HUB_CACHE", step3_call[2])

    def test_main_keeps_rerank_with_local_provider_config(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "RERANK_PROVIDER": "local",
                    "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
                    "HF_ENDPOINT": "https://hf-mirror.example.com",
                    "HF_HUB_BASE_URL": "https://hf-mirror.example.com",
                    "HF_TOKEN": "hf-secret-token",
                    "HF_HOME": "/tmp/hf-cache",
                    "HUGGINGFACE_HUB_CACHE": "/tmp/hf-cache",
                    "RERANK_LOCAL_DEVICE": "cuda",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            step3_call = next(item for item in calls if item[0] == "Step 3 - Rerank")
            self.assertEqual(step3_call[2]["DPR_RUN_DATE"], token)
            self.assertEqual(step3_call[2]["RERANK_PROVIDER"], "local")
            self.assertEqual(step3_call[2]["RERANK_MODEL"], "BAAI/bge-reranker-v2-m3")
            self.assertEqual(step3_call[2]["HF_ENDPOINT"], "https://hf-mirror.example.com")
            self.assertEqual(step3_call[2]["HF_HUB_BASE_URL"], "https://hf-mirror.example.com")
            self.assertEqual(step3_call[2]["HF_TOKEN"], "hf-secret-token")
            self.assertEqual(step3_call[2]["HF_HOME"], "/tmp/hf-cache")
            self.assertEqual(step3_call[2]["HUGGINGFACE_HUB_CACHE"], "/tmp/hf-cache")
            self.assertEqual(step3_call[2]["RERANK_LOCAL_DEVICE"], "cuda")
            self.assertNotIn("RERANK_API_KEY", step3_call[2])
            self.assertNotIn("RERANK_BASE_URL", step3_call[2])
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step3_call[2])
            self.assertNotIn("SUMMARY_API_KEY", step3_call[2])

    def test_main_defaults_local_rerank_model_when_provider_selected(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "RERANK_PROVIDER": "local",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            step3_call = next(item for item in calls if item[0] == "Step 3 - Rerank")
            self.assertEqual(step3_call[2]["RERANK_PROVIDER"], "local")
            self.assertEqual(step3_call[2]["RERANK_MODEL"], "BAAI/bge-reranker-v2-m3")
            self.assertNotIn("RERANK_API_KEY", step3_call[2])
            self.assertNotIn("RERANK_BASE_URL", step3_call[2])
            self.assertNotIn("WORKFLOW_LLM_API_KEY", step3_call[2])
            self.assertNotIn("SUMMARY_API_KEY", step3_call[2])

    def test_should_skip_rerank_defaults_local_provider_model(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_PROVIDER": "local",
            },
            clear=True,
        ):
            skip, reason = self.mod.should_skip_rerank()

        self.assertFalse(skip)
        self.assertEqual(reason, "local")

    def test_should_skip_rerank_accepts_local_provider(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
            },
            clear=True,
        ):
            skip, reason = self.mod.should_skip_rerank()

        self.assertFalse(skip)
        self.assertEqual(reason, "local")

    def test_should_skip_rerank_accepts_remote_provider(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_ENABLED": "true",
                "RERANK_API_KEY": "rerank-key",
                "RERANK_BASE_URL": "https://rerank.example.com/v1",
                "RERANK_MODEL": "qwen3-reranker-4b",
            },
            clear=True,
        ):
            skip, reason = self.mod.should_skip_rerank()

        self.assertFalse(skip)
        self.assertEqual(reason, "blt")

    def test_should_skip_rerank_disables_when_explicitly_false(self):
        with patch.dict(
            os.environ,
            {
                "RERANK_ENABLED": "false",
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
            },
            clear=True,
        ):
            skip, reason = self.mod.should_skip_rerank()

        self.assertTrue(skip)
        self.assertEqual(reason, "RERANK_ENABLED=false")

    def test_main_falls_back_when_rerank_step_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []
            fallback_calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))
                if label == "Step 3 - Rerank":
                    raise self.mod.subprocess.CalledProcessError(1, args)

            def fake_prepare_rerank_fallback(input_path, output_path):
                fallback_calls.append((input_path, output_path))
                return True

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                self.mod, "prepare_rerank_fallback", side_effect=fake_prepare_rerank_fallback
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "RERANK_ENABLED": "true",
                    "RERANK_API_KEY": "rerank-key",
                    "RERANK_BASE_URL": "https://rerank.example.com/v1",
                    "RERANK_MODEL": "qwen3-reranker-4b",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            self.assertIn("Step 4 - LLM refine", labels)
            self.assertEqual(len(fallback_calls), 1)
            rerank_input, rerank_output = fallback_calls[0]
            self.assertTrue(rerank_input.endswith(f"archive/{token}/filtered/arxiv_papers_{token}.json"))
            self.assertTrue(rerank_output.endswith(f"archive/{token}/rank/arxiv_papers_{token}.json"))

    def test_main_raises_when_rerank_fallback_generation_fails(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))
                if label == "Step 3 - Rerank":
                    raise self.mod.subprocess.CalledProcessError(1, args)

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                self.mod, "prepare_rerank_fallback", return_value=False
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "RERANK_ENABLED": "true",
                    "RERANK_API_KEY": "rerank-key",
                    "RERANK_BASE_URL": "https://rerank.example.com/v1",
                    "RERANK_MODEL": "qwen3-reranker-4b",
                },
                clear=True,
            ):
                with self.assertRaises(RuntimeError) as cm:
                    self.mod.main()

            self.assertIn("fallback 生成失败", str(cm.exception))
            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            self.assertNotIn("Step 4 - LLM refine", labels)

    def test_main_does_not_build_fallback_when_local_rerank_executes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []
            fallback_calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            def fake_prepare_rerank_fallback(input_path, output_path):
                fallback_calls.append((input_path, output_path))
                return True

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                self.mod, "prepare_rerank_fallback", side_effect=fake_prepare_rerank_fallback
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "RERANK_PROVIDER": "local",
                    "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)
            self.assertEqual(fallback_calls, [])

    def test_resolve_summary_step_env_clamps_filter_concurrency(self):
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "DPR_FILTER_CONCURRENCY": "999",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env()

        self.assertEqual(env["DPR_FILTER_CONCURRENCY"], "8")

    def test_resolve_summary_step_env_uses_provided_base_env_for_filter_concurrency(self):
        base_env = {
            "WORKFLOW_LLM_API_KEY": "workflow-key",
            "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
            "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
            "DPR_FILTER_CONCURRENCY": "7",
        }
        with patch.dict(
            os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                "DPR_FILTER_CONCURRENCY": "2",
            },
            clear=True,
        ):
            env = self.mod.resolve_summary_step_env(base_env)

        self.assertEqual(env["DPR_FILTER_CONCURRENCY"], "7")

    def test_main_passes_explicit_filter_concurrency_to_step4(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py", "--filter-concurrency", "3"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                },
                clear=True,
            ):
                self.mod.main()

            step4_call = next(item for item in calls if item[0] == "Step 4 - LLM refine")
            self.assertEqual(step4_call[1][-2:], ["--filter-concurrency", "3"])
            self.assertEqual(step4_call[2]["DPR_FILTER_CONCURRENCY"], "3")

            step6_call = next(item for item in calls if item[0] == "Step 6 - Generate Docs")
            self.assertNotIn("DPR_FILTER_CONCURRENCY", step6_call[2])

    def test_main_clamps_explicit_filter_concurrency_to_safe_max(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py", "--filter-concurrency", "99"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                },
                clear=True,
            ):
                self.mod.main()

            step4_call = next(item for item in calls if item[0] == "Step 4 - LLM refine")
            self.assertEqual(step4_call[1][-2:], ["--filter-concurrency", "8"])
            self.assertEqual(step4_call[2]["DPR_FILTER_CONCURRENCY"], "8")

            step6_call = next(item for item in calls if item[0] == "Step 6 - Generate Docs")
            self.assertNotIn("DPR_FILTER_CONCURRENCY", step6_call[2])

    def test_main_preserves_inherited_filter_concurrency_when_cli_flag_omitted(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "WORKFLOW_LLM_API_KEY": "workflow-key",
                    "WORKFLOW_LLM_BASE_URL": "https://api.openai.com/v1",
                    "WORKFLOW_LLM_MODEL": "gpt-4.1-mini",
                    "DPR_FILTER_CONCURRENCY": "4",
                },
                clear=True,
            ):
                self.mod.main()

            step4_call = next(item for item in calls if item[0] == "Step 4 - LLM refine")
            self.assertNotIn("--filter-concurrency", step4_call[1])
            self.assertEqual(step4_call[2]["DPR_FILTER_CONCURRENCY"], "4")

            step6_call = next(item for item in calls if item[0] == "Step 6 - Generate Docs")
            self.assertNotIn("DPR_FILTER_CONCURRENCY", step6_call[2])

    def test_main_keeps_rerank_in_legacy_blt_mode(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            src_dir = root / "src"
            src_dir.mkdir(parents=True, exist_ok=True)
            token = "20260310"
            self._write_rrf_input(root, token)
            calls = []

            def fake_run_step(label, args, env=None):
                calls.append((label, args, env))

            with patch.object(self.mod, "ROOT_DIR", str(root)), patch.object(
                self.mod, "SRC_DIR", str(src_dir)
            ), patch.object(
                self.mod, "resolve_run_date_token", return_value=token
            ), patch.object(
                self.mod, "resolve_sidebar_date_label", return_value=None
            ), patch.object(
                self.mod, "parse_trace_ids", return_value=[]
            ), patch.object(
                self.mod, "run_step", side_effect=fake_run_step
            ), patch.object(
                sys, "argv", ["main.py"]
            ), patch.dict(
                os.environ,
                {
                    "BLT_API_KEY": "legacy-key",
                    "BLT_API_BASE": "https://api.bltcy.ai/v1",
                },
                clear=True,
            ):
                self.mod.main()

            labels = [item[0] for item in calls]
            self.assertIn("Step 3 - Rerank", labels)


if __name__ == "__main__":
    unittest.main()
