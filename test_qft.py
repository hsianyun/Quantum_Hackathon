import json
import unittest
from unittest.mock import patch
import numpy as np
import qft
from qiskit.quantum_info import Operator, Statevector
from qiskit.providers.basic_provider import BasicSimulator
from qft import qft_circuit, periodic_state, periodic_circuit, measure_periodic


class QftTests(unittest.TestCase):
    def tearDown(self):
        qft._radio_scenarios.clear()
        qft._radio_trials.clear()
    def test_independent_fourier_matrix_and_inverse_complex_roundtrip(self):
        rng = np.random.default_rng(42)
        for n in range(1, 5):
            size = 2 ** n
            oracle = np.exp(2j * np.pi * np.outer(np.arange(size), np.arange(size)) / size) / np.sqrt(size)
            np.testing.assert_allclose(Operator(qft_circuit(n)).data, oracle, atol=1e-12)
            np.testing.assert_allclose(Operator(qft_circuit(n, True)).data, oracle.conj().T, atol=1e-12)
            vector = rng.normal(size=size) + 1j * rng.normal(size=size)
            vector /= np.linalg.norm(vector)
            recovered = Statevector(vector).evolve(qft_circuit(n)).evolve(qft_circuit(n, True))
            np.testing.assert_allclose(recovered.data, vector, atol=1e-12)

    def test_wrong_sign_and_missing_swaps_are_observable(self):
        state = Statevector.from_int(1, 8)
        correct = state.evolve(qft_circuit(3))
        self.assertFalse(correct.equiv(state.evolve(qft_circuit(3, True))))
        without_swaps = qft_circuit(3)
        without_swaps.data = [instruction for instruction in without_swaps.data if instruction.operation.name != "swap"]
        self.assertFalse(correct.equiv(state.evolve(without_swaps)))

    def test_r4_r2_exact_spectra_and_shifted_phase(self):
        for period, expected in ((4, [0, 4, 8, 12]), (2, [0, 8])):
            state = periodic_state(4, period)
            for index, amplitude in enumerate(state.data):
                self.assertAlmostEqual(abs(amplitude), np.sqrt(period / 16) if index % period == 0 else 0, places=12)
            transformed = state.evolve(qft_circuit(4))
            for index, probability in enumerate(transformed.probabilities()):
                self.assertAlmostEqual(float(probability), 1 / len(expected) if index in expected else 0, places=12)
        shifted = periodic_state(4, 4, 1).evolve(qft_circuit(4))
        for index in [0, 4, 8, 12]:
            self.assertAlmostEqual(abs(shifted.data[index] - np.exp(2j * np.pi * index / 16) / 2), 0, places=12)

    def test_sampled_real_backend_histograms_and_classical_order(self):
        for backend in (None, BasicSimulator(seed_simulator=42)):
            for period, expected in ((4, [0, 4, 8, 12]), (2, [0, 8])):
                result = measure_periodic({"period": period}, 4096, backend=backend, seed=42)
                self.assertEqual(result["dominant_positions"], expected)
                self.assertEqual(sum(result["counts"].values()), 4096)
                self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)
                for index in expected:
                    self.assertTrue(abs(result["counts"][format(index, "04b")] / 4096 - 1 / len(expected)) < 0.05)
        circuit = periodic_circuit(4, 4)
        self.assertEqual([(circuit.find_bit(i.qubits[0]).index, circuit.find_bit(i.clbits[0]).index)
                          for i in circuit.data if i.operation.name == "measure"], [(i, i) for i in range(4)])

    def test_invalid_parameters_before_device_and_backend_errors_without_fallback(self):
        backend = BasicSimulator()
        with patch.object(backend, "run", wraps=backend.run) as run:
            for config in (None, [], {"num_qubits": True}, {"num_qubits": 7}, {"period": 3},
                           {"period": 0}, {"offset": 4}, {"inverse": "yes"}, {"unknown": 1}):
                with self.assertRaises(ValueError):
                    measure_periodic(config, 8, backend=backend)
            for shots in (0, -1, True, 1.5):
                with self.assertRaises(ValueError):
                    measure_periodic({}, shots, backend=backend)
            run.assert_not_called()
        with patch.object(backend, "run", side_effect=RuntimeError("selected backend unavailable")), patch("qft.StatevectorSampler", side_effect=AssertionError("No fallback")):
            with self.assertRaisesRegex(RuntimeError, "selected backend unavailable"):
                measure_periodic({}, 8, backend=backend)

    def test_asymmetric_backend_count_has_conventional_integer_order(self):
        backend = BasicSimulator()
        with patch.object(backend, "run") as run:
            run.return_value.result.return_value.get_counts.return_value = {"0001": 7}
            result = measure_periodic({}, 7, backend=backend)
            self.assertEqual(result["counts"]["0001"], 7)
            self.assertEqual(result["dominant_positions"], [1])
            self.assertEqual(run.call_args.kwargs, {"shots": 7})

    def test_radio_r2_r4_r8_support_matches_independent_fourier_sum(self):
        for period in (2, 4, 8):
            source = periodic_state(4, period)
            transformed = source.evolve(qft_circuit(4))
            oracle = np.array([sum(source.data[x] * np.exp(2j * np.pi * x * y / 16)
                                   for x in range(16)) / 4 for y in range(16)])
            np.testing.assert_allclose(transformed.data, oracle, atol=1e-12)
            support = [y for y, probability in enumerate(abs(oracle) ** 2) if probability > 1e-12]
            self.assertEqual(qft.expected_peaks(4, period), support)
            data = measure_periodic({"period": period}, 4096, backend=BasicSimulator(seed_simulator=42))
            self.assertEqual(data["dominant_positions"], support)
            for y in support:
                self.assertLess(abs(data["counts"][format(y, "04b")] / 4096 - 1 / period), 0.04)

    def test_guided_radio_real_measurement_requires_both_predictions_and_sanitizes_metadata(self):
        for period in (2, 4):
            opened = qft.open_radio("guided", scenario=period)
            self.assertNotIn("period", opened)
            self.assertEqual(opened["input_positions"], list(range(0, 16, period)))
            for prediction, correct in ((period, True), (6 - period, False)):
                data = qft.measure_radio(opened["scenario_id"], {"alice_period": prediction, "bob_spacing": 16 // period},
                                        4096, backend=BasicSimulator(seed_simulator=42))
                self.assertFalse(set(data) & {"period", "offset", "dominant_positions", "expected_peaks"})
                result = qft.verify_radio(data["trial_id"])
                self.assertEqual(result["alice_matches"], correct)
                self.assertTrue(result["spectrum_consistent"])
                self.assertEqual(result["observed_spacing"], 16 // period)
                self.assertEqual("period" in result, correct)
                self.assertEqual(qft.verify_radio(data["trial_id"]), result)

    def test_blind_period_is_private_until_interpretation_and_inference_are_committed(self):
        for period in (2, 4, 8):
            opened = qft.open_radio("blind", scenario=period)
            self.assertFalse(set(opened) & {"period", "input_positions", "expected_peaks", "offset"})
            for guess in (next(p for p in (2, 4, 8) if p != period), period):
                data = qft.measure_radio(opened["scenario_id"], {}, 4096, backend=BasicSimulator(seed_simulator=42))
                self.assertFalse(set(data) & {"period", "input_positions", "expected_peaks", "dominant_positions"})
                with self.assertRaisesRegex(ValueError, "interpretation"):
                    qft.verify_radio(data["trial_id"], guess)
                observed = [int(bits, 2) for bits, count in data["counts"].items() if count > 0]
                phases = [str(qft.Fraction(y, 16)) for y in observed]
                claims = qft.commit_radio(data["trial_id"], ",".join(map(str, observed)), ",".join(phases))
                self.assertNotIn("period", claims)
                self.assertEqual(claims["payload"], "".join(format(y, "04b") for y in observed))
                self.assertEqual(qft.commit_radio(data["trial_id"], ",".join(map(str, observed)), ",".join(phases)), claims)
                result = qft.verify_radio(data["trial_id"], guess)
                self.assertTrue(result["alice_matches"])
                self.assertEqual(result["bob_matches"], guess == period)
                self.assertEqual("period" in result, guess == period)
                if guess != period:
                    self.assertNotIn("observed_peaks", result)
                    self.assertIn(f"spacing {16 // guess}", result["diagnostic"])
                self.assertEqual(qft.verify_radio(data["trial_id"], guess), result)
                with self.assertRaisesRegex(ValueError, "committed"):
                    qft.verify_radio(data["trial_id"], next(p for p in (2, 4, 8) if p != guess))
                self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)

    def test_wrong_bit_order_and_phase_interpretation_fail_without_revealing_hidden_answer(self):
        opened = qft.open_radio("blind", scenario=4)
        for observations, phases in (("0,2,1,3", "0,1/8,1/16,3/16"), ("0,4,8,12", "0,1/8,1/2,3/4")):
            data = qft.measure_radio(opened["scenario_id"], {}, 4096, seed=42)
            qft.commit_radio(data["trial_id"], observations, phases)
            result = qft.verify_radio(data["trial_id"], 4)
            self.assertFalse(result["alice_matches"])
            self.assertNotIn("period", result)
            self.assertIn("q3q2q1q0", result["diagnostic"])
            with self.assertRaisesRegex(ValueError, "committed"):
                qft.commit_radio(data["trial_id"], "0,4,8,12", "0,1/4,1/2,3/4")

    def test_radio_private_handles_bounded_expired_discarded_and_closed(self):
        with patch("qft._RADIO_LIMIT", 2):
            opened = qft.open_radio("guided", scenario=4)
            qft.open_radio("blind", scenario=8)
            with self.assertRaisesRegex(ValueError, "Too many"):
                qft.open_radio("guided")
        a = qft.measure_radio(opened["scenario_id"], {"alice_period": 4, "bob_spacing": 4}, 256, seed=42)
        b = qft.measure_radio(opened["scenario_id"], {"alice_period": 4, "bob_spacing": 4}, 256, seed=43)
        with self.assertRaisesRegex(ValueError, "discarded"):
            qft.verify_radio(a["trial_id"])
        self.assertTrue(qft.discard_radio(b["trial_id"])["discarded"])
        self.assertFalse(qft.discard_radio(b["trial_id"])["discarded"])
        created = qft._radio_scenarios[opened["scenario_id"]]["created"]
        with patch("qft.monotonic", return_value=created + 1801):
            with self.assertRaisesRegex(ValueError, "expired"):
                qft.measure_radio(opened["scenario_id"], {}, 256)
        opened = qft.open_radio("blind", scenario=4)
        data = qft.measure_radio(opened["scenario_id"], {}, 256, seed=42)
        self.assertTrue(qft.close_radio(opened["scenario_id"])["closed"])
        with self.assertRaises(ValueError):
            qft.commit_radio(data["trial_id"], "0", "0")

    def test_radio_invalid_inputs_backend_failures_and_inconsistent_spectrum(self):
        backend = BasicSimulator(seed_simulator=42)
        opened = qft.open_radio("guided", scenario=4)
        with patch.object(backend, "run", wraps=backend.run) as run:
            for predictions in ({}, {"alice_period": True, "bob_spacing": 4}, {"alice_period": 4, "bob_spacing": 3}, {"period": 4}):
                with self.assertRaises(ValueError):
                    qft.measure_radio(opened["scenario_id"], predictions, 4096, backend=backend)
            for shots in (0, 255, True, 2.5, 16385):
                with self.assertRaises(ValueError):
                    qft.measure_radio(opened["scenario_id"], {"alice_period": 4, "bob_spacing": 4}, shots, backend=backend)
            run.assert_not_called()
        with patch.object(backend, "run", side_effect=RuntimeError("selected backend failed")), patch("qft.StatevectorSampler", side_effect=AssertionError("No fallback")):
            with self.assertRaisesRegex(RuntimeError, "selected backend"):
                qft.measure_radio(opened["scenario_id"], {"alice_period": 4, "bob_spacing": 4}, 4096, backend=backend)
        self.assertFalse(qft._radio_trials)
        with patch.object(backend, "run") as run:
            run.return_value.result.return_value.get_counts.return_value = {"0001": 4096}
            data = qft.measure_radio(opened["scenario_id"], {"alice_period": 4, "bob_spacing": 4}, 4096, backend=backend)
            result = qft.verify_radio(data["trial_id"])
            self.assertFalse(result["spectrum_consistent"])
            self.assertNotIn("period", result)
            self.assertEqual(result["observed_peaks"], [1])

    def test_blind_claim_syntax_validation_precedes_commit(self):
        opened = qft.open_radio("blind", scenario=4)
        data = qft.measure_radio(opened["scenario_id"], {}, 256, seed=42)
        for observations, phases in (("", ""), ("0,0", "0,1/4"), ("16", "0"), ("4", "1/0"),
                                     ("4", "1/3"), ("4,8", "1/4"), ("4", "1"), ("not bits", "0")):
            with self.assertRaises(ValueError):
                qft.commit_radio(data["trial_id"], observations, phases)
        self.assertIsNone(qft._radio_trials[data["trial_id"]]["claims"])
