/** Session-local notes. This function never mutates the caller's list. */
export function addNote(notes, text) {
  const content = typeof text === "string" ? text.trim() : "";
  if (!content || content.length > 1000) throw new RangeError("Write a note between 1 and 1,000 characters.");
  return [...notes, { id: notes.length + 1, text: content }];
}
