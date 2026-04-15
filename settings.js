import { dom } from "./dom.js";
import { setStatus } from "./shared.js";
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

function handleSettingsClick(event) {
  const actionButton = event.target.closest("[data-reset-action]");

  if (!actionButton) {
    return;
  }

  void handleSettingsAction(actionButton.dataset.resetAction);
}

export function initSettings() {
  if (!dom.settingsPanelElement || !dom.settingsSummaryHintElement || !dom.settingsActionButtons.length) {
    return;
  }

  updateSettingsSummaryHint();
  dom.settingsPanelElement.addEventListener("toggle", updateSettingsSummaryHint);

  for (const button of dom.settingsActionButtons) {
    button.addEventListener("click", handleSettingsClick);
  }
}
