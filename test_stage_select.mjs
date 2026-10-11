import test from "node:test";
import assert from "node:assert/strict";
import { createStageStore, selectStage } from "./stage-select.js";
import { addNote } from "./notebook.js";
import { chooseGate } from "./level-one.js";
import * as c from "./calibration.js";
import * as w from "./security.js";

test("all three stages are directly selectable without earning a fragment", () => {
  for (const target of [2, 3]) {
    const store = createStageStore();
    const next = selectStage(store, store.sessions[1], target);
    assert.equal(next.current, target);
    assert.equal(next.sessions[target].game.currentLevel, target);
    assert.equal(next.sessions[target].game.vaultFragments, 0);
    assert.equal(next.sessions[target].completed, false);
    assert.equal(next.sessions[target].game.bellPairs, 12);
    assert.equal(next.sessions[target].game.classicalBits, 24);
    assert.deepEqual(Object.keys(store.sessions), ["1"]);
  }
});

test("switching preserves each stage's choices, link and spending while sharing notes and rewards", () => {
  let store = createStageStore();
  const bell = chooseGate(store.sessions[1], "S");
  store = selectStage(store, bell, 2);
  let cal = c.chooseCalibration(store.sessions[2], "+i", "H_CX");
  cal = { ...cal, completed: true, evidence: ["1:00:+i", "2:00:+i", "3:00:+i", "4:00:+i"],
    game: { ...cal.game, vaultFragments: 1, bellPairs: 8, classicalBits: 16 },
    notes: addNote(cal.notes, "Keep this discovery") };
  store = selectStage(store, cal, 3);
  const security = w.attachLink(store.sessions[3], { experiment: "warden", status: "ok", link_id: "a".repeat(32) });
  store = selectStage(store, security, 1);
  assert.equal(store.sessions[1].gate, "S");
  assert.equal(store.sessions[1].game.vaultFragments, 1);
  assert.equal(store.sessions[1].notes[0].text, "Keep this discovery");
  store = selectStage(store, store.sessions[1], 2);
  assert.equal(store.sessions[2].state_name, "+i");
  assert.equal(store.sessions[2].operation, "H_CX");
  assert.equal(store.sessions[2].game.bellPairs, 8);
  assert.equal(store.sessions[2].game.classicalBits, 16);
  assert.equal(store.sessions[2].completed, true);
  assert.equal(store.sessions[2].evidence.length, 4);
  store = selectStage(store, store.sessions[2], 3);
  assert.equal(store.sessions[3].link_id, security.link_id);
  assert.equal(store.sessions[3].game.vaultFragments, 1);
});

test("pending experiments, unsupported stages and mismatched sessions cannot switch", () => {
  const store = createStageStore();
  for (const target of [0, 6, "2", NaN]) assert.throws(() => selectStage(store, store.sessions[1], target));
  assert.throws(() => selectStage(store, { ...store.sessions[1], running: true }, 3), /pending/);
  assert.throws(() => selectStage(store, { ...store.sessions[1], game: { ...store.sessions[1].game, currentLevel: 3 } }, 2), /match/);
  assert.equal(store.current, 1);
});
test("radio stages are directly selectable and preserve separate evidence, budgets and shared discoveries", () => {
  let store = createStageStore();
  store = selectStage(store, store.sessions[1], 5);
  assert.equal(store.sessions[5].mode, "blind"); assert.equal(store.sessions[5].game.classicalBits, 128);
  const blind = { ...store.sessions[5], observations_text: "0,4,8,12", phases_text: "0,1/4,1/2,3/4", notes: addNote([], "Manual radio discovery") };
  store = selectStage(store, blind, 4);
  assert.equal(store.sessions[4].mode, "guided"); assert.equal(store.sessions[4].game.classicalBits, 32);
  store = selectStage(store, store.sessions[4], 5);
  assert.equal(store.sessions[5].observations_text, blind.observations_text);
  assert.equal(store.sessions[5].notes[0].text, "Manual radio discovery");
});
