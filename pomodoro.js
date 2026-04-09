import { dom } from "./dom.js";
import {
  formatDuration,
  getTodayKey,
  escapeHtml,
  POMODORO_MODES,
  readStoredValue,
  setStatus,
  storageArea,
  STORAGE_KEYS,
  writeStoredValue,
} from "./shared.js";
import { state } from "./state.js";
import { getTaskFromDragData } from "./tasks.js";

function setPomodoroStatus(message, type = "idle") {
  setStatus(dom.pomodoroStatusElement, message, type);
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
    .filter(
      (session) =>
        session &&
        typeof session.label === "string" &&
        typeof session.completedAt === "string",
    )
    .map((session) => ({
      label: session.label.trim() || getPomodoroFallbackLabel("work"),
      completedAt: session.completedAt,
    }))
    .filter((session) => session.label.length > 0);
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
export async function maybeResetPomodoroForNewDay() {
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
  if (!dom.pomodoroStatusElement) {
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
  if (!dom.pomodoroSessionListElement || !dom.pomodoroEmptyStateElement) {
    return;
  }

  dom.pomodoroSessionListElement.innerHTML = "";

  if (state.pomodoro.completedSessions.length === 0) {
    dom.pomodoroEmptyStateElement.hidden = false;
    return;
  }

  dom.pomodoroEmptyStateElement.hidden = true;

  for (const session of state.pomodoro.completedSessions) {
    const item = document.createElement("li");
    item.className = "pomodoro-session-item";
    item.innerHTML = `
      <p class="pomodoro-session-item__label">${escapeHtml(session.label)}</p>
      <p class="pomodoro-session-item__time">${escapeHtml(session.completedAt)}</p>
    `;
    dom.pomodoroSessionListElement.appendChild(item);
  }
}

// Keep the mode buttons in sync with the current timer mode.
function renderPomodoroModeButtons() {
  for (const button of dom.pomodoroModeButtons) {
    const isSelected = button.dataset.pomodoroMode === state.pomodoro.mode;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function renderPomodoro() {
  if (
    !dom.pomodoroCurrentModeElement ||
    !dom.pomodoroRemainingElement ||
    !dom.pomodoroSessionLabelElement ||
    !dom.pomodoroLabelInput
  ) {
    return;
  }

  const modeDefinition = getPomodoroModeDefinition(state.pomodoro.mode);

  if (dom.pomodoroCardElement) {
    dom.pomodoroCardElement.classList.toggle("is-running", state.pomodoro.isRunning);
    dom.pomodoroCardElement.classList.toggle("is-drag-over", state.pomodoro.isDragOver);
    dom.pomodoroCardElement.dataset.state = state.pomodoro.isRunning ? "running" : "paused";
  }

  renderPomodoroModeButtons();

  dom.pomodoroCurrentModeElement.textContent = modeDefinition.label;
  dom.pomodoroRemainingElement.textContent = formatDuration(state.pomodoro.remainingSeconds);
  dom.pomodoroSessionLabelElement.textContent = getPomodoroDisplayLabel();
  dom.pomodoroLabelInput.placeholder = modeDefinition.fallbackLabel;

  if (dom.pomodoroLabelInput.value !== state.pomodoro.sessionLabel) {
    dom.pomodoroLabelInput.value = state.pomodoro.sessionLabel;
  }

  if (dom.pomodoroStartButton) {
    dom.pomodoroStartButton.disabled = state.pomodoro.isRunning;
    dom.pomodoroStartButton.setAttribute("aria-busy", String(state.pomodoro.isRunning));
    dom.pomodoroStartButton.textContent = state.pomodoro.isRunning ? "Running" : "Start";
  }

  if (dom.pomodoroPauseButton) {
    dom.pomodoroPauseButton.disabled = !state.pomodoro.isRunning;
    dom.pomodoroPauseButton.textContent = state.pomodoro.isRunning ? "Pause" : "Paused";
  }

  if (dom.pomodoroResetButton) {
    dom.pomodoroResetButton.disabled = false;
  }

  if (dom.pomodoroNextBreakElement) {
    dom.pomodoroNextBreakElement.textContent = `Next suggested break: ${getUpcomingBreakLabel()}`;
  }

  if (dom.pomodoroCompletedCountElement) {
    dom.pomodoroCompletedCountElement.textContent = `Completed today: ${state.pomodoro.completedWorkCount}`;
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

  const currentLabel = dom.pomodoroLabelInput ? dom.pomodoroLabelInput.value : state.pomodoro.sessionLabel;
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
  state.pomodoro.sessionLabel = dom.pomodoroLabelInput ? dom.pomodoroLabelInput.value : "";
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
  if (!event.dataTransfer || !dom.pomodoroCardElement) {
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
  if (!dom.pomodoroCardElement) {
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

export function startPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId !== null) {
    clearInterval(state.ui.pomodoroTickIntervalId);
  }

  state.ui.pomodoroTickIntervalId = window.setInterval(tickPomodoroTimer, 1000);
}

export function stopPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId === null) {
    return;
  }

  clearInterval(state.ui.pomodoroTickIntervalId);
  state.ui.pomodoroTickIntervalId = null;
}

export async function initPomodoro() {
  if (
    !dom.pomodoroCardElement ||
    !dom.pomodoroCurrentModeElement ||
    !dom.pomodoroRemainingElement ||
    !dom.pomodoroSessionLabelElement ||
    !dom.pomodoroLabelInput ||
    !dom.pomodoroStartButton ||
    !dom.pomodoroPauseButton ||
    !dom.pomodoroResetButton
  ) {
    return;
  }

  await loadSavedPomodoro();

  if (!state.ui.pomodoroListenersBound) {
    for (const button of dom.pomodoroModeButtons) {
      button.addEventListener("click", handlePomodoroModeClick);
    }

    dom.pomodoroStartButton.addEventListener("click", () => {
      void handlePomodoroStart();
    });
    dom.pomodoroPauseButton.addEventListener("click", () => {
      void handlePomodoroPause();
    });
    dom.pomodoroResetButton.addEventListener("click", () => {
      void handlePomodoroReset();
    });
    dom.pomodoroLabelInput.addEventListener("input", handlePomodoroLabelInput);
    dom.pomodoroCardElement.addEventListener("dragenter", handlePomodoroDragEnter);
    dom.pomodoroCardElement.addEventListener("dragover", handlePomodoroDragOver);
    dom.pomodoroCardElement.addEventListener("dragleave", handlePomodoroDragLeave);
    dom.pomodoroCardElement.addEventListener("drop", handlePomodoroDrop);
    state.ui.pomodoroListenersBound = true;
  }
}
