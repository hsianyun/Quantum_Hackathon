# Split Vault development instructions

Split Vault is a two-player asymmetric quantum escape-room game.

## Technology
- Frontend: HTML, CSS, vanilla JavaScript.
- Quantum logic: Python and Qiskit.
- Target deployment: Qollab.
- Put all frontend styles in root-level `main.css`, which Qollab automatically
  loads. Local HTML must reference `./main.css`; do not require another stylesheet
  or CSS `@import` for the interface to render correctly.
- Avoid unnecessary frameworks unless required.
- Quantum algorithms must be real Qiskit circuits, not fake random outputs.

## Qollab runtime
- Qollab runs the frontend JavaScript entry point. Python modules are called
  from JavaScript through Qollab's Python bridge; they are not standalone services.
- Do not require `server.py`, Flask, FastAPI, localhost ports, or `/api/...` HTTP
  endpoints for gameplay. Do not fall back to HTTP when a Python import fails.
- Keep circuit construction, simulation, and quantum statistics in Python.
  JavaScript calls the Python experiment API and converts returned data to plain
  JSON-compatible values for the game/UI.
- Follow the documented Qollab Python-import syntax and calling convention.
  Surface import/execution errors without spending game resources or revealing
  answers. Test the JavaScript-to-Python path without a running application server.
- Statically import root-level Python modules by module name, for example
  `import { bell_experiment } from "api"`; do not use a `.py` path, default import,
  dynamic `import()`, or assume a global `pyodide` object is exposed.
- Call project Python functions with `.callPromising(...)` or
  `.callPromisingKwargs(...args, { kwargs })`, await the result, then use `.toJs()`
  to unpack returned dictionaries. `.callKwargs()` is not the asynchronous bridge.
- Pass Qollab's injected `backend` to Python when an experiment uses a device.
  Do not create a replacement backend that ignores the Run dialog's selection.
  Use a local simulator for repeated in-page trials; IonQ permits one job per Run.
- Reference: https://qollab.xyz/learn/building-your-first-qollab-project/run-in-javascript
  and https://qollab.xyz/learn/docs/runtime-environment#importing-your-own-files.

## Qollab layout and file limit
- Keep all project source, tests, assets, documentation, and configuration files
  directly in the project root. Qollab uploads must not contain project subfolders.
- Do not create more than **90 project files in total**. Before creating files,
  count the existing project files and ensure the resulting total stays at or below 90.
- The limit includes Python, JavaScript, HTML, CSS, tests, images, documentation,
  and configuration files. Update existing files where practical.
- Generated `__pycache__` directories may remain in subfolders and must not be uploaded.
  Local Git metadata, virtual environments, and dependency caches (`.git`, `.venv`,
  `.uv-cache`) are not project/upload files; do not flatten or upload their contents.
- Use root-level Python imports (for example, `from bell import prepare_bell`)
  and JavaScript imports (for example, `./state.js`). Keep test commands and
  documentation aligned with this flat structure.

## Game design
There are two roles:
- Alice: prepares/operates quantum systems.
- Bob: interprets measurements and performs recovery/decoding.

Both players must perform quantum-computing reasoning in each major level.

The main gameplay loop is:

Predict -> Act -> Exchange -> Verify

Never reveal the correct answer before the player commits.

## Quantum modules
Keep quantum code independent of UI code.

bell.py:
- Bell-state preparation
- X/Z-basis measurement

teleport.py:
- arbitrary single-qubit state preparation
- teleportation
- configurable Pauli correction
- fidelity verification

warden.py:
- ideal Bell pairs
- intercepted/measured pairs
- optional noise
- QBER/statistics

qft.py:
- QFT and inverse QFT utilities
- periodic-state experiments

period.py:
- N=15 toy period finding
- begin with a=2, period r=4

<!-- ## Testing requirements
Every quantum module must have automated tests.

Examples:
- Bell state ZZ correlations near 100%.
- Bell state XX correlations near 100%.
- Correct teleportation correction gives fidelity near 1.
- Wrong correction should fail for at least some input states.
- N=15, a=2 produces the expected period-4 measurement structure.

Do not implement new game levels until the corresponding quantum test passes. -->
