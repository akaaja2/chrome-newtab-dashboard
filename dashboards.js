import { dom } from "./dom.js";
import {
  createId,
  formatDisplayUrl,
  getFileNameFromUrlOrPath,
  normalizeUrl,
  openUrlInNewTab,
  readStoredValue,
  setStatus,
  STORAGE_KEYS,
  stripFileExtension,
  writeStoredValue,
} from "./shared.js";
import { state } from "./state.js";

function setDashboardMessage(message, type = "info") {
  setStatus(dom.dashboardMessageElement, message, type);
}

function resetDashboardForm(clearMessage = false) {
  dom.dashboardFormElement?.reset();
  state.dashboards.editingId = null;

  if (dom.dashboardSubmitButton) {
    dom.dashboardSubmitButton.textContent = "Add dashboard";
  }

  if (dom.dashboardCancelButton) {
    dom.dashboardCancelButton.hidden = true;
  }

  if (clearMessage) {
    setDashboardMessage("");
  }
}

function startEditingDashboard(dashboard) {
  if (!dom.dashboardTitleInput || !dom.dashboardUrlInput) {
    return;
  }

  state.dashboards.editingId = dashboard.id;
  dom.dashboardTitleInput.value = dashboard.title;
  dom.dashboardUrlInput.value = dashboard.url;

  if (dom.dashboardSubmitButton) {
    dom.dashboardSubmitButton.textContent = "Save changes";
  }

  if (dom.dashboardCancelButton) {
    dom.dashboardCancelButton.hidden = false;
  }

  setDashboardMessage("Editing dashboard. Update the fields and save your changes.");
  dom.dashboardTitleInput.focus();
}

function normalizeLocalDashboardUrl(inputValue) {
  const normalizedUrl = normalizeUrl(inputValue);

  if (!normalizedUrl) {
    return null;
  }

  try {
    const parsed = new URL(normalizedUrl);

    return parsed.protocol === "file:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function getFallbackDashboardTitle(url) {
  const fileName = getFileNameFromUrlOrPath(url);
  const fileStem = stripFileExtension(fileName).trim();

  return fileStem || fileName || "Local dashboard";
}

async function extractDashboardTitleFromUrl(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    const document = new DOMParser().parseFromString(html, "text/html");
    const title = String(document.title || "").trim();

    return title || null;
  } catch {
    return null;
  }
}

async function resolveDashboardTitle(url, providedTitle = "") {
  const manualTitle = String(providedTitle || "").trim();

  if (manualTitle) {
    return manualTitle;
  }

  const extractedTitle = await extractDashboardTitleFromUrl(url);

  if (extractedTitle) {
    return extractedTitle;
  }

  return getFallbackDashboardTitle(url);
}

function normalizeDashboardEntry(entry) {
  const url = normalizeLocalDashboardUrl(String(entry?.url || ""));
  const title = String(entry?.title || "").trim();

  if (!url) {
    return null;
  }

  return {
    id: typeof entry?.id === "string" && entry.id ? entry.id : createId("dashboard"),
    title: title || getFallbackDashboardTitle(url),
    url,
  };
}

async function loadSavedDashboards() {
  const storedDashboards = await readStoredValue(STORAGE_KEYS.dashboards, []);

  state.dashboards.items = Array.isArray(storedDashboards)
    ? storedDashboards.map(normalizeDashboardEntry).filter(Boolean)
    : [];
}

async function persistDashboards() {
  return writeStoredValue(STORAGE_KEYS.dashboards, state.dashboards.items);
}

async function openDashboard(url) {
  return openUrlInNewTab(url);
}

function createDashboardCard(dashboard, compact = false) {
  const card = document.createElement("article");
  card.className = "saved-link-card";

  if (compact) {
    card.classList.add("saved-link-card--compact");
  }

  card.dataset.dashboardCard = "true";
  card.dataset.dashboardId = dashboard.id;
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Open ${dashboard.title}`);

  const content = document.createElement("div");
  content.className = "saved-link-card__content";

  const favicon = document.createElement("div");
  favicon.className = "saved-link-card__favicon saved-link-card__favicon--file";
  favicon.dataset.initial = dashboard.title.trim().charAt(0).toUpperCase() || "D";

  const text = document.createElement("div");
  text.className = "saved-link-card__text";

  const title = document.createElement("h3");
  title.className = "saved-link-card__title";
  title.textContent = dashboard.title;

  const url = document.createElement("p");
  url.className = "saved-link-card__url";
  url.textContent = formatDisplayUrl(dashboard.url);

  if (compact) {
    text.append(title);
  } else {
    text.append(title, url);
  }

  content.append(favicon, text);

  if (!compact) {
    const actions = document.createElement("div");
    actions.className = "saved-link-card__actions";

    const editButton = document.createElement("button");
    editButton.className = "link-action";
    editButton.type = "button";
    editButton.dataset.dashboardAction = "edit";
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.className = "link-action link-action--danger";
    deleteButton.type = "button";
    deleteButton.dataset.dashboardAction = "delete";
    deleteButton.textContent = "Delete";

    actions.append(editButton, deleteButton);
    card.append(content, actions);
  } else {
    card.append(content);
  }

  return card;
}

function renderDashboards() {
  if (!dom.dashboardsGridElement || !dom.dashboardsEmptyStateElement) {
    return;
  }

  const isMinimized = state.layout.minimizedCardIds.includes("dashboards-card");
  dom.dashboardsGridElement.innerHTML = "";
  dom.dashboardsMinimizedGridElement?.replaceChildren();

  if (state.dashboards.items.length === 0) {
    dom.dashboardsEmptyStateElement.hidden = false;

    if (dom.dashboardsMinimizedViewElement) {
      dom.dashboardsMinimizedViewElement.hidden = true;
    }

    return;
  }

  dom.dashboardsEmptyStateElement.hidden = true;

  for (const dashboard of state.dashboards.items) {
    dom.dashboardsGridElement.appendChild(createDashboardCard(dashboard));
    if (dom.dashboardsMinimizedGridElement) {
      dom.dashboardsMinimizedGridElement.appendChild(createDashboardCard(dashboard, true));
    }
  }

  if (dom.dashboardsMinimizedViewElement) {
    dom.dashboardsMinimizedViewElement.hidden = !isMinimized;
  }
}

async function deleteDashboard(id) {
  const nextDashboards = state.dashboards.items.filter((dashboard) => dashboard.id !== id);

  if (nextDashboards.length === state.dashboards.items.length) {
    return;
  }

  state.dashboards.items = nextDashboards;

  if (state.dashboards.editingId === id) {
    resetDashboardForm(true);
  }

  await persistDashboards();
  renderDashboards();
  setDashboardMessage("Dashboard deleted.", "success");
}

async function handleDashboardFormSubmit(event) {
  event.preventDefault();

  if (!dom.dashboardTitleInput || !dom.dashboardUrlInput) {
    return;
  }

  const titleInput = dom.dashboardTitleInput.value.trim();
  const url = normalizeLocalDashboardUrl(dom.dashboardUrlInput.value);

  if (!url) {
    setDashboardMessage(
      "Please enter a local file path or file:/// URL for an HTML dashboard.",
      "error",
    );
    dom.dashboardUrlInput.focus();
    return;
  }

  const title = await resolveDashboardTitle(url, titleInput);

  if (!title) {
    setDashboardMessage("Please enter a title for the dashboard.", "error");
    dom.dashboardTitleInput.focus();
    return;
  }

  const editingIndex = state.dashboards.items.findIndex(
    (dashboard) => dashboard.id === state.dashboards.editingId,
  );

  if (editingIndex >= 0) {
    state.dashboards.items[editingIndex] = {
      ...state.dashboards.items[editingIndex],
      title,
      url,
    };
    setDashboardMessage("Dashboard updated.", "success");
  } else {
    state.dashboards.items = [
      {
        id: createId("dashboard"),
        title,
        url,
      },
      ...state.dashboards.items,
    ];
    setDashboardMessage("Dashboard saved.", "success");
  }

  await persistDashboards();
  renderDashboards();
  resetDashboardForm(true);
}

async function handleDashboardsGridClick(event) {
  const actionButton = event.target.closest("[data-dashboard-action]");
  const cardElement = event.target.closest("[data-dashboard-card]");

  if (!cardElement) {
    return;
  }

  const dashboardId = cardElement.dataset.dashboardId;
  const dashboard = state.dashboards.items.find((item) => item.id === dashboardId);

  if (!dashboard) {
    return;
  }

  if (actionButton) {
    event.preventDefault();
    event.stopPropagation();

    const action = actionButton.dataset.dashboardAction;

    if (action === "edit") {
      startEditingDashboard(dashboard);
    } else if (action === "delete") {
      const shouldDelete = window.confirm(`Delete "${dashboard.title}"?`);

      if (shouldDelete) {
        void deleteDashboard(dashboard.id);
      }
    }

    return;
  }

  const opened = await openDashboard(dashboard.url);

  if (!opened) {
    setDashboardMessage(
      "Chrome blocked the local file. If needed, enable file access for this extension in chrome://extensions.",
      "error",
    );
  }
}

function handleDashboardsGridKeydown(event) {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const cardElement = event.target.closest("[data-dashboard-card]");

  if (!cardElement || event.target.closest("[data-dashboard-action]")) {
    return;
  }

  event.preventDefault();

  const dashboardId = cardElement.dataset.dashboardId;
  const dashboard = state.dashboards.items.find((item) => item.id === dashboardId);

  if (dashboard) {
    void openDashboard(dashboard.url);
  }
}

export async function resetDashboards() {
  state.dashboards.items = [];
  resetDashboardForm(true);
  const saved = await persistDashboards();
  renderDashboards();
  setDashboardMessage(
    saved ? "Dashboards reset." : "Dashboards reset locally only.",
    saved ? "saved" : "error",
  );
  return saved;
}

export async function initDashboards() {
  if (!dom.dashboardsGridElement || !dom.dashboardsEmptyStateElement || !dom.dashboardFormElement) {
    return;
  }

  await loadSavedDashboards();
  renderDashboards();

  dom.dashboardFormElement.addEventListener("submit", handleDashboardFormSubmit);
  dom.dashboardCancelButton?.addEventListener("click", () => resetDashboardForm(true));
  dom.dashboardsGridElement.addEventListener("click", handleDashboardsGridClick);
  dom.dashboardsGridElement.addEventListener("keydown", handleDashboardsGridKeydown);
  dom.dashboardsMinimizedGridElement?.addEventListener("click", handleDashboardsGridClick);
  dom.dashboardsMinimizedGridElement?.addEventListener("keydown", handleDashboardsGridKeydown);
}
