"""JSON-compatible experiment boundary for callers outside the quantum core.

No Qiskit objects, correction suggestions, game rules, or success thresholds
are exposed here. Existing low-level circuit APIs remain available for Python
callers. Every implemented experiment returns status='ok'; unavailable
mechanics return status='not_implemented' with an explicit error message.
Invalid arguments raise ValueError rather than producing experiment results.
"""

import json
from statistics import fmean

from bell import correlation_statistics, measure_bell, preparation_fidelity
from teleport import teleport, prepare_calibration, finish_calibration, cancel_calibration
from warden import measure_link, open_link, close_link
from qft import measure_periodic

__all__ = [
    "bell_experiment",
    "teleport_experiment",
    "warden_experiment",
    "period_experiment",
    "teleport_prepare", "teleport_finish", "teleport_cancel",
    "warden_open", "warden_close",
    "qft_experiment",
]


def _validate_shots(shots: int) -> None:
    if isinstance(shots, bool) or not isinstance(shots, int) or shots <= 0:
        raise ValueError("shots must be a positive integer.")


def bell_experiment(
    basis_a: str, basis_b: str, shots: int, *,
    preparation_gate: str = "H", seed: int | None = None,
    backend=None,
) -> dict:
    """Return X/Z data using the caller's backend, or ideal local simulation.

    Preparation fidelity describes the ideal circuit, not device tomography.
    The backend is input-only and never appears in the JSON result.
    """
    _validate_shots(shots)
    counts = measure_bell(basis_a, basis_b, shots=shots, preparation_gate=preparation_gate,
                          seed=seed, backend=backend)
    return {
        "experiment": "bell",
        "status": "ok",
        "shots": shots,
        "basis_a": basis_a,
        "basis_b": basis_b,
        "counts": counts,
        "preparation_gate": preparation_gate,
        "preparation_fidelity": preparation_fidelity(preparation_gate),
        "preparation_fidelity_source": "ideal_circuit",
        **correlation_statistics(counts),
    }


def teleport_experiment(
    theta: float, phi: float, bob_correction: str, shots: int
) -> dict:
    """Return independent teleportation trials using the caller's fixed correction.

    Counts describe Alice's two bits in [input, Alice's Bell half] order.
    Each trial contains its own Bob state and fidelity; mean_fidelity is the
    arithmetic mean across trials, not fidelity of an averaged quantum state.
    """
    _validate_shots(shots)
    trials = [teleport(theta, phi, bob_correction) for _ in range(shots)]
    counts = dict.fromkeys(("00", "01", "10", "11"), 0)
    for trial in trials:
        counts["".join(str(bit) for bit in trial["alice_bits"])] += 1
    return {
        "experiment": "teleport",
        "status": "ok",
        "shots": shots,
        "bob_correction": bob_correction,
        "counts": counts,
        "trials": trials,
        "mean_fidelity": fmean(trial["fidelity"] for trial in trials),
    }


def _unavailable_experiment(name: str, config: dict, shots: int) -> dict:
    _validate_shots(shots)
    if not isinstance(config, dict):
        raise ValueError("config must be a JSON-compatible dictionary.")
    try:
        json.dumps(config, allow_nan=False)
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError("config must be a JSON-compatible dictionary.") from error
    return {
        "experiment": name,
        "status": "not_implemented",
        "shots": shots,
        "error": {
            "code": "not_implemented",
            "message": f"Quantum mechanics for {name} are not implemented yet.",
        },
    }


def warden_experiment(config: dict, shots: int, *, backend=None, seed=None) -> dict:
    """Complementary link statistics; a hidden link's attack is not disclosed."""
    return measure_link(config, shots, backend=backend, seed=seed)


def warden_open(*, scenario=None, seed=None):
    return open_link(scenario=scenario, seed=seed)


def warden_close(link_id):
    return close_link(link_id)


def period_experiment(config: dict, shots: int) -> dict:
    """Report unavailable mechanics until period.py is implemented."""
    return _unavailable_experiment("period", config, shots)


def teleport_prepare(state_name, operation, *, backend=None, seed=None):
    return prepare_calibration(state_name, operation, backend=backend, seed=seed)


def teleport_finish(trial_id, correction):
    return finish_calibration(trial_id, correction)


def teleport_cancel(trial_id):
    return cancel_calibration(trial_id)


def qft_experiment(config, shots, *, backend=None, seed=None):
    """Small periodic-state Fourier data; not a factoring experiment."""
    return measure_periodic(config, shots, backend=backend, seed=seed)
