// Verifies that user-controlled text is escaped in HTML built with innerHTML.
import { test } from "node:test";
import assert from "node:assert/strict";

// dom.js reads the document at import time; give it an empty one.
globalThis.document = {
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  hidden: false,
};
globalThis.window = globalThis.window ?? { addEventListener: () => {}, location: {} };

const warn = console.warn;
console.warn = () => {};
const { createTaskMarkup } = await import("../tasks.js");
console.warn = warn;

const PAYLOADS = [
  '<img src=x onerror="alert(1)">',
  '"><script>alert(1)</script>',
  "' onmouseover='alert(1)",
];

test("task markup escapes hostile task text", () => {
  for (const payload of PAYLOADS) {
    const markup = createTaskMarkup({
      id: "task-1",
      text: payload,
      completed: false,
      priority: "medium",
      subtasks: [{ id: "s1", text: payload, completed: false }],
    });

    assert.doesNotMatch(markup, /<img\s|<script/i, `unescaped tag for payload: ${payload}`);
    // A payload that closes an attribute would add a real attribute, not literal text.
    // Quoted attribute values are literal text; a breakout would leave a bare handler outside the quotes.
    const tags = markup.match(/<[^>]*>/g) ?? [];
    assert.ok(
      tags.every((tag) => !/\son[a-z]+\s*=/i.test(tag.replace(/"[^"]*"|'[^']*'/g, '""'))),
      `injected event-handler attribute for payload: ${payload}`,
    );
    assert.ok(markup.includes("&lt;") || markup.includes("&#39;") || markup.includes("&quot;"));
  }
});

test("task markup escapes hostile ids", () => {
  const markup = createTaskMarkup({ id: '"><b>x</b>', text: "ok", completed: false, priority: "low", subtasks: [] });
  assert.doesNotMatch(markup, /<b>x<\/b>/);
});
