import {
  BACKGROUND_OPTIONS,
  CUSTOM_BACKGROUND_ID,
  CUSTOM_BACKGROUND_MAX_BYTES,
  DEFAULT_BACKGROUND_ID,
  readStoredValue,
  setStatus,
  storageArea,
  writeStoredValue,
  STORAGE_KEYS,
} from "./shared.js";
import { dom } from "./dom.js";
import { state } from "./state.js";

function setBackgroundStatus(message, type = "idle") {
  setStatus(dom.backgroundStatusElement, message, type);
}

function isKnownBackground(backgroundId) {
  return BACKGROUND_OPTIONS.some((option) => option.id === backgroundId);
}

function hasCustomBackground() {
  return Boolean(state.background.customImage && state.background.customImage.dataUrl);
}

function getPresetBackgroundLabel(backgroundId) {
  const option = BACKGROUND_OPTIONS.find((item) => item.id === backgroundId);
  const defaultOption = BACKGROUND_OPTIONS[0];
  return option ? option.label : defaultOption.label;
}

function applyPresetBackgroundStyles(backgroundId) {
  if (!document.body) {
    return;
  }

  document.body.dataset.background = backgroundId;
  document.body.style.removeProperty("--page-bg-image");
  document.body.style.removeProperty("--page-overlay");
}

function applyCustomBackgroundStyles(dataUrl) {
  if (!document.body) {
    return;
  }

  document.body.dataset.background = CUSTOM_BACKGROUND_ID;
  document.body.style.setProperty("--page-bg-image", `url(${JSON.stringify(dataUrl)})`);
  document.body.style.setProperty(
    "--page-overlay",
    [
      "linear-gradient(180deg, rgba(255, 255, 255, 0.36), rgba(248, 250, 252, 0.32))",
      "radial-gradient(circle at top left, rgba(255, 255, 255, 0.24), transparent 42%)",
      "radial-gradient(circle at bottom right, rgba(148, 163, 184, 0.14), transparent 40%)",
    ].join(", "),
  );
}

function renderBackgroundSelection() {
  const customImageActive =
    state.background.selectedId === CUSTOM_BACKGROUND_ID && hasCustomBackground();

  if (customImageActive && state.background.customImage) {
    applyCustomBackgroundStyles(state.background.customImage.dataUrl);
  } else {
    const activeBackgroundId = isKnownBackground(state.background.selectedId)
      ? state.background.selectedId
      : DEFAULT_BACKGROUND_ID;

    if (state.background.selectedId !== activeBackgroundId) {
      state.background.selectedId = activeBackgroundId;
    }

    applyPresetBackgroundStyles(activeBackgroundId);
  }

  for (const button of dom.backgroundOptionButtons) {
    const isSelected =
      button.dataset.backgroundId === state.background.selectedId && !customImageActive;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
  }

  if (dom.customBackgroundUseButton) {
    dom.customBackgroundUseButton.hidden = !hasCustomBackground() || customImageActive;
  }

  if (dom.customBackgroundClearButton) {
    dom.customBackgroundClearButton.hidden = !hasCustomBackground();
  }

  if (!hasCustomBackground()) {
    setStatus(dom.customBackgroundStatusElement, "No custom image uploaded yet.", "idle");
  } else if (customImageActive) {
    setStatus(dom.customBackgroundStatusElement, "Custom image is active.", "saved");
  } else {
    setStatus(
      dom.customBackgroundStatusElement,
      "Custom image is saved. Use it again or remove it.",
      "saved",
    );
  }
}

function applyBackgroundSelection(backgroundId) {
  const nextBackgroundId = isKnownBackground(backgroundId) ? backgroundId : DEFAULT_BACKGROUND_ID;

  state.background.selectedId = nextBackgroundId;
  renderBackgroundSelection();

  if (storageArea) {
    setBackgroundStatus(`Using ${getPresetBackgroundLabel(nextBackgroundId)}. Saved automatically.`, "saved");
  } else {
    setBackgroundStatus(
      `Using ${getPresetBackgroundLabel(nextBackgroundId)}. Changes won't persist.`,
      "error",
    );
  }
}

async function loadSavedBackground() {
  if (!dom.backgroundStatusElement) {
    return;
  }

  const fallbackBackground = {
    selectedId: DEFAULT_BACKGROUND_ID,
    customImage: null,
  };
  const savedBackground = await readStoredValue(STORAGE_KEYS.background, fallbackBackground);

  if (typeof savedBackground === "string") {
    state.background.selectedId = isKnownBackground(savedBackground)
      ? savedBackground
      : DEFAULT_BACKGROUND_ID;
    state.background.customImage = null;
  } else if (savedBackground && typeof savedBackground === "object") {
    const storedCustomImage =
      savedBackground.customImage &&
      typeof savedBackground.customImage.dataUrl === "string" &&
      typeof savedBackground.customImage.name === "string"
        ? {
            dataUrl: savedBackground.customImage.dataUrl,
            name: savedBackground.customImage.name,
            type: String(savedBackground.customImage.type || ""),
            size: Number(savedBackground.customImage.size || 0),
          }
        : null;

    state.background.customImage = storedCustomImage;
    state.background.selectedId =
      savedBackground.selectedId === CUSTOM_BACKGROUND_ID && storedCustomImage
        ? CUSTOM_BACKGROUND_ID
        : isKnownBackground(savedBackground.selectedId)
          ? savedBackground.selectedId
          : DEFAULT_BACKGROUND_ID;
  } else {
    state.background.selectedId = DEFAULT_BACKGROUND_ID;
    state.background.customImage = null;
  }

  renderBackgroundSelection();
  const activeLabel =
    state.background.selectedId === CUSTOM_BACKGROUND_ID && hasCustomBackground()
      ? "Custom image"
      : getPresetBackgroundLabel(state.background.selectedId);

  setBackgroundStatus(
    storageArea
      ? `Using ${activeLabel}. Saved automatically.`
      : `Using ${activeLabel}. Changes won't persist.`,
    storageArea ? "saved" : "error",
  );
}

async function persistBackground() {
  return writeStoredValue(STORAGE_KEYS.background, {
    selectedId: state.background.selectedId,
    customImage: state.background.customImage,
  });
}

async function handleBackgroundSelection(event) {
  const button = event.target.closest("[data-background-id]");

  if (!button) {
    return;
  }

  applyBackgroundSelection(button.dataset.backgroundId);
  const saved = await persistBackground();

  if (!saved) {
    setBackgroundStatus("Background could not be saved.", "error");
  }
}

function clearCustomBackgroundSelection() {
  if (!hasCustomBackground()) {
    return;
  }

  state.background.customImage = null;

  if (state.background.selectedId === CUSTOM_BACKGROUND_ID) {
    state.background.selectedId = DEFAULT_BACKGROUND_ID;
  }

  renderBackgroundSelection();
}

function useCustomBackgroundSelection() {
  if (!hasCustomBackground()) {
    return;
  }

  state.background.selectedId = CUSTOM_BACKGROUND_ID;
  renderBackgroundSelection();
}

function handleCustomBackgroundFileError(message) {
  setStatus(dom.customBackgroundStatusElement, message, "error");
  if (dom.customBackgroundInputElement) {
    dom.customBackgroundInputElement.value = "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };

    reader.onerror = () => {
      reject(new Error("Unable to read file."));
    };

    reader.readAsDataURL(file);
  });
}

async function handleCustomBackgroundFileChange(event) {
  const input = event.target;
  const file = input.files && input.files[0];

  if (!file) {
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    handleCustomBackgroundFileError("Please choose a valid image file.");
    return;
  }

  if (file.size > CUSTOM_BACKGROUND_MAX_BYTES) {
    handleCustomBackgroundFileError("That image is too large. Please use a file under 1.5 MB.");
    return;
  }

  try {
    const dataUrl = await readFileAsDataUrl(file);

    if (!dataUrl) {
      handleCustomBackgroundFileError("That image could not be loaded.");
      return;
    }

    state.background.customImage = {
      dataUrl,
      name: file.name,
      type: file.type,
      size: file.size,
    };
    state.background.selectedId = CUSTOM_BACKGROUND_ID;

    renderBackgroundSelection();
    if (dom.customBackgroundInputElement) {
      dom.customBackgroundInputElement.value = "";
    }

    const saved = await persistBackground();

    if (saved) {
      setBackgroundStatus("Using custom image. Saved automatically.", "saved");
      setStatus(dom.customBackgroundStatusElement, "Custom image saved locally.", "saved");
    } else {
      handleCustomBackgroundFileError("The image could not be saved locally.");
      setBackgroundStatus("Custom image could not be saved locally.", "error");
    }
  } catch (error) {
    console.warn("New Tab Dashboard: failed to load custom background image.", error);
    handleCustomBackgroundFileError("That image could not be loaded.");
  }
}

async function handleCustomBackgroundClear() {
  if (!hasCustomBackground()) {
    return;
  }

  const shouldRemove = window.confirm(
    "Remove the custom background image and revert to presets?",
  );

  if (!shouldRemove) {
    return;
  }

  clearCustomBackgroundSelection();
  const saved = await persistBackground();
  if (saved) {
    setBackgroundStatus(
      `Using ${getPresetBackgroundLabel(state.background.selectedId)}. Saved automatically.`,
      "saved",
    );
    setStatus(dom.customBackgroundStatusElement, "Custom image removed.", "saved");
  } else {
    setBackgroundStatus("Custom image could not be removed from storage.", "error");
    setStatus(
      dom.customBackgroundStatusElement,
      "Custom image removal could not be saved.",
      "error",
    );
  }
}

async function handleCustomBackgroundUse() {
  if (!hasCustomBackground()) {
    return;
  }

  useCustomBackgroundSelection();
  const saved = await persistBackground();
  if (saved) {
    setBackgroundStatus("Using custom image. Saved automatically.", "saved");
  } else {
    setBackgroundStatus("Custom image could not be saved.", "error");
  }
}

export async function resetBackground() {
  state.background.customImage = null;
  state.background.selectedId = DEFAULT_BACKGROUND_ID;

  if (dom.customBackgroundInputElement) {
    dom.customBackgroundInputElement.value = "";
  }

  renderBackgroundSelection();
  const saved = await persistBackground();
  setBackgroundStatus(
    `Using ${getPresetBackgroundLabel(DEFAULT_BACKGROUND_ID)}. Saved automatically.`,
    saved ? "saved" : "error",
  );

  if (!saved) {
    setBackgroundStatus("Background could not be reset in storage.", "error");
  }

  return saved;
}

export async function initBackgrounds() {
  if (!dom.backgroundOptionButtons.length || !dom.backgroundStatusElement) {
    return;
  }

  renderBackgroundSelection();
  await loadSavedBackground();

  for (const button of dom.backgroundOptionButtons) {
    button.addEventListener("click", handleBackgroundSelection);
  }

  dom.customBackgroundInputElement?.addEventListener("change", handleCustomBackgroundFileChange);
  dom.customBackgroundClearButton?.addEventListener("click", handleCustomBackgroundClear);
  dom.customBackgroundUseButton?.addEventListener("click", handleCustomBackgroundUse);
}
