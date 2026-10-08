# Dev workflow: led from Linear

Linear project: **New Tab Dashboard (Chrome extension)** in team ERD. Linear is the source of truth for what to build and in what order. Claude Code does the work, the owner reviews and moves issues to Done.

## Loop (one issue at a time)

1. Run `/next-issue` in Claude Code (see `.claude/commands/next-issue.md`). It reads the project's **Todo** issues, picks the highest priority (then lowest ID), and moves it to **In Progress**.
2. Branch from the issue's Linear branch name, for example `alexjash/erd-287-remove-unused-tabs-permission-from-manifest`. Including the issue ID in branch names, commits and PR titles links them in Linear automatically.
3. Implement the smallest change that meets the issue's **Acceptance** list. Keep the project dependency-free, with no build step.
4. Test (see below). New logic needs new tests, written first where practical.
5. Move the issue to **In Review** and add a comment: what changed, files touched, test output summary, anything the owner must do or decide.
6. The owner moves it to **Done**. Claude never marks its own work Done.

If an issue is blocked on the owner (a URL, an account, a decision), set it back to Todo/Backlog, add a comment stating exactly what is needed, and move to the next issue.

## Testing

Run from the project folder (PowerShell):

```powershell
node --test "tests/*.test.mjs"   # or: npm test
node scripts/package.mjs         # or: npm run package
```

| Layer | File | What it protects |
|---|---|---|
| Unit | `tests/shared.test.mjs` | Pure helpers: URL normalisation, backups, durations |
| Release | `tests/release.test.mjs` | Manifest (MV3, permissions = `storage` only, CSP, description length), no inline scripts or remote resources, imports resolve, Ko-fi link matches markup, no personal data or secrets, no backups in root |
| Markup | `tests/markup.test.mjs` | User text is escaped in `innerHTML` templates (XSS payloads) |
| Package | `tests/package.test.mjs` | ZIP has `manifest.json` at root, only runtime files, byte-identical to sources, reproducible |
| Manual | `docs/QA.md` | Persistence, backup import/export, layout, multi-tab, in a fresh Chrome profile |

Rules:
- Put testable logic in `shared.js` or another module that does not touch `document` at import time.
- A scanner or validator needs a negative test proving it can fail.
- Do not weaken or delete a failing test to get green. Fix the code or raise it in the issue.
- Never commit or package exported backups, screenshots with real notes, or credentials.

## Definition of done

- Acceptance list met; `npm test` green; `npm run package` succeeds
- Manual QA steps noted in the comment where the issue calls for them
- Docs updated if behaviour or install steps changed
- Issue in **In Review** with the summary comment

## Backlog and epics

Epics are Linear project milestones: **v1.0 Free Release**, **Stickiness**, **Pro Unlock**. Issues not yet created (the free Linear issue limit was hit) are listed in the project document "Roadmap and pending backlog". When capacity frees up, `/next-issue` creates them in that order before picking work.

## Release

1. All Epic 1 issues in Done.
2. `npm test` and `npm run package`; install `dist/new-tab-dashboard-<version>.zip` unpacked in a fresh Chrome profile and walk `docs/QA.md`.
3. Follow `docs/WEBSTORE.md`.
