# Security policy

## Supported versions

Only the latest release receives fixes.

| Version | Supported |
|---|---|
| 1.0.x | Yes |

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Use GitHub's private reporting: **Security > Report a vulnerability** on this repository (https://github.com/akaaja2/chrome-newtab-dashboard/security/advisories/new). Include the steps to reproduce, the browser version and what you expected.

You can expect an acknowledgement within a few days. This is a solo, volunteer project, so fix times vary.

## Scope

In scope: script injection through user-entered text, unsafe URL handling, unintended network requests, data leaving the browser, malicious backup files, and permissions beyond `storage`.

Out of scope: attacks that already require control of the user's browser profile or machine, and vulnerabilities in Chrome itself.

## Design notes

- Manifest V3, `storage` permission only, no host permissions.
- CSP: `script-src 'self'; object-src 'self'`. No inline scripts, no remote code.
- User text is HTML-escaped before it reaches `innerHTML`, and a test suite checks it.
- All data stays in `chrome.storage.local`. The extension makes no third-party requests (see `PRIVACY.md`).

The latest self-review is in [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md).
