import {
  DEFAULT_BACKGROUND_ID,
  DEFAULT_CARD_SURFACE_ID,
  DASHBOARD_CARD_ORDER,
  POMODORO_MODES,
  getTodayKey,
} from "./shared.js";

export const state = {
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
    durationSeconds: POMODORO_MODES.work.duration,
    remainingSeconds: POMODORO_MODES.work.duration,
    startedAtMs: null,
    isRunning: false,
    currentLabel: "",
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
  appearance: {
    cardSurfaceId: DEFAULT_CARD_SURFACE_ID,
  },
  layout: {
    cardOrder: [...DASHBOARD_CARD_ORDER],
    minimizedCardIds: [],
    draggingCardId: null,
    dropTargetCardId: null,
    dropPosition: null,
  },
};
