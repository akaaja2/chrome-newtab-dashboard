// Run with: node --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";

// shared.js warns once when chrome.storage is missing, which is expected under Node.
const originalWarn = console.warn;
console.warn = () => {};
const shared = await import("../shared.js");
console.warn = originalWarn;

const {
  STORAGE_KEYS,
  buildBackup,
  escapeHtml,
  formatDuration,
  getFileNameFromUrlOrPath,
  getTodayKey,
  normalizeLocalDashboardUrl,
  normalizeUrl,
  parseBackup,
  stripFileExtension,
  stripWrappingQuotes,
} = shared;

test("normalizeUrl adds https to bare domains", () => {
  assert.equal(normalizeUrl("example.com"), "https://example.com/");
  assert.equal(normalizeUrl("  https://a.b/c?d=1  "), "https://a.b/c?d=1");
});

test("normalizeUrl turns Windows paths into encoded file URLs", () => {
  assert.equal(
    normalizeUrl(String.raw`C:\Users\me\My Docs\report.pdf`),
    "file:///C:/Users/me/My%20Docs/report.pdf",
  );
  assert.equal(normalizeUrl("file:///C:/x/y.html"), "file:///C:/x/y.html");
});

test("normalizeUrl rejects empty and non-web schemes", () => {
  assert.equal(normalizeUrl(""), null);
  assert.equal(normalizeUrl("   "), null);
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
});

test("stripWrappingQuotes removes straight and smart quotes around a value", () => {
  assert.equal(stripWrappingQuotes(`  "C:\\a b.html"  `), "C:\\a b.html");
  assert.equal(stripWrappingQuotes(`'x.html'`), "x.html");
  assert.equal(stripWrappingQuotes("\u201Cx.html\u201D"), "x.html");
  assert.equal(stripWrappingQuotes("\u2018x.html\u2019"), "x.html");
  assert.equal(stripWrappingQuotes(`" 'x.html' "`), "x.html");
  assert.equal(stripWrappingQuotes(`it's.html`), "it's.html");
  assert.equal(stripWrappingQuotes(`"`), `"`);
  assert.equal(stripWrappingQuotes(undefined), "");
});

test("normalizeLocalDashboardUrl accepts the exact Explorer 'Copy as path' string from the bug", () => {
  assert.equal(
    normalizeLocalDashboardUrl(String.raw`"C:\Users\alexj\Downloads\SJT Next Three.html"`),
    "file:///C:/Users/alexj/Downloads/SJT%20Next%20Three.html",
  );
});

test("normalizeLocalDashboardUrl strips quotes and surrounding whitespace", () => {
  const expected = "file:///C:/Users/me/My%20Dash.html";
  for (const input of [
    String.raw`  "C:\Users\me\My Dash.html"  `,
    String.raw`'C:\Users\me\My Dash.html'`,
    "\u201CC:\\Users\\me\\My Dash.html\u201D",
    "\u2018C:\\Users\\me\\My Dash.html\u2019",
    "\t\"C:\\Users\\me\\My Dash.html\"\n",
    String.raw`C:\Users\me\My Dash.html`,
  ]) {
    assert.equal(normalizeLocalDashboardUrl(input), expected, JSON.stringify(input));
  }
});

test("normalizeLocalDashboardUrl handles Windows, UNC and POSIX paths", () => {
  assert.equal(
    normalizeLocalDashboardUrl("c:/Users/me/Reports/Q3 Board.html"),
    "file:///C:/Users/me/Reports/Q3%20Board.html",
  );
  assert.equal(
    normalizeLocalDashboardUrl(String.raw`\\server\share\x.html`),
    "file://server/share/x.html",
  );
  assert.equal(
    normalizeLocalDashboardUrl(String.raw`"\\server\share\Team Dash.html"`),
    "file://server/share/Team%20Dash.html",
  );
  assert.equal(
    normalizeLocalDashboardUrl("/home/me/My Dash.html"),
    "file:///home/me/My%20Dash.html",
  );
  assert.equal(
    normalizeLocalDashboardUrl(`"/Users/me/Dash #1.html"`),
    "file:///Users/me/Dash%20%231.html",
  );
});

test("normalizeLocalDashboardUrl keeps file:/// URLs valid and strips their quotes", () => {
  assert.equal(normalizeLocalDashboardUrl("file:///C:/x/y.html"), "file:///C:/x/y.html");
  assert.equal(
    normalizeLocalDashboardUrl(`"file:///C:/x/My%20Dash.html"`),
    "file:///C:/x/My%20Dash.html",
  );
  assert.equal(
    normalizeLocalDashboardUrl("\u201Cfile:///C:/x/My Dash.html\u201D"),
    "file:///C:/x/My%20Dash.html",
  );
});

test("normalizeLocalDashboardUrl accepts .htm and any extension case", () => {
  assert.equal(normalizeLocalDashboardUrl(String.raw`"C:\a\b.htm"`), "file:///C:/a/b.htm");
  assert.equal(normalizeLocalDashboardUrl(String.raw`C:\a\B.HTML`), "file:///C:/a/B.HTML");
  assert.equal(normalizeLocalDashboardUrl("/a/b.HtM"), "file:///a/b.HtM");
});

test("normalizeLocalDashboardUrl still rejects empty and non-file input", () => {
  for (const input of ["", "   ", `""`, `" "`, "\u201C\u201D", "https://example.com/x.html",
    `"https://example.com/x.html"`, "example.com", "javascript:alert(1)", "//server/x.html"]) {
    assert.equal(normalizeLocalDashboardUrl(input), null, JSON.stringify(input));
  }
});

test("normalizeUrl strips wrapping quotes for links too", () => {
  assert.equal(
    normalizeUrl(String.raw`"C:\Users\me\My Docs\report.pdf"`),
    "file:///C:/Users/me/My%20Docs/report.pdf",
  );
  assert.equal(normalizeUrl(`"https://a.b/c"`), "https://a.b/c");
});

test("escapeHtml escapes markup characters", () => {
  assert.equal(escapeHtml(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;");
});

test("file name helpers decode and strip extensions", () => {
  assert.equal(getFileNameFromUrlOrPath("file:///C:/x/My%20Report.html"), "My Report.html");
  assert.equal(stripFileExtension("a.b.html"), "a.b");
});

test("getTodayKey and formatDuration format consistently", () => {
  assert.equal(getTodayKey(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(formatDuration(65), "01:05");
  assert.equal(formatDuration(3600), "60:00");
});

test("buildBackup keeps only dashboard keys", () => {
  const backup = buildBackup(
    { [STORAGE_KEYS.note]: "hello", [STORAGE_KEYS.tasks]: [], "other.key": 1 },
    new Date("2026-09-23T10:00:00Z"),
  );

  assert.equal(backup.format, "new-tab-dashboard-backup");
  assert.equal(backup.exportedAt, "2026-09-23T10:00:00.000Z");
  assert.deepEqual(backup.data, { [STORAGE_KEYS.note]: "hello", [STORAGE_KEYS.tasks]: [] });
});

test("parseBackup round-trips a built backup and drops unknown keys", () => {
  const backup = buildBackup({ [STORAGE_KEYS.links]: [{ id: "1" }] });
  backup.data["evil.key"] = "x";

  assert.deepEqual(parseBackup(JSON.stringify(backup)), { [STORAGE_KEYS.links]: [{ id: "1" }] });
});

test("parseBackup rejects invalid files", () => {
  assert.throws(() => parseBackup("not json"), /not valid JSON/);
  assert.throws(() => parseBackup(JSON.stringify({ data: {} })), /not a New Tab Dashboard backup/);
  assert.throws(
    () => parseBackup(JSON.stringify({ format: "new-tab-dashboard-backup", version: 99, data: {} })),
    /newer version/,
  );
  assert.throws(
    () => parseBackup(JSON.stringify({ format: "new-tab-dashboard-backup", version: 1, data: { x: 1 } })),
    /does not contain any dashboard data/,
  );
});
