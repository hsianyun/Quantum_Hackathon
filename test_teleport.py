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


class CalibrationTests(unittest.TestCase):
    def tearDown(self):
        import teleport as module
        module._trials.clear()

    def test_same_trial_recovery_all_states_and_branches(self):
        from teleport import prepare_calibration, finish_calibration, cancel_calibration
        for state in ("0", "+", "+i"):
            found = set()
            for seed in range(32):
                trial = prepare_calibration(state, "CX_H", seed=seed)
                bits = tuple(trial["alice_bits"])
                found.add(bits)
                self.assertNotIn("fidelity", trial)
                self.assertNotIn("bob_probabilities", trial)
                result = finish_calibration(trial["trial_id"], required_correction(bits))
                self.assertEqual(result["alice_bits"], list(bits))
                self.assertAlmostEqual(result["fidelity"], 1, places=12)
                self.assertEqual(json.loads(json.dumps(result, allow_nan=False)), result)
                cancel_calibration(trial["trial_id"])
                if len(found) == 4:
                    break
            self.assertEqual(len(found), 4)

    def test_incorrect_operation_and_pauli_have_physical_consequences(self):
        from teleport import prepare_calibration, finish_calibration, cancel_calibration
        for operation in ("H_CX", "CX_ONLY"):
            failures = []
            for state in ("0", "+", "+i"):
                trial = prepare_calibration(state, operation, seed=5)
                result = finish_calibration(trial["trial_id"], required_correction(trial["alice_bits"]))
                failures.append(result["fidelity"])
                cancel_calibration(trial["trial_id"])
            self.assertLess(min(failures), 0.9)
        trial = prepare_calibration("+", "CX_H", seed=4)
        correct = required_correction(trial["alice_bits"])
        wrong = {"I": "Z", "Z": "I", "X": "XZ", "XZ": "X"}[correct]
        self.assertAlmostEqual(finish_calibration(trial["trial_id"], wrong)["fidelity"], 0, places=12)

    def test_handle_retry_commit_cancel_expiry_and_bound(self):
        import teleport as module
        from unittest.mock import patch
        trial = module.prepare_calibration("0", "CX_H", seed=3)
        result = module.finish_calibration(trial["trial_id"], "I")
        result["alice_bits"][0] = 9
        self.assertNotEqual(module.finish_calibration(trial["trial_id"], "I")["alice_bits"][0], 9)
        with self.assertRaisesRegex(ValueError, "committed"):
            module.finish_calibration(trial["trial_id"], "X")
        self.assertTrue(module.cancel_calibration(trial["trial_id"])["cancelled"])
        self.assertFalse(module.cancel_calibration(trial["trial_id"])["cancelled"])
        with self.assertRaises(ValueError):
            module.finish_calibration(trial["trial_id"], "I")
        trial = module.prepare_calibration("0", "CX_H")
        with patch("teleport.monotonic", return_value=module._trials[trial["trial_id"]]["created"] + 1801):
            with self.assertRaisesRegex(ValueError, "expired"):
                module.finish_calibration(trial["trial_id"], "I")
        with patch("teleport._MAX_TRIALS", 1):
            module.prepare_calibration("0", "CX_H")
            with self.assertRaisesRegex(ValueError, "Too many"):
                module.prepare_calibration("0", "CX_H")

    def test_selected_simulator_and_bit_wiring(self):
        from teleport import calibration_circuit, prepare_calibration, finish_calibration
        from qiskit.providers.basic_provider import BasicSimulator
        from unittest.mock import patch, Mock
        circuit = calibration_circuit("+i", "CX_H")
        wiring = [(circuit.find_bit(i.qubits[0]).index, circuit.find_bit(i.clbits[0]).index)
                  for i in circuit.data if i.operation.name == "measure"]
        self.assertEqual(wiring, [(0, 0), (1, 1)])
        backend = BasicSimulator(seed_simulator=4)
        with patch.object(backend, "run", wraps=backend.run) as run:
            trial = prepare_calibration("+i", "CX_H", backend=backend)
            self.assertEqual(run.call_count, 1)
            self.assertEqual(run.call_args.kwargs, {"shots": 1})
            result = finish_calibration(trial["trial_id"], required_correction(trial["alice_bits"]))
            self.assertAlmostEqual(result["fidelity"], 1, places=12)
            self.assertEqual(run.call_count, 1)
        hardware = Mock()
        hardware.configuration.return_value.simulator = False
        with self.assertRaisesRegex(ValueError, "unsupported"):
            prepare_calibration("0", "CX_H", backend=hardware)
        hardware.run.assert_not_called()
        with patch.object(backend, "run", side_effect=RuntimeError("backend broken")):
            with self.assertRaisesRegex(RuntimeError, "backend broken"):
                prepare_calibration("0", "CX_H", backend=backend)
        with patch.object(backend, "run") as run:
            run.return_value.result.return_value.get_counts.return_value = {"01": 1}
            trial = prepare_calibration("0", "CX_H", backend=backend)
            self.assertEqual(trial["alice_bits"], [1, 0])

    def test_invalid_inputs_never_create_handles(self):
        from teleport import prepare_calibration, finish_calibration
        for state, operation in ((None, "CX_H"), ("1", "CX_H"), ("0", "bad")):
            with self.assertRaises(ValueError):
                prepare_calibration(state, operation)
        with self.assertRaises(ValueError):
            finish_calibration("missing", "I")


if __name__ == "__main__":
    unittest.main()
