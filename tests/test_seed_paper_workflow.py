import pathlib
import unittest

import yaml


class SeedPaperWorkflowConfigTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        cls.workflow_path = root / ".github" / "workflows" / "seed-paper-related.yml"
        cls.text = cls.workflow_path.read_text(encoding="utf-8")
        cls.workflow = yaml.safe_load(cls.text) or {}
        cls.on_block = cls.workflow.get("on") or cls.workflow.get(True) or {}
        cls.inputs = (((cls.on_block.get("workflow_dispatch") or {}).get("inputs")) or {})
        jobs = cls.workflow.get("jobs") or {}
        cls.run_job = jobs.get("run") or {}
        cls.steps = cls.run_job.get("steps") or []

    def _step_named(self, name: str):
        for step in self.steps:
            if step.get("name") == name:
                return step
        self.fail(f"Missing workflow step: {name}")

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
        self.assertIn('expected_request_path = f"requests/seed_papers/{request_id}/request.json"', run_script)
        self.assertIn('if request_path != expected_request_path:', run_script)
        self.assertIn('Unexpected request path', run_script)

    def test_workflow_validates_seed_pdf_source_path_and_existence(self):
        validate_step = self._step_named("Validate request inputs")
        env = validate_step.get("env") or {}
        run_script = validate_step.get("run") or ""
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/request-repo")
        self.assertIn('relative_pdf_path = PurePosixPath(source_path)', run_script)
        self.assertIn('expected_source_prefix = PurePosixPath("requests") / "seed_papers" / request_id', run_script)
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

    def test_workflow_checks_out_publish_branch_and_request_payload_branch_separately(self):
        publish_checkout = self._step_named("Checkout publish branch")
        publish_checkout_with = publish_checkout.get("with") or {}
        request_checkout = self._step_named("Checkout request payload branch")
        request_checkout_with = request_checkout.get("with") or {}

        self.assertEqual(publish_checkout.get("uses"), "actions/checkout@v5")
        self.assertEqual(publish_checkout_with.get("path"), "publish-repo")
        self.assertEqual(publish_checkout_with.get("ref"), "${{ github.event.repository.default_branch }}")
        self.assertEqual(request_checkout.get("uses"), "actions/checkout@v5")
        self.assertEqual(request_checkout_with.get("path"), "request-repo")
        self.assertEqual(request_checkout_with.get("ref"), "seed-paper-requests/${{ github.event.inputs.request_id }}")
        self.assertEqual(
            request_checkout_with.get("sparse-checkout"),
            "requests/seed_papers/${{ github.event.inputs.request_id }}\n",
        )
        self.assertFalse(request_checkout_with.get("sparse-checkout-cone-mode"))

    def test_workflow_installs_and_invokes_seed_paper_processor_from_publish_checkout(self):
        install_step = self._step_named("Install deps (skip sqlite3)")
        process_step = self._step_named("Process seed paper request")
        env = process_step.get("env") or {}
        run_script = process_step.get("run") or ""

        self.assertEqual(install_step.get("working-directory"), "publish-repo")
        self.assertEqual(process_step.get("working-directory"), "publish-repo")
        self.assertEqual(env.get("REQUEST_ROOT"), "${{ github.workspace }}/request-repo")
        self.assertEqual(env.get("PUBLISH_ROOT"), "${{ github.workspace }}/publish-repo")
        self.assertIn('python3 src/seed_paper_processor.py', run_script)
        self.assertIn('--request-path "${REQUEST_ROOT}/${REQUEST_PATH}"', run_script)
        self.assertIn('--request-id "$REQUEST_ID"', run_script)
        self.assertIn('--root-dir "$REQUEST_ROOT"', run_script)
        self.assertIn('--docs-dir "$PUBLISH_ROOT/docs"', run_script)
        self.assertIn('--seed-mode "$SEED_MODE"', run_script)

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
