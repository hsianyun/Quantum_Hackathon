/** Server-free contract check with real Qiskit; run via npm run test:integration. */
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createBellExperiment } from "./quantum-client.js";
import { createSession, chooseGate, commitAlice, chooseBasis, choosePrediction, commitBob,
  beginExperiment, experimentRequest, finishExperiment, failExperiment } from "./level-one.js";

test("committed choices reach real Python/Qiskit and return to the game without HTTP", { timeout: 30000 }, async (t) => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const localPython = fileURLToPath(new URL(process.platform === "win32"
    ? "./.venv/Scripts/python.exe" : "./.venv/bin/python", import.meta.url));
  const python = process.env.SPLIT_VAULT_PYTHON || (existsSync(localPython) ? localPython : "python");
  // A stdio test adapter substitutes only for Qollab's JSPI call boundary.
  // Python owns the backend, circuits, sampling, statistics and diagnostics.
  const source = `
import json, sys
from api import bell_experiment
from qiskit.providers.basic_provider import BasicSimulator
backend = BasicSimulator()
for line in sys.stdin:
    try:
        result = bell_experiment(**json.loads(line), backend=backend)
    except Exception as error:
        result = {"error": str(error)}
    print(json.dumps(result, allow_nan=False), flush=True)
`;
  const child = spawn(python, ["-u", "-c", source], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  let launchError;
  child.on("error", (error) => { launchError = error; });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const exited = new Promise((resolve) => { child.once("exit", resolve); child.once("error", resolve); });
  const lines = createInterface({ input: child.stdout });
  const replies = lines[Symbol.asyncIterator]();
  t.after(async () => { child.stdin.end(); await exited; lines.close(); });
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No application server or network request is allowed"));
  const selectedBackend = Object.freeze({ name: "Python BasicSimulator" });
  let calls = 0;
  const run = createBellExperiment({ callPromisingKwargs: async (a, b, shots, options) => {
    assert.equal(options.backend, selectedBackend);
    calls++;
    child.stdin.write(JSON.stringify({ basis_a: a, basis_b: b, shots, preparation_gate: options.preparation_gate }) + "\n");
    const reply = await replies.next();
    assert.equal(reply.done, false, launchError?.message || stderr || "Python stopped unexpectedly");
    const result = JSON.parse(reply.value);
    if (result.error) throw new Error(result.error);
    return { toJs: () => result };
  } }, selectedBackend);

  for (const gate of ["H", "X", "Z", "S"]) {
    for (const [a, b] of [["Z", "Z"], ["X", "X"], ["X", "Z"], ["Z", "X"]]) {
      const callsBeforeCommit = calls;
      let session = commitAlice(chooseGate(createSession(), gate));
      session = chooseBasis(session, "alice", a);
      // This is a test oracle, never game-layer answer mapping.
      const prediction = a === "Z" && b === "Z" || gate === "H" && a === b ? "correlated" : "random";
      session = commitBob(chooseBasis(choosePrediction(session, prediction), "bob", b));
      session = beginExperiment(session);
      assert.equal(session.result, null);
      assert.equal(calls, callsBeforeCommit);
      const result = await run(experimentRequest(session));
      const done = finishExperiment(session, result, session.trial);
      assert.equal(done.result.correlation_type, prediction);
      assert.equal(done.result.solved, gate === "H");
      assert.equal(done.game.vaultFragments, gate === "H" ? 1 : 0);
      assert.equal(done.game.bellPairs, 11);
      assert.equal(Object.values(result.counts).reduce((sum, n) => sum + n, 0), 1024);
    }
  }
  assert.equal(calls, 16);
  let pending = commitAlice(chooseGate(createSession(), "H"));
  pending = chooseBasis(pending, "alice", "Z");
  pending = beginExperiment(commitBob(chooseBasis(choosePrediction(pending, "correlated"), "bob", "Z")));
  await assert.rejects(run({ ...experimentRequest(pending), preparation_gate: "Y" }), /Preparation gate.*No resources were spent/);
  const failed = failExperiment(pending, pending.trial);
  assert.equal(failed.game.bellPairs, 12);
  assert.equal(failed.game.vaultFragments, 0);
  assert.equal(failed.result, null);
  assert.equal(fetch.mock.callCount(), 0);
});
