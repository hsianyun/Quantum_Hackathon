import json
import unittest
from unittest.mock import Mock, patch

from qiskit.quantum_info import DensityMatrix, Statevector, partial_trace
from qiskit.providers.basic_provider import BasicSimulator
import warden


class WardenTests(unittest.TestCase):
    def tearDown(self):
        warden._links.clear()

    def test_exact_z_attack_removes_coherence_not_zz_populations(self):
        for attack in ("ideal", "z"):
            circuit = warden.warden_circuit("Z", "Z", attack)
            pair = partial_trace(Statevector.from_instruction(circuit.remove_final_measurements(inplace=False)), [2])
            self.assertAlmostEqual(float(pair.data[0, 0].real), 0.5, places=12)
            self.assertAlmostEqual(float(pair.data[3, 3].real), 0.5, places=12)
            self.assertAlmostEqual(float(pair.data[0, 3].real), 0.5 if attack == "ideal" else 0, places=12)
            for basis in ("Z", "X"):
                state = Statevector.from_instruction(warden.warden_circuit(basis, basis, attack).remove_final_measurements(inplace=False))
                expected = [0.25] * 4 if attack == "z" and basis == "X" else [0.5, 0, 0, 0.5]
                for actual, target in zip(state.probabilities(qargs=[0, 1]), expected):
                    self.assertAlmostEqual(float(actual), target, places=12)

    def test_real_simulator_and_local_sampling_detect_only_complementary_attack(self):
        for backend in (None, BasicSimulator(seed_simulator=42)):
            for attack in ("ideal", "z"):
                for basis in ("Z", "X"):
                    result = warden.measure_link({"basis_a": basis, "basis_b": basis, "attack": attack}, 4096, backend=backend, seed=42)
                    if attack == "z" and basis == "X":
                        self.assertTrue(0.45 < result["qber"] < 0.55)
                    else:
                        self.assertEqual(result["qber"], 0)
                        self.assertTrue(0.45 < result["counts"]["00"] / 4096 < 0.55)
                    self.assertEqual(sum(result["counts"].values()), 4096)
                    self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)
                    self.assertNotIn("attack", result)

    def test_mismatch_never_reports_healthy_qber(self):
        for a, b in (("X", "Z"), ("Z", "X")):
            result = warden.measure_link({"basis_a": a, "basis_b": b, "attack": "z"}, 4096, seed=42)
            self.assertTrue(0.45 < result["agreement"] < 0.55)
            self.assertIsNone(result["qber"])
            self.assertEqual(result["matched_shots"], 0)
            self.assertEqual(result["qber_status"], "unavailable")

    def test_backend_wiring_counts_order_and_error_propagation(self):
        backend = Mock()
        backend.run.return_value.result.return_value.get_counts.return_value = {"101": 7}
        result = warden.measure_link({"basis_a": "X", "basis_b": "Z", "attack": "z"}, 7, backend=backend)
        self.assertEqual(result["counts"], {"00": 0, "01": 0, "10": 7, "11": 0})
        circuit = backend.run.call_args.args[0]
        self.assertEqual(backend.run.call_args.kwargs, {"shots": 7})
        self.assertEqual([(circuit.find_bit(i.qubits[0]).index, circuit.find_bit(i.clbits[0]).index)
                          for i in circuit.data if i.operation.name == "measure"], [(0, 0), (1, 1), (2, 2)])
        backend.run.side_effect = RuntimeError("selected device failed")
        with patch("warden.StatevectorSampler", side_effect=AssertionError("No fallback")):
            with self.assertRaisesRegex(RuntimeError, "selected device"):
                warden.measure_link({}, 8, backend=backend)

    def test_hidden_link_persists_and_close_expiry_reject_reuse(self):
        link = warden.open_link(scenario="z")
        self.assertEqual(set(link), {"experiment", "status", "link_id"})
        config = {"basis_a": "X", "basis_b": "X", "link_id": link["link_id"]}
        self.assertTrue(0.45 < warden.measure_link(config, 4096, seed=42)["qber"] < 0.55)
        with patch("warden.monotonic", return_value=warden._links[link["link_id"]]["created"] + 1801):
            with self.assertRaisesRegex(ValueError, "expired"):
                warden.measure_link(config, 8)
        link = warden.open_link(scenario="ideal")
        self.assertTrue(warden.close_link(link["link_id"])["closed"])
        self.assertFalse(warden.close_link(link["link_id"])["closed"])
        with self.assertRaises(ValueError):
            warden.measure_link({"link_id": link["link_id"]}, 8)

    def test_invalid_parameters_and_invalid_backend_counts(self):
        backend = Mock()
        for config in (None, [], {"basis_a": "Y"}, {"attack": "bad"}, {"link_id": []}, {"unknown": 1}):
            with self.assertRaises(ValueError):
                warden.measure_link(config, 8, backend=backend)
        for shots in (0, -1, True, 1.5):
            with self.assertRaises(ValueError):
                warden.measure_link({}, shots, backend=backend)
        backend.run.assert_not_called()
        for raw in ({"000": 1}, {"xx0": 8}, {"00": 8}, {"000": -8}):
            backend.run.return_value.result.return_value.get_counts.return_value = raw
            with self.assertRaises(ValueError):
                warden.measure_link({}, 8, backend=backend)
