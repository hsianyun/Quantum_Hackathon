"""Verify the public experiment boundary without exposing Qiskit objects."""

from collections import Counter
import json
import unittest
from unittest.mock import patch
from unittest.mock import Mock

from qiskit.providers.basic_provider import BasicSimulator

from api import (
    bell_experiment,
    period_experiment,
    teleport_experiment,
    warden_experiment,
)


class ApiTests(unittest.TestCase):
    def assert_json_roundtrip(self, result):
        self.assertIsInstance(result, dict)
        self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)

    def test_bell_result_contract(self):
        for basis_a, basis_b in (("Z", "Z"), ("X", "X"), ("X", "Z"), ("Z", "X")):
            with self.subTest(basis_a=basis_a, basis_b=basis_b):
                result = bell_experiment(basis_a, basis_b, 64)
                self.assert_json_roundtrip(result)
                self.assertEqual(result["experiment"], "bell")
                self.assertEqual(result["status"], "ok")
                self.assertEqual(result["shots"], 64)
                self.assertEqual((result["basis_a"], result["basis_b"]), (basis_a, basis_b))
                self.assertEqual(set(result["counts"]), {"00", "01", "10", "11"})
                self.assertEqual(sum(result["counts"].values()), 64)
                expected = (result["counts"]["00"] + result["counts"]["11"]) / 64
                self.assertEqual(result["agreement"], expected)

    def test_teleport_result_contract(self):
        for correction in ("I", "X", "Z", "XZ"):
            with self.subTest(correction=correction):
                result = teleport_experiment(1.1, 0.7, correction, 8)
                self.assert_json_roundtrip(result)
                self.assertEqual(result["experiment"], "teleport")
                self.assertEqual(result["status"], "ok")
                self.assertEqual(result["shots"], 8)
                self.assertEqual(result["bob_correction"], correction)
                self.assertEqual(len(result["trials"]), 8)
                self.assertEqual(set(result["counts"]), {"00", "01", "10", "11"})
                self.assertEqual(sum(result["counts"].values()), 8)
                observed = Counter()
                for trial in result["trials"]:
                    self.assertEqual(trial["correction"], correction)
                    self.assertIn("density_matrix", trial["bob_state"])
                    self.assertTrue(0 <= trial["fidelity"] <= 1)
                    observed["".join(str(bit) for bit in trial["alice_bits"])] += 1
                self.assertEqual(result["counts"], {bits: observed[bits] for bits in result["counts"]})
                expected = sum(trial["fidelity"] for trial in result["trials"]) / 8
                self.assertAlmostEqual(result["mean_fidelity"], expected, places=12)

    def test_bell_selected_gate_and_python_diagnostics(self):
        for gate in ("H", "X", "Z", "S"):
            for a, b in (("Z", "Z"), ("X", "X"), ("X", "Z"), ("Z", "X")):
                result = bell_experiment(a, b, 2048, preparation_gate=gate, seed=42)
                self.assert_json_roundtrip(result)
                self.assertEqual(result["preparation_gate"], gate)
                self.assertAlmostEqual(result["preparation_fidelity"], 1 if gate == "H" else 0.5)
                self.assertEqual(result["correlation"], 2 * result["agreement"] - 1)
                expected = "correlated" if a == b == "Z" or gate == "H" and a == b else "random"
                self.assertEqual(result["correlation_type"], expected)
                self.assertNotIn("solved", result)
                self.assertNotIn("correct_gate", result)
        with self.assertRaises(ValueError):
            bell_experiment("Z", "Z", 128, preparation_gate="Y")

    def test_teleport_runs_each_requested_trial(self):
        # Verify aggregation and delegation with distinct outcomes; a wrapper
        # that repeats one sampled trial must not pass.
        outcomes = [
            {"alice_bits": [0, 1], "bob_state": {}, "fidelity": 0.25},
            {"alice_bits": [1, 0], "bob_state": {}, "fidelity": 0.75},
        ]
        with patch("api.teleport", side_effect=outcomes) as run:
            result = teleport_experiment(1.1, 0.7, "Z", 2)
        self.assertEqual(run.call_count, 2)
        for call in run.call_args_list:
            self.assertEqual(call.args, (1.1, 0.7, "Z"))
        self.assertEqual(result["counts"], {"00": 0, "01": 1, "10": 1, "11": 0})
        self.assertEqual(result["mean_fidelity"], 0.5)

    def test_unavailable_experiments_are_explicit_json_results(self):
        for name, experiment in (("period", period_experiment),):
            with self.subTest(experiment=name):
                config = {"parameters": {"example": [1, True, None]}}
                before = json.dumps(config)
                result = experiment(config, 16)
                self.assert_json_roundtrip(result)
                self.assertEqual(result["experiment"], name)
                self.assertEqual(result["status"], "not_implemented")
                self.assertEqual(result["error"]["code"], "not_implemented")
                self.assertEqual(result["shots"], 16)
                self.assertNotIn("counts", result)
                self.assertEqual(json.dumps(config), before)

    def test_invalid_shots_are_rejected_for_every_experiment(self):
        experiments = (
            lambda shots: bell_experiment("Z", "Z", shots),
            lambda shots: teleport_experiment(0, 0, "I", shots),
            lambda shots: warden_experiment({}, shots),
            lambda shots: period_experiment({}, shots),
        )
        for index, experiment in enumerate(experiments):
            for shots in (0, -1, True, 1.5, "8", None):
                with self.subTest(experiment=index, shots=shots):
                    with self.assertRaises(ValueError):
                        experiment(shots)

    def test_invalid_parameters_preserve_core_validation(self):
        with self.assertRaises(ValueError):
            bell_experiment("Y", "Z", 8)
        with self.assertRaises(ValueError):
            teleport_experiment(0, 0, "Y", 8)
        with self.assertRaises(ValueError):
            teleport_experiment(float("nan"), 0, "I", 8)

    def test_invalid_configs_are_rejected(self):
        for experiment in (warden_experiment, period_experiment):
            for config in (None, [], {"value": 1j}, {"value": float("nan")}):
                with self.subTest(experiment=experiment.__name__, config=config):
                    with self.assertRaises(ValueError):
                        experiment(config, 8)

    def test_host_backend_runs_real_circuits_for_every_gate_and_basis(self):
        backend = BasicSimulator()
        for gate in ("H", "X", "Z", "S"):
            for a, b in (("Z", "Z"), ("X", "X"), ("X", "Z"), ("Z", "X")):
                with self.subTest(gate=gate, bases=(a, b)):
                    result = bell_experiment(a, b, 4096, preparation_gate=gate, backend=backend)
                    self.assert_json_roundtrip(result)
                    self.assertEqual(sum(result["counts"].values()), 4096)
                    self.assertEqual(result["preparation_gate"], gate)
                    self.assertAlmostEqual(result["preparation_fidelity"], 1 if gate == "H" else 0.5)
                    self.assertEqual(result["preparation_fidelity_source"], "ideal_circuit")
                    expected = "correlated" if a == b == "Z" or gate == "H" and a == b else "random"
                    self.assertEqual(result["correlation_type"], expected)
                    if expected == "random":
                        self.assertTrue(0.45 < result["agreement"] < 0.55)

    def test_host_backend_receives_selected_circuit_and_counts_keep_alice_first(self):
        backend = Mock()
        backend.run.return_value.result.return_value.get_counts.return_value = {"01": 8}
        result = bell_experiment("X", "Z", 8, preparation_gate="S", backend=backend)
        circuit = backend.run.call_args.args[0]
        self.assertEqual(circuit.num_qubits, 2)
        self.assertEqual([item.operation.name for item in circuit.data[:3]], ["s", "cx", "h"])
        self.assertEqual(backend.run.call_args.kwargs, {"shots": 8})
        self.assertEqual(result["counts"], {"00": 0, "01": 0, "10": 8, "11": 0})
        self.assertNotIn("backend", result)

    def test_host_backend_errors_propagate_without_statevector_fallback(self):
        backend = Mock()
        backend.run.side_effect = RuntimeError("Only one job is allowed per run")
        with patch("bell.StatevectorSampler", side_effect=AssertionError("No simulator fallback")):
            with self.assertRaisesRegex(RuntimeError, "Only one job"):
                bell_experiment("Z", "Z", 64, backend=backend)

    def test_invalid_inputs_do_not_submit_a_backend_job(self):
        backend = Mock()
        for a, b, shots, gate in (("Y", "Z", 64, "H"), ("Z", "Z", 0, "H"), ("Z", "Z", 64, "Y")):
            with self.assertRaises(ValueError):
                bell_experiment(a, b, shots, preparation_gate=gate, backend=backend)
        backend.run.assert_not_called()

    def test_warden_wrapper_preserves_real_physics_and_hidden_link(self):
        from api import warden_open, warden_close
        link = warden_open(scenario="z")
        try:
            config = {"link_id": link["link_id"], "basis_a": "X", "basis_b": "X"}
            original = dict(config)
            result = warden_experiment(config, 4096, backend=BasicSimulator(seed_simulator=42))
            self.assert_json_roundtrip(result)
            self.assertEqual(config, original)
            self.assertEqual(result["status"], "ok")
            self.assertEqual(result["matched_shots"], 4096)
            self.assertTrue(0.45 < result["qber"] < 0.55)
            self.assertNotIn("attack", result)
        finally:
            warden_close(link["link_id"])

    def test_staged_teleport_api_exposes_bits_then_committed_verification(self):
        from api import teleport_prepare, teleport_finish, teleport_cancel
        trial = teleport_prepare("+i", "CX_H", seed=3)
        try:
            self.assert_json_roundtrip(trial)
            self.assertNotIn("fidelity", trial)
            bits = trial["alice_bits"]
            correction = ("X" if bits[1] else "") + ("Z" if bits[0] else "") or "I"
            result = teleport_finish(trial["trial_id"], correction)
            self.assert_json_roundtrip(result)
            self.assertAlmostEqual(result["fidelity"], 1, places=12)
        finally:
            teleport_cancel(trial["trial_id"])

    def test_qft_json_utility_does_not_claim_period_factoring(self):
        from api import qft_experiment
        for inverse in (False, True):
            result = qft_experiment({"period": 4, "inverse": inverse}, 1024, backend=BasicSimulator(seed_simulator=42))
            self.assert_json_roundtrip(result)
            self.assertEqual(result["dominant_positions"], [0, 4, 8, 12])
            self.assertEqual(result["experiment"], "qft")
            self.assertNotIn("factors", result)
            self.assertEqual(period_experiment({}, 8)["status"], "not_implemented")


if __name__ == "__main__":
    unittest.main()
