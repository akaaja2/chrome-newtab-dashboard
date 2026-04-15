import { initDashboardLayout } from "./layout.js";
import { initFavouriteLinks } from "./links.js";
import { initDailyEarnings } from "./daily-earnings.js";
import { initTodoList } from "./tasks.js";
import { initNotes } from "./notes.js";
import { initRotatingQuotes, stopRotatingQuotesTicker } from "./quotes.js";
import { initPomodoro, startPomodoroTicker, stopPomodoroTicker } from "./pomodoro.js";
import { initBackgrounds } from "./backgrounds.js";
import { initCardSurface } from "./card-surface.js";
import { initSettings } from "./settings.js";
import { startClockTicker } from "./clock.js";

async function bootstrap() {
  await initDashboardLayout();

  await Promise.all([
    initFavouriteLinks(),
    initDailyEarnings(),
    initTodoList(),
    initNotes(),
    initRotatingQuotes(),
    initPomodoro(),
    initBackgrounds(),
    initCardSurface(),
    initSettings(),
  ]);

  startClockTicker();
  startPomodoroTicker();
  window.addEventListener("beforeunload", stopRotatingQuotesTicker);
  window.addEventListener("beforeunload", stopPomodoroTicker);
}

void bootstrap();
