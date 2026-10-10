import { assertNonNegativeInteger, validateState } from "./state.js";

/** Advance within the current act, retaining all resources and fragments. */
export function advanceLevel(state) {
  validateState(state);
  const currentLevel = state.currentLevel + 1;
  assertNonNegativeInteger(currentLevel, "currentLevel");
  return { ...state, currentLevel };
}

/** Restore a snapshot captured at the start of this same act and level. */
export function resetLevel(state, levelStartState) {
  validateState(state);
  validateState(levelStartState);
  if (
    state.currentAct !== levelStartState.currentAct ||
    state.currentLevel !== levelStartState.currentLevel
  ) {
    throw new RangeError("The checkpoint must belong to the current act and level.");
  }
  return { ...levelStartState };
}
