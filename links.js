import { dom } from "./dom.js";
import {
  createId,
  formatDisplayUrl,
  getFaviconRequestUrl,
  normalizeUrl,
  openUrlInNewTab,
  readStoredValue,
  setStatus,
  STORAGE_KEYS,
  writeStoredValue,
} from "./shared.js";
import { state } from "./state.js";

function setLinkMessage(message, type = "info") {
  setStatus(dom.linkMessageElement, message, type);
}

function resetLinkForm(clearMessage = false) {
  dom.linkFormElement?.reset();
  state.links.editingId = null;

  if (dom.linkSubmitButton) {
    dom.linkSubmitButton.textContent = "Add link";
  }

  if (dom.linkCancelButton) {
    dom.linkCancelButton.hidden = true;
  }

  if (clearMessage) {
    setLinkMessage("");
  }
}

function startEditingLink(link) {
  if (!dom.linkTitleInput || !dom.linkUrlInput) {
    return;
  }

  state.links.editingId = link.id;
  dom.linkTitleInput.value = link.title;
  dom.linkUrlInput.value = link.url;

  if (dom.linkSubmitButton) {
    dom.linkSubmitButton.textContent = "Save changes";
  }

  if (dom.linkCancelButton) {
    dom.linkCancelButton.hidden = false;
  }

  setLinkMessage("Editing link. Update the fields and save your changes.");
  dom.linkTitleInput.focus();
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
  return writeStoredValue(STORAGE_KEYS.links, state.links.items);
}

async function openLink(url) {
  return openUrlInNewTab(url);
}

function createSavedLinkCard(link, compact = false) {
  const card = document.createElement("article");
  card.className = "saved-link-card";
  if (compact) {
    card.classList.add("saved-link-card--compact");
  }
  card.dataset.linkCard = "true";
  card.dataset.linkId = link.id;
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Open ${link.title}`);

  const content = document.createElement("div");
  content.className = "saved-link-card__content";

  const favicon = document.createElement("div");
  favicon.className = "saved-link-card__favicon";
  favicon.dataset.initial = link.title.trim().charAt(0).toUpperCase() || "?";

  const faviconImage = document.createElement("img");
  faviconImage.alt = "";
  faviconImage.loading = "lazy";
  faviconImage.decoding = "async";
  faviconImage.referrerPolicy = "no-referrer";
  const faviconUrl = getFaviconRequestUrl(link.url);

  if (faviconUrl) {
    faviconImage.addEventListener("load", () => {
      favicon.classList.add("has-image");
    });
    faviconImage.addEventListener("error", () => {
      faviconImage.remove();
    });
    faviconImage.src = faviconUrl;
    favicon.appendChild(faviconImage);
  } else {
    favicon.classList.add("saved-link-card__favicon--file");
  }

  const text = document.createElement("div");
  text.className = "saved-link-card__text";

  const title = document.createElement("h3");
  title.className = "saved-link-card__title";
  title.textContent = link.title;

  const url = document.createElement("p");
  url.className = "saved-link-card__url";
  url.textContent = formatDisplayUrl(link.url);

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
    editButton.dataset.linkAction = "edit";
    editButton.textContent = "Edit";

    const deleteButton = document.createElement("button");
    deleteButton.className = "link-action link-action--danger";
    deleteButton.type = "button";
    deleteButton.dataset.linkAction = "delete";
    deleteButton.textContent = "Delete";

    actions.append(editButton, deleteButton);
    card.append(content, actions);
  } else {
    card.append(content);
  }

  return card;
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
  if (!dom.linksGridElement || !dom.linksEmptyStateElement) {
    return;
  }

  const isMinimized = state.layout.minimizedCardIds.includes("links-card");
  dom.linksGridElement.innerHTML = "";
  if (dom.linksMinimizedGridElement) {
    dom.linksMinimizedGridElement.innerHTML = "";
  }

  if (state.links.items.length === 0) {
    dom.linksEmptyStateElement.hidden = false;
    if (dom.linksMinimizedViewElement) {
      dom.linksMinimizedViewElement.hidden = true;
    }
    return;
  }

  dom.linksEmptyStateElement.hidden = true;

  for (const link of state.links.items) {
    dom.linksGridElement.appendChild(createSavedLinkCard(link));
    if (dom.linksMinimizedGridElement) {
      dom.linksMinimizedGridElement.appendChild(createSavedLinkCard(link, true));
    }
  }

  if (dom.linksMinimizedViewElement) {
    dom.linksMinimizedViewElement.hidden = !isMinimized;
  }
}

async function handleLinkFormSubmit(event) {
  event.preventDefault();

  if (!dom.linkTitleInput || !dom.linkUrlInput) {
    return;
  }

  const title = dom.linkTitleInput.value.trim();
  const url = normalizeUrl(dom.linkUrlInput.value);

  if (!title) {
    setLinkMessage("Please enter a title for the link.", "error");
    dom.linkTitleInput.focus();
    return;
  }

  if (!url) {
    setLinkMessage(
      "That link does not look valid. Try https://example.com, file:///C:/Users/.../file.pdf, or a local Windows path.",
      "error",
    );
    dom.linkUrlInput.focus();
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

  void openLink(link.url);
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
    void openLink(link.url);
  }
}

export async function resetFavouriteLinks() {
  state.links.items = [];
  resetLinkForm(true);
  const saved = await persistLinks();
  renderLinks();
  setLinkMessage(saved ? "Favourite links reset." : "Favourite links reset locally only.", saved ? "saved" : "error");
  return saved;
}

export async function initFavouriteLinks() {
  if (!dom.linksGridElement || !dom.linksEmptyStateElement || !dom.linkFormElement) {
    return;
  }

  await loadSavedLinks();
  renderLinks();

  dom.linkFormElement.addEventListener("submit", handleLinkFormSubmit);
  dom.linkCancelButton?.addEventListener("click", () => resetLinkForm(true));
  dom.linksGridElement.addEventListener("click", handleLinksGridClick);
  dom.linksGridElement.addEventListener("keydown", handleLinksGridKeydown);
  dom.linksMinimizedGridElement?.addEventListener("click", handleLinksGridClick);
  dom.linksMinimizedGridElement?.addEventListener("keydown", handleLinksGridKeydown);
}
