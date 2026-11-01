# Prompts for independent LLM review

Three prompt sets to give to other LLMs (for example ChatGPT, Gemini, Grok or another Claude). Each is self-contained. Use a different model per set, or the same set on two models to compare.

Run them in this order: **A** blind security review, **B** privacy and store-policy validation, **C** critique of the audit itself. A is deliberately blind so it is not anchored by the known findings.

## Step 0: build one review bundle

The models need the code in the chat. From the project folder in PowerShell:

```powershell
cd C:\Users\alexj\Projects\Claude\chrome-newtab-dashboard
$files = 'manifest.json','newtab.html','bootstrap.js','shared.js','state.js','dom.js','sync.js','links.js','dashboards.js','tasks.js','notes.js','pomodoro.js','settings.js','backgrounds.js','card-surface.js','layout.js','clock.js','quotes.js','PRIVACY.md','INSTALL.md','docs/WEBSTORE.md'
$files | ForEach-Object { "`n===== FILE: $_ =====`n" + (Get-Content $_ -Raw) } | Set-Content "$env:TEMP\review-bundle.txt" -Encoding utf8
(Get-Item "$env:TEMP\review-bundle.txt").Length
```

Attach `review-bundle.txt`, or paste it after the prompt. It is about 230 KB, roughly 60k tokens, so use a model with a large context window. `styles.css` and the SVGs are left out on purpose. For Set C also attach `docs/SECURITY-AUDIT.md`.

Rules for you when using the answers: treat every claim as a lead, not a fact. Ask the model for the exact line, then check it yourself. Disregard findings without a file and quoted code.

---

## Set A: blind security and code review

```text
ROLE
You are a senior browser-extension security reviewer. You have not seen any previous review of this code. Be sceptical, specific and honest about uncertainty.

TARGET
"New Tab Dashboard", a Chrome Manifest V3 extension that replaces the new tab page. Plain ES modules, no dependencies, no build step. The bundle I attached contains manifest.json, newtab.html and the JavaScript modules, each under a "===== FILE: name =====" header. Treat the bundle as the complete runtime code. styles.css and SVG assets are not included.

TASK
Perform a security review covering:
1. Manifest: permissions, host permissions, CSP, web_accessible_resources, anything that over-grants.
2. Script injection: every place user-controlled or stored data reaches innerHTML, attributes, CSS custom properties, href, or window.open / chrome.tabs.create. Trace the data from source (input, storage, imported backup file) to sink.
3. URL handling: can a javascript:, data:, blob:, chrome:, or file: URL be saved, imported or opened in a harmful way?
4. Backup import: what a hostile JSON file can do.
5. Network behaviour: every outbound request and what data it carries.
6. Data integrity: races, overwrite risks, storage quota and failure handling.
7. Anything else a reviewer for the Chrome Web Store would flag.

RULES
- Cite file name and function for every finding, and quote the exact code that supports it.
- Do not report a finding you cannot ground in the code I provided. If you suspect something in a file you cannot see, say "not verifiable from the bundle".
- Do not pad. Do not report generic best practices as findings.
- Separate real vulnerabilities from hardening suggestions.

OUTPUT FORMAT
1. A table: ID | Severity (High/Medium/Low/Info) | Category | File:function | One-line summary | Confidence (High/Medium/Low).
2. For each row: the quoted code, a concrete exploit or failure scenario with the preconditions an attacker needs, and a minimal fix as a code diff.
3. A section "Checked and found safe", listing the sinks and paths you traced that were fine, with a line each of why.
4. A section "Could not verify", listing what you could not assess and why.
5. Final verdict: SAFE TO PUBLISH / PUBLISH AFTER FIXES / DO NOT PUBLISH, with the single most important reason.
```

---

## Set B: privacy, data-handling and Chrome Web Store policy validation

```text
ROLE
You are a privacy and platform-policy reviewer for browser extensions, familiar with Chrome Web Store developer policies (including User Data, Limited Use, Manifest V3 remote-code rules and the single-purpose policy) and with UK and EU data-protection law. You are not giving legal advice; you are checking claims against evidence.

TARGET
"New Tab Dashboard", a Chrome MV3 extension that overrides the new tab page. The attached bundle holds the code (manifest.json, newtab.html, JS modules), PRIVACY.md, INSTALL.md and docs/WEBSTORE.md.

CLAIMS TO VERIFY AGAINST THE CODE
Mark each: TRUE / FALSE / PARTLY TRUE / CANNOT VERIFY, with file:function and a quote.
1. The extension collects no personal data and has no analytics or tracking.
2. All user data is stored only in chrome.storage.local on the user's device.
3. The only permission requested is "storage".
4. No remote code is loaded or executed.
5. The only third-party network request is a favicon image from google.com/s2/favicons for saved http(s) links, and it includes the full saved URL.
6. Local file: URLs are never sent to any third party.
7. Reading local HTML file titles (fetch of file:// URLs in dashboards.js) stays on the device.
8. Exported backups contain only data the user entered.
9. Removing the extension removes all saved data.

THEN ASSESS
- Does PRIVACY.md describe the real behaviour accurately and completely? List every discrepancy or omission.
- For the Chrome Web Store Privacy tab, give the correct answers for: single-purpose statement, permission justification, data-usage categories to tick or leave unticked (for example "web history", "website content", "personally identifiable information", "user activity"), and the three required certifications. Explain whether sending a saved URL to Google's favicon service changes any category, and what the minimum change to the code would be to avoid that.
- New-tab-override policy: what does the Web Store require of extensions that replace the new tab page, and does this one comply?
- Trader / non-trader status for an individual who offers the extension free and accepts voluntary donations through Ko-fi: state what Google's current documentation says, with the URL you relied on, and flag anything you are unsure of.
- UK GDPR / EU GDPR: is a privacy notice required given that the developer receives no data? What, if anything, is the developer a controller of? Keep this short and flag uncertainty.

RULES
- Quote the code or document line that supports each answer. If you rely on outside knowledge of a policy, name the policy page and say how sure you are that it is current.
- Do not assume anything not in the bundle.

OUTPUT FORMAT
1. Claims table: # | Verdict | Evidence (file:function + quote) | Notes.
2. Discrepancies in PRIVACY.md, as a list with suggested replacement wording.
3. Draft answers for each Web Store Privacy-tab field, ready to paste.
4. Top five risks to approval or to user trust, ranked.
5. Verdict: READY TO SUBMIT / READY AFTER CHANGES (list them) / NOT READY.
```

---

## Set C: critique and attack the audit itself

Attach `review-bundle.txt` and `docs/SECURITY-AUDIT.md`. Use a model different from the one that wrote the audit.

```text
ROLE
You are an adversarial reviewer. A previous reviewer (an AI) produced the attached security audit of a Chrome extension. Your job is to find what it got wrong, missed or overstated. Assume it can be wrong. Do not be polite for its sake, and do not invent problems to look useful.

INPUTS
- The code bundle (manifest.json, newtab.html, JS modules, PRIVACY.md, INSTALL.md, WEBSTORE.md).
- docs/SECURITY-AUDIT.md, the audit under review.

TASK
1. Verify each claim in the "Checks that passed" table against the code. Mark each: CONFIRMED / WRONG / OVERSTATED / CANNOT VERIFY, with the exact code you used.
2. Try to disprove each of the five findings. Is the severity right? Is the proposed fix correct and sufficient? Could the fix introduce a new problem?
3. Look for what the audit missed. Pay special attention to: drag-and-drop data (tasks dragged onto the timer, getTaskFromDragData), quote and subtask link rendering, file:// handling, custom background upload, any use of postMessage, clipboard, downloads (the backup export link), and anything that reads from storage and writes it back unvalidated.
4. Check the audit's honesty: does it claim more coverage than the stated method supports? List every sentence that overreaches.
5. Judge the overall verdict: would you sign off on publishing this extension publicly on GitHub and distributing the ZIP from a personal website? What would you require first?

RULES
- Every new finding needs file:function, quoted code, a concrete failure scenario and a minimal fix.
- If you cannot find any new issue in an area, say so rather than inventing one.
- Distinguish certain from suspected.

OUTPUT FORMAT
1. Claim-verification table for "Checks that passed".
2. Finding-by-finding challenge: Original finding | Your verdict (agree / disagree / adjust severity) | Reasoning.
3. New findings table: ID | Severity | File:function | Summary | Confidence, followed by details.
4. Overreach list: quoted audit sentence | why it overreaches.
5. Final recommendation: PUBLISH / PUBLISH AFTER (list) / HOLD, and the two things you would fix first.
```

---

## Comparing the answers

Keep a simple tally in a table:

| Finding | Model A | Model B | Model C | You verified? | Action |
|---|---|---|---|---|---|
| | | | | | |

A finding raised independently by two models with a quoted line is almost always real. A finding raised by one model without a quoted line is usually not. Paste the disagreements back to Claude Code and ask it to confirm each against the source.
