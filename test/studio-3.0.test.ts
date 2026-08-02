// Studio 3.0.0 pure helpers: composer seed policy, task quick-actions,
// template gallery, workspace doc selection.
import { describe, it, expect } from "vitest";
import {
  applyComposerSeed,
  taskQuickActions,
  businessTemplates,
  filterTemplates,
  businessDocTypeStarters,
  welcomeStarters,
} from "../media/webview-helpers.js";
import {
  selectWorkspaceDocs,
  WORKSPACE_DOCS_CAP,
} from "../src/workspace-docs";

describe("applyComposerSeed", () => {
  it("sets when composer is empty", () => {
    expect(applyComposerSeed("", "Hello")).toBe("Hello");
    expect(applyComposerSeed(null, "Hello")).toBe("Hello");
  });

  it("sets when composer is whitespace-only", () => {
    expect(applyComposerSeed("   \n  ", "Seed")).toBe("Seed");
  });

  it("appends on a new line when composer has text", () => {
    expect(applyComposerSeed("Already here", "More")).toBe("Already here\nMore");
    expect(applyComposerSeed("Trailing  \n", "X")).toBe("Trailing\nX");
  });

  it("empty seed is a no-op", () => {
    expect(applyComposerSeed("Keep", "")).toBe("Keep");
    expect(applyComposerSeed("Keep", null)).toBe("Keep");
  });

  // Capability / Grokbit Actions rows use replace so a second workflow click
  // does not stack /explore\n/plan in the composer.
  it("replace mode always returns the seed (even when composer has text)", () => {
    expect(applyComposerSeed("Already here", "More", { mode: "replace" })).toBe("More");
    expect(applyComposerSeed("/grokbit-explore ", "/grokbit-plan ", { mode: "replace" })).toBe(
      "/grokbit-plan ",
    );
    expect(applyComposerSeed("", "/plan ", { mode: "replace" })).toBe("/plan ");
  });

  it("replace mode still no-ops on empty seed", () => {
    expect(applyComposerSeed("Keep", "", { mode: "replace" })).toBe("Keep");
    expect(applyComposerSeed("Keep", null, { mode: "replace" })).toBe("Keep");
  });

  it("default / unknown mode still appends", () => {
    expect(applyComposerSeed("A", "B", undefined)).toBe("A\nB");
    expect(applyComposerSeed("A", "B", {})).toBe("A\nB");
    expect(applyComposerSeed("A", "B", { mode: "append" })).toBe("A\nB");
  });
});

describe("taskQuickActions (E1 catalog)", () => {
  it("has at least five frozen task ids with non-empty prompts", () => {
    const tasks = taskQuickActions() as Array<{ id: string; label: string; prompt: string }>;
    expect(tasks.length).toBeGreaterThanOrEqual(5);
    const ids = tasks.map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining(["invoice", "receipt", "weekly-report", "pitch", "approval"]),
    );
    for (const t of tasks) {
      expect(t.label.trim().length).toBeGreaterThan(0);
      expect(t.prompt.trim().length).toBeGreaterThan(10);
    }
  });

  it("does not duplicate format starter ids", () => {
    const formatIds = new Set(
      (businessDocTypeStarters() as Array<{ id: string }>).map((t) => t.id),
    );
    for (const t of taskQuickActions() as Array<{ id: string }>) {
      expect(formatIds.has(t.id)).toBe(false);
    }
  });

  it("does not replace core welcome starter ids", () => {
    const welcomeIds = new Set(
      (welcomeStarters({ voiceConfigured: true }) as Array<{ id: string }>).map((c) => c.id),
    );
    expect(welcomeIds.has("explain")).toBe(true);
    for (const t of taskQuickActions() as Array<{ id: string }>) {
      expect(welcomeIds.has(t.id)).toBe(false);
    }
  });
});

describe("businessTemplates + filterTemplates (E4)", () => {
  it("ships 12–15 templates with id, title, tags, prompt", () => {
    const list = businessTemplates() as Array<{
      id: string;
      title: string;
      tags: string[];
      prompt: string;
    }>;
    expect(list.length).toBeGreaterThanOrEqual(12);
    expect(list.length).toBeLessThanOrEqual(15);
    const ids = new Set<string>();
    for (const t of list) {
      expect(t.id).toBeTruthy();
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.title.trim().length).toBeGreaterThan(0);
      expect(Array.isArray(t.tags)).toBe(true);
      expect(t.prompt.trim().length).toBeGreaterThan(10);
    }
  });

  it("filterTemplates matches title and tags; empty query returns all", () => {
    const list = businessTemplates();
    expect(filterTemplates(list, "").length).toBe(list.length);
    expect(filterTemplates(list, "   ").length).toBe(list.length);
    const inv = filterTemplates(list, "invoice") as Array<{ id: string; title: string }>;
    expect(inv.length).toBeGreaterThan(0);
    expect(
      inv.every(
        (t) =>
          /invoice/i.test(t.id) ||
          /invoice/i.test(t.title) ||
          (Array.isArray((t as { tags?: string[] }).tags) &&
            (t as { tags: string[] }).tags.some((x) => /invoice/i.test(x))),
      ),
    ).toBe(true);
    expect(filterTemplates(list, "zzznomatch999").length).toBe(0);
  });

  it("filter is case-insensitive on tags", () => {
    const list = businessTemplates();
    const a = filterTemplates(list, "FINANCE");
    const b = filterTemplates(list, "finance");
    expect(a.length).toBe(b.length);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("selectWorkspaceDocs (E2 pure)", () => {
  it("classifies, de-dupes, sorts by mtime, and caps", () => {
    const files = [
      { path: "/ws/old.docx", mtimeMs: 100 },
      { path: "/ws/new.xlsx", mtimeMs: 500 },
      { path: "/ws/skip.ts", mtimeMs: 900 },
      { path: "/ws/old.docx", mtimeMs: 100 }, // dup
      { path: "/ws/mid.pdf", mtimeMs: 300 },
    ];
    const { entries, capped, total } = selectWorkspaceDocs(files, 2);
    expect(total).toBe(3); // docx, xlsx, pdf
    expect(capped).toBe(true);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe("new.xlsx");
    expect(entries[0].kind).toBe("excel");
    expect(entries[1].name).toBe("mid.pdf");
  });

  it("returns empty for no files / unknown only", () => {
    expect(selectWorkspaceDocs([], WORKSPACE_DOCS_CAP).entries).toEqual([]);
    expect(selectWorkspaceDocs([{ path: "a.ts" }]).entries).toEqual([]);
  });

  it("default cap is WORKSPACE_DOCS_CAP", () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      path: `/w/f${i}.md`,
      mtimeMs: i,
    }));
    const { entries, capped, total } = selectWorkspaceDocs(many);
    expect(total).toBe(60);
    expect(capped).toBe(true);
    expect(entries).toHaveLength(WORKSPACE_DOCS_CAP);
  });
});
