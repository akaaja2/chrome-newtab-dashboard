# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Chrome Extension (Manifest V3) that replaces the new tab page with a dashboard. Plain ES modules, HTML and CSS, with no dependencies, build step, bundler or linter. Keep it dependency-free.

## Running

- Load it in Chrome: `chrome://extensions` → Developer mode → **Load unpacked** → select this folder. After an edit, click reload on the extension card and open a new tab.
- Local `file:///` links and dashboards need **Allow access to file URLs** turned on for the extension.
- If you open `newtab.html` directly (e.g. through a static server) the page still renders, but `chrome.storage` is missing. `storageArea` in `shared.js` is then `null`, nothing persists, and modules show a storage error status. `openUrlInNewTab` falls back to `window.open`.

## Tests

- `npm test` (same as `node --test "tests/*.test.mjs"`) runs all suites: `shared.test.mjs` (pure helpers), `release.test.mjs` (manifest, CSP, no remote resources, no personal data, Ko-fi link), `markup.test.mjs` (HTML escaping) and `package.test.mjs` (release ZIP contents). `npm run package` builds `dist/new-tab-dashboard-<version>.zip`. Both must pass before an issue goes to In Review.
- Keep the test glob quoted: on Windows, `node --test tests/` fails. Only modules that don't touch `document` at import time can be tested this way, so `dom.js` and the feature modules can't. Put testable logic in `shared.js`.

## Architecture

- **Entry point**: `newtab.html` loads only `bootstrap.js` (`type="module"`). `bootstrap.js` awaits `initDashboardLayout()` first, because card order, minimized and pinned state have to be applied before content renders. Then it runs every other feature's `init*()` in parallel, then starts the clock and pomodoro tickers.
- **Shared modules**:
  - `shared.js`: `STORAGE_KEYS` (all keys are namespaced `dashboard.*`), constants (`DASHBOARD_CARD_ORDER`, `POMODORO_MODES`, background and card-surface options, task priorities), `storageArea`, the async `readStoredValue`/`writeStoredValue` wrappers around `chrome.storage.local`, and helpers such as `normalizeUrl` (it also turns Windows paths into `file:///` URLs), `escapeHtml`, `setStatus`, `createId` and `openUrlInNewTab`.
  - `state.js`: one mutable `state` object, with a slice per feature. `state.ui.*ListenersBound` flags stop event listeners from being bound twice when an init/render runs again.
  - `dom.js`: one `dom` object that caches every element reference by id or selector. When you add markup to `newtab.html`, register the element here and don't query the DOM inside feature modules.
- **Feature modules** (`links.js`, `dashboards.js`, `daily-earnings.js`, `tasks.js`, `notes.js`, `pomodoro.js`, `quotes.js`, `backgrounds.js`, `card-surface.js`, `clock.js`) each export an `init*()`. Most also export a `reset*()`/`clear*()`, which `settings.js` calls for its reset actions. The usual pattern: read from storage into `state` → render from `state` → on user action, mutate `state`, `writeStoredValue`, re-render.
- **Cross-module coupling**: `pomodoro.js` imports `getTaskFromDragData` from `tasks.js`, so dragging a task onto the timer starts a labelled focus session. `settings.js` imports the reset functions from the feature modules.
- **Card layout** (`layout.js`): every card in `newtab.html` is a `section.dashboard-card` with `data-dashboard-card-id`, sized by `dashboard-card--half`/`--full`. `layout.js` handles drag-to-reorder, minimize and pin, and saves them under `cardOrder`/`cardMinimized`/`cardPinned`. To add a card, add the markup with a new id, add the id to `DASHBOARD_CARD_ORDER` in `shared.js`, and write an init that `bootstrap.js` calls. Saved orders are normalized against the cards that exist, so new cards also show up for existing users.
- **Dashboards card**: `dashboards.js` `fetch()`es local HTML files to read their `<title>`, and uses the file name when that fails.
- **Cross-tab sync** (`sync.js`): each open new tab has its own copy of the data in memory and saves whole lists back. If `chrome.storage` changes while a tab is hidden, the tab reloads itself when it's shown again, so it can't overwrite newer data.
- **Backup** (`settings.js`, with `buildBackup`/`parseBackup` in `shared.js`): export and import every `STORAGE_KEYS` value as JSON. Import only accepts known keys, then reloads the page. New storage keys added to `STORAGE_KEYS` are included automatically.
- **Custom background images** are stored as data in `chrome.storage.local` and capped at `CUSTOM_BACKGROUND_MAX_BYTES` (~1.5 MB).

## Dev workflow (Linear)

Dev work is led from the Linear project "New Tab Dashboard (Chrome extension)" (team ERD). Run `/next-issue` to pick the top Todo issue, implement it on its Linear branch, test it, and move it to In Review with a comment. Never mark an issue Done. Full loop, test matrix and definition of done: `DEV-WORKFLOW.md`. Permissions are `storage` only (a test enforces this); do not add permissions without an issue that justifies them. The Ko-fi URL lives in `KOFI_URL` in `shared.js`.

## Other files

- `BACKLOG.md`: the user's feature backlog. The README also has a roadmap.
- `blog-post.md`: prose about the project, not code. Not shipped.
- `DEV-WORKFLOW.md`, `INSTALL.md`, `PRIVACY.md`, `docs/QA.md`, `docs/WEBSTORE.md`, `scripts/package.mjs`: process, docs and release tooling. None ship in the ZIP.
