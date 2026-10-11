import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "./state.js";
import * as c from "./calibration.js";
import { createCalibrationExperiments } from "./quantum-client.js";
const id = "a".repeat(32);
const initial = () => c.enterCalibration({ ...createInitialState(), vaultFragments: 1 });
const prepared = (s = initial(), state = "0", bits = [0, 0], operation = "CX_H") => {
  s = c.beginMeasurement(c.chooseCalibration(s, state, operation));
  return c.receiveMeasurement(s, { experiment: "calibration", status: "ok", state_name: state,
    operation, trial_id: id, alice_bits: bits, diagnostic_source: "ideal_circuit" }, s.trial);
};
function complete(s, fidelity = 1) {
  s = c.beginRecovery(c.chooseCorrection(c.sendCalibrationMessage(s, "alice", s.alice_bits.join("")), "I"));
  return c.receiveRecovery(s, { experiment: "calibration", status: "ok", trial_id: id,
    state_name: s.state_name, operation: s.operation, alice_bits: s.alice_bits, correction: "I",
    fidelity, bob_probabilities: { "0": 0.5, "1": 0.5 }, diagnostic_source: "ideal_circuit" }, s.trial);
}
test("calibration cannot measure, disclose or correct before the required decisions and exchange", () => {
  const original = initial();
  assert.throws(() => c.beginMeasurement(original));
  assert.throws(() => c.chooseCorrection(original, "I"));
  const s = prepared();
  assert.equal(s.result, null);
  assert.equal(s.game.bellPairs, 12);
  assert.throws(() => c.chooseCalibration(s, "+", "CX_H"));
  assert.throws(() => c.sendCalibrationMessage(s, "alice", "11"));
  assert.throws(() => c.chooseCorrection(s, "I"));
  const sent = c.sendCalibrationMessage(s, "alice", "00");
  assert.equal(sent.game.classicalBits, 22);
  assert.throws(() => c.sendCalibrationMessage(sent, "alice", "00"));
  assert.equal(original.game.classicalBits, 24);
});
test("successful wrong physics spends exactly one reserved credit and earns no fragment", () => {
  for (const [operation, fidelity] of [["CX_H", 0], ["H_CX", 1], ["CX_ONLY", 1]]) {
    const s = complete(prepared(initial(), "0", [0, 0], operation), fidelity);
    assert.equal(s.game.bellPairs, 11);
    assert.equal(s.game.vaultFragments, 1);
    assert.equal(s.evidence.length, 0);
    assert.equal(s.result.recovered, fidelity === 1);
    assert.throws(() => c.receiveRecovery(s, s.result, s.trial));
  }
});
test("four successful trials finish calibration even with repeated states and random branches", () => {
  let s = initial();
  for (let trial = 1; trial <= 4; trial++) {
    s = complete(prepared(s));
    assert.equal(s.evidence.length, trial);
    assert.equal(s.completed, trial === 4);
    assert.equal(s.game.vaultFragments, trial === 4 ? 2 : 1);
    s = c.nextCalibration(s);
  }
  assert.equal(s.completed, true);
  assert.equal(s.game.vaultFragments, 2);
  assert.equal(s.game.bellPairs, 8);
  assert.equal(s.game.classicalBits, 16);
  const reset = c.resetCalibration(s);
  assert.equal(reset.evidence.length, 4);
  assert.equal(reset.game.bellPairs, 12);
  assert.equal(reset.game.classicalBits, 24);
  const practice = complete(prepared(reset));
  assert.equal(practice.game.vaultFragments, 2);
  assert.equal(practice.evidence.length, 4);
});
test("failure and malformed/stale recovery cannot spend or change the committed correction", () => {
  let s = c.beginRecovery(c.chooseCorrection(c.sendCalibrationMessage(prepared(), "alice", "00"), "X"));
  assert.throws(() => c.resetCalibration(s));
  assert.throws(() => c.receiveRecovery(s, {}, s.trial));
  assert.throws(() => c.failCalibration(s, s.trial + 1));
  s = c.failCalibration(s, s.trial);
  assert.equal(s.game.bellPairs, 12);
  assert.equal(s.game.classicalBits, 22);
  assert.throws(() => c.chooseCorrection(s, "Z"));
  assert.equal(c.beginRecovery(s).correction, "X");
});
test("a checkpoint reset retains partial four-trial progress without awarding early", () => {
  let s = initial();
  for (let trial = 0; trial < 2; trial++) s = c.nextCalibration(complete(prepared(s)));
  s = c.resetCalibration(s);
  assert.equal(s.evidence.length, 2);
  assert.equal(s.completed, false);
  assert.equal(s.game.vaultFragments, 1);
  assert.equal(s.game.bellPairs, 12);
  s = c.nextCalibration(complete(prepared(s)));
  assert.equal(s.completed, false);
  s = complete(prepared(s));
  assert.equal(s.completed, true);
  assert.equal(s.game.vaultFragments, 2);
});
test("insufficient budgets, early diagnostics and invalid messages are rejected", () => {
  let s = c.chooseCalibration(initial(), "0", "CX_H");
  for (const game of [{ ...s.game, bellPairs: 0 }, { ...s.game, classicalBits: 1 }]) assert.throws(() => c.beginMeasurement({ ...s, game }));
  s = c.beginMeasurement(s);
  assert.throws(() => c.receiveMeasurement(s, { fidelity: 1 }, s.trial));
  assert.equal(c.failCalibration(s, s.trial).phase, "choice");
  assert.throws(() => c.sendCalibrationMessage(prepared(), "bob", "mapping"));
  const measured = prepared();
  assert.throws(() => c.sendCalibrationMessage({ ...measured, game: { ...measured.game, classicalBits: 2 } }, "bob", "1"), /reserved/);
});
test("staged bridge forwards selected backend only to measurement and releases proxies", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP fallback"));
  const backend = Object.freeze({ chosen: true });
  const calls = []; let releases = 0;
  const fn = { callPromisingKwargs: async (...args) => { calls.push(args); return {
    toJs: () => ({ status: "ok" }), destroy: () => releases++ }; } };
  const api = createCalibrationExperiments(fn, fn, fn, backend);
  await api.prepare({ state_name: "+i", operation: "CX_H" });
  await api.finish({ trial_id: id, correction: "Z" });
  await api.cancel(id);
  assert.deepEqual(calls, [["+i", "CX_H", { backend }], [id, "Z", {}], [id, {}]]);
  assert.equal(releases, 3);
  assert.equal(fetch.mock.callCount(), 0);
  await assert.rejects(createCalibrationExperiments(fn, fn, fn, undefined).prepare({}), /simulator/);
});
