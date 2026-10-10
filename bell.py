"""Stage 1 Bell experiments, independent of the game and UI.

Qubit 0 belongs to Alice; qubit 1 belongs to Bob. Returned count keys
are always Alice then Bob (the reverse of Qiskit's displayed bit order).
In the X basis, bit 0 denotes |+> and bit 1 denotes |->.
"""

from collections.abc import Mapping

from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import Statevector, state_fidelity


def prepare_bell(preparation_gate: str = "H") -> QuantumCircuit:
    """Apply the selected gate to Alice, then CX; H prepares |Phi+>.

    Other choices deliberately model incomplete/incorrect preparation. The
    default preserves the original Bell and teleportation circuit APIs.
    """
    if preparation_gate not in ("H", "X", "Z", "S"):
        raise ValueError("Preparation gate must be H, X, Z, or S.")
    name = "phi_plus" if preparation_gate == "H" else f"preparation_{preparation_gate.lower()}"
    circuit = QuantumCircuit(2, name=name)
    getattr(circuit, preparation_gate.lower())(0)
    circuit.cx(0, 1)
    return circuit


def measurement_circuit(
    alice_basis: str, bob_basis: str, *, preparation_gate: str = "H"
) -> QuantumCircuit:
    """Prepare a Bell pair and measure each qubit in its requested X/Z basis."""
    if alice_basis not in ("X", "Z") or bob_basis not in ("X", "Z"):
        raise ValueError("Each measurement basis must be 'X' or 'Z'.")

    circuit = prepare_bell(preparation_gate)
    for qubit, basis in enumerate((alice_basis, bob_basis)):
        if basis == "X":
            circuit.h(qubit)
    circuit.measure_all()
    return circuit


def measure_bell(
    alice_basis: str = "Z",
    bob_basis: str = "Z",
    *,
    shots: int = 1024,
    seed: int | None = None,
    preparation_gate: str = "H",
    backend=None,
) -> dict[str, int]:
    """Sample the circuit and return JSON-ready Alice/Bob outcome counts.

    All four keys (00, 01, 10, 11) are included, even for zero counts.
    With backend=None this is an ideal local simulation; seed optionally makes
    it reproducible. Otherwise use the caller's backend without choosing a
    device or overriding its sampling options. Backend errors propagate.
    """
    if isinstance(shots, bool) or not isinstance(shots, int) or shots <= 0:
        raise ValueError("shots must be a positive integer.")

    circuit = measurement_circuit(alice_basis, bob_basis, preparation_gate=preparation_gate)
    if backend is None:
        sampler = StatevectorSampler(seed=seed)
        result = sampler.run([circuit], shots=shots).result()[0]
        qiskit_counts = result.data.meas.get_counts()
    else:
        qiskit_counts = backend.run(circuit, shots=shots).result().get_counts()
    return {
        outcome: int(qiskit_counts.get(outcome[::-1], 0))
        for outcome in ("00", "01", "10", "11")
    }


def measure_zz(*, shots: int = 1024, seed: int | None = None) -> dict[str, int]:
    """Measure Alice in Z and Bob in Z."""
    return measure_bell("Z", "Z", shots=shots, seed=seed)


def measure_xx(*, shots: int = 1024, seed: int | None = None) -> dict[str, int]:
    """Measure Alice in X and Bob in X."""
    return measure_bell("X", "X", shots=shots, seed=seed)


def measure_xz(*, shots: int = 1024, seed: int | None = None) -> dict[str, int]:
    """Measure Alice in X and Bob in Z."""
    return measure_bell("X", "Z", shots=shots, seed=seed)


def measure_zx(*, shots: int = 1024, seed: int | None = None) -> dict[str, int]:
    """Measure Alice in Z and Bob in X."""
    return measure_bell("Z", "X", shots=shots, seed=seed)


def agreement_fraction(counts: Mapping[str, int]) -> float:
    """Return (counts['00'] + counts['11']) / total, rejecting empty data."""
    for outcome, count in counts.items():
        if outcome not in ("00", "01", "10", "11"):
            raise ValueError("Count keys must be two-bit Alice/Bob outcomes.")
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("Counts must be nonnegative integers.")
    total = sum(counts.values())
    if total == 0:
        raise ValueError("At least one measurement is required.")
    return (counts.get("00", 0) + counts.get("11", 0)) / total


def preparation_fidelity(preparation_gate: str = "H") -> float:
    """Exact simulator overlap with Phi+, independent of measurement basis."""
    prepared = Statevector.from_instruction(prepare_bell(preparation_gate))
    amplitude = 2 ** -0.5
    target = Statevector([amplitude, 0, 0, amplitude])
    return float(min(1.0, max(0.0, state_fidelity(prepared, target))))


def correlation_statistics(counts: Mapping[str, int]) -> dict:
    """Observed binary correlation; labels describe strong (>=90%) agreement.

    'random' denotes neither strong correlation nor strong anticorrelation,
    not a proof of randomness. For the ideal circuits sampled here, 1024 or
    more shots cleanly separate deterministic and uncorrelated outcomes.
    """
    agreement = agreement_fraction(counts)
    kind = "correlated" if agreement >= 0.9 else "anticorrelated" if agreement <= 0.1 else "random"
    return {"agreement": agreement, "correlation": 2 * agreement - 1, "correlation_type": kind}
