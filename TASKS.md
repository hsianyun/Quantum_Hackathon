# Split Vault dependency-aware tasks

## Authorized Stage 4–5 run (2026-10-11)

The user's pasted request supersedes the former Q14 stop for Quantum Radio and
Hidden Period only. Stop after S59; Stage 6/Circuit Architect and later work stay
deferred. Baseline at 1dbb00f: 61 Python, 49 JS unit, 4 real-Qiskit integration,
1 Chromium test passed, zero failures/skips; 51 flat upload files.

| ID / status | Dependencies | Gate |
| --- | --- | --- |
| S40 COMPLETE | Q14 | Inspect current APIs, sources/tests, baseline and feature contracts below. |
| S41 COMPLETE | S40 | Reuse QFT core; private bounded radio scenarios, sanitized measurement and committed Python interpretation/verification APIs. |
| S42 COMPLETE | S41 | Exact r=2/4/8 spectra, expected peaks, ordering, actual selected backend, finite JSON, secrecy, errors/lifecycle tests and full regression. |
| S43 COMPLETE | S42 | Stage 4 pure game, Alice/Bob views, exchange, histogram/markers, selector and Warden advancement. |
| S44 COMPLETE | S43 | Stage 4 real-Qiskit integration, browser paths, wrong hypotheses and full regression. |
| S50 COMPLETE | S44 | Stage 5 pure interpretation/exchange/inference game; Python owns the hidden period. |
| S51 COMPLETE | S50 | Stage 5 asymmetric views, notebook prompts, locked explanations and selector/advancement. |
| S52 COMPLETE | S51 | Correct/wrong periods, bit/phase interpretation, privacy/resources/retry/reset, real integration/browser and full regression. |
| S59 COMPLETE | S52 | Qiskit/game/software review; docs/results/file count; STOP. |

Stage 4 contract: four-qubit equal periodic state; forward positive-sign QFT
with final swaps, q0 least significant, displayed q3q2q1q0. Python chooses r=2
or 4. Alice sees amplitude locations, never a period label, commits r and sends
one bit (2=0, 4=1). Bob sees only her transmitted hypothesis and N=16, commits
peak spacing 2/4/8. Both commit before measurement/histogram. One successful
device batch costs one credit, 4096 independent shots. Verification checks
Alice's r, Bob's N/r, and actual sampled support: >=95% expected-peak mass,
all expected peaks observed, dominant peaks match the clean support. Wrong
predictions explain inconsistent spacing/interference after commitment.
Python computes peaks/checks; JS awards one fragment only when all checks pass.
Explanation stays locked until completion; advancement opens Stage 5. First
entry allocates 12 credits/32 classical bits. Prior legitimate transmission
cost is preserved on a later backend error; errors add no debit or disclosure.

Stage 5 contract: hidden r=2/4/8, N=16, retained Python scenario; no input pattern,
period/offset/expected peaks in pre-commit responses. One successful measurement
costs one credit/4096 shots and gives Alice raw q3q2q1q0 counts only. She enters
integer peak outcomes and phase fractions, commits them in Python, then sends
only her claimed phases. Python encodes each phase as a four-bit numerator over
16; cost is 4 bits per observation (max 32). Bob initially sees neither pattern
nor histogram, receives Alice's fractions, commits r=2/4/8, then Python compares
the claims to sampled dominant readouts and the private scenario. Wrong guesses
give candidate-specific spacing/phase diagnostics without stating the correct
period. Only a fully correct interpretation/inference/spectrum reveals that
period and unlocks explanation. First entry allocates 12 credits/128 bits.

Both contracts reuse existing resources/notebook/reset/selector/async bridge;
Bob-to-Alice messaging is not required and cannot substitute for commitments.
Same-trial commits/verification are idempotent and immutable; handles are bounded
and expire after 30 minutes. Reset restores budget/retains notes/reward and the
same scenario; explicit expired-scenario replacement clears old evidence. A
valid quantum batch is charged even for a poor hypothesis; errors/stale/malformed
replies add no debit. Failed verification can retry the committed trial without
a new backend job. Shared-device views provide educational role separation.
Local simulators support repeated play; IonQ allows one job per Run. Hosted
Qollab/hardware remain HUMAN_CHECK. Planned additive API: radio_open,
radio_measure, radio_commit, radio_verify, radio_discard, radio_close in api.py;
JSON text for object configs/predictions, selected backend only on measurement.
New flat files: quantum-radio.js, radio-level.js, test_radio.mjs (54 total).
Real-Qiskit integration extends test_later_integration.mjs. Quantum gate precedes game/UI; Stage 4
full integration/regression precedes Stage 5 game/UI. Preserve all Stage 1–3 rules.

## Execution rules

Read `AGENTS.md`, `WORKFLOW.md`, this file and `VERIFY.md`. The implementation
run authorized by the user on 2026-10-10 is complete through Q14. The subsequent
Stage 4–5 run above is complete through S59. Stop here; Stage 6 stays deferred.
Statuses: COMPLETE = stated local acceptance verified; ACTIVE = being worked;
TODO = pending; BLOCKED = a diagnosed prerequisite prevents progress;
HUMAN_CHECK = actual human/platform evidence needed; DEFERRED = outside this
run's authority. Current task status is indicated in the top table; stop after S59.

A TODO is eligible only when every dependency is COMPLETE and scope is
within the authorized boundary. Work in the sequence below, mark ACTIVE,
follow all 14 workflow steps, then record evidence before marking COMPLETE.
A blocked prerequisite closes its descendants. Unrelated human checks remain
pending without blocking explicitly separate local acceptance. Fill the
feature contract under its task before coding; planned APIs are not existing APIs.

## Completed foundation and preserved history

Inspected commit: `f34187e72464a71473b4229b09f5983ec8c08ef8`. Preparation rerun:
39 Python, 31 JavaScript unit and 1 real-Qiskit integration tests passed.
Commands, cases and limitations are in `VERIFY.md`.

| ID / status | Dependencies | Delivered work and evidence |
| --- | --- | --- |
| F01 COMPLETE | None | Flat scaffold, original 39 upload files; 41 after docs, <=90. |
| F02 COMPLETE | F01 | Bell preparation/X/Z measurements, real circuits and exact/sampled/wrong-gate/order tests. |
| F03 COMPLETE | F02 | Arbitrary-state teleportation and selectable recovery; all branches, wrong corrections, fidelity/order tests. Primitive only, no playable calibration. |
| F04 COMPLETE | F02, F03 | JSON experiment APIs preserving Python circuit APIs. Bell/teleport implemented; Warden/period explicitly unavailable. |
| F05 COMPLETE | F01 | Pure state/resources, advancement and checkpoint reset; immutable budget tests. Advancement is not a level router. |
| F06 COMPLETE | F05 | Responsive Alice/Bob rooms, histogram, notebook and binary channel, existing desktop/mobile images; interface styles consolidated in main.css. Browser behavior remains H02. |
| F07 COMPLETE | F02, F04, F05, F06 | Bell Lock choices, staged commitments, hidden results, histogram verification, one-time fragment and locked explanation; correct/wrong/retry/reset tests. Current exchange is optional, reviewed in H03. |
| F08 COMPLETE | F04, F07 | Qollab runtime repair: static api import, awaited callPromisingKwargs/toJs, selected backend propagation, ideal local Python calls retained. Removed HTTP fallback, server script/tests and assumed global Pyodide; detailed errors do not spend resources. |
| F09 COMPLETE | F08 | Async bridge/conversion/cleanup/retry tests; actual supplied BasicSimulator circuits for all 16 gate/basis combinations; stdio integration of committed game inputs/results. Not a hosted run. |
| F10 COMPLETE | F08, F09 | Previously updated README/AGENTS/runtime repeated-trial guidance; previously removed duplicate AGENTS layout section. AGENTS unchanged in this task. |

These preserve historical completed work with explicit local scope; do not
recreate it or certify new design gates from historical labels. At document preparation there was no playable
Teleportation Calibration, Warden, QFT, Hidden Period, Circuit Architect,
N=15 experiment, Final Vault or networking. `radio.js` is classical
message/note rendering. Warden and QFT have since been implemented by this run; `period.py`,
`architect.js`, `verify.py` and `test_period.py` remain empty scaffolds.

## Primary overnight target

### Baseline and Teleportation Calibration

| ID / status | Dependencies | Work and acceptance |
| --- | --- | --- |
| B00 COMPLETE | F01, F02, F03, F04, F05, F06, F07, F08, F09, F10 | First eligible overnight task: inspect changes/file count; rerun all three baseline commands and record current counts. Diagnose failures before new work. |
| T10 COMPLETE | B00 | Define calibration contract from the notes below: staged same trial, real Alice options, backend/simulator capability, hidden information, costs, complementary-state success, routing and tests. |
| T11 COMPLETE | T10 | Extend/reuse teleport.py with a real staged protocol and configurable Alice Bell-measurement operation, preserving current functions. Python owns measured state/handle; Bob corrects that same state, never a resampled batch. |
| T12 COMPLETE | T11 | HARD QUANTUM GATE: state/branch/wrong-operation/bit-order/handle/error/capability tests in test_teleport.py and boundary tests; full regression. No gameplay until green. |
| T13 COMPLETE | T12 | Pure calibration game transitions: commitments, restricted two-bit exchange, trial reservations/debits, retries/reset, notes, complementary-state evidence, one-time reward and advancement. Add/register JS tests. |
| T14 COMPLETE | T13 | Alice known-state and Bell-measurement reasoning UI; choices alter the real circuit. Hide diagnostics and allow only permitted committed bits to cross. Reuse rooms/styles. |
| T15 COMPLETE | T14 | Bob I/X/Z/XZ reasoning and blank 00/01/10/11 mapping notes; no prefilled lookup table. Gate correction on received bits and commit before fidelity; compare multiple states. |
| T16 COMPLETE | T15 | Staged JSON API in api.py, async adapters in quantum-client.js, static imports/minimal navigation in main.js. Preserve Bell API; test conversion/errors/capabilities and real server-free integration. |
| T17 COMPLETE | T16 | Correct/physically wrong player paths, full regression and design/diff review. Verify both reasoning roles, required exchange, same trial, fair budgets/reset and unchanged Bell Lock. Record local completion; H01/H02 remain pending. |

T10 planning inputs (resolve into the full WORKFLOW contract before code):

- Alice knows/chooses |0>, |+>, |+i> calibration states and builds/selects the
  actual Bell-measurement operation, including a meaningful wrong Qiskit
  operation. Bob separately infers recovery experimentally.
- Commit Alice's circuit, measure once, retain Python's collapsed state,
  release only her ordered `[c0,c1]` bits, transmit those two bits, commit
  Bob's correction, then verify. No early density/Bloch/fidelity/correction
  table or state shortcut that removes Bob's reasoning.
- Existing `teleport_experiment(theta, phi, bob_correction, shots)` chooses
  correction first and resamples independent trials. A second call is not
  continuation. Keep it working as a diagnostic; define additive prepare/
  finish API names, arguments, finite JSON, trial binding/invalidation/replay
  and proxy ownership. Seed reuse is not a substitute for retained state.
- Existing teleportation uses Statevector without backend. Resolve supported
  local-simulator teaching mode and explicit unsupported-device behavior.
  Any device path actually forwards the selected backend; an unused backend
  argument, silent substitute device or hardware-fidelity claim is invalid.
  If a safe supported route cannot be established, mark T11 BLOCKED.
- Suggested budget: reserve one source credit per pending trial; debit once
  on valid successful verification, including a scientifically wrong result.
  Deliver the permitted two-bit message once for two classical bits. Prior
  legitimate transmission cost is not an error penalty; failed imports/
  backends/conversion add no debit. Specify reservation release, abandoned
  trials, retries/reset and duplicate protection. Distinguish credits from
  physical pairs and statistical shots.
- Bob manually records 00→?, 01→?, 10→?, 11→?. Require complementary-state/
  branch evidence, not one lucky high-fidelity eigenstate. The developer
  oracle in VERIFY says first bit controls Z, second X; do not expose it
  beforehand. Fix thresholds before tests; wrong Pauli can be invisible on
  eigenstates, which is part of the lesson.
- Reuse state/resources/levels/notebook/radio and room/style modules safely.
  Add only necessary flat level/test files and minimal Bell → calibration →
  Warden navigation. Preserve Bell practice/reset; no framework/redesign.

### Warden

| ID / status | Dependencies | Work and acceptance |
| --- | --- | --- |
| W10 COMPLETE | T17 | Define attack/role/exchange contract: independent X/Z choices, sacrificed/retained budget, sample encoding, per-basis QBER and insufficient-evidence/trust decisions, hidden attack and checkpoints. |
| W11 COMPLETE | W10 | Implement warden.py: ideal Bell pairs and real nonselective Z interception/measurement, Python statistics. Noise is optional only if cleanly contained; default required scope excludes it. |
| W12 COMPLETE | W11 | HARD QUANTUM GATE: populate test_warden.py; exact/sampled ideal ZZ/XX, attacked ZZ/XX, matched/mismatched/zero-denominator cases, bit order, selected-backend/error tests and full regression. Stub tests are insufficient. |
| W13 COMPLETE | W12 | Implement warden_experiment(config, shots, ...) in api.py, additive backend keyword if needed. Define/validate schema, shots and finite JSON; replace Warden's unavailable expectation with real tests while preserving period's. Run Python/API regression. |
| W14 COMPLETE | W13 | Pure game/resource logic: budgeted sacrifices versus retained credits, commitment/exchange, matched evidence, Bob trust decision, exactly-once costs/rewards and fair checkpoint/reset. Register JS tests. |
| W15 COMPLETE | W14 | Alice basis/allocation interaction, then Bob independent basis and post-observation interpretation. Require both reasoning roles/exchange; no automatic attack/trust answer. Reuse channel/notebook/rooms. |
| W16 COMPLETE | W15 | Static Python import, selected-backend async adapter and minimal level routing. Real JS/Python integration: correct path, misleading ZZ-only reasoning, attacked XX and errors; no HTTP. |
| W17 COMPLETE | W16 | Correct/incorrect player paths, budgets/errors/reset, full regression and design/diff review. Record local completion/human checks. Only this gate unlocks QFT. |

W10 planning inputs:

- Ideal Phi+ correlates in both ZZ and XX. A Z attack may preserve ZZ while
  destroying XX correlation. Use real measurement/dephasing physics, not
  fabricated counts; independent analytic checks are in VERIFY.
- Alice decides test bases using complementarity. Bob separately chooses
  bases, then interprets matched counts/QBER. Neither gets a pre-labelled
  attack. Define the allowed budgeted exchange of bases/sample information
  and its actual-bit encoding before coding.
- Bound source credits sacrificed for tests and retain the rest for later
  messaging. Define sample/allocation/evidence limits and explain credit/shot
  distinction. Scarcity should affect decisions, with fair checkpoint
  recovery from an early failed hypothesis.
- QBER uses mismatches in matched trials only; mismatched samples do not enter
  the denominator. No matched data means unavailable evidence. Define
  trust/reject/insufficient-evidence criteria before tests.
- Successful experiments cost resources even with poor reasoning; errors
  disclose no new results/spending. Define stale/duplicate/retry/reset and
  notebook behavior. Optional noise must not delay/weaken required gates.

## Conditional secondary target: quantum utilities only

All rows remain ineligible until W17 is COMPLETE. These are quantum/API
utilities, not a playable Quantum Radio level or visual-polish task.

| ID / status | Dependencies | Work and acceptance |
| --- | --- | --- |
| Q10 COMPLETE | W17 | Define QFT/periodic utility contract: sign, swaps, register/integer order, M=16 r=4/r=2 examples and JSON/backend schema. |
| Q11 COMPLETE | Q10 | Implement QFT/inverse QFT in qft.py, normalized small periodic-state preparation and transformed-register measurement. Real Qiskit only. |
| Q12 COMPLETE | Q11 | HARD QUANTUM GATE: necessary flat tests with independent Fourier oracle, complex/sign/swap cases, inverse round trips, exact/sampled r=4/r=2 spectra, ordering, invalid args/device errors and full regression. |
| Q13 COMPLETE | Q12 | Compatible JSON utility boundary in api.py (proposed qft_experiment, not existing API), async conversion/selected backend and real server-free correct/invalid-input integration. Do not present period_experiment as factoring. |
| Q14 COMPLETE | Q13 | Final regression: 59 Python, 45 JS unit, 4 real-Qiskit integration tests passed, no failures/skips. Diff/layout review passed: 48 flat upload files. VERIFY/TASKS updated; STOP boundary reached. |

M=16 examples/peaks are in VERIFY. Independent oracles must detect a shared
forward/inverse convention bug. Do not switch to QFT to bypass failed primary
prerequisites. If secondary work cannot proceed safely, stop after primary.

## Progression and remaining deferred scope

Foundation/Bell Lock → Teleportation Calibration → Warden → Quantum Radio/QFT
→ Hidden Period → Circuit Architect → N=15 period finding → Final Vault.
Overnight QFT utilities were prerequisites. S40–S59 now complete both radio stages.

| ID / status | Dependencies | Future scope |
| --- | --- | --- |
| D10 COMPLETE | S44 | Playable Quantum Radio: new contract, views/decoding and full local acceptance. |
| D11 COMPLETE | S52 | Hidden Period small-register gameplay and full local acceptance. |
| D12 DEFERRED | D11 | Full Circuit Architect recombining tested modules; architect.js is empty. |
| D13 DEFERRED | D12, Q14 | Fixed N=15, a=2 backend/period API: classical 1,2,4,8,1 and r=4; modular counting preparation, reversible controlled oracle, inverse QFT and measurement. Empty backend makes it unsuitable for this overnight run. |
| D14 DEFERRED | D13 | Final Vault integration/progression. |
| D15 DEFERRED | Q14 and separate explicit review/authorization | Arbitrary-N Shor, distributed QFT/Tier B, networking and large visual redesign. |
| D16 DEFERRED | W17 and a separate small-scope contract | Optional Warden noise if not already cleanly included; preserve zero-noise/attack gates. |

## Human/platform checks

Chromium exercises actual DOM with a test-only bridge fixture; real-Qiskit
integration exercises the quantum path separately. Hosted/manual/hardware
checks below still need platform evidence; keep HUMAN_CHECK until that evidence.
They are separate from local feature completion.

| ID / status | Dependencies | Required evidence |
| --- | --- | --- |
| H01 HUMAN_CHECK | F09; T17/W17/Q14/S59 for relevant new features | Qollab hosted JS/Qiskit Run Project with selected local simulator: actual imports/async bridge/conversion, repeated trials, errors and new integrations. |
| H02 HUMAN_CHECK | F06, F07; S59 | Manual keyboard/focus/mobile checks on hosted UI; local Chromium now covers DOM, privacy, notebook/reset and five-stage navigation. |
| H03 HUMAN_CHECK | F07 | Review Bell Lock's required-exchange gap: messages optional and both rooms on one screen. Agree separately on any redesign; preserve the baseline overnight. |
| H04 HUMAN_CHECK | F08; device-capable new features only | Actual IonQ/device behavior and one-job-per-Run limit. Statevector diagnostics do not establish calibration hardware support; no hardware job authorization in this run. |

Hosted procedure: upload only root project files to a JS/Qiskit wrapper,
Run Project → local simulator → Run. Exclude Git/venv/caches/bytecode. IonQ
permits one job per Run; repeated trials use the supported simulator.
Hardware jobs, push and publication need separate explicit authorization.

## Run handoff and blocker log

Document preparation created WORKFLOW/VERIFY and the dependency graph. The
subsequent user-authorized implementation completed calibration, Warden and
conditional QFT utilities/API. AGENTS and requirements remain unchanged.
No diagnosed active blocker. Hosted/browser/IonQ checks remain separate.
Calibration uses the selected ideal simulator for real measurement and labels
conditional fidelity as ideal diagnostics; unsupported devices are rejected.

Post-Q14 Stage 3 maintenance: fixed the reported Warden bridge config failure
by sending JSON object text and decoding at the API boundary; applied the same
repair to QFT's object-config adapter. Regression: 61 Python, 45 JS unit and
4 real-Qiskit integration tests passed, zero failures/skips. Both api.py and
quantum-client.js must be refreshed together in Qollab; hosted rerun pending.

User-authorized maintenance on 2026-10-11 replaces the original 12-case
calibration completion rule with four successful trials. Repeated states and
random outcomes count; no branch collection or required state mix. Correct
operation, committed correction, required exchange and fidelity threshold stay
in force. The selector opens stages 1–3 without prerequisite completion,
preserves each stage's budget/choices/link/evidence, shares notes and fragments,
and locks during pending requests. Navigation alone awards no fragments.
This does not authorize gameplay beyond Warden; see current evidence in VERIFY.

Full sequence:
`B00 → T10 → T11 → T12 → T13 → T14 → T15 → T16 → T17 → W10 → W11 → W12 →
W13 → W14 → W15 → W16 → W17`, then conditionally
`Q10 → Q11 → Q12 → Q13 → Q14 → STOP`.

For a blocker record ID, exact failure/evidence, diagnosis, minimal fixes
attempted, last passing state and required unblock action. Continue only
independent eligible tasks. Preserve user work; no weakened assertions,
deleted valid tests, fabricated answers or architecture rewrites to bypass it.


## T10 feature contract — approved scope for this implementation run

- Concept: Bell measurement and experimentally derived Pauli recovery; phase
  and bit errors require complementary calibration states.
- Alice sees the calibration state and circuit choices CX→H, H→CX, CX only.
  She reasons about the Bell-measurement order and commits before measurement.
- Bob sees only the transmitted ordered two bits before committing I/X/Z/XZ;
  he builds his own map from post-commit fidelity and named-state observations.
- Alice→Bob is exactly the measured two-bit payload, costing two classical bits.
  Bob→Alice is an optional binary hypothesis note via the existing charged
  channel; it cannot inject a correction into Alice's circuit.
- Reserve one source credit for the pending trial; debit once when a valid
  verification is received, even for wrong physics. Send bits once for two
  classical bits. Errors add no debit; retry uses the same Python handle and
  committed correction. Reset cancels the handle, restores this level's
  checkpoint and retains notebook/earned fragments, without duplicating rewards.
- Correct physics: q0 input, q1 Alice Bell half, q2 Bob; CX(0,1) then H(0),
  measure q0→c0/q1→c1. First displayed bit controls Z, second controls X.
  Wrong order/omitted H physically changes the state and fails on suitable inputs.
- Success (updated by user on 2026-10-11): four committed trials with fidelity
  >=1-1e-9 using the correct operation, even if states/outcomes repeat. These
  observations verify chosen states; they do not certify a full correction map.
  Complementary-state comparison remains encouraged. One fragment once;
  four successful trials cost four source credits and eight classical bits.
  Calibration checkpoint grants a fresh bounded lab
  budget (12 credits/24 bits) on entry while preserving earned fragments;
  this is an explicit per-level allocation, not silent carry-over replenishment.
  Failed hypotheses can be retried with fair checkpoint reset.
- Python API: teleport_prepare(state_name, operation, *, backend=None, seed=None)
  returns metadata, opaque trial_id and Alice bits only; teleport_finish(trial_id,
  correction) returns finite JSON fidelity/diagnostics for the same state;
  teleport_cancel(trial_id) invalidates it. Finished same-correction retries are
  idempotent; changing correction after finish is rejected. Bounded expiring
  handles prevent unbounded retained state.
- Runtime: local ideal statevector callers may omit backend. Qollab must forward
  its selected simulator, which actually runs the measured circuit once.
  Support BasicSimulator and explicitly advertised Qiskit simulators with no
  noise model; reject hardware/unknown/noisy backends. Condition ideal Python
  state on the returned bits; label fidelity ideal_circuit, never tomography.
- JS: calibration.js pure game state, quantum-client.js adapters, later-level.js
  UI wiring using existing rooms/notebook/styles. stage-select.js caches
  stages 1–3 for direct selection and returning without resource/reward duplication.
- Tests: all named states/branches, wrong corrections/operations, bit wiring,
  same trial/replay/cancel/expiry, real simulator forwarding, hardware/errors,
  restricted exchange/cost/retry/reset/reward, real JS→Python paths and all
  original regression. No hosted/hardware completion claim.

T12 evidence: 44 Python, 31 JS unit, 1 integration tests passed; selected
BasicSimulator executes once, retained state recovery/cancel/expiry/replay tested.
Verified calibration evidence survives checkpoint reset as notebook discovery.


T17 local evidence: 44 Python, 37 JS unit, 2 real-Qiskit integration tests
passed (no skips/failures), including all calibration branch/state coverage,
wrong phase recovery, retained-trial retries and reward/reset semantics.
UI source review preserves Bell Lock and uses root main.css; hosted/actual
browser checks remain HUMAN_CHECK. Calibration notebook/channel are shared.

## W10 feature contract

- Concept: complementary security checks expose nonselective Z interception.
  Real Bell preparation and an environment recording Bob's Z bit model the
  attack; discard that record. Ideal ZZ/XX QBER=0; Z-intercept ZZ=0, XX=1/2.
- Python owns an opaque hidden link (ideal or intercepted), fixed across trials
  and resets. No scenario label leaves Python before player interpretation.
- Alice sees her basis and test-credit allocation (1–4), reasons about
  complementarity and sacrifices credits versus keeping them for messaging.
- Bob independently chooses/commits X/Z, then receives counts and per-basis
  QBER only after both players exchange their basis information. He commits
  trust/reject/insufficient evidence; no automatic answer displayed beforehand.
- Alice→Bob and Bob→Alice each send one basis bit (Z=0, X=1), one classical
  bit each, after the successful test. Only the committed basis bit is allowed.
- New security lab allocation: 12 credits and 24 classical bits, preserving
  fragments/notes. Allocation k purchases 1024*k independent test shots and
  costs k game source credits after a valid successful response. These are
  sampling-budget credits, not a claim about one physical pair per batch.
  Backend/import/conversion/invalid replies add no spending or disclosure.
- QBER only for matched bases; mismatch is unavailable evidence. Zero matched
  shots never certifies a link. Two matched complementary basis observations
  are required for level success. Reject if either observed QBER>=0.25;
  trust only with both basis observations and both QBER<=0.10; otherwise
  insufficient evidence. These are educational ideal-simulator evidence rules,
  not a general security proof/confidence interval for real noisy hardware.
- Wrong judgment keeps level closed and adds 10 suspicion; show the observed
  quantum consequence after commitment. Correct judgment with both bases
  awards one fragment once, preserves retained credits. Reset restores the
  same hidden link's checkpoint, clears test evidence and retains notes/reward.
- Python: warden_open(*, scenario=None, seed=None), warden_close(link_id),
  warden_experiment(config, shots, *, backend=None, seed=None). Config selects
  bases and either a hidden link_id or explicit attack for diagnostic tests.
  API returns finite counts, agreement/correlation, matched_shots and qber,
  never the hidden attack. Backend selected by Qollab actually runs circuits.
- JS: security.js pure state; quantum-client.js adapters; later-level.js
  Alice/Bob interaction after calibration. No HTTP, no new visual architecture.
- Tests: ideal/attacked ZZ/XX exact and sampled, mismatches, bit order, configs,
  real supplied simulator and backend errors, hidden-link lifecycle, choices/
  exchange/judgments/resources/reset, real integration, full existing regression.
  Optional noise deferred; hosted/hardware remains HUMAN_CHECK.

W12 evidence: 50 Python, 37 JS unit, 2 integration tests passed; exact
coherence loss, real backend ZZ/XX attack, mismatched QBER and bit order verified.


W17 local evidence: 52 Python, 42 JS unit, 3 real-Qiskit integration tests
passed, no skips/failures. Integration covers hidden ideal/intercepted links,
misleading ZZ-only trust, complementary XX, mismatches, required two-way
exchange, retained budgets, one reward and closed/error links. UI source
review additionally preserves independent drafts and calibration→Warden
navigation cleanup. Actual browser/hosted/device checks remain HUMAN_CHECK.

## Q10 utility contract

- Teach a four-qubit discrete Fourier spectrum, not factoring. M=16, r=4
  positions 0,4,8,12 → peaks 0,4,8,12; r=2 even positions → peaks 0,8.
- No Alice/Bob gameplay or UI in this conditional utility target. Both-role
  feature fields and resources are not applicable until a supervised Radio
  contract; the API cannot award rewards or spend game credits.
- Forward transform amplitude convention exp(+2*pi*i*x*y/M)/sqrt(M), final
  swaps included; inverse has negative sign. q0 is least significant bit;
  histogram keys use conventional high-to-low binary strings/integer y.
- Functions: qft_circuit(num_qubits, inverse=False), periodic_state(num_qubits,
  period, offset=0), periodic_circuit(..., inverse=False), and sampling API
  qft_experiment(config, shots, *, backend=None, seed=None) in api.py.
- Small bounded registers (1–6 qubits) and positive periods dividing M;
  integer offset 0<=offset<period; normalized state prepared through Qiskit.
- JSON: fixed-width counts, dominant output positions, register/period/offset/
  inverse metadata. No fabricated peaks or factoring claim. Device path uses
  selected backend/transpilation; omitted backend uses explicit ideal sampler.
- Verify independent Fourier complex amplitudes, inverse round trips, swapped/
  wrong-sign alternatives, r=2/r=4 exact spectra and sampled totals, bounds/
  ordering, supplied backend/errors, real JS/Python API and full regression.
  Stop at Q14; period.py and all later gameplay remain deferred.

Q12 gate: 58 Python, 42 JS unit, 3 integration tests passed. QFT matches
independent positive-sign Fourier matrices; inverse, missing swaps, shifted
phase and real selected-backend r=2/r=4 histograms verified.


Q13 evidence: 59 Python, 43 JS unit, 4 real-Qiskit integration tests passed
before final lifecycle/UI recovery refinements. QFT JSON results, async adapter,
selected backend, both spectra and invalid-period propagation verified.
Warden link replacement explicitly closes the old link and clears all its
sample evidence before opening a new drill; notes/rewards survive, one reward
per level. Normal checkpoint reset still preserves the same hidden link.
Q14 final regression results are recorded in VERIFY: 59 Python, 45 JS unit,
4 integration tests, all exit 0 with no failures/skips. No eligible local TODO
remains within this run's scope. Do not begin D10–D16.

S42 gate: 69 Python, 49 JS unit, 4 real-Qiskit integration and 1 Chromium test passed; all exit 0, no failures/skips. Independent Fourier sums and actual selected-backend r=2/4/8 spectra, sanitized metadata, phase/bit interpretation, errors, expiry and immutable retries verified.

Stage 4 gate: 69 Python, 55 JS unit, 5 real-Qiskit integration, 2 Chromium
tests passed, zero failures/skips. Both r=2/4, commitments, wrong spacing,
retry/reset/rewards and desktop/mobile views verified before Stage 5 gameplay.

S52/S59 final: 69 Python, 59 JS unit, 6 real-Qiskit integration, 4 Chromium
tests passed (138 total), all exit 0, no failures/skips. Hidden r=2/4/8 correct,
wrong inference, reversed-bit claims, immutable retries and private metadata
verified with real Qiskit. Browser checks cover both role views, preserved
manual drafts/discoveries, sealed answers/explanations, transport retry,
single rewards, checkpoint resets, mobile and Warden→Radio→Hidden Period.
Qiskit/game/software review and diff/layout checks passed; 54 flat upload files,
three added, no dependencies or AGENTS changes. No unresolved local blocker.
Hosted Qollab/manual device checks remain H01/H02/H04 HUMAN_CHECK. Use local
simulators for repeated play; IonQ permits one job per Run. STOP at S59.
Recommended next task: Stage 6 / Circuit Architect with its own contract/gates.
