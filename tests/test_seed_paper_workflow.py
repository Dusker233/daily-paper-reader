import json
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

        cls.publish_workflow_path = cls.root / ".github" / "workflows" / "seed-paper-publish.yml"
        cls.publish_text = cls.publish_workflow_path.read_text(encoding="utf-8")
        cls.publish_workflow = yaml.safe_load(cls.publish_text) or {}
        cls.publish_on_block = cls.publish_workflow.get("on") or cls.publish_workflow.get(True) or {}
        publish_jobs = cls.publish_workflow.get("jobs") or {}
        cls.publish_job = publish_jobs.get("publish") or {}
        cls.publish_steps = cls.publish_job.get("steps") or []

        cls.llm_text = (cls.root / "src" / "llm.py").read_text(encoding="utf-8")

    def _step_named(self, name: str):
        for step in self.steps:
            if step.get("name") == name:
                return step
        self.fail(f"Missing workflow step: {name}")

    def _publish_step_named(self, name: str):
        for step in self.publish_steps:
            if step.get("name") == name:
                return step
        self.fail(f"Missing publish workflow step: {name}")

    def _build_shell_env(self, extra_env=None):
        env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.environ.get("HOME", ""),
            "LANG": os.environ.get("LANG", "C.UTF-8"),
        }
        for key, value in (extra_env or {}).items():
            if value is None:
                env.pop(key, None)
            else:
                env[key] = value
        return env

    def _run_python_env_check(self, code: str, extra_env=None, check=True):
        return subprocess.run(
            ["python3", "-c", code],
            cwd=self.root,
            env=self._build_shell_env(extra_env),
            capture_output=True,
            text=True,
            check=check,
        )

    def _run_runtime_rerank_config(self, extra_env=None):
        result = self._run_python_env_check(
            """
import json
from src.llm import resolve_rerank_llm_config
print(json.dumps(resolve_rerank_llm_config(default_model='qwen3-reranker-4b'), ensure_ascii=False, sort_keys=True))
""".strip(),
            extra_env=extra_env,
        )
        return json.loads(result.stdout)

    def _run_shell_script(self, script: str, extra_env=None, check=True):
        return subprocess.run(
            ["bash", "-lc", script],
            cwd=self.root,
            env=self._build_shell_env(extra_env),
            capture_output=True,
            text=True,
            check=check,
        )

    def _extract_rerank_preflight(self) -> str:
        process_step = self._step_named("Process seed paper request")
        run_script = process_step.get("run") or ""
        return self._extract_source_block(
            run_script,
            'python3 - <<\'PY\'',
            'python3 "${WORKFLOW_ROOT}/src/seed_paper_processor.py"',
            "rerank preflight block",
        ).strip()

    def test_workflow_dispatch_exposes_seed_request_inputs(self):
        self.assertIn("request_id", self.inputs)
        self.assertIn("request_path", self.inputs)
        self.assertIn("seed_mode", self.inputs)

    def test_run_job_uses_hosted_ubuntu_runner_and_read_only_permissions(self):
        runs_on = self.run_job.get("runs-on") or ""
        self.assertIn("ubuntu", runs_on)
        self.assertNotIn("self-hosted", runs_on)
        self.assertEqual((self.workflow.get("permissions") or {}).get("contents"), "read")
        self.assertEqual(((self.run_job.get("permissions") or {}).get("contents")), "read")
        self.assertEqual(((self.run_job.get("permissions") or {}).get("actions")), "read")

    def test_workflow_concurrency_is_scoped_per_request(self):
        concurrency = self.workflow.get("concurrency") or {}
        self.assertEqual(concurrency.get("group"), "seed-paper-related-${{ github.event.inputs.request_id }}")
        self.assertFalse(concurrency.get("cancel-in-progress"))

    def test_publish_workflow_serializes_default_branch_writes(self):
        concurrency = self.publish_workflow.get("concurrency") or {}
        self.assertEqual(concurrency.get("group"), "seed-paper-publish-${{ github.event.repository.default_branch }}")
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

    def test_workflow_uses_default_branch_only_dual_checkout_topology(self):
        workflow_checkout = self._step_named("Checkout workflow ref")
        workflow_checkout_with = workflow_checkout.get("with") or {}
        publish_checkout = self._step_named("Checkout publish branch")
        publish_checkout_with = publish_checkout.get("with") or {}

        self.assertEqual(self.run_job.get("if"), "${{ github.ref_name == github.event.repository.default_branch }}")
        self.assertEqual(workflow_checkout.get("uses"), "actions/checkout@v5")
        self.assertEqual(workflow_checkout_with.get("path"), "workflow-repo")
        self.assertEqual(workflow_checkout_with.get("ref"), "${{ github.sha }}")
        self.assertEqual(workflow_checkout_with.get("persist-credentials"), False)
        self.assertEqual(publish_checkout.get("uses"), "actions/checkout@v5")
        self.assertEqual(publish_checkout_with.get("path"), "publish-repo")
        self.assertEqual(publish_checkout_with.get("ref"), "${{ github.sha }}")
        self.assertEqual(publish_checkout_with.get("persist-credentials"), False)
        self.assertNotIn("Checkout request payload branch", [step.get("name") for step in self.steps])

    def test_workflow_installs_processor_deps_from_workflow_checkout_and_reads_payload_from_publish_checkout(self):
        install_step = self._step_named("Install deps (skip sqlite3)")
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}
        run_script = process_step.get("run") or ""

        self.assertEqual(install_step.get("working-directory"), "workflow-repo")
        self.assertEqual(process_step.get("working-directory"), "workflow-repo")
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertEqual(env.get("PUBLISH_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertEqual(env.get("WORKFLOW_ROOT"), "${{ github.workspace }}/workflow-repo")
        self.assertEqual(env.get("ARTIFACT_ROOT"), "${{ runner.temp }}/trusted-seed-publish")
        self.assertIn('python3 "${WORKFLOW_ROOT}/src/seed_paper_processor.py"', run_script)
        self.assertIn('--request-path "${PUBLISH_ROOT}/${REQUEST_PATH}"', run_script)
        self.assertIn('--request-id "$REQUEST_ID"', run_script)
        self.assertIn('--root-dir "$PUBLISH_ROOT"', run_script)
        self.assertIn('--docs-dir "${ARTIFACT_ROOT}/docs"', run_script)
        self.assertIn('--seed-mode "$SEED_MODE"', run_script)

    def test_workflow_injects_workflow_llm_env_vars_for_explicit_semantics(self):
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}

        # WORKFLOW_LLM_* must be explicitly injected so that Python runtime
        # picks them up with "workflow" source semantics (not SUMMARY_* fallback).
        self.assertEqual(env.get("WORKFLOW_LLM_API_KEY"), "${{ secrets.WORKFLOW_LLM_API_KEY }}")
        self.assertEqual(env.get("WORKFLOW_LLM_BASE_URL"), "${{ secrets.WORKFLOW_LLM_BASE_URL }}")
        self.assertEqual(env.get("WORKFLOW_LLM_MODEL"), "${{ secrets.WORKFLOW_LLM_MODEL }}")
        # SUMMARY_* remain as fallback for cases where WORKFLOW_LLM_* secrets
        # are not configured in the repo secrets.
        self.assertEqual(env.get("SUMMARY_API_KEY"), "${{ secrets.SUMMARY_API_KEY }}")
        self.assertEqual(env.get("SUMMARY_BASE_URL"), "${{ secrets.SUMMARY_BASE_URL }}")
        self.assertEqual(env.get("SUMMARY_MODEL"), "${{ secrets.SUMMARY_MODEL }}")

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
        self.assertIn("truthy_values = {\"1\", \"true\", \"yes\", \"on\"}", run_script)
        self.assertIn("falsey_values = {\"0\", \"false\", \"no\", \"off\"}", run_script)
        self.assertIn('raise SystemExit("Unsupported RERANK_ENABLED value for hosted seed workflow.")', run_script)
        self.assertIn('for name in ("RERANK_API_KEY", "RERANK_BASE_URL", "RERANK_MODEL")', run_script)
        self.assertIn('has_any_dedicated = any(dedicated)', run_script)
        self.assertIn('has_complete_dedicated = all(dedicated)', run_script)
        self.assertIn('raise SystemExit("Dedicated rerank secrets are incomplete for hosted seed workflow.")', run_script)
        self.assertNotIn('export RERANK_PROVIDER="blt"', run_script)
        self.assertNotIn('export RERANK_API_KEY="$BLT_API_KEY"', run_script)
        self.assertNotIn('export RERANK_BASE_URL="$RUNTIME_BLT_BASE_URL"', run_script)
        self.assertNotIn('export RERANK_MODEL="${BLT_RERANK_MODEL:-qwen3-reranker-4b}"', run_script)
        self.assertNotIn('export Reranker_LLM_API_KEY="$RERANK_API_KEY"', run_script)
        self.assertNotIn('export Reranker_LLM_BASE_URL="$RERANK_BASE_URL"', run_script)
        self.assertNotIn('export Reranker_LLM_MODEL="$RERANK_MODEL"', run_script)
        self.assertNotIn('unset RERANK_ENABLED', run_script)

    def test_runtime_disables_rerank_when_rerank_enabled_false_even_if_blt_env_exists(self):
        cfg = self._run_runtime_rerank_config(
            {
                "RERANK_ENABLED": "false",
                "BLT_API_KEY": "blt-key",
                "BLT_API_BASE": "https://blt.example/v1",
                "BLT_PRIMARY_BASE_URL": "https://primary.example/v1",
                "LLM_PRIMARY_BASE_URL": "https://llm.example/v1",
                "GPTBEST_BASE_URL": "https://gptbest.example/v1",
                "BLT_RERANK_MODEL": "fallback-model",
                "RERANK_API_KEY": "",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
                "Reranker_LLM_API_KEY": "",
                "Reranker_LLM_BASE_URL": "",
                "Reranker_LLM_MODEL": "",
            }
        )

        self.assertFalse(cfg["enabled"])
        self.assertEqual(cfg["reason"], "RERANK_ENABLED=false")
        self.assertEqual(cfg["provider"], "blt")

    def test_workflow_preflight_accepts_truthy_rerank_enabled_values_when_dedicated_contract_is_complete(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "yes",
                "RERANK_API_KEY": "dedicated-key",
                "RERANK_BASE_URL": "https://dedicated.example/v1",
                "RERANK_MODEL": "dedicated-model",
            },
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)

    def test_workflow_preflight_treats_whitespace_dedicated_values_as_missing(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "true",
                "RERANK_API_KEY": "   ",
                "RERANK_BASE_URL": "https://dedicated.example/v1",
                "RERANK_MODEL": "dedicated-model",
            },
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Dedicated rerank secrets are incomplete for hosted seed workflow.", result.stderr)

    def test_workflow_preflight_fails_when_truthy_rerank_enabled_has_incomplete_dedicated_contract(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "on",
                "RERANK_API_KEY": "dedicated-key",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "dedicated-model",
            },
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Dedicated rerank secrets are incomplete for hosted seed workflow.", result.stderr)

    def test_workflow_preflight_fails_when_partial_dedicated_secret_is_present_without_enabled_flag(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "",
                "RERANK_API_KEY": "dedicated-key",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
            },
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Dedicated rerank secrets are incomplete for hosted seed workflow.", result.stderr)

    def test_workflow_preflight_rejects_invalid_rerank_enabled_values(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "maybe",
                "RERANK_API_KEY": "",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
            },
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Unsupported RERANK_ENABLED value for hosted seed workflow.", result.stderr)

    def test_workflow_preflight_allows_empty_dedicated_rerank_contract_when_not_enabled(self):
        result = self._run_shell_script(
            self._extract_rerank_preflight(),
            {
                "RERANK_ENABLED": "",
                "RERANK_API_KEY": "",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
            },
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)

    def test_runtime_keeps_dedicated_rerank_contract_when_complete(self):
        cfg = self._run_runtime_rerank_config(
            {
                "RERANK_ENABLED": "true",
                "RERANK_API_KEY": "dedicated-key",
                "RERANK_BASE_URL": "https://dedicated.example/v1",
                "RERANK_MODEL": "dedicated-model",
                "BLT_API_KEY": "blt-key",
                "BLT_API_BASE": "https://blt.example/v1",
            }
        )

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "blt")
        self.assertEqual(cfg["api_key"], "dedicated-key")
        self.assertEqual(cfg["base_url"], "https://dedicated.example/v1")
        self.assertEqual(cfg["model"], "dedicated-model")
        self.assertFalse(cfg["use_legacy_config"])

    def test_runtime_uses_legacy_blt_rerank_config_only_without_workflow_or_summary_fields(self):
        cfg = self._run_runtime_rerank_config(
            {
                "BLT_API_KEY": "blt-key",
                "BLT_PRIMARY_BASE_URL": "https://primary.example/v1",
                "BLT_API_BASE": "https://api-base.example/v1",
                "BLT_RERANK_MODEL": "fallback-model",
                "RERANK_API_KEY": "",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
                "WORKFLOW_LLM_API_KEY": "",
                "WORKFLOW_LLM_BASE_URL": "",
                "WORKFLOW_LLM_MODEL": "",
                "SUMMARY_API_KEY": "",
                "SUMMARY_BASE_URL": "",
                "SUMMARY_MODEL": "",
            }
        )

        self.assertTrue(cfg["enabled"])
        self.assertEqual(cfg["provider"], "blt")
        self.assertEqual(cfg["api_key"], "blt-key")
        self.assertEqual(cfg["base_url"], "https://api-base.example/v1")
        self.assertEqual(cfg["model"], "fallback-model")
        self.assertTrue(cfg["use_legacy_config"])

    def test_runtime_does_not_infer_rerank_from_workflow_config_when_dedicated_rerank_is_absent(self):
        cfg = self._run_runtime_rerank_config(
            {
                "BLT_API_KEY": "blt-key",
                "BLT_PRIMARY_BASE_URL": "https://primary.example/v1",
                "BLT_API_BASE": "https://api-base.example/v1",
                "BLT_RERANK_MODEL": "fallback-model",
                "WORKFLOW_LLM_API_KEY": "workflow-key",
                "WORKFLOW_LLM_BASE_URL": "https://workflow.example/v1",
                "WORKFLOW_LLM_MODEL": "workflow-model",
                "RERANK_API_KEY": "",
                "RERANK_BASE_URL": "",
                "RERANK_MODEL": "",
            }
        )

        self.assertFalse(cfg["enabled"])
        self.assertEqual(cfg["provider"], "none")
        self.assertEqual(cfg["reason"], "缺少 rerank 配置: api_key, base_url")
        self.assertFalse(cfg["use_legacy_config"])

    def test_workflow_validates_generated_seed_docs_before_packaging(self):
        validate_step = self._step_named("Validate generated seed docs")
        env = validate_step.get("env") or {}
        run_script = validate_step.get("run") or ""

        self.assertEqual(env.get("REQUEST_ID"), "${{ github.event.inputs.request_id }}")
        self.assertEqual(env.get("ARTIFACT_ROOT"), "${{ runner.temp }}/trusted-seed-publish")
        self.assertIn('WORKSPACE_DIR="${ARTIFACT_ROOT}/docs/seed-papers/${REQUEST_ID}"', run_script)
        self.assertIn('test -f "${WORKSPACE_DIR}/index.md"', run_script)
        self.assertIn('test -f "${WORKSPACE_DIR}/seed-paper.md"', run_script)
        self.assertIn('related_pages=("${WORKSPACE_DIR}/related/"*.md)', run_script)
        self.assertIn('if [ "${#related_pages[@]}" -lt 1 ]; then', run_script)
        self.assertIn('Seed workflow produced no related pages.', run_script)
        self.assertIn('grep -q "seed-paper.md" "${WORKSPACE_DIR}/index.md"', run_script)
        self.assertIn('grep -q "related/" "${WORKSPACE_DIR}/index.md"', run_script)

    def test_workflow_inspect_step_rejects_malformed_request_json(self):
        inspect_step = self._step_named("Inspect request payload")
        run_script = inspect_step.get("run") or ""
        self.assertIn('json.loads(request_path.read_text(encoding="utf-8"))', run_script)
        self.assertIn('Invalid request payload JSON', run_script)

    def test_workflow_packages_trusted_publish_artifact(self):
        prepare_step = self._step_named("Prepare trusted publish artifact")
        env = prepare_step.get("env") or {}
        run_script = prepare_step.get("run") or ""

        self.assertEqual(env.get("REQUEST_ID"), "${{ github.event.inputs.request_id }}")
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertEqual(env.get("ARTIFACT_ROOT"), "${{ runner.temp }}/trusted-seed-publish")
        self.assertIn('request_root = Path(os.environ["REQUEST_ROOT"]).resolve()', run_script)
        self.assertIn('request_relative_path = PurePosixPath("archive") / "seed-papers" / request_id / "request.json"', run_script)
        self.assertIn('Missing archived request for artifact packaging', run_script)
        self.assertIn('request_payload = json.loads(request_bytes.decode("utf-8")) or {}', run_script)
        self.assertIn('Invalid archived request for artifact packaging', run_script)
        self.assertIn('source_relative_path = PurePosixPath(str(request_payload.get("source_path") or "").strip())', run_script)
        self.assertIn('Unexpected archived source_path for artifact packaging', run_script)
        self.assertIn('Missing archived source PDF for artifact packaging', run_script)
        self.assertIn('docs_root = artifact_root / "docs"', run_script)
        self.assertIn('workspace_dir = docs_root / "seed-papers" / request_id', run_script)
        self.assertIn('Missing docs workspace for artifact packaging', run_script)
        self.assertIn('for txt_path in workspace_dir.rglob("*.txt"):', run_script)
        self.assertIn('for stray_path in (docs_root / "README.md", docs_root / "_sidebar.md"):', run_script)
        self.assertIn('doc_hashes = {}', run_script)
        self.assertIn('for doc_path in sorted(workspace_dir.rglob("*.md")):', run_script)
        self.assertIn('relative_doc_path = doc_path.relative_to(artifact_root).as_posix()', run_script)
        self.assertIn('doc_hashes[relative_doc_path] = hashlib.sha256(doc_path.read_bytes()).hexdigest()', run_script)
        self.assertIn('manifest_path = artifact_root / "manifest.json"', run_script)
        self.assertIn('"request_id": request_id', run_script)
        self.assertIn('"request_path": request_relative_path.as_posix()', run_script)
        self.assertIn('"request_sha256": hashlib.sha256(request_bytes).hexdigest()', run_script)
        self.assertIn('"source_path": source_relative_path.as_posix()', run_script)
        self.assertIn('"source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest()', run_script)
        self.assertIn('"docs_workspace": f"docs/seed-papers/{request_id}"', run_script)
        self.assertIn('"doc_hashes": doc_hashes', run_script)
        self.assertNotIn('"readme_path": "docs/README.md"', run_script)
        self.assertNotIn('"sidebar_path": "docs/_sidebar.md"', run_script)

    def test_workflow_uploads_trusted_publish_artifact(self):
        upload_step = self._step_named("Upload trusted publish artifact")
        upload_with = upload_step.get("with") or {}

        self.assertEqual(upload_step.get("uses"), "actions/upload-artifact@v4")
        self.assertEqual(upload_with.get("name"), "trusted-seed-publish")
        self.assertEqual(upload_with.get("path"), "${{ runner.temp }}/trusted-seed-publish")
        self.assertEqual(upload_with.get("if-no-files-found"), "error")
        self.assertNotIn('git push origin HEAD:"${PUBLISH_BRANCH}"', self.text)

    def test_publish_workflow_runs_from_completed_default_branch_seed_processing_run(self):
        workflow_run = self.publish_on_block.get("workflow_run") or {}
        self.assertEqual(workflow_run.get("workflows"), ["seed-paper-related"])
        self.assertEqual(workflow_run.get("types"), ["completed"])
        self.assertEqual((self.publish_workflow.get("permissions") or {}).get("actions"), "read")
        self.assertEqual((self.publish_workflow.get("permissions") or {}).get("contents"), "read")
        self.assertEqual(
            self.publish_job.get("if"),
            "${{ github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch == github.event.repository.default_branch }}",
        )
        self.assertEqual((self.publish_job.get("permissions") or {}).get("actions"), "read")
        self.assertEqual((self.publish_job.get("permissions") or {}).get("contents"), "write")

    def test_publish_workflow_downloads_seed_publish_artifact_from_source_run(self):
        download_step = self._publish_step_named("Download trusted publish artifact")
        download_with = download_step.get("with") or {}

        self.assertEqual(download_step.get("uses"), "actions/download-artifact@v4")
        self.assertEqual(download_with.get("name"), "trusted-seed-publish")
        self.assertEqual(download_with.get("github-token"), "${{ secrets.GITHUB_TOKEN }}")
        self.assertEqual(download_with.get("run-id"), "${{ github.event.workflow_run.id }}")
        self.assertEqual(download_with.get("path"), "trusted-seed-publish")

    def test_publish_workflow_validates_manifest_contract_and_paths(self):
        validate_step = self._publish_step_named("Validate trusted publish artifact")
        env = validate_step.get("env") or {}
        run_script = validate_step.get("run") or ""

        self.assertEqual(env.get("ARTIFACT_ROOT"), "${{ github.workspace }}/trusted-seed-publish")
        self.assertIn('github_env = os.environ.get("GITHUB_ENV") or ""', run_script)
        self.assertIn('Missing GITHUB_ENV path', run_script)
        self.assertIn('manifest_path = artifact_root / "manifest.json"', run_script)
        self.assertIn('Missing trusted publish manifest', run_script)
        self.assertIn('Invalid trusted publish manifest JSON', run_script)
        self.assertIn('request_id = (manifest.get("request_id") or "").strip()', run_script)
        self.assertIn('request_relative_path = PurePosixPath((manifest.get("request_path") or "").strip())', run_script)
        self.assertIn('expected_request_path = PurePosixPath("archive") / "seed-papers" / request_id / "request.json"', run_script)
        self.assertIn('Unexpected request path in manifest', run_script)
        self.assertIn('request_sha256 = (manifest.get("request_sha256") or "").strip().lower()', run_script)
        self.assertIn('Unexpected request sha256 in manifest', run_script)
        self.assertIn('Trusted publish request payload hash mismatch', run_script)
        self.assertIn('Invalid archived request for trusted publish', run_script)
        self.assertIn('Trusted publish manifest request_id mismatch', run_script)
        self.assertIn('source_relative_path = PurePosixPath((manifest.get("source_path") or "").strip())', run_script)
        self.assertIn('Unexpected source path in manifest', run_script)
        self.assertIn('source_sha256 = (manifest.get("source_sha256") or "").strip().lower()', run_script)
        self.assertIn('Unexpected source sha256 in manifest', run_script)
        self.assertIn('Missing archived source PDF for trusted publish', run_script)
        self.assertIn('Trusted publish source PDF hash mismatch', run_script)
        self.assertIn('docs_workspace = PurePosixPath((manifest.get("docs_workspace") or "").strip())', run_script)
        self.assertIn('doc_hashes = manifest.get("doc_hashes")', run_script)
        self.assertIn('Missing trusted publish doc hashes', run_script)
        self.assertIn('Trusted publish doc hash manifest mismatch', run_script)
        self.assertIn('Unexpected doc hash in manifest', run_script)
        self.assertIn('Unexpected doc path in manifest', run_script)
        self.assertIn('Missing doc path in artifact', run_script)
        self.assertIn('Trusted publish doc hash mismatch', run_script)
        self.assertNotIn('readme_path = PurePosixPath((manifest.get("readme_path") or "").strip())', run_script)
        self.assertNotIn('sidebar_path = PurePosixPath((manifest.get("sidebar_path") or "").strip())', run_script)
        self.assertIn('if docs_workspace.is_absolute() or any(part in {"", ".", ".."} for part in docs_workspace.parts):', run_script)
        self.assertIn('Unexpected artifact path', run_script)
        self.assertIn('Missing artifact path', run_script)
        self.assertIn('Missing related docs directory', run_script)
        self.assertIn('Missing required seed docs in', run_script)
        self.assertIn('Trusted publish artifact contains no related pages', run_script)
        self.assertIn('Unexpected artifact file', run_script)
        self.assertIn('Trusted publish index is missing expected links', run_script)
        self.assertIn('with Path(github_env).open("a", encoding="utf-8") as fh:', run_script)

    def test_publish_workflow_applies_and_commits_trusted_artifact_to_default_branch(self):
        apply_step = self._publish_step_named("Apply trusted publish artifact")
        apply_env = apply_step.get("env") or {}
        apply_script = apply_step.get("run") or ""
        commit_step = self._publish_step_named("Commit trusted seed docs")
        commit_env = commit_step.get("env") or {}
        commit_script = commit_step.get("run") or ""
        checkout_step = self._publish_step_named("Checkout publish branch")
        checkout_with = checkout_step.get("with") or {}

        self.assertEqual(apply_env.get("ARTIFACT_ROOT"), "${{ github.workspace }}/trusted-seed-publish")
        self.assertIn('WORKSPACE_DIR="docs/seed-papers/${REQUEST_ID}"', apply_script)
        self.assertIn('rm -rf "$WORKSPACE_DIR"', apply_script)
        self.assertIn('cp -R "${ARTIFACT_ROOT}/${WORKSPACE_DIR}" "$WORKSPACE_DIR"', apply_script)
        self.assertNotIn("from seed_paper_processor import", apply_script)
        self.assertNotIn("load_request", apply_script)
        self.assertNotIn("update_seed_navigation", apply_script)
        self.assertIn("dpr_start", apply_script)
        self.assertIn("dpr_end", apply_script)
        self.assertIn("README.md", apply_script)
        self.assertIn("_sidebar.md", apply_script)
        self.assertIn("readme_path.write_text", apply_script)
        self.assertIn("sidebar_path.write_text", apply_script)

        self.assertEqual(checkout_with.get("ref"), "${{ github.event.workflow_run.head_sha }}")
        self.assertEqual(commit_env.get("PUBLISH_BRANCH"), "${{ github.event.repository.default_branch }}")
        self.assertEqual(commit_env.get("ARTIFACT_ROOT"), "${{ github.workspace }}/trusted-seed-publish")
        self.assertIn('git add "docs/seed-papers/${REQUEST_ID}" "docs/README.md" "docs/_sidebar.md"', commit_script)
        self.assertIn('git fetch origin "${PUBLISH_BRANCH}"', commit_script)
        self.assertIn('git rebase "origin/${PUBLISH_BRANCH}"', commit_script)
        self.assertIn('manifest = json.loads((artifact_root / "manifest.json").read_text(encoding="utf-8")) or {}', commit_script)
        self.assertIn('Unexpected request sha256 in manifest during publish', commit_script)
        self.assertIn('Unexpected source sha256 in manifest during publish', commit_script)
        self.assertIn('Trusted publish request payload hash mismatch after rebase', commit_script)
        self.assertIn('Trusted publish source PDF hash mismatch after rebase', commit_script)
        self.assertIn('git push origin HEAD:"${PUBLISH_BRANCH}"', commit_script)
        self.assertNotIn('Backend processing will be added next.', self.publish_text)


if __name__ == "__main__":
    unittest.main()
