import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { createInitialState } from "./state.js";
import * as c from "./calibration.js";
import { createCalibrationExperiments } from "./quantum-client.js";
import { createSecurityExperiments, createQftExperiment } from "./quantum-client.js";
import * as w from "./security.js";

async function python(t, scenario = "ideal") {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const executable = process.env.SPLIT_VAULT_PYTHON || `${root}.venv/bin/python`;
  const source = `
import json,sys
from api import teleport_prepare,teleport_finish,teleport_cancel,warden_open,warden_experiment,warden_close,qft_experiment
from qiskit.providers.basic_provider import BasicSimulator
counter=0
for line in sys.stdin:
    try:
        request=json.loads(line)
        if request['method']=='prepare':
            result=teleport_prepare(*request['args'], backend=BasicSimulator(seed_simulator=counter))
            counter+=1
        elif request['method']=='finish': result=teleport_finish(*request['args'])
        elif request['method']=='cancel': result=teleport_cancel(*request['args'])
        elif request['method']=='open': result=warden_open(scenario=${JSON.stringify(scenario)})
        elif request['method']=='run': result=warden_experiment(*request['args'],backend=BasicSimulator(seed_simulator=42))
        elif request['method']=='close': result=warden_close(*request['args'])
        elif request['method']=='qft': result=qft_experiment(*request['args'],backend=BasicSimulator(seed_simulator=42))
        else: raise ValueError('Unknown experiment')
    except Exception as error: result={'error':str(error)}
    print(json.dumps(result,allow_nan=False),flush=True)
`;
  const child = spawn(executable, ["-u", "-c", source], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = ""; let launchError;
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  child.on("error", (error) => { launchError = error; });
  const exited = new Promise((resolve) => { child.once("exit", resolve); child.once("error", resolve); });
  const lines = createInterface({ input: child.stdout }); const replies = lines[Symbol.asyncIterator]();
  t.after(async () => { child.stdin.end(); await exited; lines.close(); });
  return (method) => ({ callPromisingKwargs: async (...args) => {
    const kwargs = args.pop();
    if (["prepare", "run", "qft"].includes(method)) assert.ok(kwargs.backend, "Selected backend must be forwarded");
    if (["run", "qft"].includes(method)) assert.equal(typeof args[0], "string",
      "Object configs must cross the Python bridge as JSON text, not a JavaScript proxy");
    child.stdin.write(JSON.stringify({ method, args }) + "\n");
    const reply = await replies.next();
    assert.equal(reply.done, false, launchError?.message || stderr || "Python stopped");
    const result = JSON.parse(reply.value);
    if (result.error) throw new Error(result.error);
    return { toJs: () => result };
  } });
}
test("calibration preserves real measured branches through exchange and recovery; wrong decisions cost fairly", { timeout: 30000 }, async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP"));
  const fn = await python(t);
  const api = createCalibrationExperiments(fn("prepare"), fn("finish"), fn("cancel"), { selected: "BasicSimulator" });
  let s = c.enterCalibration({ ...createInitialState(), vaultFragments: 1 });
  for (const [index, state] of ["0", "+", "+i", "+i"].entries()) {
    s = c.beginMeasurement(c.chooseCalibration(s, state, "CX_H"));
    const measurement = await api.prepare(s);
    assert.equal("fidelity" in measurement, false);
    s = c.receiveMeasurement(s, measurement, s.trial);
    assert.throws(() => c.beginRecovery(s));
    s = c.sendCalibrationMessage(s, "alice", s.alice_bits.join(""));
    const correction = (s.alice_bits[1] ? "X" : "") + (s.alice_bits[0] ? "Z" : "") || "I";
    s = c.beginRecovery(c.chooseCorrection(s, correction));
    const result = await api.finish(s);
    assert.deepEqual((await api.finish(s)), result, "Conversion retry must be idempotent");
    s = c.receiveRecovery(s, result, s.trial);
    assert.ok(s.result.fidelity >= 1 - 1e-9);
    assert.equal(s.evidence.length, index + 1);
    assert.equal(s.completed, index === 3, "Exactly four successful trials should finish the stage");
    await api.cancel(s.trial_id);
    s = c.nextCalibration(s);
  }
  assert.equal(s.completed, true);
  assert.equal(s.game.vaultFragments, 2);
  assert.equal(s.game.bellPairs, 8);
  assert.equal(s.game.classicalBits, 16);
  s = c.resetCalibration(s);
  s = c.beginMeasurement(c.chooseCalibration(s, "+i", "CX_H"));
  s = c.receiveMeasurement(s, await api.prepare(s), s.trial);
  s = c.sendCalibrationMessage(s, "alice", s.alice_bits.join(""));
  const right = (s.alice_bits[1] ? "X" : "") + (s.alice_bits[0] ? "Z" : "") || "I";
  const wrong = { I: "X", X: "I", Z: "XZ", XZ: "Z" }[right];
  s = c.beginRecovery(c.chooseCorrection(s, wrong));
  s = c.receiveRecovery(s, await api.finish(s), s.trial);
  assert.ok(s.result.fidelity < 1e-9);
  assert.equal(s.game.bellPairs, 11);
  assert.equal(s.game.vaultFragments, 2);
  await assert.rejects(api.finish({ trial_id: s.trial_id, correction: right }), /committed/);
  await api.cancel(s.trial_id);
  await assert.rejects(api.finish(s), /cancelled or expired/);
});

test("QFT utility returns real r2/r4 histograms through the existing async Python boundary", { timeout: 30000 }, async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP"));
  const fn = await python(t);
  const run = createQftExperiment(fn("qft"), { selected: true });
  for (const [period, peaks] of [[2, [0, 8]], [4, [0, 4, 8, 12]]]) {
    const result = await run({ config: { num_qubits: 4, period }, shots: 4096 });
    assert.equal(result.status, "ok");
    assert.equal(result.experiment, "qft");
    assert.deepEqual(result.dominant_positions, peaks);
    assert.equal(Object.values(result.counts).reduce((a, b) => a + b, 0), 4096);
    assert.equal("factors" in result, false);
  }
  await assert.rejects(run({ config: { num_qubits: 4, period: 3 }, shots: 1024 }), /dividing/);
});

test("Warden real hidden links distinguish attacked XX from apparently healthy ZZ with required cooperation", { timeout: 30000 }, async (t) => {
  t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP"));
  for (const scenario of ["ideal", "z"]) {
    const fn = await python(t, scenario);
    const api = createSecurityExperiments(fn("open"), fn("run"), fn("close"), { selected: true });
    const link = await api.open();
    assert.equal("attack" in link, false);
    let s = w.attachLink(w.enterSecurity({ ...createInitialState(), currentLevel: 2, vaultFragments: 2 }), link);
    async function sample(a, b, allocation = 1) {
      s = w.commitSecurity(w.chooseSecurity(s, "alice", a, allocation), "alice");
      s = w.commitSecurity(w.chooseSecurity(s, "bob", b), "bob");
      s = w.beginSecurity(s);
      const result = await api.run(w.securityRequest(s));
      assert.equal("attack" in result, false);
      s = w.receiveSecurity(s, result, s.trial);
      assert.throws(() => w.judgeSecurity(s, "trust"));
      s = w.exchangeSecurity(s, "alice", a === "X" ? "1" : "0");
      assert.throws(() => w.judgeSecurity(s, "trust"));
      s = w.exchangeSecurity(s, "bob", b === "X" ? "1" : "0");
      return result;
    }
    const zz = await sample("Z", "Z");
    assert.equal(zz.qber, 0);
    s = w.judgeSecurity(s, "trust");
    assert.equal(s.result.correct, false, "ZZ alone must not certify security");
    s = w.nextSecurity(s);
    const xx = await sample("X", "X", 2);
    assert.ok(scenario === "z" ? xx.qber > 0.4 && xx.qber < 0.6 : xx.qber === 0);
    s = w.judgeSecurity(s, scenario === "z" ? "reject" : "trust");
    assert.equal(s.completed, true);
    assert.equal(s.game.vaultFragments, 3);
    assert.equal(s.game.bellPairs, 9);
    s = w.resetSecurity(s);
    const mismatch = await sample("X", "Z");
    assert.equal(mismatch.qber, null);
    s = w.judgeSecurity(s, "insufficient");
    assert.equal(s.result.correct, true);
    assert.equal(s.game.vaultFragments, 3);
    s = w.nextSecurity(s);
    const before = { ...s.game };
    await assert.rejects(api.run({ config: { link_id: s.link_id, basis_a: "Y", basis_b: "X" }, shots: 1024 }), /bases/);
    assert.deepEqual(s.game, before);
    await api.close(s.link_id);
    await assert.rejects(api.run({ config: { link_id: s.link_id }, shots: 1024 }), /closed or expired/);
  }
});
