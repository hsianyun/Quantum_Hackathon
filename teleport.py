"""Stage 2 teleportation experiments using measured Qiskit circuits.

Qubit 0 is Alice's input, qubit 1 is Alice's Bell-pair half, and qubit 2
belongs to Bob. Alice's returned bits are ordered [qubit 0, qubit 1],
matching classical bits [0, 1], rather than Qiskit's displayed bit order.
No automatic correction or answer mapping is supplied to the game.
"""

from math import isfinite
from numbers import Real

from qiskit import QuantumCircuit
from qiskit.quantum_info import Pauli, Statevector, partial_trace, state_fidelity

from bell import prepare_bell


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
