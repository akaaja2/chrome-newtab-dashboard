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
  getFaviconRequestUrl,
  getFileNameFromUrlOrPath,
  getTodayKey,
  normalizeUrl,
  parseBackup,
  stripFileExtension,
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

test("favicon request sends only the origin of a saved link", () => {
  const request = getFaviconRequestUrl("https://example.com/private/path?token=abc#frag");
  const sent = new URL(request).searchParams.get("domain_url");
  assert.equal(sent, "https://example.com");
  assert.ok(!request.includes("private") && !request.includes("token") && !request.includes("frag"));
});

test("favicon request is skipped for local files and invalid URLs", () => {
  assert.equal(getFaviconRequestUrl("file:///C:/Users/x/a.html"), null);
  assert.equal(getFaviconRequestUrl("not a url"), null);
  assert.equal(getFaviconRequestUrl("javascript:alert(1)"), null);
});
