// Builds the release ZIP for the Chrome Web Store / manual install.
// Usage (PowerShell or any shell):  node scripts/package.mjs [--out <dir>]
// Dependency-free: uses only Node built-ins and a small ZIP writer.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve, posix } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { deflateRawSync, inflateRawSync } from "node:zlib";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Runtime file types that may ship from the project root.
const ROOT_RUNTIME_PATTERN = /^(manifest\.json|[A-Za-z0-9_-]+\.(html|css|js))$/;
// Never ship these, wherever they appear.
const FORBIDDEN_PATTERN =
  /(^|\/)(\.git|node_modules|tests|scripts|docs|dist|coverage)(\/|$)|\.(md|mjs|map|log|zip|bak|json)$|^\.|(^|\/)(BACKLOG|CLAUDE|README|PRIVACY|INSTALL|blog-post)/i;
const ASSET_DIR = "assets";

// ---- CRC32 + ZIP writer -------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Fixed timestamp (2026-01-01 00:00) so identical input gives an identical ZIP.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

export function createZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

// Reads a ZIP produced by createZip (or any simple ZIP) back into {name, data, crc} entries.
export function readZip(zipBuffer) {
  const endOffset = zipBuffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (endOffset < 0) {
    throw new Error("Not a ZIP file (no end-of-central-directory record).");
  }

  const count = zipBuffer.readUInt16LE(endOffset + 10);
  let pointer = zipBuffer.readUInt32LE(endOffset + 16);
  const entries = [];

  for (let i = 0; i < count; i += 1) {
    if (zipBuffer.readUInt32LE(pointer) !== 0x02014b50) {
      throw new Error("Corrupt central directory.");
    }
    const method = zipBuffer.readUInt16LE(pointer + 10);
    const crc = zipBuffer.readUInt32LE(pointer + 16);
    const compressedSize = zipBuffer.readUInt32LE(pointer + 20);
    const nameLength = zipBuffer.readUInt16LE(pointer + 28);
    const extraLength = zipBuffer.readUInt16LE(pointer + 30);
    const commentLength = zipBuffer.readUInt16LE(pointer + 32);
    const localOffset = zipBuffer.readUInt32LE(pointer + 42);
    const name = zipBuffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);

    const localNameLength = zipBuffer.readUInt16LE(localOffset + 26);
    const localExtraLength = zipBuffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const raw = zipBuffer.subarray(dataStart, dataStart + compressedSize);
    const data = method === 8 ? inflateRawSync(raw) : Buffer.from(raw);

    entries.push({ name, data, crc });
    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

// ---- Runtime file discovery --------------------------------------------
function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function toPosix(path) {
  return path.split("\\").join("/");
}

// Static `import ... from "./x.js"` and `import "./x.js"` specifiers.
export function findImports(source) {
  const specifiers = [];
  const pattern = /(?:^|\n)\s*(?:import|export)\s[^"'`;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    specifiers.push(match[1] ?? match[2]);
  }
  return specifiers;
}

// Files reachable from newtab.html (scripts + stylesheets + the JS import graph).
export function collectReachableFiles(root = ROOT) {
  const reachable = new Set(["manifest.json", "newtab.html"]);
  const html = readFileSync(join(root, "newtab.html"), "utf8");
  const queue = [];

  for (const match of html.matchAll(/<script[^>]*\ssrc=["']([^"']+)["']/g)) {
    queue.push(match[1]);
  }
  for (const match of html.matchAll(/<link[^>]*\shref=["']([^"']+)["']/g)) {
    reachable.add(match[1]);
  }

  while (queue.length) {
    const file = posix.normalize(queue.pop());
    if (reachable.has(file) || /^https?:/.test(file)) {
      continue;
    }
    reachable.add(file);
    const full = join(root, file);
    if (file.endsWith(".js") && existsSync(full)) {
      for (const specifier of findImports(readFileSync(full, "utf8"))) {
        if (specifier.startsWith(".")) {
          queue.push(posix.normalize(posix.join(posix.dirname(file), specifier)));
        }
      }
    }
  }

  return reachable;
}

export function selectRuntimeFiles(root = ROOT) {
  const files = [];

  for (const name of readdirSync(root)) {
    if (statSync(join(root, name)).isFile() && ROOT_RUNTIME_PATTERN.test(name)) {
      files.push(name);
    }
  }

  const assetRoot = join(root, ASSET_DIR);
  if (existsSync(assetRoot)) {
    for (const full of walk(assetRoot)) {
      files.push(toPosix(relative(root, full)));
    }
  }

  return files.sort();
}

export function validateFileSelection(files, root = ROOT) {
  const problems = [];
  const reachable = collectReachableFiles(root);

  for (const file of files) {
    if (file !== "manifest.json" && FORBIDDEN_PATTERN.test(file)) {
      problems.push(`Forbidden file selected: ${file}`);
    }
    if (!file.startsWith(`${ASSET_DIR}/`) && !reachable.has(file)) {
      problems.push(`Not referenced by newtab.html or any import (orphan): ${file}`);
    }
  }
  for (const needed of reachable) {
    if (!files.includes(needed)) {
      problems.push(`Referenced but missing from package: ${needed}`);
    }
  }
  if (!files.includes("manifest.json")) {
    problems.push("manifest.json is missing.");
  }

  return problems;
}

// ---- Build --------------------------------------------------------------
export function buildPackage({ root = ROOT, outDir = join(root, "dist") } = {}) {
  const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8"));
  const files = selectRuntimeFiles(root);
  const problems = validateFileSelection(files, root);

  if (problems.length) {
    throw new Error(`Package validation failed:\n- ${problems.join("\n- ")}`);
  }

  const entries = files.map((name) => ({ name, data: readFileSync(join(root, name)) }));
  const zip = createZip(entries);

  // Read the ZIP back and compare to the source files.
  const readBack = readZip(zip);
  if (readBack.length !== entries.length) {
    throw new Error("Verification failed: entry count mismatch.");
  }
  for (const entry of readBack) {
    const source = entries.find((candidate) => candidate.name === entry.name);
    if (!source || !source.data.equals(entry.data) || crc32(entry.data) !== entry.crc) {
      throw new Error(`Verification failed for ${entry.name}.`);
    }
  }
  if (readBack.find((entry) => entry.name === "manifest.json") === undefined) {
    throw new Error("Verification failed: manifest.json is not at the ZIP root.");
  }

  mkdirSync(outDir, { recursive: true });
  const zipPath = join(outDir, `new-tab-dashboard-${manifest.version}.zip`);
  writeFileSync(zipPath, zip);

  return { zipPath, version: manifest.version, files, bytes: zip.length };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const outFlag = process.argv.indexOf("--out");
  const outDir = outFlag > -1 ? resolve(process.argv[outFlag + 1]) : undefined;
  try {
    const result = buildPackage(outDir ? { outDir } : {});
    console.log(`Built ${result.zipPath}`);
    console.log(`${result.files.length} files, ${result.bytes} bytes, version ${result.version}`);
    for (const file of result.files) {
      console.log(`  ${file}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
