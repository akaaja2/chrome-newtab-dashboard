import { dom } from "./dom.js";
import {
  KOFI_URL,
  STORAGE_KEYS,
  buildBackup,
  getTodayKey,
  parseBackup,
  setStatus,
  storageArea,
} from "./shared.js";
import { resetFavouriteLinks } from "./links.js";
import { resetDashboards } from "./dashboards.js";
import { resetTodoList } from "./tasks.js";
import { clearNotes } from "./notes.js";
import { resetBackground } from "./backgrounds.js";

function updateSettingsSummaryHint() {
  if (!dom.settingsPanelElement || !dom.settingsSummaryHintElement) {
    return;
  }

  dom.settingsSummaryHintElement.textContent = dom.settingsPanelElement.open
    ? "Close settings"
    : "Open settings";
}

function setSettingsStatus(message, type = "idle") {
  setStatus(dom.settingsStatusElement, message, type);
}

function confirmResetAction(label) {
  return window.confirm(`Reset ${label}? This will remove the saved data for this section.`);
}

async function handleSettingsAction(action) {
  if (action === "links") {
    if (confirmResetAction("favourite links")) {
      const saved = await resetFavouriteLinks();
      setSettingsStatus(
        saved ? "Favourite links reset." : "Favourite links reset locally only.",
        saved ? "saved" : "error",
      );
    }
  } else if (action === "dashboards") {
    if (confirmResetAction("dashboards")) {
      const saved = await resetDashboards();
      setSettingsStatus(
        saved ? "Dashboards reset." : "Dashboards reset locally only.",
        saved ? "saved" : "error",
      );
    }
  } else if (action === "tasks") {
    if (confirmResetAction("the to-do list")) {
      const saved = await resetTodoList();
      setSettingsStatus(
        saved ? "To-do list reset." : "To-do list reset locally only.",
        saved ? "saved" : "error",
      );
    }
  } else if (action === "notes") {
    if (confirmResetAction("notes")) {
      const saved = await clearNotes();
      setSettingsStatus(saved ? "Notes cleared." : "Notes cleared locally only.", saved ? "saved" : "error");
    }
  } else if (action === "background") {
    if (confirmResetAction("the background")) {
      const saved = await resetBackground();
      setSettingsStatus(
        saved ? "Background reset." : "Background reset locally only.",
        saved ? "saved" : "error",
      );
    }
  }
}

async function exportBackup() {
  if (!storageArea) {
    setSettingsStatus("Storage is unavailable, so there is nothing to export.", "error");
    return false;
  }

  try {
    const storedValues = await storageArea.get(Object.values(STORAGE_KEYS));
    const backup = buildBackup(storedValues);
    const fileName = `new-tab-dashboard-backup-${getTodayKey()}.json`;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = fileName;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
    setSettingsStatus(`Exported ${fileName}.`, "saved");
    return true;
  } catch (error) {
    console.warn("New Tab Dashboard: failed to export a backup.", error);
    setSettingsStatus("Could not export a backup right now.", "error");
    return false;
  }
}

async function importBackupFile(file) {
  if (!file) {
    return false;
  }

  if (!storageArea) {
    setSettingsStatus("Storage is unavailable, so the backup cannot be imported.", "error");
    return false;
  }

  let data;

  try {
    data = parseBackup(await file.text());
  } catch (error) {
    setSettingsStatus(`Import failed: ${error.message}`, "error");
    return false;
  }

  const confirmed = window.confirm(
    "Import this backup? Saved data for every section in the file will be replaced, then the page reloads.",
  );

  if (!confirmed) {
    setSettingsStatus("Import cancelled.", "idle");
    return false;
  }

  try {
    await storageArea.set(data);
  } catch (error) {
    console.warn("New Tab Dashboard: failed to import a backup.", error);
    setSettingsStatus("Could not save the imported data.", "error");
    return false;
  }

  window.location.reload();
  return true;
}

function handleImportInputChange(event) {
  const [file] = event.target.files ?? [];
  // Clear the input so choosing the same file again still fires a change event.
  event.target.value = "";
  void importBackupFile(file);
}

function handleSettingsClick(event) {
  const actionButton = event.target.closest("[data-reset-action]");

  if (!actionButton) {
    return;
  }

  void handleSettingsAction(actionButton.dataset.resetAction);
}

export function initSettings() {
  if (dom.supportKofiLinkElement) {
    dom.supportKofiLinkElement.href = KOFI_URL;
  }

  if (!dom.settingsPanelElement || !dom.settingsSummaryHintElement || !dom.settingsActionButtons.length) {
    return;
  }

  updateSettingsSummaryHint();
  dom.settingsPanelElement.addEventListener("toggle", updateSettingsSummaryHint);

  for (const button of dom.settingsActionButtons) {
    button.addEventListener("click", handleSettingsClick);
  }

  dom.settingsExportButton?.addEventListener("click", () => {
    void exportBackup();
  });
  dom.settingsImportButton?.addEventListener("click", () => dom.settingsImportInput?.click());
  dom.settingsImportInput?.addEventListener("change", handleImportInputChange);
}
