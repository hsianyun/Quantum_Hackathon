/** Serializable game state. No mutable singleton or UI dependencies. */
export const INITIAL_STATE = Object.freeze({
  currentAct: 1,
  currentLevel: 1,
  bellPairs: 12,
  classicalBits: 20,
  wardenSuspicion: 0,
  vaultFragments: 0,
});

/** Return an independent state for a new game. */
export function createInitialState() {
  return { ...INITIAL_STATE };
}

export function assertNonNegativeInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a nonnegative safe integer.`);
  }
}

/** Validate the six state fields without changing the object. */
export function validateState(state) {
  if (state === null || typeof state !== "object" || Array.isArray(state)) {
    throw new TypeError("state must be an object.");
  }
  for (const field of Object.keys(INITIAL_STATE)) {
    assertNonNegativeInteger(state[field], field);
  }
  if (state.currentAct === 0 || state.currentLevel === 0) {
    throw new RangeError("currentAct and currentLevel must be positive integers.");
  }
}
