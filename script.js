// Grab the two elements that will show the clock and date.
const clockTimeElement = document.getElementById("clock-time");
const clockDateElement = document.getElementById("clock-date");
const linksGridElement = document.getElementById("links-grid");
const linksEmptyStateElement = document.getElementById("links-empty-state");
const linkFormElement = document.getElementById("link-form");
const linkTitleInput = document.getElementById("link-title");
const linkUrlInput = document.getElementById("link-url");
const linkSubmitButton = document.getElementById("link-submit");
const linkCancelButton = document.getElementById("link-cancel");
const linkMessageElement = document.getElementById("link-message");

const STORAGE_KEY = "dashboard.links";

// Keep all link data in one place so rendering always comes from state.
const linkState = {
  links: [],
  editingId: null,
};

// chrome.storage.local is the preferred storage layer, but we warn and fall
// back to in-memory state if it is not available.
const storageArea =
  typeof chrome !== "undefined" && chrome.storage && chrome.storage.local
    ? chrome.storage.local
    : null;

if (!storageArea) {
  console.warn(
    "New Tab Dashboard: chrome.storage.local is not available. Favourite links will not persist after reload.",
  );
}

// Turn a Date object into the strings we want for the dashboard.
function formatClockParts(date) {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  const dateText = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);

  return { time, dateText };
}

// Put the formatted time and date into the page.
function renderClock() {
  if (!clockTimeElement || !clockDateElement) {
    return;
  }

  const now = new Date();
  const { time, dateText } = formatClockParts(now);

  clockTimeElement.textContent = time;
  clockDateElement.textContent = dateText;
}

// Create a simple unique id for each saved link.
function createLinkId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `link-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Normalize a user-entered URL and return a usable HTTPS/HTTP address.
function normalizeUrl(inputValue) {
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

// Turn a full URL into a shorter label for display inside the card.
function formatDisplayUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Show a short message below the form so users know what happened.
function setFormMessage(message, type = "info") {
  if (!linkMessageElement) {
    return;
  }

  linkMessageElement.textContent = message;
  linkMessageElement.dataset.state = type;
}

// Reset the form back to its add-link state.
function resetLinkForm(clearMessage = false) {
  if (linkFormElement) {
    linkFormElement.reset();
  }

  linkState.editingId = null;

  if (linkSubmitButton) {
    linkSubmitButton.textContent = "Add link";
  }

  if (linkCancelButton) {
    linkCancelButton.hidden = true;
  }

  if (clearMessage) {
    setFormMessage("");
  }
}

// Fill the form when the user starts editing an existing link.
function startEditingLink(link) {
  if (!linkTitleInput || !linkUrlInput) {
    return;
  }

  linkState.editingId = link.id;
  linkTitleInput.value = link.title;
  linkUrlInput.value = link.url;

  if (linkSubmitButton) {
    linkSubmitButton.textContent = "Save changes";
  }

  if (linkCancelButton) {
    linkCancelButton.hidden = false;
  }

  setFormMessage("Editing link. Update the fields and save your changes.");
  linkTitleInput.focus();
}

// Load saved links from chrome.storage.local when it is available.
async function loadSavedLinks() {
  if (!storageArea) {
    return;
  }

  try {
    const result = await storageArea.get(STORAGE_KEY);
    const storedLinks = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];

    linkState.links = storedLinks
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
      .filter(Boolean);
  } catch (error) {
    console.warn("New Tab Dashboard: failed to load favourite links from storage.", error);
  }
}

// Save the current link list so it survives browser restarts.
async function persistLinks() {
  if (!storageArea) {
    return;
  }

  try {
    await storageArea.set({ [STORAGE_KEY]: linkState.links });
  } catch (error) {
    console.warn("New Tab Dashboard: failed to save favourite links to storage.", error);
  }
}

// Open a saved link in a new tab.
function openLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

// Remove one link from the array and update storage.
async function deleteLink(id) {
  const nextLinks = linkState.links.filter((link) => link.id !== id);

  if (nextLinks.length === linkState.links.length) {
    return;
  }

  linkState.links = nextLinks;

  if (linkState.editingId === id) {
    resetLinkForm(true);
  }

  await persistLinks();
  renderLinks();
  setFormMessage("Link deleted.", "success");
}

// Put a link into the form for editing or remove it from the list.
function handleLinksGridClick(event) {
  const actionButton = event.target.closest("[data-link-action]");
  const cardElement = event.target.closest("[data-link-card]");

  if (!cardElement) {
    return;
  }

  const linkId = cardElement.dataset.linkId;
  const link = linkState.links.find((item) => item.id === linkId);

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
        deleteLink(link.id);
      }
    }

    return;
  }

  openLink(link.url);
}

// Make cards keyboard accessible so Enter and Space open the link too.
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
  const link = linkState.links.find((item) => item.id === linkId);

  if (link) {
    openLink(link.url);
  }
}

// Build the cards from the current state so the UI always matches the data.
function renderLinks() {
  if (!linksGridElement || !linksEmptyStateElement) {
    return;
  }

  linksGridElement.innerHTML = "";

  if (linkState.links.length === 0) {
    linksEmptyStateElement.hidden = false;
    return;
  }

  linksEmptyStateElement.hidden = true;

  for (const link of linkState.links) {
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

    linksGridElement.appendChild(card);
  }
}

// Escape user text before putting it into innerHTML.
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// Add or update a link based on whether the form is in edit mode.
async function handleLinkFormSubmit(event) {
  event.preventDefault();

  if (!linkTitleInput || !linkUrlInput) {
    return;
  }

  const title = linkTitleInput.value.trim();
  const url = normalizeUrl(linkUrlInput.value);

  if (!title) {
    setFormMessage("Please enter a title for the link.", "error");
    linkTitleInput.focus();
    return;
  }

  if (!url) {
    setFormMessage("That URL does not look valid. Try something like https://example.com.", "error");
    linkUrlInput.focus();
    return;
  }

  const editingIndex = linkState.links.findIndex((link) => link.id === linkState.editingId);

  if (editingIndex >= 0) {
    linkState.links[editingIndex] = {
      ...linkState.links[editingIndex],
      title,
      url,
    };
    setFormMessage("Link updated.", "success");
  } else {
    linkState.links = [
      {
        id: createLinkId(),
        title,
        url,
      },
      ...linkState.links,
    ];
    setFormMessage("Link saved.", "success");
  }

  await persistLinks();
  renderLinks();
  resetLinkForm(true);
}

// Start the favourite links feature by loading storage and wiring events.
async function initFavouriteLinks() {
  if (!linksGridElement || !linksEmptyStateElement || !linkFormElement) {
    return;
  }

  await loadSavedLinks();
  renderLinks();

  linkFormElement.addEventListener("submit", handleLinkFormSubmit);
  linkCancelButton?.addEventListener("click", resetLinkForm);
  linksGridElement.addEventListener("click", handleLinksGridClick);
  linksGridElement.addEventListener("keydown", handleLinksGridKeydown);
}
// Render once immediately so the page is correct on first load.
renderClock();

// Update the display every second so the clock stays live.
setInterval(renderClock, 1000);

// Load and render the saved favourite links.
initFavouriteLinks();
