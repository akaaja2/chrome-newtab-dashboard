# Chrome Web Store listing: copy and answers

Paste these into the Web Store developer dashboard. Screenshots and the store icon are in `store/`. The release ZIP is built by `npm run package`.

## Store listing tab

**Name:** New Tab Dashboard

**Summary (max 132 characters, 126 used):**
Your new tab, but useful: tasks, notes, a Pomodoro timer, links and quotes. Free. No account. Your data stays in your browser.

**Category:** Productivity  **Language:** English (UK)

**Description:**

New Tab Dashboard turns every new tab into a calm, useful page. No account, no tracking, no setup.

WHAT YOU GET
- To-do list with priorities (Urgent, Important, Medium, Low) and subtasks
- Pomodoro timer with work, short-break and long-break modes. Drag a task onto the timer to start a focus session for it
- Notes that autosave as you type
- Favourite links as cards
- Rotating motivational quotes
- Large clock and date
- Local HTML dashboards as quick-launch cards (turn on "Allow access to file URLs" in the extension's details)
- Built-in backgrounds or your own image, patterned or opaque cards
- Drag, minimise and pin cards to arrange the page your way
- Export and import a backup of everything, free

PRIVATE BY DESIGN
Everything you enter is saved in your browser with chrome.storage.local. The extension has no server, no account and no analytics, loads no remote code and asks for one permission only: storage. It makes no third-party requests.

FREE
Free to use. If it helps, you can support development on Ko-fi.

Privacy policy: https://alexash.work/new-tab-dashboard-privacy.html

**Store icon:** `store/store-icon-128.png`

**Screenshots (1280x800, dummy data only), upload in this order:**
1. `store/screenshot-01-clock-and-timer.png`
2. `store/screenshot-02-tasks-and-notes.png`
3. `store/screenshot-03-links-and-quotes.png`
4. `store/screenshot-04-backgrounds.png`

**Official URL / Homepage:** https://alexash.work/new-tab-dashboard.html
**Support URL:** https://alexash.work/#contact

## Privacy tab

**Single purpose:** Replaces the new tab page with a personal productivity dashboard (tasks, notes, timer, links and quotes).

**Permission justification, `storage`:** Saves the user's tasks, notes, links, settings and layout on their own device (chrome.storage.local) so they are still there next time. Nothing is sent to a server.

**Host permissions:** none requested. **Remote code:** no, all code ships in the package.

**Data usage:** the extension does not collect, sell or transfer user data and makes no network requests. Tick none of the data-collection boxes.
- Certify: not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://alexash.work/new-tab-dashboard-privacy.html

## Distribution tab

**Visibility:** Public. **Regions:** all regions. **Pricing:** free.

## Reviewer notes (optional box)

"Overrides the new tab page only (chrome_url_overrides.newtab). Single permission: storage. No remote code and no network calls. To test: open a new tab, add a task, a note and a link."
