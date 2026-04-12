export const STORAGE_KEYS = {
  links: "dashboard.links",
  tasks: "dashboard.tasks",
  note: "dashboard.note",
  background: "dashboard.background",
  cardSurface: "dashboard.cardSurface",
  pomodoro: "dashboard.pomodoro",
  cardOrder: "dashboard.cardOrder",
  cardMinimized: "dashboard.cardMinimized",
};

export const CUSTOM_BACKGROUND_ID = "custom-image";
export const CUSTOM_BACKGROUND_MAX_BYTES = 1500000;

export const POMODORO_MODES = {
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

export const BACKGROUND_OPTIONS = [
  { id: "geometric-grid", label: "Grid Shift" },
  { id: "geometric-facet", label: "Facet" },
  { id: "geometric-orbit", label: "Orbit" },
  { id: "geometric-lattice", label: "Lattice" },
];

export const DEFAULT_BACKGROUND_ID = BACKGROUND_OPTIONS[0].id;

export const CARD_SURFACE_OPTIONS = [
  { id: "patterned", label: "Patterned" },
  { id: "opaque", label: "Opaque" },
];

export const DEFAULT_CARD_SURFACE_ID = CARD_SURFACE_OPTIONS[0].id;

export const DASHBOARD_CARD_ORDER = [
  "clock-card",
  "pomodoro-card",
  "links-card",
  "todo-card",
  "notes-card",
  "background-card",
  "settings-card",
];

export const storageArea =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : null;

if (!storageArea) {
  console.warn(
    "New Tab Dashboard: chrome.storage.local is not available. Saved links, tasks, notes, backgrounds, layout, and Pomodoro state will not persist after reload.",
  );
}

export async function readStoredValue(key, fallbackValue) {
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

export async function writeStoredValue(key, value) {
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

export function createId(prefix) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function setStatus(element, message, type = "idle") {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.state = type;
}

export function normalizeUrl(inputValue) {
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

export function formatDisplayUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function getTodayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");

  return `${minutes}:${seconds}`;
}
