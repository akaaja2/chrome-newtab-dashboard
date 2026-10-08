# New Tab Dashboard

A small Chrome Extension Manifest V3 project that replaces the default new tab page with a lightweight dashboard.

## Features

- Live 24-hour clock and readable date
- Pomodoro timer with work and break modes
- Rotating motivational quotes
- Drag a task onto the timer to start a focus session
- Favourite links with add, edit, and delete actions
- Daily earnings tracker with GBP totals and USD conversion
- Quick-launch tabs for UserTesting and Prolific
- Backup export and import
- Local HTML dashboard cards for saved file paths and `file:///` URLs
- To-do list with completion and removal controls
- Quick notes with autosave
- Built-in geometric and local image backgrounds
- Optional patterned or opaque card surfaces
- User-uploaded custom background images
- Compact settings panel with reset actions
- Storage-backed persistence using `chrome.storage.local`

## How to load in Chrome

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `chrome-newtab-dashboard`.
5. Open a new tab to see the dashboard.

## File Structure

```text
chrome-newtab-dashboard/
|-- manifest.json
|-- newtab.html
|-- bootstrap.js
|-- clock.js
|-- dom.js
|-- layout.js
|-- quotes.js
|-- links.js
|-- dashboards.js
|-- daily-earnings.js
|-- notes.js
|-- backgrounds.js
|-- card-surface.js
|-- pomodoro.js
|-- settings.js
|-- shared.js
|-- state.js
|-- tasks.js
|-- styles.css
|-- README.md
|-- .gitignore
`-- assets/
    `-- backgrounds/
        |-- paper-drift.svg
        |-- sky-veil.svg
        |-- geometric-grid.svg
        |-- geometric-facet.svg
        |-- geometric-orbit.svg
        `-- geometric-lattice.svg
```

- `manifest.json` defines the extension and points Chrome at the custom new tab page.
- `newtab.html` contains the dashboard markup and semantic layout.
- `styles.css` handles the visual design, layout, and responsive behavior.
- `bootstrap.js` initializes the dashboard modules in a safe order.
- `shared.js`, `state.js`, and `dom.js` hold shared constants, state, and DOM references.
- `layout.js`, `clock.js`, `links.js`, `dashboards.js`, `tasks.js`, `notes.js`, `pomodoro.js`, `backgrounds.js`, and `settings.js` each handle one feature area.
- `card-surface.js` controls the patterned or opaque card surface preference.
- `assets/backgrounds/` stores the small local SVG background presets used by the dashboard.

## Roadmap

Planned work is tracked in Linear (see `DEV-WORKFLOW.md`): free release, stickiness (onboarding, Today's top 3, weekly review, themes) and a Pro tier.

Already built: backup import/export, cross-tab sync, task priorities and subtasks, unit and release tests.

## Development

```powershell
npm test            # node --test "tests/*.test.mjs"
npm run package     # builds dist/new-tab-dashboard-<version>.zip
```

See `DEV-WORKFLOW.md` for the Linear-led workflow, `docs/QA.md` for manual checks and `docs/WEBSTORE.md` for publishing. Install steps for users are in `INSTALL.md`.

## Support

If you find it useful, you can support development on Ko-fi: https://ko-fi.com/claudeusage

## Notes

- The project is intentionally dependency-free.
- Uploaded custom background images are stored locally in `chrome.storage.local`, which is suitable for a small MVP but not ideal for large or long-term image storage.
- Favourite links accept normal web URLs as well as local file links such as `file:///C:/Users/.../Downloads/report.pdf`.
- Dashboards are meant for local HTML files and fall back to the file name when an HTML title cannot be read.
- If Chrome blocks a local file URL, open `chrome://extensions`, find this extension, and enable **Allow access to file URLs**.
