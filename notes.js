import { dom } from "./dom.js";
import { readStoredValue, storageArea, writeStoredValue, STORAGE_KEYS, setStatus } from "./shared.js";
import { state } from "./state.js";

function setNoteStatus(message, type = "idle") {
  setStatus(dom.notesStatusElement, message, type);
}

async function loadSavedNote() {
  if (!dom.notesInputElement) {
    return;
  }

  if (!storageArea) {
    setNoteStatus("Autosave unavailable.", "error");
    return;
  }

  const savedContent = await readStoredValue(STORAGE_KEYS.note, "");

  dom.notesInputElement.value = typeof savedContent === "string" ? savedContent : "";
  state.note.lastSavedContent = dom.notesInputElement.value;
  setNoteStatus(
    dom.notesInputElement.value ? "Saved locally." : "Start typing to create a note.",
    "saved",
  );
}

async function persistNote(force = false) {
  if (!dom.notesInputElement || !storageArea) {
    return false;
  }

  const content = dom.notesInputElement.value;

  if (!force && content === state.note.lastSavedContent) {
    setNoteStatus(content ? "Saved locally." : "Start typing to create a note.", "saved");
    return true;
  }

  const saved = await writeStoredValue(STORAGE_KEYS.note, content);

  if (saved) {
    state.note.lastSavedContent = content;
    setNoteStatus(content ? "Saved locally." : "Note cleared.", "saved");
  } else {
    setNoteStatus("Note could not be saved.", "error");
  }

  state.note.saveTimer = null;
  return saved;
}

// Debounce means we wait for a short pause before saving, so typing stays fast.
function scheduleNoteAutosave() {
  if (!dom.notesInputElement) {
    return;
  }

  if (!storageArea) {
    setNoteStatus("Autosave unavailable.", "error");
    return;
  }

  setNoteStatus("Saving...", "saving");

  if (state.note.saveTimer !== null) {
    clearTimeout(state.note.saveTimer);
  }

  state.note.saveTimer = window.setTimeout(() => {
    void persistNote();
  }, 500);
}

function flushNoteAutosave() {
  if (state.note.saveTimer !== null) {
    clearTimeout(state.note.saveTimer);
    state.note.saveTimer = null;
  }

  void persistNote();
}

function handleNotesInput() {
  scheduleNoteAutosave();
}

function handleNotesBlur() {
  flushNoteAutosave();
}

export async function clearNotes() {
  if (state.note.saveTimer !== null) {
    clearTimeout(state.note.saveTimer);
    state.note.saveTimer = null;
  }

  if (dom.notesInputElement) {
    dom.notesInputElement.value = "";
  }

  state.note.lastSavedContent = "";
  const saved = await persistNote(true);
  setNoteStatus(saved ? "Notes cleared." : "Notes cleared locally only.", saved ? "saved" : "error");
  return saved;
}

export async function initNotes() {
  if (!dom.notesInputElement || !dom.notesStatusElement) {
    return;
  }

  await loadSavedNote();

  dom.notesInputElement.addEventListener("input", handleNotesInput);
  dom.notesInputElement.addEventListener("blur", handleNotesBlur);
  window.addEventListener("beforeunload", flushNoteAutosave);
}
