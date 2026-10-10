export function renderBob(session) {
  const locked = session.committed.bob || session.running || Boolean(session.result);
  document.getElementById("bob-prediction-group").disabled = locked;
  document.getElementById("bob-basis-group").disabled = locked || !session.prediction;
  for (const group of ["basis", "prediction"]) {
    document.querySelectorAll(`input[name="bob-${group}"]`).forEach((input) => {
      input.checked = input.value === (group === "basis" ? session.bases.bob : session.prediction);
    });
  }
  const button = document.getElementById("bob-commit");
  button.disabled = locked || !session.prediction || !session.bases.bob;
  button.textContent = session.committed.bob ? "Prediction committed" : "Commit prediction & basis";
  document.getElementById("bob-hint").textContent = session.committed.bob
    ? `Committed: ${session.prediction} outcomes in ${session.bases.bob}.`
    : "Make your prediction before the receiver opens.";
  document.querySelector(".bob-room").classList.toggle("is-committed", session.committed.bob);
}
