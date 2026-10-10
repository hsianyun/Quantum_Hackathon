# Split Vault tasks

## Completed foundation

- [x] Create the flat repository scaffold, limited to 90 project files.
- [x] Implement and test Bell preparation and X/Z measurements.
- [x] Implement and test teleportation with selectable corrections.
- [x] Add JSON experiment APIs while preserving Python circuit APIs.
- [x] Add pure game state, resources, advancement, and checkpoint reset.
- [x] Build responsive Alice/Bob rooms, notebook, and binary classical channel.
- [x] Implement Bell Lock gate choices, staged commitments, and hidden results.
- [x] Add histogram verification, one-time fragment rewards, and a locked explanation.
- [x] Consolidate all frontend styles into Qollab's automatically loaded `main.css`.

## Qollab runtime fix

- [x] Read the supplied JavaScript guide and the runtime/import documentation.
- [x] Import `bell_experiment` statically from `api` in `main.js`.
- [x] Await `.callPromisingKwargs(...)` and unpack Python dictionaries with `.toJs()`.
- [x] Pass Qollab's selected backend to Python; keep quantum calculations in Python.
- [x] Preserve ideal local simulation when Python callers omit the optional backend.
- [x] Remove the HTTP fallback, global Pyodide assumption, server script, and HTTP tests.
- [x] Preserve error details and avoid spending resources on failed experiments.
- [x] Verify the async bridge contract and real backend execution without a server.
- [x] Update README and AGENTS.md, including the repeated-trial backend limitation.
- [x] Remove the duplicated layout/file-limit section from AGENTS.md.
- [ ] Verify the updated project in Qollab's hosted runtime.

Verification: **39 Python tests, 31 JavaScript unit tests, and one server-free
integration test pass**. Real Qiskit circuits run across all 16 preparation-gate
and basis combinations on a supplied BasicSimulator. The integration test sends
committed JavaScript game inputs to Python over a test-only stdio adapter and
feeds returned results into the game. Invalid gates and backend failures propagate
without HTTP fallback, fabricated results, or resource spending. The JavaScript
adapter tests cover the async proxy contract, conversion, cleanup, and retries.
The stdio adapter substitutes for Qollab's call boundary; it is not a hosted run.

Run the project through **Qollab > Run Project > local simulator > Run**.
Local simulators support repeated trials in the same run. IonQ backends permit
one job per Run. The app has no server startup step or application HTTP endpoint.
The project has 39 root-level files, below the 90-file limit.

Unit tests: `python -m unittest discover -v` and `npm test`.
Integration check: `npm run test:integration` (requires Python/Qiskit).

## Remaining quantum modules

- [ ] Implement and test Warden mechanics, then connect its API wrapper.
- [ ] Implement and test QFT utilities and period finding, then connect the period API.

No later levels or multiplayer networking have been added.
