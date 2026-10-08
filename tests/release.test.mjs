// Release-readiness checks. Run with: node --test "tests/*.test.mjs"
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, posix } from "node:path";
import { fileURLToPath } from "node:url";

import { findImports, selectRuntimeFiles } from "../scripts/package.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(ROOT, file), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const html = read("newtab.html");
const runtimeFiles = selectRuntimeFiles(ROOT);

// ---- scanners (also used by the negative tests below) ----
export function findPersonalData(text) {
  const hits = [];
  const rules = [
    ["email address", /[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9-]+\.[A-Za-z]{2,}/g],
    ["Windows user path", /[A-Za-z]:[\\/]+Users[\\/]+(?!\.\.\.)[\w.-]+/g],
    ["macOS/Linux home path", /\/(Users|home)\/(?!\.\.\.)[\w.-]+\//g],
    ["API key / token", /\b(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|AIza[0-9A-Za-z_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g],
    ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
    ["owner name in code", /\balexj\b/gi],
  ];
  for (const [label, pattern] of rules) {
    for (const match of text.matchAll(pattern)) {
      hits.push(`${label}: ${match[0]}`);
    }
  }
  return hits;
}

export function findRemoteResources(markup) {
  const hits = [];
  for (const match of markup.matchAll(/<(script|link|img|iframe)\b[^>]*\b(?:src|href)=["'](https?:)?\/\/[^"']+["']/gi)) {
    // Plain <a href> links are fine; resources that load content are not.
    if (match[1].toLowerCase() !== "a") {
      hits.push(match[0]);
    }
  }
  return hits;
}

// ---- manifest ----
test("manifest is Manifest V3 with a semver version", () => {
  assert.equal(manifest.manifest_version, 3);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.name && manifest.description);
  assert.ok(manifest.description.length <= 132, "Web Store limits descriptions to 132 characters");
});

test("manifest requests only the storage permission", () => {
  assert.deepEqual(manifest.permissions, ["storage"]);
  assert.equal(manifest.host_permissions, undefined);
  assert.equal(manifest.optional_permissions, undefined);
});

test("manifest sets a strict extension-pages CSP", () => {
  const csp = manifest.content_security_policy?.extension_pages ?? "";
  assert.match(csp, /script-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-eval|unsafe-inline|https?:/);
});

test("manifest overrides the new tab with a file that exists", () => {
  assert.ok(existsSync(join(ROOT, manifest.chrome_url_overrides.newtab)));
});

// ---- html ----
test("newtab.html has no inline scripts, inline handlers or remote resources", () => {
  const inlineScripts = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/gi)];
  assert.equal(inlineScripts.length, 0, "inline <script> is blocked by the CSP");
  assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, "inline event handlers are blocked by the CSP");
  assert.deepEqual(findRemoteResources(html), []);
});

test("every local script, stylesheet and import resolves to a real file", () => {
  const missing = [];
  for (const match of html.matchAll(/(?:src|href)=["']([^"':#]+\.(?:js|css))["']/g)) {
    if (!existsSync(join(ROOT, match[1]))) missing.push(match[1]);
  }
  for (const file of runtimeFiles.filter((name) => name.endsWith(".js"))) {
    for (const specifier of findImports(read(file))) {
      if (specifier.startsWith(".") && !existsSync(join(ROOT, posix.join(posix.dirname(file), specifier)))) {
        missing.push(`${file} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("every bundled background asset referenced in code exists", () => {
  const missing = [];
  for (const file of runtimeFiles.filter((name) => name.endsWith(".js") || name.endsWith(".css"))) {
    for (const match of read(file).matchAll(/assets\/[\w./-]+\.(?:svg|png|jpg|webp)/g)) {
      if (!existsSync(join(ROOT, match[0]))) missing.push(`${file}: ${match[0]}`);
    }
  }
  assert.deepEqual(missing, []);
});

// ---- Ko-fi donate link ----
test("Ko-fi link: constant is an https ko-fi.com URL and matches the markup", async () => {
  const warn = console.warn;
  console.warn = () => {};
  const { KOFI_URL } = await import("../shared.js");
  console.warn = warn;

  const url = new URL(KOFI_URL);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname, "ko-fi.com");

  const anchor = html.match(/<a\b[^>]*id="support-kofi"[^>]*>/s)?.[0] ?? "";
  assert.ok(anchor, "support link is missing from newtab.html");
  assert.ok(anchor.includes(`href="${KOFI_URL}"`), "markup href must match KOFI_URL");
  assert.match(anchor, /target="_blank"/);
  assert.match(anchor, /rel="noopener noreferrer"/);
});

// ---- personal data ----
test("no personal data, secrets or user paths in shipped files", () => {
  const offenders = [];
  for (const file of runtimeFiles.filter((name) => !name.endsWith(".png"))) {
    for (const hit of findPersonalData(read(file))) {
      offenders.push(`${file} -> ${hit}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test("personal-data scanner catches planted values (negative test)", () => {
  assert.ok(findPersonalData("mail me at jane.doe@gmail.com").length > 0);
  assert.ok(findPersonalData(String.raw`C:\Users\jane\Desktop\x.pdf`).length > 0);
  assert.ok(findPersonalData("/home/jane/notes.txt").length > 0);
  assert.ok(findPersonalData("key=sk-abcdefghijklmnopqrstuvwxyz123456").length > 0);
  assert.ok(findPersonalData("-----BEGIN RSA PRIVATE KEY-----").length > 0);
  // Placeholders and example addresses are fine.
  assert.deepEqual(findPersonalData(String.raw`C:\Users\...\file.pdf and a@example.com`), []);
});

test("remote-resource scanner catches planted values (negative test)", () => {
  assert.ok(findRemoteResources('<script src="https://cdn.example/x.js"></script>').length > 0);
  assert.ok(findRemoteResources('<img src="https://storage.ko-fi.com/cdn/kofi4.png">').length > 0);
  assert.deepEqual(findRemoteResources('<a href="https://ko-fi.com/x">x</a>'), []);
});

// ---- release hygiene ----
test("no exported backups or screenshots sit in the project root", () => {
  const suspicious = readdirSync(ROOT).filter((name) =>
    /backup.*\.json$|new-tab-dashboard-backup|screenshot|\.(png|jpe?g)$/i.test(name),
  );
  assert.deepEqual(suspicious, []);
});
