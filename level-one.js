import { createInitialState } from "./state.js";
import { spendBellPairs, spendClassicalBits, awardFragments } from "./resources.js";
import { resetLevel } from "./levels.js";
import { addNote } from "./notebook.js";

// One game source credit purchases a measurement batch of independent pairs.
export const TRIAL_PAIRS = 1;
export const SHOTS = 1024;
export const GATES = ["H", "X", "Z", "S"];
export const PREDICTIONS = ["correlated", "anticorrelated", "random"];

const choices = () => ({ gate: null, bases: { alice: null, bob: null }, prediction: null,
  committed: { alice: false, bob: false }, result: null, running: false });

export function createSession() {
  const game = createInitialState();
  return { game, checkpoint: { ...game }, ...choices(), trial: 1, completed: false,
    messages: [], notes: [] };
}
function editable(session) {
  if (session.running || session.result) throw new Error("Start a new trial before changing choices.");
}
export function chooseGate(session, gate) {
  editable(session);
  if (session.committed.alice) throw new Error("Alice's preparation is committed.");
  if (!GATES.includes(gate)) throw new RangeError("Choose H, X, Z, or S.");
  return { ...session, gate };
}
export function commitAlice(session) {
  editable(session);
  if (!session.gate) throw new Error("Choose the missing gate first.");
  return { ...session, committed: { ...session.committed, alice: true } };
}
export function choosePrediction(session, prediction) {
  editable(session);
  if (session.committed.bob) throw new Error("Bob's prediction is committed.");
  if (!PREDICTIONS.includes(prediction)) throw new RangeError("Choose a prediction.");
  return { ...session, prediction };
}
export function chooseBasis(session, role, basis) {
  editable(session);
  if (!["alice", "bob"].includes(role)) throw new RangeError("Choose Alice or Bob.");
  if (role === "alice" && !session.committed.alice) throw new Error("Commit Alice's gate before choosing a basis.");
  if (role === "bob" && !session.prediction) throw new Error("Choose Bob's prediction before his basis.");
  if (role === "bob" && session.committed.bob) throw new Error("Bob's basis is committed.");
  if (!["X", "Z"].includes(basis)) throw new RangeError("Choose X or Z.");
  return { ...session, bases: { ...session.bases, [role]: basis } };
}
export function commitBob(session) {
  editable(session);
  if (!session.prediction || !session.bases.bob) throw new Error("Choose Bob's prediction and basis first.");
  return { ...session, committed: { ...session.committed, bob: true } };
}
export function readyToRun(session) {
  return session.committed.alice && session.committed.bob && Boolean(session.bases.alice)
    && !session.running && !session.result && session.game.bellPairs >= TRIAL_PAIRS;
}
export function beginExperiment(session) {
  if (!readyToRun(session)) throw new Error("Both players must finish their choices and commit; a source credit is required.");
  return { ...session, running: true };
}
export function experimentRequest(session) {
  if (!session.running) throw new Error("Begin the committed experiment first.");
  return { basis_a: session.bases.alice, basis_b: session.bases.bob,
    preparation_gate: session.gate, shots: SHOTS };
}
function validateResult(session, result) {
  const expected = experimentRequest(session);
  const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
  if (!result || result.status !== "ok" || result.experiment !== "bell"
      || Object.entries(expected).some(([key, value]) => result[key] !== value)
      || !PREDICTIONS.includes(result.correlation_type)
      || !unit(result.agreement) || !unit(result.preparation_fidelity)
      || !Number.isFinite(result.correlation) || Math.abs(result.correlation) > 1
      || !result.counts || Object.keys(result.counts).sort().join(",") !== "00,01,10,11"
      || Object.values(result.counts).some((n) => !Number.isSafeInteger(n) || n < 0)
      || Object.values(result.counts).reduce((total, n) => total + n, 0) !== SHOTS) {
    throw new Error("The quantum service returned an invalid result. Retry without spending resources.");
  }
}
export function finishExperiment(session, result, trial) {
  if (!session.running || session.result || trial !== session.trial) throw new Error("This experiment is no longer pending.");
  validateResult(session, result);
  // Completion rules belong here; quantum diagnostics are supplied by Python.
  const predictionMatches = result.correlation_type === session.prediction;
  const preparationMatches = result.preparation_fidelity >= 1 - 1e-9;
  const solved = predictionMatches && preparationMatches;
  let game = spendBellPairs(session.game, TRIAL_PAIRS);
  if (solved && !session.completed) game = awardFragments(game, 1);
  return { ...session, running: false, game, completed: session.completed || solved,
    result: { ...result, predictionMatches, preparationMatches, solved },
    notes: addNote(session.notes, `Trial ${session.trial}: gate ${session.gate}; ${result.basis_a}/${result.basis_b}; ${Math.round(result.agreement * 100)}% agreement over ${result.shots} shots. Bob predicted ${session.prediction}; observed ${result.correlation_type}. ${solved ? "Bell Lock solved." : "Lock closed; revise and retry."}`) };
}
export function failExperiment(session, trial) {
  if (!session.running || trial !== session.trial) throw new Error("This experiment is no longer pending.");
  return { ...session, running: false };
}
export function nextTrial(session) {
  if (session.running) throw new Error("Wait for the pending experiment.");
  return { ...session, ...choices(), trial: session.trial + 1 };
}
export function restartLevel(session) {
  const reset = nextTrial(session);
  const game = resetLevel(session.game, session.checkpoint);
  // Restoring the source must never erase or duplicate a previously earned fragment.
  game.vaultFragments = session.game.vaultFragments;
  return { ...reset, game, messages: [] };
}
export function sendMessage(session, role, payload) {
  if (!["alice", "bob"].includes(role)) throw new RangeError("Choose Alice or Bob.");
  const bits = typeof payload === "string" ? payload.trim() : "";
  if (!/^[01]{1,8}$/.test(bits)) throw new RangeError("Enter 1-8 binary digits (0 or 1).");
  const game = spendClassicalBits(session.game, bits.length);
  return { ...session, game, messages: [...session.messages, { id: session.messages.length + 1, role, payload: bits }] };
}
