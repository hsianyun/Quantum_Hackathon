/** Fourier role views; all spectra and scientific verification come from Python. */
import * as r from "./quantum-radio.js";
import { renderShared } from "./later-level.js";
import { addNote } from "./notebook.js";

const byId = id => document.getElementById(id);
export function renderRadioHistogram(container, measurement, peaks = [], integers = true) {
  container.replaceChildren();
  if (!measurement) { container.textContent = "Spectrum sealed until the required commitments."; return; }
  const plot = document.createElement("div"); plot.className = "radio-histogram";
  const maximum = Math.max(...Object.values(measurement.counts));
  for (const [bits, count] of Object.entries(measurement.counts).sort()) {
    const y = parseInt(bits, 2); // Display formatting, not Fourier inference.
    const bin = document.createElement("div"); bin.className = "radio-bin";
    if (peaks.includes(y)) bin.classList.add("is-peak");
    const value = document.createElement("span"); value.textContent = count;
    const track = document.createElement("div"); track.className = "radio-track";
    const bar = document.createElement("i"); bar.style.height = `${count / maximum * 100}%`;
    const label = document.createElement("span"); label.textContent = integers ? `${y}` : bits;
    track.append(bar); bin.append(value, track, label); plot.append(bin);
  }
  container.append(plot);
}

export function mountRadio(initialSession, api, onBusy = () => {}, onComplete = null) {
  let s = initialSession; let busy = false; let disposed = false;
  const blind = s.mode === "blind";
  const area = byId("later-level");
  area.innerHTML = `
    <section class="mission-heading"><div><p class="eyebrow">${blind ? "STAGE 05 / BLIND RADIO" : "STAGE 04 / QUANTUM RADIO"}</p>
      <h1>${blind ? "Hidden Period" : "Quantum Radio"}<span>.</span></h1>
      <p class="mission-description">${blind ? "Decode the raw readouts. Exchange phase observations. Infer the hidden repetition." : "Inspect the periodic superposition. Exchange a hypothesis. Predict where interference will concentrate the spectrum."}</p>
      <p class="field-hint">N=16 / forward QFT. New lab: 12 sampling credits / ${blind ? 128 : 32} classical bits. One credit buys 4,096 fresh shots.</p>
      <p class="field-hint">Use a local simulator for repeated trials. IonQ permits one job per Run.</p>
    </div><button id="fourier-reset" class="quiet-button" type="button">Reset radio checkpoint</button></section>
    <button id="fourier-open" class="small-button" type="button">${blind ? "Open a blind radio" : "Load a periodic pattern"}</button>
    <button id="fourier-replace" class="small-button" type="button">Replace an expired scenario</button>
    <div class="rooms"><section class="room alice-room"><h2>Alice's room</h2>
      ${blind ? `<p class="role-description">Measure first. Read all populated bitstrings as q3q2q1q0 (q0 is least significant). Enter their integer values and corresponding y/16 phases yourself, in matching order. No automatic interpretation is supplied.</p>
      <div id="fourier-spectrum" class="radio-plot" aria-label="Alice's raw four-bit measurement histogram"></div>
      <label for="fourier-observations">Your integer outcomes (comma separated)</label><input id="fourier-observations" type="text" maxlength="256" placeholder="Integer readouts">
      <label for="fourier-phases">Your phase fractions (comma separated)</label><input id="fourier-phases" type="text" maxlength="256" placeholder="One fraction per readout">
      <button id="fourier-alice-commit" class="commit-button" type="button">Commit Alice's interpretation</button>
      <button id="fourier-send" class="small-button" type="button">Transmit the committed phases</button>
      <p class="field-hint">Only phase fractions reach Bob; four classical bits per fraction. A committed input can be retried unchanged. Reset to revise it.</p>` : `<p class="role-description">Highlighted computational states have equal amplitude. Infer their repeated spacing, then commit your periodic-structure hypothesis.</p>
      <div id="fourier-pattern" class="radio-pattern" aria-label="Periodic input amplitude locations"></div>
      <label for="fourier-alice">Your candidate input period</label><select id="fourier-alice"><option value="">Choose a hypothesis</option><option value="2">2</option><option value="4">4</option></select>
      <button id="fourier-alice-commit" class="commit-button" type="button">Commit Alice's prediction</button>
      <button id="fourier-send" class="small-button" type="button">Transmit the committed code</button>
      <p class="field-hint">Alice's code: 2=0, 4=1; one classical bit. Bob receives your hypothesis, not the input pattern.</p>`}
    </section><section class="room bob-room"><h2>Bob's room</h2>
      <p class="role-description">${blind ? "Receive only Alice's claimed phases. Compare their spacing or denominators and infer a candidate period. Commit before checking the answer." : "Use N=16 and Alice's transmitted hypothesis to predict constructive interference. Commit the output peak spacing before seeing the spectrum."}</p>
      <p id="fourier-received" class="field-hint" aria-live="polite"></p>
      <label for="fourier-bob">${blind ? "Your inferred period" : "Your predicted Fourier peak spacing"}</label><select id="fourier-bob"><option value="">Choose a candidate</option><option value="2">2</option><option value="4">4</option><option value="8">8</option></select>
      <button id="fourier-bob-commit" class="commit-button" type="button">Commit Bob's prediction</button>
      ${blind ? "" : '<div id="fourier-spectrum" class="radio-plot" aria-label="Measured Fourier histogram"></div>'}
      <p id="fourier-markers" class="field-hint"></p>
    </section></div>
    <button id="fourier-run" class="run-button" type="button">${blind ? "Measure raw Fourier readouts" : "Measure & verify predictions"}</button>
    <button id="fourier-verify" class="run-button" type="button" ${blind ? "" : "hidden"}>Verify the committed interpretation & period</button>
    <button id="fourier-retry" class="small-button" type="button" hidden>Retry committed verification</button>
    <section id="fourier-result" class="verification" hidden><h2 id="fourier-result-title" tabindex="-1">Interference evidence</h2><p id="fourier-diagnostic"></p></section>
    <button id="fourier-next" class="small-button" type="button">New radio trial</button>
    <button id="fourier-advance" class="small-button" type="button" hidden>Continue to Hidden Period</button>
    <section class="why-panel"><button id="fourier-why" class="why-toggle" type="button" disabled aria-expanded="false" aria-controls="fourier-explanation">Why this works — locked until completion</button><div id="fourier-explanation" hidden></div></section>
    <p class="field-hint">Notebook prompts: Register size N = __; ${blind ? "readout bitstrings = __; integer outcomes = __; phase fractions = __" : "input locations = __; observed peaks = __"}; peak spacing = __; candidate period = __.</p>`;
  if (blind) { byId("fourier-observations").value = s.observations_text; byId("fourier-phases").value = s.phases_text; }
  function render() {
    if (disposed) return;
    onBusy(busy || s.running); renderShared(s); area.setAttribute("aria-busy", String(busy || s.running));
    byId("fourier-open").disabled = busy || Boolean(s.scenario_id);
    byId("fourier-replace").disabled = busy || !s.scenario_id;
    byId("fourier-reset").disabled = busy || s.running;
    if (!blind) {
      byId("fourier-pattern").replaceChildren();
      if (s.descriptor) for (let x = 0; x < 16; x++) {
        const cell = document.createElement("span"); cell.textContent = x;
        if (s.descriptor.input_positions.includes(x)) cell.className = "has-amplitude";
        cell.setAttribute("aria-label", `Input ${x}: ${s.descriptor.input_positions.includes(x) ? "equal nonzero amplitude" : "zero amplitude"}`);
        byId("fourier-pattern").append(cell);
      }
      if (s.alice_period) byId("fourier-alice").value = String(s.alice_period);
      byId("fourier-alice").disabled = busy || !s.scenario_id || s.phase !== "choice" || s.aliceCommitted;
      byId("fourier-alice-commit").disabled = byId("fourier-alice").disabled;
      byId("fourier-send").disabled = busy || s.phase !== "choice" || !s.aliceCommitted;
    } else {
      for (const [field, value] of [["observations", s.observations_text], ["phases", s.phases_text]]) {
        if (s.aliceCommitted) byId(`fourier-${field}`).value = value;
        byId(`fourier-${field}`).disabled = busy || s.phase !== "observing" || s.aliceCommitted;
      }
      byId("fourier-alice-commit").disabled = busy || s.phase !== "observing";
      byId("fourier-send").disabled = busy || s.phase !== "interpreted";
    }
    if (s.bob_spacing) byId("fourier-bob").value = String(s.bob_spacing);
    byId("fourier-bob").disabled = busy || s.phase !== "bob" || s.bobCommitted;
    byId("fourier-bob-commit").disabled = byId("fourier-bob").disabled;
    byId("fourier-received").textContent = s.received === null ? "Waiting for Alice's committed transmission." : blind ? `Alice's claimed phases: ${s.received.join(", ")}.` : `Alice's transmitted hypothesis: input period ${s.received}.`;
    byId("fourier-run").disabled = busy || s.phase !== (blind ? "choice" : "bob") || !s.scenario_id || (!blind && !s.bobCommitted) || s.game.bellPairs < 1;
    byId("fourier-verify").disabled = busy || s.phase !== "bob" || !s.bobCommitted;
    byId("fourier-retry").hidden = s.phase !== "measured"; byId("fourier-retry").disabled = busy;
    renderRadioHistogram(byId("fourier-spectrum"), s.measurement, s.verification?.observed_peaks, !blind);
    byId("fourier-markers").textContent = s.verification?.observed_peaks
      ? `Measured peak markers: ${s.verification.observed_peaks.join(", ")}; observed spacing ${s.verification.observed_spacing ?? "unavailable"}.` : blind ? "Peak interpretation stays yours; verified markers unlock only after a correct interpretation and period inference." : "Peak markers stay sealed until both hypotheses are committed and measured.";
    byId("fourier-result").hidden = !s.verification;
    byId("fourier-diagnostic").textContent = s.verification
      ? `Alice's ${blind ? "interpretation" : "hypothesis"} ${s.verification.alice_matches ? "matches" : "needs revision"}; Bob's ${blind ? "period" : "spacing"} ${s.verification.bob_matches ? "matches" : "needs revision"}. ${s.verification.diagnostic}${s.verification.solved ? (blind ? ` Hidden period ${s.verification.period} confirmed. Stage 5 complete; Circuit Architect comes next. One fragment secured.` : " One fragment secured.") : ""}` : "";
    byId("fourier-next").disabled = busy || s.phase !== "result";
    byId("fourier-advance").hidden = !s.completed || !onComplete;
    byId("fourier-advance").disabled = busy || s.running;
    const explained = blind ? s.verification?.solved : s.completed;
    byId("fourier-why").disabled = !explained;
    byId("fourier-why").textContent = explained ? "Why this works" : "Why this works — locked until completion";
    if (!explained) { byId("fourier-explanation").textContent = ""; byId("fourier-explanation").hidden = true; byId("fourier-why").setAttribute("aria-expanded", "false"); }
    else byId("fourier-explanation").textContent = blind
      ? "A Qiskit readout lists q3q2q1q0, so q0 is the least significant bit. Interpret its integer value y and divide by N=16 to obtain a phase y/16. In these clean divisor cases, neighboring phase peaks differ by 1/r, and integer peaks by N/r. Repeated independent shots reveal the distribution rather than a single random readout. Alice supplies phase evidence; Bob reconstructs its repeated spacing to infer r."
      : "An equal periodic superposition contributes phases to every Fourier output. Contributions align at constructive-interference peaks and cancel elsewhere. With register size N and a clean divisor period r, peaks are spaced N/r. The forward QFT uses positive phase; the inverse uses negative phase. These clean states have the same peak probabilities in either direction. Final swaps keep q0 least significant.";
  }
  async function act(action) {
    if (busy) return;
    try { const pending = action(); if (typeof pending?.then === "function") await pending; }
    catch (error) { byId("system-message").textContent = error.message; }
    finally { busy = false; render(); }
  }
  async function verify() {
    s = r.beginRadioVerification(s); const trial = s.trial;
    try { s = r.receiveRadioVerification(s, await api.verify(s.trial_id, blind ? s.bob_spacing : undefined), trial); }
    catch (error) { s = r.failRadio(s, trial); throw error; }
  }
  const clearChoices = () => { for (const field of blind ? ["observations", "phases", "bob"] : ["alice", "bob"]) byId(`fourier-${field}`).value = ""; };
  const discard = async () => { if (s.trial_id) await api.discard(s.trial_id); };
  byId("fourier-open").addEventListener("click", () => act(async () => { busy = true; render(); s = r.attachRadio(s, await api.open(s.mode)); }));
  byId("fourier-replace").addEventListener("click", () => act(async () => {
    busy = true; render(); await api.close(s.scenario_id); s = r.replaceRadio(s); clearChoices(); s = r.attachRadio(s, await api.open(s.mode));
  }));
  async function interpret() {
    s = r.beginRadioInterpretation(s, byId("fourier-observations").value, byId("fourier-phases").value);
    busy = true; render(); const trial = s.trial;
    try { s = r.receiveRadioInterpretation(s, await api.commit(s.trial_id, s.observations_text, s.phases_text), trial); }
    catch (error) { s = r.failRadio(s, trial); throw error; }
  }
  byId("fourier-alice-commit").addEventListener("click", () => act(() => {
    if (blind) return interpret();
    s = r.commitRadioAlice(r.chooseRadioAlice(s, Number(byId("fourier-alice").value)));
  }));
  byId("fourier-send").addEventListener("click", () => act(() => { s = r.sendRadioMessage(s, "alice", blind ? s.claims.payload : s.alice_period === 2 ? "0" : "1"); }));
  byId("fourier-bob-commit").addEventListener("click", () => act(() => { s = r.commitRadioBob(r.chooseRadioBob(s, Number(byId("fourier-bob").value))); }));
  byId("fourier-run").addEventListener("click", () => act(async () => {
    s = r.beginRadioMeasurement(s); busy = true; render(); const trial = s.trial;
    try { s = r.receiveRadioMeasurement(s, await api.measure(r.radioRequest(s)), trial); }
    catch (error) { s = r.failRadio(s, trial); throw error; }
    if (!blind) { await verify(); busy = false; render(); byId("fourier-result-title").focus(); }
  }));
  byId("fourier-verify").addEventListener("click", () => act(async () => { busy = true; render(); await verify(); busy = false; render(); byId("fourier-result-title").focus(); }));
  byId("fourier-retry").addEventListener("click", () => act(async () => { busy = true; render(); await verify(); }));
  byId("fourier-next").addEventListener("click", () => act(async () => { busy = true; render(); await discard(); s = r.nextRadioTrial(s); clearChoices(); }));
  byId("fourier-reset").addEventListener("click", () => act(async () => { busy = true; render(); await discard(); s = r.resetRadio(s); clearChoices(); }));
  byId("fourier-advance").addEventListener("click", () => act(() => onComplete?.(s)));
  byId("fourier-why").addEventListener("click", () => { if (byId("fourier-why").disabled) return; const panel = byId("fourier-explanation"); panel.hidden = !panel.hidden; byId("fourier-why").setAttribute("aria-expanded", String(!panel.hidden)); });
  render();
  return {
    snapshot: () => ({ ...s, ...(blind ? { observations_text: byId("fourier-observations").value, phases_text: byId("fourier-phases").value }
      : { alice_period: s.aliceCommitted ? s.alice_period : Number(byId("fourier-alice").value) || null }),
      bob_spacing: s.bobCommitted ? s.bob_spacing : Number(byId("fourier-bob").value) || null }),
    isBusy: () => busy || s.running,
    dispose: () => { disposed = true; },
    note: text => { s = { ...s, notes: addNote(s.notes, text) }; render(); },
    message: (role, payload) => { if (busy) throw new Error("Wait for the pending request."); s = r.sendRadioMessage(s, role, payload); render(); },
  };
}
