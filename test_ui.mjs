/** Real Chromium DOM checks with a test-only Python bridge fixture, no server. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { readFile, readdir, mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const chromium = process.env.SPLIT_VAULT_CHROMIUM || "chromium";
const available = spawnSync(chromium, ["--version"]).status === 0;
const bridgeFixture = `
const trials = new Map(); let sequence = 0;
const proxy = (handler) => ({ callPromisingKwargs: async (...args) => {
  const kwargs = args.pop();
  const result = await handler(args, kwargs);
  return { toJs: () => result, destroy() {} };
} });
export const teleport_prepare = proxy(async ([state_name, operation], kwargs) => {
  if (kwargs.backend !== globalThis.backend) throw new Error("Backend was replaced");
  if (globalThis.blockNextPrepare) {
    globalThis.blockNextPrepare = false;
    await new Promise(resolve => { globalThis.resolvePrepare = resolve; });
  }
  const trial_id = (++sequence).toString(16).padStart(32, "0");
  const trial = { experiment: "calibration", status: "ok", trial_id,
    state_name, operation, alice_bits: [0, 0], diagnostic_source: "ideal_circuit" };
  trials.set(trial_id, trial); return trial;
});
export const teleport_finish = proxy(([id, correction]) => ({ ...trials.get(id),
  correction, fidelity: correction === "I" ? 1 : 0, bob_probabilities: { "0": 0.5, "1": 0.5 } }));
export const teleport_cancel = proxy(([trial_id]) => ({ status: "ok", cancelled: trials.delete(trial_id) }));
export const warden_open = proxy(() => ({ experiment: "warden", status: "ok", link_id: "b".repeat(32) }));
export const warden_close = proxy(() => ({ status: "ok", closed: true }));
export const warden_experiment = proxy(([text, shots], kwargs) => {
  if (typeof text !== "string" || kwargs.backend !== globalThis.backend) throw new Error("Invalid bridge input");
  const config = JSON.parse(text); const matched = config.basis_a === config.basis_b;
  return { ...config, experiment: "warden", status: "ok", shots,
    counts: { "00": shots / 2, "01": 0, "10": 0, "11": shots / 2 },
    agreement: 1, correlation: 1, correlation_type: "correlated",
    matched_shots: matched ? shots : 0, qber: matched ? 0 : null,
    qber_status: matched ? "measured" : "unavailable" };
});
export const bell_experiment = proxy(([basis_a, basis_b, shots], kwargs) => ({
  experiment: "bell", status: "ok", basis_a, basis_b, shots,
  preparation_gate: kwargs.preparation_gate, preparation_fidelity: 1,
  preparation_fidelity_source: "ideal_circuit", agreement: 1,
  correlation: 1, correlation_type: "correlated",
  counts: { "00": shots / 2, "01": 0, "10": 0, "11": shots / 2 }
}));
const radioTrials = new Map(); let radioMode;
export const radio_open = proxy(([mode]) => { radioMode = mode; return { experiment: "radio", status: "ok", mode,
  scenario_id: "c".repeat(32), num_qubits: 4, register_size: 16,
  bit_order: "q3q2q1q0", transform_sign: "positive", ...(mode === "guided" ? {input_positions: [0,4,8,12]} : {}) }; });
export const radio_measure = proxy(([scenario_id, text, shots], kwargs) => {
  if (typeof text !== "string" || kwargs.backend !== globalThis.backend) throw new Error("Invalid radio bridge");
  const trial_id = (++sequence).toString(16).padStart(32, "0");
  radioTrials.set(trial_id, { ...JSON.parse(text), mode: radioMode });
  return { experiment: "radio", status: "ok", mode: radioMode, scenario_id, trial_id,
    num_qubits: 4, register_size: 16, bit_order: "q3q2q1q0", shots,
    counts: Object.fromEntries(Array.from({length:16}, (_,y) => [y.toString(2).padStart(4,"0"), y%4===0 ? shots/4 : 0])) };
});
export const radio_verify = proxy(([trial_id, candidate]) => {
  if (globalThis.failRadioVerify) { globalThis.failRadioVerify = false; throw new Error("Verification transport interrupted"); }
  const predictions = radioTrials.get(trial_id);
  const blind = predictions.mode === "blind";
  const alice_matches = blind ? predictions.claims?.observations.join() === "0,4,8,12" && predictions.claims.phases.join() === "0,1/4,1/2,3/4" : predictions.alice_period === 4;
  const bob_matches = blind ? candidate === 4 : predictions.bob_spacing === 4;
  return { experiment: "radio", status: "ok", trial_id, alice_matches, bob_matches,
    spectrum_consistent: true, ...(!blind || alice_matches && bob_matches ? {observed_peaks: [0,4,8,12], observed_spacing: 4} : {}),
    diagnostic: blind ? "Your proposed period's phase pattern does not match all observed peaks." : "Compare your input spacing and the measured interference spectrum.",
    ...(alice_matches && bob_matches ? {period:4} : {}) };
});
export const radio_commit = proxy(([trial_id, integers, fractions]) => {
  const observations = integers.split(",").map(Number);
  const phases = fractions.split(",");
  const payload = phases.map(phase => { const [a,b=1] = phase.split("/").map(Number); return (a/b*16).toString(2).padStart(4,"0"); }).join("");
  radioTrials.get(trial_id).claims = {observations, phases, payload};
  return {experiment:"radio",status:"ok",trial_id,observations,phases,payload};
});
export const radio_discard = proxy(([id]) => ({ status: "ok", discarded: radioTrials.delete(id) }));
export const radio_close = proxy(() => ({ status: "ok", closed: true }));`;

async function browser(t) {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const dir = await mkdtemp(path.join(root, ".venv", "ui-check-"));
  const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  const imports = { api: dataUrl(bridgeFixture) };
  for (const filename of (await readdir(root)).filter(name => name.endsWith(".js"))) {
    // Inject the actual modules into the browser without file URLs or a server.
    const source = (await readFile(path.join(root, filename), "utf8"))
      .replace(/from "\.\/([^"\n]+)"/g, 'from "project:$1"');
    imports[`project:${filename}`] = dataUrl(source);
  }
  const setup = `<script>globalThis.backend = { selected: true };</script>
    <script type="importmap">${JSON.stringify({ imports })}</script>`;
  const html = (await readFile(path.join(root, "index.html"), "utf8"))
    .replace("<head>", `<head>${setup}`)
    .replace('<script type="module" src="./main.js"></script>', '<script type="module">import "project:main.js";</script>')
    .replace('<link rel="stylesheet" href="./main.css">', `<style>${await readFile(path.join(root, "main.css"), "utf8")}</style>`);
  const child = spawn(chromium, ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
    "--disable-background-networking", "--remote-debugging-pipe",
    `--user-data-dir=${path.join(dir, "profile")}`, "about:blank"],
    { stdio: ["ignore", "ignore", "pipe", "pipe", "pipe"] });
  let stderr = ""; let buffer = ""; let counter = 0; const pending = new Map(); const errors = [];
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-2000); });
  child.stdio[4].on("data", chunk => {
    buffer += chunk.toString(); let end;
    while ((end = buffer.indexOf("\0")) >= 0) {
      const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
      if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails);
      const resolve = pending.get(message.id);
      if (resolve) { pending.delete(message.id); resolve(message); }
    }
  });
  const send = async (method, params = {}, sessionId) => {
    const id = ++counter;
    const reply = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Chromium timeout: ${method}\n${stderr}`)); }, 10000);
      pending.set(id, message => { clearTimeout(timeout); resolve(message); });
    });
    child.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + "\0");
    const result = await reply;
    if (result.error) throw new Error(JSON.stringify(result.error));
    return result.result;
  };
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once("exit", resolve));
      await send("Browser.close").catch(() => child.kill()); await exited;
    }
    await rm(dir, { recursive: true, force: true });
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Runtime.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  const evaluate = async expression => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const { frameTree } = await send("Page.getFrameTree", {}, sessionId);
  await send("Page.setDocumentContent", { frameId: frameTree.frame.id, html }, sessionId);
  const wait = expression => evaluate(`new Promise((resolve, reject) => {
    const started = Date.now(); const check = () => {
      if (${expression}) resolve(true);
      else if (Date.now() - started > 5000) reject(new Error("UI condition timed out"));
      else setTimeout(check, 10);
    }; check();
  })`);
  try {
    await wait(`document.getElementById("level-select") && document.getElementById("run-hint").textContent.includes("Alice: commit")`);
  } catch (error) {
    throw new Error(`${error.message}\nBrowser exceptions: ${JSON.stringify(errors)}\nPage: ${JSON.stringify(await evaluate('({ url: location.href, base: document.baseURI, state: document.readyState, hint: document.getElementById("run-hint")?.textContent })'))}`);
  }
  const viewport = (width, height) => send("Emulation.setDeviceMetricsOverride",
    { width, height, deviceScaleFactor: 1, mobile: true }, sessionId);
  return { evaluate, wait, errors, viewport };
}

test("browser: direct stage selection, four-trial recovery, saved progress and pending locks", { skip: !available, timeout: 30000 }, async t => {
  const { evaluate, wait, errors, viewport } = await browser(t);
  const select = async value => {
    await evaluate(`document.getElementById("level-select").value = "${value}";
      document.getElementById("level-select").dispatchEvent(new Event("change"));`);
    await wait(`document.getElementById("level-select").value === "${value}"`);
  };
  await select(3);
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "00");
  await evaluate('document.getElementById("sec-open").click()');
  await wait('document.getElementById("sec-open").disabled && !document.getElementById("level-select").disabled');
  await select(2);
  await evaluate(`document.getElementById("cal-state").value = "+i";
    document.getElementById("cal-operation").value = "CX_H";`);
  await select(1); await select(2);
  assert.equal(await evaluate('document.getElementById("cal-state").value'), "+i");
  for (let trial = 1; trial <= 4; trial++) {
    await evaluate(`document.getElementById("cal-state").value = "+i";
      document.getElementById("cal-operation").value = "CX_H";
      ${trial === 1 ? "globalThis.blockNextPrepare = true;" : ""}
      document.getElementById("cal-measure").click();`);
    if (trial === 1) {
      assert.equal(await evaluate('document.getElementById("level-select").disabled'), true);
      await evaluate(`document.getElementById("level-select").value = "3";
        document.getElementById("level-select").dispatchEvent(new Event("change"));`);
      assert.equal(await evaluate('document.getElementById("level-select").value'), "2");
      await evaluate('globalThis.resolvePrepare()');
    }
    await wait('!document.getElementById("cal-send").disabled');
    // A measured trial survives switching without a new quantum request.
    if (trial === 2) { await select(3); await select(2); }
    await evaluate(`document.getElementById("cal-send").click();
      document.getElementById("cal-correction").value = "I";
      document.getElementById("cal-correction").dispatchEvent(new Event("change"));
      document.getElementById("cal-verify").click();`);
    await wait('!document.getElementById("cal-result").hidden && !document.getElementById("level-select").disabled');
    assert.match(await evaluate('document.getElementById("cal-progress").textContent'), new RegExp(`${trial}/4`));
    assert.equal(await evaluate('document.getElementById("fragments").textContent'), trial === 4 ? "01" : "00");
    if (trial < 4) {
      await evaluate('document.getElementById("cal-next").click()');
      await wait('!document.getElementById("cal-measure").disabled');
    }
  }
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "8");
  assert.equal(await evaluate('document.getElementById("classical-bits").textContent'), "16");
  await evaluate('document.getElementById("cal-advance").click()');
  await wait('document.getElementById("level-select").value === "3"');
  assert.equal(await evaluate('document.getElementById("sec-open").disabled'), true, "Existing hidden link is preserved");
  await evaluate(`document.getElementById("sec-alice-basis").value = "Z";
    document.getElementById("sec-allocation").value = "1";
    document.getElementById("sec-alice-commit").click();
    document.getElementById("sec-bob-basis").value = "Z";
    document.getElementById("sec-bob-commit").click();
    document.getElementById("sec-run").click();`);
  await wait('!document.getElementById("sec-alice-send").disabled');
  assert.equal(await evaluate('document.getElementById("sec-observation").hidden'), true);
  await evaluate(`document.getElementById("sec-alice-send").click();
    document.getElementById("sec-bob-send").click();
    document.getElementById("sec-decision").value = "insufficient";
    document.getElementById("sec-judge").click();`);
  assert.equal(await evaluate('document.getElementById("sec-result").hidden'), false);
  await evaluate(`document.getElementById("open-notebook").click();
    document.getElementById("note-text").value = "Our shared discovery";
    document.getElementById("note-form").dispatchEvent(new Event("submit", { cancelable: true }));
    document.getElementById("close-notebook").click();`);
  await select(1);
  assert.match(await evaluate('document.getElementById("notes").textContent'), /Our shared discovery/);
  await evaluate(`const choose = (name, value) => {
      const input = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
      input.checked = true; input.dispatchEvent(new Event("change"));
    };
    choose("alice-gate", "H"); document.getElementById("alice-commit").click();
    choose("alice-basis", "Z"); choose("bob-prediction", "correlated"); choose("bob-basis", "Z");
    document.getElementById("bob-commit").click(); document.getElementById("run-experiment").click();`);
  await wait('!document.getElementById("verification").hidden && !document.getElementById("level-select").disabled');
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "02");
  await evaluate('document.getElementById("next-level").click()');
  await wait('document.getElementById("level-select").value === "2"');
  assert.match(await evaluate('document.getElementById("messages").textContent'), /00/,
    "Calibration's own transmission log is restored");
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "8");
  assert.match(await evaluate('document.getElementById("cal-progress").textContent'), /4\/4/);
  await evaluate('document.getElementById("cal-reset").click()');
  await wait('!document.getElementById("cal-measure").disabled');
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "02");
  assert.match(await evaluate('document.getElementById("cal-progress").textContent'), /4\/4/);
  await viewport(390, 844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true,
    "Stage selector and calibration fit a mobile viewport");
  await select(3);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true,
    "Warden fits a mobile viewport after selecting it");
  assert.deepEqual(errors, []);
});

test("browser: guided radio hides output until commitments and renders measured markers/rewards", { skip: !available, timeout: 30000 }, async t => {
  const { evaluate, wait, errors, viewport } = await browser(t);
  await evaluate('document.getElementById("level-select").value="4"; document.getElementById("level-select").dispatchEvent(new Event("change")); document.getElementById("fourier-open").click();');
  await wait('!document.getElementById("fourier-alice").disabled');
  assert.equal(await evaluate('document.querySelectorAll("#fourier-pattern .has-amplitude").length'), 4);
  assert.equal(await evaluate('document.querySelectorAll("#fourier-spectrum .radio-bin").length'), 0);
  assert.equal(await evaluate('document.getElementById("fourier-why").disabled'), true);
  assert.equal(await evaluate('document.getElementById("fourier-bob").disabled'), true);
  async function play(period, spacing) {
    await evaluate(`document.getElementById("fourier-alice").value="${period}"; document.getElementById("fourier-alice-commit").click(); document.getElementById("fourier-send").click(); document.getElementById("fourier-bob").value="${spacing}"; document.getElementById("fourier-bob-commit").click(); document.getElementById("fourier-run").click();`);
    try { await wait('!document.getElementById("fourier-result").hidden && !document.getElementById("level-select").disabled'); }
    catch (error) { throw new Error(`${error.message}: ${await evaluate('document.getElementById("system-message").textContent')}`); }
  }
  await play(2, 8);
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "00");
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "11");
  assert.equal(await evaluate('document.getElementById("fourier-why").disabled'), true);
  await evaluate('document.getElementById("fourier-next").click()');
  await wait('!document.getElementById("fourier-alice").disabled');
  await play(4, 4);
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "01");
  assert.equal(await evaluate('document.querySelectorAll("#fourier-spectrum .radio-bin.is-peak").length'), 4);
  await evaluate('document.getElementById("fourier-why").click()');
  assert.match(await evaluate('document.getElementById("fourier-explanation").textContent'), /N\/r/);
  await evaluate('document.getElementById("fourier-advance").click()');
  await wait('document.getElementById("level-select").value === "5"');
  await evaluate('document.getElementById("level-select").value="4"; document.getElementById("level-select").dispatchEvent(new Event("change"));');
  await viewport(390, 844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate('document.getElementById("fourier-reset").click()');
  await wait('!document.getElementById("fourier-alice").disabled');
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "01");
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "12");
  assert.deepEqual(errors, []);
});

test("browser: hidden period requires manual decoding, phase-only exchange, commitment and retry; mobile and discoveries survive", { skip: !available, timeout: 30000 }, async t => {
  const { evaluate, wait, errors, viewport } = await browser(t);
  await evaluate('document.getElementById("level-select").value="5"; document.getElementById("level-select").dispatchEvent(new Event("change")); document.getElementById("fourier-open").click();');
  await wait('!document.getElementById("fourier-run").disabled');
  assert.equal(await evaluate('document.getElementById("fourier-pattern")'), null);
  assert.equal(await evaluate('document.getElementById("fourier-bob").disabled'), true);
  assert.equal(await evaluate('document.getElementById("fourier-why").disabled'), true);
  async function sample() {
    await evaluate('document.getElementById("fourier-run").click()');
    await wait('!document.getElementById("fourier-observations").disabled');
  }
  async function interpret() {
    await evaluate('document.getElementById("fourier-observations").value="0,4,8,12"; document.getElementById("fourier-phases").value="0,1/4,1/2,3/4"; document.getElementById("fourier-alice-commit").click();');
    await wait('!document.getElementById("fourier-send").disabled');
    await evaluate('document.getElementById("fourier-send").click()');
  }
  async function infer(candidate, fail = false) {
    await evaluate(`document.getElementById("fourier-bob").value="${candidate}"; document.getElementById("fourier-bob-commit").click(); ${fail ? "globalThis.failRadioVerify = true;" : ""} document.getElementById("fourier-verify").click();`);
    await wait('!document.getElementById("level-select").disabled');
  }
  await sample();
  assert.equal(await evaluate('document.querySelectorAll(".alice-room .radio-bin").length'), 16);
  assert.equal(await evaluate('document.querySelectorAll(".bob-room .radio-bin").length'), 0);
  assert.match(await evaluate('document.getElementById("fourier-spectrum").textContent'), /0100/);
  assert.equal(await evaluate('document.getElementById("fourier-observations").value'), "");
  // Uncommitted manual discoveries and raw measurement survive navigation.
  await evaluate('document.getElementById("fourier-observations").value="0,4,8,12"; document.getElementById("level-select").value="2"; document.getElementById("level-select").dispatchEvent(new Event("change")); document.getElementById("level-select").value="5"; document.getElementById("level-select").dispatchEvent(new Event("change"));');
  assert.equal(await evaluate('document.getElementById("fourier-observations").value'), "0,4,8,12");
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "11");
  await interpret();
  assert.match(await evaluate('document.getElementById("fourier-received").textContent'), /0, 1\/4, 1\/2, 3\/4/);
  assert.equal(await evaluate('document.getElementById("classical-bits").textContent'), "112");
  await infer(2);
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "00");
  assert.equal(await evaluate('document.querySelectorAll(".radio-bin.is-peak").length'), 0);
  assert.equal(await evaluate('document.getElementById("fourier-why").disabled'), true);
  assert.doesNotMatch(await evaluate('document.getElementById("fourier-diagnostic").textContent'), /period 4 confirmed/);
  await evaluate('document.getElementById("fourier-reset").click()');
  await wait('!document.getElementById("fourier-run").disabled');
  assert.equal(await evaluate('document.getElementById("classical-bits").textContent'), "128");
  await sample(); await interpret(); await infer(4, true);
  assert.equal(await evaluate('document.getElementById("fourier-bob").disabled'), true);
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "11");
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "00");
  await evaluate('document.getElementById("fourier-verify").click()');
  await wait('!document.getElementById("fourier-result").hidden');
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "01");
  assert.equal(await evaluate('document.getElementById("bell-pairs").textContent'), "11");
  assert.match(await evaluate('document.getElementById("fourier-diagnostic").textContent'), /period 4 confirmed/);
  await evaluate('document.getElementById("fourier-why").click()');
  assert.match(await evaluate('document.getElementById("fourier-explanation").textContent'), /y\/16/);
  await viewport(390, 844);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await evaluate('document.getElementById("fourier-reset").click()');
  await wait('!document.getElementById("fourier-run").disabled');
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "01");
  assert.equal(await evaluate('document.getElementById("fourier-why").disabled'), true);
  await evaluate('document.getElementById("open-notebook").click()');
  assert.match(await evaluate('document.getElementById("notes").textContent'), /Hidden Period/);
  assert.deepEqual(errors, []);
});

test("browser: Warden advancement remains locked until complementary evidence completes the stage", { skip: !available, timeout: 30000 }, async t => {
  const { evaluate, wait, errors } = await browser(t);
  await evaluate('document.getElementById("level-select").value="3"; document.getElementById("level-select").dispatchEvent(new Event("change")); document.getElementById("sec-open").click();');
  await wait('!document.getElementById("sec-alice-commit").disabled');
  assert.equal(await evaluate('document.getElementById("sec-advance").hidden'), true);
  for (const basis of ["Z", "X"]) {
    await evaluate(`document.getElementById("sec-alice-basis").value="${basis}"; document.getElementById("sec-allocation").value="1"; document.getElementById("sec-alice-commit").click(); document.getElementById("sec-bob-basis").value="${basis}"; document.getElementById("sec-bob-commit").click(); document.getElementById("sec-run").click();`);
    await wait('!document.getElementById("sec-alice-send").disabled');
    await evaluate(`document.getElementById("sec-alice-send").click(); document.getElementById("sec-bob-send").click(); document.getElementById("sec-decision").value="${basis === "Z" ? "insufficient" : "trust"}"; document.getElementById("sec-judge").click();`);
    if (basis === "Z") {
      assert.equal(await evaluate('document.getElementById("sec-advance").hidden'), true);
      await evaluate('document.getElementById("sec-next").click()');
    }
  }
  assert.equal(await evaluate('document.getElementById("fragments").textContent'), "01");
  await evaluate('document.getElementById("sec-advance").click()');
  await wait('document.getElementById("level-select").value === "4"');
  assert.equal(await evaluate('document.getElementById("fourier-open").disabled'), false);
  assert.deepEqual(errors, []);
});
