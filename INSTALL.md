# Install New Tab Dashboard

1. Extract `new-tab-dashboard-1.0.0.zip` to a permanent folder.
2. In Chrome, open `chrome://extensions` and enable **Developer mode**.
3. Select **Load unpacked** and choose the extracted folder containing `manifest.json`.
4. Open a new tab and accept Chrome's new-tab change prompt if shown.

Keep the extracted folder: Chrome loads the extension from it. Opening `newtab.html` directly does not provide Chrome storage persistence.

## Local files
In the extension's **Details**, enable **Allow access to file URLs** for local links and HTML dashboards.

## Saving and backups
Wait for notes to show **Saved locally** before closing. Use **Settings > Export backup** to save your data, and **Import backup** to restore it. Import replaces the sections present in the file. Keep backups private and outside the extension folder.

For now, edit in one dashboard tab at a time. Hidden tabs refresh when shown after a storage change; simultaneous edits in separate visible windows are not conflict-safe.

## Updating
Export a backup first. Close dashboard tabs, extract the new ZIP over the **same installed folder**, then reload the extension at `chrome://extensions` and open a new tab. Keep the same Chrome profile and extension installation. If you move folders or reinstall, do not assume the saved data will follow; restore your backup if needed.

## Privacy and removal
Data is saved in this Chrome profile. The extension makes no third-party requests; saved links show a letter tile. See `PRIVACY.md` supplied alongside this package.

Removing the extension deletes its saved data. Export a backup first.
