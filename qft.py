"""Small educational Fourier utilities. No factoring or game rules."""
from math import pi
import numpy as np
from qiskit import QuantumCircuit, transpile
from qiskit.circuit.library import StatePreparation
from qiskit.primitives import StatevectorSampler
from qiskit.quantum_info import Statevector


def _register(num_qubits):
    if isinstance(num_qubits, bool) or not isinstance(num_qubits, int) or not 1 <= num_qubits <= 6:
        raise ValueError("num_qubits must be an integer from 1 to 6.")


def qft_circuit(num_qubits, inverse=False):
    """QFT amplitude exp(+2*pi*i*x*y/M)/sqrt(M), q0 least significant."""
    _register(num_qubits)
    if not isinstance(inverse, bool):
        raise ValueError("inverse must be a boolean.")
    circuit = QuantumCircuit(num_qubits, name="qft")
    for target in reversed(range(num_qubits)):
        circuit.h(target)
        for control in reversed(range(target)):
            circuit.cp(pi / 2 ** (target - control), control, target)
    for index in range(num_qubits // 2):
        circuit.swap(index, num_qubits - index - 1)
    return circuit.inverse() if inverse else circuit


def periodic_state(num_qubits, period, offset=0):
    _register(num_qubits)
    size = 2 ** num_qubits
    if isinstance(period, bool) or not isinstance(period, int) or period <= 0 or size % period != 0:
        raise ValueError("period must be a positive integer dividing the register size.")
    if isinstance(offset, bool) or not isinstance(offset, int) or not 0 <= offset < period:
        raise ValueError("offset must be an integer from zero to period-1.")
    amplitudes = np.zeros(size, dtype=complex)
    amplitudes[offset::period] = np.sqrt(period / size)
    return Statevector(amplitudes)


def periodic_circuit(num_qubits, period, offset=0, inverse=False):
    state = periodic_state(num_qubits, period, offset)
    transform = qft_circuit(num_qubits, inverse)
    circuit = QuantumCircuit(num_qubits, num_qubits)
    circuit.append(StatePreparation(state.data), range(num_qubits))
    circuit.compose(transform, inplace=True)
    circuit.measure(range(num_qubits), range(num_qubits))
    return circuit


def measure_periodic(config, shots, *, backend=None, seed=None):
    if isinstance(shots, bool) or not isinstance(shots, int) or shots <= 0:
        raise ValueError("shots must be a positive integer.")
    if not isinstance(config, dict) or set(config) - {"num_qubits", "period", "offset", "inverse"}:
        raise ValueError("Use num_qubits, period, offset and inverse in the QFT config.")
    n, period = config.get("num_qubits", 4), config.get("period", 4)
    offset, inverse = config.get("offset", 0), config.get("inverse", False)
    circuit = periodic_circuit(n, period, offset, inverse)
    if backend is None:
        raw = StatevectorSampler(seed=seed).run([circuit], shots=shots).result()[0].data.c.get_counts()
    else:
        # StatePreparation/controlled phase are decomposed for the chosen device.
        compiled = transpile(circuit, backend)
        raw = backend.run(compiled, shots=shots).result().get_counts()
    counts = {format(index, f"0{n}b"): 0 for index in range(2 ** n)}
    for key, value in raw.items():
        bits = key.replace(" ", "")
        if bits not in counts or isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError("Invalid QFT measurement counts.")
        counts[bits] += value
    if sum(counts.values()) != shots:
        raise ValueError("QFT measurement total does not match shots.")
    threshold = max(counts.values()) * 0.5
    dominant = [int(bits, 2) for bits, count in counts.items() if count > 0 and count >= threshold]
    return {"experiment": "qft", "status": "ok", "num_qubits": n, "register_size": 2 ** n,
            "period": period, "offset": offset, "inverse": inverse, "shots": shots,
            "counts": counts, "dominant_positions": dominant,
            "bit_order": "q[n-1]...q[0]", "transform_sign": "negative" if inverse else "positive"}
