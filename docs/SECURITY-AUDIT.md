# Security audit: New Tab Dashboard v1.0.0

Date: 21 October 2026. Reviewer: Claude (AI-assisted static review). This is a self-review, not an independent penetration test. Use `docs/LLM-REVIEW-PROMPTS.md` to get independent opinions.

## Scope and method

Reviewed: `manifest.json`, `newtab.html` (searched, not read line by line), `shared.js`, `links.js`, `dashboards.js`, `tasks.js`, `pomodoro.js`, `backgrounds.js`, `settings.js` (searched) and the packaged ZIP. Method: repository-wide search for network calls, dynamic code, `innerHTML` and storage use; a read of every `innerHTML` site, URL handling and backup import; secret scan of the working tree and git history; `npm test` (31 of 31 passed); confirmation that the ZIP holds 26 runtime files with `manifest.json` at the root.

Not done: browser testing, dynamic analysis, a line-by-line read of `layout.js`, `pomodoro.js` logic or `styles.css`, and any review of the Chrome profile or hosting.

## Summary

No high-severity issue found. One medium privacy finding needs an owner decision before the Chrome Web Store, and three low findings are worth fixing.

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Medium (privacy) | Favicon requests send the full saved URL to Google | Fixed: lookup removed, letter tiles only |
| 2 | Low | Backup import checks keys, not value shapes | Open |
| 3 | Low | Concurrent edits in two visible windows can overwrite data | Known limitation |
| 4 | Low | Manifest has no `icons`, required for the Web Store | Open |
| 5 | Info | Repository hygiene before going public | See below |

## Findings

### 1. Favicon requests send the full saved URL to Google (Medium, privacy)

`links.js` `getFaviconUrl` builds `https://www.google.com/s2/favicons?domain_url=<encoded full URL>&sz=64` for every saved `http(s)` link. The full URL, including path and query string, goes to Google. A saved link such as a private document or a magic-link login would be transmitted. `file:` links are excluded, and the image uses `referrerPolicy = "no-referrer"`. `PRIVACY.md` and the website now disclose this.

Options, simplest first:
1. Send only the origin: `new URL(url).origin`. Still reveals the domain, removes path and query. A one-line change.
2. Make icons opt-in in Settings, off by default.
3. Remove the feature and draw a letter tile (the code already has a letter fallback via `data-initial`).

Resolution: option 3 was chosen. `getFaviconUrl` and the `<img>` were removed from `links.js`, `PRIVACY.md` and the other docs were updated, and the Web Store data-usage answer is "no data collected".

### 2. Backup import checks keys, not value shapes (Low)

`parseBackup` in `shared.js` accepts only known storage keys, which is good. Values are not shape-checked at import. On load, links are re-normalised through `normalizeUrl` (only `http`, `https` and `file` schemes survive) and the custom background is checked for a string `dataUrl`, but the string is not checked to start with `data:image/`, and it is placed into a CSS `url(...)` through `JSON.stringify`. Impact is limited: the user must import a hostile file, the CSP blocks script, and titles are rendered with `textContent`. Fix: validate `dataUrl` with a `data:image/` prefix and the existing size cap on load and import, and add a negative test.

### 3. Concurrent edits can overwrite data (Low, integrity)

Each tab holds an in-memory copy and saves whole lists. `sync.js` reloads hidden tabs when shown, but two visible windows edited at once can overwrite each other. Documented in `INSTALL.md`. Possible later fix: write per-item, or merge on `chrome.storage.onChanged`.

### 4. Manifest has no `icons` (Low, release)

Required for a Web Store listing (16, 48, 128 px). Not a security issue.

### 5. Repository hygiene before going public (Info)

- Git history: no secrets, tokens or keys found. The only matches are test fixtures for the secret scanner. No screenshots, backups or archives were ever committed. `dist/`, `*.zip`, `*backup*.json` and `screenshots/` are git-ignored.
- Tracked workflow files (`CLAUDE.md`, `DEV-WORKFLOW.md`, `.claude/commands/next-issue.md`) name your Linear team (`ERD`), project and branch pattern (`alexjash/...`). Harmless, but remove them if you prefer not to publish your tooling.
- Commit author is `akaaja2 <alexj.ash>`. Check `git config user.email` shows what you want public; GitHub's no-reply address (`<id>+akaaja2@users.noreply.github.com`) is the usual choice. Rewriting history is only worth it if the address matters to you.
- Confirm the repository visibility yourself. I could not verify whether `akaaja2/chrome-newtab-dashboard` is public from this environment.

## Checks that passed

| Area | Result |
|---|---|
| Permissions | `storage` only. No `tabs`, no host permissions. `chrome.tabs.create` works without `tabs`. |
| CSP | `script-src 'self'; object-src 'self'`. `newtab.html` has one external module script and no inline scripts or `on*=` handlers. |
| Remote code | None. No `eval`, `new Function`, `importScripts`, `document.write` or dynamic `<script>`. |
| Network | One path only (after finding 1 was fixed): `fetch(file://...)` in `dashboards.js`, which reads the `<title>` of a local HTML file the user added, only if file access is enabled, parsed with the inert `DOMParser`. |
| XSS | Every `innerHTML` assignment that carries data (task list and subtasks, completion heatmap, Pomodoro session list) passes each interpolated value through `escapeHtml` (escapes `& < > " '`); the rest only clear a container with `""`. Link and dashboard cards use `textContent`. The only user-created anchors are subtask links, restricted to `https://` and escaped. `markup.test.mjs` covers payloads. |
| URL schemes | `normalizeUrl` allows `http`, `https`, `file` only, so `javascript:` and `data:` links are rejected at entry and at load. |
| Links opened | `chrome.tabs.create` for saved links; subtask links use `rel="noreferrer noopener"`. |
| Secrets | None in tree or history. |
| Package | 26 files, `manifest.json` at root, no backups or screenshots. `package.test.mjs` asserts byte-identical contents to source. SHA-256 `10ede6e0f0d819979a58c4d1c89251d87a62939f6982e24e1b40aff4ba521c3f`. |

## Recommended order of work

1. ~~Decide on the favicon behaviour (finding 1)~~ Done. Update the website privacy page to match `PRIVACY.md`.
2. Validate the custom background data URL (finding 2) with a failing-first test.
3. Add icons.
4. Run `docs/QA.md` on a fresh Chrome profile.
5. Get two or three independent reviews using `docs/LLM-REVIEW-PROMPTS.md`.
