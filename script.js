// =========================
// DOM References
// =========================
const clockTimeElement = document.getElementById("clock-time");
const clockDateElement = document.getElementById("clock-date");

const linksGridElement = document.getElementById("links-grid");
const linksEmptyStateElement = document.getElementById("links-empty-state");
const linkFormElement = document.getElementById("link-form");
const linkTitleInput = document.getElementById("link-title");
const linkUrlInput = document.getElementById("link-url");
const linkSubmitButton = document.getElementById("link-submit");
const linkCancelButton = document.getElementById("link-cancel");
const linkMessageElement = document.getElementById("link-message");

const taskFormElement = document.getElementById("task-form");
const taskInputElement = document.getElementById("task-input");
const taskMessageElement = document.getElementById("task-message");
const taskListElement = document.getElementById("task-list");
const tasksEmptyStateElement = document.getElementById("tasks-empty-state");

const notesInputElement = document.getElementById("notes-input");
const notesStatusElement = document.getElementById("notes-status");

const backgroundOptionButtons = Array.from(
  document.querySelectorAll("[data-background-id]"),
);
const backgroundStatusElement = document.getElementById("background-status");
const customBackgroundInputElement = document.getElementById("custom-background-input");
const customBackgroundStatusElement = document.getElementById("custom-background-status");
const customBackgroundClearButton = document.getElementById("custom-background-clear");
const customBackgroundUseButton = document.getElementById("custom-background-use");

const settingsPanelElement = document.querySelector(".settings-panel");
const settingsSummaryHintElement = document.querySelector(".settings-summary__hint");
const settingsActionButtons = Array.from(
  document.querySelectorAll("[data-reset-action]"),
);
const settingsStatusElement = document.getElementById("settings-status");

// =========================
// Constants
// =========================
const STORAGE_KEYS = {
  links: "dashboard.links",
  tasks: "dashboard.tasks",
  note: "dashboard.note",
  background: "dashboard.background",
};

const CUSTOM_BACKGROUND_ID = "custom-image";
const CUSTOM_BACKGROUND_MAX_BYTES = 1500000;

const BACKGROUND_OPTIONS = [
  { id: "linen-gradient", label: "Linen" },
  { id: "mist-gradient", label: "Mist" },
  { id: "slate-gradient", label: "Slate" },
  { id: "paper-drift", label: "Paper Drift" },
  { id: "sky-veil", label: "Sky Veil" },
];

const DEFAULT_BACKGROUND_ID = BACKGROUND_OPTIONS[0].id;

// =========================
// In-Memory State
// =========================
const state = {
  links: {
    items: [],
    editingId: null,
  },
  tasks: {
    items: [],
  },
  note: {
    lastSavedContent: "",
    saveTimer: null,
  },
  background: {
    selectedId: DEFAULT_BACKGROUND_ID,
    customImage: null,
  },
};

// =========================
// Storage Helpers
// =========================
const storageArea =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : null;

if (!storageArea) {
  console.warn(
    "New Tab Dashboard: chrome.storage.local is not available. Saved links, tasks, notes, and backgrounds will not persist after reload.",
  );
}

// Read one value from chrome.storage.local.
async function readStoredValue(key, fallbackValue) {
  if (!storageArea) {
    return fallbackValue;
  }

  try {
    const result = await storageArea.get(key);
    return result[key] === undefined ? fallbackValue : result[key];
  } catch (error) {
    console.warn(`New Tab Dashboard: failed to read ${key} from storage.`, error);
    return fallbackValue;
  }
}

// Write one value to chrome.storage.local.
async function writeStoredValue(key, value) {
  if (!storageArea) {
    return false;
  }

  try {
    await storageArea.set({ [key]: value });
    return true;
  } catch (error) {
    console.warn(`New Tab Dashboard: failed to save ${key} to storage.`, error);
    return false;
  }
}

// =========================
// Shared Utilities
// =========================
function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setStatus(element, message, type = "idle") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.state = type;
}

function normalizeUrl(inputValue) {
  const rawValue = inputValue.trim();

  if (!rawValue) {
    return null;
  }

  const attempts = rawValue.includes("://")
    ? [rawValue]
    : [rawValue, `https://${rawValue}`];

  for (const attempt of attempts) {
    try {
      const parsed = new URL(attempt);

      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch {
      // Try the next version of the URL.
    }
  }

  return null;
}

function formatDisplayUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// =========================
// Clock
// =========================
function formatClockParts(date) {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return { time, dateText };
}

function renderClock() {
  if (!clockTimeElement || !clockDateElement) {
    return;
  }

  const { time, dateText } = formatClockParts(new Date());

  clockTimeElement.textContent = time;
  clockDateElement.textContent = dateText;
}

// =========================
// Favourite Links
// =========================
function setLinkMessage(message, type = "info") {
  setStatus(linkMessageElement, message, type);
}

function resetLinkForm(clearMessage = false) {
  linkFormElement?.reset();
  state.links.editingId = null;

  if (linkSubmitButton) {
    linkSubmitButton.textContent = "Add link";
  }

  if (linkCancelButton) {
    linkCancelButton.hidden = true;
  }

  if (clearMessage) {
    setLinkMessage("");
  }
}

function startEditingLink(link) {
  if (!linkTitleInput || !linkUrlInput) {
    return;
  }

  state.links.editingId = link.id;
  linkTitleInput.value = link.title;
  linkUrlInput.value = link.url;

  if (linkSubmitButton) {
    linkSubmitButton.textContent = "Save changes";
  }

  if (linkCancelButton) {
    linkCancelButton.hidden = false;
  }

  setLinkMessage("Editing link. Update the fields and save your changes.");
  linkTitleInput.focus();
}

async function loadSavedLinks() {
  const storedLinks = await readStoredValue(STORAGE_KEYS.links, []);

  state.links.items = Array.isArray(storedLinks)
    ? storedLinks
        .filter((link) => link && typeof link.id === "string")
        .map((link) => {
          const title = String(link.title || "").trim();
          const url = normalizeUrl(String(link.url || ""));

          if (!title || !url) {
            return null;
          }

          return {
            id: link.id,
            title,
            url,
          };
        })
        .filter(Boolean)
    : [];
}

async function persistLinks() {
  await writeStoredValue(STORAGE_KEYS.links, state.links.items);
}

function openLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

async function deleteLink(id) {
  const nextLinks = state.links.items.filter((link) => link.id !== id);

  if (nextLinks.length === state.links.items.length) {
    return;
  }

  state.links.items = nextLinks;

  if (state.links.editingId === id) {
    resetLinkForm(true);
  }

  await persistLinks();
  renderLinks();
  setLinkMessage("Link deleted.", "success");
}

function renderLinks() {
  if (!linksGridElement || !linksEmptyStateElement) {
    return;
  }

  linksGridElement.innerHTML = "";

  if (state.links.items.length === 0) {
    linksEmptyStateElement.hidden = false;
    return;
  }

  linksEmptyStateElement.hidden = true;

  for (const link of state.links.items) {
    const card = document.createElement("article");
    card.className = "saved-link-card";
    card.dataset.linkCard = "true";
    card.dataset.linkId = link.id;
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Open ${link.title}`);

    card.innerHTML = `
      <div class="saved-link-card__content">
        <h3 class="saved-link-card__title">${escapeHtml(link.title)}</h3>
        <p class="saved-link-card__url">${escapeHtml(formatDisplayUrl(link.url))}</p>
      </div>
      <div class="saved-link-card__actions">
        <button class="link-action" type="button" data-link-action="edit">Edit</button>
        <button class="link-action link-action--danger" type="button" data-link-action="delete">Delete</button>
      </div>
    `;

    linksGridElement.appendChild(card);
  }
}

async function handleLinkFormSubmit(event) {
  event.preventDefault();

  if (!linkTitleInput || !linkUrlInput) {
    return;
  }

  const title = linkTitleInput.value.trim();
  const url = normalizeUrl(linkUrlInput.value);

  if (!title) {
    setLinkMessage("Please enter a title for the link.", "error");
    linkTitleInput.focus();
    return;
  }

  if (!url) {
    setLinkMessage(
      "That URL does not look valid. Try something like https://example.com.",
      "error",
    );
    linkUrlInput.focus();
    return;
  }

  const editingIndex = state.links.items.findIndex(
    (link) => link.id === state.links.editingId,
  );

  if (editingIndex >= 0) {
    state.links.items[editingIndex] = {
      ...state.links.items[editingIndex],
      title,
      url,
    };
    setLinkMessage("Link updated.", "success");
  } else {
    state.links.items = [
      {
        id: createId("link"),
        title,
        url,
      },
      ...state.links.items,
    ];
    setLinkMessage("Link saved.", "success");
  }

  await persistLinks();
  renderLinks();
  resetLinkForm(true);
}

function handleLinksGridClick(event) {
  const actionButton = event.target.closest("[data-link-action]");
  const cardElement = event.target.closest("[data-link-card]");

  if (!cardElement) {
    return;
  }

  const linkId = cardElement.dataset.linkId;
  const link = state.links.items.find((item) => item.id === linkId);

  if (!link) {
    return;
  }

  if (actionButton) {
    event.preventDefault();
    event.stopPropagation();

    const action = actionButton.dataset.linkAction;

    if (action === "edit") {
      startEditingLink(link);
    } else if (action === "delete") {
      const shouldDelete = window.confirm(`Delete "${link.title}"?`);

      if (shouldDelete) {
        void deleteLink(link.id);
      }
    }

    return;
  }

  openLink(link.url);
}

function handleLinksGridKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const cardElement = event.target.closest("[data-link-card]");

  if (!cardElement || event.target.closest("[data-link-action]")) {
    return;
  }

  event.preventDefault();

  const linkId = cardElement.dataset.linkId;
  const link = state.links.items.find((item) => item.id === linkId);

  if (link) {
    openLink(link.url);
  }
}

async function initFavouriteLinks() {
  if (!linksGridElement || !linksEmptyStateElement || !linkFormElement) {
    return;
  }

  await loadSavedLinks();
  renderLinks();

  linkFormElement.addEventListener("submit", handleLinkFormSubmit);
  linkCancelButton?.addEventListener("click", resetLinkForm);
  linksGridElement.addEventListener("click", handleLinksGridClick);
  linksGridElement.addEventListener("keydown", handleLinksGridKeydown);
}

// =========================
// To-Do List
// =========================
function setTaskMessage(message, type = "info") {
  setStatus(taskMessageElement, message, type);
}

async function loadSavedTasks() {
  const storedTasks = await readStoredValue(STORAGE_KEYS.tasks, []);

  state.tasks.items = Array.isArray(storedTasks)
    ? storedTasks
        .filter((task) => task && typeof task.id === "string")
        .map((task) => {
          const text = String(task.text || "").trim();

          if (!text) {
            return null;
          }

          return {
            id: task.id,
            text,
            completed: Boolean(task.completed),
          };
        })
        .filter(Boolean)
    : [];
}

async function persistTasks() {
  await writeStoredValue(STORAGE_KEYS.tasks, state.tasks.items);
}

function resetTaskForm(clearMessage = false) {
  taskFormElement?.reset();

  if (clearMessage) {
    setTaskMessage("");
  }

  taskInputElement?.focus();
}

function renderTasks() {
  if (!taskListElement || !tasksEmptyStateElement) {
    return;
  }

  taskListElement.innerHTML = "";

  if (state.tasks.items.length === 0) {
    tasksEmptyStateElement.hidden = false;
    return;
  }

  tasksEmptyStateElement.hidden = true;

  for (const task of state.tasks.items) {
    const taskId = `task-checkbox-${task.id}`;
    const item = document.createElement("li");
    item.className = task.completed ? "task-item is-complete" : "task-item";
    item.dataset.taskId = task.id;

    item.innerHTML = `
      <div class="task-item__main">
        <input
          class="task-checkbox"
          id="${escapeHtml(taskId)}"
          type="checkbox"
          data-task-action="toggle"
          data-task-id="${escapeHtml(task.id)}"
          ${task.completed ? "checked" : ""}
        />
        <label class="task-label" for="${escapeHtml(taskId)}">
          <span class="task-text">${escapeHtml(task.text)}</span>
        </label>
      </div>
      <button class="task-delete" type="button" data-task-action="delete" data-task-id="${escapeHtml(task.id)}">
        Delete
      </button>
    `;

    taskListElement.appendChild(item);
  }
}

async function handleTaskFormSubmit(event) {
  event.preventDefault();

  if (!taskInputElement) {
    return;
  }

  const text = taskInputElement.value.trim();

  if (!text) {
    setTaskMessage("Please enter a task before adding it.", "error");
    taskInputElement.focus();
    return;
  }

  state.tasks.items = [
    {
      id: createId("task"),
      text,
      completed: false,
    },
    ...state.tasks.items,
  ];

  await persistTasks();
  renderTasks();
  setTaskMessage("");
  resetTaskForm();
}

async function toggleTaskCompletion(taskId, completed) {
  const task = state.tasks.items.find((item) => item.id === taskId);

  if (!task) {
    return;
  }

  task.completed = completed;

  await persistTasks();
  renderTasks();
}

async function deleteTask(taskId) {
  const nextTasks = state.tasks.items.filter((task) => task.id !== taskId);

  if (nextTasks.length === state.tasks.items.length) {
    return;
  }

  state.tasks.items = nextTasks;

  await persistTasks();
  renderTasks();
}

function handleTaskListChange(event) {
  const actionElement = event.target.closest("[data-task-action='toggle']");

  if (!actionElement) {
    return;
  }

  void toggleTaskCompletion(actionElement.dataset.taskId, actionElement.checked);
}

function handleTaskListClick(event) {
  const actionElement = event.target.closest("[data-task-action='delete']");

  if (!actionElement) {
    return;
  }

  const shouldDelete = window.confirm("Delete this task?");

  if (shouldDelete) {
    void deleteTask(actionElement.dataset.taskId);
  }
}

async function initTodoList() {
  if (!taskFormElement || !taskListElement || !tasksEmptyStateElement) {
    return;
  }

  await loadSavedTasks();
  renderTasks();

  taskFormElement.addEventListener("submit", handleTaskFormSubmit);
  taskListElement.addEventListener("change", handleTaskListChange);
  taskListElement.addEventListener("click", handleTaskListClick);
}

// =========================
// Quick Notes
// =========================
function setNoteStatus(message, type = "idle") {
  setStatus(notesStatusElement, message, type);
}

async function loadSavedNote() {
  if (!notesInputElement) {
    return;
  }

  if (!storageArea) {
    setNoteStatus("Autosave unavailable.", "error");
    return;
  }

  const savedContent = await readStoredValue(STORAGE_KEYS.note, "");

  notesInputElement.value = typeof savedContent === "string" ? savedContent : "";
  state.note.lastSavedContent = notesInputElement.value;
  setNoteStatus(
    notesInputElement.value ? "Saved locally." : "Start typing to create a note.",
    "saved",
  );
}

async function persistNote(force = false) {
  if (!notesInputElement || !storageArea) {
    return;
  }

  const content = notesInputElement.value;

  if (!force && content === state.note.lastSavedContent) {
    setNoteStatus(content ? "Saved locally." : "Start typing to create a note.", "saved");
    return;
  }

  const saved = await writeStoredValue(STORAGE_KEYS.note, content);

  if (saved) {
    state.note.lastSavedContent = content;
    setNoteStatus(content ? "Saved locally." : "Note cleared.", "saved");
  } else {
    setNoteStatus("Note could not be saved.", "error");
  }

  state.note.saveTimer = null;
}

// Debounce means we wait for a short pause before saving, so typing stays fast.
function scheduleNoteAutosave() {
  if (!notesInputElement) {
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

async function initNotes() {
  if (!notesInputElement || !notesStatusElement) {
    return;
  }

  await loadSavedNote();

  notesInputElement.addEventListener("input", handleNotesInput);
  notesInputElement.addEventListener("blur", handleNotesBlur);
  window.addEventListener("beforeunload", flushNoteAutosave);
}

// =========================
// Background Presets
// =========================
function setBackgroundStatus(message, type = "idle") {
  setStatus(backgroundStatusElement, message, type);
}

function isKnownBackground(backgroundId) {
  return BACKGROUND_OPTIONS.some((option) => option.id === backgroundId);
}

function hasCustomBackground() {
  return Boolean(state.background.customImage && state.background.customImage.dataUrl);
}

function getPresetBackgroundLabel(backgroundId) {
  const option = BACKGROUND_OPTIONS.find((item) => item.id === backgroundId);
  return option ? option.label : "Linen";
}

function applyPresetBackgroundStyles(backgroundId) {
  if (!document.body) {
    return;
  }

  document.body.dataset.background = backgroundId;
  document.body.style.removeProperty("--page-bg-image");
  document.body.style.removeProperty("--page-overlay");
}

function applyCustomBackgroundStyles(dataUrl) {
  if (!document.body) {
    return;
  }

  document.body.dataset.background = CUSTOM_BACKGROUND_ID;
  document.body.style.setProperty("--page-bg-image", `url(${JSON.stringify(dataUrl)})`);
  document.body.style.setProperty(
    "--page-overlay",
    [
      "linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(248, 250, 252, 0.32))",
      "radial-gradient(circle at top left, rgba(255, 255, 255, 0.24), transparent 42%)",
      "radial-gradient(circle at bottom right, rgba(148, 163, 184, 0.14), transparent 40%)",
    ].join(", "),
  );
}

function renderBackgroundSelection() {
  const customImageActive = state.background.selectedId === CUSTOM_BACKGROUND_ID && hasCustomBackground();

  if (customImageActive && state.background.customImage) {
    applyCustomBackgroundStyles(state.background.customImage.dataUrl);
  } else {
    const activeBackgroundId = isKnownBackground(state.background.selectedId)
      ? state.background.selectedId
      : DEFAULT_BACKGROUND_ID;

    if (state.background.selectedId !== activeBackgroundId) {
      state.background.selectedId = activeBackgroundId;
    }

    applyPresetBackgroundStyles(activeBackgroundId);
  }

  for (const button of backgroundOptionButtons) {
    const isSelected = button.dataset.backgroundId === state.background.selectedId && !customImageActive;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  if (customBackgroundUseButton) {
    customBackgroundUseButton.hidden = !hasCustomBackground() || customImageActive;
  }

  if (customBackgroundClearButton) {
    customBackgroundClearButton.hidden = !hasCustomBackground();
  }

  if (!hasCustomBackground()) {
    setStatus(customBackgroundStatusElement, "No custom image uploaded yet.", "idle");
  } else if (customImageActive) {
    setStatus(customBackgroundStatusElement, "Custom image is active.", "saved");
  } else {
    setStatus(
      customBackgroundStatusElement,
      "Custom image is saved. Use it again or remove it.",
      "saved",
    );
  }
}

function applyBackgroundSelection(backgroundId) {
  const nextBackgroundId = isKnownBackground(backgroundId) ? backgroundId : DEFAULT_BACKGROUND_ID;

  state.background.selectedId = nextBackgroundId;
  renderBackgroundSelection();

  if (storageArea) {
    setBackgroundStatus(`Using ${getPresetBackgroundLabel(nextBackgroundId)}. Saved automatically.`, "saved");
  } else {
    setBackgroundStatus(
      `Using ${getPresetBackgroundLabel(nextBackgroundId)}. Changes won't persist.`,
      "error",
    );
  }
}

async function loadSavedBackground() {
  if (!backgroundStatusElement) {
    return;
  }

  const fallbackBackground = {
    selectedId: DEFAULT_BACKGROUND_ID,
    customImage: null,
  };
  const savedBackground = await readStoredValue(STORAGE_KEYS.background, fallbackBackground);

  if (typeof savedBackground === "string") {
    state.background.selectedId = isKnownBackground(savedBackground)
      ? savedBackground
      : DEFAULT_BACKGROUND_ID;
    state.background.customImage = null;
  } else if (savedBackground && typeof savedBackground === "object") {
    const storedCustomImage =
      savedBackground.customImage &&
      typeof savedBackground.customImage.dataUrl === "string" &&
      typeof savedBackground.customImage.name === "string"
        ? {
            dataUrl: savedBackground.customImage.dataUrl,
            name: savedBackground.customImage.name,
            type: String(savedBackground.customImage.type || ""),
            size: Number(savedBackground.customImage.size || 0),
          }
        : null;

    state.background.customImage = storedCustomImage;
    state.background.selectedId =
      savedBackground.selectedId === CUSTOM_BACKGROUND_ID && storedCustomImage
        ? CUSTOM_BACKGROUND_ID
        : isKnownBackground(savedBackground.selectedId)
          ? savedBackground.selectedId
          : DEFAULT_BACKGROUND_ID;
  } else {
    state.background.selectedId = DEFAULT_BACKGROUND_ID;
    state.background.customImage = null;
  }

  renderBackgroundSelection();
  const activeLabel =
    state.background.selectedId === CUSTOM_BACKGROUND_ID && hasCustomBackground()
      ? "Custom image"
      : getPresetBackgroundLabel(state.background.selectedId);

  setBackgroundStatus(
    storageArea
      ? `Using ${activeLabel}. Saved automatically.`
      : `Using ${activeLabel}. Changes won't persist.`,
    storageArea ? "saved" : "error",
  );
}

async function persistBackground() {
  return writeStoredValue(STORAGE_KEYS.background, {
    selectedId: state.background.selectedId,
    customImage: state.background.customImage,
  });
}

async function handleBackgroundSelection(event) {
  const button = event.target.closest("[data-background-id]");

  if (!button) {
    return;
  }

  applyBackgroundSelection(button.dataset.backgroundId);
  const saved = await persistBackground();

  if (!saved) {
    setBackgroundStatus("Background could not be saved.", "error");
  }
}

function clearCustomBackgroundSelection() {
  if (!hasCustomBackground()) {
    return;
  }

  state.background.customImage = null;

  if (state.background.selectedId === CUSTOM_BACKGROUND_ID) {
    state.background.selectedId = DEFAULT_BACKGROUND_ID;
  }

  renderBackgroundSelection();
}

function useCustomBackgroundSelection() {
  if (!hasCustomBackground()) {
    return;
  }

  state.background.selectedId = CUSTOM_BACKGROUND_ID;
  renderBackgroundSelection();
}

function handleCustomBackgroundFileError(message) {
  setStatus(customBackgroundStatusElement, message, "error");
  if (customBackgroundInputElement) {
    customBackgroundInputElement.value = "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file."));
    };

    reader.readAsDataURL(file);
  });
}

async function handleCustomBackgroundFileChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];

  if (!file) {
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    handleCustomBackgroundFileError("Please choose a valid image file.");
    return;
  }

  if (file.size > CUSTOM_BACKGROUND_MAX_BYTES) {
    handleCustomBackgroundFileError("That image is too large. Please use a file under 1.5 MB.");
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);

    if (!dataUrl) {
      handleCustomBackgroundFileError("That image could not be loaded.");
      return;
    }

    state.background.customImage = {
      dataUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    };
    state.background.selectedId = CUSTOM_BACKGROUND_ID;

    renderBackgroundSelection();
    if (customBackgroundInputElement) {
      customBackgroundInputElement.value = "";
    }

    const saved = await persistBackground();

    if (saved) {
      setBackgroundStatus("Using custom image. Saved automatically.", "saved");
      setStatus(customBackgroundStatusElement, "Custom image saved locally.", "saved");
    } else {
      handleCustomBackgroundFileError("The image could not be saved locally.");
      setBackgroundStatus("Custom image could not be saved locally.", "error");
    }
  } catch (error) {
    console.warn("New Tab Dashboard: failed to load custom background image.", error);
    handleCustomBackgroundFileError("That image could not be loaded.");
  }
}

async function handleCustomBackgroundClear() {
  if (!hasCustomBackground()) {
    return;
  }

  const shouldRemove = window.confirm(
    "Remove the custom background image and revert to presets?",
  );

  if (!shouldRemove) {
    return;
  }

  clearCustomBackgroundSelection();
  const saved = await persistBackground();
  if (saved) {
    setBackgroundStatus(
      `Using ${getPresetBackgroundLabel(state.background.selectedId)}. Saved automatically.`,
      "saved",
    );
    setStatus(customBackgroundStatusElement, "Custom image removed.", "saved");
  } else {
    setBackgroundStatus("Custom image could not be removed from storage.", "error");
    setStatus(customBackgroundStatusElement, "Custom image removal could not be saved.", "error");
  }
}

async function handleCustomBackgroundUse() {
  if (!hasCustomBackground()) {
    return;
  }

  useCustomBackgroundSelection();
  const saved = await persistBackground();
  if (saved) {
    setBackgroundStatus("Using custom image. Saved automatically.", "saved");
  } else {
    setBackgroundStatus("Custom image could not be saved.", "error");
  }
}

async function initBackgrounds() {
  if (!backgroundOptionButtons.length || !backgroundStatusElement) {
    return;
  }

  renderBackgroundSelection();
  await loadSavedBackground();

  for (const button of backgroundOptionButtons) {
    button.addEventListener("click", handleBackgroundSelection);
  }

  customBackgroundInputElement?.addEventListener("change", handleCustomBackgroundFileChange);
  customBackgroundClearButton?.addEventListener("click", handleCustomBackgroundClear);
  customBackgroundUseButton?.addEventListener("click", handleCustomBackgroundUse);
}

// =========================
// Compact Settings
// =========================
function updateSettingsSummaryHint() {
  if (!settingsPanelElement || !settingsSummaryHintElement) {
    return;
  }

  settingsSummaryHintElement.textContent = settingsPanelElement.open
    ? "Close settings"
    : "Open settings";
}

function setSettingsStatus(message, type = "idle") {
  setStatus(settingsStatusElement, message, type);
}

function confirmResetAction(label) {
  return window.confirm(`Reset ${label}? This will remove the saved data for this section.`);
}

async function resetFavouriteLinks() {
  if (!confirmResetAction("favourite links")) {
    return;
  }

  state.links.items = [];
  resetLinkForm(true);
  await persistLinks();
  renderLinks();
  setSettingsStatus("Favourite links reset.", "saved");
}

async function resetTodoList() {
  if (!confirmResetAction("the to-do list")) {
    return;
  }

  state.tasks.items = [];
  await persistTasks();
  renderTasks();
  setSettingsStatus("To-do list reset.", "saved");
}

async function clearNotes() {
  if (!confirmResetAction("notes")) {
    return;
  }

  if (state.note.saveTimer !== null) {
    clearTimeout(state.note.saveTimer);
    state.note.saveTimer = null;
  }

  if (notesInputElement) {
    notesInputElement.value = "";
  }

  state.note.lastSavedContent = "";
  await persistNote(true);
  setNoteStatus("Notes cleared.", "saved");
  setSettingsStatus("Notes cleared.", "saved");
}

async function resetBackground() {
  if (!confirmResetAction("the background")) {
    return;
  }

  state.background.customImage = null;
  state.background.selectedId = DEFAULT_BACKGROUND_ID;

  if (customBackgroundInputElement) {
    customBackgroundInputElement.value = "";
  }

  renderBackgroundSelection();
  const saved = await persistBackground();
  setSettingsStatus("Background reset.", "saved");

  if (!saved) {
    setSettingsStatus("Background could not be reset in storage.", "error");
  }
}

function handleSettingsAction(event) {
  const actionButton = event.target.closest("[data-reset-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.resetAction;

  if (action === "links") {
    void resetFavouriteLinks();
  } else if (action === "tasks") {
    void resetTodoList();
  } else if (action === "notes") {
    void clearNotes();
  } else if (action === "background") {
    void resetBackground();
  }
}

function initSettings() {
  if (!settingsPanelElement || !settingsSummaryHintElement || !settingsActionButtons.length) {
    return;
  }

  updateSettingsSummaryHint();
  settingsPanelElement.addEventListener("toggle", updateSettingsSummaryHint);

  for (const button of settingsActionButtons) {
    button.addEventListener("click", handleSettingsAction);
  }
}

// =========================
// Boot
// =========================
renderClock();
setInterval(renderClock, 1000);

void initFavouriteLinks();
void initTodoList();
void initNotes();
void initBackgrounds();
initSettings();
