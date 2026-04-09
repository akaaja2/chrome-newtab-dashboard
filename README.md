# New Tab Dashboard

A small Chrome Extension Manifest V3 project that replaces the default new tab page with a lightweight dashboard.

## Features

- Live 24-hour clock and readable date
- Pomodoro timer with work and break modes
- Drag a task onto the timer to start a focus session
- Favourite links with add, edit, and delete actions
- To-do list with completion and removal controls
- Quick notes with autosave
- Built-in gradient and local image backgrounds
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
|-- links.js
|-- notes.js
|-- backgrounds.js
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
        `-- sky-veil.svg
```

- `manifest.json` defines the extension and points Chrome at the custom new tab page.
- `newtab.html` contains the dashboard markup and semantic layout.
- `styles.css` handles the visual design, layout, and responsive behavior.
- `bootstrap.js` initializes the dashboard modules in a safe order.
- `shared.js`, `state.js`, and `dom.js` hold shared constants, state, and DOM references.
- `layout.js`, `clock.js`, `links.js`, `tasks.js`, `notes.js`, `pomodoro.js`, `backgrounds.js`, and `settings.js` each handle one feature area.
- `assets/backgrounds/` stores the small local SVG background presets used by the dashboard.

## Roadmap

- Add optional background upload previews
- Let users reorder favourite links and tasks
- Add import/export for saved dashboard data
- Remember whether the settings panel was open or closed
- Add lightweight tests for storage and rendering helpers

## Notes

- The project is intentionally dependency-free.
- Uploaded custom background images are stored locally in `chrome.storage.local`, which is suitable for a small MVP but not ideal for large or long-term image storage.
