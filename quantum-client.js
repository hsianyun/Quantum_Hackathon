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
