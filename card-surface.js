import {
  CARD_SURFACE_OPTIONS,
  DEFAULT_CARD_SURFACE_ID,
  STORAGE_KEYS,
  readStoredValue,
  setStatus,
  storageArea,
  writeStoredValue,
} from "./shared.js";
import { dom } from "./dom.js";
import { state } from "./state.js";

function setCardSurfaceStatus(message, type = "idle") {
  setStatus(dom.cardSurfaceStatusElement, message, type);
}

function isKnownCardSurface(cardSurfaceId) {
  return CARD_SURFACE_OPTIONS.some((option) => option.id === cardSurfaceId);
}

function getCardSurfaceLabel(cardSurfaceId) {
  const option = CARD_SURFACE_OPTIONS.find((item) => item.id === cardSurfaceId);
  return option ? option.label : CARD_SURFACE_OPTIONS[0].label;
}

function applyCardSurfaceStyles(cardSurfaceId) {
  if (!document.body) {
    return;
  }

  document.body.dataset.cardSurface = cardSurfaceId;
}

function renderCardSurfaceSelection() {
  const selectedCardSurfaceId = isKnownCardSurface(state.appearance.cardSurfaceId)
    ? state.appearance.cardSurfaceId
    : DEFAULT_CARD_SURFACE_ID;

  if (state.appearance.cardSurfaceId !== selectedCardSurfaceId) {
    state.appearance.cardSurfaceId = selectedCardSurfaceId;
  }

  applyCardSurfaceStyles(selectedCardSurfaceId);

  for (const button of dom.cardSurfaceOptionButtons) {
    const isSelected = button.dataset.cardSurfaceId === selectedCardSurfaceId;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  if (!dom.cardSurfaceStatusElement) {
    return;
  }

  setCardSurfaceStatus(
    storageArea
      ? `Using ${getCardSurfaceLabel(selectedCardSurfaceId)} cards. Saved automatically.`
      : `Using ${getCardSurfaceLabel(selectedCardSurfaceId)} cards. Changes won't persist.`,
    storageArea ? "saved" : "error",
  );
}

async function persistCardSurface() {
  return writeStoredValue(STORAGE_KEYS.cardSurface, state.appearance.cardSurfaceId);
}

async function loadSavedCardSurface() {
  if (!dom.cardSurfaceStatusElement) {
    return;
  }

  const savedCardSurface = await readStoredValue(
    STORAGE_KEYS.cardSurface,
    DEFAULT_CARD_SURFACE_ID,
  );

  state.appearance.cardSurfaceId = isKnownCardSurface(savedCardSurface)
    ? savedCardSurface
    : DEFAULT_CARD_SURFACE_ID;

  renderCardSurfaceSelection();
}

async function handleCardSurfaceSelection(event) {
  const button = event.target.closest("[data-card-surface-id]");

  if (!button) {
    return;
  }

  const nextCardSurfaceId = isKnownCardSurface(button.dataset.cardSurfaceId)
    ? button.dataset.cardSurfaceId
    : DEFAULT_CARD_SURFACE_ID;

  state.appearance.cardSurfaceId = nextCardSurfaceId;
  renderCardSurfaceSelection();

  const saved = await persistCardSurface();

  if (!saved) {
    setCardSurfaceStatus("Card surface could not be saved.", "error");
  }
}

export async function initCardSurface() {
  if (!dom.cardSurfaceOptionButtons.length || !dom.cardSurfaceStatusElement) {
    return;
  }

  renderCardSurfaceSelection();
  await loadSavedCardSurface();

  for (const button of dom.cardSurfaceOptionButtons) {
    button.addEventListener("click", handleCardSurfaceSelection);
  }
}
