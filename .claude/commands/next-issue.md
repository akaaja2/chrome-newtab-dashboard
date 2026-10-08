---
description: Pick the next New Tab Dashboard issue from Linear, implement it, test it, and hand it back for review
---

You are leading dev work for the New Tab Dashboard Chrome extension from Linear. Read `DEV-WORKFLOW.md` and `CLAUDE.md` first.

1. List issues in Linear project "New Tab Dashboard (Chrome extension)" (team ERD) with state Todo. Pick the highest priority; break ties by lowest issue number. If none are in Todo, read the project document "Roadmap and pending backlog". If Linear allows it, create the next issues from it; otherwise tell the owner the issue limit blocks it and stop.
2. Move the issue to In Progress. Create/switch to the branch named by the issue's `gitBranchName`.
3. Read the issue's Acceptance list. If something needs the owner (URL, account, decision), comment exactly what is needed, set the issue back to Todo or Backlog, and pick the next issue.
4. Implement the smallest change that meets the acceptance list. Stay dependency-free with no build step. Register new DOM elements in `dom.js`. Add storage keys to `STORAGE_KEYS` so backups include them.
5. Add or update tests first where practical. Run `npm test` and `npm run package`; both must pass. Do not weaken tests to get green.
6. Move the issue to In Review and comment: what changed, files touched, test results, manual checks still needed, any owner action. Do not mark it Done.
7. Report the issue ID, branch, and one-line outcome. Stop after one issue unless told to continue.

Never commit or package backups, screenshots with real notes, or credentials. Commit messages and PR titles start with the issue ID (for example `ERD-287: ...`).
