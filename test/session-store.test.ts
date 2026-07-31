// Unit tests for src/session-store.ts — the SessionStore seam extracted in WP4
// (docs/plans/claude-code-backend.md). GrokSessionStore is a behaviour-preserving
// wrapper around the existing sessions.ts primitives (already covered by
// sessions.test.ts); these tests focus on ClaudeSessionStore (new — path
// encoding, title derivation, malformed input) and the cross-backend merge.
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { FsLike, SessionMetaOverrides, sessionsDirFor } from "../src/sessions";
import {
  ClaudeFsLike,
  ClaudeSessionStore,
  GrokSessionStore,
  ReadEntriesFn,
  SessionStore,
  SessionStoreListEntry,
  buildMergedSessionsPage,
  claudeProjectDirName,
  daysToSinceMs,
  resolveClaudeHome,
  resolveClaudeProjectDir,
} from "../src/session-store";

const FIXTURE_DIR = path.join(__dirname, "fixtures", "claude-sessions");
function loadFixture(name: string): string {
  return readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

// ---------------------------------------------------------------------------
// Fake ClaudeFsLike — mirrors the buildFs helper in sessions.test.ts, but reads
// are bounded head/tail slices (readSlice) rather than whole-file reads, since
// that's the whole point of the production implementation.
// ---------------------------------------------------------------------------
interface ClaudeFileEntry {
  content: string;
  mtimeMs: number;
}

function buildClaudeFs(files: Record<string, ClaudeFileEntry>, dirs: string[] = []): ClaudeFsLike {
  const dirSet = new Set(dirs);
  const removed = new Set<string>();
  const fileExists = (p: string) => !removed.has(p) && files[p] !== undefined;
  const dirExists = (p: string) => dirSet.has(p) && !removed.has(p);

  function listChildren(p: string): string[] {
    const prefix = p.endsWith(path.sep) || p.endsWith("/") ? p : p + path.sep;
    const altPrefix = p + (p.endsWith("/") ? "" : "/");
    const names = new Set<string>();
    for (const fp of Object.keys(files)) {
      if (removed.has(fp)) continue;
      if (fp.startsWith(prefix) || fp.startsWith(altPrefix)) {
        const rest = fp.startsWith(prefix) ? fp.slice(prefix.length) : fp.slice(altPrefix.length);
        const first = rest.split(/[\\/]/)[0];
        if (first) names.add(first);
      }
    }
    for (const d of dirSet) {
      if (removed.has(d)) continue;
      if (d.startsWith(prefix) || d.startsWith(altPrefix)) {
        const rest = d.startsWith(prefix) ? d.slice(prefix.length) : d.slice(altPrefix.length);
        const first = rest.split(/[\\/]/)[0];
        if (first) names.add(first);
      }
    }
    return Array.from(names);
  }

  return {
    existsSync: (p) => fileExists(p) || dirExists(p),
    readdirSync: (p) => {
      const children = listChildren(p);
      // A directory "exists" either because it was explicitly listed, or
      // (mirroring a real filesystem) because it's the implicit ancestor of
      // some other listed file/dir — the projects root itself is never listed
      // explicitly in these tests, only its children.
      if (!dirExists(p) && !fileExists(p) && children.length === 0) throw new Error(`ENOENT: ${p}`);
      return children;
    },
    statSync: (p) => {
      const f = files[p];
      if (!f || removed.has(p)) throw new Error(`ENOENT: ${p}`);
      return { mtimeMs: f.mtimeMs, size: Buffer.byteLength(f.content, "utf8") };
    },
    readSlice: (p, start, length) => {
      const f = files[p];
      if (!f || removed.has(p)) throw new Error(`ENOENT: ${p}`);
      const buf = Buffer.from(f.content, "utf8");
      const from = Math.max(0, Math.min(start, buf.length));
      const len = Math.max(0, Math.min(length, buf.length - from));
      return buf.subarray(from, from + len).toString("utf8");
    },
    unlinkSync: (p) => {
      if (!fileExists(p)) throw new Error(`ENOENT: ${p}`);
      removed.add(p);
    },
  };
}

const claudeHome = "/home/user/.claude";
const cwd = "C:\\Users\\israe\\Projects\\Grokbit.ai";
const WANTED_DIR_NAME = "C--Users-israe-Projects-Grokbit-ai";

function projectDir(dirName = WANTED_DIR_NAME): string {
  return path.join(claudeHome, "projects", dirName);
}

// ---------------------------------------------------------------------------

describe("claudeProjectDirName", () => {
  it("replaces every non-alphanumeric character with '-', preserving case", () => {
    expect(claudeProjectDirName(cwd)).toBe("C--Users-israe-Projects-Grokbit-ai");
  });

  it("encodes a '.' in the folder name the same as any other separator", () => {
    // "Grokbit.ai" -> "Grokbit-ai": the dot is not treated specially.
    expect(claudeProjectDirName("C:\\work\\Grokbit.ai")).toBe("C--work-Grokbit-ai");
  });

  it("is a pure string transform with no path awareness (posix cwd too)", () => {
    expect(claudeProjectDirName("/home/user/my.project")).toBe("-home-user-my-project");
  });
});

describe("resolveClaudeHome", () => {
  it("prefers HOME over USERPROFILE", () => {
    expect(resolveClaudeHome({ HOME: "/h", USERPROFILE: "C:\\u" } as NodeJS.ProcessEnv)).toBe(path.join("/h", ".claude"));
  });

  it("falls back to USERPROFILE when HOME is unset", () => {
    expect(resolveClaudeHome({ USERPROFILE: "C:\\u" } as NodeJS.ProcessEnv)).toBe(path.join("C:\\u", ".claude"));
  });
});

describe("resolveClaudeProjectDir", () => {
  it("resolves the exact-case candidate when it exists", () => {
    const fs = buildClaudeFs({}, [projectDir(WANTED_DIR_NAME)]);
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd)).toBe(projectDir(WANTED_DIR_NAME));
  });

  it("Windows gotcha: falls back case-insensitively when only a differently-cased dir exists", () => {
    // Real machines have both `C--Users-israe-...` and `c--Users-israe-...` for the
    // SAME project, because different tools normalize the drive-letter case
    // differently at session-creation time. cwd here would want the uppercase
    // "C--..." name, but only the lowercase "c--..." directory is on disk.
    // Explicit "win32" — this fallback is Windows-only (see the next test) —
    // so this assertion is deterministic regardless of which OS runs the suite.
    const onDisk = path.join(claudeHome, "projects", "c--Users-israe-Projects-Grokbit-ai");
    const fs = buildClaudeFs({}, [onDisk]);
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd, "win32")).toBe(onDisk);
  });

  // Security finding: the case-insensitive fallback is only justified by a
  // Windows drive-letter artifact (Windows filesystems are case-insensitive).
  // On a case-sensitive filesystem (macOS/Linux), "/home/u/Foo" and
  // "/home/u/foo" are genuinely different projects — an unconditional
  // fallback would resolve one workspace's Claude sessions to another's, and
  // since this IS what remove()/removeAll() delete from, "Clear all history"
  // could delete (and readEntries could disclose the titles of) another
  // project's sessions.
  it("does NOT fall back case-insensitively on a non-Windows platform", () => {
    const onDisk = path.join(claudeHome, "projects", "c--Users-israe-Projects-Grokbit-ai");
    const fs = buildClaudeFs({}, [onDisk]);
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd, "linux")).toBeUndefined();
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd, "darwin")).toBeUndefined();
  });

  it("returns undefined when the projects dir doesn't exist at all", () => {
    const fs = buildClaudeFs({});
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd)).toBeUndefined();
  });

  it("returns undefined when the projects dir exists but has no matching project", () => {
    const fs = buildClaudeFs({}, [path.join(claudeHome, "projects", "some-other-project")]);
    expect(resolveClaudeProjectDir(fs, claudeHome, cwd)).toBeUndefined();
  });
});

describe("ClaudeSessionStore.index", () => {
  const dir = projectDir();

  it("orders sessions newest-first by .jsonl mtime, stat-only", () => {
    const fs = buildClaudeFs(
      {
        [path.join(dir, "old.jsonl")]: { content: "{}", mtimeMs: 1000 },
        [path.join(dir, "new.jsonl")]: { content: "{}", mtimeMs: 3000 },
        [path.join(dir, "mid.jsonl")]: { content: "{}", mtimeMs: 2000 },
      },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const out = store.index(cwd);
    expect(out.map((e) => e.id)).toEqual(["new", "mid", "old"]);
    expect(out.every((e) => e.backend === "claude")).toBe(true);
  });

  it("ignores a sibling directory that shares a session's uuid (subagent/snapshot data, not a session)", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "real.jsonl")]: { content: "{}", mtimeMs: 1000 } },
      [dir, path.join(dir, "real"), path.join(dir, "real", "subagents")],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.index(cwd).map((e) => e.id)).toEqual(["real"]);
  });

  it("returns [] when there is no project directory for this cwd", () => {
    const fs = buildClaudeFs({});
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.index(cwd)).toEqual([]);
  });
});

describe("ClaudeSessionStore.readEntries — title derivation", () => {
  const dir = projectDir();
  const overrides: SessionMetaOverrides = {};

  it("tier 1: uses the LAST ai-title record (Claude Code regenerates it as the conversation grows)", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "s1.jsonl")]: { content: loadFixture("with-ai-title.jsonl"), mtimeMs: 5000 } },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const [entry] = store.readEntries(cwd, ["s1"], overrides);
    expect(entry.displayName).toBe("Protect main branch from direct commits");
    expect(entry.rawSummary).toBe("Protect main branch from direct commits");
    expect(entry.backend).toBe("claude");
    expect(entry.cwd).toBe(cwd);
    expect(entry.updatedAt).toBe(5000);
  });

  it("tier 3: falls back to the first REAL user message when there is no ai-title record", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "s2.jsonl")]: { content: loadFixture("no-ai-title-first-message.jsonl"), mtimeMs: 4000 } },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const [entry] = store.readEntries(cwd, ["s2"], overrides);
    // Skips the isSidechain turn and the tool_result-only turn; picks the first
    // genuine free-text user message.
    expect(entry.displayName).toBe("Rewrite the changelog generator to group entries by scope.");
  });

  it("tier 4: dated 'Untitled' fallback when the session has no ai-title and no real user text (mirrors grok's fallbackName)", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "s3.jsonl")]: { content: loadFixture("no-real-content.jsonl"), mtimeMs: Date.UTC(2026, 6, 8, 13, 32) } },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const [entry] = store.readEntries(cwd, ["s3"], overrides);
    // Slash-command scaffolding (<command-name>, <local-command-stdout>,
    // <task-notification>) must never be picked as a title source.
    expect(entry.displayName).toMatch(/^Untitled \(/);
    expect(entry.rawSummary).toBe("");
  });

  it("malformed/truncated jsonl does not throw — recovers whatever valid records it can", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "s4.jsonl")]: { content: loadFixture("malformed.jsonl"), mtimeMs: 1000 } },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    let entries: SessionStoreListEntry[] = [];
    expect(() => {
      entries = store.readEntries(cwd, ["s4"], overrides);
    }).not.toThrow();
    expect(entries).toHaveLength(1);
    // No usable ai-title (the last line is truncated mid-record); falls back to
    // the one real user message the file does contain.
    expect(entries[0].displayName).toBe("Fix the flaky retry test.");
  });

  it("applies a customName override over the derived title", () => {
    const fs = buildClaudeFs(
      { [path.join(dir, "s1.jsonl")]: { content: loadFixture("with-ai-title.jsonl"), mtimeMs: 5000 } },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const [entry] = store.readEntries(cwd, ["s1"], { s1: { customName: "My renamed chat" } });
    expect(entry.displayName).toBe("My renamed chat");
    expect(entry.customName).toBe("My renamed chat");
  });

  it("skips an id that has no file on disk, without throwing", () => {
    const fs = buildClaudeFs({}, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readEntries(cwd, ["missing"], overrides)).toEqual([]);
  });

  it("returns [] for every id when the project directory doesn't exist at all", () => {
    const fs = buildClaudeFs({});
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readEntries(cwd, ["a", "b"], overrides)).toEqual([]);
  });

  it("preserves the requested id order", () => {
    const fs = buildClaudeFs(
      {
        [path.join(dir, "s1.jsonl")]: { content: loadFixture("with-ai-title.jsonl"), mtimeMs: 5000 },
        [path.join(dir, "s2.jsonl")]: { content: loadFixture("no-ai-title-first-message.jsonl"), mtimeMs: 4000 },
      },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readEntries(cwd, ["s2", "s1"], overrides).map((e) => e.id)).toEqual(["s2", "s1"]);
  });
});

describe("ClaudeSessionStore.remove / removeAll", () => {
  const dir = projectDir();

  it("removes only the given session's .jsonl", () => {
    const fs = buildClaudeFs(
      {
        [path.join(dir, "keep.jsonl")]: { content: "{}", mtimeMs: 1 },
        [path.join(dir, "gone.jsonl")]: { content: "{}", mtimeMs: 1 },
      },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    store.remove(cwd, "gone");
    expect(store.index(cwd).map((e) => e.id)).toEqual(["keep"]);
  });

  it("remove() is a no-op when the session doesn't exist", () => {
    const fs = buildClaudeFs({}, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(() => store.remove(cwd, "missing")).not.toThrow();
  });

  it("removeAll deletes every session except the protected ids, best-effort", () => {
    const fs = buildClaudeFs(
      {
        [path.join(dir, "a.jsonl")]: { content: "{}", mtimeMs: 1 },
        [path.join(dir, "b.jsonl")]: { content: "{}", mtimeMs: 1 },
        [path.join(dir, "c.jsonl")]: { content: "{}", mtimeMs: 1 },
      },
      [dir],
    );
    const store = new ClaudeSessionStore({ fs, claudeHome });
    const removed = store.removeAll(cwd, new Set(["b"]));
    expect(removed.sort()).toEqual(["a", "c"]);
    expect(store.index(cwd).map((e) => e.id)).toEqual(["b"]);
  });

  it("removeAll returns [] when the project directory doesn't exist", () => {
    const fs = buildClaudeFs({});
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.removeAll(cwd)).toEqual([]);
  });

  // LOW finding: an id from a webview `deleteSession` message reaches
  // path.join(dir, `${id}.jsonl`) before unlinkSync — a crafted ".." id could
  // otherwise resolve outside the project directory. Defense-in-depth (see
  // isSafeSessionId/isWithinDir in sessions.ts, and the grok twin in
  // sessions.test.ts's deleteSessionDir suite).
  it("refuses to delete outside the project directory for a crafted \"..\" id", () => {
    const victimPath = path.join(path.dirname(dir), "victim.jsonl"); // a SIBLING of dir
    const fs = buildClaudeFs({ [victimPath]: { content: "{}", mtimeMs: 1 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    store.remove(cwd, path.join("..", "victim"));
    expect(fs.existsSync(victimPath)).toBe(true); // must survive — the crafted id was rejected
  });
});

describe("ClaudeSessionStore.readTokenUsage", () => {
  const dir = projectDir();

  /** One `type:"assistant"` record carrying the real `message.usage` shape. */
  const assistantWithUsage = (u: Record<string, unknown>) =>
    JSON.stringify({ type: "assistant", message: { usage: u } });

  it("sums prompt + cache + output tokens from the last assistant record", () => {
    // The cache fields dominate a long session — omitting them understates
    // context usage by orders of magnitude (real record: 2 + 696 + 474901 + 291).
    const content = [
      assistantWithUsage({ input_tokens: 5, cache_read_input_tokens: 100, output_tokens: 7 }),
      assistantWithUsage({
        input_tokens: 2,
        cache_creation_input_tokens: 696,
        cache_read_input_tokens: 474901,
        output_tokens: 291,
      }),
    ].join("\n");
    const fs = buildClaudeFs({ [path.join(dir, "s1.jsonl")]: { content, mtimeMs: 1000 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readTokenUsage(cwd, "s1")).toBe(2 + 696 + 474901 + 291);
  });

  it("takes the LAST usage record, not the first (context grows across turns)", () => {
    const content = [
      assistantWithUsage({ input_tokens: 10, output_tokens: 1 }),
      assistantWithUsage({ input_tokens: 900, output_tokens: 100 }),
    ].join("\n");
    const fs = buildClaudeFs({ [path.join(dir, "s1.jsonl")]: { content, mtimeMs: 1000 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readTokenUsage(cwd, "s1")).toBe(1000);
  });

  it("skips non-assistant records and records with no usage", () => {
    const content = [
      JSON.stringify({ type: "user", message: { content: "hi" } }),
      JSON.stringify({ type: "assistant", message: {} }),
      assistantWithUsage({ input_tokens: 3, output_tokens: 4 }),
      JSON.stringify({ type: "ai-title", aiTitle: "Something" }),
    ].join("\n");
    const fs = buildClaudeFs({ [path.join(dir, "s1.jsonl")]: { content, mtimeMs: 1000 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readTokenUsage(cwd, "s1")).toBe(7);
  });

  it("returns undefined rather than a misleading 0 when no usage record exists", () => {
    const content = JSON.stringify({ type: "user", message: { content: "hi" } });
    const fs = buildClaudeFs({ [path.join(dir, "s1.jsonl")]: { content, mtimeMs: 1000 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readTokenUsage(cwd, "s1")).toBeUndefined();
  });

  it("tolerates malformed jsonl without throwing", () => {
    const content = ["not json at all", "{broken", assistantWithUsage({ input_tokens: 8 })].join("\n");
    const fs = buildClaudeFs({ [path.join(dir, "s1.jsonl")]: { content, mtimeMs: 1000 } }, [dir]);
    const store = new ClaudeSessionStore({ fs, claudeHome });
    expect(store.readTokenUsage(cwd, "s1")).toBe(8);
  });

  it("is undefined when there is no project directory or no such session", () => {
    const store = new ClaudeSessionStore({ fs: buildClaudeFs({}), claudeHome });
    expect(store.readTokenUsage(cwd, "anything")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// GrokSessionStore — thin delegation to the unchanged sessions.ts primitives.
// The deep grok-specific behaviour (empty-primer sweep, title fallback, mtime
// cache semantics) is already covered by sessions.test.ts; this just proves the
// wrapper delegates correctly and stamps backend: "grok".
// ---------------------------------------------------------------------------
const grokHome = "/home/user/.grok";

interface GrokFileEntry {
  isDir: boolean;
  content?: string;
  mtimeMs?: number;
}

function buildGrokFs(files: Record<string, GrokFileEntry>): FsLike {
  const removed = new Set<string>();
  const exists = (p: string) => !removed.has(p) && files[p] !== undefined;
  return {
    existsSync: exists,
    readdirSync: (p) => {
      if (!exists(p)) throw new Error(`ENOENT: ${p}`);
      const prefix = p.endsWith(path.sep) || p.endsWith("/") ? p : p + path.sep;
      const altPrefix = p + (p.endsWith("/") ? "" : "/");
      const names = new Set<string>();
      for (const fp of Object.keys(files)) {
        if (removed.has(fp)) continue;
        if (fp.startsWith(prefix) || fp.startsWith(altPrefix)) {
          const rest = fp.startsWith(prefix) ? fp.slice(prefix.length) : fp.slice(altPrefix.length);
          const first = rest.split(/[\\/]/)[0];
          if (first) names.add(first);
        }
      }
      return Array.from(names);
    },
    readFileSync: (p) => {
      const f = files[p];
      if (!f || removed.has(p)) throw new Error(`ENOENT: ${p}`);
      return f.content ?? "";
    },
    statSync: (p) => {
      const f = files[p];
      if (!f || removed.has(p)) throw new Error(`ENOENT: ${p}`);
      return { isDirectory: () => f.isDir, mtimeMs: f.mtimeMs ?? 0 };
    },
    rmSync: (p) => {
      for (const fp of Object.keys(files)) {
        if (fp === p || fp.startsWith(p + "/") || fp.startsWith(p + path.sep)) removed.add(fp);
      }
    },
    rmdirSync: (p) => {
      for (const fp of Object.keys(files)) {
        if (fp === p || fp.startsWith(p + "/") || fp.startsWith(p + path.sep)) removed.add(fp);
      }
    },
  };
}

function grokDirFor(id: string): string {
  return path.join(sessionsDirFor(grokHome, cwd), id);
}

describe("GrokSessionStore", () => {
  function summaryFs(): FsLike {
    return buildGrokFs({
      [sessionsDirFor(grokHome, cwd)]: { isDir: true },
      [grokDirFor("a")]: { isDir: true },
      [grokDirFor("b")]: { isDir: true },
      [path.join(grokDirFor("a"), "summary.json")]: {
        isDir: false,
        mtimeMs: 1000,
        content: JSON.stringify({ info: { id: "a", cwd }, session_summary: "older", updated_at: "2026-01-01T00:00:00Z", num_messages: 2 }),
      },
      [path.join(grokDirFor("b"), "summary.json")]: {
        isDir: false,
        mtimeMs: 2000,
        content: JSON.stringify({ info: { id: "b", cwd }, session_summary: "newer", updated_at: "2026-02-01T00:00:00Z", num_messages: 3 }),
      },
    });
  }

  it("index() stamps backend: 'grok' and orders newest-first by mtime", () => {
    const store = new GrokSessionStore({ fs: summaryFs(), grokHome });
    const out = store.index(cwd);
    expect(out.map((e) => e.id)).toEqual(["b", "a"]);
    expect(out.every((e) => e.backend === "grok")).toBe(true);
  });

  it("readEntries() delegates to readSessionEntries and stamps backend: 'grok'", () => {
    const store = new GrokSessionStore({ fs: summaryFs(), grokHome });
    const [entry] = store.readEntries(cwd, ["b"], {});
    expect(entry.displayName).toBe("newer");
    expect(entry.backend).toBe("grok");
  });

  it("remove() deletes the session directory", () => {
    const fs = summaryFs();
    const store = new GrokSessionStore({ fs, grokHome });
    store.remove(cwd, "a");
    expect(store.index(cwd).map((e) => e.id)).toEqual(["b"]);
  });

  it("removeAll() clears every session except the protected ids", () => {
    const fs = summaryFs();
    const store = new GrokSessionStore({ fs, grokHome });
    const removed = store.removeAll(cwd, new Set(["b"]));
    expect(removed).toEqual(["a"]);
    expect(store.index(cwd).map((e) => e.id)).toEqual(["b"]);
  });

  it("readTokenUsage() reads signals.json's contextTokensUsed", () => {
    const fs = buildGrokFs({
      [grokDirFor("a")]: { isDir: true },
      [path.join(grokDirFor("a"), "signals.json")]: { isDir: false, content: JSON.stringify({ contextTokensUsed: 4321 }) },
    });
    const store = new GrokSessionStore({ fs, grokHome });
    expect(store.readTokenUsage(cwd, "a")).toBe(4321);
  });
});

// ---------------------------------------------------------------------------
// buildMergedSessionsPage — cross-backend ordering, pagination, and search.
// ---------------------------------------------------------------------------
describe("buildMergedSessionsPage", () => {
  function makeStore(backend: "grok" | "claude", rows: { id: string; mtimeMs: number; name: string }[]): SessionStore {
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      backend,
      index: () => rows.map((r) => ({ id: r.id, mtimeMs: r.mtimeMs, backend })),
      readEntries: (_cwd, ids) =>
        ids
          .map((id) => byId.get(id))
          .filter((r): r is { id: string; mtimeMs: number; name: string } => !!r)
          .map((r) => ({
            id: r.id,
            cwd,
            displayName: r.name,
            rawSummary: r.name,
            customName: undefined,
            updatedAt: r.mtimeMs,
            createdAt: r.mtimeMs,
            numMessages: 0,
            modelId: undefined,
            backend,
          })),
      remove: () => {},
      removeAll: () => [],
      readTokenUsage: () => undefined,
    };
  }

  // Interleaved by recency on purpose: grok has the newest AND the oldest,
  // Claude sits in between — proves the merge isn't just "all of store A then
  // all of store B".
  const grokStore = makeStore("grok", [
    { id: "g-new", mtimeMs: 5000, name: "Grok newest" },
    { id: "g-old", mtimeMs: 1000, name: "Grok oldest" },
  ]);
  const claudeStore = makeStore("claude", [
    { id: "c-mid1", mtimeMs: 4000, name: "Claude mid 1" },
    { id: "c-mid2", mtimeMs: 3000, name: "Claude find-me mid 2" },
  ]);

  function readEntries(store: SessionStore, ids: string[]) {
    return store.readEntries(cwd, ids, {});
  }

  it("interleaves both backends by recency, not grouped by backend", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "",
      readEntries,
    });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2", "g-old"]);
    expect(page.entries.map((e) => e.backend)).toEqual(["grok", "claude", "claude", "grok"]);
    expect(page.total).toBe(4);
    expect(page.hasMore).toBe(false);
    expect(page.index.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2", "g-old"]);
  });

  it("paginates across the merged, interleaved order", () => {
    const page1 = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 0, limit: 2, query: "", readEntries });
    expect(page1.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1"]);
    expect(page1.hasMore).toBe(true);

    const page2 = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 2, limit: 2, query: "", readEntries });
    expect(page2.entries.map((e) => e.id)).toEqual(["c-mid2", "g-old"]);
    expect(page2.hasMore).toBe(false);
  });

  it("search spans both backends and matches across the whole catalog, not just a loaded page", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "find-me",
      readEntries,
    });
    expect(page.entries.map((e) => e.id)).toEqual(["c-mid2"]);
    expect(page.total).toBe(1);
  });

  it("search is case-insensitive and matches a grok entry too", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "NEWEST",
      readEntries,
    });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new"]);
  });

  it("works with a single-backend store list (grok-only merge is a no-op merge)", () => {
    const page = buildMergedSessionsPage({ stores: [grokStore], cwd, offset: 0, limit: 10, query: "", readEntries });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "g-old"]);
  });

  it("hands the mtimeById map to readEntries so a caching reader can decide staleness", () => {
    const seen: Map<string, number>[] = [];
    buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "",
      readEntries: (store, ids, mtimeById) => {
        seen.push(mtimeById);
        return readEntries(store, ids);
      },
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0].get("g-new")).toBe(5000);
    expect(seen[0].get("c-mid1")).toBe(4000);
  });

  // -------------------------------------------------------------------------
  // sinceMs / pinnedIds / totalAll / diskCount windowing (WP3 —
  // docs/plans/capability-surfacing-and-history-ux.md § Thread 3). Same fixture
  // (grokStore/claudeStore) — mtimes: g-new 5000, c-mid1 4000, c-mid2 3000, g-old
  // 1000, merged newest-first order: g-new, c-mid1, c-mid2, g-old.
  // -------------------------------------------------------------------------

  it("[R] mtimeMs === sinceMs is included in the window; sinceMs - 1 excludes that entry", () => {
    const atBoundary = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "", readEntries, sinceMs: 3000,
    });
    expect(atBoundary.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2"]);
    expect(atBoundary.total).toBe(3);

    const justAbove = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "", readEntries, sinceMs: 3001,
    });
    expect(justAbove.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1"]);
    expect(justAbove.total).toBe(2);
  });

  it("sinceMs undefined is byte-identical to the unwindowed result — regression guard for the chat popover, which never passes sinceMs", () => {
    const page = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "", readEntries });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2", "g-old"]);
    expect(page.total).toBe(4);
    expect(page.totalAll).toBe(4);
  });

  it("total is the windowed count, totalAll the unwindowed count, and hasMore reflects the WINDOWED list — never swap the two", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 1, query: "", readEntries, sinceMs: 3500,
    });
    expect(page.total).toBe(2); // windowed: g-new, c-mid1
    expect(page.totalAll).toBe(4); // unwindowed: all 4 sessions for this cwd
    expect(page.hasMore).toBe(true); // 1 of 2 windowed rows loaded so far
  });

  it("[R] diskCount is the number of rows THIS page actually read from disk — the host's nextOffset is built from it, not entries.length after injection — including a short final page", () => {
    const page1 = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 0, limit: 1, query: "", readEntries, sinceMs: 3500 });
    expect(page1.diskCount).toBe(1);
    const page2 = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 1, limit: 1, query: "", readEntries, sinceMs: 3500 });
    expect(page2.diskCount).toBe(1);
    // Nothing left in the 2-row window past offset 2 — a short (empty) page.
    const page3 = buildMergedSessionsPage({ stores: [grokStore, claudeStore], cwd, offset: 2, limit: 1, query: "", readEntries, sinceMs: 3500 });
    expect(page3.diskCount).toBe(0);
  });

  // [R] B5 — readSessionEntries (sessions.ts) silently drops an id whose
  // summary.json is unparseable/locked (plausible on Windows, where grok
  // re-persists a live session's file). diskCount must count INDEX SLOTS
  // consumed, not rows successfully read, or the host's nextOffset
  // (offset + diskCount) under-advances and re-reads already-consumed slots.
  it("[R] diskCount counts index slots consumed, not rows successfully read — a dropped/unparseable id still advances the cursor", () => {
    const droppingOne: ReadEntriesFn = (store, ids, mtimeById) =>
      readEntries(store, ids.filter((id) => id !== "g-old"), mtimeById);
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 4, query: "", readEntries: droppingOne,
    });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2"]); // g-old silently dropped
    expect(page.diskCount).toBe(4); // all 4 index slots in [0, 4) were still consumed
  });

  it("[R] an entirely-unreadable page still advances diskCount past its slots, so nextOffset (offset + diskCount) never gets stuck while hasMore stays true", () => {
    const droppingAll: ReadEntriesFn = () => [];
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 2, query: "", readEntries: droppingAll,
    });
    expect(page.entries).toHaveLength(0);
    // Pre-fix, diskCount was entries.length (0) here, so nextOffset would equal
    // offset forever even though there ARE more windowed rows (hasMore: true) —
    // load-more could never reach the tail.
    expect(page.diskCount).toBe(2);
    expect(page.hasMore).toBe(true);
  });

  it("[R] a pinned id survives the window regardless of its mtime, stays in mtime order, and counts toward total; an unpinned out-of-window entry stays excluded", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "",
      readEntries,
      sinceMs: 3500, // excludes c-mid2 (3000) and g-old (1000)
      pinnedIds: new Set(["g-old"]), // ...except g-old is pinned back in
    });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1", "g-old"]);
    expect(page.total).toBe(3);
  });

  it("index stays the unwindowed merged list even with sinceMs/pinnedIds active — guards the live-synthesis duplicate-row bug", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "", readEntries, sinceMs: 3500,
    });
    expect(page.entries.map((e) => e.id)).toEqual(["g-new", "c-mid1"]);
    expect(page.index.map((e) => e.id)).toEqual(["g-new", "c-mid1", "c-mid2", "g-old"]);
  });

  it("reads only in-window (+ pinned) ids — a windowed page never re-reads a filtered-out entry", () => {
    const seenIds: string[] = [];
    buildMergedSessionsPage({
      stores: [grokStore, claudeStore],
      cwd,
      offset: 0,
      limit: 10,
      query: "",
      readEntries: (store, ids) => {
        seenIds.push(...ids);
        return readEntries(store, ids);
      },
      sinceMs: 3500,
      pinnedIds: new Set(["g-old"]),
    });
    expect(seenIds.sort()).toEqual(["c-mid1", "g-new", "g-old"]);
  });

  it("cross-backend interleave survives windowing", () => {
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "", readEntries, sinceMs: 3500,
    });
    expect(page.entries.map((e) => e.backend)).toEqual(["grok", "claude"]);
  });

  it("query + sinceMs scopes search to the window — a match outside the window doesn't surface", () => {
    // "find-me" only matches c-mid2 (mtimeMs 3000), which sits OUTSIDE a 3500 window.
    const page = buildMergedSessionsPage({
      stores: [grokStore, claudeStore], cwd, offset: 0, limit: 10, query: "find-me", readEntries, sinceMs: 3500,
    });
    expect(page.entries).toEqual([]);
    expect(page.total).toBe(0);
  });
});

describe("daysToSinceMs", () => {
  const now = 1_700_000_000_000;

  it("[R] 0 days means unlimited — maps to sinceMs: undefined, never now - 0 (which would filter out everything)", () => {
    expect(daysToSinceMs(0, now)).toBeUndefined();
  });

  it("maps a positive day count to now minus that many days in ms", () => {
    expect(daysToSinceMs(30, now)).toBe(now - 30 * 24 * 60 * 60 * 1000);
    expect(daysToSinceMs(1, now)).toBe(now - 24 * 60 * 60 * 1000);
  });

  it("treats a negative day count the same as 0 (unlimited)", () => {
    expect(daysToSinceMs(-5, now)).toBeUndefined();
  });
});
