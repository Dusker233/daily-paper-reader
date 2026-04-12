import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

import llm
from llm import LLMClient


class LlmBaseUrlTest(unittest.TestCase):
    def _mock_response(self):
        resp = MagicMock()
        resp.raise_for_status.return_value = None
        resp.json.return_value = {
            "choices": [
                {
                    "message": {
                        "content": "ok",
                    }
                }
            ],
            "usage": {
                "prompt_tokens": 1,
                "completion_tokens": 1,
                "total_tokens": 2,
            },
        }
        return resp

    @patch("llm.requests.post")
    def test_chat_appends_v1_when_base_is_root(self, mock_post):
        mock_post.return_value = self._mock_response()
        client = LLMClient(
            api_key="test-key",
            model="gpt-4.1-mini",
            base_url="https://api.openai.com",
        )

        client.chat([{"role": "user", "content": "hello"}])

        self.assertEqual(
            mock_post.call_args.args[0],
            "https://api.openai.com/v1/chat/completions",
        )

    @patch("llm.requests.post")
    def test_chat_keeps_versioned_base(self, mock_post):
        mock_post.return_value = self._mock_response()
        client = LLMClient(
            api_key="test-key",
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1",
        )

        client.chat([{"role": "user", "content": "hello"}])

        self.assertEqual(
            mock_post.call_args.args[0],
            "https://api.openai.com/v1/chat/completions",
        )

    @patch("llm.requests.post")
    def test_chat_uses_full_endpoint_directly(self, mock_post):
        mock_post.return_value = self._mock_response()
        client = LLMClient(
            api_key="test-key",
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1/chat/completions",
        )

        client.chat([{"role": "user", "content": "hello"}])

        self.assertEqual(
            mock_post.call_args.args[0],
            "https://api.openai.com/v1/chat/completions",
        )

    @patch("llm.requests.post")
    def test_chat_uses_bearer_header_for_generic_openai(self, mock_post):
        mock_post.return_value = self._mock_response()
        client = LLMClient(
            api_key="test-key",
            model="gpt-4.1-mini",
            base_url="https://api.openai.com/v1",
        )

        client.chat([{"role": "user", "content": "hello"}])

        headers = mock_post.call_args.kwargs["headers"]
        self.assertEqual(headers["Authorization"], "Bearer test-key")
        self.assertNotIn("x-api-key", headers)

    @patch("llm.requests.post")
    def test_chat_uses_x_api_key_header_for_minimax(self, mock_post):
        mock_post.return_value = self._mock_response()
        client = LLMClient(
            api_key="test-key",
            model="MiniMax-M2.5",
            base_url="https://api.minimaxi.com/v1",
        )

        client.chat([{"role": "user", "content": "hello"}])

        headers = mock_post.call_args.kwargs["headers"]
        self.assertEqual(headers["x-api-key"], "test-key")
        self.assertNotIn("Authorization", headers)

    def test_resolve_rerank_config_does_not_enable_legacy_mode_for_summary_only(self):
        with patch.dict(
            llm.os.environ,
            {
                "BLT_API_KEY": "legacy-key",
                "SUMMARY_API_KEY": "summary-key",
                "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                "SUMMARY_MODEL": "summary-model",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config(default_model="qwen3-reranker-4b")

        self.assertFalse(cfg["enabled"])
        self.assertFalse(cfg["use_legacy_config"])
        self.assertEqual(cfg["provider"], "none")

    def test_resolve_rerank_config_supports_local_provider_without_api_fields(self):
        with patch.dict(
            llm.os.environ,
            {
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config()

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "local")
        self.assertEqual(cfg["model"], "BAAI/bge-reranker-v2-m3")
        self.assertEqual(cfg["api_key"], "")
        self.assertEqual(cfg["base_url"], "")

    def test_resolve_rerank_config_defaults_local_provider_model(self):
        with patch.dict(
            llm.os.environ,
            {
                "RERANK_PROVIDER": "local",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config()

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "local")
        self.assertEqual(cfg["model"], "BAAI/bge-reranker-v2-m3")

    def test_resolve_rerank_config_rejects_unapproved_local_model(self):
        with patch.dict(
            llm.os.environ,
            {
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "evil/model",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config()

        self.assertFalse(cfg["enabled"])
        self.assertIn("allowed", cfg["reason"])

    def test_client_factory_returns_local_reranker_for_local_provider(self):
        import local_rerank

        fake_client = object()
        with patch.dict(
            llm.os.environ,
            {
                "RERANK_PROVIDER": "local",
                "RERANK_MODEL": "BAAI/bge-reranker-v2-m3",
            },
            clear=True,
        ), patch.object(local_rerank, "LocalRerankClient", return_value=fake_client) as mock_client:
            client = llm.ClientFactory.from_env(scope="rerank")

        self.assertIs(client, fake_client)
        mock_client.assert_called_once_with(model="BAAI/bge-reranker-v2-m3")

    def test_resolve_rerank_config_preserves_remote_blt_compatibility(self):
        with patch.dict(
            llm.os.environ,
            {
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://api.bltcy.ai/v1",
                "BLT_RERANK_MODEL": "qwen3-reranker-4b",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config()

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "blt")
        self.assertTrue(cfg["use_legacy_config"])

    def test_resolve_rerank_config_allows_explicit_blt_provider_with_legacy_env(self):
        with patch.dict(
            llm.os.environ,
            {
                "RERANK_PROVIDER": "blt",
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://api.bltcy.ai/v1",
                "BLT_RERANK_MODEL": "qwen3-reranker-4b",
            },
            clear=True,
        ):
            cfg = llm.resolve_rerank_llm_config()

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "blt")
        self.assertTrue(cfg["use_legacy_config"])

    def test_resolve_workflow_config_prefers_neutral_fields(self):
        with patch.dict(
            llm.os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example.com/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
                "SUMMARY_API_KEY": "summary-key",
                "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                "SUMMARY_MODEL": "summary-model",
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://legacy.example.com/v1",
            },
            clear=True,
        ):
            cfg = llm.resolve_workflow_llm_config()

        self.assertEqual(cfg["api_key"], "workflow-key")
        self.assertEqual(cfg["base_url"], "https://workflow.example.com/v1")
        self.assertEqual(cfg["model"], "workflow-model")

    def test_resolve_workflow_config_falls_back_to_summary_before_legacy_blt(self):
        with patch.dict(
            llm.os.environ,
            {
                "SUMMARY_API_KEY": "summary-key",
                "SUMMARY_BASE_URL": "https://summary.example.com/v1",
                "SUMMARY_MODEL": "summary-model",
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://legacy.example.com/v1",
            },
            clear=True,
        ):
            cfg = llm.resolve_workflow_llm_config()

        self.assertEqual(cfg["api_key"], "summary-key")
        self.assertEqual(cfg["base_url"], "https://summary.example.com/v1")
        self.assertEqual(cfg["model"], "summary-model")

    def test_resolve_workflow_config_uses_legacy_blt_as_last_fallback(self):
        with patch.dict(
            llm.os.environ,
            {
                "BLT_API_KEY": "legacy-key",
                "BLT_API_BASE": "https://legacy.example.com/v1",
            },
            clear=True,
        ):
            cfg = llm.resolve_workflow_llm_config(default_model="fallback-model")

        self.assertEqual(cfg["api_key"], "legacy-key")
        self.assertEqual(cfg["base_url"], "https://legacy.example.com/v1")
        self.assertEqual(cfg["model"], "fallback-model")
        self.assertEqual(cfg["source"], "legacy_blt")

    def test_workflow_client_requires_explicit_base_url(self):
        with patch.dict(
            llm.os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_MODEL": "workflow-model",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ValueError, "workflow LLM base_url"):
                llm.ClientFactory.from_env(scope="workflow")

    def test_default_factory_requires_explicit_workflow_base_url(self):
        with patch.dict(
            llm.os.environ,
            {
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_MODEL": "workflow-model",
            },
            clear=True,
        ):
            with self.assertRaisesRegex(ValueError, "workflow LLM base_url"):
                llm.ClientFactory.from_env()

    def test_rejects_non_https_remote_base_url(self):
        with self.assertRaisesRegex(ValueError, "https://"):
            LLMClient(
                api_key="test-key",
                model="gpt-4.1-mini",
                base_url="http://api.example.com/v1",
            )

    def test_allows_localhost_http_base_url(self):
        client = LLMClient(
            api_key="test-key",
            model="gpt-4.1-mini",
            base_url="http://localhost:11434/v1",
        )
        self.assertEqual(client.base_url, "http://localhost:11434/v1")


if __name__ == "__main__":
    unittest.main()
