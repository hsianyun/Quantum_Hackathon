"""Small educational Fourier utilities. No factoring or game rules."""
from math import pi
from math import gcd
from functools import reduce
from fractions import Fraction
from copy import deepcopy
from time import monotonic
from uuid import uuid4
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


def expected_peaks(num_qubits, period):
    """Analytic support for clean divisor states; checked against real QFT."""
    periodic_state(num_qubits, period)
    return list(range(0, 2 ** num_qubits, 2 ** num_qubits // period))


_radio_scenarios = {}
_radio_trials = {}
_RADIO_TTL = 1800
_RADIO_LIMIT = 32


def _expire_radio():
    for key in list(_radio_scenarios):
        if monotonic() - _radio_scenarios[key]["created"] >= _RADIO_TTL:
            close_radio(key)


def _radio_scenario(scenario_id):
    _expire_radio()
    if not isinstance(scenario_id, str) or scenario_id not in _radio_scenarios:
        raise ValueError("Radio scenario is missing, closed or expired; replace it to continue.")
    return _radio_scenarios[scenario_id]


def _radio_trial(trial_id):
    _expire_radio()
    if not isinstance(trial_id, str) or trial_id not in _radio_trials:
        raise ValueError("Radio trial is missing, discarded or expired.")
    return _radio_trials[trial_id]


def open_radio(mode, *, scenario=None, seed=None):
    if mode not in ("guided", "blind"):
        raise ValueError("Radio mode must be guided or blind.")
    candidates = (2, 4) if mode == "guided" else (2, 4, 8)
    if scenario is not None and (isinstance(scenario, bool) or not isinstance(scenario, int) or scenario not in candidates):
        raise ValueError("Unsupported radio scenario.")
    _expire_radio()
    if len(_radio_scenarios) >= _RADIO_LIMIT:
        raise ValueError("Too many radio scenarios; close an old scenario first.")
    # Randomness chooses a teaching setup, never a measurement histogram.
    period = scenario if scenario is not None else int(np.random.default_rng(seed).choice(candidates))
    scenario_id = uuid4().hex
    _radio_scenarios[scenario_id] = {"mode": mode, "period": period, "created": monotonic(), "trial_id": None}
    result = {"experiment": "radio", "status": "ok", "scenario_id": scenario_id,
              "mode": mode, "num_qubits": 4, "register_size": 16,
              "bit_order": "q3q2q1q0", "transform_sign": "positive"}
    if mode == "guided":
        probabilities = periodic_state(4, period).probabilities()
        result["input_positions"] = [i for i, p in enumerate(probabilities) if p > 0]
    return result


def _candidate(value, choices, label):
    if isinstance(value, bool) or not isinstance(value, int) or value not in choices:
        raise ValueError(f"Unsupported {label}.")


def measure_radio(scenario_id, predictions, shots, *, backend=None, seed=None):
    scenario = _radio_scenario(scenario_id)
    if not isinstance(predictions, dict):
        raise ValueError("Predictions must be a dictionary.")
    if scenario["mode"] == "guided":
        if set(predictions) != {"alice_period", "bob_spacing"}:
            raise ValueError("Commit both guided predictions before measurement.")
        _candidate(predictions["alice_period"], (2, 4), "Alice period")
        _candidate(predictions["bob_spacing"], (2, 4, 8), "Bob spacing")
    elif predictions:
        raise ValueError("Blind measurement takes no hidden-period prediction.")
    if isinstance(shots, bool) or not isinstance(shots, int) or not 256 <= shots <= 16384:
        raise ValueError("Radio shots must be an integer from 256 to 16384.")
    data = measure_periodic({"num_qubits": 4, "period": scenario["period"]}, shots, backend=backend, seed=seed)
    if scenario["trial_id"]:
        discard_radio(scenario["trial_id"])
    trial_id = uuid4().hex
    scenario["trial_id"] = trial_id
    result = {"experiment": "radio", "status": "ok", "mode": scenario["mode"],
              "scenario_id": scenario_id, "trial_id": trial_id, "register_size": 16,
              "num_qubits": 4, "shots": shots, "counts": data["counts"], "bit_order": "q3q2q1q0"}
    _radio_trials[trial_id] = {"scenario_id": scenario_id, "measurement": result,
                               "predictions": deepcopy(predictions), "claims": None, "verification": None}
    return deepcopy(result)


def commit_radio(trial_id, observations_text, phases_text):
    trial = _radio_trial(trial_id)
    if _radio_scenario(trial["scenario_id"])["mode"] != "blind":
        raise ValueError("Interpretation belongs to the blind radio.")
    if not isinstance(observations_text, str) or not isinstance(phases_text, str) or max(len(observations_text), len(phases_text)) > 256:
        raise ValueError("Enter comma-separated integers and phase fractions.")
    try:
        observed = [int(token.strip()) for token in observations_text.split(",")]
        phases = [Fraction(token.strip()) for token in phases_text.split(",")]
    except (ValueError, ZeroDivisionError) as error:
        raise ValueError("Enter comma-separated integers and valid phase fractions.") from error
    if not 1 <= len(observed) <= 8 or len(phases) != len(observed) or len(set(observed)) != len(observed) or len(set(phases)) != len(phases):
        raise ValueError("Use 1–8 distinct observations with one phase each, in the same order.")
    if any(not 0 <= y < 16 for y in observed) or any(not 0 <= phase < 1 or (phase * 16).denominator != 1 for phase in phases):
        raise ValueError("Readouts must be 0–15; phases must be multiples of 1/16 in [0,1).")
    claims = {"observations": observed, "phases": [str(phase) for phase in phases],
              "payload": "".join(format(int(phase * 16), "04b") for phase in phases)}
    if trial["claims"] is not None and trial["claims"] != claims:
        raise ValueError("This interpretation is already committed; start a new trial to revise it.")
    trial["claims"] = claims
    return {"experiment": "radio", "status": "ok", "trial_id": trial_id, **deepcopy(claims)}


def _spectrum_evidence(counts, period):
    expected = expected_peaks(4, period)
    maximum = max(counts.values())
    peaks = [int(bits, 2) for bits, count in counts.items() if count > 0 and count >= maximum * 0.5]
    spacing = reduce(gcd, (b - a for a, b in zip(peaks, peaks[1:])), 0) or None
    mass = sum(counts[format(y, "04b")] for y in expected) / sum(counts.values())
    consistent = mass >= 0.95 and peaks == expected and all(counts[format(y, "04b")] > 0 for y in expected)
    return peaks, spacing, consistent


def verify_radio(trial_id, bob_period=None):
    trial = _radio_trial(trial_id)
    scenario = _radio_scenario(trial["scenario_id"])
    if scenario["mode"] == "blind":
        _candidate(bob_period, (2, 4, 8), "Bob period")
        if trial["claims"] is None:
            raise ValueError("Commit Alice's readout/phase interpretation before Bob infers a period.")
    elif bob_period is not None:
        raise ValueError("Guided predictions were committed before measurement.")
    if trial["verification"] is not None:
        if trial["verification"]["bob_period"] != bob_period:
            raise ValueError("Bob's period is already committed for this trial.")
        return deepcopy(trial["verification"]["result"])
    peaks, spacing, consistent = _spectrum_evidence(trial["measurement"]["counts"], scenario["period"])
    if scenario["mode"] == "guided":
        alice_matches = trial["predictions"]["alice_period"] == scenario["period"]
        bob_matches = trial["predictions"]["bob_spacing"] == 16 // scenario["period"]
        diagnostic = "Compare the repeated input locations with the measured interference peaks and your two committed hypotheses."
    else:
        claims = trial["claims"]
        alice_matches = (sorted(claims["observations"]) == peaks and
                         all(Fraction(phase) == Fraction(y, 16) for y, phase in zip(claims["observations"], claims["phases"])))
        bob_matches = bob_period == scenario["period"]
        diagnostic = ("Recheck q3q2q1q0 readouts and each y/16 phase; the committed interpretation differs from the measured spectrum."
                      if not alice_matches else f"Your proposed period predicts spacing {16 // bob_period}; its phase pattern does not match all the observed peaks.")
    result = {"experiment": "radio", "status": "ok", "trial_id": trial_id,
              "alice_matches": alice_matches, "bob_matches": bob_matches,
              "spectrum_consistent": consistent, "diagnostic": diagnostic}
    if scenario["mode"] == "guided":
        result.update(observed_peaks=peaks, observed_spacing=spacing)
    if not consistent:
        result["diagnostic"] = "This finite spectrum does not support the clean divisor model. Check the selected simulator and collect another batch."
    if alice_matches and bob_matches and consistent:
        result.update(period=scenario["period"], observed_peaks=peaks, observed_spacing=spacing,
                      diagnostic="Your committed interpretation and prediction agree with the sampled Fourier spectrum.")
    trial["verification"] = {"bob_period": bob_period, "result": result}
    return deepcopy(result)


def discard_radio(trial_id):
    if not isinstance(trial_id, str):
        raise ValueError("trial_id must be a string.")
    return {"experiment": "radio", "status": "ok", "discarded": _radio_trials.pop(trial_id, None) is not None}


def close_radio(scenario_id):
    if not isinstance(scenario_id, str):
        raise ValueError("scenario_id must be a string.")
    for key in list(_radio_trials):
        if _radio_trials[key]["scenario_id"] == scenario_id:
            del _radio_trials[key]
    return {"experiment": "radio", "status": "ok", "closed": _radio_scenarios.pop(scenario_id, None) is not None}
