/** Later-level UI. Quantum experiments are injected through the Qollab adapter. */
import * as c from "./calibration.js";
import * as w from "./security.js";
import { addNote } from "./notebook.js";
import { renderNotes, renderMessages } from "./radio.js";

const byId = (id) => document.getElementById(id);
export function renderShared(s) {
  byId("bell-pairs").textContent = s.game.bellPairs;
  byId("classical-bits").textContent = s.game.classicalBits;
  byId("fragments").textContent = String(s.game.vaultFragments).padStart(2, "0");
  byId("suspicion").textContent = `${s.game.wardenSuspicion}%`;
  byId("suspicion-fill").style.width = `${Math.min(100, s.game.wardenSuspicion)}%`;
  renderNotes(s.notes); renderMessages(s.messages);
  byId("note-count").textContent = s.notes.length;
  byId("message-count").textContent = s.messages.length;
  byId("message-form").querySelector("button").disabled = s.game.classicalBits === 0;
}

export function mountSecurity(initialSession, api, onBusy = () => {}) {
  let s = initialSession;
  let busy = false;
  let disposed = false;
  const area = byId("later-level");
  area.innerHTML = `
    <section class="mission-heading"><div><p class="eyebrow">LEVEL 03 / COMPLEMENTARY SECURITY TESTS</p>
      <h1>Warden<span>.</span></h1>
      <p class="mission-description">Choose independently. Sacrifice test credits. Exchange bases and decide whether this link deserves trust.</p>
      <p class="field-hint">New lab: 12 sampling credits / 24 classical bits. Each credit purchases 1,024 independent test shots. Retain credits for later messaging.</p>
      <p class="field-hint">Predict → Act → Exchange → Verify. Repeated trials require a local simulator; IonQ permits one job per Run.</p>
    </div><button id="sec-reset" class="quiet-button" type="button">Reset security checkpoint</button></section>
    <button id="sec-open" class="small-button" type="button">Open a hidden link</button>
    <button id="sec-replace" class="small-button" type="button">Replace an expired link (clears test evidence)</button>
    <p id="sec-link" class="field-hint" aria-live="polite"></p>
    <div class="rooms"><section class="room alice-room"><h2>Alice's room</h2>
      <p class="role-description">Which complementary basis should you sacrifice pairs to test? Choose a sample budget before seeing receiver data.</p>
      <label for="sec-alice-basis">Your test basis</label><select id="sec-alice-basis"><option value="">Choose X or Z</option><option>X</option><option>Z</option></select>
      <label for="sec-allocation">Source credits sacrificed for this test</label><select id="sec-allocation"><option value="">Choose a budget</option><option value="1">1 credit / 1,024 shots</option><option value="2">2 credits / 2,048 shots</option><option value="3">3 credits / 3,072 shots</option><option value="4">4 credits / 4,096 shots</option></select>
      <button id="sec-alice-commit" class="commit-button" type="button">Commit Alice's basis & budget</button>
      <button id="sec-alice-send" class="small-button" type="button">Transmit Alice's basis bit</button>
    </section><section class="room bob-room"><h2>Bob's room</h2>
      <p class="role-description">Choose your measurement basis independently. After exchanging bases, interpret matched statistics; do not assume a healthy-looking single basis proves security.</p>
      <label for="sec-bob-basis">Your measurement basis</label><select id="sec-bob-basis"><option value="">Choose X or Z</option><option>X</option><option>Z</option></select>
      <button id="sec-bob-commit" class="commit-button" type="button">Commit Bob's basis</button>
      <button id="sec-bob-send" class="small-button" type="button">Transmit Bob's basis bit</button>
      <p class="field-hint">Channel encoding: Z=0, X=1. Each direction costs one classical bit; receiver data stays sealed until both transmit.</p>
      <div id="sec-observation" class="verification" hidden><p id="sec-statistics"></p></div>
      <label for="sec-decision">Your judgment of the accumulated evidence</label><select id="sec-decision"><option value="">Commit a judgment</option><option value="trust">Trust</option><option value="reject">Reject</option><option value="insufficient">Insufficient evidence</option></select>
      <button id="sec-judge" class="commit-button" type="button">Commit judgment & verify</button>
    </section></div>
    <p id="sec-history" class="field-hint"></p>
    <button id="sec-run" class="run-button" type="button">Run committed security test</button>
    <section id="sec-result" class="verification" hidden><h2 id="sec-result-title" tabindex="-1">Link judgment</h2><p id="sec-result-text"></p></section>
    <button id="sec-next" class="small-button" type="button">New security test</button>
    <p id="sec-completion" class="completion-banner" role="status" hidden></p>`;
  function render() {
    if (disposed) return;
    onBusy(busy || s.running);
    renderShared(s); area.setAttribute("aria-busy", String(busy));
    byId("sec-open").disabled = busy || Boolean(s.link_id);
    byId("sec-replace").disabled = busy || !s.link_id;
    byId("sec-link").textContent = s.link_id ? "Hidden link ready. Reset preserves this same link." : "Open a link to begin; its condition is unknown to both players.";
    for (const role of ["alice", "bob"]) {
      const editable = !busy && s.phase === "choice" && !s.committed[role] && Boolean(s.link_id);
      if (s.bases[role]) byId(`sec-${role}-basis`).value = s.bases[role];
      byId(`sec-${role}-basis`).disabled = !editable;
      byId(`sec-${role}-commit`).disabled = !editable;
      byId(`sec-${role}-send`).disabled = busy || s.phase !== "exchange" || s.exchanged[role];
    }
    if (s.allocation) byId("sec-allocation").value = s.allocation;
    byId("sec-allocation").disabled = busy || s.phase !== "choice" || s.committed.alice || !s.link_id;
    byId("sec-run").disabled = busy || s.phase !== "choice" || !s.committed.alice || !s.committed.bob;
    byId("sec-reset").disabled = busy;
    byId("sec-decision").disabled = busy || s.phase !== "interpret";
    byId("sec-judge").disabled = busy || s.phase !== "interpret";
    byId("sec-next").disabled = busy || s.phase !== "result";
    const visible = s.phase === "interpret" || s.phase === "result";
    byId("sec-observation").hidden = !visible;
    byId("sec-statistics").textContent = visible
      ? `${s.sample.basis_a}/${s.sample.basis_b}: ${s.sample.shots} shots. Counts (Alice then Bob): ${Object.entries(s.sample.counts).map(([bits, n]) => `${bits}=${n}`).join(", ")}. QBER: ${s.sample.qber === null ? "unavailable (mismatched bases)" : (s.sample.qber * 100).toFixed(1) + "%"}.` : "";
    byId("sec-history").textContent = `Previously exchanged matched evidence: ${Object.entries(s.samples).map(([basis, result]) => `${basis}${basis}: ${(result.qber * 100).toFixed(1)}% QBER`).join("; ") || "none"}. Source credits retained: ${s.game.bellPairs}.`;
    byId("sec-result").hidden = !s.result;
    byId("sec-result-text").textContent = s.result ? `You chose ${s.result.decision}; ${s.result.correct ? "supported" : "not supported"} by the available evidence. ${s.result.explanation}` : "";
    byId("sec-completion").hidden = !s.completed;
    byId("sec-completion").textContent = `Warden complete. One fragment secured; ${s.game.bellPairs} source credits retained for later messaging. This run stops before later gameplay. You may continue testing this link.`;
  }
  async function act(action) {
    if (busy) return;
    try {
      const pending = action();
      if (typeof pending?.then === "function") await pending;
    }
    catch (error) { byId("system-message").textContent = error.message; }
    finally { busy = false; render(); }
  }
  byId("sec-open").addEventListener("click", () => act(async () => {
    busy = true; render(); s = w.attachLink(s, await api.open());
  }));
  byId("sec-replace").addEventListener("click", () => act(async () => {
    if (s.running) throw new Error("Wait for the pending test.");
    busy = true; render(); await api.close(s.link_id);
    s = w.replaceSecurityLink(s);
    for (const id of ["sec-alice-basis", "sec-bob-basis", "sec-allocation", "sec-decision"]) byId(id).value = "";
    s = w.attachLink(s, await api.open());
  }));
  byId("sec-alice-commit").addEventListener("click", () => act(() => {
    s = w.commitSecurity(w.chooseSecurity(s, "alice", byId("sec-alice-basis").value, Number(byId("sec-allocation").value)), "alice");
  }));
  byId("sec-bob-commit").addEventListener("click", () => act(() => {
    s = w.commitSecurity(w.chooseSecurity(s, "bob", byId("sec-bob-basis").value), "bob");
  }));
  byId("sec-run").addEventListener("click", () => act(async () => {
    s = w.beginSecurity(s); busy = true; render(); const trial = s.trial;
    try { s = w.receiveSecurity(s, await api.run(w.securityRequest(s)), trial); }
    catch (error) { s = w.failSecurity(s, trial); throw error; }
  }));
  for (const role of ["alice", "bob"]) byId(`sec-${role}-send`).addEventListener("click", () => act(() => {
    s = w.exchangeSecurity(s, role, s.bases[role] === "X" ? "1" : "0");
    if (s.phase === "interpret") { render(); byId("sec-decision").focus(); }
  }));
  byId("sec-judge").addEventListener("click", () => act(() => {
    s = w.judgeSecurity(s, byId("sec-decision").value); render(); byId("sec-result-title").focus();
  }));
  byId("sec-next").addEventListener("click", () => act(() => {
    s = w.nextSecurity(s); byId("sec-decision").value = "";
    for (const id of ["sec-alice-basis", "sec-bob-basis", "sec-allocation"]) byId(id).value = "";
  }));
  byId("sec-reset").addEventListener("click", () => act(() => {
    s = w.resetSecurity(s); byId("sec-decision").value = "";
    for (const id of ["sec-alice-basis", "sec-bob-basis", "sec-allocation"]) byId(id).value = "";
  }));
  render();
  return {
    snapshot: () => s.phase !== "choice" ? s : { ...s,
      bases: { alice: s.committed.alice ? s.bases.alice : byId("sec-alice-basis").value || null,
        bob: s.committed.bob ? s.bases.bob : byId("sec-bob-basis").value || null },
      allocation: s.committed.alice ? s.allocation : Number(byId("sec-allocation").value) || null },
    isBusy: () => busy || s.running,
    dispose: () => { disposed = true; },
    note: (text) => { s = { ...s, notes: addNote(s.notes, text) }; render(); },
    message: (role, payload) => { if (busy) throw new Error("Wait for the experiment."); s = w.exchangeSecurity(s, role, payload); render(); },
  };
}
export function mountCalibration(initialSession, api, onComplete = null, onBusy = () => {}) {
  let s = initialSession;
  let busy = false;
  let disposed = false;
  const area = byId("later-level");
  area.innerHTML = `
    <section class="mission-heading"><div><p class="eyebrow">LEVEL 02 / TELEPORTATION</p>
      <h1>Teleportation Calibration<span>.</span></h1>
      <p class="mission-description">Build the Bell measurement. Exchange two bits. Discover recovery experimentally.</p>
      <p class="field-hint">New lab allocation: 12 source credits / 24 classical bits. Ideal simulator fidelity; hardware is unsupported here.</p>
      <p class="field-hint">Predict → Act → Exchange → Verify. Reset restores the lab budget and preserves discoveries.</p>
    </div><button id="cal-reset" type="button" class="quiet-button">Reset calibration</button></section>
    <div class="rooms"><section class="room alice-room"><h2>Alice's room</h2>
      <p class="role-description">Which order converts your two-qubit Bell measurement into classical readout? Commit a circuit, then transmit only your two measured bits.</p>
      <label for="cal-state">Known calibration state</label><select id="cal-state"><option value="">Choose a state</option><option value="0">|0&gt;</option><option value="+">|+&gt;</option><option value="+i">|+i&gt;</option></select>
      <label for="cal-operation">Alice's operation on input q0 and Bell half q1</label><select id="cal-operation"><option value="">Choose an operation</option><option value="CX_H">CX(0,1), then H(0)</option><option value="H_CX">H(0), then CX(0,1)</option><option value="CX_ONLY">CX(0,1) only</option></select>
      <button id="cal-measure" type="button" class="commit-button">Commit operation & measure</button>
      <p id="cal-alice-bits" class="field-hint" aria-live="polite"></p>
      <button id="cal-send" type="button" class="small-button">Transmit the two measured bits</button>
    </section><section class="room bob-room"><h2>Bob's room</h2>
      <p class="role-description">Use the transmitted bits and your discoveries to select recovery. A single calibration state can hide a phase or bit error.</p>
      <p id="cal-bob-bits" class="field-hint" aria-live="polite"></p>
      <label for="cal-correction">Your recovery hypothesis</label><select id="cal-correction"><option value="">Choose a correction</option><option>I</option><option>X</option><option>Z</option><option>XZ</option></select>
      <button id="cal-verify" type="button" class="commit-button">Commit correction & verify</button>
      <p class="field-hint">Notebook prompts: 00 → ? / 01 → ? / 10 → ? / 11 → ?. Record your own mapping in the notebook; no table is filled for you.</p>
    </section></div>
    <section id="cal-result" class="verification" hidden><h2 tabindex="-1" id="cal-result-title">Recovery evidence</h2><p id="cal-result-text"></p></section>
    <p id="cal-progress" class="field-hint"></p>
    <button id="cal-next" type="button" class="run-button">New calibration trial</button>
    <button id="cal-advance" type="button" class="small-button" hidden>Continue to Warden</button>`;
  function render() {
    if (disposed) return;
    onBusy(busy || s.running);
    renderShared(s);
    area.setAttribute("aria-busy", String(busy || s.running));
    if (s.state_name) byId("cal-state").value = s.state_name;
    if (s.operation) byId("cal-operation").value = s.operation;
    byId("cal-correction").value = s.correction || "";
    for (const id of ["cal-state", "cal-operation", "cal-measure"]) byId(id).disabled = busy || s.phase !== "choice";
    byId("cal-send").disabled = busy || s.phase !== "measured";
    byId("cal-correction").disabled = busy || s.phase !== "received" || s.bobCommitted;
    byId("cal-verify").disabled = busy || s.phase !== "received";
    byId("cal-reset").disabled = busy || s.running;
    byId("cal-next").disabled = busy || s.phase !== "result";
    byId("cal-alice-bits").textContent = s.alice_bits ? `Alice's readout (input bit, Bell-half bit): ${s.alice_bits.join("")}` : "Readout sealed until Alice commits.";
    byId("cal-bob-bits").textContent = s.received ? `Received from Alice: ${s.received}` : "Waiting for the permitted two-bit transmission.";
    byId("cal-result").hidden = !s.result;
    byId("cal-result-text").textContent = s.result
      ? `State |${s.state_name}>, operation ${s.operation}, correction ${s.correction}: ideal fidelity ${s.result.fidelity.toFixed(4)}. ${s.result.recovered ? "Recovery preserved this state. Test complementary states before inferring a general rule." : "Recovery changed the quantum state. Compare phase-sensitive and computational states."}` : "";
    byId("cal-progress").textContent = `${s.evidence.length}/${c.REQUIRED_RECOVERIES} successful trials verified. ${s.completed ? "Calibration complete; one fragment secured." : "Recover four trials successfully. Repeated measurement outcomes count; try different states to explore phase and bit errors."}`;
    byId("cal-advance").hidden = !s.completed || !onComplete;
    byId("cal-advance").disabled = busy || s.running;
  }
  async function act(action) {
    if (busy) return;
    try {
      const pending = action();
      if (typeof pending?.then === "function") await pending;
    }
    catch (error) { byId("system-message").textContent = error.message; }
    finally { busy = false; render(); }
  }
  byId("cal-measure").addEventListener("click", () => act(async () => {
    s = c.beginMeasurement(c.chooseCalibration(s, byId("cal-state").value, byId("cal-operation").value));
    busy = true; render(); const trial = s.trial;
    try { s = c.receiveMeasurement(s, await api.prepare(s), trial); }
    catch (error) { s = c.failCalibration(s, trial); throw error; }
    busy = false; render(); byId("cal-send").focus();
  }));
  byId("cal-send").addEventListener("click", () => act(() => {
    s = c.sendCalibrationMessage(s, "alice", s.alice_bits.join(""));
    render(); byId("cal-correction").focus();
  }));
  byId("cal-correction").addEventListener("change", () => act(() => {
    s = c.chooseCorrection(s, byId("cal-correction").value);
  }));
  byId("cal-verify").addEventListener("click", () => act(async () => {
    s = c.beginRecovery(s); busy = true; render(); const trial = s.trial;
    try { s = c.receiveRecovery(s, await api.finish(s), trial); }
    catch (error) { s = c.failCalibration(s, trial); throw error; }
    busy = false; render();
    byId("cal-result-title").focus();
  }));
  async function cancel() { if (s.trial_id) await api.cancel(s.trial_id); }
  byId("cal-next").addEventListener("click", () => act(async () => {
    if (s.phase !== "result") throw new Error("Complete the trial first.");
    busy = true; render(); await cancel(); s = c.nextCalibration(s);
    byId("cal-state").value = ""; byId("cal-operation").value = "";
    busy = false; render(); byId("cal-state").focus();
  }));
  byId("cal-reset").addEventListener("click", () => act(async () => {
    if (s.running) throw new Error("Wait for the pending trial.");
    busy = true; render(); await cancel(); s = c.resetCalibration(s);
    byId("cal-state").value = ""; byId("cal-operation").value = "";
    busy = false; render(); byId("cal-state").focus();
  }));
  byId("cal-advance").addEventListener("click", () => act(async () => {
    if (!s.completed || s.running) throw new Error("Complete calibration first.");
    await onComplete(s);
  }));
  render(); byId("cal-state").focus();
  return {
    snapshot: () => s.phase !== "choice" ? s : { ...s,
      state_name: byId("cal-state").value || null,
      operation: byId("cal-operation").value || null },
    isBusy: () => busy || s.running,
    dispose: () => { disposed = true; },
    note: (text) => { s = { ...s, notes: addNote(s.notes, text) }; render(); },
    message: (role, payload) => { if (busy) throw new Error("Wait for the experiment."); s = c.sendCalibrationMessage(s, role, payload); render(); },
  };
}
