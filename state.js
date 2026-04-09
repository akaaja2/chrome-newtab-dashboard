import {
  DEFAULT_BACKGROUND_ID,
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
