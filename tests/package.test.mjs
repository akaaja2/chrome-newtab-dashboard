// Builds the release ZIP into a temp dir and checks what ships.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage, createZip, readZip, crc32, selectRuntimeFiles, validateFileSelection } from "../scripts/package.mjs";

const outDir = mkdtempSync(join(tmpdir(), "ntd-package-"));
const result = buildPackage({ outDir });
const entries = readZip(readFileSync(result.zipPath));
const names = entries.map((entry) => entry.name);

test("zip is named after the manifest version", () => {
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.ok(result.zipPath.endsWith(`new-tab-dashboard-${manifest.version}.zip`));
});

test("manifest.json is at the ZIP root and entries use forward slashes", () => {
  assert.ok(names.includes("manifest.json"));
  assert.ok(names.includes("newtab.html"));
  assert.ok(names.every((name) => !name.includes("\\") && !name.startsWith("/")));
});

test("no development files, docs, tests, git data or backups are packaged", () => {
  const forbidden = names.filter(
    (name) =>
      /(^|\/)(\.git|node_modules|tests|scripts|docs|dist)(\/|$)/.test(name) ||
      /\.(md|mjs|zip|log)$/.test(name) ||
      /^(BACKLOG|CLAUDE|README|PRIVACY|INSTALL|blog-post)/i.test(name) ||
      (name.endsWith(".json") && name !== "manifest.json"),
  );
  assert.deepEqual(forbidden, []);
});

test("every packaged file matches its source byte-for-byte", () => {
  for (const entry of entries) {
    assert.ok(entry.data.equals(readFileSync(new URL(`../${entry.name}`, import.meta.url))), entry.name);
    assert.equal(crc32(entry.data), entry.crc);
  }
});

test("the packaged file selection passes validation", () => {
  assert.deepEqual(validateFileSelection(selectRuntimeFiles()), []);
});

test("validation rejects stray and missing files (negative tests)", () => {
  const files = selectRuntimeFiles();
  assert.ok(validateFileSelection([...files, "BACKLOG.md"]).some((p) => p.includes("BACKLOG.md")));
  assert.ok(validateFileSelection([...files, "debug-notes.js"]).some((p) => p.includes("orphan")));
  assert.ok(validateFileSelection(files.filter((f) => f !== "tasks.js")).some((p) => p.includes("tasks.js")));
  assert.ok(validateFileSelection(files.filter((f) => f !== "manifest.json")).some((p) => p.includes("manifest.json")));
});

test("zip writer round-trips arbitrary data", () => {
  const data = Buffer.from("héllo ".repeat(500));
  const [entry] = readZip(createZip([{ name: "dir/é.txt", data }]));
  assert.equal(entry.name, "dir/é.txt");
  assert.ok(entry.data.equals(data));
});

test("building twice gives identical bytes (reproducible)", () => {
  const second = buildPackage({ outDir: mkdtempSync(join(tmpdir(), "ntd-package-")) });
  assert.ok(readFileSync(second.zipPath).equals(readFileSync(result.zipPath)));
  rmSync(outDir, { recursive: true, force: true });
});
