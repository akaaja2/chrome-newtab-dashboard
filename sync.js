import { isDashboardStorageKey } from "./shared.js";

// Every new tab keeps its own in-memory copy of the saved data and writes whole
// lists back. If another tab saves while this one sits in the background, this
// tab is stale, and its next save would silently overwrite the newer data.
// So when that happens we reload from storage as soon as the tab is shown again.
let hasStaleData = false;

function hasMeaningfulChange(change) {
  return JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue);
}

function handleStorageChanged(changes, areaName) {
  if (areaName !== "local" || !document.hidden) {
    return;
  }

  const changedKeys = Object.keys(changes).filter(
    (key) => isDashboardStorageKey(key) && hasMeaningfulChange(changes[key]),
  );

  if (changedKeys.length > 0) {
    hasStaleData = true;
  }
}

function handleVisibilityChange() {
  if (!document.hidden && hasStaleData) {
    hasStaleData = false;
    window.location.reload();
  }
}

export function initCrossTabSync() {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return;
  }

  chrome.storage.onChanged.addListener(handleStorageChanged);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}
