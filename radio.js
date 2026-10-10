export function renderMessages(messages) {
  const log = document.getElementById("messages");
  if (log.dataset.count === String(messages.length)) return;
  log.dataset.count = String(messages.length);
  log.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No transmissions yet. Agree on a code with your partner.";
    log.append(empty);
  }
  for (const message of messages) {
    const row = document.createElement("p");
    row.className = `message ${message.role}-message`;
    const label = document.createElement("span");
    label.textContent = message.role === "alice" ? "ALICE → BOB" : "BOB → ALICE";
    const payload = document.createElement("code");
    payload.textContent = message.payload;
    row.append(label, payload);
    log.append(row);
  }
  log.scrollTop = log.scrollHeight;
}
export function renderNotes(notes) {
  const list = document.getElementById("notes");
  if (list.dataset.count === String(notes.length)) return;
  list.dataset.count = String(notes.length);
  list.replaceChildren();
  if (!notes.length) {
    const empty = document.createElement("li");
    empty.className = "empty-state";
    empty.textContent = "A blank page, for now. Your experiments will be recorded here.";
    list.append(empty);
  }
  for (const note of notes) {
    const row = document.createElement("li");
    const number = document.createElement("span");
    number.className = "note-number";
    number.textContent = `ENTRY ${String(note.id).padStart(2, "0")}`;
    const text = document.createElement("p");
    text.textContent = note.text;
    row.append(number, text);
    list.append(row);
  }
}
