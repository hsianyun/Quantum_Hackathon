import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState } from "./state.js";
import * as w from "./security.js";
import { createSecurityExperiments, createQftExperiment, callPython } from "./quantum-client.js";
const id = "b".repeat(32);
const initial = () => w.attachLink(w.enterSecurity({ ...createInitialState(), currentLevel: 2, vaultFragments: 2 }),
  { status: "ok", experiment: "warden", link_id: id });
function pending(s = initial(), a = "Z", b = a, allocation = 1) {
  s = w.commitSecurity(w.chooseSecurity(s, "alice", a, allocation), "alice");
  s = w.commitSecurity(w.chooseSecurity(s, "bob", b), "bob");
  return w.beginSecurity(s);
}
function sampled(s, qber = 0) {
  const matched = s.bases.alice === s.bases.bob;
  const shots = s.allocation * 1024;
  const result = { status: "ok", experiment: "warden", link_id: id, basis_a: s.bases.alice,
    basis_b: s.bases.bob, shots, counts: { "00": shots / 2, "01": 0, "10": 0, "11": shots / 2 },
    agreement: 1 - qber, correlation: 1 - 2 * qber, correlation_type: qber === 0 ? "correlated" : "random",
    matched_shots: matched ? shots : 0, qber: matched ? qber : null, qber_status: matched ? "measured" : "unavailable" };
  if (qber === 0.5) result.counts = { "00": shots / 4, "01": shots / 4, "10": shots / 4, "11": shots / 4 };
  return w.receiveSecurity(s, result, s.trial);
}
function exchanged(s) {
  s = w.exchangeSecurity(s, "alice", s.bases.alice === "X" ? "1" : "0");
  return w.exchangeSecurity(s, "bob", s.bases.bob === "X" ? "1" : "0");
}
test("security requires independent commitment and budgeted basis exchange before judgment", () => {
  assert.throws(() => w.beginSecurity(initial()));
  let s = pending();
  assert.throws(() => w.chooseSecurity(s, "alice", "X", 1));
  assert.throws(() => w.resetSecurity(s));
  s = sampled(s);
  assert.equal(s.result, null);
  assert.equal(s.game.bellPairs, 11);
  assert.throws(() => w.judgeSecurity(s, "trust"));
  assert.throws(() => w.exchangeSecurity(s, "alice", "1"));
  s = w.exchangeSecurity(s, "alice", "0");
  assert.throws(() => w.exchangeSecurity(s, "alice", "0"));
  assert.throws(() => w.judgeSecurity(s, "trust"));
  s = w.exchangeSecurity(s, "bob", "0");
  assert.equal(s.game.classicalBits, 22);
  assert.equal(w.judgeSecurity(s, "insufficient").result.correct, true);
});

test("expired-link replacement clears old observations and preserves notes/rewards", () => {
  let s = w.judgeSecurity(exchanged(sampled(pending())), "insufficient");
  s = w.replaceSecurityLink(s);
  assert.equal(s.link_id, null);
  assert.deepEqual(s.samples, {});
  assert.equal(s.game.vaultFragments, 2);
  assert.equal(s.game.bellPairs, 12);
  assert.ok(s.notes.length);
  assert.throws(() => w.beginSecurity(s));
  const replacement = w.attachLink(s, { status: "ok", experiment: "warden", link_id: "c".repeat(32) });
  assert.notEqual(replacement.link_id, id);
});
test("shared async conversion failures release the result and preserve the underlying cause", async () => {
  let released = 0;
  const cause = new Error("conversion failed");
  const fn = { callPromisingKwargs: async () => ({ toJs: () => { throw cause; }, destroy: () => released++ }) };
  await assert.rejects(callPython(fn, []), (error) => error.cause === cause && /No new experiment resources/.test(error.message));
  assert.equal(released, 1);
});

test("QFT utility adapter preserves configuration and selected backend without spending game budgets", async () => {
  const backend = Object.freeze({ selected: true });
  const config = Object.freeze({ num_qubits: 4, period: 2, inverse: true });
  const fn = { callPromisingKwargs: async (...args) => ({ toJs: () => args }) };
  const run = createQftExperiment(fn, backend);
  assert.deepEqual(await run({ config, shots: 4096 }), [config, 4096, { backend }]);
  await assert.rejects(createQftExperiment(fn, undefined)({ config, shots: 4096 }), /backend/);
});
test("ZZ-only trust fails; attacked XX plus ZZ teaches rejection and awards once", () => {
  let s = w.judgeSecurity(exchanged(sampled(pending())), "trust");
  assert.equal(s.completed, false);
  assert.equal(s.game.wardenSuspicion, 10);
  s = w.judgeSecurity(exchanged(sampled(pending(w.nextSecurity(s), "X"), 0.5)), "reject");
  assert.equal(s.completed, true);
  assert.equal(s.game.vaultFragments, 3);
  assert.equal(s.game.bellPairs, 10);
  assert.throws(() => w.judgeSecurity(s, "reject"));
  s = w.resetSecurity(s);
  assert.equal(s.link_id, id);
  assert.equal(s.game.bellPairs, 12);
  assert.equal(s.game.vaultFragments, 3);
  assert.ok(s.notes.length);
  s = w.judgeSecurity(exchanged(sampled(pending(s))), "insufficient");
  s = w.judgeSecurity(exchanged(sampled(pending(w.nextSecurity(s), "X"), 0.5)), "reject");
  assert.equal(s.game.vaultFragments, 3);
});
test("ideal complementary samples support trust; mismatches remain insufficient", () => {
  let s = w.judgeSecurity(exchanged(sampled(pending())), "insufficient");
  s = w.judgeSecurity(exchanged(sampled(pending(w.nextSecurity(s), "X"))), "trust");
  assert.equal(s.result.solved, true);
  const mismatch = exchanged(sampled(pending(initial(), "X", "Z"), 0.5));
  assert.deepEqual(mismatch.samples, {});
  assert.equal(w.judgeSecurity(mismatch, "insufficient").result.correct, true);
});
test("allocation costs are bounded; failed malformed/stale results cannot spend", () => {
  const original = initial();
  assert.throws(() => w.chooseSecurity(original, "alice", "X", 0));
  const s = pending(original, "X", "X", 4);
  assert.equal(w.securityRequest(s).shots, 4096);
  assert.equal(sampled(s).game.bellPairs, 8);
  assert.throws(() => w.receiveSecurity(s, {}, s.trial));
  assert.throws(() => w.failSecurity(s, s.trial + 1));
  const retry = w.failSecurity(s, s.trial);
  assert.equal(retry.game.bellPairs, 12);
  assert.equal(retry.sample, null);
  assert.equal(w.beginSecurity(retry).running, true);
  assert.equal(original.game.bellPairs, 12);
});
test("security async adapter forwards selected backend and propagates errors without HTTP", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP"));
  const backend = Object.freeze({ selected: true });
  const fn = { callPromisingKwargs: async (...args) => ({ toJs: () => args }) };
  const api = createSecurityExperiments(fn, fn, fn, backend);
  const request = { config: { basis_a: "X", basis_b: "X", link_id: id }, shots: 1024 };
  assert.deepEqual(await api.run(request), [request.config, 1024, { backend }]);
  assert.deepEqual(await api.open(), [{}]);
  await assert.rejects(createSecurityExperiments(fn, { callPromisingKwargs: async () => { throw new Error("backend broke"); } }, fn, backend).run(request), /backend broke/);
  assert.equal(fetch.mock.callCount(), 0);
});
