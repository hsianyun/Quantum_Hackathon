/** Radio commitments/resources only. Qiskit and scientific checks stay in Python. */
import { validateState } from "./state.js";
import { spendBellPairs, spendClassicalBits, awardFragments } from "./resources.js";
import { resetLevel } from "./levels.js";
import { addNote } from "./notebook.js";

export const RADIO_SHOTS = 4096;
const choices = () => ({ phase: "choice", running: false, trial_id: null, measurement: null,
  alice_period: null, aliceCommitted: false, received: null, bob_spacing: null,
  bobCommitted: false, verification: null, observations_text: "", phases_text: "", claims: null });
const id = value => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
const positions = value => Array.isArray(value) && value.length > 0 && value.length <= 16
  && value.every(n => Number.isSafeInteger(n) && n >= 0 && n < 16) && new Set(value).size === value.length;
const leaked = result => ["period", "offset", "expected_peaks", "dominant_positions", "observed_peaks", "observed_spacing"].some(key => key in result);
function requirePhase(s, name) { if (s.phase !== name) throw new Error(`This action requires the ${name} phase.`); }

export function createRadioSession(game, notes = []) {
  validateState(game);
  if (![4, 5].includes(game.currentLevel)) throw new Error("Radio requires stage 4 or 5.");
  const budget = { ...game, bellPairs: 12, classicalBits: game.currentLevel === 4 ? 32 : 128 };
  return { game: budget, checkpoint: { ...budget }, mode: game.currentLevel === 4 ? "guided" : "blind", notes: [...notes], messages: [],
    completed: false, scenario_id: null, descriptor: null, trial: 1, ...choices() };
}
export function attachRadio(s, result) {
  if (s.scenario_id || result?.experiment !== "radio" || result.status !== "ok" || result.mode !== s.mode
      || !id(result.scenario_id) || result.register_size !== 16 || result.num_qubits !== 4
      || result.bit_order !== "q3q2q1q0" || result.transform_sign !== "positive" || leaked(result)
      || (s.mode === "guided" ? !positions(result.input_positions) : "input_positions" in result)) throw new Error("Invalid radio-scenario response.");
  return { ...s, scenario_id: result.scenario_id, descriptor: s.mode === "guided"
    ? { ...result, input_positions: [...result.input_positions] } : { ...result } };
}
export function chooseRadioAlice(s, period) {
  requirePhase(s, "choice");
  if (s.mode !== "guided" || !s.scenario_id || s.aliceCommitted || ![2, 4].includes(period)) throw new Error("Inspect the pattern and choose an uncommitted period hypothesis.");
  return { ...s, alice_period: period };
}
export function commitRadioAlice(s) {
  requirePhase(s, "choice");
  if (!s.alice_period || s.aliceCommitted) throw new Error("Choose Alice's periodic-structure hypothesis first.");
  return { ...s, aliceCommitted: true };
}
export function sendRadioMessage(s, role, payload) {
  if (s.mode === "blind") {
    requirePhase(s, "interpreted");
    if (role !== "alice" || !s.claims || payload !== s.claims.payload || s.received !== null) throw new Error("Transmit only Alice's committed phase encoding, once.");
    return { ...s, phase: "bob", received: [...s.claims.phases], game: spendClassicalBits(s.game, payload.length),
      messages: [...s.messages, { id: s.messages.length + 1, role, payload }] };
  }
  requirePhase(s, "choice");
  if (role !== "alice" || !s.aliceCommitted || s.received !== null
      || payload !== (s.alice_period === 2 ? "0" : "1")) throw new Error("Alice sends exactly her committed period code (2=0, 4=1), once.");
  return { ...s, phase: "bob", received: s.alice_period, game: spendClassicalBits(s.game, 1),
    messages: [...s.messages, { id: s.messages.length + 1, role, payload }] };
}
export function chooseRadioBob(s, spacing) {
  requirePhase(s, "bob");
  if (s.bobCommitted || ![2, 4, 8].includes(spacing)) throw new Error(s.mode === "guided" ? "Choose an uncommitted Fourier peak-spacing hypothesis." : "Choose an uncommitted hidden-period hypothesis.");
  return { ...s, bob_spacing: spacing };
}
export function commitRadioBob(s) {
  requirePhase(s, "bob");
  if (!s.bob_spacing || s.bobCommitted) throw new Error(s.mode === "guided" ? "Predict peak spacing before committing." : "Infer a candidate period before committing.");
  return { ...s, bobCommitted: true };
}
export function beginRadioMeasurement(s) {
  requirePhase(s, s.mode === "guided" ? "bob" : "choice");
  if (!s.scenario_id || (s.mode === "guided" && (!s.aliceCommitted || !s.bobCommitted || s.received === null)) || s.game.bellPairs < 1) {
    throw new Error("Commit both hypotheses and exchange Alice's code with one source credit available.");
  }
  return { ...s, phase: "measuring", running: true };
}
export function radioRequest(s) {
  requirePhase(s, "measuring");
  return { scenario_id: s.scenario_id, predictions: s.mode === "guided"
    ? { alice_period: s.alice_period, bob_spacing: s.bob_spacing } : {}, shots: RADIO_SHOTS };
}
export function receiveRadioMeasurement(s, result, trial) {
  requirePhase(s, "measuring");
  const keys = Array.from({ length: 16 }, (_, y) => y.toString(2).padStart(4, "0"));
  if (trial !== s.trial || result?.status !== "ok" || result.experiment !== "radio" || result.mode !== s.mode
      || result.scenario_id !== s.scenario_id || !id(result.trial_id) || result.register_size !== 16
      || result.num_qubits !== 4 || result.bit_order !== "q3q2q1q0" || result.shots !== RADIO_SHOTS
      || leaked(result) || "input_positions" in result || !result.counts || Object.keys(result.counts).sort().join() !== keys.join()
      || Object.values(result.counts).some(n => !Number.isSafeInteger(n) || n < 0)
      || Object.values(result.counts).reduce((a, b) => a + b, 0) !== RADIO_SHOTS) throw new Error("Invalid radio histogram; no source credit spent.");
  return { ...s, phase: s.mode === "guided" ? "measured" : "observing", running: false, trial_id: result.trial_id,
    measurement: { ...result, counts: { ...result.counts } }, game: spendBellPairs(s.game, 1) };
}
export function beginRadioVerification(s) {
  requirePhase(s, s.mode === "guided" ? "measured" : "bob");
  if (s.mode === "blind" && (!s.claims || s.received === null || !s.bobCommitted)) throw new Error("Exchange the committed phases and commit Bob's candidate first.");
  return { ...s, phase: "verifying", running: true };
}
export function receiveRadioVerification(s, result, trial) {
  requirePhase(s, "verifying");
  const matched = result?.alice_matches && result?.bob_matches && result?.spectrum_consistent;
  if (trial !== s.trial || result?.status !== "ok" || result.experiment !== "radio" || result.trial_id !== s.trial_id
      || ["alice_matches", "bob_matches", "spectrum_consistent"].some(key => typeof result[key] !== "boolean")
      || typeof result.diagnostic !== "string" || !result.diagnostic
      || ((s.mode === "guided" || matched) ? (!positions(result.observed_peaks)
        || (result.observed_spacing !== null && (!Number.isSafeInteger(result.observed_spacing) || result.observed_spacing < 1 || result.observed_spacing > 16)))
        : ["observed_peaks", "observed_spacing", "expected_peaks", "input_positions"].some(key => key in result))
      || (matched ? result.period !== (s.mode === "guided" ? s.alice_period : s.bob_spacing) : "period" in result)) throw new Error("Invalid radio verification; retry the same committed trial.");
  const game = matched && !s.completed ? awardFragments(s.game) : s.game;
  return { ...s, phase: "result", running: false, game, completed: s.completed || matched,
    verification: { ...result, solved: Boolean(matched) },
    notes: addNote(s.notes, s.mode === "guided"
      ? `Quantum Radio: N=16, Alice r=${s.alice_period}, Bob spacing=${s.bob_spacing}. ${result.diagnostic}`
      : `Hidden Period: N=16, claimed y=${s.claims.observations.join(",")}, phases=${s.claims.phases.join(",")}, Bob candidate r=${s.bob_spacing}. ${result.diagnostic}`) };
}
export function failRadio(s, trial) {
  if (!s.running || trial !== s.trial) throw new Error("No matching pending radio request.");
  return { ...s, running: false, phase: s.mode === "guided" ? (s.phase === "measuring" ? "bob" : "measured")
    : ({ measuring: "choice", committing: "observing", verifying: "bob" })[s.phase] };
}
export function beginRadioInterpretation(s, observations, phases) {
  requirePhase(s, "observing");
  if (s.mode !== "blind" || typeof observations !== "string" || typeof phases !== "string"
      || !observations.trim() || !phases.trim() || observations.length > 256 || phases.length > 256) throw new Error("Enter integer outcomes and phase fractions in matching order.");
  if (s.aliceCommitted && (s.observations_text !== observations || s.phases_text !== phases)) throw new Error("Retry the same committed interpretation or reset the trial.");
  return { ...s, phase: "committing", running: true, aliceCommitted: true, observations_text: observations, phases_text: phases };
}
export function receiveRadioInterpretation(s, result, trial) {
  requirePhase(s, "committing");
  if (trial !== s.trial || result?.experiment !== "radio" || result.status !== "ok" || result.trial_id !== s.trial_id || leaked(result) || "input_positions" in result
      || !positions(result.observations) || result.observations.length > 8
      || !Array.isArray(result.phases) || result.phases.length !== result.observations.length
      || result.phases.some(phase => typeof phase !== "string" || !/^(?:0|[1-9]\d*(?:\/[1-9]\d*)?)$/.test(phase))
      || new Set(result.phases).size !== result.phases.length || typeof result.payload !== "string"
      || !/^[01]+$/.test(result.payload) || result.payload.length !== 4 * result.phases.length) throw new Error("Invalid committed interpretation; retry the same input.");
  return { ...s, phase: "interpreted", running: false,
    claims: { observations: [...result.observations], phases: [...result.phases], payload: result.payload } };
}
export function nextRadioTrial(s) {
  requirePhase(s, "result");
  return { ...s, ...choices(), trial: s.trial + 1 };
}
export function resetRadio(s) {
  if (s.running) throw new Error("Wait for the pending radio request.");
  return { ...s, ...choices(), trial: s.trial + 1, messages: [],
    game: { ...resetLevel(s.game, s.checkpoint), vaultFragments: s.game.vaultFragments } };
}
export function replaceRadio(s) { return { ...resetRadio(s), scenario_id: null, descriptor: null }; }
