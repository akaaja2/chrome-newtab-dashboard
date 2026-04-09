import { dom } from "./dom.js";
import { maybeResetPomodoroForNewDay } from "./pomodoro.js";

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

export function renderClock() {
  if (!dom.clockTimeElement || !dom.clockDateElement) {
    return;
  }

  const { time, dateText } = formatClockParts(new Date());

  dom.clockTimeElement.textContent = time;
  dom.clockDateElement.textContent = dateText;
  void maybeResetPomodoroForNewDay();
}

export function startClockTicker() {
  renderClock();
  window.setInterval(renderClock, 1000);
}

