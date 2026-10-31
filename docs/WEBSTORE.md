# Chrome Web Store checklist (separate from install steps)

Not required for sideloading. Needed only to publish publicly. Ready-to-paste copy and answers for every form field: `docs/WEBSTORE-LISTING.md`.

## Account
- [ ] Chrome Web Store developer account (one-time registration fee, currently US$5 - confirm on the dashboard)
- [ ] 2-step verification on the Google account
- [ ] Decide publisher identity (individual vs group publisher)

## Package
- [x] `npm test` green, `npm run package` succeeds
- [ ] Upload `dist/new-tab-dashboard-<version>.zip` (manifest.json at root)
- [ ] Bump `version` in `manifest.json` for every re-upload

## Listing
- [x] **Icons**: 128x128 store icon, plus 16, 48, 128 in the manifest `icons` field (done: `assets/icons/`, store icon in `store/`)
- [x] Title and short description (<= 132 characters), keyword-led
- [x] Detailed description: features, "all data stays in your browser", how to enable file access
- [x] 3-5 screenshots at 1280x800 using **dummy data only** (never real notes or links)
- [ ] Optional small promo tile (440x280)
- [x] Category: Productivity

## Privacy tab
- [x] Single purpose statement: "Replaces the new tab page with a personal productivity dashboard."
- [x] Permission justification: `storage` - saves the user's tasks, notes and settings locally
- [ ] Data usage: declare no user data collected or transmitted; confirm the favicon decision in `PRIVACY.md`
- [x] Privacy policy URL: host `PRIVACY.md` on a public page (https://alexash.work/new-tab-dashboard-privacy.html)
- [x] Support email or site URL (https://alexash.work/#contact)

## Submit
- [ ] Submit for review; new-tab overrides can take longer to review
- [ ] Track status on the Linear issue; reply to reviewer questions there
