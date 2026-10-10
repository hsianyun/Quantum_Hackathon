/** Security drill decisions. Python supplies all quantum counts and QBER. */
import { validateState } from "./state.js";
import { spendBellPairs, spendClassicalBits, awardFragments, increaseSuspicion } from "./resources.js";
import { advanceLevel, resetLevel } from "./levels.js";
import { addNote } from "./notebook.js";

const choices = () => ({ phase: "choice", running: false, bases: { alice: null, bob: null },
  committed: { alice: false, bob: false }, allocation: null,
  exchanged: { alice: false, bob: false }, sample: null, result: null });
const unit = (value) => Number.isFinite(value) && value >= 0 && value <= 1;
export function enterSecurity(game, notes = []) {
  validateState(game);
  if (game.currentLevel !== 2) throw new Error("Warden follows calibration.");
  const budget = { ...advanceLevel(game), bellPairs: 12, classicalBits: 24 };
  return { game: budget, checkpoint: { ...budget }, link_id: null, trial: 1,
    notes: [...notes], messages: [], samples: {}, completed: false, ...choices() };
}
export function attachLink(s, result) {
  if (s.link_id || result?.status !== "ok" || result.experiment !== "warden"
      || !/^[a-f0-9]{32}$/.test(result.link_id) || "attack" in result) throw new Error("Invalid hidden link.");
  return { ...s, link_id: result.link_id };
}
export function chooseSecurity(s, role, basis, allocation = null) {
  if (s.phase !== "choice" || !["alice", "bob"].includes(role) || s.committed[role]
      || !["X", "Z"].includes(basis)) throw new Error("Choose an uncommitted X/Z basis.");
  if (role === "alice" && (!Number.isSafeInteger(allocation) || allocation < 1 || allocation > 4)) throw new Error("Allocate 1–4 source credits.");
  return { ...s, bases: { ...s.bases, [role]: basis }, allocation: role === "alice" ? allocation : s.allocation };
}
export function commitSecurity(s, role) {
  if (s.phase !== "choice" || !["alice", "bob"].includes(role) || !s.bases[role]
      || s.committed[role] || (role === "alice" && !s.allocation)) throw new Error("Choose your basis/allocation before committing.");
  return { ...s, committed: { ...s.committed, [role]: true } };
}
export function beginSecurity(s) {
  if (s.phase !== "choice" || !s.link_id || !s.committed.alice || !s.committed.bob
      || s.game.bellPairs < s.allocation || s.game.classicalBits < 2) throw new Error("Both players must commit with enough testing and exchange budget.");
  return { ...s, phase: "running", running: true };
}
export function securityRequest(s) {
  if (!s.running) throw new Error("Begin a committed test first.");
  return { config: { link_id: s.link_id, basis_a: s.bases.alice, basis_b: s.bases.bob }, shots: s.allocation * 1024 };
}
export function receiveSecurity(s, result, trial) {
  if (!s.running || trial !== s.trial) throw new Error("No matching pending security test.");
  const matched = s.bases.alice === s.bases.bob;
  const shots = s.allocation * 1024;
  if (result?.status !== "ok" || result.experiment !== "warden" || result.link_id !== s.link_id
      || result.basis_a !== s.bases.alice || result.basis_b !== s.bases.bob || result.shots !== shots
      || !unit(result.agreement) || !Number.isFinite(result.correlation) || Math.abs(result.correlation) > 1
      || !["correlated", "anticorrelated", "random"].includes(result.correlation_type)
      || !result.counts || Object.keys(result.counts).sort().join() !== "00,01,10,11"
      || Object.values(result.counts).some((n) => !Number.isSafeInteger(n) || n < 0)
      || Object.values(result.counts).reduce((a, b) => a + b, 0) !== shots
      || result.matched_shots !== (matched ? shots : 0)
      || result.qber_status !== (matched ? "measured" : "unavailable")
      || (matched ? !unit(result.qber) : result.qber !== null) || "attack" in result) throw new Error("Invalid security statistics; no credits spent.");
  return { ...s, running: false, phase: "exchange", sample: { ...result, counts: { ...result.counts } },
    game: spendBellPairs(s.game, s.allocation) };
}
export function exchangeSecurity(s, role, payload) {
  if (s.phase !== "exchange" || !["alice", "bob"].includes(role) || s.exchanged[role]
      || payload !== (s.bases[role] === "X" ? "1" : "0")) throw new Error("Send exactly your committed basis bit (Z=0, X=1), once.");
  const exchanged = { ...s.exchanged, [role]: true };
  const ready = exchanged.alice && exchanged.bob;
  const samples = { ...s.samples };
  if (ready && s.sample.matched_shots > 0) samples[s.bases.alice] = s.sample;
  return { ...s, exchanged, samples, phase: ready ? "interpret" : "exchange",
    game: spendClassicalBits(s.game, 1),
    messages: [...s.messages, { id: s.messages.length + 1, role, payload }] };
}
export function judgeSecurity(s, decision) {
  if (s.phase !== "interpret" || !["trust", "reject", "insufficient"].includes(decision)) throw new Error("Exchange both basis bits before committing a link judgment.");
  const both = Boolean(s.samples.X && s.samples.Z);
  const damaged = Object.values(s.samples).some((sample) => sample.qber >= 0.25);
  const healthy = both && Object.values(s.samples).every((sample) => sample.qber <= 0.1);
  const expected = damaged ? "reject" : healthy ? "trust" : "insufficient";
  const correct = expected === decision;
  const solved = both && correct && expected !== "insufficient";
  let game = correct ? s.game : increaseSuspicion(s.game, 10);
  if (solved && !s.completed) game = awardFragments(game);
  const explanation = damaged ? "Complementary tests show mismatches: Z interception can preserve ZZ while damaging XX coherence."
    : healthy ? "Both complementary tests support this ideal link; ZZ alone would not have been sufficient."
    : "Missing, mismatched or ambiguous complementary evidence cannot certify a link.";
  return { ...s, phase: "result", game, completed: s.completed || solved,
    result: { decision, expected, correct, solved, explanation },
    notes: addNote(s.notes, `Warden ${s.bases.alice}/${s.bases.bob}, ${s.sample.shots} shots, QBER ${s.sample.qber ?? "unavailable"}; Bob ${decision}. ${explanation}`) };
}
export function failSecurity(s, trial) {
  if (!s.running || trial !== s.trial) throw new Error("No matching pending test.");
  return { ...s, running: false, phase: "choice" };
}
export function nextSecurity(s) {
  if (s.phase !== "result") throw new Error("Finish Bob's judgment first.");
  return { ...s, ...choices(), trial: s.trial + 1 };
}
export function resetSecurity(s) {
  if (s.running) throw new Error("Wait for the pending test.");
  return { ...s, ...choices(), samples: {}, messages: [], trial: s.trial + 1,
    game: { ...resetLevel(s.game, s.checkpoint), vaultFragments: s.game.vaultFragments } };
}
export function replaceSecurityLink(s) {
  // Explicit recovery for an expired link; never reuse evidence from another link.
  return { ...resetSecurity(s), link_id: null };
}
