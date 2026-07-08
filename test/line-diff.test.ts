// Unit tests for computeLineDiff — the pure line diff behind the INLINE diff
// the chat renders itself (permission card + edit tool rows). Diffs render
// inside the chat tab by design, never a separate diff-editor tab (the old tab
// covered the chat webview and its reveal-replay reopened the tab in a
// focus-stealing loop), so this helper is what the user actually reviews.
import { describe, it, expect } from "vitest";
// @ts-expect-error — plain JS module, no types
import { computeLineDiff } from "../media/webview-helpers.js";

type Row = { type: "same" | "add" | "del"; text: string };

describe("computeLineDiff", () => {
  it("marks a replaced line as del + add with surrounding context", () => {
    expect(computeLineDiff("a\nb\nc", "a\nB\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "B" },
      { type: "same", text: "c" },
    ]);
  });

  it("orders deletions before additions within a hunk", () => {
    expect(computeLineDiff("x1\nx2", "y1")).toEqual([
      { type: "del", text: "x1" },
      { type: "del", text: "x2" },
      { type: "add", text: "y1" },
    ]);
  });

  it("returns all-same rows for identical text", () => {
    expect(computeLineDiff("a\nb", "a\nb")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
    ]);
  });

  it("treats a new file (empty before) as pure additions", () => {
    expect(computeLineDiff("", "a\nb")).toEqual([
      { type: "add", text: "a" },
      { type: "add", text: "b" },
    ]);
  });

  it("treats an emptied file as pure deletions", () => {
    expect(computeLineDiff("a\nb", "")).toEqual([
      { type: "del", text: "a" },
      { type: "del", text: "b" },
    ]);
  });

  it("shows a pure insertion between unchanged lines", () => {
    expect(computeLineDiff("a\nc", "a\nb\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("keeps a small patch in a big file small (common prefix/suffix trim)", () => {
    const before = Array.from({ length: 2000 }, (_, i) => `line ${i}`);
    const after = [...before];
    after[1000] = "CHANGED";
    const rows: Row[] = computeLineDiff(before.join("\n"), after.join("\n"));
    expect(rows).toHaveLength(2001);
    expect(rows[1000]).toEqual({ type: "del", text: "line 1000" });
    expect(rows[1001]).toEqual({ type: "add", text: "CHANGED" });
    expect(rows.filter((r) => r.type !== "same")).toHaveLength(2);
  });

  it("degrades a pathological full rewrite to del-block + add-block instead of an O(n·m) stall", () => {
    const before = Array.from({ length: 1000 }, (_, i) => `old ${i}`).join("\n");
    const after = Array.from({ length: 1000 }, (_, i) => `new ${i}`).join("\n");
    const rows: Row[] = computeLineDiff(before, after);
    expect(rows).toHaveLength(2000);
    expect(rows.slice(0, 1000).every((r) => r.type === "del")).toBe(true);
    expect(rows.slice(1000).every((r) => r.type === "add")).toBe(true);
  });

  it("tolerates null/undefined inputs", () => {
    expect(computeLineDiff(undefined, undefined)).toEqual([{ type: "same", text: "" }]);
    expect(computeLineDiff(null, "a")).toEqual([{ type: "add", text: "a" }]);
    expect(computeLineDiff("a", null)).toEqual([{ type: "del", text: "a" }]);
  });
});
