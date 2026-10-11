/** Per-stage checkpoints with shared notes/rewards; no quantum calculations. */
import { createSession } from "./level-one.js";
import { createCalibration } from "./calibration.js";
import { enterSecurity } from "./security.js";
import { createRadioSession } from "./quantum-radio.js";

export function createStageStore() {
  return { current: 1, sessions: { 1: createSession() } };
}

export function selectStage(store, currentSession, target) {
  if (![1, 2, 3, 4, 5].includes(target)) throw new RangeError("Choose an available stage.");
  if (currentSession.running) throw new Error("Wait for the pending experiment before switching stages.");
  if (currentSession.game.currentLevel !== store.current) throw new Error("Stage session does not match the selector.");
  const sessions = { ...store.sessions, [store.current]: currentSession };
  let selected = sessions[target];
  if (!selected) {
    selected = target >= 4 ? createRadioSession({ ...currentSession.game, currentLevel: target }, currentSession.notes) : target === 2
      ? createCalibration({ ...currentSession.game, currentLevel: 2, bellPairs: 12, classicalBits: 24 }, currentSession.notes)
      : enterSecurity({ ...currentSession.game, currentLevel: 2 }, currentSession.notes);
  }
  selected = { ...selected, notes: [...currentSession.notes],
    game: { ...selected.game, vaultFragments: currentSession.game.vaultFragments } };
  return { current: target, sessions: { ...sessions, [target]: selected } };
}
