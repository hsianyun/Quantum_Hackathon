"""Complementary Bell-link tests with a physically measured Z interceptor."""
from time import monotonic
from uuid import uuid4

import numpy as np
from qiskit import QuantumCircuit
from qiskit.primitives import StatevectorSampler
from bell import prepare_bell, correlation_statistics

_links = {}
_TTL = 1800


def warden_circuit(basis_a, basis_b, attack="ideal"):
    if basis_a not in ("X", "Z") or basis_b not in ("X", "Z"):
        raise ValueError("Warden bases must be X or Z.")
    if attack not in ("ideal", "z"):
        raise ValueError("Attack must be ideal or z.")
    circuit = QuantumCircuit(3, 3)
    circuit.compose(prepare_bell(), [0, 1], inplace=True)
    if attack == "z":
        # Warden records Bob's computational bit. Discarding this measured
        # ancilla removes |00><11| coherence without changing ZZ populations.
        circuit.cx(1, 2)
    for qubit, basis in enumerate((basis_a, basis_b)):
        if basis == "X":
            circuit.h(qubit)
    circuit.measure([0, 1, 2], [0, 1, 2])
    return circuit


def _expire():
    for link in list(_links):
        if monotonic() - _links[link]["created"] >= _TTL:
            del _links[link]


def open_link(*, scenario=None, seed=None):
    if scenario is not None and scenario not in ("ideal", "z"):
        raise ValueError("Scenario must be ideal or z.")
    _expire()
    if len(_links) >= 32:
        raise ValueError("Too many retained links; close old links before retrying.")
    # This selects a classical teaching scenario, never fabricated measurements.
    attack = scenario if scenario is not None else str(np.random.default_rng(seed).choice(["ideal", "z"]))
    link_id = uuid4().hex
    _links[link_id] = {"attack": attack, "created": monotonic()}
    return {"experiment": "warden", "status": "ok", "link_id": link_id}


def close_link(link_id):
    if not isinstance(link_id, str):
        raise ValueError("link_id must be a string.")
    return {"experiment": "warden", "status": "ok", "link_id": link_id,
            "closed": _links.pop(link_id, None) is not None}


def measure_link(config, shots, *, backend=None, seed=None):
    if isinstance(shots, bool) or not isinstance(shots, int) or shots <= 0:
        raise ValueError("shots must be a positive integer.")
    if not isinstance(config, dict) or set(config) - {"basis_a", "basis_b", "attack", "link_id"}:
        raise ValueError("Use a Warden config with basis_a, basis_b and attack or link_id.")
    if "attack" in config and "link_id" in config:
        raise ValueError("Specify either attack or link_id, not both.")
    attack = config.get("attack", "ideal")
    link_id = config.get("link_id")
    if "link_id" in config:
        _expire()
        if not isinstance(link_id, str) or link_id not in _links:
            raise ValueError("Hidden link is missing, closed or expired.")
        attack = _links[link_id]["attack"]
    a, b = config.get("basis_a", "Z"), config.get("basis_b", "Z")
    circuit = warden_circuit(a, b, attack)
    if backend is None:
        raw = StatevectorSampler(seed=seed).run([circuit], shots=shots).result()[0].data.c.get_counts()
    else:
        raw = backend.run(circuit, shots=shots).result().get_counts()
    counts = dict.fromkeys(("00", "01", "10", "11"), 0)
    for key, value in raw.items():
        bits = key.replace(" ", "")
        if len(bits) != 3 or any(bit not in "01" for bit in bits) or isinstance(value, bool) or not isinstance(value, int) or value < 0:
            raise ValueError("Invalid Warden measurement counts.")
        counts[bits[::-1][:2]] += value
    if sum(counts.values()) != shots:
        raise ValueError("Warden measurement total does not match shots.")
    stats = correlation_statistics(counts)
    matched = a == b
    return {"experiment": "warden", "status": "ok", "basis_a": a, "basis_b": b,
            "shots": shots, "link_id": link_id, "counts": counts, **stats,
            "matched_shots": shots if matched else 0,
            "qber": 1 - stats["agreement"] if matched else None,
            "qber_status": "measured" if matched else "unavailable"}
