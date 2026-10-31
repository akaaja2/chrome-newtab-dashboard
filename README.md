# New Tab Dashboard

[![CI](https://github.com/akaaja2/chrome-newtab-dashboard/actions/workflows/ci.yml/badge.svg)](https://github.com/akaaja2/chrome-newtab-dashboard/actions/workflows/ci.yml)
![Manifest V3](https://img.shields.io/badge/Chrome-Manifest%20V3-1d3557)
![Permissions](https://img.shields.io/badge/permissions-storage%20only-2e7d32)
![Dependencies](https://img.shields.io/badge/dependencies-none-2e7d32)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A calm, private replacement for Chrome's new tab page: tasks, notes, a Pomodoro timer, quotes, quick links and backgrounds. No account, no analytics, no build step. Your data stays in your browser.

<!-- Add a 1280x800 screenshot here using dummy data only: ![New Tab Dashboard](docs/screenshot.png) -->

## Features

| | |
|---|---|
| **Tasks** | Priorities, subtasks, a done list and a completion heatmap. Drag a task onto the timer to start a labelled focus session. |
| **Notes** | Quick notes that autosave locally. |
| **Pomodoro** | Work and break modes with a log of completed sessions. |
| **Links** | Favourite links, including local `file:///` links, with add, edit and delete. |
| **Dashboards** | Launcher cards for local HTML files. |
| **Daily earnings** | GBP totals with USD conversion, plus quick-launch tabs for UserTesting and Prolific. |
| **Layout** | Drag to reorder, minimise or pin cards. Patterned or opaque card surfaces. |
| **Backgrounds** | Built-in geometric presets or your own image (up to about 1.5 MB). |
| **Backup** | Export and import everything as JSON. |
| **Quotes** | A rotating motivational quote card. |

## Install

The extension is not on the Chrome Web Store yet. Install it unpacked:

1. Download `new-tab-dashboard-1.0.0.zip` from the [Releases](https://github.com/akaaja2/chrome-newtab-dashboard/releases) page and extract it to a **permanent folder**. Chrome loads the extension from that folder, so do not move or delete it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder that contains `manifest.json`.
4. Open a new tab.

Or run it from source:

```powershell
git clone https://github.com/akaaja2/chrome-newtab-dashboard.git
```

Then load the cloned folder with **Load unpacked** as above.

**Local files.** For local links and dashboards, open the extension's **Details** on `chrome://extensions` and enable **Allow access to file URLs**.

**Updating.** Export a backup (**Settings > Export backup**), close dashboard tabs, extract the new ZIP over the same folder, then reload the extension.

More detail: [INSTALL.md](INSTALL.md).

## Privacy

- Tasks, notes, links, earnings, settings, layout and uploaded backgrounds are stored only in `chrome.storage.local`. There is no server and no sync service.
- No analytics, no tracking, no remote code.
- **No third-party requests:** saved links show a letter tile, not a site icon, so no saved address ever leaves your browser. See [PRIVACY.md](PRIVACY.md) and the [security audit](docs/SECURITY-AUDIT.md).

## Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your data in your browser. |

That is the only permission. A test fails the build if another is added. The extension has no host permissions and a strict CSP (`script-src 'self'; object-src 'self'`).

## Development

Dependency-free: plain ES modules, HTML and CSS. Needs Node 22 for the tests only.

```powershell
npm test            # node --test "tests/*.test.mjs"  (31 tests)
npm run package     # builds dist/new-tab-dashboard-<version>.zip
```

| Layer | File | Protects |
|---|---|---|
| Unit | `tests/shared.test.mjs` | URL normalisation, backups, durations |
| Release | `tests/release.test.mjs` | MV3 manifest, `storage` only, CSP, no inline scripts or remote resources, no personal data |
| Markup | `tests/markup.test.mjs` | User text is HTML-escaped |
| Package | `tests/package.test.mjs` | ZIP layout, contents identical to source |

Architecture notes are in [CLAUDE.md](CLAUDE.md), manual browser checks in [docs/QA.md](docs/QA.md), publishing steps in [docs/WEBSTORE.md](docs/WEBSTORE.md).

## Security

See [SECURITY.md](SECURITY.md) to report a vulnerability, and [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md) for the latest review and known limitations. [docs/LLM-REVIEW-PROMPTS.md](docs/LLM-REVIEW-PROMPTS.md) holds prompts for independent AI review.

## Known limitations

- Two dashboard windows edited at the same time can overwrite each other. Hidden tabs refresh when shown again.
- Uploaded background images live in `chrome.storage.local`, which suits a small image but not a large library.
- Browser-level testing (persistence, backup, layout) is documented in `docs/QA.md` but has not yet been run on a fresh profile.

## Roadmap

Free v1.0 release, then stickiness features (onboarding, today's top three, weekly review, themes), then an optional Pro tier. See [BACKLOG.md](BACKLOG.md).

## Support

It is free. If it helps you focus, you can support it on [Ko-fi](https://ko-fi.com/claudeusage).

## Licence

[MIT](LICENSE)
