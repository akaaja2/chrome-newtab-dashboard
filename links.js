import { dom } from "./dom.js";
import { createId, escapeHtml, formatDisplayUrl, normalizeUrl, readStoredValue, setStatus, STORAGE_KEYS, writeStoredValue } from "./shared.js";
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

function openLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
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

  dom.linksGridElement.innerHTML = "";

  if (state.links.items.length === 0) {
    dom.linksEmptyStateElement.hidden = false;
    return;
  }

  dom.linksEmptyStateElement.hidden = true;

  for (const link of state.links.items) {
    const card = document.createElement("article");
    card.className = "saved-link-card";
    card.dataset.linkCard = "true";
    card.dataset.linkId = link.id;
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Open ${link.title}`);

    card.innerHTML = `
      <div class="saved-link-card__content">
        <h3 class="saved-link-card__title">${escapeHtml(link.title)}</h3>
        <p class="saved-link-card__url">${escapeHtml(formatDisplayUrl(link.url))}</p>
      </div>
      <div class="saved-link-card__actions">
        <button class="link-action" type="button" data-link-action="edit">Edit</button>
        <button class="link-action link-action--danger" type="button" data-link-action="delete">Delete</button>
      </div>
    `;

    dom.linksGridElement.appendChild(card);
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
      "That URL does not look valid. Try something like https://example.com.",
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

  openLink(link.url);
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
    openLink(link.url);
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
}
