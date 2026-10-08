# Manual QA checklist

Run against the packaged build in a **fresh Chrome profile** (Chrome menu > Add profile), so no earlier data is present.

Setup: extract `dist/new-tab-dashboard-<version>.zip`, open `chrome://extensions`, turn on Developer mode, **Load unpacked**, pick the extracted folder, open a new tab.

## Clean install
- [ ] Every card renders with a sensible empty state; no errors on the extension's Errors button
- [ ] No pre-filled personal links, notes or tasks
- [ ] Extension permissions screen lists only storage access (no "read your browsing history")

## Persistence
- [ ] Type a note, wait a second, close the tab and reopen: note is still there
- [ ] Add tasks with priorities and a subtask; restart Chrome: all still there
- [ ] Complete a task; it moves to Done and the heatmap updates
- [ ] Change card order, minimise one, pin one; reopen: layout kept
- [ ] Change background and card surface; reopen: kept

## Backup
- [ ] Settings > Export backup downloads a JSON file
- [ ] Reset to-do list, then Import backup: tasks return after reload
- [ ] Import a random `.json` or text file: clear error, nothing changed
- [ ] Exported file contains no data you did not enter

## Multi-tab
- [ ] Open two new tabs. Add a task in tab A. Switch to tab B: it reloads and shows the task
- [ ] Add a different task in tab B: both tasks present afterwards

## Features
- [ ] Pomodoro start/pause/reset; drag a task onto the timer to label a session
- [ ] Links: add a web URL and a local path; both open in a new tab (local needs "Allow access to file URLs")
- [ ] Earnings: add an entry, totals update
- [ ] Custom background under 1.5 MB works; a larger one is rejected with a message
- [ ] **Support it on Ko-fi** link in the Settings card opens ko-fi.com/claudeusage in a new tab

Record results as a comment on the Linear issue.
