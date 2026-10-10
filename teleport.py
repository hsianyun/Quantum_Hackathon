"""Stage 2 teleportation experiments using measured Qiskit circuits.

Qubit 0 is Alice's input, qubit 1 is Alice's Bell-pair half, and qubit 2
belongs to Bob. Alice's returned bits are ordered [qubit 0, qubit 1],
matching classical bits [0, 1], rather than Qiskit's displayed bit order.
No automatic correction or answer mapping is supplied to the game.
"""

from math import isfinite
from numbers import Real
from math import pi
from time import monotonic
from uuid import uuid4
from copy import deepcopy

import numpy as np

from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, Statevector, partial_trace, state_fidelity

from bell import prepare_bell

CALIBRATION_STATES = {"0": (0.0, 0.0), "+": (pi / 2, 0.0), "+i": (pi / 2, pi / 2)}
OPERATIONS = ("CX_H", "H_CX", "CX_ONLY")
_trials = {}
_TRIAL_TTL = 1800
_MAX_TRIALS = 32


def prepare_state(theta: float, phi: float) -> QuantumCircuit:
    """Prepare cos(theta/2)|0> + exp(i*phi)sin(theta/2)|1> (angles in radians).

    Return a one-qubit unmeasured circuit, consistent with prepare_bell().
    Any finite real angles are accepted; they need not be in a fixed range.
    """
    for name, angle in (("theta", theta), ("phi", phi)):
        if isinstance(angle, bool) or not isinstance(angle, Real) or not isfinite(angle):
            raise ValueError(f"{name} must be a finite real angle in radians.")
    circuit = QuantumCircuit(1, name="input_state")
    circuit.ry(float(theta), 0)
    circuit.p(float(phi), 0)
    return circuit


def teleportation_circuit(
    theta: float, phi: float, correction: str = "I"
) -> QuantumCircuit:
    """Build the three-qubit protocol with two measured classical bits.

    Bob's correction is the caller's explicit choice, independent of Alice's
    results. XZ applies an X gate followed by a Z gate (the opposite order
    differs only by a global phase). I leaves Bob's qubit unchanged.
    """
    if correction not in ("I", "X", "Z", "XZ"):
        raise ValueError("correction must be 'I', 'X', 'Z', or 'XZ'.")

    circuit = QuantumCircuit(3, 2, name="teleportation")
    circuit.compose(prepare_state(theta, phi), qubits=[0], inplace=True)
    circuit.compose(prepare_bell(), qubits=[1, 2], inplace=True)
    circuit.cx(0, 1)
    circuit.h(0)
    circuit.measure(0, 0)
    circuit.measure(1, 1)
    if "X" in correction:
        circuit.x(2)
    if "Z" in correction:
        circuit.z(2)
    return circuit


def teleport(
    theta: float,
    phi: float,
    correction: str = "I",
    *,
    seed: int | None = None,
) -> dict:
    """Run one ideal teleportation trial and return JSON-compatible results.

    Qiskit samples and collapses Alice's measurements from the simulated
    quantum state, then evolves Bob's chosen gates. The optional seed makes
    trials reproducible: repeating a seed and input lets callers compare
    different corrections for the same measurement outcome.

    bob_state contains a density matrix in |0>, |1> order, with complex
    entries encoded as [real, imaginary], Z-basis probabilities, and the
    Bloch vector. Fidelity is with the intended input, ignoring global phase.
    These exact diagnostics are simulation data, not hardware tomography.
    """
    circuit = teleportation_circuit(theta, phi, correction)
    state = Statevector.from_int(0, 2 ** circuit.num_qubits)
    state.seed(seed)
    alice_bits = [0, 0]

    # Execute the actual circuit, including measurement collapse. A sampler
    # alone would provide classical bits without Bob's surviving quantum state.
    for instruction in circuit.data:
        qubits = [circuit.find_bit(qubit).index for qubit in instruction.qubits]
        if instruction.operation.name == "measure":
            outcome, state = state.measure(qubits)
            classical_bit = circuit.find_bit(instruction.clbits[0]).index
            alice_bits[classical_bit] = int(outcome)
        else:
            state = state.evolve(instruction.operation, qargs=qubits)

    bob = partial_trace(state, [0, 1])
    target = Statevector.from_instruction(prepare_state(theta, phi))
    fidelity = float(state_fidelity(target, bob))
    return {
        "alice_bits": alice_bits,
        "correction": correction,
        "bob_state": {
            "density_matrix": [
                [[float(value.real), float(value.imag)] for value in row]
                for row in bob.data
            ],
            "probabilities": {
                str(bit): float(probability)
                for bit, probability in enumerate(bob.probabilities())
            },
            "bloch_vector": {
                axis.lower(): float(bob.expectation_value(Pauli(axis)).real)
                for axis in ("X", "Y", "Z")
            },
        },
        "fidelity": max(0.0, min(1.0, fidelity)),
    }


def calibration_circuit(state_name, operation):
    """Alice's actual operation, q0/q1 -> c0/c1; q2 stays unmeasured."""
    if not isinstance(state_name, str) or state_name not in CALIBRATION_STATES:
        raise ValueError("Calibration state must be 0, +, or +i.")
    if operation not in OPERATIONS:
        raise ValueError("Operation must be CX_H, H_CX, or CX_ONLY.")
    circuit = QuantumCircuit(3, 2)
    circuit.compose(prepare_state(*CALIBRATION_STATES[state_name]), [0], inplace=True)
    circuit.compose(prepare_bell(), [1, 2], inplace=True)
    if operation == "H_CX":
        circuit.h(0)
    circuit.cx(0, 1)
    if operation == "CX_H":
        circuit.h(0)
    circuit.measure(0, 0)
    circuit.measure(1, 1)
    return circuit


def _check_calibration_backend(backend):
    """Only explicitly ideal simulator diagnostics; never substitute a device."""
    if backend is None:
        return
    from qiskit.providers.basic_provider import BasicSimulator
    supported = isinstance(backend, BasicSimulator)
    if not supported:
        configuration = getattr(backend, "configuration", None)
        supported = callable(configuration) and getattr(configuration(), "simulator", False) is True
    options = getattr(backend, "options", None)
    if not supported or getattr(options, "noise_model", None) is not None or getattr(options, "initial_statevector", None) is not None:
        raise ValueError("Calibration requires an ideal local simulator; hardware/noisy/unknown backends are unsupported.")


def _expire_trials():
    now = monotonic()
    for key in list(_trials):
        if now - _trials[key]["created"] >= _TRIAL_TTL:
            del _trials[key]


def prepare_calibration(state_name, operation, *, backend=None, seed=None):
    """Measure once; only an opaque handle and Alice's bits leave Python."""
    circuit = calibration_circuit(state_name, operation)
    _check_calibration_backend(backend)
    _expire_trials()
    if len(_trials) >= _MAX_TRIALS:
        raise ValueError("Too many retained calibration trials; cancel/reset before retrying.")
    state = Statevector.from_instruction(circuit.remove_final_measurements(inplace=False))
    if backend is None:
        state.seed(seed)
        outcome, collapsed = state.measure([0, 1])
        bits = [int(bit) for bit in outcome[::-1]]
    else:
        # The selected backend supplies the real measurement outcome. Exact
        # conditional state/fidelity remains an explicitly ideal diagnostic.
        counts = backend.run(circuit, shots=1).result().get_counts()
        if len(counts) != 1 or list(counts.values()) != [1]:
            raise ValueError("Simulator returned an invalid one-shot measurement.")
        outcome = next(iter(counts)).replace(" ", "")
        if len(outcome) != 2 or any(bit not in "01" for bit in outcome):
            raise ValueError("Simulator returned invalid Alice bits.")
        bits = [int(bit) for bit in outcome[::-1]]
        data = np.array(state.data, copy=True)
        for index in range(len(data)):
            if [index & 1, (index >> 1) & 1] != bits:
                data[index] = 0
        norm = float(np.linalg.norm(data))
        if norm < 1e-12:
            raise ValueError("Simulator outcome is impossible for the ideal calibration circuit.")
        collapsed = Statevector(data / norm)
    trial_id = uuid4().hex
    metadata = {"experiment": "calibration", "status": "ok", "trial_id": trial_id,
                "state_name": state_name, "operation": operation, "alice_bits": bits,
                "diagnostic_source": "ideal_circuit"}
    _trials[trial_id] = {"created": monotonic(), "metadata": metadata,
                         "bob": partial_trace(collapsed, [0, 1]),
                         "target": Statevector.from_instruction(prepare_state(*CALIBRATION_STATES[state_name])),
                         "result": None}
    return deepcopy(metadata)


def finish_calibration(trial_id, correction):
    """Correction is committed once. Same-correction retries are idempotent."""
    if correction not in ("I", "X", "Z", "XZ"):
        raise ValueError("Correction must be I, X, Z, or XZ.")
    _expire_trials()
    if not isinstance(trial_id, str) or trial_id not in _trials:
        raise ValueError("Calibration trial is missing, cancelled or expired.")
    trial = _trials[trial_id]
    if trial["result"] is not None:
        if trial["result"]["correction"] != correction:
            raise ValueError("This trial's correction is already committed.")
        return deepcopy(trial["result"])
    bob = trial["bob"]
    for gate in correction:
        if gate != "I":
            bob = bob.evolve(Pauli(gate))
    fidelity = float(state_fidelity(trial["target"], bob))
    result = {**trial["metadata"], "correction": correction,
              "fidelity": min(1.0, max(0.0, fidelity)),
              "bob_probabilities": {str(i): float(p) for i, p in enumerate(bob.probabilities())}}
    trial["result"] = result
    return deepcopy(result)


def cancel_calibration(trial_id):
    if not isinstance(trial_id, str):
        raise ValueError("trial_id must be a string.")
    return {"experiment": "calibration", "status": "ok", "trial_id": trial_id,
            "cancelled": _trials.pop(trial_id, None) is not None}
