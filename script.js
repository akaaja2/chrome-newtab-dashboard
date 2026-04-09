// =========================
// DOM References
// =========================
const clockTimeElement = document.getElementById("clock-time");
const clockDateElement = document.getElementById("clock-date");

const pomodoroCardElement = document.querySelector(".pomodoro-card");
const pomodoroModeButtons = Array.from(
  document.querySelectorAll("[data-pomodoro-mode]"),
);
const pomodoroCurrentModeElement = document.getElementById("pomodoro-current-mode");
const pomodoroRemainingElement = document.getElementById("pomodoro-remaining");
const pomodoroSessionLabelElement = document.getElementById("pomodoro-session-label");
const pomodoroLabelInput = document.getElementById("pomodoro-label-input");
const pomodoroStartButton = document.getElementById("pomodoro-start");
const pomodoroPauseButton = document.getElementById("pomodoro-pause");
const pomodoroResetButton = document.getElementById("pomodoro-reset");
const pomodoroNextBreakElement = document.getElementById("pomodoro-next-break");
const pomodoroCompletedCountElement = document.getElementById("pomodoro-completed-count");
const pomodoroSessionListElement = document.getElementById("pomodoro-session-list");
const pomodoroEmptyStateElement = document.getElementById("pomodoro-empty-state");
const pomodoroStatusElement = document.getElementById("pomodoro-status");

const dashboardLayoutElement = document.querySelector("[data-dashboard-layout]");

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
  pomodoro: "dashboard.pomodoro",
  cardOrder: "dashboard.cardOrder",
};

const CUSTOM_BACKGROUND_ID = "custom-image";
const CUSTOM_BACKGROUND_MAX_BYTES = 1500000;

const POMODORO_MODES = {
  work: {
    label: "Work session",
    duration: 25 * 60,
    fallbackLabel: "Focus session",
  },
  shortBreak: {
    label: "Short break",
    duration: 5 * 60,
    fallbackLabel: "Short break",
  },
  longBreak: {
    label: "Long break",
    duration: 15 * 60,
    fallbackLabel: "Long break",
  },
};

const BACKGROUND_OPTIONS = [
  { id: "linen-gradient", label: "Linen" },
  { id: "mist-gradient", label: "Mist" },
  { id: "slate-gradient", label: "Slate" },
  { id: "paper-drift", label: "Paper Drift" },
  { id: "sky-veil", label: "Sky Veil" },
];

const DEFAULT_BACKGROUND_ID = BACKGROUND_OPTIONS[0].id;

const DASHBOARD_CARD_ORDER = [
  "clock-card",
  "pomodoro-card",
  "links-card",
  "todo-card",
  "notes-card",
  "background-card",
  "settings-card",
];

// =========================
// In-Memory State
// =========================
const state = {
  ui: {
    todoListenersBound: false,
    pomodoroListenersBound: false,
    pomodoroTickIntervalId: null,
    dashboardLayoutListenersBound: false,
  },
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
  pomodoro: {
    mode: "work",
    remainingSeconds: POMODORO_MODES.work.duration,
    isRunning: false,
    sessionLabel: "",
    completedSessions: [],
    completedWorkCount: 0,
    lastDateKey: getTodayKey(),
    dragDepth: 0,
    isDragOver: false,
  },
  background: {
    selectedId: DEFAULT_BACKGROUND_ID,
    customImage: null,
  },
  layout: {
    cardOrder: [...DASHBOARD_CARD_ORDER],
    draggingCardId: null,
    dropTargetCardId: null,
    dropPosition: null,
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

function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}

function startPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId !== null) {
    clearInterval(state.ui.pomodoroTickIntervalId);
  }

  state.ui.pomodoroTickIntervalId = window.setInterval(tickPomodoroTimer, 1000);
}

function stopPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId === null) {
    return;
  }

  clearInterval(state.ui.pomodoroTickIntervalId);
  state.ui.pomodoroTickIntervalId = null;
}

// =========================
// Dashboard Layout
// =========================
function getDashboardCardElements() {
  if (!dashboardLayoutElement) {
    return [];
  }

  return Array.from(dashboardLayoutElement.children).filter(
    (element) =>
      element instanceof HTMLElement &&
      typeof element.dataset.dashboardCardId === "string" &&
      element.dataset.dashboardCardId.length > 0,
  );
}

function getAvailableDashboardCardIds() {
  return getDashboardCardElements()
    .map((cardElement) => cardElement.dataset.dashboardCardId)
    .filter((cardId) => typeof cardId === "string" && cardId.length > 0);
}

// The saved order is built from known card IDs, then any new cards are appended
// so older saved layouts keep working when the dashboard grows later.
function normalizeDashboardCardOrder(savedOrder, availableCardIds = getAvailableDashboardCardIds()) {
  const availableCardSet = new Set(availableCardIds);
  const seenCardIds = new Set();
  const normalizedOrder = [];
  const savedCardIds = Array.isArray(savedOrder) ? savedOrder : [];

  for (const rawCardId of savedCardIds) {
    const cardId = String(rawCardId || "").trim();

    if (!cardId || seenCardIds.has(cardId) || !availableCardSet.has(cardId)) {
      continue;
    }

    seenCardIds.add(cardId);
    normalizedOrder.push(cardId);
  }

  for (const cardId of DASHBOARD_CARD_ORDER) {
    if (availableCardSet.has(cardId) && !seenCardIds.has(cardId)) {
      seenCardIds.add(cardId);
      normalizedOrder.push(cardId);
    }
  }

  for (const cardId of availableCardIds) {
    if (!seenCardIds.has(cardId)) {
      seenCardIds.add(cardId);
      normalizedOrder.push(cardId);
    }
  }

  return normalizedOrder;
}

function updateDashboardDragClasses() {
  for (const cardElement of getDashboardCardElements()) {
    const cardId = cardElement.dataset.dashboardCardId;
    const isDragging = cardId === state.layout.draggingCardId;
    const isDropTarget = cardId === state.layout.dropTargetCardId;

    cardElement.classList.toggle("is-dragging", isDragging);
    cardElement.classList.toggle("is-drop-target", isDropTarget);

    if (isDropTarget && state.layout.dropPosition) {
      cardElement.dataset.dropPosition = state.layout.dropPosition;
    } else {
      cardElement.removeAttribute("data-drop-position");
    }
  }
}

function clearDashboardDragState() {
  state.layout.draggingCardId = null;
  state.layout.dropTargetCardId = null;
  state.layout.dropPosition = null;
  updateDashboardDragClasses();
}

function setDashboardDropTarget(cardId, dropPosition) {
  state.layout.dropTargetCardId = cardId;
  state.layout.dropPosition = dropPosition;
  updateDashboardDragClasses();
}

function getDashboardCardFromPoint(clientX, clientY) {
  if (!dashboardLayoutElement) {
    return null;
  }

  const hitElements = document.elementsFromPoint(clientX, clientY);

  for (const hitElement of hitElements) {
    if (!(hitElement instanceof Element)) {
      continue;
    }

    const cardElement = hitElement.closest("[data-dashboard-card-id]");

    if (cardElement && dashboardLayoutElement.contains(cardElement)) {
      return cardElement;
    }
  }

  let closestCard = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const cardElement of getDashboardCardElements()) {
    const rect = cardElement.getBoundingClientRect();
    const xDistance =
      clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const yDistance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = xDistance * xDistance + yDistance * yDistance;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCard = cardElement;
    }
  }

  return closestCard;
}

function getDashboardDropPosition(cardElement, clientY) {
  const rect = cardElement.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  return clientY < middleY ? "before" : "after";
}

function reorderDashboardCardOrder(cardOrder, movingCardId, targetCardId, dropPosition) {
  if (movingCardId === targetCardId) {
    return cardOrder;
  }

  const nextOrder = cardOrder.filter((cardId) => cardId !== movingCardId);
  const targetIndex = nextOrder.indexOf(targetCardId);

  if (targetIndex === -1) {
    return cardOrder;
  }

  const insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
  nextOrder.splice(insertIndex, 0, movingCardId);

  return nextOrder;
}

function haveSameCardOrder(firstOrder, secondOrder) {
  if (firstOrder === secondOrder) {
    return true;
  }

  if (!Array.isArray(firstOrder) || !Array.isArray(secondOrder)) {
    return false;
  }

  if (firstOrder.length !== secondOrder.length) {
    return false;
  }

  for (let index = 0; index < firstOrder.length; index += 1) {
    if (firstOrder[index] !== secondOrder[index]) {
      return false;
    }
  }

  return true;
}

function renderDashboardLayout() {
  if (!dashboardLayoutElement) {
    return;
  }

  const availableCards = new Map(
    getDashboardCardElements().map((cardElement) => [
      cardElement.dataset.dashboardCardId,
      cardElement,
    ]),
  );
  const nextOrder = normalizeDashboardCardOrder(state.layout.cardOrder, Array.from(availableCards.keys()));
  const fragment = document.createDocumentFragment();

  state.layout.cardOrder = nextOrder;

  for (const cardId of nextOrder) {
    const cardElement = availableCards.get(cardId);

    if (cardElement) {
      fragment.appendChild(cardElement);
    }
  }

  dashboardLayoutElement.appendChild(fragment);
  updateDashboardDragClasses();
}

async function persistDashboardLayout() {
  return writeStoredValue(STORAGE_KEYS.cardOrder, state.layout.cardOrder);
}

// Restoring the layout is just moving existing cards into the saved ID order.
async function loadSavedDashboardLayout() {
  if (!dashboardLayoutElement) {
    return;
  }

  const savedCardOrder = await readStoredValue(STORAGE_KEYS.cardOrder, []);
  state.layout.cardOrder = normalizeDashboardCardOrder(savedCardOrder);
  renderDashboardLayout();
  await persistDashboardLayout();
}

// Drag start begins from the handle so inner controls stay clickable and safe.
function handleDashboardDragStart(event) {
  if (!dashboardLayoutElement) {
    return;
  }

  const handleElement = event.target.closest("[data-dashboard-card-handle]");

  if (!handleElement || !dashboardLayoutElement.contains(handleElement)) {
    return;
  }

  const cardElement = handleElement.closest("[data-dashboard-card-id]");

  if (!cardElement || !event.dataTransfer) {
    return;
  }

  const cardId = cardElement.dataset.dashboardCardId;

  if (!cardId) {
    return;
  }

  state.layout.draggingCardId = cardId;
  state.layout.dropTargetCardId = null;
  state.layout.dropPosition = null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-newtab-card-order", cardId);
  event.dataTransfer.setData("text/plain", cardId);

  updateDashboardDragClasses();
}

// Drag over works by finding the nearest card and deciding whether the drop
// should land before or after that card based on the pointer position.
function handleDashboardDragOver(event) {
  if (!dashboardLayoutElement || !state.layout.draggingCardId || !event.dataTransfer) {
    return;
  }

  const dragTypes = Array.from(event.dataTransfer.types || []);

  if (!dragTypes.includes("application/x-newtab-card-order") && !dragTypes.includes("text/plain")) {
    return;
  }

  event.preventDefault();

  const targetCard = getDashboardCardFromPoint(event.clientX, event.clientY);

  if (!targetCard) {
    state.layout.dropTargetCardId = null;
    state.layout.dropPosition = null;
    updateDashboardDragClasses();
    return;
  }

  const targetCardId = targetCard.dataset.dashboardCardId;

  if (!targetCardId) {
    return;
  }

  const dropPosition = getDashboardDropPosition(targetCard, event.clientY);
  event.dataTransfer.dropEffect = "move";

  if (
    state.layout.dropTargetCardId === targetCardId &&
    state.layout.dropPosition === dropPosition
  ) {
    return;
  }

  setDashboardDropTarget(targetCardId, dropPosition);
  event.dataTransfer.dropEffect = "move";
}

// Drop converts the dragged card ID back into a saved order array and then
// re-renders the layout from that array so the DOM and storage stay in sync.
async function handleDashboardDrop(event) {
  event.preventDefault();

  const movingCardId = state.layout.draggingCardId;
  const targetCard = getDashboardCardFromPoint(event.clientX, event.clientY);
  const targetCardId = targetCard ? targetCard.dataset.dashboardCardId || "" : "";
  const dropPosition = targetCard ? getDashboardDropPosition(targetCard, event.clientY) : "after";

  clearDashboardDragState();

  if (!movingCardId || !targetCardId) {
    return;
  }

  const nextOrder = reorderDashboardCardOrder(
    state.layout.cardOrder,
    movingCardId,
    targetCardId,
    dropPosition,
  );

  if (haveSameCardOrder(nextOrder, state.layout.cardOrder)) {
    return;
  }

  state.layout.cardOrder = nextOrder;
  renderDashboardLayout();
  await persistDashboardLayout();
}

function handleDashboardDragEnd() {
  clearDashboardDragState();
}

async function initDashboardLayout() {
  if (!dashboardLayoutElement) {
    return;
  }

  await loadSavedDashboardLayout();

  if (state.ui.dashboardLayoutListenersBound) {
    return;
  }

  dashboardLayoutElement.addEventListener("dragstart", handleDashboardDragStart);
  dashboardLayoutElement.addEventListener("dragover", handleDashboardDragOver);
  dashboardLayoutElement.addEventListener("drop", (event) => {
    void handleDashboardDrop(event);
  });
  dashboardLayoutElement.addEventListener("dragend", handleDashboardDragEnd);
  state.ui.dashboardLayoutListenersBound = true;
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
  void maybeResetPomodoroForNewDay();
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
    item.draggable = true;
    item.setAttribute("aria-grabbed", "false");

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

function getTaskFromDragData(dataTransfer) {
  if (!dataTransfer) {
    return null;
  }

  const rawPayload =
    dataTransfer.getData("application/x-newtab-task") || dataTransfer.getData("text/plain");

  if (!rawPayload) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload);

    if (parsed && typeof parsed.text === "string") {
      return String(parsed.text).trim() || null;
    }
  } catch {
    // Fall back to plain text if the custom payload is not JSON.
  }

  return String(rawPayload).trim() || null;
}

// Each task is draggable so the user can launch it directly from the to-do list.
function handleTaskListDragStart(event) {
  const taskItem = event.target.closest("[data-task-id]");

  if (!taskItem || event.target.closest("[data-task-action]")) {
    return;
  }

  const task = state.tasks.items.find((item) => item.id === taskItem.dataset.taskId);

  if (!task || !event.dataTransfer) {
    return;
  }

  event.dataTransfer.effectAllowed = "copy";
  event.dataTransfer.setData(
    "application/x-newtab-task",
    JSON.stringify({ id: task.id, text: task.text }),
  );
  event.dataTransfer.setData("text/plain", task.text);

  taskItem.classList.add("is-dragging");
  taskItem.setAttribute("aria-grabbed", "true");
}

function handleTaskListDragEnd(event) {
  const taskItem = event.target.closest("[data-task-id]");

  if (!taskItem) {
    return;
  }

  taskItem.classList.remove("is-dragging");
  taskItem.setAttribute("aria-grabbed", "false");
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

  if (!state.ui.todoListenersBound) {
    taskFormElement.addEventListener("submit", handleTaskFormSubmit);
    taskListElement.addEventListener("change", handleTaskListChange);
    taskListElement.addEventListener("click", handleTaskListClick);
    taskListElement.addEventListener("dragstart", handleTaskListDragStart);
    taskListElement.addEventListener("dragend", handleTaskListDragEnd);
    state.ui.todoListenersBound = true;
  }
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
// Pomodoro Timer
// =========================
function setPomodoroStatus(message, type = "idle") {
  setStatus(pomodoroStatusElement, message, type);
}

function getPomodoroModeDefinition(mode) {
  return POMODORO_MODES[mode] || POMODORO_MODES.work;
}

function normalizePomodoroMode(mode) {
  return POMODORO_MODES[mode] ? mode : "work";
}

function getPomodoroModeLabel(mode) {
  return getPomodoroModeDefinition(mode).label;
}

function getPomodoroModeDuration(mode) {
  return getPomodoroModeDefinition(mode).duration;
}

function getPomodoroFallbackLabel(mode) {
  return getPomodoroModeDefinition(mode).fallbackLabel;
}

function sanitizePomodoroLabel(value) {
  return String(value || "").trim();
}

function getPomodoroDisplayLabel() {
  const label = sanitizePomodoroLabel(state.pomodoro.sessionLabel);
  return label || getPomodoroFallbackLabel(state.pomodoro.mode);
}

function getBreakModeForCompletedCount(completedCount) {
  return completedCount % 4 === 0 ? "longBreak" : "shortBreak";
}

function getUpcomingBreakMode() {
  return getBreakModeForCompletedCount(state.pomodoro.completedWorkCount + 1);
}

function getUpcomingBreakLabel() {
  return getPomodoroModeLabel(getUpcomingBreakMode());
}

function formatPomodoroCompletionTime(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function normalizePomodoroSessions(sessions) {
  if (!Array.isArray(sessions)) {
    return [];
  }

  return sessions
    .map((session) => {
      if (!session || typeof session !== "object") {
        return null;
      }

      const label = sanitizePomodoroLabel(session.label) || getPomodoroFallbackLabel("work");
      const completedAt = sanitizePomodoroLabel(session.completedAt || session.time);

      if (!completedAt) {
        return null;
      }

      return {
        label,
        completedAt,
      };
    })
    .filter(Boolean);
}

function resetPomodoroHistoryForToday() {
  const todayKey = getTodayKey();

  if (state.pomodoro.lastDateKey === todayKey) {
    return false;
  }

  state.pomodoro.completedSessions = [];
  state.pomodoro.completedWorkCount = 0;
  state.pomodoro.lastDateKey = todayKey;

  return true;
}

// If the calendar day changes, clear today's session history and save the reset state.
async function maybeResetPomodoroForNewDay() {
  if (!resetPomodoroHistoryForToday()) {
    return false;
  }

  renderPomodoro();
  const saved = await persistPomodoro();

  setPomodoroStatus(
    saved
      ? "Today's Pomodoro history was reset for the new day."
      : "Today's Pomodoro history reset locally.",
    saved ? "saved" : "error",
  );

  return true;
}

async function loadSavedPomodoro() {
  if (!pomodoroStatusElement) {
    return;
  }

  const fallbackState = {
    mode: "work",
    remainingSeconds: POMODORO_MODES.work.duration,
    isRunning: false,
    sessionLabel: "",
    completedSessions: [],
    completedWorkCount: 0,
    lastDateKey: getTodayKey(),
  };
  const savedPomodoro = await readStoredValue(STORAGE_KEYS.pomodoro, fallbackState);
  const storedObject =
    savedPomodoro && typeof savedPomodoro === "object" ? savedPomodoro : fallbackState;
  const normalizedMode = normalizePomodoroMode(storedObject.mode);
  const modeDuration = getPomodoroModeDuration(normalizedMode);
  const storedRemainingSeconds = Number(storedObject.remainingSeconds);
  const storedCompletedWorkCount = Number(storedObject.completedWorkCount);

  state.pomodoro.mode = normalizedMode;
  state.pomodoro.remainingSeconds = Number.isFinite(storedRemainingSeconds)
    ? Math.min(modeDuration, Math.max(0, Math.floor(storedRemainingSeconds)))
    : modeDuration;
  state.pomodoro.isRunning = Boolean(storedObject.isRunning);
  state.pomodoro.sessionLabel = String(storedObject.sessionLabel || "");
  state.pomodoro.completedSessions = normalizePomodoroSessions(storedObject.completedSessions);
  state.pomodoro.completedWorkCount = Number.isFinite(storedCompletedWorkCount)
    ? Math.max(0, Math.floor(storedCompletedWorkCount))
    : 0;
  state.pomodoro.lastDateKey =
    typeof storedObject.lastDateKey === "string" && storedObject.lastDateKey
      ? storedObject.lastDateKey
      : getTodayKey();
  state.pomodoro.dragDepth = 0;
  state.pomodoro.isDragOver = false;

  // If the stored date is from a previous day, clear the old history now.
  resetPomodoroHistoryForToday();

  const wasRunningBeforeReload = state.pomodoro.isRunning;

  // Restoring a running timer across reloads is fragile, so we reopen it paused.
  if (wasRunningBeforeReload) {
    state.pomodoro.isRunning = false;
  }

  renderPomodoro();
  await persistPomodoro();

  if (wasRunningBeforeReload) {
    setPomodoroStatus("Restored as paused after reload.", "saved");
  } else if (!storageArea) {
    setPomodoroStatus("Timer state will reset after reload.", "error");
  }
}

async function persistPomodoro() {
  return writeStoredValue(STORAGE_KEYS.pomodoro, {
    mode: state.pomodoro.mode,
    remainingSeconds: state.pomodoro.remainingSeconds,
    isRunning: state.pomodoro.isRunning,
    sessionLabel: sanitizePomodoroLabel(state.pomodoro.sessionLabel),
    completedSessions: state.pomodoro.completedSessions,
    completedWorkCount: state.pomodoro.completedWorkCount,
    lastDateKey: state.pomodoro.lastDateKey,
  });
}

function renderPomodoroSessions() {
  if (!pomodoroSessionListElement || !pomodoroEmptyStateElement) {
    return;
  }

  pomodoroSessionListElement.innerHTML = "";

  if (state.pomodoro.completedSessions.length === 0) {
    pomodoroEmptyStateElement.hidden = false;
    return;
  }

  pomodoroEmptyStateElement.hidden = true;

  for (const session of state.pomodoro.completedSessions) {
    const item = document.createElement("li");
    item.className = "pomodoro-session-item";
    item.innerHTML = `
      <p class="pomodoro-session-item__label">${escapeHtml(session.label)}</p>
      <p class="pomodoro-session-item__time">${escapeHtml(session.completedAt)}</p>
    `;
    pomodoroSessionListElement.appendChild(item);
  }
}

// Keep the mode buttons in sync with the current timer mode.
function renderPomodoroModeButtons() {
  for (const button of pomodoroModeButtons) {
    const isSelected = button.dataset.pomodoroMode === state.pomodoro.mode;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function renderPomodoro() {
  if (
    !pomodoroCurrentModeElement ||
    !pomodoroRemainingElement ||
    !pomodoroSessionLabelElement ||
    !pomodoroLabelInput
  ) {
    return;
  }

  const modeDefinition = getPomodoroModeDefinition(state.pomodoro.mode);

  if (pomodoroCardElement) {
    pomodoroCardElement.classList.toggle("is-running", state.pomodoro.isRunning);
    pomodoroCardElement.classList.toggle("is-drag-over", state.pomodoro.isDragOver);
    pomodoroCardElement.dataset.state = state.pomodoro.isRunning ? "running" : "paused";
  }

  renderPomodoroModeButtons();

  pomodoroCurrentModeElement.textContent = modeDefinition.label;
  pomodoroRemainingElement.textContent = formatDuration(state.pomodoro.remainingSeconds);
  pomodoroSessionLabelElement.textContent = getPomodoroDisplayLabel();
  pomodoroLabelInput.placeholder = modeDefinition.fallbackLabel;

  if (pomodoroLabelInput.value !== state.pomodoro.sessionLabel) {
    pomodoroLabelInput.value = state.pomodoro.sessionLabel;
  }

  if (pomodoroStartButton) {
    pomodoroStartButton.disabled = state.pomodoro.isRunning;
    pomodoroStartButton.setAttribute("aria-busy", String(state.pomodoro.isRunning));
    pomodoroStartButton.textContent = state.pomodoro.isRunning ? "Running" : "Start";
  }

  if (pomodoroPauseButton) {
    pomodoroPauseButton.disabled = !state.pomodoro.isRunning;
    pomodoroPauseButton.textContent = state.pomodoro.isRunning ? "Pause" : "Paused";
  }

  if (pomodoroResetButton) {
    pomodoroResetButton.disabled = false;
  }

  if (pomodoroNextBreakElement) {
    pomodoroNextBreakElement.textContent = `Next suggested break: ${getUpcomingBreakLabel()}`;
  }

  if (pomodoroCompletedCountElement) {
    pomodoroCompletedCountElement.textContent = `Completed today: ${state.pomodoro.completedWorkCount}`;
  }

  renderPomodoroSessions();

  if (state.pomodoro.isDragOver) {
    setPomodoroStatus("Drop a task here to start a work session.", "saved");
  } else if (state.pomodoro.isRunning) {
    setPomodoroStatus(`Running ${modeDefinition.label}.`, "saved");
  } else {
    setPomodoroStatus(`Paused on ${modeDefinition.label}.`, "idle");
  }
}

async function setPomodoroMode(mode, options = {}) {
  const nextMode = normalizePomodoroMode(mode);
  const shouldClearLabel = Boolean(options.clearLabel);
  const wasRunning = state.pomodoro.isRunning;

  state.pomodoro.mode = nextMode;
  state.pomodoro.remainingSeconds = getPomodoroModeDuration(nextMode);
  state.pomodoro.isRunning = false;

  if (shouldClearLabel) {
    state.pomodoro.sessionLabel = "";
  }

  renderPomodoro();
  const saved = await persistPomodoro();

  setPomodoroStatus(
    saved
      ? `Switched to ${getPomodoroModeLabel(nextMode)}${wasRunning ? " and paused." : "."}`
      : `Switched to ${getPomodoroModeLabel(nextMode)}${wasRunning ? " and paused locally." : ". Changes won't persist."}`,
    saved ? "saved" : "error",
  );
}

async function handlePomodoroModeClick(event) {
  const button = event.target.closest("[data-pomodoro-mode]");

  if (!button) {
    return;
  }

  await setPomodoroMode(button.dataset.pomodoroMode);
}

async function handlePomodoroStart() {
  if (state.pomodoro.isRunning) {
    return;
  }

  const currentLabel = pomodoroLabelInput ? pomodoroLabelInput.value : state.pomodoro.sessionLabel;
  const cleanedLabel = sanitizePomodoroLabel(currentLabel);

  state.pomodoro.sessionLabel = cleanedLabel;

  if (state.pomodoro.remainingSeconds <= 0) {
    state.pomodoro.remainingSeconds = getPomodoroModeDuration(state.pomodoro.mode);
  }

  state.pomodoro.isRunning = true;
  renderPomodoro();

  const saved = await persistPomodoro();
  setPomodoroStatus(
    saved
      ? `Running ${getPomodoroModeLabel(state.pomodoro.mode)}.`
      : `Running ${getPomodoroModeLabel(state.pomodoro.mode)} locally only.`,
    saved ? "saved" : "error",
  );
}

async function handlePomodoroPause() {
  if (!state.pomodoro.isRunning) {
    return;
  }

  state.pomodoro.isRunning = false;
  renderPomodoro();

  const saved = await persistPomodoro();
  setPomodoroStatus(
    saved
      ? `Paused on ${getPomodoroModeLabel(state.pomodoro.mode)}.`
      : `Paused on ${getPomodoroModeLabel(state.pomodoro.mode)} locally only.`,
    saved ? "saved" : "error",
  );
}

async function handlePomodoroReset() {
  state.pomodoro.remainingSeconds = getPomodoroModeDuration(state.pomodoro.mode);
  state.pomodoro.isRunning = false;
  renderPomodoro();

  const saved = await persistPomodoro();
  setPomodoroStatus(
    saved
      ? `${getPomodoroModeLabel(state.pomodoro.mode)} reset to ${formatDuration(state.pomodoro.remainingSeconds)}.`
      : `${getPomodoroModeLabel(state.pomodoro.mode)} reset locally only.`,
    saved ? "saved" : "error",
  );
}

function handlePomodoroLabelInput() {
  state.pomodoro.sessionLabel = pomodoroLabelInput ? pomodoroLabelInput.value : "";
  renderPomodoro();
  void persistPomodoro();
}

async function completePomodoroSession() {
  const completedMode = state.pomodoro.mode;
  const completedLabel = getPomodoroDisplayLabel();

  // When a work session ends, log it, pick the next break, and pause so the user can decide what to do next.
  if (completedMode === "work") {
    state.pomodoro.completedSessions = [
      {
        label: completedLabel,
        completedAt: formatPomodoroCompletionTime(),
      },
      ...state.pomodoro.completedSessions,
    ];
    state.pomodoro.completedWorkCount += 1;
  }

  const nextMode =
    completedMode === "work"
      ? getBreakModeForCompletedCount(state.pomodoro.completedWorkCount)
      : "work";

  state.pomodoro.mode = nextMode;
  state.pomodoro.remainingSeconds = getPomodoroModeDuration(nextMode);
  state.pomodoro.isRunning = false;
  state.pomodoro.sessionLabel = "";
  state.pomodoro.isDragOver = false;
  state.pomodoro.dragDepth = 0;

  renderPomodoro();
  const saved = await persistPomodoro();

  if (completedMode === "work") {
    setPomodoroStatus(
      saved
        ? `Work session complete. Next suggested break: ${getPomodoroModeLabel(nextMode)}.`
        : `Work session complete. Next suggested break: ${getPomodoroModeLabel(nextMode)} locally only.`,
      saved ? "saved" : "error",
    );
  } else {
    setPomodoroStatus(
      saved
        ? "Break complete. Ready for the next work session."
        : "Break complete locally only.",
      saved ? "saved" : "error",
    );
  }
}

// The countdown runs once per second while the timer is active.
function tickPomodoroTimer() {
  if (state.pomodoro.isRunning) {
    if (state.pomodoro.remainingSeconds <= 0) {
      void completePomodoroSession();
      return;
    }

    state.pomodoro.remainingSeconds -= 1;
    renderPomodoro();
    void persistPomodoro();
    return;
  }

  if (state.pomodoro.lastDateKey !== getTodayKey()) {
    void maybeResetPomodoroForNewDay();
  }
}

async function startPomodoroFromTask(taskText) {
  const label = sanitizePomodoroLabel(taskText);

  if (!label) {
    return;
  }

  state.pomodoro.mode = "work";
  state.pomodoro.remainingSeconds = POMODORO_MODES.work.duration;
  state.pomodoro.sessionLabel = label;
  state.pomodoro.isRunning = true;
  state.pomodoro.isDragOver = false;
  state.pomodoro.dragDepth = 0;

  renderPomodoro();
  const saved = await persistPomodoro();

  setPomodoroStatus(
    saved
      ? `Started work session for ${label}.`
      : `Started work session for ${label} locally only.`,
    saved ? "saved" : "error",
  );
}

function clearPomodoroDragState() {
  state.pomodoro.isDragOver = false;
  state.pomodoro.dragDepth = 0;
  renderPomodoro();
}

// Drag-and-drop uses the task text as a quick way to launch a focused work session.
function handlePomodoroDragEnter(event) {
  if (!event.dataTransfer || !pomodoroCardElement) {
    return;
  }

  const hasTextPayload =
    Array.from(event.dataTransfer.types || []).includes("text/plain") ||
    Array.from(event.dataTransfer.types || []).includes("application/x-newtab-task");

  if (!hasTextPayload) {
    return;
  }

  state.pomodoro.dragDepth += 1;

  if (state.pomodoro.dragDepth === 1) {
    state.pomodoro.isDragOver = true;
    renderPomodoro();
  }
}

function handlePomodoroDragOver(event) {
  if (!pomodoroCardElement) {
    return;
  }

  event.preventDefault();

  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function handlePomodoroDragLeave() {
  if (state.pomodoro.dragDepth > 0) {
    state.pomodoro.dragDepth -= 1;
  }

  if (state.pomodoro.dragDepth <= 0) {
    clearPomodoroDragState();
  }
}

function handlePomodoroDrop(event) {
  event.preventDefault();

  const taskText = getTaskFromDragData(event.dataTransfer);

  clearPomodoroDragState();

  if (!taskText) {
    return;
  }

  void startPomodoroFromTask(taskText);
}

async function initPomodoro() {
  if (
    !pomodoroCardElement ||
    !pomodoroCurrentModeElement ||
    !pomodoroRemainingElement ||
    !pomodoroSessionLabelElement ||
    !pomodoroLabelInput ||
    !pomodoroStartButton ||
    !pomodoroPauseButton ||
    !pomodoroResetButton
  ) {
    return;
  }

  await loadSavedPomodoro();

  if (!state.ui.pomodoroListenersBound) {
    for (const button of pomodoroModeButtons) {
      button.addEventListener("click", handlePomodoroModeClick);
    }

    pomodoroStartButton.addEventListener("click", () => {
      void handlePomodoroStart();
    });
    pomodoroPauseButton.addEventListener("click", () => {
      void handlePomodoroPause();
    });
    pomodoroResetButton.addEventListener("click", () => {
      void handlePomodoroReset();
    });
    pomodoroLabelInput.addEventListener("input", handlePomodoroLabelInput);
    pomodoroCardElement.addEventListener("dragenter", handlePomodoroDragEnter);
    pomodoroCardElement.addEventListener("dragover", handlePomodoroDragOver);
    pomodoroCardElement.addEventListener("dragleave", handlePomodoroDragLeave);
    pomodoroCardElement.addEventListener("drop", handlePomodoroDrop);
    state.ui.pomodoroListenersBound = true;
  }
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
startPomodoroTicker();
window.addEventListener("beforeunload", stopPomodoroTicker);

void initDashboardLayout();
void initFavouriteLinks();
void initTodoList();
void initNotes();
void initPomodoro();
void initBackgrounds();
initSettings();
