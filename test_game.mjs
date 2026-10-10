import test from "node:test";
import assert from "node:assert/strict";

import { INITIAL_STATE, createInitialState, validateState } from "./state.js";
import {
  spendBellPairs,
  spendClassicalBits,
  awardFragments,
  increaseSuspicion,
} from "./resources.js";
import { advanceLevel, resetLevel } from "./levels.js";

const resourceTransitions = [
  spendBellPairs,
  spendClassicalBits,
  awardFragments,
  increaseSuspicion,
];

test("new games have the requested initial values and independent state", () => {
  const first = createInitialState();
  const second = createInitialState();
  assert.deepEqual(first, {
    currentAct: 1,
    currentLevel: 1,
    bellPairs: 12,
    classicalBits: 20,
    wardenSuspicion: 0,
    vaultFragments: 0,
  });
  assert.notStrictEqual(first, second);
  first.bellPairs = 0;
  assert.equal(second.bellPairs, 12);
  assert.equal(INITIAL_STATE.bellPairs, 12);
  assert.ok(Object.isFrozen(INITIAL_STATE));
});

test("Bell pair spending preserves its input and unrelated fields", () => {
  const state = Object.freeze(createInitialState());
  const next = spendBellPairs(state, 3);
  assert.deepEqual(next, { ...state, bellPairs: 9 });
  assert.notStrictEqual(next, state);
  assert.equal(state.bellPairs, 12);
});

test("classical bit spending preserves its input and unrelated fields", () => {
  const state = Object.freeze(createInitialState());
  const next = spendClassicalBits(state, 2);
  assert.deepEqual(next, { ...state, classicalBits: 18 });
  assert.equal(state.classicalBits, 20);
});

test("spending the exact balance is allowed", () => {
  const state = createInitialState();
  assert.equal(spendBellPairs(state, 12).bellPairs, 0);
  assert.equal(spendClassicalBits(state, 20).classicalBits, 0);
});

test("overspending is rejected without changing the input", () => {
  const state = Object.freeze(createInitialState());
  assert.throws(() => spendBellPairs(state, 13), RangeError);
  assert.throws(() => spendClassicalBits(state, 21), RangeError);
  assert.throws(() => spendBellPairs({ ...state, bellPairs: 0 }), RangeError);
  assert.deepEqual(state, createInitialState());
});

test("fragments and suspicion accumulate without changing other fields", () => {
  const state = Object.freeze({ ...createInitialState(), vaultFragments: 2, wardenSuspicion: 3 });
  assert.deepEqual(awardFragments(state, 4), { ...state, vaultFragments: 6 });
  assert.deepEqual(increaseSuspicion(state, 5), { ...state, wardenSuspicion: 8 });
});

test("resource transitions allow zero and default to one", () => {
  const state = Object.freeze(createInitialState());
  for (const transition of resourceTransitions) {
    const zero = transition(state, 0);
    assert.deepEqual(zero, state);
    assert.notStrictEqual(zero, state);
    assert.deepEqual(transition(state), transition(state, 1));
  }
});

test("resource transitions reject negative, fractional, and nonnumeric amounts", () => {
  const state = Object.freeze(createInitialState());
  for (const transition of resourceTransitions) {
    for (const amount of [-1, 0.5, NaN, Infinity, "2", null, true, Number.MAX_SAFE_INTEGER + 1]) {
      assert.throws(() => transition(state, amount), RangeError);
    }
  }
  assert.deepEqual(state, createInitialState());
});

test("resource awards and level advancement reject integer overflow", () => {
  const state = Object.freeze({
    ...createInitialState(),
    vaultFragments: Number.MAX_SAFE_INTEGER,
    wardenSuspicion: Number.MAX_SAFE_INTEGER,
    currentLevel: Number.MAX_SAFE_INTEGER,
  });
  assert.throws(() => awardFragments(state), RangeError);
  assert.throws(() => increaseSuspicion(state), RangeError);
  assert.throws(() => advanceLevel(state), RangeError);
});

test("advancing retains the act, resources, suspicion, and earned fragments", () => {
  const state = Object.freeze({
    currentAct: 2,
    currentLevel: 3,
    bellPairs: 7,
    classicalBits: 11,
    wardenSuspicion: 4,
    vaultFragments: 2,
  });
  const next = advanceLevel(state);
  assert.deepEqual(next, { ...state, currentLevel: 4 });
  assert.notStrictEqual(next, state);
  assert.equal(state.currentLevel, 3);
});

test("reset restores the level checkpoint including previously earned progress", () => {
  const checkpoint = Object.freeze({
    currentAct: 2,
    currentLevel: 3,
    bellPairs: 7,
    classicalBits: 11,
    wardenSuspicion: 4,
    vaultFragments: 2,
  });
  let attempt = spendBellPairs(checkpoint, 2);
  attempt = spendClassicalBits(attempt, 3);
  attempt = awardFragments(attempt);
  attempt = Object.freeze(increaseSuspicion(attempt, 5));
  const restored = resetLevel(attempt, checkpoint);
  assert.deepEqual(restored, checkpoint);
  assert.notStrictEqual(restored, checkpoint);
  assert.notStrictEqual(restored, attempt);
  assert.equal(attempt.bellPairs, 5);
  assert.equal(attempt.vaultFragments, 3);
  assert.equal(checkpoint.bellPairs, 7);
  restored.bellPairs = 0;
  assert.equal(checkpoint.bellPairs, 7);
});

test("reset rejects a checkpoint from a different act or level", () => {
  const state = createInitialState();
  assert.throws(() => resetLevel(state, { ...state, currentAct: 2 }), RangeError);
  assert.throws(() => resetLevel(state, advanceLevel(state)), RangeError);
  assert.throws(() => resetLevel(state), TypeError);
});

test("all transitions reject malformed states", () => {
  const valid = createInitialState();
  const invalidStates = [null, undefined, [], {}, "state"];
  for (const field of Object.keys(valid)) {
    for (const value of [-1, 0.5, NaN, Infinity, "1", true, Number.MAX_SAFE_INTEGER + 1]) {
      invalidStates.push({ ...valid, [field]: value });
    }
  }
  invalidStates.push({ ...valid, currentAct: 0 }, { ...valid, currentLevel: 0 });
  for (const state of invalidStates) {
    assert.throws(() => validateState(state));
    for (const transition of [...resourceTransitions, advanceLevel]) {
      assert.throws(() => transition(state));
    }
    assert.throws(() => resetLevel(state, valid));
    assert.throws(() => resetLevel(valid, state));
  }
});

test("composed transitions produce serializable state and preserve earlier snapshots", () => {
  const firstLevel = Object.freeze(createInitialState());
  let state = spendBellPairs(firstLevel, 3);
  state = spendClassicalBits(state, 2);
  state = awardFragments(state, 1);
  state = advanceLevel(state);
  const secondLevel = Object.freeze({ ...state });
  state = increaseSuspicion(spendBellPairs(state, 2), 3);
  state = resetLevel(state, secondLevel);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.equal(state.currentLevel, 2);
  assert.equal(state.bellPairs, 9);
  assert.equal(state.classicalBits, 18);
  assert.equal(state.vaultFragments, 1);
  assert.equal(state.wardenSuspicion, 0);
  assert.deepEqual(firstLevel, createInitialState());
});
