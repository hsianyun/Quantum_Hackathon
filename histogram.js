export function renderHistogram(result) {
  const histogram = document.getElementById("histogram");
  const outcomes = ["00", "01", "10", "11"];
  histogram.classList.toggle("has-results", Boolean(result));
  histogram.querySelectorAll(".histogram-bar").forEach((bar, index) => {
    const count = result ? result.counts[outcomes[index]] : 0;
    bar.querySelector(".bar-value").textContent = result ? count : "--";
    bar.querySelector(".bar-track i").style.height = result ? `${count / result.shots * 100}%` : "0%";
  });
  histogram.setAttribute("aria-label", result
    ? `Measurement counts, Alice then Bob: ${outcomes.map((bits) => `${bits}: ${result.counts[bits]}`).join(", ")}. Agreement ${(result.agreement * 100).toFixed(1)} percent.`
    : "No measurements yet. Both players must commit before any results are available.");
  document.getElementById("receiver-state").textContent = result ? "RESULT RECEIVED" : "STANDBY";
  document.getElementById("result-caption").textContent = result
    ? `${(result.agreement * 100).toFixed(1)}% AGREEMENT / ${result.shots} SHOTS / ${result.basis_a}-${result.basis_b}`
    : "AWAITING BOTH COMMITMENTS";
}
