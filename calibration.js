/** Calibration game decisions only. Python owns the measured quantum state. */
import { validateState } from "./state.js";
import { spendBellPairs, spendClassicalBits, awardFragments } from "./resources.js";
import { advanceLevel, resetLevel } from "./levels.js";
import { addNote } from "./notebook.js";

const choices = () => ({ phase: "choice", state_name: null, operation: null,
  trial_id: null, alice_bits: null, received: null, correction: null,
  bobCommitted: false, running: false, result: null });
const unit = (n) => Number.isFinite(n) && n >= 0 && n <= 1;
export const REQUIRED_RECOVERIES = 4;
export function createCalibration(game, notes = []) {
  validateState(game);
  if (game.currentLevel !== 2) throw new Error("Calibration requires level 2.");
  return { game: { ...game }, checkpoint: { ...game }, notes: [...notes], messages: [],
    evidence: [], completed: false, trial: 1, ...choices() };
}
export function enterCalibration(game, notes = []) {
  if (game.currentLevel !== 1) throw new Error("Finish Bell Lock first.");
  // Explicit bounded allocation for the next teaching laboratory.
  return createCalibration({ ...advanceLevel(game), bellPairs: 12, classicalBits: 24 }, notes);
}
function phase(s, expected) {
  if (s.phase !== expected) throw new Error(`This action requires the ${expected} phase.`);
}
export function chooseCalibration(s, state_name, operation) {
  phase(s, "choice");
  if (!["0", "+", "+i"].includes(state_name) || !["CX_H", "H_CX", "CX_ONLY"].includes(operation)) {
    throw new Error("Choose a calibration state and Bell-measurement operation.");
  }
  return { ...s, state_name, operation };
}
export function beginMeasurement(s) {
  phase(s, "choice");
  if (!s.state_name || !s.operation || s.game.bellPairs < 1 || s.game.classicalBits < 2) {
    throw new Error("Choose Alice's circuit; reserve one source credit and two classical bits.");
  }
  return { ...s, phase: "preparing", running: true };
}
export function receiveMeasurement(s, result, trial) {
  phase(s, "preparing");
  if (trial !== s.trial || result?.status !== "ok" || result.experiment !== "calibration"
      || result.state_name !== s.state_name || result.operation !== s.operation
      || result.diagnostic_source !== "ideal_circuit" || !/^[a-f0-9]{32}$/.test(result.trial_id)
      || !Array.isArray(result.alice_bits) || result.alice_bits.length !== 2
      || result.alice_bits.some((bit) => bit !== 0 && bit !== 1)
      || "fidelity" in result || "bob_probabilities" in result) throw new Error("Invalid calibration measurement.");
  return { ...s, phase: "measured", running: false, trial_id: result.trial_id,
    alice_bits: [...result.alice_bits] };
}
export function sendCalibrationMessage(s, role, payload) {
  if (role === "alice") {
    phase(s, "measured");
    if (payload !== s.alice_bits.join("")) throw new Error("Alice may transmit only her measured two bits.");
    const game = spendClassicalBits(s.game, 2);
    return { ...s, game, phase: "received", received: payload,
      messages: [...s.messages, { id: s.messages.length + 1, role, payload }] };
  }
  if (role !== "bob" || typeof payload !== "string" || !/^[01]{1,8}$/.test(payload)) {
    throw new Error("Use a binary hypothesis message; Alice sends exactly her two bits.");
  }
  if (["preparing", "measured"].includes(s.phase) && s.game.classicalBits - payload.length < 2) {
    throw new Error("Two classical bits are reserved for Alice's measured transmission.");
  }
  return { ...s, game: spendClassicalBits(s.game, payload.length),
    messages: [...s.messages, { id: s.messages.length + 1, role, payload }] };
}
export function chooseCorrection(s, correction) {
  phase(s, "received");
  if (s.bobCommitted || !["I", "X", "Z", "XZ"].includes(correction)) throw new Error("Choose an uncommitted Pauli correction.");
  return { ...s, correction };
}
export function beginRecovery(s) {
  phase(s, "received");
  if (!s.correction || !s.received) throw new Error("Receive Alice's bits and choose a correction first.");
  return { ...s, phase: "verifying", running: true, bobCommitted: true };
}
export function receiveRecovery(s, result, trial) {
  phase(s, "verifying");
  const probabilities = result?.bob_probabilities;
  if (trial !== s.trial || result?.status !== "ok" || result.experiment !== "calibration"
      || result.trial_id !== s.trial_id || result.correction !== s.correction
      || result.state_name !== s.state_name || result.operation !== s.operation
      || result.alice_bits?.join("") !== s.received || result.diagnostic_source !== "ideal_circuit"
      || !unit(result.fidelity) || !probabilities || Object.keys(probabilities).sort().join() !== "0,1"
      || !unit(probabilities["0"]) || !unit(probabilities["1"])
      || Math.abs(probabilities["0"] + probabilities["1"] - 1) > 1e-9) throw new Error("Invalid recovery; retry the same committed trial.");
  const evidence = [...s.evidence];
  const recovered = result.fidelity >= 1 - 1e-9;
  // Each committed trial counts once; repeated random branches are valid.
  if (recovered && s.operation === "CX_H" && evidence.length < REQUIRED_RECOVERIES) {
    evidence.push(`${s.trial}:${s.received}:${s.state_name}`);
  }
  const completed = evidence.length >= REQUIRED_RECOVERIES;
  let game = spendBellPairs(s.game, 1);
  if (completed && !s.completed) game = awardFragments(game);
  return { ...s, phase: "result", running: false, game, evidence, completed: s.completed || completed,
    result: { ...result, recovered },
    notes: addNote(s.notes, `Calibration ${s.received}, state |${s.state_name}>, ${s.operation}, Bob ${s.correction}: fidelity ${result.fidelity.toFixed(4)}. Compare complementary states before inferring a rule.`) };
}
export function failCalibration(s, trial) {
  if (!s.running || trial !== s.trial) throw new Error("No matching pending calibration.");
  return { ...s, running: false, phase: s.phase === "preparing" ? "choice" : "received" };
}
export function nextCalibration(s) {
  phase(s, "result");
  return { ...s, ...choices(), trial: s.trial + 1 };
}
export function resetCalibration(s) {
  if (s.running) throw new Error("Wait for the pending experiment.");
  const game = { ...resetLevel(s.game, s.checkpoint), vaultFragments: s.game.vaultFragments };
  return { ...s, ...choices(), game, messages: [], trial: s.trial + 1 };
}
