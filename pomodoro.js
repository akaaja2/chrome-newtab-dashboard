import { dom } from "./dom.js";
import {
  STORAGE_KEYS,
  POMODORO_MODES,
  createId,
  escapeHtml,
  formatDuration,
  getTodayKey,
  readStoredValue,
  setStatus,
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
  return state.pomodoro.currentLabel || getPomodoroFallbackLabel(state.pomodoro.mode);
}

function normalizePositiveInteger(value, fallbackValue) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallbackValue;
}

function normalizeNonNegativeInteger(value, fallbackValue) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallbackValue;
  }

  const rounded = Math.floor(parsed);
  return rounded >= 0 ? rounded : fallbackValue;
}

function normalizeTimestamp(value) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.floor(parsed);
}

function getCurrentRunningRemainingSeconds(now = Date.now()) {
  if (!state.pomodoro.isRunning || state.pomodoro.startedAtMs === null) {
    return normalizeNonNegativeInteger(state.pomodoro.remainingSeconds, 0);
  }

  const durationMs = Math.max(0, state.pomodoro.durationSeconds) * 1000;
  const elapsedMs = Math.max(0, now - state.pomodoro.startedAtMs);
  const remainingMs = Math.max(0, durationMs - elapsedMs);

  return Math.max(0, Math.ceil(remainingMs / 1000));
}

function getCurrentDisplayedRemainingSeconds(now = Date.now()) {
  if (state.pomodoro.isRunning) {
    return getCurrentRunningRemainingSeconds(now);
  }

  if (state.pomodoro.remainingSeconds > 0) {
    return normalizeNonNegativeInteger(state.pomodoro.remainingSeconds, 0);
  }

  return getPomodoroModeDuration(state.pomodoro.mode);
}

function getCurrentSessionStartTime(now = Date.now()) {
  if (state.pomodoro.isRunning && state.pomodoro.startedAtMs !== null) {
    return state.pomodoro.startedAtMs;
  }

  return now;
}

function getUpcomingBreakMode() {
  const referenceCount =
    state.pomodoro.completedWorkCount + (state.pomodoro.mode === "work" ? 1 : 0);

  if (referenceCount > 0 && referenceCount % 4 === 0) {
    return "longBreak";
  }

  return "shortBreak";
}

function getUpcomingBreakLabel() {
  return getPomodoroModeDefinition(getUpcomingBreakMode()).label;
}

function formatPomodoroCompletionTime(completedAtMs) {
  const date = new Date(completedAtMs);

  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  const timeText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${dateText} at ${timeText}`;
}

function normalizeCompletedSession(session) {
  if (!session || typeof session !== "object") {
    return null;
  }

  const mode = normalizePomodoroMode(session.mode);
  const label = sanitizePomodoroLabel(session.label || session.sessionLabel);
  const startedAtMs = normalizeTimestamp(session.startedAtMs);
  const completedAtMs = normalizeTimestamp(session.completedAtMs ?? session.completedAt);

  if (!completedAtMs) {
    return null;
  }

  return {
    id: typeof session.id === "string" && session.id ? session.id : createId("pomodoro-session"),
    label: label || getPomodoroFallbackLabel(mode),
    mode,
    startedAtMs,
    completedAtMs,
  };
}

function normalizeCompletedSessions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(normalizeCompletedSession)
    .filter(Boolean)
    .sort((left, right) => right.completedAtMs - left.completedAtMs);
}

function applyPomodoroRunningSnapshot(now = Date.now()) {
  if (!state.pomodoro.isRunning || state.pomodoro.startedAtMs === null) {
    state.pomodoro.remainingSeconds = normalizeNonNegativeInteger(
      state.pomodoro.remainingSeconds,
      getPomodoroModeDuration(state.pomodoro.mode),
    );
    return;
  }

  state.pomodoro.remainingSeconds = getCurrentRunningRemainingSeconds(now);
}

function buildPomodoroStorageValue(now = Date.now()) {
  return {
    mode: state.pomodoro.mode,
    durationSeconds: Math.max(1, normalizePositiveInteger(state.pomodoro.durationSeconds, getPomodoroModeDuration(state.pomodoro.mode))),
    remainingSeconds: state.pomodoro.isRunning
      ? getCurrentRunningRemainingSeconds(now)
      : normalizeNonNegativeInteger(
          state.pomodoro.remainingSeconds,
          getPomodoroModeDuration(state.pomodoro.mode),
        ),
    startedAtMs: state.pomodoro.isRunning ? state.pomodoro.startedAtMs : null,
    isRunning: state.pomodoro.isRunning,
    currentLabel: state.pomodoro.currentLabel,
    completedSessions: state.pomodoro.completedSessions,
    completedWorkCount: state.pomodoro.completedWorkCount,
    lastDateKey: state.pomodoro.lastDateKey,
  };
}

async function persistPomodoroState(now = Date.now()) {
  return writeStoredValue(STORAGE_KEYS.pomodoro, buildPomodoroStorageValue(now));
}

function syncPomodoroLabelInput() {
  if (!dom.pomodoroLabelInput) {
    return;
  }

  if (document.activeElement === dom.pomodoroLabelInput) {
    return;
  }

  if (dom.pomodoroLabelInput.value !== state.pomodoro.currentLabel) {
    dom.pomodoroLabelInput.value = state.pomodoro.currentLabel;
  }
}

function syncPomodoroModeButtons() {
  for (const button of dom.pomodoroModeButtons) {
    const mode = normalizePomodoroMode(button.dataset.pomodoroMode);
    const isSelected = mode === state.pomodoro.mode;

    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }
}

function syncPomodoroCardState() {
  if (!dom.pomodoroCardElement) {
    return;
  }

  dom.pomodoroCardElement.classList.toggle("is-running", state.pomodoro.isRunning);
  dom.pomodoroCardElement.classList.toggle("is-drag-over", state.pomodoro.isDragOver);
}

function syncPomodoroControls() {
  if (dom.pomodoroStartButton) {
    const hasPausedSession =
      !state.pomodoro.isRunning &&
      state.pomodoro.startedAtMs === null &&
      state.pomodoro.remainingSeconds < state.pomodoro.durationSeconds;

    dom.pomodoroStartButton.disabled = state.pomodoro.isRunning;
    dom.pomodoroStartButton.textContent = state.pomodoro.isRunning
      ? "Running"
      : hasPausedSession
        ? "Resume"
        : "Start";
  }

  if (dom.pomodoroPauseButton) {
    dom.pomodoroPauseButton.disabled = !state.pomodoro.isRunning;
    dom.pomodoroPauseButton.textContent = state.pomodoro.isRunning ? "Pause" : "Paused";
  }
}

function syncPomodoroDisplay(now = Date.now()) {
  applyPomodoroRunningSnapshot(now);

  if (dom.pomodoroCurrentModeElement) {
    dom.pomodoroCurrentModeElement.textContent = getPomodoroModeDefinition(
      state.pomodoro.mode,
    ).label;
  }

  if (dom.pomodoroRemainingElement) {
    dom.pomodoroRemainingElement.textContent = formatDuration(
      getCurrentDisplayedRemainingSeconds(now),
    );
  }

  if (dom.pomodoroSessionLabelElement) {
    dom.pomodoroSessionLabelElement.textContent = getPomodoroDisplayLabel();
  }

  if (dom.pomodoroNextBreakElement) {
    dom.pomodoroNextBreakElement.textContent = `Next suggested break: ${getUpcomingBreakLabel()}`;
  }

  if (dom.pomodoroCompletedCountElement) {
    dom.pomodoroCompletedCountElement.textContent = `Completed today: ${state.pomodoro.completedWorkCount}`;
  }

  if (dom.pomodoroStatusElement) {
    if (state.pomodoro.isDragOver) {
      setPomodoroStatus("Drop the task to start a focus session.");
    } else if (state.pomodoro.isRunning) {
      setPomodoroStatus("Timer is running.");
    } else if (state.pomodoro.startedAtMs !== null) {
      setPomodoroStatus(
        `Timer paused with ${formatDuration(state.pomodoro.remainingSeconds)} remaining.`,
      );
    } else {
      setPomodoroStatus("Timer is paused.");
    }
  }

  syncPomodoroLabelInput();
  syncPomodoroControls();
  syncPomodoroModeButtons();
  syncPomodoroCardState();
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
    item.dataset.sessionId = session.id;

    item.innerHTML = `
      <p class="pomodoro-session-item__label">${escapeHtml(session.label)}</p>
      <p class="pomodoro-session-item__time">${escapeHtml(
        formatPomodoroCompletionTime(session.completedAtMs),
      )}</p>
    `;

    dom.pomodoroSessionListElement.appendChild(item);
  }
}

function renderPomodoro(now = Date.now()) {
  syncPomodoroDisplay(now);
  renderPomodoroSessions();
}

function setIdlePomodoroMode(mode, { clearLabel = false } = {}) {
  state.pomodoro.mode = normalizePomodoroMode(mode);
  state.pomodoro.durationSeconds = getPomodoroModeDuration(state.pomodoro.mode);
  state.pomodoro.remainingSeconds = state.pomodoro.durationSeconds;
  state.pomodoro.startedAtMs = null;
  state.pomodoro.isRunning = false;

  if (clearLabel) {
    state.pomodoro.currentLabel = "";
  }
}

async function saveAndRenderPomodoro(now = Date.now()) {
  renderPomodoro(now);
  return persistPomodoroState(now);
}

function loadPomodoroSessionLabelFromInput() {
  if (!dom.pomodoroLabelInput) {
    return "";
  }

  return sanitizePomodoroLabel(dom.pomodoroLabelInput.value);
}

async function handlePomodoroLabelInput() {
  state.pomodoro.currentLabel = loadPomodoroSessionLabelFromInput();
  return persistPomodoroState();
}

async function handlePomodoroModeClick(event) {
  const button = event.target.closest("[data-pomodoro-mode]");

  if (!button) {
    return;
  }

  const nextMode = normalizePomodoroMode(button.dataset.pomodoroMode);

  if (nextMode === state.pomodoro.mode) {
    renderPomodoro();
    return;
  }

  setIdlePomodoroMode(nextMode, { clearLabel: true });
  await saveAndRenderPomodoro();
}

async function startPomodoroSession() {
  const now = Date.now();
  const labelFromInput = loadPomodoroSessionLabelFromInput();
  const hasPausedSession =
    !state.pomodoro.isRunning &&
    state.pomodoro.startedAtMs === null &&
    state.pomodoro.remainingSeconds < state.pomodoro.durationSeconds;

  state.pomodoro.currentLabel = labelFromInput;

  if (state.pomodoro.isRunning) {
    return false;
  }

  if (hasPausedSession && state.pomodoro.remainingSeconds > 0) {
    state.pomodoro.durationSeconds = state.pomodoro.remainingSeconds;
  } else {
    state.pomodoro.durationSeconds = getPomodoroModeDuration(state.pomodoro.mode);
    state.pomodoro.remainingSeconds = state.pomodoro.durationSeconds;
  }

  state.pomodoro.startedAtMs = now;
  state.pomodoro.isRunning = true;

  await saveAndRenderPomodoro(now);
  return true;
}

async function pausePomodoroSession() {
  if (!state.pomodoro.isRunning || state.pomodoro.startedAtMs === null) {
    return false;
  }

  const now = Date.now();
  const remainingSeconds = getCurrentRunningRemainingSeconds(now);

  state.pomodoro.remainingSeconds = remainingSeconds;
  state.pomodoro.durationSeconds = Math.max(1, remainingSeconds);
  state.pomodoro.startedAtMs = null;
  state.pomodoro.isRunning = false;

  await saveAndRenderPomodoro(now);
  return true;
}

async function resetPomodoroSession() {
  setIdlePomodoroMode(state.pomodoro.mode, { clearLabel: true });
  await saveAndRenderPomodoro();
}

function getReloadRestoreMode(storedPomodoro, now) {
  if (!storedPomodoro || typeof storedPomodoro !== "object") {
    return null;
  }

  const mode = normalizePomodoroMode(storedPomodoro.mode);
  const durationSeconds = normalizePositiveInteger(
    storedPomodoro.durationSeconds,
    getPomodoroModeDuration(mode),
  );
  const remainingSeconds = normalizeNonNegativeInteger(
    storedPomodoro.remainingSeconds,
    durationSeconds,
  );
  const startedAtMs = normalizeTimestamp(storedPomodoro.startedAtMs);
  const isRunning = Boolean(storedPomodoro.isRunning);
  const currentLabel = sanitizePomodoroLabel(
    storedPomodoro.currentLabel || storedPomodoro.sessionLabel,
  );
  const completedSessions = normalizeCompletedSessions(storedPomodoro.completedSessions);
  const completedWorkCount = normalizeNonNegativeInteger(storedPomodoro.completedWorkCount, 0);
  const lastDateKey = typeof storedPomodoro.lastDateKey === "string" ? storedPomodoro.lastDateKey : getTodayKey(new Date(now));

  return {
    mode,
    durationSeconds,
    remainingSeconds,
    startedAtMs,
    isRunning,
    currentLabel,
    completedSessions,
    completedWorkCount,
    lastDateKey,
  };
}

function applyLoadedPomodoroState(loadedState, now = Date.now()) {
  const todayKey = getTodayKey(new Date(now));

  state.pomodoro.mode = loadedState.mode;
  state.pomodoro.durationSeconds = loadedState.durationSeconds;
  state.pomodoro.remainingSeconds = loadedState.remainingSeconds;
  state.pomodoro.startedAtMs = loadedState.startedAtMs;
  state.pomodoro.isRunning = loadedState.isRunning && loadedState.startedAtMs !== null;
  state.pomodoro.currentLabel = loadedState.currentLabel;
  state.pomodoro.completedSessions = loadedState.completedSessions;
  state.pomodoro.completedWorkCount = loadedState.completedWorkCount;
  state.pomodoro.lastDateKey = loadedState.lastDateKey || todayKey;

  const historyNeedsReset = state.pomodoro.lastDateKey !== todayKey;

  if (historyNeedsReset) {
    state.pomodoro.completedSessions = [];
    state.pomodoro.completedWorkCount = 0;
    state.pomodoro.lastDateKey = todayKey;
  }

  if (!state.pomodoro.isRunning && state.pomodoro.startedAtMs !== null) {
    state.pomodoro.startedAtMs = null;
    state.pomodoro.remainingSeconds = Math.max(0, state.pomodoro.remainingSeconds);
  }

  if (state.pomodoro.isRunning && state.pomodoro.startedAtMs !== null) {
    const remainingSeconds = getCurrentRunningRemainingSeconds(now);

    if (remainingSeconds <= 0) {
      return {
        needsCompletion: true,
        historyNeedsReset,
      };
    }

    state.pomodoro.remainingSeconds = remainingSeconds;
  } else {
    const safeRemaining = normalizeNonNegativeInteger(
      state.pomodoro.remainingSeconds,
      getPomodoroModeDuration(state.pomodoro.mode),
    );

    state.pomodoro.remainingSeconds =
      safeRemaining > 0 ? safeRemaining : getPomodoroModeDuration(state.pomodoro.mode);
  }

  return {
    needsCompletion: false,
    historyNeedsReset,
  };
}

async function completePomodoroSession(now = Date.now(), { fromLoad = false } = {}) {
  if (!state.pomodoro.isRunning || state.pomodoro.startedAtMs === null) {
    return false;
  }

  const completedSession = {
    id: createId("pomodoro-session"),
    label: getPomodoroDisplayLabel(),
    mode: state.pomodoro.mode,
    startedAtMs: getCurrentSessionStartTime(now),
    completedAtMs: now,
  };

  if (state.pomodoro.mode === "work") {
    state.pomodoro.completedSessions = [completedSession, ...state.pomodoro.completedSessions];
    state.pomodoro.completedWorkCount += 1;
  }

  const nextMode = state.pomodoro.mode === "work" ? getUpcomingBreakMode() : "work";

  state.pomodoro.mode = nextMode;
  state.pomodoro.durationSeconds = getPomodoroModeDuration(nextMode);
  state.pomodoro.remainingSeconds = state.pomodoro.durationSeconds;
  state.pomodoro.startedAtMs = null;
  state.pomodoro.isRunning = false;
  state.pomodoro.currentLabel = "";

  await saveAndRenderPomodoro(now);

  if (!fromLoad) {
    const nextLabel = getPomodoroModeDefinition(nextMode).label;
    setPomodoroStatus(
      state.pomodoro.mode === "work"
        ? `Break complete. Ready for a new work session.`
        : `Work session complete. Next break prepared: ${nextLabel}.`,
      "saved",
    );
  }

  return true;
}

function tickPomodoroTimer() {
  const now = Date.now();

  if (state.pomodoro.isRunning && state.pomodoro.startedAtMs !== null) {
    const remainingSeconds = getCurrentRunningRemainingSeconds(now);

    if (remainingSeconds <= 0) {
      void completePomodoroSession(now, { fromLoad: false });
      return;
    }

    state.pomodoro.remainingSeconds = remainingSeconds;
  }

  renderPomodoro(now);
}

export function startPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId !== null) {
    window.clearInterval(state.ui.pomodoroTickIntervalId);
  }

  tickPomodoroTimer();
  state.ui.pomodoroTickIntervalId = window.setInterval(tickPomodoroTimer, 1000);
}

export function stopPomodoroTicker() {
  if (state.ui.pomodoroTickIntervalId === null) {
    return;
  }

  window.clearInterval(state.ui.pomodoroTickIntervalId);
  state.ui.pomodoroTickIntervalId = null;
}

function handlePomodoroDragOver(event) {
  const taskText = getTaskFromDragData(event.dataTransfer);

  if (!taskText) {
    return;
  }

  event.preventDefault();
  state.pomodoro.isDragOver = true;
  syncPomodoroCardState();
}

function handlePomodoroDragEnter(event) {
  const taskText = getTaskFromDragData(event.dataTransfer);

  if (!taskText) {
    return;
  }

  event.preventDefault();
  state.pomodoro.dragDepth += 1;
  state.pomodoro.isDragOver = true;
  syncPomodoroCardState();
}

function handlePomodoroDragLeave(event) {
  const taskText = getTaskFromDragData(event.dataTransfer);

  if (!taskText) {
    return;
  }

  state.pomodoro.dragDepth = Math.max(0, state.pomodoro.dragDepth - 1);

  if (state.pomodoro.dragDepth === 0) {
    state.pomodoro.isDragOver = false;
    syncPomodoroCardState();
  }
}

async function handlePomodoroDrop(event) {
  const taskText = getTaskFromDragData(event.dataTransfer);

  state.pomodoro.dragDepth = 0;
  state.pomodoro.isDragOver = false;
  syncPomodoroCardState();

  if (!taskText) {
    return;
  }

  event.preventDefault();

  state.pomodoro.mode = "work";
  state.pomodoro.durationSeconds = getPomodoroModeDuration("work");
  state.pomodoro.remainingSeconds = state.pomodoro.durationSeconds;
  state.pomodoro.startedAtMs = Date.now();
  state.pomodoro.isRunning = true;
  state.pomodoro.currentLabel = taskText;

  await saveAndRenderPomodoro();
}

function handlePomodoroDragEnd() {
  state.pomodoro.dragDepth = 0;
  state.pomodoro.isDragOver = false;
  syncPomodoroCardState();
}

async function loadSavedPomodoroState() {
  const storedPomodoro = await readStoredValue(STORAGE_KEYS.pomodoro, null);
  const now = Date.now();
  const loadedState = getReloadRestoreMode(storedPomodoro, now);

  if (!loadedState) {
    setIdlePomodoroMode("work", { clearLabel: true });
    state.pomodoro.lastDateKey = getTodayKey(new Date(now));
    state.pomodoro.completedSessions = [];
    state.pomodoro.completedWorkCount = 0;
    state.pomodoro.currentLabel = "";
    state.pomodoro.startedAtMs = null;
    state.pomodoro.isRunning = false;
    state.pomodoro.remainingSeconds = getPomodoroModeDuration("work");
    return;
  }

  const restoreResult = applyLoadedPomodoroState(loadedState, now);

  if (restoreResult.historyNeedsReset) {
    await persistPomodoroState(now);
  }

  if (restoreResult.needsCompletion) {
    await completePomodoroSession(now, { fromLoad: true });
    return;
  }

  await persistPomodoroState(now);
}

function resetPomodoroHistoryForNewDay(todayKey = getTodayKey()) {
  const hasChanged = state.pomodoro.lastDateKey !== todayKey;

  if (!hasChanged) {
    return false;
  }

  state.pomodoro.completedSessions = [];
  state.pomodoro.completedWorkCount = 0;
  state.pomodoro.lastDateKey = todayKey;
  return true;
}

export async function maybeResetPomodoroForNewDay() {
  const todayKey = getTodayKey();
  const shouldReset = resetPomodoroHistoryForNewDay(todayKey);

  if (!shouldReset) {
    return false;
  }

  const saved = await persistPomodoroState();
  renderPomodoro();
  return saved;
}

async function handlePomodoroStartClick() {
  await startPomodoroSession();
}

async function handlePomodoroPauseClick() {
  await pausePomodoroSession();
}

async function handlePomodoroResetClick() {
  await resetPomodoroSession();
}

function bindPomodoroListeners() {
  if (state.ui.pomodoroListenersBound) {
    return;
  }

  for (const button of dom.pomodoroModeButtons) {
    button.addEventListener("click", handlePomodoroModeClick);
  }

  dom.pomodoroLabelInput?.addEventListener("input", () => {
    void handlePomodoroLabelInput();
  });
  dom.pomodoroStartButton?.addEventListener("click", () => {
    void handlePomodoroStartClick();
  });
  dom.pomodoroPauseButton?.addEventListener("click", () => {
    void handlePomodoroPauseClick();
  });
  dom.pomodoroResetButton?.addEventListener("click", () => {
    void handlePomodoroResetClick();
  });

  dom.pomodoroCardElement?.addEventListener("dragenter", handlePomodoroDragEnter);
  dom.pomodoroCardElement?.addEventListener("dragover", handlePomodoroDragOver);
  dom.pomodoroCardElement?.addEventListener("dragleave", handlePomodoroDragLeave);
  dom.pomodoroCardElement?.addEventListener("drop", (event) => {
    void handlePomodoroDrop(event);
  });
  dom.pomodoroCardElement?.addEventListener("dragend", handlePomodoroDragEnd);

  state.ui.pomodoroListenersBound = true;
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
    !dom.pomodoroResetButton ||
    !dom.pomodoroNextBreakElement ||
    !dom.pomodoroCompletedCountElement ||
    !dom.pomodoroSessionListElement ||
    !dom.pomodoroEmptyStateElement ||
    !dom.pomodoroStatusElement
  ) {
    return;
  }

  bindPomodoroListeners();
  await loadSavedPomodoroState();
  renderPomodoro();
  renderPomodoroSessions();
}
