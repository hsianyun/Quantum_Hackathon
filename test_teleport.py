"""Teleportation verification; the correction mapping stays in tests only."""

import cmath
import json
import math
import unittest

from qiskit.quantum_info import DensityMatrix, Statevector, state_fidelity

from teleport import prepare_state, teleport, teleportation_circuit


SQRT_HALF = math.sqrt(0.5)
STATES = (
    ("0", 0.0, 0.0, [1, 0]),
    ("1", math.pi, 0.0, [0, 1]),
    ("+", math.pi / 2, 0.0, [SQRT_HALF, SQRT_HALF]),
    ("-", math.pi / 2, math.pi, [SQRT_HALF, -SQRT_HALF]),
    ("+i", math.pi / 2, math.pi / 2, [SQRT_HALF, 1j * SQRT_HALF]),
    ("arbitrary", 1.1, 0.7, [math.cos(0.55), cmath.exp(0.7j) * math.sin(0.55)]),
)
CORRECTIONS = ("I", "X", "Z", "XZ")


def required_correction(bits):
    # Independent protocol expectation used only for verification.
    return ("X" if bits[1] else "") + ("Z" if bits[0] else "") or "I"


def bob_density(result):
    return DensityMatrix([
        [complex(*value) for value in row]
        for row in result["bob_state"]["density_matrix"]
    ])


class TeleportTests(unittest.TestCase):
    def branch_seeds(self, theta, phi):
        """Find reproducible measured trials for all four branches."""
        seeds = {}
        for seed in range(32):
            result = teleport(theta, phi, seed=seed)
            seeds.setdefault(tuple(result["alice_bits"]), seed)
            if len(seeds) == 4:
                break
        self.assertEqual(set(seeds), {(0, 0), (0, 1), (1, 0), (1, 1)})
        return seeds

    def test_prepare_named_and_arbitrary_states(self):
        for name, theta, phi, amplitudes in STATES:
            with self.subTest(state=name):
                circuit = prepare_state(theta, phi)
                self.assertEqual(circuit.num_qubits, 1)
                self.assertEqual(circuit.num_clbits, 0)
                actual = Statevector.from_instruction(circuit)
                for value, expected in zip(actual.data, amplitudes):
                    self.assertAlmostEqual(abs(value - expected), 0.0, places=12)

    def test_correct_correction_recovers_every_state_and_branch(self):
        for name, theta, phi, amplitudes in STATES:
            for bits, seed in self.branch_seeds(theta, phi).items():
                with self.subTest(state=name, bits=bits):
                    result = teleport(theta, phi, required_correction(bits), seed=seed)
                    self.assertEqual(result["alice_bits"], list(bits))
                    self.assertAlmostEqual(result["fidelity"], 1.0, places=12)
                    # Check the returned state independently of reported fidelity.
                    fidelity = state_fidelity(Statevector(amplitudes), bob_density(result))
                    self.assertAlmostEqual(float(fidelity), 1.0, places=12)

    def test_each_wrong_correction_fails_for_a_generic_state(self):
        _, theta, phi, amplitudes = STATES[-1]
        for bits, seed in self.branch_seeds(theta, phi).items():
            for correction in CORRECTIONS:
                if correction == required_correction(bits):
                    continue
                with self.subTest(bits=bits, correction=correction):
                    result = teleport(theta, phi, correction, seed=seed)
                    self.assertEqual(result["alice_bits"], list(bits))
                    self.assertLess(result["fidelity"], 0.9)
                    expected = state_fidelity(Statevector(amplitudes), bob_density(result))
                    self.assertAlmostEqual(result["fidelity"], float(expected), places=12)

    def test_wrong_corrections_can_produce_orthogonal_named_states(self):
        # On the 00 branch, I is correct. X flips Z eigenstates, Z flips X
        # eigenstates, and either X or Z flips the +i state to its orthogonal.
        wrong_choices = {"0": "X", "1": "X", "+": "Z", "-": "Z", "+i": "X"}
        for name, theta, phi, _ in STATES[:-1]:
            seed = self.branch_seeds(theta, phi)[(0, 0)]
            with self.subTest(state=name):
                result = teleport(theta, phi, wrong_choices[name], seed=seed)
                self.assertAlmostEqual(result["fidelity"], 0.0, places=12)

    def test_some_wrong_corrections_are_invisible_to_eigenstates(self):
        # A single eigenstate cannot identify every correction: global phase
        # is unobservable. Tests must not demand failure for every input.
        seed = self.branch_seeds(0, 0)[(0, 0)]
        self.assertAlmostEqual(teleport(0, 0, "Z", seed=seed)["fidelity"], 1.0, places=12)
        seed = self.branch_seeds(math.pi / 2, 0)[(0, 0)]
        self.assertAlmostEqual(
            teleport(math.pi / 2, 0, "X", seed=seed)["fidelity"], 1.0, places=12
        )

    def test_circuit_uses_three_qubits_two_classical_bits_and_selected_gates(self):
        for correction in CORRECTIONS:
            with self.subTest(correction=correction):
                circuit = teleportation_circuit(1.1, 0.7, correction)
                self.assertEqual((circuit.num_qubits, circuit.num_clbits), (3, 2))
                measurements = [item for item in circuit.data if item.operation.name == "measure"]
                wiring = [
                    (circuit.find_bit(item.qubits[0]).index, circuit.find_bit(item.clbits[0]).index)
                    for item in measurements
                ]
                self.assertEqual(wiring, [(0, 0), (1, 1)])
                last_measurement = max(
                    index for index, item in enumerate(circuit.data)
                    if item.operation.name == "measure"
                )
                gates = circuit.data[last_measurement + 1:]
                self.assertEqual(
                    [item.operation.name for item in gates],
                    [] if correction == "I" else list(correction.lower()),
                )
                self.assertTrue(all(circuit.find_bit(item.qubits[0]).index == 2 for item in gates))

    def test_bell_measurements_have_uniform_joint_distribution(self):
        circuit = teleportation_circuit(1.1, 0.7)
        state = Statevector.from_instruction(circuit.remove_final_measurements(inplace=False))
        for probability in state.probabilities(qargs=[0, 1]):
            self.assertAlmostEqual(float(probability), 0.25, places=12)
        # Actual sampled measurements exercise collapse, not fabricated bits.
        counts = {(0, 0): 0, (0, 1): 0, (1, 0): 0, (1, 1): 0}
        trials = 2048
        for seed in range(trials):
            bits = tuple(teleport(1.1, 0.7, seed=seed)["alice_bits"])
            counts[bits] += 1
        for count in counts.values():
            self.assertTrue(0.20 < count / trials < 0.30, counts)

    def test_json_output_and_phase_information(self):
        theta = phi = math.pi / 2
        seed = self.branch_seeds(theta, phi)[(0, 0)]
        result = teleport(theta, phi, seed=seed)
        self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)
        self.assertEqual(result["correction"], "I")
        self.assertEqual(result["alice_bits"], [0, 0])
        self.assertTrue(all(type(bit) is int for bit in result["alice_bits"]))
        bob = result["bob_state"]
        self.assertAlmostEqual(bob["probabilities"]["0"], 0.5, places=12)
        self.assertAlmostEqual(bob["probabilities"]["1"], 0.5, places=12)
        self.assertAlmostEqual(bob["bloch_vector"]["x"], 0.0, places=12)
        self.assertAlmostEqual(bob["bloch_vector"]["y"], 1.0, places=12)
        self.assertAlmostEqual(bob["bloch_vector"]["z"], 0.0, places=12)
        self.assertAlmostEqual(bob_density(result).data[0, 1].imag, -0.5, places=12)

    def test_returned_density_matrices_are_valid_pure_states(self):
        for correction in CORRECTIONS:
            with self.subTest(correction=correction):
                result = teleport(1.1, 0.7, correction, seed=13)
                density = bob_density(result)
                self.assertTrue(density.is_valid())
                self.assertAlmostEqual(float(density.purity().real), 1.0, places=12)
                self.assertAlmostEqual(sum(result["bob_state"]["probabilities"].values()), 1.0, places=12)

    def test_seed_is_reproducible(self):
        self.assertEqual(teleport(1.1, 0.7, "XZ", seed=19), teleport(1.1, 0.7, "XZ", seed=19))

    def test_invalid_angles(self):
        for value in (float("nan"), float("inf"), -float("inf"), True, "1", 1j, None):
            for theta, phi in ((value, 0), (0, value)):
                with self.subTest(theta=theta, phi=phi):
                    with self.assertRaises(ValueError):
                        prepare_state(theta, phi)
                    with self.assertRaises(ValueError):
                        teleport(theta, phi)

    def test_invalid_correction(self):
        for correction in ("Y", "ZX", "x", "", None, 0):
            with self.subTest(correction=correction):
                with self.assertRaises(ValueError):
                    teleport(0, 0, correction)


if __name__ == "__main__":
    unittest.main()
