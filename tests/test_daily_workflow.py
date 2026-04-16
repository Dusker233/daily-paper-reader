import pathlib
import unittest

import yaml


class DailyWorkflowConfigTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = pathlib.Path(__file__).resolve().parents[1]
        cls.workflow_path = root / ".github" / "workflows" / "daily-paper-reader.yml"
        cls.text = cls.workflow_path.read_text(encoding="utf-8")
        cls.workflow = yaml.safe_load(cls.text) or {}
        cls.on_block = cls.workflow.get("on") or cls.workflow.get(True) or {}
        cls.inputs = (((cls.on_block.get("workflow_dispatch") or {}).get("inputs")) or {})

    def test_workflow_dispatch_does_not_expose_gpu_runner_choice(self):
        self.assertNotIn("runner_type", self.inputs)

    def test_workflow_dispatch_exposes_seed_smoke_toggle(self):
        self.assertIn("seed_smoke", self.inputs)
        seed_smoke = self.inputs.get("seed_smoke") or {}
        self.assertEqual(seed_smoke.get("default"), "false")

    def test_run_job_uses_hosted_ubuntu_runner(self):
        jobs = self.workflow.get("jobs") or {}
        run_job = jobs.get("run") or {}
        runs_on = run_job.get("runs-on") or ""
        self.assertIn("ubuntu", runs_on)
        self.assertNotIn("self-hosted", runs_on)
        self.assertEqual((self.workflow.get("permissions") or {}).get("contents"), "read")
        self.assertEqual(((run_job.get("permissions") or {}).get("contents")), "write")
        self.assertNotIn("validate_gpu_runner", jobs)
        self.assertNotIn("GPU_LARGER_RUNNER_GROUP", self.text)

    def test_schedule_defaults_rerank_to_none_and_dispatch_defaults_to_blt(self):
        self.assertIn(
            'if [ "${GITHUB_EVENT_NAME:-}" = "schedule" ] && [ -z "$REQUESTED_RERANK_PROVIDER" ]; then',
            self.text,
        )
        self.assertIn('REQUESTED_RERANK_PROVIDER="none"', self.text)
        self.assertIn(
            'elif [ "${GITHUB_EVENT_NAME:-}" = "workflow_dispatch" ] && [ -z "$REQUESTED_RERANK_PROVIDER" ]; then',
            self.text,
        )
        self.assertIn('REQUESTED_RERANK_PROVIDER="blt"', self.text)

    def test_local_rerank_runtime_forces_and_exports_cpu_device(self):
        self.assertIn('device = "cpu"', self.text)
        self.assertIn('hosted workflow forces local rerank device={device}', self.text)
        self.assertIn('fh.write(f"RERANK_LOCAL_DEVICE={device}\\n")', self.text)
        self.assertIn('fh.write(f"DPR_RERANK_DEVICE={device}\\n")', self.text)

    def test_local_smoke_test_reads_runtime_device_without_overriding_client(self):
        self.assertNotIn('client.device = "cpu"', self.text)

    def test_seed_smoke_job_runs_on_hosted_runner_without_committing(self):
        jobs = self.workflow.get("jobs") or {}
        seed_smoke_job = jobs.get("seed_smoke") or {}
        run_job = jobs.get("run") or {}
        self.assertEqual(seed_smoke_job.get("runs-on"), "ubuntu-latest")
        self.assertEqual(seed_smoke_job.get("timeout-minutes"), 30)
        self.assertEqual(run_job.get("runs-on"), "ubuntu-latest")
        self.assertEqual(run_job.get("if"), "github.event.inputs.seed_smoke != 'true'")
        self.assertEqual(seed_smoke_job.get("if"), "github.event.inputs.seed_smoke == 'true'")

        steps = seed_smoke_job.get("steps") or []
        step_names = [step.get("name") for step in steps]
        self.assertIn("Run seed paper processor unit tests", step_names)
        self.assertIn("Create seed smoke fixtures", step_names)
        self.assertIn("Run seed paper smoke flow", step_names)
        self.assertIn("Upload seed smoke docs artifact", step_names)

        unit_test_step = next(step for step in steps if step.get("name") == "Run seed paper processor unit tests")
        self.assertIn("python -m unittest tests.test_seed_paper_processor tests.test_daily_workflow", unit_test_step.get("run") or "")

        smoke_step = next(step for step in steps if step.get("name") == "Run seed paper smoke flow")
        smoke_script = smoke_step.get("run") or ""
        self.assertIn("python src/seed_paper_processor.py", smoke_script)
        self.assertIn("docs/seed-papers/${REQUEST_ID}/index.md", smoke_script)
        self.assertIn("docs/seed-papers/${REQUEST_ID}/seed-paper.md", smoke_script)
        self.assertIn("docs/README.md", smoke_script)
        self.assertIn("docs/_sidebar.md", smoke_script)
        self.assertNotIn("git commit", smoke_script)
        self.assertNotIn("git push", smoke_script)

        upload_step = next(step for step in steps if step.get("name") == "Upload seed smoke docs artifact")
        self.assertEqual(upload_step.get("uses"), "actions/upload-artifact@v4")


if __name__ == "__main__":
    unittest.main()
