import {
  createId,
  getTodayKey,
  openUrlInNewTab,
  readStoredValue,
  setStatus,
  STORAGE_KEYS,
  writeStoredValue,
} from "./shared.js";
import { dom } from "./dom.js";
import { state } from "./state.js";

const USD_TO_GBP_RATE = 0.75;
const DAY_MS = 24 * 60 * 60 * 1000;

const GBP_FORMATTER = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const USD_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const MINI_CHART_VIEWBOX_WIDTH = 100;
const MINI_CHART_VIEWBOX_HEIGHT = 24;
const MINI_CHART_TRACK_Y = 3;
const MINI_CHART_TRACK_HEIGHT = 18;

const DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const QUICK_LINKS = [
  {
    id: "user-testing-dashboard",
    title: "UserTesting dashboard",
    description: "network.usertesting.com",
    url: "https://network.usertesting.com/dashboard",
  },
  {
    id: "user-testing-tests",
    title: "Available tests",
    description: "app.usertesting.com",
    url: "https://app.usertesting.com/my_dashboard/available_tests_v3",
  },
  {
    id: "prolific-studies",
    title: "Prolific studies",
    description: "app.prolific.com",
    url: "https://app.prolific.com/studies",
  },
];

function setEarningsMessage(message, type = "info") {
  setStatus(dom.earningsMessageElement, message, type);
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function formatMoney(amount, currency = "GBP") {
  const normalizedCurrency = currency === "USD" ? "USD" : "GBP";
  const value = roundMoney(amount);

  return normalizedCurrency === "USD" ? USD_FORMATTER.format(value) : GBP_FORMATTER.format(value);
}

function getLocalDateKey(offsetDays = 0, baseDate = new Date()) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + offsetDays);
  return getTodayKey(date);
}

function isValidEntryDate(createdAt) {
  const parsedDate = new Date(createdAt);
  return !Number.isNaN(parsedDate.getTime());
}

function normalizeEntry(entry) {
  const amount = Number.parseFloat(String(entry?.amount ?? ""));
  const amountGBP = Number.parseFloat(String(entry?.amountGBP ?? ""));
  const currency = String(entry?.currency || "GBP").toUpperCase() === "USD" ? "USD" : "GBP";
  const createdAt = typeof entry?.createdAt === "string" && isValidEntryDate(entry.createdAt)
    ? entry.createdAt
    : new Date().toISOString();
  const dateKey = typeof entry?.dateKey === "string" && entry.dateKey ? entry.dateKey : getTodayKey(new Date(createdAt));

  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const normalizedAmount = roundMoney(amount);
  const normalizedAmountGBP =
    Number.isFinite(amountGBP) && amountGBP > 0
      ? roundMoney(amountGBP)
      : roundMoney(currency === "USD" ? normalizedAmount * USD_TO_GBP_RATE : normalizedAmount);

  return {
    id: typeof entry?.id === "string" && entry.id ? entry.id : createId("earning"),
    amount: normalizedAmount,
    amountGBP: normalizedAmountGBP,
    currency,
    createdAt,
    dateKey,
  };
}

function sortEntries(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return rightTime - leftTime;
  });
}

async function loadSavedEarnings() {
  const storedEntries = await readStoredValue(STORAGE_KEYS.dailyEarnings, []);
  state.dailyEarnings.entries = Array.isArray(storedEntries)
    ? storedEntries.map(normalizeEntry).filter(Boolean)
    : [];
}

async function persistEarnings() {
  return writeStoredValue(STORAGE_KEYS.dailyEarnings, state.dailyEarnings.entries);
}

function resetEarningsForm(clearMessage = false) {
  dom.earningsFormElement?.reset();

  if (dom.earningsAmountInput) {
    dom.earningsAmountInput.focus();
  }

  if (clearMessage) {
    setEarningsMessage("");
  }
}

function getEntryDisplayDate(entry) {
  const createdAt = new Date(entry.createdAt);
  const todayKey = getTodayKey();
  const yesterdayKey = getLocalDateKey(-1);
  const entryKey = getTodayKey(createdAt);
  const timeText = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(createdAt);

  if (entryKey === todayKey) {
    return `Today, ${timeText}`;
  }

  if (entryKey === yesterdayKey) {
    return `Yesterday, ${timeText}`;
  }

  return `${DATE_FORMATTER.format(createdAt)}, ${timeText}`;
}

function getRollingTotal(entries, windowDays) {
  const maxAgeMs = windowDays * DAY_MS;
  const total = entries.reduce((sum, entry) => {
    const createdAtMs = new Date(entry.createdAt).getTime();

    if (!Number.isFinite(createdAtMs)) {
      return sum;
    }

    const ageMs = Date.now() - createdAtMs;

    if (ageMs < 0 || ageMs > maxAgeMs) {
      return sum;
    }

    return sum + entry.amountGBP;
  }, 0);

  return roundMoney(total);
}

function getEntriesTotalForDateKey(entries, dateKey) {
  return roundMoney(
    entries
      .filter((entry) => entry.dateKey === dateKey)
      .reduce((sum, entry) => sum + entry.amountGBP, 0),
  );
}

function buildChartBuckets(entries, windowDays) {
  const totalsByDateKey = new Map();

  for (const entry of entries) {
    const currentTotal = totalsByDateKey.get(entry.dateKey) || 0;
    totalsByDateKey.set(entry.dateKey, roundMoney(currentTotal + entry.amountGBP));
  }

  const tooltipFormatter = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const buckets = [];
  const today = new Date();

  for (let offset = windowDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(date.getDate() - offset);
    const dateKey = getTodayKey(date);
    const amountGBP = roundMoney(totalsByDateKey.get(dateKey) || 0);

    buckets.push({
      date,
      dateKey,
      amountGBP,
      tooltip: `${tooltipFormatter.format(date)} - ${formatMoney(amountGBP)}`,
    });
  }

  return buckets;
}

function updateSummaryTotals(entries) {
  const todayKey = getTodayKey();

  if (dom.earningsTodayTotalElement) {
    dom.earningsTodayTotalElement.textContent = formatMoney(
      getEntriesTotalForDateKey(entries, todayKey),
    );
  }

  if (dom.earningsYesterdayTotalElement) {
    dom.earningsYesterdayTotalElement.textContent = formatMoney(
      getEntriesTotalForDateKey(entries, getLocalDateKey(-1)),
    );
  }

  if (dom.earningsWeekTotalElement) {
    dom.earningsWeekTotalElement.textContent = formatMoney(getRollingTotal(entries, 7));
  }

  if (dom.earningsMonthTotalElement) {
    dom.earningsMonthTotalElement.textContent = formatMoney(getRollingTotal(entries, 30));
  }
}

function createMiniChartBuckets(entries, windowDays) {
  const buckets = buildChartBuckets(entries, windowDays);
  const maxAmount = buckets.reduce((max, bucket) => Math.max(max, bucket.amountGBP), 0);

  return buckets.map((bucket) => ({
    ...bucket,
    barHeight:
      maxAmount > 0 ? Math.max(bucket.amountGBP > 0 ? 2 : 0, (bucket.amountGBP / maxAmount) * 16) : 0,
  }));
}

function createMiniChartSvg(buckets) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${MINI_CHART_VIEWBOX_WIDTH} ${MINI_CHART_VIEWBOX_HEIGHT}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const count = Math.max(1, buckets.length);
  const step = MINI_CHART_VIEWBOX_WIDTH / count;

  for (const [index, bucket] of buckets.entries()) {
    const barX = index * step + 0.8;
    const barWidth = Math.max(0.85, step - 1.6);

    const track = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    track.setAttribute("x", String(barX));
    track.setAttribute("y", String(MINI_CHART_TRACK_Y));
    track.setAttribute("width", String(barWidth));
    track.setAttribute("height", String(MINI_CHART_TRACK_HEIGHT));
    track.setAttribute("rx", "1.5");
    track.setAttribute("fill", "rgba(17, 24, 39, 0.07)");

    const fill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    fill.setAttribute("x", String(barX));
    fill.setAttribute("y", String(MINI_CHART_TRACK_Y + MINI_CHART_TRACK_HEIGHT - bucket.barHeight));
    fill.setAttribute("width", String(barWidth));
    fill.setAttribute("height", String(bucket.barHeight));
    fill.setAttribute("rx", "1.5");
    fill.setAttribute("fill", "rgba(17, 24, 39, 0.88)");

    if (bucket.amountGBP <= 0) {
      fill.setAttribute("opacity", "0");
    }

    svg.append(track, fill);
  }

  return svg;
}

function renderMiniChart(chartElement, windowDays, entries) {
  if (!chartElement) {
    return;
  }

  const buckets = createMiniChartBuckets(entries, windowDays);

  chartElement.classList.toggle(
    "earnings-summary__mini-chart--empty",
    buckets.every((bucket) => bucket.amountGBP <= 0),
  );
  chartElement.replaceChildren(createMiniChartSvg(buckets));
}

function createEarningsEntryElement(entry) {
  const item = document.createElement("li");
  item.className = "earnings-entry";
  item.dataset.earningsEntryId = entry.id;

  const main = document.createElement("div");
  main.className = "earnings-entry__main";

  const amounts = document.createElement("div");
  amounts.className = "earnings-entry__amounts";

  const gbpAmount = document.createElement("strong");
  gbpAmount.className = "earnings-entry__gbp";
  gbpAmount.textContent = formatMoney(entry.amountGBP);

  amounts.appendChild(gbpAmount);

  if (entry.currency === "USD") {
    const sourceAmount = document.createElement("span");
    sourceAmount.className = "earnings-entry__source";
    sourceAmount.textContent = `${formatMoney(entry.amount, "USD")} converted at 0.75`;
    amounts.appendChild(sourceAmount);
  }

  const meta = document.createElement("p");
  meta.className = "earnings-entry__meta";
  meta.textContent = getEntryDisplayDate(entry);

  main.append(amounts, meta);

  const deleteButton = document.createElement("button");
  deleteButton.className = "earnings-entry__delete";
  deleteButton.type = "button";
  deleteButton.dataset.earningsAction = "delete";
  deleteButton.dataset.earningsEntryId = entry.id;
  deleteButton.textContent = "Delete";

  item.append(main, deleteButton);

  return item;
}

function createQuickLinkButton(link) {
  const button = document.createElement("button");
  button.className = "earnings-link-button";
  button.type = "button";
  button.dataset.earningsLinkUrl = link.url;
  button.dataset.earningsLinkTitle = link.title;

  const eyebrow = document.createElement("span");
  eyebrow.className = "earnings-link-button__eyebrow";
  eyebrow.textContent = "Open tab";

  const title = document.createElement("span");
  title.className = "earnings-link-button__title";
  title.textContent = link.title;

  const meta = document.createElement("span");
  meta.className = "earnings-link-button__meta";
  meta.textContent = link.description;

  button.append(eyebrow, title, meta);

  return button;
}

async function openLinkInNewTab(url) {
  return openUrlInNewTab(url);
}

function renderQuickLinks() {
  if (!dom.earningsLinksGridElement) {
    return;
  }

  dom.earningsLinksGridElement.replaceChildren(
    ...QUICK_LINKS.map((link) => createQuickLinkButton(link)),
  );
}

function renderDailyEarnings() {
  const entries = sortEntries(state.dailyEarnings.entries);
  state.dailyEarnings.entries = entries;
  const recentEntries = entries.slice(0, 2);

  updateSummaryTotals(entries);
  renderMiniChart(dom.earningsWeekMiniChartElement, 7, entries);
  renderMiniChart(dom.earningsMonthMiniChartElement, 30, entries);

  if (dom.earningsListElement) {
    dom.earningsListElement.replaceChildren(
      ...recentEntries.map((entry) => createEarningsEntryElement(entry)),
    );
  }

  if (dom.earningsEmptyStateElement) {
    dom.earningsEmptyStateElement.hidden = recentEntries.length > 0;
  }
}

async function handleEarningsFormSubmit(event) {
  event.preventDefault();

  if (!dom.earningsAmountInput) {
    return;
  }

  const amount = Number.parseFloat(dom.earningsAmountInput.value);
  const currency = String(dom.earningsCurrencySelect?.value || "GBP").toUpperCase() === "USD" ? "USD" : "GBP";

  if (!Number.isFinite(amount) || amount <= 0) {
    setEarningsMessage("Enter a positive amount before saving.", "error");
    dom.earningsAmountInput.focus();
    return;
  }

  const normalizedAmount = roundMoney(amount);
  const amountGBP = roundMoney(currency === "USD" ? normalizedAmount * USD_TO_GBP_RATE : normalizedAmount);

  state.dailyEarnings.entries = [
    {
      id: createId("earning"),
      amount: normalizedAmount,
      amountGBP,
      currency,
      createdAt: new Date().toISOString(),
      dateKey: getTodayKey(),
    },
    ...state.dailyEarnings.entries,
  ];

  await persistEarnings();
  renderDailyEarnings();
  resetEarningsForm(true);
  setEarningsMessage(`Saved ${formatMoney(amountGBP)}.`, "success");
}

async function deleteEarningsEntry(entryId) {
  const nextEntries = state.dailyEarnings.entries.filter((entry) => entry.id !== entryId);

  if (nextEntries.length === state.dailyEarnings.entries.length) {
    return;
  }

  state.dailyEarnings.entries = nextEntries;
  await persistEarnings();
  renderDailyEarnings();
  setEarningsMessage("Entry deleted.", "success");
}

function handleEarningsListClick(event) {
  const actionButton = event.target.closest("[data-earnings-action]");

  if (!actionButton) {
    return;
  }

  const action = actionButton.dataset.earningsAction;
  const entryId = actionButton.dataset.earningsEntryId;
  const entry = state.dailyEarnings.entries.find((item) => item.id === entryId);

  if (action === "delete" && entryId && entry) {
    const shouldDelete = window.confirm(
      `Delete ${formatMoney(entry.amountGBP)} from ${getEntryDisplayDate(entry)}?`,
    );

    if (shouldDelete) {
      void deleteEarningsEntry(entryId);
    }
  }
}

async function handleQuickLinksClick(event) {
  const linkButton = event.target.closest("[data-earnings-link-url]");

  if (!linkButton) {
    return;
  }

  const url = linkButton.dataset.earningsLinkUrl;
  const opened = await openLinkInNewTab(url);

  if (!opened) {
    setEarningsMessage("Chrome may have blocked the tab. Try allowing pop-ups for this page.", "error");
  }
}

async function openAllQuickLinks() {
  let openedCount = 0;

  for (const link of QUICK_LINKS) {
    if (await openLinkInNewTab(link.url)) {
      openedCount += 1;
    }
  }

  if (openedCount === QUICK_LINKS.length) {
    setEarningsMessage("Opened all three tabs.", "success");
  } else if (openedCount > 0) {
    setEarningsMessage("Opened some tabs. Chrome may have blocked the rest.", "error");
  } else {
    setEarningsMessage("Chrome blocked the tabs. Allow pop-ups and try again.", "error");
  }
}

function bindDailyEarningsListeners() {
  if (state.ui.dailyEarningsListenersBound) {
    return;
  }

  dom.earningsFormElement?.addEventListener("submit", (event) => {
    void handleEarningsFormSubmit(event);
  });
  dom.earningsListElement?.addEventListener("click", handleEarningsListClick);
  dom.earningsLinksGridElement?.addEventListener("click", handleQuickLinksClick);
  dom.earningsOpenAllButton?.addEventListener("click", () => {
    void openAllQuickLinks();
  });

  state.ui.dailyEarningsListenersBound = true;
}

export async function initDailyEarnings() {
  await loadSavedEarnings();
  bindDailyEarningsListeners();
  renderQuickLinks();
  renderDailyEarnings();
}
