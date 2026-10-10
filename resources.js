import { assertNonNegativeInteger, validateState } from "./state.js";

function changeResource(state, field, amount, direction) {
  validateState(state);
  assertNonNegativeInteger(amount, "amount");
  const value = state[field] + direction * amount;
  if (value < 0) {
    throw new RangeError(`Insufficient ${field}.`);
  }
  assertNonNegativeInteger(value, field);
  return { ...state, [field]: value };
}

export function spendBellPairs(state, amount = 1) {
  return changeResource(state, "bellPairs", amount, -1);
}

export function spendClassicalBits(state, amount = 1) {
  return changeResource(state, "classicalBits", amount, -1);
}

export function awardFragments(state, amount = 1) {
  return changeResource(state, "vaultFragments", amount, 1);
}

export function increaseSuspicion(state, amount = 1) {
  return changeResource(state, "wardenSuspicion", amount, 1);
}
