import test from "node:test";
import assert from "node:assert/strict";
import { createSession, chooseGate, commitAlice, chooseBasis, choosePrediction, commitBob,
  beginExperiment, experimentRequest, finishExperiment, failExperiment, readyToRun,
  nextTrial, restartLevel, sendMessage, SHOTS, TRIAL_PAIRS } from "./level-one.js";
import { createBellExperiment } from "./quantum-client.js";
import { addNote } from "./notebook.js";

function committedTrial(session = createSession(), gate = "H", a = "Z", b = "Z", prediction = "correlated") {
  session = commitAlice(chooseGate(session, gate));
  session = chooseBasis(session, "alice", a);
  session = choosePrediction(session, prediction);
  return commitBob(chooseBasis(session, "bob", b));
}
// API fixtures test game rules only. Production never imports or generates these.
function apiResult(session, overrides = {}) {
  return { experiment: "bell", status: "ok", ...experimentRequest(session),
    counts: { "00": 512, "01": 0, "10": 0, "11": 512 }, agreement: 1,
    correlation: 1, correlation_type: "correlated", preparation_fidelity: 1, ...overrides };
}
function complete(session, overrides = {}) {
  const pending = beginExperiment(session);
  return finishExperiment(pending, apiResult(pending, overrides), pending.trial);
}

test("Alice must choose and commit a gate before choosing a basis", () => {
  const original = createSession();
  assert.equal(original.gate, null);
  assert.deepEqual(original.bases, { alice: null, bob: null });
  assert.equal(original.result, null);
  assert.equal(original.completed, false);
  assert.throws(() => commitAlice(original));
  assert.throws(() => chooseBasis(original, "alice", "Z"));
  let session = chooseGate(original, "X");
  assert.equal(session.result, null);
  assert.equal(session.completed, false);
  session = commitAlice(session);
  assert.throws(() => chooseGate(session, "H"));
  session = chooseBasis(session, "alice", "Z");
  assert.equal(session.bases.alice, "Z");
  assert.equal(original.gate, null);
  assert.equal(original.committed.alice, false);
  for (const gate of [null, "Y", "h", ""]) assert.throws(() => chooseGate(original, gate));
});

test("Bob predicts, selects his basis, and commits both before results exist", () => {
  let session = createSession();
  assert.throws(() => commitBob(session));
  assert.throws(() => chooseBasis(session, "bob", "X"));
  session = choosePrediction(session, "anticorrelated");
  assert.throws(() => commitBob(session));
  session = commitBob(chooseBasis(session, "bob", "X"));
  assert.throws(() => chooseBasis(session, "bob", "Z"));
  assert.throws(() => choosePrediction(session, "random"));
  assert.equal(session.result, null);
  assert.throws(() => beginExperiment(session));
  assert.throws(() => choosePrediction(createSession(), "same"));
  assert.throws(() => chooseBasis(createSession(), "warden", "Z"));
});

test("no request is available until both players finish their committed choices", () => {
  let session = createSession();
  assert.throws(() => experimentRequest(session));
  assert.throws(() => beginExperiment(session));
  session = commitAlice(chooseGate(session, "S"));
  session = commitBob(chooseBasis(choosePrediction(session, "random"), "bob", "Z"));
  assert.throws(() => beginExperiment(session)); // Alice still has no basis.
  session = chooseBasis(session, "alice", "X");
  assert.equal(readyToRun(session), true);
  const pending = beginExperiment(session);
  assert.deepEqual(experimentRequest(pending), { basis_a: "X", basis_b: "Z", preparation_gate: "S", shots: SHOTS });
  assert.equal(pending.result, null);
  assert.equal(pending.game.bellPairs, 12);
});

test("pending experiments freeze choices and reject duplicate runs, resets, and stale results", () => {
  const pending = beginExperiment(committedTrial());
  assert.throws(() => beginExperiment(pending));
  assert.throws(() => nextTrial(pending));
  assert.throws(() => restartLevel(pending));
  assert.throws(() => chooseBasis(pending, "alice", "X"));
  assert.throws(() => commitAlice(pending));
  assert.throws(() => commitBob(pending));
  assert.throws(() => finishExperiment(pending, apiResult(pending), pending.trial + 1));
  const completed = finishExperiment(pending, apiResult(pending), pending.trial);
  assert.throws(() => finishExperiment(completed, apiResult(pending), pending.trial));
  assert.equal(completed.game.vaultFragments, 1);
  assert.equal(completed.game.bellPairs, 12 - TRIAL_PAIRS);
  assert.equal(pending.game.vaultFragments, 0);
});

test("valid Bell preparation and a matching prediction open the lock for all basis combinations", () => {
  for (const [a, b, overrides, prediction] of [
    ["Z", "Z", {}, "correlated"], ["X", "X", {}, "correlated"],
    ["X", "Z", { counts: { "00": 256, "01": 256, "10": 256, "11": 256 }, agreement: 0.5, correlation: 0, correlation_type: "random" }, "random"],
    ["Z", "X", { counts: { "00": 256, "01": 256, "10": 256, "11": 256 }, agreement: 0.5, correlation: 0, correlation_type: "random" }, "random"],
  ]) {
    const session = complete(committedTrial(createSession(), "H", a, b, prediction), overrides);
    assert.equal(session.result.solved, true);
    assert.equal(session.completed, true);
    assert.equal(session.game.vaultFragments, 1);
    assert.equal(session.notes.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(session)), session);
  }
});

test("matching bits from an incorrect preparation do not earn a fragment", () => {
  for (const gate of ["X", "Z", "S"]) {
    const session = complete(committedTrial(createSession(), gate), { preparation_fidelity: 0.5 });
    assert.equal(session.result.predictionMatches, true);
    assert.equal(session.result.preparationMatches, false);
    assert.equal(session.completed, false);
    assert.equal(session.game.vaultFragments, 0);
  }
});

test("a wrong prediction keeps the lock closed even with a correct Bell state", () => {
  for (const prediction of ["anticorrelated", "random"]) {
    const session = complete(committedTrial(createSession(), "H", "Z", "Z", prediction));
    assert.equal(session.result.predictionMatches, false);
    assert.equal(session.result.preparationMatches, true);
    assert.equal(session.completed, false);
    assert.equal(session.game.vaultFragments, 0);
  }
});

test("failed or malformed responses cost nothing and can be retried with the same commitments", () => {
  const pending = beginExperiment(committedTrial());
  for (const overrides of [{ counts: {} }, { shots: 8 }, { basis_a: "X" }, { preparation_gate: "S" },
    { preparation_fidelity: NaN }, { agreement: null }, { correlation: 2 }, { correlation_type: "unknown" },
    { counts: { "00": 1025, "01": 0, "10": 0, "11": -1 } }, { status: "error" }]) {
    assert.throws(() => finishExperiment(pending, apiResult(pending, overrides), pending.trial));
  }
  const failed = failExperiment(pending, pending.trial);
  assert.equal(failed.result, null);
  assert.equal(failed.game.bellPairs, 12);
  assert.equal(failed.game.vaultFragments, 0);
  assert.equal(readyToRun(failed), true);
  assert.equal(complete(failed).completed, true);
});

test("only one fragment can be earned across new trials and checkpoint resets", () => {
  let session = complete(committedTrial());
  session = nextTrial(session);
  assert.equal(session.result, null);
  assert.equal(session.gate, null);
  assert.equal(session.prediction, null);
  assert.equal(session.completed, true);
  session = complete(committedTrial(session));
  assert.equal(session.game.vaultFragments, 1);
  session = restartLevel(sendMessage(session, "alice", "101"));
  assert.equal(session.game.vaultFragments, 1);
  assert.equal(session.game.bellPairs, 12);
  assert.equal(session.game.classicalBits, 20);
  assert.equal(session.messages.length, 0);
  assert.equal(session.notes.length, 2);
  session = complete(committedTrial(session));
  assert.equal(session.game.vaultFragments, 1);
});

test("experiments spend credits only on success and reject an exhausted source", () => {
  let session = createSession();
  for (let index = 0; index < 12; index++) {
    session = nextTrial(complete(committedTrial(session), { preparation_fidelity: 0.5 }));
  }
  assert.equal(session.game.bellPairs, 0);
  assert.equal(session.notes.length, 12);
  assert.throws(() => beginExperiment(committedTrial(session)));
  assert.equal(restartLevel(session).game.bellPairs, 12);
});

test("classical messages sent during a pending run survive the result transition", () => {
  const pending = beginExperiment(committedTrial());
  const withMessage = sendMessage(pending, "bob", "0101");
  const done = finishExperiment(withMessage, apiResult(pending), pending.trial);
  assert.equal(done.game.classicalBits, 16);
  assert.equal(done.messages.length, 1);
  assert.equal(pending.game.classicalBits, 20);
  for (const payload of ["", "hello", "02", "111111111", null]) assert.throws(() => sendMessage(done, "alice", payload));
  assert.throws(() => sendMessage(done, "warden", "1"));
  assert.throws(() => sendMessage({ ...done, game: { ...done.game, classicalBits: 0 } }, "alice", "1"));
});

test("notebook entries are immutable text and reject empty or oversized notes", () => {
  const original = Object.freeze([]);
  const notes = addNote(original, "  <script>plain text</script>  ");
  assert.equal(notes[0].text, "<script>plain text</script>");
  assert.equal(original.length, 0);
  for (const text of ["", "   ", null, "x".repeat(1001)]) assert.throws(() => addNote(notes, text));
});
