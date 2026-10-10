import json
import unittest
from unittest.mock import patch
import numpy as np
from qiskit.quantum_info import Operator, Statevector
from qiskit.providers.basic_provider import BasicSimulator
from qft import qft_circuit, periodic_state, periodic_circuit, measure_periodic


class QftTests(unittest.TestCase):
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
