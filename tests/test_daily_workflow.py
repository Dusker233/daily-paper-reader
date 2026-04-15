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


if __name__ == "__main__":
    unittest.main()
