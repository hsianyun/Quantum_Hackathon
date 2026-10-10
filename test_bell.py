"""Run from the repository root: python -m unittest discover -v."""

import json
import unittest

from qiskit.quantum_info import Statevector

from bell import (
    agreement_fraction,
    measure_bell,
    measure_xx,
    measure_xz,
    measure_zx,
    measure_zz,
    measurement_circuit,
    prepare_bell,
    preparation_fidelity,
    correlation_statistics,
)


class BellTests(unittest.TestCase):
    SHOTS = 4096

    def test_prepares_phi_plus(self):
        circuit = prepare_bell()
        self.assertEqual(circuit.num_qubits, 2)
        self.assertEqual(circuit.num_clbits, 0)
        amplitude = 2 ** -0.5
        expected = Statevector([amplitude, 0, 0, amplitude])
        self.assertTrue(Statevector.from_instruction(circuit).equiv(expected))

    def test_matching_bases_are_strongly_correlated(self):
        for measure in (measure_zz, measure_xx):
            with self.subTest(measure=measure.__name__):
                counts = measure(shots=self.SHOTS, seed=42)
                self.assertGreaterEqual(agreement_fraction(counts), 0.99)
                self.assertEqual(counts["01"] + counts["10"], 0)
                # Both outcomes occur: a constant 00 output cannot pass.
                self.assertTrue(0.45 < counts["00"] / self.SHOTS < 0.55)
                self.assertTrue(0.45 < counts["11"] / self.SHOTS < 0.55)

    def test_crossed_bases_are_not_deterministically_correlated(self):
        for measure in (measure_xz, measure_zx):
            with self.subTest(measure=measure.__name__):
                counts = measure(shots=self.SHOTS, seed=42)
                self.assertTrue(0.45 < agreement_fraction(counts) < 0.55)
                for count in counts.values():
                    self.assertTrue(0.20 < count / self.SHOTS < 0.30)

    def test_exact_basis_probabilities(self):
        # Verify the quantum distributions independently of sampled statistics.
        for alice, bob in (("Z", "Z"), ("X", "X"), ("X", "Z"), ("Z", "X")):
            with self.subTest(alice=alice, bob=bob):
                circuit = measurement_circuit(alice, bob)
                state = Statevector.from_instruction(circuit.remove_final_measurements(inplace=False))
                expected = [0.5, 0, 0, 0.5] if alice == bob else [0.25] * 4
                for actual, target in zip(state.probabilities(), expected):
                    self.assertAlmostEqual(float(actual), target, places=12)

    def test_counts_are_json_ready_and_sum_to_shots(self):
        for alice, bob in (("Z", "Z"), ("X", "X"), ("X", "Z"), ("Z", "X")):
            with self.subTest(alice=alice, bob=bob):
                counts = measure_bell(alice, bob, shots=123, seed=7)
                self.assertEqual(set(counts), {"00", "01", "10", "11"})
                self.assertEqual(sum(counts.values()), 123)
                self.assertTrue(all(type(count) is int for count in counts.values()))
                self.assertEqual(json.loads(json.dumps(counts)), counts)

    def test_alice_bob_output_order(self):
        # The Bell distributions are symmetric, so check the actual classical
        # wiring too: Qiskit prints Bob's classical bit first.
        circuit = measurement_circuit("X", "Z")
        measurements = [item for item in circuit.data if item.operation.name == "measure"]
        wiring = [
            (circuit.find_bit(item.qubits[0]).index, circuit.find_bit(item.clbits[0]).index)
            for item in measurements
        ]
        self.assertEqual(wiring, [(0, 0), (1, 1)])
        self.assertEqual(circuit.data[2].operation.name, "h")
        self.assertEqual(circuit.find_bit(circuit.data[2].qubits[0]).index, 0)

    def test_seed_is_reproducible(self):
        self.assertEqual(measure_xz(seed=23), measure_xz(seed=23))

    def test_agreement_fraction_uses_measured_total(self):
        self.assertEqual(agreement_fraction({"00": 3, "01": 1, "10": 2, "11": 4}), 0.7)
        self.assertEqual(agreement_fraction({"11": 5}), 1.0)
        self.assertEqual(agreement_fraction({"01": 5}), 0.0)

    def test_invalid_bases(self):
        for alice, bob in (("Y", "Z"), ("Z", "Y"), ("x", "Z"), ("", "Z")):
            with self.subTest(alice=alice, bob=bob):
                with self.assertRaises(ValueError):
                    measure_bell(alice, bob)

    def test_invalid_shots(self):
        for shots in (0, -1, 2.5, True, "10"):
            with self.subTest(shots=shots):
                with self.assertRaises(ValueError):
                    measure_zz(shots=shots)

    def test_invalid_counts(self):
        for counts in ({}, {"00": 0}, {"000": 1}, {"00": -1}, {"00": 1.5}, {"00": True}):
            with self.subTest(counts=counts):
                with self.assertRaises(ValueError):
                    agreement_fraction(counts)

    def test_selected_gate_changes_the_actual_quantum_state(self):
        for gate, expected in (("H", [2 ** -0.5, 0, 0, 2 ** -0.5]),
                               ("X", [0, 0, 0, 1]), ("Z", [1, 0, 0, 0]),
                               ("S", [1, 0, 0, 0])):
            with self.subTest(gate=gate):
                circuit = prepare_bell(gate)
                self.assertEqual(circuit.data[0].operation.name, gate.lower())
                self.assertTrue(Statevector.from_instruction(circuit).equiv(Statevector(expected)))
                self.assertAlmostEqual(preparation_fidelity(gate), 1 if gate == "H" else 0.5)

    def test_matching_bits_do_not_prove_bell_preparation(self):
        for gate in ("X", "Z", "S"):
            counts = measure_bell("Z", "Z", preparation_gate=gate, shots=256, seed=12)
            self.assertEqual(agreement_fraction(counts), 1)
            self.assertLess(preparation_fidelity(gate), 0.99)
            counts = measure_bell("X", "X", preparation_gate=gate, shots=self.SHOTS, seed=12)
            self.assertTrue(0.45 < agreement_fraction(counts) < 0.55)

    def test_observed_correlation_statistics(self):
        for counts, agreement, correlation, kind in (
            ({"00": 5, "11": 5}, 1, 1, "correlated"),
            ({"01": 5, "10": 5}, 0, -1, "anticorrelated"),
            ({"00": 4, "01": 6}, 0.4, -0.2, "random"),
        ):
            stats = correlation_statistics(counts)
            self.assertEqual(stats["agreement"], agreement)
            self.assertAlmostEqual(stats["correlation"], correlation)
            self.assertEqual(stats["correlation_type"], kind)

    def test_invalid_preparation_gates(self):
        for gate in ("Y", "h", "", None):
            with self.assertRaises(ValueError):
                prepare_bell(gate)
            with self.assertRaises(ValueError):
                measure_bell(preparation_gate=gate)


if __name__ == "__main__":
    unittest.main()
