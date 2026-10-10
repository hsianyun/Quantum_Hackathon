export function renderAlice(session) {
  const busy = session.running || Boolean(session.result);
  const locked = session.committed.alice;
  document.getElementById("alice-gate-group").disabled = locked || busy;
  document.querySelectorAll('input[name="alice-gate"]').forEach((input) => {
    input.checked = input.value === session.gate;
  });
  document.getElementById("circuit-gate").textContent = session.gate || "?";
  document.getElementById("circuit-status").textContent = locked ? "PREPARATION COMMITTED" : "GATE MISSING";
  document.getElementById("alice-basis-group").disabled = !locked || busy;
  document.querySelectorAll('input[name="alice-basis"]').forEach((input) => {
    input.checked = input.value === session.bases.alice;
  });
  const button = document.getElementById("alice-commit");
  button.disabled = locked || busy || !session.gate;
  button.textContent = locked ? "Preparation committed" : "Commit gate";
  document.getElementById("alice-hint").textContent = !locked
    ? "Choose a gate. Committing locks it for this trial."
    : !session.bases.alice ? "Gate locked. Now select your measurement basis."
    : `Gate ${session.gate} committed. Measurement basis: ${session.bases.alice}.`;
  document.querySelector(".alice-room").classList.toggle("is-committed", locked);
}
