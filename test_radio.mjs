import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "./state.js";
import * as r from "./quantum-radio.js";
import { createRadioExperiments } from "./quantum-client.js";
const scenario = "c".repeat(32), trialId = "d".repeat(32);
const initial = () => r.attachRadio(r.createRadioSession({ ...createInitialState(), currentLevel: 4, vaultFragments: 3 }),
  { experiment: "radio", status: "ok", mode: "guided", scenario_id: scenario, num_qubits: 4,
    register_size: 16, bit_order: "q3q2q1q0", transform_sign: "positive", input_positions: [0, 4, 8, 12] });
function committed(s = initial()) {
  s = r.commitRadioAlice(r.chooseRadioAlice(s, 4));
  s = r.sendRadioMessage(s, "alice", "1");
  return r.commitRadioBob(r.chooseRadioBob(s, 4));
}
function measured(s = committed()) {
  s = r.beginRadioMeasurement(s);
  const counts = Object.fromEntries(Array.from({ length: 16 }, (_, y) => [y.toString(2).padStart(4, "0"), y % 4 === 0 ? 1024 : 0]));
  return r.receiveRadioMeasurement(s, { experiment: "radio", status: "ok", mode: "guided", scenario_id: scenario,
    trial_id: trialId, num_qubits: 4, register_size: 16, bit_order: "q3q2q1q0", shots: 4096, counts }, s.trial);
}
function verified(s, correct = true) {
  s = r.beginRadioVerification(s);
  return r.receiveRadioVerification(s, { experiment: "radio", status: "ok", trial_id: trialId,
    alice_matches: correct, bob_matches: correct, spectrum_consistent: true,
    observed_peaks: [0, 4, 8, 12], observed_spacing: 4, diagnostic: "Compare the interference peaks.", ...(correct ? { period: 4 } : {}) }, s.trial);
}
test("guided radio requires distinct commitments and exact exchange before a histogram", () => {
  let s = initial();
  assert.equal(s.measurement, null);
  assert.throws(() => r.beginRadioMeasurement(s));
  assert.throws(() => r.chooseRadioBob(s, 4));
  s = r.commitRadioAlice(r.chooseRadioAlice(s, 4));
  assert.throws(() => r.chooseRadioAlice(s, 2));
  assert.throws(() => r.sendRadioMessage(s, "alice", "0"));
  assert.throws(() => r.sendRadioMessage(s, "bob", "1"));
  s = r.sendRadioMessage(s, "alice", "1");
  assert.equal(s.game.classicalBits, 31);
  assert.throws(() => r.sendRadioMessage(s, "alice", "1"));
  assert.throws(() => r.beginRadioMeasurement(s));
  s = r.commitRadioBob(r.chooseRadioBob(s, 4));
  assert.throws(() => r.chooseRadioBob(s, 8));
  assert.deepEqual(r.radioRequest(r.beginRadioMeasurement(s)), { scenario_id: scenario, predictions: { alice_period: 4, bob_spacing: 4 }, shots: 4096 });
});
test("a successful quantum batch costs once; wrong hypotheses do not award rewards", () => {
  const s = verified(measured(), false);
  assert.equal(s.game.bellPairs, 11);
  assert.equal(s.game.vaultFragments, 3);
  assert.equal(s.completed, false);
  assert.ok(s.verification.diagnostic);
  assert.throws(() => r.receiveRadioMeasurement(s, {}, s.trial));
  assert.throws(() => r.receiveRadioVerification(s, {}, s.trial));
});
test("completion/reset/practice preserves discoveries and awards one fragment only", () => {
  let s = verified(measured());
  assert.equal(s.completed, true); assert.equal(s.game.vaultFragments, 4);
  s = r.resetRadio(s);
  assert.equal(s.game.bellPairs, 12); assert.equal(s.game.classicalBits, 32);
  assert.equal(s.scenario_id, scenario); assert.ok(s.notes.length);
  s = verified(measured(committed(s)));
  assert.equal(s.game.vaultFragments, 4);
  const replacement = r.replaceRadio(s);
  assert.equal(replacement.scenario_id, null); assert.equal(replacement.measurement, null);
  assert.equal(replacement.game.vaultFragments, 4);
});
test("transport failures, stale/malformed replies and early answer fields cannot spend", () => {
  const original = initial();
  assert.throws(() => r.attachRadio({ ...original, scenario_id: null }, { ...original.descriptor, period: 4 }));
  const s = r.beginRadioMeasurement(committed());
  assert.throws(() => r.resetRadio(s));
  assert.throws(() => r.receiveRadioMeasurement(s, {}, s.trial));
  assert.throws(() => r.failRadio(s, s.trial + 1));
  const retry = r.failRadio(s, s.trial);
  assert.equal(retry.phase, "bob"); assert.equal(retry.game.bellPairs, 12);
  assert.equal(retry.game.classicalBits, 31); // Previous legitimate exchange stays charged.
  const pending = r.beginRadioVerification(measured());
  assert.throws(() => r.receiveRadioVerification(pending, {}, pending.trial));
  const verifyRetry = r.failRadio(pending, pending.trial);
  assert.equal(verifyRetry.phase, "measured"); assert.equal(verifyRetry.game.bellPairs, 11);
  assert.equal(verified(verifyRetry).game.bellPairs, 11);
});
test("radio budgets cannot underflow and notes survive a new trial", () => {
  const s = committed();
  assert.throws(() => r.beginRadioMeasurement({ ...s, game: { ...s.game, bellPairs: 0 } }));
  const al = r.commitRadioAlice(r.chooseRadioAlice(initial(), 4));
  assert.throws(() => r.sendRadioMessage({ ...al, game: { ...al.game, classicalBits: 0 } }, "alice", "1"));
  const done = verified(measured());
  assert.deepEqual(r.nextRadioTrial(done).notes, done.notes);
});
test("radio adapter sends JSON predictions, reuses selected backend and releases result proxies", async t => {
  t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP transport"));
  const backend = { selected: true }; const calls = []; let released = 0;
  const fn = { callPromisingKwargs: async (...args) => { calls.push(args); return { toJs: () => ({ status: "ok" }), destroy: () => released++ }; } };
  const api = createRadioExperiments(fn, fn, fn, fn, fn, fn, backend);
  await api.open("guided"); await api.measure(r.radioRequest(r.beginRadioMeasurement(committed())));
  await api.verify(trialId); await api.discard(trialId); await api.close(scenario);
  assert.deepEqual(calls[1], [scenario, '{"alice_period":4,"bob_spacing":4}', 4096, { backend }]);
  assert.deepEqual(calls[2], [trialId, {}]); assert.equal(released, 5);
  await assert.rejects(createRadioExperiments(fn, fn, fn, fn, fn, fn, null).measure({}), /local simulator/);
});

const blindInitial = () => r.attachRadio(r.createRadioSession({ ...createInitialState(), currentLevel: 5 }),
  { experiment: "radio", status: "ok", mode: "blind", scenario_id: scenario, num_qubits: 4,
    register_size: 16, bit_order: "q3q2q1q0", transform_sign: "positive" });
function blindMeasured(s = blindInitial()) {
  s = r.beginRadioMeasurement(s);
  const fixture = measured().measurement;
  return r.receiveRadioMeasurement(s, { ...fixture, mode: "blind" }, s.trial);
}
const interpretation = { experiment: "radio", status: "ok", trial_id: trialId,
  observations: [0, 4, 8, 12], phases: ["0", "1/4", "1/2", "3/4"], payload: "0000010010001100" };
function blindInterpreted(s = blindMeasured()) {
  s = r.beginRadioInterpretation(s, "0,4,8,12", "0,1/4,1/2,3/4");
  return r.receiveRadioInterpretation(s, interpretation, s.trial);
}
function blindCommitted(s = blindInterpreted()) {
  return r.commitRadioBob(r.chooseRadioBob(r.sendRadioMessage(s, "alice", interpretation.payload), 4));
}
test("blind state holds only raw counts; manual interpretation and exact phase exchange precede Bob verification", () => {
  const initial = blindInitial();
  assert.equal(initial.mode, "blind"); assert.equal(initial.game.classicalBits, 128);
  assert.equal("period" in initial.descriptor, false); assert.equal("input_positions" in initial.descriptor, false);
  assert.throws(() => r.chooseRadioAlice(initial, 4));
  assert.throws(() => r.attachRadio({ ...initial, scenario_id: null }, { ...initial.descriptor, input_positions: [0, 4] }));
  assert.deepEqual(r.radioRequest(r.beginRadioMeasurement(initial)).predictions, {});
  const sample = blindMeasured();
  const pendingMeasurement = r.beginRadioMeasurement(initial);
  for (const field of ["input_positions", "observed_peaks", "observed_spacing", "period"]) {
    assert.throws(() => r.receiveRadioMeasurement(pendingMeasurement, { ...sample.measurement, [field]: 4 }, pendingMeasurement.trial));
  }
  assert.equal(sample.phase, "observing"); assert.equal(sample.game.bellPairs, 11);
  assert.equal(sample.claims, null); assert.equal(sample.received, null);
  assert.throws(() => r.beginRadioVerification(sample)); assert.throws(() => r.chooseRadioBob(sample, 4));
  const interpreted = blindInterpreted(sample);
  assert.throws(() => r.sendRadioMessage(interpreted, "alice", "0100"));
  assert.throws(() => r.sendRadioMessage(interpreted, "bob", interpretation.payload));
  const transmitted = r.sendRadioMessage(interpreted, "alice", interpretation.payload);
  assert.deepEqual(transmitted.received, interpretation.phases);
  assert.equal(transmitted.game.classicalBits, 112);
  assert.throws(() => r.beginRadioVerification(transmitted));
  assert.equal(r.beginRadioVerification(blindCommitted(interpreted)).phase, "verifying");
});
test("blind wrong inference hides solutions; only full success rewards and reset never duplicates a fragment", () => {
  const result = { experiment: "radio", status: "ok", trial_id: trialId,
    alice_matches: true, bob_matches: false, spectrum_consistent: true,
    diagnostic: "Your proposed period predicts spacing 8; its phase pattern does not match all peaks." };
  let pending = r.beginRadioVerification(blindCommitted());
  for (const field of ["period", "observed_peaks", "observed_spacing", "expected_peaks"]) {
    assert.throws(() => r.receiveRadioVerification(pending, { ...result, [field]: 4 }, pending.trial));
  }
  const wrong = r.receiveRadioVerification(pending, result, pending.trial);
  assert.equal(wrong.completed, false); assert.equal(wrong.game.vaultFragments, 0);
  assert.equal(wrong.game.bellPairs, 11); assert.equal("period" in wrong.verification, false);
  assert.throws(() => r.chooseRadioBob(wrong, 2));
  const correct = { ...result, bob_matches: true, period: 4, observed_peaks: [0, 4, 8, 12], observed_spacing: 4 };
  let s = r.receiveRadioVerification(pending, correct, pending.trial);
  assert.equal(s.completed, true); assert.equal(s.game.vaultFragments, 1);
  s = r.resetRadio(s);
  assert.equal(s.game.classicalBits, 128); assert.equal(s.game.bellPairs, 12);
  assert.equal(s.scenario_id, scenario); assert.ok(s.notes.length); assert.equal(s.claims, null);
  s = blindCommitted(blindInterpreted(blindMeasured(s))); pending = r.beginRadioVerification(s);
  s = r.receiveRadioVerification(pending, correct, pending.trial);
  assert.equal(s.game.vaultFragments, 1);
});
test("blind malformed/failed commits stay sealed and idempotent retries do not spend resources", () => {
  const sample = blindMeasured();
  assert.throws(() => r.beginRadioInterpretation(sample, "", ""));
  const committing = r.beginRadioInterpretation(sample, "0,4,8,12", "0,1/4,1/2,3/4");
  assert.throws(() => r.resetRadio(committing));
  assert.throws(() => r.receiveRadioInterpretation(committing, { ...interpretation, period: 4 }, committing.trial));
  assert.throws(() => r.receiveRadioInterpretation(committing, { ...interpretation, payload: "0100" }, committing.trial));
  const retry = r.failRadio(committing, committing.trial);
  assert.equal(retry.phase, "observing"); assert.equal(retry.game.bellPairs, 11); assert.equal(retry.game.classicalBits, 128);
  assert.throws(() => r.beginRadioInterpretation(retry, "0,8", "0,1/2"));
  const interpreted = blindInterpreted(retry);
  assert.throws(() => r.sendRadioMessage({ ...interpreted, game: { ...interpreted.game, classicalBits: 15 } }, "alice", interpretation.payload));
  const pending = r.beginRadioVerification(blindCommitted(interpreted));
  const verifyRetry = r.failRadio(pending, pending.trial);
  assert.equal(verifyRetry.phase, "bob"); assert.equal(verifyRetry.bobCommitted, true);
  assert.equal(r.beginRadioVerification(verifyRetry).game.bellPairs, 11);
  const measureRetry = r.failRadio(r.beginRadioMeasurement(blindInitial()), 1);
  assert.equal(measureRetry.phase, "choice"); assert.equal(measureRetry.game.bellPairs, 12);
});
