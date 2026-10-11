# Split Vault

A two-player asymmetric quantum escape-room game. The quantum core uses
real Qiskit circuits for Bell Lock, Teleportation Calibration, Warden and
small QFT utilities. The playable progression stops after Warden.
Bell Lock uses the simulator or QPU selected in Qollab. Python callers can
also run ideal statevector experiments locally, without a separate Aer installation.

## Qollab file layout

All project files are in the repository root, including Python modules,
JavaScript modules, tests, documentation, and preview images. Upload these
root-level files to Qollab. Do not upload `.git`, `.venv`, `.uv-cache`, or
generated `__pycache__` directories.

The project is limited to **90 project files**, as required by `AGENTS.md`.
Qollab automatically loads root-level `main.css`. All interface styles live
directly in that file, and `index.html` links to it for local preview as well.
Python imports now use `from bell import ...`, `from teleport import ...`,
and `from api import ...`; JavaScript imports use paths such as `./state.js`.

## Python setup and tests

Use Python 3.10 or newer from the repository root:

```sh
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
python -m unittest discover -v
```

## Bell experiments

```python
import json
from bell import agreement_fraction, measure_bell

counts = measure_bell("X", "Z", shots=4096, seed=42)
payload = {"counts": counts, "agreement": agreement_fraction(counts)}
print(json.dumps(payload))
```

`prepare_bell()` returns the unmeasured |Phi+> circuit.
Its optional `preparation_gate` argument accepts H, X, Z, or S; each choice
is applied to Alice before the controlled-X. H remains the default, preserving
existing Bell and teleportation callers. The other gates intentionally prepare
different states for Bell Lock experiments. `measurement_circuit` and
`measure_bell` also accept `preparation_gate` as a keyword argument.
`measurement_circuit(alice_basis, bob_basis)` adds basis rotations and
measurements. `measure_bell()` accepts `"X"` or `"Z"` independently for each
player. Convenience functions `measure_zz`, `measure_xx`, `measure_xz`, and
`measure_zx` accept the same keyword arguments `shots` and `seed`.

Counts are plain JSON-compatible dictionaries with all four keys `"00"`,
`"01"`, `"10"`, `"11"`. Each key is **Alice's bit followed by Bob's bit**;
the module reverses Qiskit's displayed bit order. For X measurements, 0
means |+> and 1 means |->. Values are integer shot counts and sum to `shots`.
The seed is optional and intended for reproducible experiments and tests.

`agreement_fraction(counts)` returns the share of matching outcomes, from
0 to 1. Empty/zero-total counts, malformed outcomes, negative/fractional
counts, invalid bases, and nonpositive/noninteger shots raise `ValueError`.

## Teleportation experiments

`teleport.prepare_state(theta, phi)` returns a one-qubit circuit for
`cos(theta/2)|0> + exp(i*phi) sin(theta/2)|1>`. Angles are finite real numbers
in radians. `teleportation_circuit(theta, phi, correction="I")` returns the
three-qubit circuit with Alice's Bell measurement and two classical bits.

```python
from math import pi
from teleport import teleport

trial = teleport(pi / 2, pi / 2, correction="X", seed=42)
print(json.dumps(trial))
```

`teleport(theta, phi, correction="I", *, seed=None)` runs one trial. The
caller explicitly chooses `I`, `X`, `Z`, or `XZ`; corrections are never
selected automatically. `XZ` applies X followed by Z. Repeating the same
input and seed preserves Alice's measurement outcome for comparing choices.

The JSON-compatible result contains:

- `alice_bits`: `[input_qubit_bit, alice_bell_qubit_bit]`, corresponding to
  classical bits `[0, 1]` (opposite Qiskit's displayed two-bit order).
- `correction`: the caller's chosen operation.
- `bob_state`: a density matrix in `|0>, |1>` order, with complex entries
  encoded as `[real, imaginary]`; Z-basis probabilities under keys `"0"`
  and `"1"`; and a Bloch vector with `x`, `y`, and `z` coordinates.
- `fidelity`: overlap with the intended input state, from 0 to 1.

Alice's outcomes are sampled and collapsed using Qiskit's statevector
measurement; Bob's gates evolve the resulting quantum state. Returned state
diagnostics are exact simulator information, rather than hardware tomography.
Invalid angles or corrections raise `ValueError`. No correction mapping is
returned; the game can reveal verification results after players commit.

## JSON experiment API

Frontend integrations should call functions in `api` through their
Python host. They return plain dictionaries that support `json.dumps()`;
callers do not need circuits, statevectors, or other Qiskit objects. Existing
Python circuit APIs remain available. This module supplies experiment data
and contains no game rules, answer mapping, or completion thresholds.

```python
from api import bell_experiment, teleport_experiment

print(json.dumps(bell_experiment("X", "X", 1024)))
print(json.dumps(teleport_experiment(1.1, 0.7, "Z", 16)))
```

- `bell_experiment(basis_a, basis_b, shots)` returns `experiment`, `status`,
  `shots`, `basis_a`, `basis_b`, Alice/Bob `counts`, and `agreement`.
  Optional keyword arguments `preparation_gate="H"` and `seed=None` preserve
  the three-argument API. The optional `backend` keyword accepts the device
  supplied by Qollab; omitting it preserves local ideal simulation. New diagnostics are `preparation_gate`,
  `preparation_fidelity` (exact simulator overlap with Phi+), `correlation`
  (2 times measured agreement minus 1), and `correlation_type`.
  The statistical labels are `correlated` for at least 90% agreement,
  `anticorrelated` for at most 10%, and `random` otherwise. Here random means
  neither strong correlation nor strong anticorrelation, not proof of randomness.
  `preparation_fidelity_source: "ideal_circuit"` explicitly identifies the
  fidelity as an ideal-circuit diagnostic, not hardware state tomography.
  No gate recommendations, level completion flags, or rewards are returned.
- `teleport_experiment(theta, phi, bob_correction, shots)` returns `experiment`,
  `status`, `shots`, `bob_correction`, Alice-bit `counts`, a `trials` list with
  each trial's bits/Bob state/fidelity, and `mean_fidelity`. Each shot runs an
  independent trial with the same caller-selected correction. Mean fidelity
  is the mean of the trial fidelities, not fidelity of an averaged state.
- `warden_experiment(config, shots, *, backend=None, seed=None)` now measures
  an ideal or intercepted link, with Alice-first counts and per-matched-basis
  QBER. Gameplay uses an opaque link from `warden_open()`; diagnostic callers
  may supply attack="ideal" or "z". `period_experiment(config, shots)` remains
  an explicitly unavailable reserved interface; N=15 period finding is deferred.
- `teleport_prepare`, `teleport_finish`, `teleport_cancel` provide the staged
  calibration protocol. `qft_experiment` exposes small Fourier utilities.
  See the current API contracts and verification evidence in `VERIFY.md`.

Warden and QFT configs accept Python dictionaries or JSON object text.
Their JavaScript adapters use `JSON.stringify(config)` because the Python
bridge may otherwise expose a JavaScript object as a JsProxy rather than a
dictionary. Update both `quantum-client.js` and `api.py` together in Qollab.

Implemented experiments return `status: "ok"`. Sampling functions require a
positive integer shot count; invalid arguments raise `ValueError`.

## Minimal game engine

The `state.js`, `resources.js`, and `levels.js` modules use browser-compatible ES modules and plain serializable
objects. Every transition returns a new state and leaves its arguments intact.
There are no UI or quantum dependencies.

```javascript
import { createInitialState } from "./state.js";
import { spendBellPairs, spendClassicalBits } from "./resources.js";
import { advanceLevel, resetLevel } from "./levels.js";

let state = createInitialState();
const checkpoint = { ...state }; // Capture at the start of each level.
state = spendBellPairs(state, 1);
state = spendClassicalBits(state, 2);
state = resetLevel(state, checkpoint); // Undo this level's changes.
state = advanceLevel(state);
```

Initial state: `currentAct: 1`, `currentLevel: 1`, `bellPairs: 12`,
`classicalBits: 20`, `wardenSuspicion: 0`, `vaultFragments: 0`.

`spendBellPairs`, `spendClassicalBits`, `awardFragments`, and
`increaseSuspicion` take `(state, amount = 1)`. Amounts are nonnegative safe
integers. Zero is allowed; overspending, invalid state values, and overflow
raise an error. Rewards and suspicion have no gameplay-specific caps.

`advanceLevel(state)` increments `currentLevel` within the current act.
`resetLevel(state, levelStartState)` restores the snapshot's counters and
returns a fresh copy; a checkpoint from another act or level is rejected.
The caller owns the checkpoint, so reset does not replenish resources or
erase fragments earned before the level started.

Run the lightweight JavaScript tests with Node's built-in test runner (no
dependencies or installation step required):

```sh
node --test test_game.mjs test_level_one.mjs test_quantum_client.mjs test_calibration.mjs test_security.mjs test_stage_select.mjs
# Or, with npm available: npm test
```

## Level 1: Bell Lock

Upload the root-level files to a **JS / Qiskit wrapper** project in Qollab.
Open **Run Project**, choose a **local simulator**, and press **Run**. Qollab
loads `index.html`, `main.css`, and `main.js`; no application server is needed.
A plain browser/static preview cannot execute the Python module imports.

`main.js` uses a static named Python import, matching the
[Qollab JavaScript guide](https://qollab.xyz/learn/building-your-first-qollab-project/run-in-javascript):

```javascript
import { bell_experiment } from "api";
import { createBellExperiment } from "./quantum-client.js";

// Qollab supplies backend from the Run dialog.
const runBell = createBellExperiment(bell_experiment, backend);
```

The adapter awaits `bell_experiment.callPromisingKwargs(...)`, passing the
selected backend and preparation gate as keyword arguments, then unpacks the
returned dictionary using `.toJs()`. Python builds and measures the circuit.
There is no dynamic Python import, global Pyodide dependency, HTTP endpoint,
server startup, or simulated JavaScript fallback. Import/execution errors are
surfaced rather than hidden by a transport fallback.

Choose a local simulator for repeated trials in the same page. IonQ backends
permit one job per Qollab Run; use **Stop** and **Run** to submit another. Game
state resets when Qollab starts a new run. Backend failures spend no game
resources and report the underlying error. See the
[Qollab runtime guide](https://qollab.xyz/learn/docs/runtime-environment).

Alice fills the missing gate in a two-qubit circuit (H/X/Z/S), commits that
preparation, then selects X or Z measurement. Bob predicts correlated,
anticorrelated, or random outcomes, selects X or Z, and commits both choices.
No request, measurements, verification, or explanation appears before both
players finish. Running locks all choices and reset until Python responds.

Each successful experiment request spends one Bell-pair **source credit**
and samples 1,024 independently prepared pairs in Qiskit. Credits are a game
budget for simulation batches, not a claim that one physical pair can be
measured 1,024 times. Counts, observed agreement, correlation classification,
and preparation fidelity are calculated exclusively in Python. The frontend
formats these values and compares Bob's committed prediction.

The lock opens when preparation fidelity with Phi+ is within 1e-9 of 1 and
Bob's prediction matches the observed classification. A fixed product state
that happens to agree in Z cannot open the lock. Completion awards exactly
one vault fragment and unlocks the expandable "Why this works" panel. Its
explanation is inserted only after completion. The fidelity check is exact
simulator information; it is not a hardware entanglement certification protocol.

New trials clear choices and results while retaining spending and notes.
Reset replenishes the level's resources and clears transmissions, retaining
notes, completion, and earned fragments. Further successful practice trials
cannot award another fragment. Failed or invalid backend responses spend
nothing and allow retry with the same commitments. The classical channel
accepts 1-8 binary digits and spends one classical bit per digit.

The two rooms stay side by side at laptop widths and stack below 700px.
Native buttons, labelled radio groups, focus indicators, live announcements,
and a modal notebook support keyboard operation. Escape closes the notebook
and restores focus. Session state lives in this tab; reload starts a new game.
This is a shared-device interface; multiplayer networking and later levels
are outside Level 1.

Verification commands:

```sh
python -m unittest discover -v
node --test test_game.mjs test_level_one.mjs test_quantum_client.mjs test_calibration.mjs test_security.mjs
```

The original foundation had 39 Python and 31 JavaScript unit tests. Current
expanded results and commands are recorded in `VERIFY.md`. Python tests run real
Qiskit circuits on a supplied backend for every gate and basis combination,
and verify count ordering and error propagation. Adapter tests verify the
async calling convention, backend forwarding, dictionary conversion, proxy
cleanup, retry, and the absence of any HTTP fallback.

An additional integration check calls the real Python/Qiskit API from
JavaScript over a test-only stdio adapter, then feeds results into the game:

```sh
npm run test:integration
# Or: node --test test_qollab_integration.mjs test_later_integration.mjs
```

It requires Python with `requirements.txt` installed. It uses the project
virtual environment if present; `SPLIT_VAULT_PYTHON` can select another Python
executable. The suites cover all 16 Bell gate/basis combinations, staged
calibration, hidden Warden links, QFT spectra and invalid requests without
starting an HTTP server. They substitute only for Qollab's call boundary;
it is not a hosted Qollab deployment test. Live Qollab execution still needs
verification in the platform.

The existing responsive previews are `level-1-desktop.png` and
`level-1-mobile.png`. All project files remain flat in the root, below the
90-file limit.


## Teleportation Calibration and Warden

Use the **Choose a stage** selector to open Bell Lock, Teleportation Calibration
or Warden directly; completing earlier stages is optional. Continue buttons
still follow the usual progression. Switching preserves each stage's choices,
spending, discoveries and completion, with shared notes and earned fragments.
Switching is disabled during pending experiments. Session progress is retained
until reload; changing stages does not replenish an existing stage's budget.

Choose an ideal
local simulator in Qollab. Alice chooses a known |0>, |+> or |+i> state and an
actual Bell-measurement operation, then commits and measures. Her two readout
bits are transmitted for two classical bits. Bob chooses and commits I/X/Z/XZ
before fidelity is revealed. The notebook starts without a correction table.
A single state can hide an incorrect Pauli; try different states to compare
phase and bit errors. Completion requires **four successful trials** with the
correct Bell-measurement operation and fidelity at least 1-1e-9. Repeated states
and measurement outcomes count, so there is no waiting for a random branch.
Wrong recovery or an incorrect measurement circuit does not advance progress.

One valid completed calibration experiment costs one source credit, including
wrong recovery. Its selected simulator really runs the measurement circuit;
Python retains the same conditional state for Bob's later correction. Fidelity
is an ideal-circuit diagnostic, not tomography. Hardware, noisy and unknown
backends are rejected for calibration. Handles expire after 30 minutes;
reset cancels the trial and preserves notebook discoveries and earned rewards.
Each new lab has an explicit 12-credit/24-bit allocation. The four successful
trials cost four credits and eight transmitted bits. Checkpoint resets retain
successful-trial progress and notes; additional practice awards no extra fragment.

Open Warden from the selector or after calibration. Open a hidden link; Alice chooses an X/Z test
basis and sacrifices 1–4 sampling credits, while Bob independently commits his
basis. Each credit purchases 1,024 fresh-pair shots, not repeated measurements
of one physical pair. Both send their one-bit basis code (Z=0, X=1) before Bob
sees the statistics. He commits trust/reject/insufficient evidence before the
explanation. ZZ alone does not certify a link; a Z interceptor can preserve ZZ
while damaging XX. Mismatched data has no QBER. The educational acceptance
rule requires both matched bases; these thresholds are not a general security
proof for noisy hardware. Repeated trials require a local simulator (IonQ
allows one job per Run). Actual hardware has not been tested.

The security checkpoint restores the same hidden link's budget and preserves
notes/rewards. Replace an expired link explicitly to start a new drill without
reusing old sample evidence. A fragment is awarded at most once per level.
Hosted Qollab and manual device checks remain on the HUMAN_CHECK list.

Optional local browser check: `npm run test:browser` uses installed Chromium
(`SPLIT_VAULT_CHROMIUM` may select an executable). It loads the actual HTML/CSS/
JS in a headless browser with a test-only Python bridge fixture, without a
server. Real quantum execution is covered separately by integration tests.

## Small QFT utilities (no new gameplay)

Python callers can run `qft_experiment({"num_qubits": 4, "period": 4}, 4096)`
from `api`. r=4 gives measured peaks at 0,4,8,12; r=2 gives 0,8. Registers are
bounded to 1–6 qubits; periods divide the register size. The forward convention
is exp(+2*pi*i*x*y/M)/sqrt(M), inverse is negative, q0 is least significant,
and counts display q[n-1]...q[0]. Fourier gates and state preparation are real
Qiskit; derived dominant positions come from sampled counts.

Future Qollab utility callers use a static named import:

```javascript
import { qft_experiment } from "api";
import { createQftExperiment } from "./quantum-client.js";
const runQft = createQftExperiment(qft_experiment, backend);
const spectrum = await runQft({ config: { num_qubits: 4, period: 2 }, shots: 4096 });
```

This is an API utility, not a new Quantum Radio level or N=15 factoring claim.
Circuit Architect, period finding, Final Vault and networking remain deferred.
Read AGENTS.md, WORKFLOW.md, TASKS.md and VERIFY.md for the reviewed boundary.
