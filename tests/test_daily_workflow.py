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

    def test_workflow_dispatch_exposes_runner_type_choice(self):
        runner_type = self.inputs.get("runner_type") or {}
        self.assertEqual(runner_type.get("default"), "hosted")
        self.assertEqual(runner_type.get("type"), "choice")
        self.assertEqual(runner_type.get("options"), ["hosted", "gpu"])

    def test_runs_on_uses_fixed_allowlisted_runner_sets(self):
        run_job = ((self.workflow.get("jobs") or {}).get("run") or {})
        runs_on = run_job.get("runs-on") or ""
        self.assertIn("runner_type == 'gpu'", runs_on)
        self.assertIn('["self-hosted","linux","x64","gpu"]', runs_on)
        self.assertIn('["ubuntu-latest"]', runs_on)
        self.assertIn("fromJSON", runs_on)

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

    def test_local_rerank_runtime_detects_and_exports_device(self):
        self.assertIn('torch.cuda.is_available()', self.text)
        self.assertIn('fh.write(f"RERANK_LOCAL_DEVICE={device}\\n")', self.text)
        self.assertIn('fh.write(f"DPR_RERANK_DEVICE={device}\\n")', self.text)

    def test_local_smoke_test_does_not_force_cpu(self):
        self.assertNotIn('client.device = "cpu"', self.text)


if __name__ == "__main__":
    unittest.main()
