import test from "node:test";
import assert from "node:assert/strict";
import { createBellExperiment } from "./quantum-client.js";

const request = { basis_a: "X", basis_b: "Z", shots: 1024, preparation_gate: "S" };

test("Qollab calls are awaited, forward the selected backend, and unpack Python dictionaries", async (t) => {
  const backend = Object.freeze({ selectedDevice: "test-backend" });
  const expected = { experiment: "bell", counts: { "00": 250, "01": 270, "10": 260, "11": 244 } };
  let calls = 0;
  let released = 0;
  let finished = false;
  let resolve;
  const waiting = new Promise((done) => { resolve = done; });
  const pythonExperiment = {
    callKwargs: () => assert.fail("Synchronous Python calls cannot be used"),
    destroy: () => assert.fail("Imported functions must remain usable across trials"),
    callPromisingKwargs: async (...args) => {
      calls++;
      assert.deepEqual(args, ["X", "Z", 1024, { preparation_gate: "S", backend }]);
      await waiting;
      return {
        toJs: ({ dict_converter }) => {
          assert.equal(dict_converter, Object.fromEntries);
          return { ...expected, counts: dict_converter(Object.entries(expected.counts)) };
        },
        destroy: () => { released++; },
      };
    },
  };
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("Qollab must never use HTTP"));
  const run = createBellExperiment(pythonExperiment, backend);
  const pending = run(request).then((result) => { finished = true; return result; });
  await Promise.resolve();
  assert.equal(finished, false);
  resolve();
  assert.deepEqual(await pending, expected);
  assert.deepEqual(await run(request), expected);
  assert.equal(calls, 2);
  assert.equal(released, 2);
  assert.equal(fetch.mock.callCount(), 0);
});

test("Python execution errors propagate without an HTTP or simulated fallback", async (t) => {
  const cause = new Error("Only one IonQ job is allowed per code run");
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP fallback"));
  const run = createBellExperiment({ callPromisingKwargs: async () => { throw cause; } }, {});
  await assert.rejects(run(request), (error) => {
    assert.match(error.message, /Only one IonQ job/);
    assert.match(error.message, /No resources were spent/);
    assert.doesNotMatch(error.message, /server\.py|localhost|\/api\//);
    assert.equal(error.cause, cause);
    return true;
  });
  assert.equal(fetch.mock.callCount(), 0);
});

test("missing async bridge or backend produces a Qollab-specific error", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", () => assert.fail("No HTTP fallback"));
  await assert.rejects(createBellExperiment(undefined, {})(request), /asynchronous Python bridge/);
  await assert.rejects(createBellExperiment({ callKwargs() {} }, {})(request), /asynchronous Python bridge/);
  await assert.rejects(createBellExperiment({ callPromisingKwargs() {} }, undefined)(request), /selected backend/);
  assert.equal(fetch.mock.callCount(), 0);
});

test("conversion errors release the result and allow the same Python function to be retried", async () => {
  let attempts = 0;
  let released = 0;
  const run = createBellExperiment({ callPromisingKwargs: async () => ({
    toJs: () => { if (++attempts === 1) throw new Error("Cannot unpack result"); return { status: "ok" }; },
    destroy: () => { released++; },
  }) }, {});
  await assert.rejects(run(request), /Cannot unpack result.*No resources were spent/);
  assert.deepEqual(await run(request), { status: "ok" });
  assert.equal(released, 2);
});

test("plain results work without proxy lifecycle methods", async () => {
  const expected = { status: "ok", counts: { "00": 1024 } };
  const run = createBellExperiment({ callPromisingKwargs: async () => expected }, {});
  assert.deepEqual(await run(request), expected);
});
