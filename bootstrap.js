import { initDashboardLayout } from "./layout.js";
import { initFavouriteLinks } from "./links.js";
import { initTodoList } from "./tasks.js";
import { initNotes } from "./notes.js";
import { initPomodoro, startPomodoroTicker, stopPomodoroTicker } from "./pomodoro.js";
import { initBackgrounds } from "./backgrounds.js";
import { initSettings } from "./settings.js";
import { startClockTicker } from "./clock.js";

async function bootstrap() {
  await initDashboardLayout();

  await Promise.all([
    initFavouriteLinks(),
    initTodoList(),
    initNotes(),
    initPomodoro(),
    initBackgrounds(),
    initSettings(),
  ]);

  startClockTicker();
  startPomodoroTicker();
  window.addEventListener("beforeunload", stopPomodoroTicker);
}

void bootstrap();

