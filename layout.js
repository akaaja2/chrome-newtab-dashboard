import { DASHBOARD_CARD_ORDER, readStoredValue, STORAGE_KEYS, writeStoredValue } from "./shared.js";
import { state } from "./state.js";
import { dom } from "./dom.js";

function getDashboardCardElements() {
  if (!dom.dashboardLayoutElement) {
    return [];
  }

  return Array.from(dom.dashboardLayoutElement.children).filter(
    (element) =>
      element instanceof HTMLElement &&
      typeof element.dataset.dashboardCardId === "string" &&
      element.dataset.dashboardCardId.length > 0,
  );
}

function getAvailableDashboardCardIds() {
  return getDashboardCardElements()
    .map((cardElement) => cardElement.dataset.dashboardCardId)
    .filter((cardId) => typeof cardId === "string" && cardId.length > 0);
}

// The saved order is built from known card IDs, then any new cards are appended
// so older saved layouts keep working when the dashboard grows later.
function normalizeDashboardCardOrder(savedOrder, availableCardIds = getAvailableDashboardCardIds()) {
  const availableCardSet = new Set(availableCardIds);
  const seenCardIds = new Set();
  const normalizedOrder = [];
  const savedCardIds = Array.isArray(savedOrder) ? savedOrder : [];

  for (const rawCardId of savedCardIds) {
    const cardId = String(rawCardId || "").trim();

    if (!cardId || seenCardIds.has(cardId) || !availableCardSet.has(cardId)) {
      continue;
    }

    seenCardIds.add(cardId);
    normalizedOrder.push(cardId);
  }

  for (const cardId of DASHBOARD_CARD_ORDER) {
    if (availableCardSet.has(cardId) && !seenCardIds.has(cardId)) {
      seenCardIds.add(cardId);
      normalizedOrder.push(cardId);
    }
  }

  for (const cardId of availableCardIds) {
    if (!seenCardIds.has(cardId)) {
      seenCardIds.add(cardId);
      normalizedOrder.push(cardId);
    }
  }

  return normalizedOrder;
}

function updateDashboardDragClasses() {
  for (const cardElement of getDashboardCardElements()) {
    const cardId = cardElement.dataset.dashboardCardId;
    const isDragging = cardId === state.layout.draggingCardId;
    const isDropTarget = cardId === state.layout.dropTargetCardId;

    cardElement.classList.toggle("is-dragging", isDragging);
    cardElement.classList.toggle("is-drop-target", isDropTarget);

    if (isDropTarget && state.layout.dropPosition) {
      cardElement.dataset.dropPosition = state.layout.dropPosition;
    } else {
      cardElement.removeAttribute("data-drop-position");
    }
  }
}

function clearDashboardDragState() {
  state.layout.draggingCardId = null;
  state.layout.dropTargetCardId = null;
  state.layout.dropPosition = null;
  updateDashboardDragClasses();
}

function setDashboardDropTarget(cardId, dropPosition) {
  state.layout.dropTargetCardId = cardId;
  state.layout.dropPosition = dropPosition;
  updateDashboardDragClasses();
}

function getDashboardCardFromPoint(clientX, clientY) {
  if (!dom.dashboardLayoutElement) {
    return null;
  }

  const hitElements = document.elementsFromPoint(clientX, clientY);

  for (const hitElement of hitElements) {
    if (!(hitElement instanceof Element)) {
      continue;
    }

    const cardElement = hitElement.closest("[data-dashboard-card-id]");

    if (cardElement && dom.dashboardLayoutElement.contains(cardElement)) {
      return cardElement;
    }
  }

  let closestCard = null;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (const cardElement of getDashboardCardElements()) {
    const rect = cardElement.getBoundingClientRect();
    const xDistance =
      clientX < rect.left ? rect.left - clientX : clientX > rect.right ? clientX - rect.right : 0;
    const yDistance =
      clientY < rect.top ? rect.top - clientY : clientY > rect.bottom ? clientY - rect.bottom : 0;
    const distance = xDistance * xDistance + yDistance * yDistance;

    if (distance < closestDistance) {
      closestDistance = distance;
      closestCard = cardElement;
    }
  }

  return closestCard;
}

function getDashboardDropPosition(cardElement, clientY) {
  const rect = cardElement.getBoundingClientRect();
  const middleY = rect.top + rect.height / 2;

  return clientY < middleY ? "before" : "after";
}

function reorderDashboardCardOrder(cardOrder, movingCardId, targetCardId, dropPosition) {
  if (movingCardId === targetCardId) {
    return cardOrder;
  }

  const nextOrder = cardOrder.filter((cardId) => cardId !== movingCardId);
  const targetIndex = nextOrder.indexOf(targetCardId);

  if (targetIndex === -1) {
    return cardOrder;
  }

  const insertIndex = dropPosition === "before" ? targetIndex : targetIndex + 1;
  nextOrder.splice(insertIndex, 0, movingCardId);

  return nextOrder;
}

function haveSameCardOrder(firstOrder, secondOrder) {
  if (firstOrder === secondOrder) {
    return true;
  }

  if (!Array.isArray(firstOrder) || !Array.isArray(secondOrder)) {
    return false;
  }

  if (firstOrder.length !== secondOrder.length) {
    return false;
  }

  for (let index = 0; index < firstOrder.length; index += 1) {
    if (firstOrder[index] !== secondOrder[index]) {
      return false;
    }
  }

  return true;
}

function renderDashboardLayout() {
  if (!dom.dashboardLayoutElement) {
    return;
  }

  const availableCards = new Map(
    getDashboardCardElements().map((cardElement) => [
      cardElement.dataset.dashboardCardId,
      cardElement,
    ]),
  );
  const nextOrder = normalizeDashboardCardOrder(
    state.layout.cardOrder,
    Array.from(availableCards.keys()),
  );
  const fragment = document.createDocumentFragment();

  state.layout.cardOrder = nextOrder;

  for (const cardId of nextOrder) {
    const cardElement = availableCards.get(cardId);

    if (cardElement) {
      fragment.appendChild(cardElement);
    }
  }

  dom.dashboardLayoutElement.appendChild(fragment);
  updateDashboardDragClasses();
}

async function persistDashboardLayout() {
  return writeStoredValue(STORAGE_KEYS.cardOrder, state.layout.cardOrder);
}

// Restoring the layout is just moving existing cards into the saved ID order.
async function loadSavedDashboardLayout() {
  if (!dom.dashboardLayoutElement) {
    return;
  }

  const savedCardOrder = await readStoredValue(STORAGE_KEYS.cardOrder, []);
  state.layout.cardOrder = normalizeDashboardCardOrder(savedCardOrder);
  renderDashboardLayout();
  await persistDashboardLayout();
}

// Drag start begins from the handle so inner controls stay clickable and safe.
function handleDashboardDragStart(event) {
  if (!dom.dashboardLayoutElement) {
    return;
  }

  const handleElement = event.target.closest("[data-dashboard-card-handle]");

  if (!handleElement || !dom.dashboardLayoutElement.contains(handleElement)) {
    return;
  }

  const cardElement = handleElement.closest("[data-dashboard-card-id]");

  if (!cardElement || !event.dataTransfer) {
    return;
  }

  const cardId = cardElement.dataset.dashboardCardId;

  if (!cardId) {
    return;
  }

  state.layout.draggingCardId = cardId;
  state.layout.dropTargetCardId = null;
  state.layout.dropPosition = null;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/x-newtab-card-order", cardId);
  event.dataTransfer.setData("text/plain", cardId);

  updateDashboardDragClasses();
}

// Drag over works by finding the nearest card and deciding whether the drop
// should land before or after that card based on the pointer position.
function handleDashboardDragOver(event) {
  if (!dom.dashboardLayoutElement || !state.layout.draggingCardId || !event.dataTransfer) {
    return;
  }

  const dragTypes = Array.from(event.dataTransfer.types || []);

  if (
    !dragTypes.includes("application/x-newtab-card-order") &&
    !dragTypes.includes("text/plain")
  ) {
    return;
  }

  event.preventDefault();

  const targetCard = getDashboardCardFromPoint(event.clientX, event.clientY);

  if (!targetCard) {
    state.layout.dropTargetCardId = null;
    state.layout.dropPosition = null;
    updateDashboardDragClasses();
    return;
  }

  const targetCardId = targetCard.dataset.dashboardCardId;

  if (!targetCardId) {
    return;
  }

  const dropPosition = getDashboardDropPosition(targetCard, event.clientY);
  event.dataTransfer.dropEffect = "move";

  if (
    state.layout.dropTargetCardId === targetCardId &&
    state.layout.dropPosition === dropPosition
  ) {
    return;
  }

  setDashboardDropTarget(targetCardId, dropPosition);
  event.dataTransfer.dropEffect = "move";
}

// Drop converts the dragged card ID back into a saved order array and then
// re-renders the layout from that array so the DOM and storage stay in sync.
async function handleDashboardDrop(event) {
  event.preventDefault();

  const movingCardId = state.layout.draggingCardId;
  const targetCard = getDashboardCardFromPoint(event.clientX, event.clientY);
  const targetCardId = targetCard ? targetCard.dataset.dashboardCardId || "" : "";
  const dropPosition = targetCard ? getDashboardDropPosition(targetCard, event.clientY) : "after";

  clearDashboardDragState();

  if (!movingCardId || !targetCardId) {
    return;
  }

  const nextOrder = reorderDashboardCardOrder(
    state.layout.cardOrder,
    movingCardId,
    targetCardId,
    dropPosition,
  );

  if (haveSameCardOrder(nextOrder, state.layout.cardOrder)) {
    return;
  }

  state.layout.cardOrder = nextOrder;
  renderDashboardLayout();
  await persistDashboardLayout();
}

function handleDashboardDragEnd() {
  clearDashboardDragState();
}

export async function initDashboardLayout() {
  if (!dom.dashboardLayoutElement) {
    return;
  }

  await loadSavedDashboardLayout();

  if (state.ui.dashboardLayoutListenersBound) {
    return;
  }

  dom.dashboardLayoutElement.addEventListener("dragstart", handleDashboardDragStart);
  dom.dashboardLayoutElement.addEventListener("dragover", handleDashboardDragOver);
  dom.dashboardLayoutElement.addEventListener("drop", (event) => {
    void handleDashboardDrop(event);
  });
  dom.dashboardLayoutElement.addEventListener("dragend", handleDashboardDragEnd);
  state.ui.dashboardLayoutListenersBound = true;
}
