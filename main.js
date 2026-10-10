import { createSession, chooseGate, commitAlice, chooseBasis, choosePrediction, commitBob,
  beginExperiment, experimentRequest, finishExperiment, failExperiment, readyToRun,
  nextTrial, restartLevel, sendMessage, TRIAL_PAIRS } from "./level-one.js";
import { bell_experiment } from "api";
import { createBellExperiment } from "./quantum-client.js";
import { addNote } from "./notebook.js";
import { renderAlice } from "./alice.js";
import { renderBob } from "./bob.js";
import { renderHistogram } from "./histogram.js";
import { renderMessages, renderNotes } from "./radio.js";

// Qollab statically discovers the Python import and injects the selected backend.
const bellExperiment = createBellExperiment(bell_experiment, backend);
let session = createSession();
const byId = (id) => document.getElementById(id);
const announce = (message) => { byId("system-message").textContent = message; };

function renderVerification() {
  const { result, completed } = session;
  byId("verification").hidden = !result;
  if (result) {
    byId("verification-title").textContent = result.solved ? "Bell Lock open"
      : completed ? "Practice trial: revise your choices" : "Bell Lock closed";
    byId("prediction-comparison").textContent = `Bob predicted ${session.prediction}. Observed: ${result.correlation_type}. ${result.predictionMatches ? "Prediction matched." : "Prediction did not match."}`;
    byId("preparation-comparison").textContent = result.preparationMatches
      ? "Preparation circuit verified against the target Bell state."
      : "Prepared state does not match the target Bell state. Reconsider the missing gate.";
    byId("verification").classList.toggle("is-solved", result.solved);
  }
  byId("completion-banner").hidden = !completed;
  byId("why-toggle").disabled = !completed;
  byId("why-status").textContent = completed ? "Unlocked / fragment secured" : "Locked / solve Bell Lock to unlock";
  // Populate explanatory content only after completion, never in the initial DOM.
  if (completed && !byId("why-content").hasChildNodes()) {
    for (const text of [
      "H turns Alice's initial |0> into (|0> + |1>)/sqrt(2). The controlled-X then flips Bob only when Alice is |1>, preparing (|00> + |11>)/sqrt(2), the Phi+ Bell state.",
      "In matching Z/Z or X/X bases, Phi+ produces matching bits even though each local bit is unpredictable. In crossed X/Z or Z/X bases, all four joint outcomes are equally likely: about half agree. Anticorrelation would mean the two bits usually differ.",
      "The histogram shows fresh Qiskit measurements, with Alice's bit first. Agreement is (00 + 11) / total; the binary correlation is 2 times agreement minus 1. We call 90% or more agreement correlated, 10% or less anticorrelated, and intermediate results random. Here random means no strong correlation; finite samples do not prove randomness.",
      "Matching bits alone do not certify entanglement. An incorrect gate can produce a fixed product state that agrees in Z. Python also checks the ideal preparation circuit against Phi+; hardware would require additional measurements to certify the state.",
    ]) {
      const paragraph = document.createElement("p"); paragraph.textContent = text;
      byId("why-content").append(paragraph);
    }
  }
}
function render() {
  const { game, result, running } = session;
  byId("bell-pairs").textContent = game.bellPairs;
  byId("classical-bits").textContent = game.classicalBits;
  byId("suspicion").textContent = `${game.wardenSuspicion}%`;
  byId("suspicion-fill").style.width = `${Math.min(100, game.wardenSuspicion)}%`;
  byId("fragments").textContent = String(game.vaultFragments).padStart(2, "0");
  byId("act-level").textContent = `ACT ${String(game.currentAct).padStart(2, "0")} / LEVEL ${String(game.currentLevel).padStart(2, "0")}`;
  renderAlice(session); renderBob(session); renderHistogram(result); renderVerification();
  renderMessages(session.messages); renderNotes(session.notes);
  byId("note-count").textContent = session.notes.length;
  byId("message-count").textContent = session.messages.length;
  byId("message-form").querySelector("button").disabled = game.classicalBits === 0;
  const ready = readyToRun(session);
  byId("reset-level").disabled = running;
  byId("run-experiment").disabled = running || (!result && !ready);
  byId("run-experiment").textContent = running ? "Running experiment..." : result ? "New trial" : "Run experiment";
  byId("rooms").setAttribute("aria-busy", String(running));
  byId("run-hint").textContent = running ? "Receiver sealed until the run finishes."
    : result ? "Compare observations. Try another hypothesis."
    : game.bellPairs < TRIAL_PAIRS ? "Source empty. Reset to explore again."
    : ready ? "Choices committed. Source ready." : "Alice: commit gate, then basis. Bob: predict and commit.";
  const cost = document.createElement("span");
  cost.textContent = "1 source credit / 1,024 measurement shots";
  byId("run-hint").append(cost);
  const step = result ? "verify" : running || ready ? "act" : session.messages.length ? "exchange" : "predict";
  for (const name of ["predict", "act", "exchange", "verify"]) {
    const element = byId(`step-${name}`);
    if (name === step) element.setAttribute("aria-current", "step");
    else element.removeAttribute("aria-current");
  }
  byId("sequence-hint").textContent = result ? "Evidence received. Compare your prediction." : "Two perspectives. One experiment.";
}
function update(operation, message) {
  try { session = operation(session); render(); announce(message); return true; }
  catch (error) { announce(error.message); return false; }
}
document.querySelectorAll('input[name="alice-gate"]').forEach((input) => {
  input.addEventListener("change", () => update((s) => chooseGate(s, input.value), "Gate selected. Commit when ready."));
});
for (const role of ["alice", "bob"]) {
  document.querySelectorAll(`input[name="${role}-basis"]`).forEach((input) => {
    input.addEventListener("change", () => update((s) => chooseBasis(s, role, input.value), `${role === "alice" ? "Alice" : "Bob"} selected the ${input.value} basis.`));
  });
}
document.querySelectorAll('input[name="bob-prediction"]').forEach((input) => {
  input.addEventListener("change", () => update((s) => choosePrediction(s, input.value), "Prediction selected. Choose Bob's basis, then commit."));
});
byId("alice-commit").addEventListener("click", () => {
  if (update(commitAlice, "Alice's preparation committed. Select her measurement basis.")) {
    byId("alice-basis-group").querySelector("input").focus();
  }
});
byId("bob-commit").addEventListener("click", () => {
  if (update(commitBob, "Bob's prediction and basis committed.")) {
    if (readyToRun(session)) byId("run-experiment").focus();
    else byId(session.committed.alice ? "alice-basis-group" : "alice-gate-group").querySelector("input").focus();
  }
});
byId("run-experiment").addEventListener("click", async () => {
  if (session.result) {
    update(nextTrial, "New trial. Results cleared; make fresh choices.");
    if (session.game.bellPairs < TRIAL_PAIRS) byId("reset-level").focus();
    else byId("alice-gate-group").querySelector("input").focus();
    return;
  }
  if (!update(beginExperiment, "Running the committed experiment. Choices are locked.")) return;
  const trial = session.trial;
  const alreadyCompleted = session.completed;
  try {
    const result = await bellExperiment(experimentRequest(session));
    session = finishExperiment(session, result, trial);
    render();
    announce(session.result.solved
      ? alreadyCompleted ? "Practice verified. Your fragment is already secured." : "Bell Lock solved. One vault fragment secured. Why this works is now unlocked."
      : alreadyCompleted ? "Practice complete. Compare the evidence and revise your choices."
      : "Experiment complete. The lock remains closed. Compare the evidence, then try a new trial.");
    byId("verification-title").focus();
  } catch (error) {
    session = failExperiment(session, trial); render(); announce(error.message);
    byId("run-experiment").focus();
  }
});
byId("reset-level").addEventListener("click", () => update(restartLevel, "Resources restored. Notebook discoveries and earned fragments retained."));
byId("why-toggle").addEventListener("click", () => {
  if (!session.completed) return;
  const open = byId("why-content").hidden;
  byId("why-content").hidden = !open;
  byId("why-toggle").setAttribute("aria-expanded", String(open));
});
function toggleChannel(open) {
  byId("classical-channel").hidden = !open;
  byId("toggle-channel").setAttribute("aria-expanded", String(open));
  if (open) { byId("message-payload").focus(); byId("classical-channel").scrollIntoView({ block: "nearest" }); }
  else byId("toggle-channel").focus();
}
byId("toggle-channel").addEventListener("click", () => toggleChannel(byId("classical-channel").hidden));
byId("close-channel").addEventListener("click", () => toggleChannel(false));
byId("message-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (update((s) => sendMessage(s, byId("message-sender").value, byId("message-payload").value), "Transmission delivered. Classical bits spent.")) {
    byId("message-payload").value = ""; byId("message-payload").focus();
  }
});
byId("open-notebook").addEventListener("click", () => byId("notebook").showModal());
byId("close-notebook").addEventListener("click", () => byId("notebook").close());
byId("notebook").addEventListener("close", () => byId("open-notebook").focus());
byId("note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    session = { ...session, notes: addNote(session.notes, byId("note-text").value) }; render();
    byId("note-text").value = ""; byId("note-status").textContent = "Field note saved."; byId("note-text").focus();
  } catch (error) { byId("note-status").textContent = error.message; }
});
render();
