import { dom } from "./dom.js";
import { state } from "./state.js";

const QUOTES = [
  {
    text: "Start where you are. Momentum will meet you there.",
    source: "Daily reminder",
  },
  {
    text: "One clean decision can change the shape of the day.",
    source: "Daily reminder",
  },
  {
    text: "Progress is built in small, repeatable wins.",
    source: "Daily reminder",
  },
  {
    text: "You do not need a perfect plan to make a useful move.",
    source: "Daily reminder",
  },
  {
    text: "The next step matters more than the noisy rest of the map.",
    source: "Daily reminder",
  },
  {
    text: "Consistency turns intention into evidence.",
    source: "Daily reminder",
  },
  {
    text: "Make the work smaller, then make it happen.",
    source: "Daily reminder",
  },
  {
    text: "A focused minute is still a move forward.",
    source: "Daily reminder",
  },
];

const prefersReducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ROTATION_INTERVAL_MS = prefersReducedMotion ? 24000 : 15000;

function getNormalizedQuoteIndex(index) {
  if (!QUOTES.length) {
    return 0;
  }

  const safeIndex = Number(index) || 0;
  return ((safeIndex % QUOTES.length) + QUOTES.length) % QUOTES.length;
}

function getInitialQuoteIndex(referenceDate = new Date()) {
  if (!QUOTES.length) {
    return 0;
  }

  return Math.floor(referenceDate.getTime() / ROTATION_INTERVAL_MS) % QUOTES.length;
}

function getCurrentQuote() {
  return QUOTES[getNormalizedQuoteIndex(state.quotes.currentIndex)] || QUOTES[0];
}

function renderRotatingQuote() {
  if (!dom.quotesTextElement || !dom.quotesAuthorElement || !dom.quotesCounterElement) {
    return;
  }

  const quoteIndex = getNormalizedQuoteIndex(state.quotes.currentIndex);
  const quote = getCurrentQuote();

  dom.quotesTextElement.textContent = quote.text;
  dom.quotesAuthorElement.textContent = quote.source;
  dom.quotesCounterElement.textContent = `Quote ${quoteIndex + 1} of ${QUOTES.length}`;

  if (dom.quotesCardElement) {
    dom.quotesCardElement.dataset.quoteIndex = String(quoteIndex);
  }
}

function advanceRotatingQuote() {
  if (!QUOTES.length) {
    return;
  }

  state.quotes.currentIndex = getNormalizedQuoteIndex(state.quotes.currentIndex + 1);
  renderRotatingQuote();
}

function handleQuotesNextClick() {
  advanceRotatingQuote();
}

export function stopRotatingQuotesTicker() {
  if (state.quotes.rotationIntervalId !== null) {
    clearInterval(state.quotes.rotationIntervalId);
    state.quotes.rotationIntervalId = null;
  }
}

function startRotatingQuotesTicker() {
  stopRotatingQuotesTicker();

  if (!QUOTES.length) {
    return;
  }

  state.quotes.rotationIntervalId = window.setInterval(advanceRotatingQuote, ROTATION_INTERVAL_MS);
}

export async function initRotatingQuotes() {
  if (!dom.quotesTextElement || !dom.quotesAuthorElement || !dom.quotesCounterElement) {
    return;
  }

  state.quotes.currentIndex = getInitialQuoteIndex();
  renderRotatingQuote();
  startRotatingQuotesTicker();

  if (dom.quotesNextButton && !state.ui.quotesListenersBound) {
    dom.quotesNextButton.addEventListener("click", handleQuotesNextClick);
    state.ui.quotesListenersBound = true;
  }
}
