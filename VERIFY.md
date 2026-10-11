# Split Vault verification record and gates

## Four-trial calibration and stage selector — current state (2026-10-11)

User-approved rule: four successful committed trials complete calibration.
Repeated states and outcomes count; no random branch collection or required
state mix. Fidelity remains >=1-1e-9 and Alice's operation must be CX_H.
Wrong recovery/operation adds no progress; valid experiments still cost one
credit and the required two-bit transmission. Reset retains partial progress,
and completion/practice/reset awards at most one fragment for the stage.
Four observations verify the chosen states, not a universally derived map.

The selector opens all three playable stages without prerequisite completion.
Per-stage sessions preserve spending, choices, evidence, completion and Python
handles, including a measured trial resumed before recovery. Notes and earned
fragments are shared. Pending bridge calls disable and reject stage switches;
retired renderers cannot change the active UI. Switching stages does not grant
rewards or refresh budgets. First entry grants the documented lab allocation.

Current regression, all exit 0 with zero failures/skips:

| Command | Passed |
| --- | ---: |
| .venv/bin/python -m unittest discover -v | 61 |
| npm test | 49 |
| npm run test:integration | 4 |
| npm run test:browser | 1 |

The real-Qiskit calibration integration finishes in exactly four successful
trials. Unit checks include repeated branches, wrong operations, partial reset,
direct stage entry, saved budgets/links/choices, shared notes/rewards and pending
locks. The optional Chromium suite drives actual HTML/CSS/JS with an explicitly
test-only Python bridge fixture: direct entry, resumed measured trial, pending
lock, four-trial reward, Warden exchange/judgment, Bell return/progression,
notebook sharing, reset and 390px mobile layout. It runs without an application
server; modules are injected into the browser, leaving browser policies intact.
Hosted Qollab imports/bridge, manual keyboard/device checks and hardware remain
pending; the browser fixture does not replace real-Qiskit integration.

Diff/syntax and flat-layout checks passed: 51 upload files, no new dependencies.
Updated application files: calibration.js, stage-select.js, main.js,
later-level.js, index.html and main.css. Refresh them together in Qollab.

## Stage 3 bridge repair — checkpoint (2026-10-10)

The reported hosted Warden failure occurred at the strict Python-dictionary
config check. Passing a plain JavaScript object through the bridge can produce
a JsProxy instead. Warden and QFT adapters now send JSON text; api.py decodes
it into a dictionary before existing core validation. Python dictionary callers
remain supported, and the selected backend is passed separately without change.
Malformed JSON, non-object JSON, unknown keys, invalid bases and missing links
are rejected before submitting a job.

Added API regressions verify real selected-backend hidden-link ZZ/XX and QFT
results from JSON text. Unit tests verify the serialized bridge argument;
stdio integration now requires it, preventing its automatic JSON transport
from masking this conversion defect. The prior transport converted JS objects
to Python dictionaries even though the hosted bridge need not do so.

Regression: `.venv/bin/python -m unittest discover -v` = 61 passed;
`npm test` = 45 passed; `npm run test:integration` = 4 passed. All exit 0,
zero failures/skips. Diff and JavaScript syntax checks passed. This repair was
verified locally; the updated files still need a hosted Qollab rerun.

## Implementation run — Q14 checkpoint (2026-10-10)

The authorized pipeline completed its final regression/review step Q14. Local
quantum, game and stdio integration evidence is distinct from actual browser,
hosted Qollab and hardware validation, which remain HUMAN_CHECK.

- Calibration: real selectable Bell-measurement operations; selected ideal
  simulator executes one shot; Python retains the resulting branch under an
  opaque, bounded 30-minute handle. Finish commits a Pauli once; same-correction
  retries are idempotent, cancellation/expiry rejects reuse. Only Alice bits
  precede correction commitment, never fidelity or recovery recommendations.
- Calibration game: exact two-bit exchange, pending locks/reservations, failures
  without new experiment spending, complementary evidence over all 12 state/
  branch combinations, checkpoint discoveries and one fragment. New lab budget
  is explicitly 12 credits/24 bits; repeated random branches can require resets.
- Warden: real 3-qubit Bell/interceptor circuits with measured/discarded Z
  record; no fabricated counts. Hidden links stay Python-owned; ideal/attack
  are absent from public responses. QBER is per matched basis only, null for
  mismatches. Both independent commitments and charged basis transmissions are
  required before interpretation. Complementary evidence gates trust/reject,
  with fair budget/reset and one reward. Expired-link replacement clears old
  evidence and closes the old handle; ordinary reset keeps the same link.
- QFT utilities: independent positive-sign Fourier oracle, inverse, swaps,
  shifted phases, small periodic preparations and real sampled histograms.
  Existing period API remains unavailable; no factoring or new Radio UI.
- Minimal forward navigation in main.js and later-level.js preserves Bell
  practice until the player advances. Notebook/channel survive progression;
  each lab receives an explicit bounded allocation, preserving notes/fragments.

Existing Python circuit and Bell/batch-teleport APIs are preserved. Additive APIs:

| API | Contract |
| --- | --- |
| teleport_prepare(state_name, operation, *, backend=None, seed=None) | state 0/+ /+i, operation CX_H/H_CX/CX_ONLY; metadata, trial_id, Alice bits, ideal_circuit label only. Qollab must supply its selected ideal simulator. Hardware/noisy/unknown simulators rejected. |
| teleport_finish(trial_id, correction) | Same measured Bob state; committed I/X/Z/XZ; finite fidelity/probabilities. No automatic correction. |
| teleport_cancel(trial_id) | Invalidate handle; idempotent cancellation. |
| warden_open(*, scenario=None, seed=None) / warden_close(link_id) | Hidden ideal/Z drill scenario, opaque bounded expiring identifier; explicit scenario for diagnostic tests only. |
| warden_experiment(config, shots, *, backend=None, seed=None) | basis_a/basis_b X/Z; either hidden link_id or diagnostic attack ideal/z. Alice-first counts, agreement/correlation, matched_shots, qber/null; no hidden attack field. |
| qft_experiment(config, shots, *, backend=None, seed=None) | num_qubits 1–6, dividing period, offset in period, boolean inverse; conventional high-to-low bit counts and measured dominant positions. No factoring output. |

All public results serialize with allow_nan=False. Each device experiment
forwards the selected backend; QFT transpiles for that backend. Calibration
fidelity is explicitly the ideal conditional circuit diagnostic, not device
state tomography. Standard advertised ideal simulators and BasicSimulator are
supported in code; local execution was verified on BasicSimulator only.

Current exact regression commands from the repository root:

```sh
.venv/bin/python -m unittest discover -v
npm test
npm run test:integration
```

npm test now registers the original three JS files plus test_calibration.mjs
and test_security.mjs. Integration registers test_qollab_integration.mjs and
test_later_integration.mjs. No application server or replacement runner.

Quantum gate ledger: T12 = 44 Python/31 JS/1 integration; T17 = 44/37/2;
W12 = 50/37/2; W17 = 52/42/3; Q12 = 58/42/3. All completed with exit 0 and
no failed/skipped tests. The original tests remain passing; Warden's stub
expectation was replaced with actual API physics while period's was retained.
Final regression on 2026-10-10 used the three commands above, all exit 0:

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Python unittest | 59 | 0 | 0 |
| JavaScript unit | 45 | 0 | 0 |
| JS → Python/Qiskit integration | 4 | 0 | 0 |

Review confirmed static Python imports, actual selected-backend execution,
Python-only quantum calculations, committed correction/judgment gates,
required charged exchange, bounded handles, retries/reset and one-time rewards.
No new server/HTTP transport, dependency changes or later gameplay. All 48
upload files are flat; git diff --check and JavaScript syntax checks passed.
Q14 is COMPLETE; D10–D16 remain DEFERRED and no in-scope TODO remains.

Human checks H01–H04 remain unrun: hosted Qollab bridge/import execution,
actual browser/mobile/focus/navigation, historical Bell required-exchange gap,
and IonQ/hardware. Reading live Qollab docs was denied by network policy (403);
implementation follows repository bridge instructions. No hosted success,
hardware compatibility, publication or push is claimed.

## Historical pre-implementation baseline

Inspected commit: `f34187e72464a71473b4229b09f5983ec8c08ef8`.
Baseline rerun on 2026-10-10 during document preparation: Python 3.12.14,
Qiskit 2.5.2, Node 24.19.0, npm 11.9.0. These are observed versions, not
new pins; `requirements.txt` remains `qiskit>=2.0,<3.0`.

Run from `/workspace/Quantum_Hackathon` (repository root):

```sh
source .venv/bin/activate
python -m unittest discover -v
npm test
npm run test:integration
```

Without activation use `.venv/bin/python -m unittest discover -v`.
At preparation, `npm test` expanded to `node --test test_game.mjs test_level_one.mjs test_quantum_client.mjs`;
integration expanded to `node --test test_qollab_integration.mjs`. Integration
selects `.venv/bin/python`; optional `SPLIT_VAULT_PYTHON` overrides it.
No application server starts.

| Historical suite | Passed | Failed | Skipped | Evidence |
| --- | ---: | ---: | ---: | --- |
| Python unittest | 39 | 0 | 0 | 15 Bell, 12 teleportation, 12 API tests. |
| JavaScript unit | 31 | 0 | 0 | 14 game/resource, 12 Bell Lock/notebook, 5 bridge tests. |
| JS → Python/Qiskit integration | 1 | 0 | 0 | 16 gate/basis combinations plus invalid gate within one test. |

All commands exited 0. Empty Warden/period test files executed no tests; this
baseline does not verify those modules. The stdio adapter substitutes for
Qollab's call boundary, not hosted imports/JSPI or hardware. Node tests do not
exercise browser DOM/keyboard/visual interaction.

## Source and public API at document preparation

| Component | Observed implementation |
| --- | --- |
| Bell | `bell.py`: real preparation, X/Z rotations, StatevectorSampler or caller backend, counts/statistics. |
| Teleportation | `teleport.py`: arbitrary state, Bell measurement and collapse, selectable Pauli, Bob density/Bloch/fidelity. No calibration gameplay. |
| Game | `state.js`, `resources.js`, `levels.js`: immutable resources, advancement, same-level checkpoint. No multi-level router. |
| Bell Lock | `level-one.js`, `main.js`: commitment, validation, successful-batch spending, one-time fragment and fair reset. |
| UI | `alice.js`, `bob.js`, `histogram.js`, `radio.js`, `notebook.js`, `index.html`, `main.css`: reusable rooms, histogram, classical channel and notes. Renderers currently Bell-specific. |
| Bridge | `quantum-client.js`: async Bell adapter, backend forwarding, dictionary conversion, returned-proxy cleanup. |
| Scaffolds | Warden/QFT/period, `architect.js`, `verify.py`, Warden/period tests empty. `radio.js` is classical message/notes rendering, not Quantum Radio. No later levels/network multiplayer. |

`api.py` exports these four public experiments. Results are plain finite
JSON dictionaries (`json.dumps(..., allow_nan=False)`). Shots must be positive
integers, excluding booleans. Invalid inputs raise `ValueError`; device errors
propagate without simulator/HTTP fallback.

| Existing API | Arguments/backend | Result/order |
| --- | --- | --- |
| `bell_experiment` | `(basis_a, basis_b, shots, *, preparation_gate="H", seed=None, backend=None)`. X/Z, H/X/Z/S. Caller device executes the selected circuit; omitted backend uses ideal simulation. Seed controls only local sampling. | `experiment="bell"`, `status="ok"`, request metadata, four counts, agreement/correlation/type, fidelity with `preparation_fidelity_source="ideal_circuit"`. q0/c0 Alice, q1/c1 Bob; displayed counts Alice then Bob, reverse of Qiskit c1c0. Backend input-only. |
| `teleport_experiment` | `(theta, phi, bob_correction, shots)`; finite real radians, I/X/Z/XZ. No backend/seed keyword. Independent ideal trials with the same caller correction. | `experiment="teleport"`, `status="ok"`, shots/correction, Alice counts, trials and arithmetic mean fidelity. Bits c0 then c1; density complex entries `[real, imaginary]`. Not fidelity of averaged state or hardware tomography. |
| `warden_experiment` | `(config, shots)`; JSON dictionary, no backend yet. | Valid input returns `status="not_implemented"`, error code/message, experiment/shots, no counts. |
| `period_experiment` | Same current validation/signature, no backend. | Explicit unavailable result; no QFT/period implementation. |

Low-level teleport APIs: `prepare_state(theta, phi)`,
`teleportation_circuit(theta, phi, correction="I")`,
`teleport(theta, phi, correction="I", *, seed=None)`.
Preserve these and the batch API during extensions. `main.js` statically
imports only `bell_experiment` from `api`; the async bridge passes three
positional arguments and a keyword object with preparation gate/selected
backend, awaits conversion and releases only the owned result proxy.

## Existing Bell Lock

- `test_bell.py`: exact Phi+; seeded 4096-shot ZZ/XX with zero mismatches,
  agreement >=0.99 and both 00/11 frequencies 0.45–0.55. XZ/ZX agreement
  0.45–0.55, each outcome 0.20–0.30, exact probabilities 0.25. Crossed bases
  must not appear deterministically perfectly correlated.
- Explicit q0→c0/q1→c1 wiring and X-basis H placement. The asymmetric API
  backend test verifies Qiskit `01` becomes displayed `10`.
- Wrong X/Z/S preparation may agree in ZZ but Phi+ fidelity is 0.5 and earns
  no fragment. Correct H with matching committed prediction succeeds; wrong
  prediction fails despite correct preparation.
- `test_level_one.mjs`: uncommitted request rejection/hidden results,
  pending locks, stale/duplicate rejection, spending only on valid successful
  experiments, one fragment across resets. Scientific failure still costs
  the successful experiment; backend/transport/malformed failures do not.
- API/bridge tests: selected backend forwarding, missing bridge/backend,
  errors without fallback, conversion cleanup and reusable retries.
- Source inspection: explanation content is inserted by `main.js` only after
  completion; initial `index.html` has empty hidden explanation/measurements.
  This is not browser/hosted verification.
- Completion currently requires no classical message. Required cooperation
  is a separate design gap (`H03`); preserve current regression behavior.

## Existing teleportation primitive and bit convention

`test_teleport.py` tests |0>, |1>, |+>, |->, |+i> and a generic state
(`theta=1.1`, `phi=0.7`) on all four measured branches. Correct recovery has
fidelity 1 to 12 decimals, independently checked from the returned density.
Generic-state wrong corrections give fidelity <0.9; suitable named-state
wrong corrections give orthogonal outputs (fidelity 0).

q0 is Alice's input, q1 her Bell half, q2 Bob. Bell measurement is CX(0,1),
H(0), q0→c0, q1→c1. **First displayed Alice bit c0 controls Z; second c1
controls X.** This is verified by circuit wiring and independent recovery
oracles in `test_correct_correction_recovers_every_state_and_branch`, not
inferred from Qiskit's reverse displayed strings.

| Displayed `[c0,c1]` | Recovery (developer/test oracle only) |
| --- | --- |
| 00 | I |
| 01 | X |
| 10 | Z |
| 11 | XZ |

XZ applies X then Z; reversed order differs by global phase. Keep this table
out of pre-commit player UI/prefilled notes. Wrong Pauli can be invisible on
an eigenstate: Z on |0>, X on |+>. Existing tests explicitly verify this.
Use multiple complementary states, never demand every wrong correction fail
on every state. Check valid density/normalization, finite JSON, Bloch/phase
information, uniform Alice outcomes and invalid args. Current primitive is
ideal simulation with no device/forwarding path; staged capability needs resolution.

## Teleportation Calibration verification requirements

- Reuse the primitive. Add a configurable real Alice Bell-measurement circuit
  and meaningful wrong operation. Test correct recovery and degraded fidelity
  for suitable wrong-operation/state combinations, all branches and ordering.
- Prove measure-once same-state continuation across prepare → bits → exchange
  → correction → verify. A second independent batch call is invalid.
  Test Python-owned trial lifecycle, invalid/reset/stale/replayed handles and
  retry without resampling. No state/fidelity/map reaches Bob before commitment.
- Verify supported local-simulator/device capability and truthful diagnostic
  labels. Device paths forward the selected backend; unsupported devices fail
  clearly without replacement execution or spending.
- Alice chooses/commits state and operation, sends only the allowed two bits;
  Bob infers/commits I/X/Z/XZ using blank notebook mapping. No auto-filled table.
  Current user-approved completion rule: four successful committed trials,
  including repeated states/outcomes; wrong operation/recovery does not count.
  Recommend complementary states to explore eigenstate ambiguity; completion
  verifies tested states, not a universally derived correction map.
- Test real Python-to-game correct/wrong paths, phase-sensitive errors,
  missing/falsified/duplicate messages, insufficient budgets, pending locks,
  stale/malformed replies, import/backend errors, no duplicate cost/reward,
  checkpoint/reset and retained prior resources/fragments. Record thresholds
  and debit/reservation timing before code. T12 gates gameplay; T17 repeats
  full regression and design review before local completion.

## Warden verification requirements

Prepare Phi+ and perform real nonselective Z interception/measurement,
discarding Warden's outcome. Reduced state is
`0.5|00><00| + 0.5|11><11|`, not Phi+. A measured ancilla/environment or
verified nonselective simulation is acceptable; outputs come from Qiskit,
not hard-coded counts or re-preparing Phi+ after the attack.

| Scenario | Exact target | Suggested 4096-shot seeded check |
| --- | --- | --- |
| Ideal ZZ/XX | 00 and 11 each 1/2; QBER 0 | Agreement >=0.99; both outcomes present. |
| Z attack ZZ | 00 and 11 each 1/2; QBER 0 | Apparently healthy; ZZ alone cannot certify security. |
| Z attack XX | Four outcomes each 1/4; QBER 1/2 | Agreement 0.45–0.55, substantial mismatches. |
| XZ/ZX | Unmatched, not security evidence | Excluded from matched QBER denominator; clearly labelled. |

Fix justified sampling bounds before tests; independently check exact
probabilities/coherence loss. QBER = `(01+10)/matched_shots` per matched basis;
zero matched shots means unavailable evidence, not a healthy link. Check
Alice-first bits, finite JSON, totals, wrong configs and backend capabilities.
Exercise a real supported device path and explicit forwarding/errors without
fallback. Optional noise needs zero-noise equivalence, parameter bounds and
physically justified nonzero tests; it cannot destabilize required scope.

Alice independently commits X/Z and sacrificed test-pair allocation. Bob
independently commits bases, then interprets matched statistics and commits
trust/reject/insufficient-evidence. Require exchange of basis/sample information
within the defined channel budget. No hidden-attack label or trust answer
before interpretation commitment. Test attacked XX detection, misleading
ZZ-only reasoning, insufficient samples, mismatches and independent decisions.
Demonstrate sacrificed-versus-retained credits and fair checkpoint recovery.

Valid successful experiments debit the test budget, including a poor scientific
decision. Import/backend/conversion/malformed failures expose neither new
results nor new pair spending. Test stale/duplicate/retry, reset/notebook,
one-time rewards and advancement. Preserve Bell/teleportation tests.
W12 quantum gate and W17 whole-feature regression must pass before QFT begins.

## Conditional QFT/periodic utility verification requirements

Utilities precede Quantum Radio visuals. Define sign, swaps, little-endian
register and displayed integer/bitstring convention. Independently compare
QFT with a discrete-Fourier oracle on basis/complex states; test inverse
round trips and norm. Forward/inverse can share a wrong convention, so
cancellation alone is insufficient. Include sign/swap and malformed-input cases.

Four-qubit space `M=16` is distinct from factoring modulus N=15:

- r=4: normalized equal amplitudes at 0,4,8,12; Fourier probabilities 1/4
  at 0,4,8,12, zero elsewhere; spacing M/r=4.
- r=2: equal amplitudes at 0,2,4,6,8,10,12,14; probabilities 1/2 at 0,8,
  zero elsewhere; spacing M/r=8.

Check exact spectra, sampled totals, integer/bit order, bad register/period/shots,
finite JSON and backend errors/forwarding. Shifted periodic-state complex
amplitudes supply a phase/sign oracle. Use justified seeded sampling bounds.
A proposed `qft_experiment` belongs in `api.py` only after its contract/test
gate; do not repurpose `period_experiment` as a factoring claim. Verify real
JS/Python correct/invalid API paths and full regression. No new Radio/Hidden
Period UI or generic Shor is authorized in this secondary target.

## Deferred N=15 requirements

Next supervised cycle only: classically verify `2^0..2^4 mod 15 = 1,2,4,8,1`,
hence r=4. Independently verify a reversible controlled modular/oracle circuit,
not hard-coded period/peaks. Keep counting preparation, controlled modular
stage, inverse QFT and measurement modular for later Circuit Architect.
Test register order, work-register entanglement, period evidence and wrong
stages. Arbitrary-N Shor, distributed QFT and Final Vault remain out of scope.

## Regression and human evidence

Before major COMPLETE run all three baseline commands plus every new suite.
Python discovery sees root `test_*.py`; npm's explicit JS list does not
discover new files. Register new unit/integration tests in existing package
scripts or execute/document explicit commands until registration is complete.
Preserve runners. Record passed/failed/skipped/unrun separately; empty files
and stub-return tests are not physics evidence. Replace Warden's unavailable
assertion only when implemented, retaining period's while it is still empty.

Count files before additions/review. Document preparation had 41 upload files; implementation now has 51, all
flat. The new files are calibration.js, security.js, later-level.js,
test_calibration.mjs, test_security.mjs, test_later_integration.mjs and
test_qft.py. The selector adds stage-select.js, test_stage_select.mjs and
test_ui.mjs. AGENTS and dependency requirements remain unchanged.

H01: hosted Qollab selected local simulator, imports/actual async bridge,
conversion, repeated trials and errors. H02: local automated Chromium flows
and 390px layouts passed; manual browser/mobile/keyboard,
focus, commitments, hidden answers, notebook/channel and level navigation.
H03: Bell Lock required-exchange design review. H04: actual IonQ/device
one-job-per-Run behavior. H01/H03/H04 remain HUMAN_CHECK/unrun; H02 remains
HUMAN_CHECK with the scoped local browser evidence recorded above. Local simulation
cannot complete them, and hardware submission requires separate authorization.

### Run ledger

| Run | Python | JS unit | Integration | Scope |
| --- | --- | --- | --- | --- |
| Preparation before edits, 2026-10-10 | 39 passed | 31 passed | 1 passed | Existing baseline, zero failures/skips. |
| Preparation after document edits, 2026-10-10 | 39 passed | 31 passed | 1 passed | Same three commands, all exit 0; zero failures/skips. |
| Implementation Q14, 2026-10-10 | 59 passed | 45 passed | 4 passed | Current registered commands, all exit 0; zero failures/skips. |
| Four-trial rule and selector, 2026-10-11 | 61 passed | 49 passed | 4 passed | Also 1 Chromium browser test passed; all exit 0, zero failures/skips. |

Document-preparation post-edit execution used `source .venv/bin/activate && python -m unittest
discover -v`, `npm test` and `npm run test:integration` from the repository
root. Dependency-graph review found no cycles or unknown task IDs; B00 is the
only eligible TODO at handoff. File-count/layout and `git diff --check` passed.
Only TASKS.md, WORKFLOW.md and VERIFY.md changed; AGENTS and all application,
test and dependency files are unchanged.

Implementation evidence appears at the top of this document. The historical
preparation baseline alone does not verify the added features.
