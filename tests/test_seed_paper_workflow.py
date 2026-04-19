import os
import pathlib
import subprocess
import unittest

import yaml


class SeedPaperWorkflowConfigTest(unittest.TestCase):
    @staticmethod
    def _extract_source_block(text: str, start_marker: str, end_marker: str, description: str) -> str:
        start = text.find(start_marker)
        if start == -1:
            raise AssertionError(f"Missing {description} start marker: {start_marker}")
        end = text.find(end_marker, start)
        if end == -1:
            raise AssertionError(f"Missing {description} end marker: {end_marker}")
        return text[start:end]

    @classmethod
    def setUpClass(cls):
        cls.root = pathlib.Path(__file__).resolve().parents[1]
        cls.workflow_path = cls.root / ".github" / "workflows" / "seed-paper-related.yml"
        cls.text = cls.workflow_path.read_text(encoding="utf-8")
        cls.workflow = yaml.safe_load(cls.text) or {}
        cls.on_block = cls.workflow.get("on") or cls.workflow.get(True) or {}
        cls.inputs = (((cls.on_block.get("workflow_dispatch") or {}).get("inputs")) or {})
        jobs = cls.workflow.get("jobs") or {}
        cls.run_job = jobs.get("run") or {}
        cls.steps = cls.run_job.get("steps") or []
        cls.llm_text = (cls.root / "src" / "llm.py").read_text(encoding="utf-8")
        runtime_bool_source = cls._extract_source_block(
            cls.llm_text,
            "def _read_env_bool(",
            "\ndef _read_env_config(",
            "runtime rerank bool parser",
        )
        runtime_namespace = {}
        exec("import os\nfrom typing import Optional\n" + runtime_bool_source, runtime_namespace)
        cls.read_env_bool = runtime_namespace["_read_env_bool"]

    def _step_named(self, name: str):
        for step in self.steps:
            if step.get("name") == name:
                return step
        self.fail(f"Missing workflow step: {name}")

    def _extract_rerank_enabled_preamble(self) -> str:
        process_step = self._step_named("Process seed paper request")
        run_script = process_step.get("run") or ""
        return self._extract_source_block(
            run_script,
            "set -euo pipefail\n",
            'if [ "$RERANK_ENABLED_STATE" = "true" ]; then',
            "workflow rerank enabled preamble",
        ).rstrip()

    def _extract_rerank_setup_script(self) -> str:
        process_step = self._step_named("Process seed paper request")
        run_script = process_step.get("run") or ""
        return self._extract_source_block(
            run_script,
            "set -euo pipefail\n",
            'python3 src/seed_paper_processor.py \\\n',
            "workflow rerank setup script",
        ).rstrip()

    def _build_shell_env(self, raw_value, extra_env=None):
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", ""),
            "LANG": os.environ.get("LANG", "C.UTF-8"),
        }
        if raw_value is not None:
            env["RERANK_ENABLED"] = raw_value
        for key, value in (extra_env or {}).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        return env

    def _run_shell_script(self, script: str, raw_value=None, extra_env=None, check=True):
        return subprocess.run(
            ["bash", "-c", script],
            cwd=self.root,
            env=self._build_shell_env(raw_value, extra_env),
            capture_output=True,
            text=True,
            check=check,
        )

    def _run_workflow_rerank_enabled_normalizer(self, raw_value):
        result = self._run_shell_script(
            self._extract_rerank_enabled_preamble() + '\nprintf "%s" "${RERANK_ENABLED_STATE:-}"\n',
            raw_value=raw_value,
        )
        normalized = result.stdout.strip()
        if normalized == "true":
            return True
        if normalized == "false":
            return False
        return None

    def _parse_key_value_output(self, text: str):
        data = {}
        for line in text.splitlines():
            if "=" not in line:
                continue
            key, value = line.split("=", 1)
            data[key] = value
        return data

    def _run_workflow_rerank_setup(self, raw_value, extra_env=None, check=True):
        script = self._extract_rerank_setup_script() + """
printf 'state=%s\n' "${RERANK_ENABLED_STATE:-}"
printf 'rerank_enabled_present=%s\n' "$( [ -n "${RERANK_ENABLED+x}" ] && echo true || echo false )"
printf 'rerank_enabled=%s\n' "${RERANK_ENABLED-}"
printf 'provider=%s\n' "${RERANK_PROVIDER:-}"
printf 'api_key=%s\n' "${RERANK_API_KEY:-}"
printf 'base_url=%s\n' "${RERANK_BASE_URL:-}"
printf 'model=%s\n' "${RERANK_MODEL:-}"
printf 'compat_api_key=%s\n' "${Reranker_LLM_API_KEY:-}"
printf 'compat_base_url=%s\n' "${Reranker_LLM_BASE_URL:-}"
printf 'compat_model=%s\n' "${Reranker_LLM_MODEL:-}"
"""
        result = self._run_shell_script(script, raw_value=raw_value, extra_env=extra_env, check=check)
        if not check:
            return result
        return self._parse_key_value_output(result.stdout)

    def _blt_fallback_env(self):
        return {
            "BLT_API_KEY": "blt-key",
            "BLT_API_BASE": "https://blt.example/v1",
            "BLT_PRIMARY_BASE_URL": "",
            "LLM_PRIMARY_BASE_URL": "",
            "GPTBEST_BASE_URL": "",
            "BLT_RERANK_MODEL": "fallback-model",
            "RERANK_API_KEY": "",
            "RERANK_BASE_URL": "",
            "RERANK_MODEL": "",
            "Reranker_LLM_API_KEY": "",
            "Reranker_LLM_BASE_URL": "",
            "Reranker_LLM_MODEL": "",
        }

    def _dedicated_rerank_env(self):
        return {
            **self._blt_fallback_env(),
            "RERANK_API_KEY": "dedicated-key",
            "RERANK_BASE_URL": "https://dedicated.example/v1",
            "RERANK_MODEL": "dedicated-model",
        }

    def _run_runtime_rerank_enabled_parser(self, raw_value):
        original = os.environ.get("RERANK_ENABLED")
        try:
            if raw_value is None:
                os.environ.pop("RERANK_ENABLED", None)
            else:
                os.environ["RERANK_ENABLED"] = raw_value
            return type(self).read_env_bool("RERANK_ENABLED")
        finally:
            if original is None:
                os.environ.pop("RERANK_ENABLED", None)
            else:
                os.environ["RERANK_ENABLED"] = original

    def test_workflow_dispatch_exposes_seed_request_inputs(self):
        self.assertIn("request_id", self.inputs)
        self.assertIn("request_path", self.inputs)
        self.assertIn("seed_mode", self.inputs)

    def test_run_job_uses_hosted_ubuntu_runner_and_write_permissions(self):
        runs_on = self.run_job.get("runs-on") or ""
        self.assertIn("ubuntu", runs_on)
        self.assertNotIn("self-hosted", runs_on)
        self.assertEqual((self.workflow.get("permissions") or {}).get("contents"), "read")
        self.assertEqual(((self.run_job.get("permissions") or {}).get("contents")), "write")

    def test_workflow_concurrency_is_scoped_per_request(self):
        concurrency = self.workflow.get("concurrency") or {}
        self.assertEqual(concurrency.get("group"), "seed-paper-related-${{ github.event.inputs.request_id }}")
        self.assertFalse(concurrency.get("cancel-in-progress"))

    def test_workflow_validates_request_path_prefix(self):
        validate_step = self._step_named("Validate request inputs")
        run_script = validate_step.get("run") or ""
        self.assertIn('expected_request_path = f"archive/seed-papers/{request_id}/request.json"', run_script)
        self.assertIn('if request_path != expected_request_path:', run_script)
        self.assertIn('Unexpected request path', run_script)

    def test_workflow_validates_seed_pdf_source_path_and_existence(self):
        validate_step = self._step_named("Validate request inputs")
        env = validate_step.get("env") or {}
        run_script = validate_step.get("run") or ""
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertIn('request_payload = json.loads(resolved_request_path.read_text(encoding="utf-8")) or {}', run_script)
        self.assertIn('Invalid request payload JSON', run_script)
        self.assertIn('relative_pdf_path = PurePosixPath(source_path)', run_script)
        self.assertIn('expected_source_prefix = PurePosixPath("archive") / "seed-papers" / request_id', run_script)
        self.assertIn('relative_pdf_path.is_absolute()', run_script)
        self.assertIn('relative_pdf_path.parent != expected_source_prefix', run_script)
        self.assertIn('relative_pdf_path.suffix.lower() != ".pdf"', run_script)
        self.assertIn('request_root.joinpath(*relative_pdf_path.parts).resolve()', run_script)
        self.assertIn('request_root not in resolved_source_path.parents', run_script)
        self.assertIn('Missing seed PDF', run_script)
        self.assertIn('resolved_source_path.stat().st_size > 50 * 1024 * 1024', run_script)
        self.assertIn('Seed PDF too large', run_script)
        self.assertIn('pdf_header = resolved_source_path.read_bytes()[:5]', run_script)
        self.assertIn('Invalid PDF signature', run_script)

    def test_workflow_validation_rejects_parent_segments(self):
        validate_step = self._step_named("Validate request inputs")
        run_script = validate_step.get("run") or ""
        self.assertIn('if any(part in {"", ".", ".."} for part in relative_pdf_path.parts):', run_script)
        self.assertIn('request_root not in resolved_source_path.parents', run_script)
        self.assertNotIn('source_path.startswith(expected_source_path)', run_script)

    def test_workflow_rejects_non_slug_request_id(self):
        self.assertIn('re.fullmatch(r"[a-z0-9][a-z0-9-]*", request_id)', self.text)
        self.assertIn('Unexpected request_id', self.text)

    def test_workflow_checks_out_request_payload_branch_once(self):
        publish_checkout = self._step_named("Checkout publish branch")
        publish_checkout_with = publish_checkout.get("with") or {}

        self.assertEqual(publish_checkout.get("uses"), "actions/checkout@v5")
        self.assertEqual(publish_checkout_with.get("path"), "publish-repo")
        self.assertEqual(publish_checkout_with.get("ref"), "${{ github.event.repository.default_branch }}")
        self.assertNotIn("Checkout request payload branch", [step.get("name") for step in self.steps])

    def test_workflow_installs_and_invokes_seed_paper_processor_from_publish_checkout(self):
        install_step = self._step_named("Install deps (skip sqlite3)")
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}
        run_script = process_step.get("run") or ""

        self.assertEqual(install_step.get("working-directory"), "publish-repo")
        self.assertEqual(process_step.get("working-directory"), "publish-repo")
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertEqual(env.get("PUBLISH_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertIn('python3 src/seed_paper_processor.py', run_script)
        self.assertIn('--request-path "${PUBLISH_ROOT}/${REQUEST_PATH}"', run_script)
        self.assertIn('--request-id "$REQUEST_ID"', run_script)
        self.assertIn('--root-dir "$PUBLISH_ROOT"', run_script)
        self.assertIn('--docs-dir "$PUBLISH_ROOT/docs"', run_script)
        self.assertIn('--seed-mode "$SEED_MODE"', run_script)

    def test_workflow_enables_multi_source_rpc_fallback_for_hosted_seed_processing(self):
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}

        self.assertEqual(env.get("DPR_ENABLE_MULTI_SOURCE_RPC"), "true")
        self.assertEqual(env.get("DPR_MULTI_SOURCE_BM25_RPC"), "match_multi_source_papers_bm25")
        self.assertEqual(env.get("DPR_MULTI_SOURCE_VECTOR_RPC_EXACT"), "match_multi_source_papers_exact")

    def test_workflow_exports_rerank_secret_contract_for_hosted_seed_processing(self):
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}
        run_script = process_step.get("run") or ""

        self.assertEqual(env.get("BLT_API_KEY"), "${{ secrets.BLT_API_KEY }}")
        self.assertEqual(env.get("BLT_PRIMARY_BASE_URL"), "${{ secrets.BLT_PRIMARY_BASE_URL }}")
        self.assertEqual(env.get("BLT_API_BASE"), "${{ secrets.BLT_API_BASE }}")
        self.assertEqual(env.get("LLM_PRIMARY_BASE_URL"), "${{ secrets.LLM_PRIMARY_BASE_URL }}")
        self.assertEqual(env.get("GPTBEST_BASE_URL"), "${{ secrets.GPTBEST_BASE_URL }}")
        self.assertEqual(env.get("BLT_RERANK_MODEL"), "qwen3-reranker-4b")
        self.assertEqual(env.get("RERANK_ENABLED"), "${{ secrets.RERANK_ENABLED }}")
        self.assertEqual(env.get("RERANK_API_KEY"), "${{ secrets.RERANK_API_KEY }}")
        self.assertEqual(env.get("RERANK_BASE_URL"), "${{ secrets.RERANK_BASE_URL }}")
        self.assertEqual(env.get("RERANK_MODEL"), "${{ secrets.RERANK_MODEL }}")
        self.assertIn('RERANK_ENABLED_STATE="$(python3 - <<\'PY\'', run_script)
        self.assertIn('if [ "$RERANK_ENABLED_STATE" = "true" ]; then', run_script)
        self.assertIn('RERANK_ENABLED=true but dedicated rerank secrets are incomplete.', run_script)
        self.assertIn('export RERANK_PROVIDER="blt"', run_script)
        self.assertIn('elif [ "$RERANK_ENABLED_STATE" = "false" ]; then', run_script)
        self.assertIn('RERANK_ENABLED=false but BLT_API_KEY is missing for hosted fallback.', run_script)
        self.assertIn('RUNTIME_BLT_BASE_URL="${BLT_API_BASE:-${BLT_PRIMARY_BASE_URL:-${LLM_PRIMARY_BASE_URL:-${GPTBEST_BASE_URL:-}}}}"', run_script)
        self.assertIn('RERANK_ENABLED=false but BLT base URL is missing for hosted fallback.', run_script)
        self.assertIn('export RERANK_API_KEY="$BLT_API_KEY"', run_script)
        self.assertIn('export RERANK_BASE_URL="$RUNTIME_BLT_BASE_URL"', run_script)
        self.assertIn('export RERANK_MODEL="${BLT_RERANK_MODEL:-qwen3-reranker-4b}"', run_script)
        self.assertIn('export Reranker_LLM_API_KEY="$RERANK_API_KEY"', run_script)
        self.assertIn('export Reranker_LLM_BASE_URL="$RERANK_BASE_URL"', run_script)
        self.assertIn('export Reranker_LLM_MODEL="$RERANK_MODEL"', run_script)
        self.assertIn('unset RERANK_ENABLED', run_script)
        self.assertIn('elif [ -n "${RERANK_API_KEY:-}" ] || [ -n "${RERANK_BASE_URL:-}" ] || [ -n "${RERANK_MODEL:-}" ]; then', run_script)
        self.assertIn('Dedicated rerank secrets are incomplete for hosted seed workflow.', run_script)
        self.assertIn('Missing RERANK_ENABLED secret and BLT_API_KEY for hosted seed workflow.', run_script)
        self.assertIn('Missing RERANK_ENABLED secret and BLT base URL for hosted seed workflow.', run_script)
        self.assertNotIn('seed rerank provider=', run_script)
        self.assertNotIn('seed rerank model=', run_script)
        self.assertNotIn('seed rerank api key present=', run_script)
        self.assertNotIn('seed rerank base url present=', run_script)

    def test_workflow_matches_llm_runtime_bool_contract_for_rerank_enabled(self):
        for raw_value in (
            None,
            "",
            "1",
            "true",
            "TRUE",
            " yes ",
            "On",
            "0",
            "false",
            "FALSE",
            " no ",
            "off",
            "maybe",
            "enabled",
        ):
            with self.subTest(raw_value=raw_value):
                self.assertEqual(
                    self._run_workflow_rerank_enabled_normalizer(raw_value),
                    self._run_runtime_rerank_enabled_parser(raw_value),
                )

    def test_workflow_false_variants_force_blt_fallback_and_unset_rerank_enabled(self):
        for raw_value in ("0", "false", "FALSE", " no ", "off"):
            with self.subTest(raw_value=raw_value):
                result = self._run_workflow_rerank_setup(raw_value, self._blt_fallback_env())
                self.assertEqual(result["state"], "false")
                self.assertEqual(result["provider"], "blt")
                self.assertEqual(result["api_key"], "blt-key")
                self.assertEqual(result["base_url"], "https://blt.example/v1")
                self.assertEqual(result["model"], "fallback-model")
                self.assertEqual(result["compat_api_key"], "blt-key")
                self.assertEqual(result["compat_base_url"], "https://blt.example/v1")
                self.assertEqual(result["compat_model"], "fallback-model")
                self.assertEqual(result["rerank_enabled_present"], "false")
                self.assertEqual(result["rerank_enabled"], "")

    def test_workflow_true_variants_keep_dedicated_rerank_contract(self):
        for raw_value in ("1", "true", "TRUE", " yes ", "On"):
            with self.subTest(raw_value=raw_value):
                result = self._run_workflow_rerank_setup(raw_value, self._dedicated_rerank_env())
                self.assertEqual(result["state"], "true")
                self.assertEqual(result["provider"], "blt")
                self.assertEqual(result["api_key"], "dedicated-key")
                self.assertEqual(result["base_url"], "https://dedicated.example/v1")
                self.assertEqual(result["model"], "dedicated-model")
                self.assertEqual(result["compat_api_key"], "")
                self.assertEqual(result["compat_base_url"], "")
                self.assertEqual(result["compat_model"], "")
                self.assertEqual(result["rerank_enabled_present"], "true")
                self.assertEqual(result["rerank_enabled"], raw_value)

    def test_workflow_invalid_rerank_enabled_uses_dedicated_contract_when_complete(self):
        result = self._run_workflow_rerank_setup("maybe", self._dedicated_rerank_env())
        self.assertEqual(result["state"], "")
        self.assertEqual(result["provider"], "blt")
        self.assertEqual(result["api_key"], "dedicated-key")
        self.assertEqual(result["base_url"], "https://dedicated.example/v1")
        self.assertEqual(result["model"], "dedicated-model")
        self.assertEqual(result["rerank_enabled_present"], "true")
        self.assertEqual(result["rerank_enabled"], "maybe")

    def test_workflow_missing_rerank_enabled_uses_blt_fallback_when_dedicated_secrets_are_absent(self):
        result = self._run_workflow_rerank_setup(None, self._blt_fallback_env())
        self.assertEqual(result["state"], "")
        self.assertEqual(result["provider"], "blt")
        self.assertEqual(result["api_key"], "blt-key")
        self.assertEqual(result["base_url"], "https://blt.example/v1")
        self.assertEqual(result["model"], "fallback-model")
        self.assertEqual(result["compat_api_key"], "blt-key")
        self.assertEqual(result["compat_base_url"], "https://blt.example/v1")
        self.assertEqual(result["compat_model"], "fallback-model")
        self.assertEqual(result["rerank_enabled_present"], "false")
        self.assertEqual(result["rerank_enabled"], "")

    def test_workflow_invalid_rerank_enabled_still_rejects_incomplete_dedicated_secrets(self):
        incomplete_env = {
            **self._blt_fallback_env(),
            "RERANK_API_KEY": "dedicated-key",
            "RERANK_BASE_URL": "",
            "RERANK_MODEL": "dedicated-model",
        }
        result = self._run_workflow_rerank_setup("maybe", incomplete_env, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Dedicated rerank secrets are incomplete for hosted seed workflow.", result.stderr)

    def test_workflow_true_variants_reject_incomplete_dedicated_secrets(self):
        incomplete_env = {
            **self._blt_fallback_env(),
            "RERANK_API_KEY": "dedicated-key",
            "RERANK_BASE_URL": "",
            "RERANK_MODEL": "dedicated-model",
        }
        for raw_value in ("1", "true", "TRUE", " yes ", "On"):
            with self.subTest(raw_value=raw_value):
                result = self._run_workflow_rerank_setup(raw_value, incomplete_env, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("RERANK_ENABLED=true but dedicated rerank secrets are incomplete.", result.stderr)

    def test_workflow_false_variants_reject_missing_blt_api_key(self):
        missing_key_env = {
            **self._blt_fallback_env(),
            "BLT_API_KEY": "",
        }
        for raw_value in ("0", "false", "FALSE", " no ", "off"):
            with self.subTest(raw_value=raw_value):
                result = self._run_workflow_rerank_setup(raw_value, missing_key_env, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("RERANK_ENABLED=false but BLT_API_KEY is missing for hosted fallback.", result.stderr)

    def test_workflow_false_variants_reject_missing_blt_base_url(self):
        missing_base_env = {
            **self._blt_fallback_env(),
            "BLT_API_BASE": "",
            "BLT_PRIMARY_BASE_URL": "",
            "LLM_PRIMARY_BASE_URL": "",
            "GPTBEST_BASE_URL": "",
        }
        for raw_value in ("0", "false", "FALSE", " no ", "off"):
            with self.subTest(raw_value=raw_value):
                result = self._run_workflow_rerank_setup(raw_value, missing_base_env, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("RERANK_ENABLED=false but BLT base URL is missing for hosted fallback.", result.stderr)

    def test_workflow_missing_rerank_enabled_rejects_absent_blt_fallback(self):
        missing_blt_env = {
            **self._blt_fallback_env(),
            "BLT_API_KEY": "",
        }
        result = self._run_workflow_rerank_setup(None, missing_blt_env, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Missing RERANK_ENABLED secret and BLT_API_KEY for hosted seed workflow.", result.stderr)

    def test_workflow_fallback_base_url_prefers_blt_api_base(self):
        prioritized_env = {
            **self._blt_fallback_env(),
            "BLT_API_BASE": "https://api-base.example/v1",
            "BLT_PRIMARY_BASE_URL": "https://primary.example/v1",
            "LLM_PRIMARY_BASE_URL": "https://llm.example/v1",
            "GPTBEST_BASE_URL": "https://gptbest.example/v1",
        }
        result = self._run_workflow_rerank_setup(None, prioritized_env)
        self.assertEqual(result["base_url"], "https://api-base.example/v1")
        self.assertEqual(result["compat_base_url"], "https://api-base.example/v1")

    def test_workflow_validates_generated_seed_docs_before_commit(self):
        validate_step = self._step_named("Validate generated seed docs")
        env = validate_step.get("env") or {}
        run_script = validate_step.get("run") or ""

        self.assertEqual(validate_step.get("working-directory"), "publish-repo")
        self.assertEqual(env.get("REQUEST_ID"), "${{ github.event.inputs.request_id }}")
        self.assertIn('WORKSPACE_DIR="docs/seed-papers/${REQUEST_ID}"', run_script)
        self.assertIn('test -f "${WORKSPACE_DIR}/index.md"', run_script)
        self.assertIn('test -f "${WORKSPACE_DIR}/seed-paper.md"', run_script)
        self.assertIn('test -f "docs/README.md"', run_script)
        self.assertIn('test -f "docs/_sidebar.md"', run_script)
        self.assertIn('related_pages=("${WORKSPACE_DIR}/related/"*.md)', run_script)
        self.assertIn('if [ "${#related_pages[@]}" -lt 1 ]; then', run_script)
        self.assertIn('Seed workflow produced no related pages.', run_script)
        self.assertIn('grep -q "seed-paper.md" "${WORKSPACE_DIR}/index.md"', run_script)
        self.assertIn('grep -q "related/" "${WORKSPACE_DIR}/index.md"', run_script)
        self.assertIn('grep -q "/seed-papers/${REQUEST_ID}/index" "docs/README.md"', run_script)
        self.assertIn('grep -q "#/seed-papers/${REQUEST_ID}/index" "docs/_sidebar.md"', run_script)

    def test_workflow_inspect_step_rejects_malformed_request_json(self):
        inspect_step = self._step_named("Inspect request payload")
        run_script = inspect_step.get("run") or ""
        self.assertIn('json.loads(request_path.read_text(encoding="utf-8"))', run_script)
        self.assertIn('Invalid request payload JSON', run_script)

    def test_workflow_commits_docs_from_publish_checkout(self):
        commit_step = self._step_named("Commit generated seed docs")
        env = commit_step.get("env") or {}
        run_script = commit_step.get("run") or ""

        self.assertEqual(commit_step.get("working-directory"), "publish-repo")
        self.assertEqual(env.get("PUBLISH_BRANCH"), "${{ github.event.repository.default_branch }}")
        self.assertNotIn('Backend processing will be added next.', self.text)
        self.assertIn('git add "docs/seed-papers/${REQUEST_ID}" "docs/README.md" "docs/_sidebar.md"', run_script)
        self.assertIn('git push origin HEAD:"${PUBLISH_BRANCH}"', run_script)


if __name__ == "__main__":
    unittest.main()
