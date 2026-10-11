/** Qollab Python bridge. No network requests or quantum calculations here. */
export function createBellExperiment(pythonExperiment, quantumBackend) {
  return async function bellExperiment(request) {
    let result;
    try {
      if (typeof pythonExperiment?.callPromisingKwargs !== "function") {
        throw new Error("Qollab's asynchronous Python bridge is unavailable. Run the project as JS / Qiskit on Qollab");
      }
      if (!quantumBackend) {
        throw new Error("Qollab's selected backend is unavailable. Choose a simulator in Run Project");
      }
      result = await pythonExperiment.callPromisingKwargs(
        request.basis_a, request.basis_b, request.shots,
        { preparation_gate: request.preparation_gate, backend: quantumBackend },
      );
      // Qollab proxies and raw Pyodide dictionaries become plain nested objects.
      return typeof result?.toJs === "function"
        ? result.toJs({ dict_converter: Object.fromEntries }) : result;
    } catch (error) {
      throw new Error(`Python experiment failed: ${error?.message || String(error)}. No resources were spent.`, { cause: error });
    } finally {
      // Imported functions/backends are reused; only the returned proxy is owned here.
      result?.destroy?.();
    }
  };
}

/** Generic async JSON conversion; no HTTP transport or simulator fallback. */
export async function callPython(pythonFunction, args, kwargs = {}) {
  let result;
  try {
    if (typeof pythonFunction?.callPromisingKwargs !== "function") throw new Error("Qollab's asynchronous Python bridge is unavailable");
    result = await pythonFunction.callPromisingKwargs(...args, kwargs);
    return typeof result?.toJs === "function" ? result.toJs({ dict_converter: Object.fromEntries }) : result;
  } catch (error) {
    throw new Error(`Python experiment failed: ${error?.message || error}. No new experiment resources were spent.`, { cause: error });
  } finally {
    result?.destroy?.();
  }
}
export function createCalibrationExperiments(prepare, finish, cancel, backend) {
  return {
    prepare: (request) => {
      if (!backend) return Promise.reject(new Error("Choose a local simulator in Qollab's Run dialog."));
      return callPython(prepare, [request.state_name, request.operation], { backend });
    },
    finish: (request) => callPython(finish, [request.trial_id, request.correction]),
    cancel: (trial_id) => callPython(cancel, [trial_id]),
  };
}
export function createSecurityExperiments(open, experiment, close, backend) {
  return {
    open: () => callPython(open, []),
    run: ({ config, shots }) => {
      if (!backend) return Promise.reject(new Error("Qollab's selected backend is unavailable."));
      // Plain JS objects become JsProxy, not dict, in the Python bridge.
      return callPython(experiment, [JSON.stringify(config), shots], { backend });
    },
    close: (link_id) => callPython(close, [link_id]),
  };
}
export function createQftExperiment(experiment, backend) {
  return ({ config, shots }) => {
    if (!backend) return Promise.reject(new Error("Qollab's selected backend is unavailable."));
    return callPython(experiment, [JSON.stringify(config), shots], { backend });
  };
}

export function createRadioExperiments(open, measure, commit, verify, discard, close, backend) {
  return {
    open: mode => callPython(open, [mode]),
    measure: ({ scenario_id, predictions, shots }) => {
      if (!backend) return Promise.reject(new Error("Choose a local simulator in Qollab's Run dialog."));
      return callPython(measure, [scenario_id, JSON.stringify(predictions), shots], { backend });
    },
    commit: (trial_id, observations, phases) => callPython(commit, [trial_id, observations, phases]),
    verify: (trial_id, bob_period) => callPython(verify, bob_period === undefined ? [trial_id] : [trial_id, bob_period]),
    discard: trial_id => callPython(discard, [trial_id]),
    close: scenario_id => callPython(close, [scenario_id]),
  };
}
