// Unit tests for src/capabilities.ts — capability discovery (commands/skills/
// agents). Everything here is pure: filesystem access goes through the
// injected CapabilityFsLike (never real fs/vscode), env through a plain
// object (never process.env). See docs/plans/capability-surfacing-and-
// history-ux.md § Test strategy — cases marked [R] are regression tests for
// defects a prior review found; they are mandatory.
import { describe, it, expect } from "vitest";
import * as path from "node:path";
import {
  AcpCommandLike,
  CAPABILITY_DESCRIPTION_MAX_CHARS,
  CAPABILITY_GROUP_CAP,
  CAPABILITY_KIND_ORDER,
  CAPABILITY_ROOTS,
  CapabilityDirEntry,
  CapabilityFsLike,
  CapabilityItem,
  CapabilityRootSpec,
  GROK_BUILTIN_AGENTS,
  buildCapabilityGroups,
  capabilityFromSkillFile,
  dedupeByPriority,
  frontmatterBool,
  isPathContained,
  mergeAcpCommands,
  parseFrontmatter,
  scanCapabilityRoots,
} from "../src/capabilities";

// ---------------------------------------------------------------------------
// Fake CapabilityFsLike — mirrors buildFs (sessions.test.ts) / buildClaudeFs
// (session-store.test.ts): explicit dirs + files, ENOENT on anything else.
// `symlinks` maps a path to its (already-real) target — `realpathSync`
// resolves through it, and `readdirSync`'s Dirent `isDirectory()`/`isFile()`
// reflect the RESOLVED target's kind (a deliberately pessimistic simulation —
// real filesystems/Node typically report a symlink dirent as neither — so the
// symlink-containment tests below exercise the realpath check itself, not
// whatever the dirent pre-filter would have caught anyway).
// ---------------------------------------------------------------------------
interface CapFileEntry {
  content: string;
}

function buildCapFs(files: Record<string, CapFileEntry>, dirs: string[] = [], symlinks: Record<string, string> = {}): CapabilityFsLike {
  const dirSet = new Set(dirs);

  function resolve(p: string): string {
    let cur = p;
    for (let i = 0; i < 5 && symlinks[cur] !== undefined; i++) cur = symlinks[cur];
    return cur;
  }

  function listChildren(p: string): string[] {
    const prefix = p.endsWith(path.sep) || p.endsWith("/") ? p : p + path.sep;
    const altPrefix = p + (p.endsWith("/") ? "" : "/");
    const names = new Set<string>();
    const allKeys = [...Object.keys(files), ...dirs, ...Object.keys(symlinks)];
    for (const fp of allKeys) {
      if (fp.startsWith(prefix) || fp.startsWith(altPrefix)) {
        const rest = fp.startsWith(prefix) ? fp.slice(prefix.length) : fp.slice(altPrefix.length);
        const first = rest.split(/[\\/]/)[0];
        if (first) names.add(first);
      }
    }
    return Array.from(names);
  }

  function direntFor(childPath: string): CapabilityDirEntry {
    const real = resolve(childPath);
    return {
      name: path.basename(childPath),
      isDirectory: () => dirSet.has(real),
      isFile: () => files[real] !== undefined,
    };
  }

  return {
    existsSync: (p) => {
      const real = resolve(p);
      return files[real] !== undefined || dirSet.has(real);
    },
    readdirSync: (p) => {
      const children = listChildren(p);
      const real = resolve(p);
      if (!dirSet.has(real) && files[real] === undefined && children.length === 0) throw new Error(`ENOENT: ${p}`);
      return children.map((name) => direntFor(path.join(p, name)));
    },
    readHead: (p, length) => {
      const f = files[resolve(p)];
      if (!f) throw new Error(`ENOENT: ${p}`);
      return f.content.slice(0, length);
    },
    realpathSync: (p) => {
      const real = resolve(p);
      if (files[real] === undefined && !dirSet.has(real)) throw new Error(`ENOENT: ${p}`);
      return real;
    },
  };
}

const ws = path.join("/", "ws");
const home = path.join("/", "home", "user");

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

describe("parseFrontmatter", () => {
  it("parses plain key: value scalars", () => {
    const text = ["---", "name: adr", "description: Record an architecture decision", "---", "Body."].join("\n");
    expect(parseFrontmatter(text)).toEqual({ name: "adr", description: "Record an architecture decision" });
  });

  it("folds a `description: >` block scalar to one line", () => {
    const text = [
      "---",
      "name: plan",
      "description: >",
      "  Author a durable plan under docs/plans/",
      "  before implementation begins.",
      "---",
      "Body.",
    ].join("\n");
    expect(parseFrontmatter(text)).toEqual({
      name: "plan",
      description: "Author a durable plan under docs/plans/ before implementation begins.",
    });
  });

  it("keeps a colon inside a quoted value (split happens on the FIRST colon only)", () => {
    const text = ['---', 'argument-hint: "Pick one: A or B"', '---', "Body."].join("\n");
    expect(parseFrontmatter(text)).toEqual({ "argument-hint": "Pick one: A or B" });
  });

  it("[R] returns the raw STRING \"false\" for user-invocable: false, not a boolean", () => {
    const result = parseFrontmatter("user-invocable: false");
    expect(result["user-invocable"]).toBe("false");
    expect(typeof result["user-invocable"]).toBe("string");
  });

  it("an unterminated --- fence is treated as no frontmatter, never throws", () => {
    const text = ["---", "name: broken", "no closing fence here"].join("\n");
    expect(() => parseFrontmatter(text)).not.toThrow();
    expect(parseFrontmatter(text)).toEqual({});
  });

  it("malformed / non-kv lines are skipped, not thrown", () => {
    const text = ["---", "not a kv line at all", "name: ok", "---"].join("\n");
    expect(() => parseFrontmatter(text)).not.toThrow();
    expect(parseFrontmatter(text)).toEqual({ name: "ok" });
  });
});

describe("frontmatterBool", () => {
  it("[R] coerces the falsey vocabulary to false", () => {
    expect(frontmatterBool("false", true)).toBe(false);
    expect(frontmatterBool("no", true)).toBe(false);
    expect(frontmatterBool("0", true)).toBe(false);
    expect(frontmatterBool("off", true)).toBe(false);
    expect(frontmatterBool("FALSE", true)).toBe(false);
    expect(frontmatterBool("  false  ", true)).toBe(false);
  });

  it("[R] coerces the truthy vocabulary to true", () => {
    expect(frontmatterBool("true", false)).toBe(true);
    expect(frontmatterBool("yes", false)).toBe(true);
    expect(frontmatterBool("1", false)).toBe(true);
    expect(frontmatterBool("on", false)).toBe(true);
  });

  it("[R] undefined falls back to the default", () => {
    expect(frontmatterBool(undefined, true)).toBe(true);
    expect(frontmatterBool(undefined, false)).toBe(false);
  });

  it("[R] an unrecognized value falls back to the default", () => {
    expect(frontmatterBool("weird", true)).toBe(true);
    expect(frontmatterBool("weird", false)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Item construction — every case feeds raw file text, never a hand-authored
// frontmatter object, so a fixture/parser divergence is structurally impossible.
// ---------------------------------------------------------------------------

describe("capabilityFromSkillFile", () => {
  const skillDirPath = path.join(ws, ".grok", "skills", "code-review", "SKILL.md");
  const flatMdPath = path.join(ws, ".grok", "commands", "review.md");

  it("user-invocable absent ⇒ invocable", () => {
    const text = ["---", "name: code-review", "description: Run a strict review", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.invoke).toBe("/code-review ");
    expect(item.path).toBe(skillDirPath);
    expect(item.origin).toBe("disk");
  });

  it("[R] raw text with user-invocable: false ⇒ no invoke, still listed, still has a path", () => {
    const text = ["---", "name: code-review", "description: Model-only", "user-invocable: false", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.invoke).toBeUndefined();
    expect(item.path).toBe(skillDirPath);
    expect(item.name).toBe("code-review");
  });

  it("disable-model-invocation: true does not affect invocability (it restricts the MODEL)", () => {
    const text = ["---", "name: imagine", "description: Generate an image", "disable-model-invocation: true", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.invoke).toBe("/imagine ");
  });

  it("an agent file is never invocable regardless of frontmatter", () => {
    const text = ["---", "name: code-reviewer", "description: Reviews code", "user-invocable: true", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "agent", rawText: text, filePath: flatMdPath, layout: "flat-md", source: "Project (.claude)" });
    expect(item.invoke).toBeUndefined();
    expect(item.kind).toBe("agent");
  });

  it("no frontmatter at all ⇒ name from the file stem, description from the first non-heading paragraph", () => {
    const text = ["# Review", "", "Runs an extremely strict maintainability review of the diff.", "", "More detail here."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: flatMdPath, layout: "flat-md", source: "Project (.grok)" });
    expect(item.name).toBe("review");
    expect(item.description).toBe("Runs an extremely strict maintainability review of the diff.");
  });

  it("no frontmatter, skill-dir layout ⇒ name from the parent directory", () => {
    const text = "Just a body, no frontmatter fence.";
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.name).toBe("code-review");
  });

  it("a long description is truncated with a trailing ellipsis", () => {
    const long = "x".repeat(500);
    const text = ["---", "name: verbose", `description: ${long}`, "---"].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.description.length).toBeLessThan(long.length);
    expect(item.description.endsWith("…")).toBe(true);
    // Host cap must leave room for the webview's 260-char sentence-aware trim.
    expect(CAPABILITY_DESCRIPTION_MAX_CHARS).toBe(280);
    expect(item.description.length).toBeLessThanOrEqual(CAPABILITY_DESCRIPTION_MAX_CHARS);
  });

  it("an unterminated fence is treated as no frontmatter, never throws", () => {
    const text = ["---", "name: broken", "Some prose that never closes the fence."].join("\n");
    expect(() => capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" })).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // [R] frontmatter `name` is arbitrary attacker-controlled text (a workspace-
  // tier skill file is fully attacker-authored via a checked-in repo) with no
  // charset/length limit of its own — validated before it becomes part of an
  // invocable slash command or an unbounded display string.
  // -------------------------------------------------------------------------

  it("[R] an invalid frontmatter name (bad charset) falls back to the path-derived name for BOTH invoke and display", () => {
    const text = ["---", "name: code review; rm -rf /", "description: Looks helpful", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.name).toBe("code-review"); // the safe, path-derived fallback
    expect(item.invoke).toBe("/code-review ");
    expect(item.path).toBe(skillDirPath);
  });

  it("[R] a frontmatter name over the length limit falls back to the path-derived name", () => {
    const text = ["---", `name: ${"a".repeat(200)}`, "description: Too long", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.name).toBe("code-review");
    expect(item.invoke).toBe("/code-review ");
  });

  it("[R] when even the path-derived name is unsafe, the item is listed but marked non-invocable, with its display name capped", () => {
    const weirdPath = path.join(ws, ".grok", "skills", "bad name!!! ".repeat(10), "SKILL.md");
    const text = ["---", "description: No usable name anywhere", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: weirdPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.invoke).toBeUndefined();
    expect(item.path).toBe(weirdPath);
    expect(item.name.length).toBeLessThanOrEqual(64);
  });

  it("a valid frontmatter name is used as-is (regression guard against over-eager fallback)", () => {
    const text = ["---", "name: code-review", "description: Fine", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.name).toBe("code-review");
    expect(item.invoke).toBe("/code-review ");
  });

  // -------------------------------------------------------------------------
  // argument-hint (docs/plans/session-tab-ux-overhaul.md § Approach B bullet
  // 3) — always from raw file text, never a hand-built frontmatter object.
  // -------------------------------------------------------------------------

  it("argument-hint present in frontmatter ⇒ item.hint set", () => {
    const text = ["---", "name: adr", 'argument-hint: "[short decision title]"', "description: Record an ADR", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.hint).toBe("[short decision title]");
  });

  it("argument-hint absent ⇒ item.hint is undefined, never an empty string", () => {
    const text = ["---", "name: adr", "description: Record an ADR", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.hint).toBeUndefined();
  });

  it("a whitespace-only argument-hint is treated as absent", () => {
    const text = ["---", "name: adr", "argument-hint:    ", "description: Record an ADR", "---", "Body."].join("\n");
    const item = capabilityFromSkillFile({ kind: "skill", rawText: text, filePath: skillDirPath, layout: "skill-dir", source: "Project (.grok)" });
    expect(item.hint).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Roots and precedence
// ---------------------------------------------------------------------------

describe("CAPABILITY_ROOTS", () => {
  it("[R] grok has no agent-kind root under .claude/.cursor — agents are .grok-only", () => {
    const grokAgentRoots = CAPABILITY_ROOTS.grok.filter((r) => r.kind === "agent");
    expect(grokAgentRoots.length).toBeGreaterThan(0);
    for (const root of grokAgentRoots) {
      expect(root.dir.startsWith(".grok")).toBe(true);
      expect(root.base === "workspace" || root.base === "home").toBe(true);
    }
  });

  it("grok DOES have skill-kind .claude/.cursor roots", () => {
    const grokSkillRoots = CAPABILITY_ROOTS.grok.filter((r) => r.kind === "skill");
    expect(grokSkillRoots.some((r) => r.dir.startsWith(".claude"))).toBe(true);
    expect(grokSkillRoots.some((r) => r.dir.startsWith(".cursor"))).toBe(true);
  });

  it("claude has no .grok/.cursor root of any kind", () => {
    for (const root of CAPABILITY_ROOTS.claude) {
      expect(root.dir.startsWith(".grok")).toBe(false);
      expect(root.dir.startsWith(".cursor")).toBe(false);
    }
  });
});

describe("scanCapabilityRoots", () => {
  const skillRoot: CapabilityRootSpec = { kind: "skill", base: "workspace", dir: ".grok/skills", layout: "skill-dir", source: "Project (.grok)" };
  const commandsRoot: CapabilityRootSpec = { kind: "skill", base: "workspace", dir: ".grok/commands", layout: "flat-md", source: "Project (.grok)" };

  function skillMd(name: string, dirBase = ws): { path: string; content: string } {
    return {
      path: path.join(dirBase, ".grok", "skills", name, "SKILL.md"),
      content: `---\nname: ${name}\ndescription: The ${name} skill\n---\nBody.`,
    };
  }

  it("layout respected: skill-dir reads <dir>/<name>/SKILL.md", () => {
    const a = skillMd("code-review");
    const fs = buildCapFs(
      { [a.path]: { content: a.content } },
      [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"), path.join(ws, ".grok", "skills", "code-review")],
    );
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    const item = result.items.find((i) => i.name === "code-review");
    expect(item?.path).toBe(a.path);
  });

  it("layout respected: flat-md reads <dir>/*.md", () => {
    const filePath = path.join(ws, ".grok", "commands", "review.md");
    const fs = buildCapFs(
      { [filePath]: { content: "---\nname: review\ndescription: Review command\n---\nBody." } },
      [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "commands")],
    );
    const result = scanCapabilityRoots({ fs, roots: [commandsRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    const item = result.items.find((i) => i.name === "review");
    expect(item?.path).toBe(filePath);
  });

  it("disabledByEnv honored: a falsey env value removes the root; unset scans it", () => {
    const claudeRoot: CapabilityRootSpec = {
      kind: "skill", base: "workspace", dir: ".claude/skills", layout: "skill-dir", source: "Project (.claude)", disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED",
    };
    const filePath = path.join(ws, ".claude", "skills", "adr", "SKILL.md");
    const dirs = [ws, path.join(ws, ".claude"), path.join(ws, ".claude", "skills"), path.join(ws, ".claude", "skills", "adr")];
    const fs = buildCapFs({ [filePath]: { content: "---\nname: adr\ndescription: ADR skill\n---\nBody." } }, dirs);

    // backend: "claude" here so GROK_BUILTIN_AGENTS contributes nothing —
    // isolates the assertion to what the scan itself found.
    const disabled = scanCapabilityRoots({ fs, roots: [claudeRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: { GROK_CLAUDE_SKILLS_ENABLED: "false" } });
    expect(disabled.items).toEqual([]);
    expect(disabled.scannedRoots).toBe(0);

    const enabled = scanCapabilityRoots({ fs, roots: [claudeRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {} });
    expect(enabled.items.some((i) => i.name === "adr")).toBe(true);
  });

  it("dedupeByPriority: same name in project and home ⇒ one item, project wins", () => {
    const projectFile = skillMd("plan", ws);
    const homeFile = skillMd("plan", home);
    const homeRoot: CapabilityRootSpec = { kind: "skill", base: "home", dir: ".grok/skills", layout: "skill-dir", source: "User (~/.grok)" };
    const fs = buildCapFs(
      {
        [projectFile.path]: { content: `---\nname: plan\ndescription: Project plan skill\n---\nBody.` },
        [homeFile.path]: { content: `---\nname: plan\ndescription: Home plan skill\n---\nBody.` },
      },
      [
        ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"), path.join(ws, ".grok", "skills", "plan"),
        home, path.join(home, ".grok"), path.join(home, ".grok", "skills"), path.join(home, ".grok", "skills", "plan"),
      ],
    );
    const result = scanCapabilityRoots({ fs, roots: [skillRoot, homeRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    const planItems = result.items.filter((i) => i.kind === "skill" && i.name === "plan");
    expect(planItems).toHaveLength(1);
    expect(planItems[0].source).toBe("Project (.grok)");
  });

  it("a skill and an agent sharing a name both survive (dedupe key is kind|name)", () => {
    const skillFile = skillMd("plan", ws);
    const agentPath = path.join(ws, ".grok", "agents", "plan.md");
    const agentRoot: CapabilityRootSpec = { kind: "agent", base: "workspace", dir: ".grok/agents", layout: "flat-md", source: "Project (.grok)" };
    const fs = buildCapFs(
      {
        [skillFile.path]: { content: "---\nname: plan\ndescription: Plan skill\n---\nBody." },
        [agentPath]: { content: "---\nname: plan\ndescription: Plan agent\n---\nBody." },
      },
      [
        ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"), path.join(ws, ".grok", "skills", "plan"),
        path.join(ws, ".grok", "agents"),
      ],
    );
    const result = scanCapabilityRoots({ fs, roots: [skillRoot, agentRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items.filter((i) => i.name === "plan")).toHaveLength(2);
    expect(result.items.some((i) => i.kind === "skill" && i.name === "plan")).toBe(true);
    expect(result.items.some((i) => i.kind === "agent" && i.name === "plan")).toBe(true);
  });

  it("a missing root (readdirSync throws ENOENT) is skipped silently, later roots still scan", () => {
    const homeSkillRoot: CapabilityRootSpec = { kind: "skill", base: "home", dir: ".claude/skills", layout: "skill-dir", source: "User (~/.claude)" };
    // No entries at all under `home` — the real "no ~/.claude on this machine" case.
    const projectFile = skillMd("help", ws);
    const fs = buildCapFs(
      { [projectFile.path]: { content: "---\nname: help\ndescription: Help skill\n---\nBody." } },
      [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"), path.join(ws, ".grok", "skills", "help")],
    );
    const result = scanCapabilityRoots({ fs, roots: [homeSkillRoot, skillRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items.some((i) => i.name === "help")).toBe(true);
  });

  it("a file that throws on read is skipped; the scan completes", () => {
    const a = skillMd("code-review", ws);
    const b = skillMd("help", ws);
    const base = buildCapFs(
      { [a.path]: { content: a.content }, [b.path]: { content: b.content } },
      [
        ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"),
        path.join(ws, ".grok", "skills", "code-review"), path.join(ws, ".grok", "skills", "help"),
      ],
    );
    const fs: CapabilityFsLike = {
      ...base,
      readHead: (p, len) => {
        if (p === a.path) throw new Error("EACCES");
        return base.readHead(p, len);
      },
    };
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "grok", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items.some((i) => i.name === "help")).toBe(true);
    expect(result.items.some((i) => i.name === "code-review")).toBe(false);
  });

  it("CAPABILITY_SCAN_FILE_CAP (injected fileCap) respected ⇒ truncated: true", () => {
    const files: Record<string, CapFileEntry> = {};
    const dirs = [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills")];
    for (let i = 0; i < 5; i++) {
      const p = path.join(ws, ".grok", "skills", `skill-${i}`, "SKILL.md");
      files[p] = { content: `---\nname: skill-${i}\ndescription: d\n---\n` };
      dirs.push(path.join(ws, ".grok", "skills", `skill-${i}`));
    }
    const fs = buildCapFs(files, dirs);
    // backend: "claude" — isolates the count to what the scan itself produced,
    // since GROK_BUILTIN_AGENTS would otherwise add 3 unrelated agent items.
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {}, fileCap: 2 });
    expect(result.truncated).toBe(true);
    expect(result.items.length).toBeLessThanOrEqual(2);
  });

  it("no roots enabled / nothing found ⇒ empty items, no error", () => {
    const fs = buildCapFs({}, []);
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items).toEqual([]);
    expect(result.truncated).toBe(false);
  });

  // -------------------------------------------------------------------------
  // [R] Symlink escape (security). A checked-in repo can commit a capability
  // root, or a single entry inside one, AS A SYMLINK with an absolute target
  // outside the workspace/home boundary — e.g. `.grok/agents/notes.md` pointing
  // at `~/.ssh/id_rsa`. The fake fs's dirent type follows the RESOLVED target
  // (a deliberately pessimistic simulation of what a real filesystem/Node might
  // report), so these tests exercise the realpath containment check itself —
  // not whatever the isFile()/isDirectory() pre-filter would have caught anyway.
  // -------------------------------------------------------------------------

  it("[R] a symlinked flat-md entry resolving outside its root is rejected, even when its dirent reports as a plain file", () => {
    const secretPath = path.join(home, ".ssh", "id_rsa");
    const linkPath = path.join(ws, ".grok", "agents", "notes.md");
    const agentRoot: CapabilityRootSpec = { kind: "agent", base: "workspace", dir: ".grok/agents", layout: "flat-md", source: "Project (.grok)" };
    const fs = buildCapFs(
      { [secretPath]: { content: "-----BEGIN PRIVATE KEY-----" } },
      [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "agents")],
      { [linkPath]: secretPath },
    );
    const result = scanCapabilityRoots({ fs, roots: [agentRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items).toEqual([]);
  });

  it("[R] a symlinked skill-dir SKILL.md resolving outside its root is rejected", () => {
    const secretPath = path.join(home, ".ssh", "id_rsa");
    const skillDir = path.join(ws, ".grok", "skills", "innocuous");
    const linkPath = path.join(skillDir, "SKILL.md");
    const fs = buildCapFs(
      { [secretPath]: { content: "-----BEGIN PRIVATE KEY-----" } },
      [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills"), skillDir],
      { [linkPath]: secretPath },
    );
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items).toEqual([]);
  });

  it("[R] a root directory that is ITSELF a symlink escaping its base is skipped entirely, not just its entries", () => {
    const outsideDir = path.join("/", "etc");
    const secretPath = path.join(outsideDir, "shadow.md");
    const rootPath = path.join(ws, ".grok", "agents");
    const agentRoot: CapabilityRootSpec = { kind: "agent", base: "workspace", dir: ".grok/agents", layout: "flat-md", source: "Project (.grok)" };
    const fs = buildCapFs(
      { [secretPath]: { content: "---\nname: shadow\n---\n" } },
      [ws, path.join(ws, ".grok"), outsideDir],
      { [rootPath]: outsideDir },
    );
    const result = scanCapabilityRoots({ fs, roots: [agentRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {} });
    expect(result.items).toEqual([]);
    expect(result.scannedRoots).toBe(0);
  });

  it("isPathContained: identity and proper descendants are contained; a sibling or ancestor is not", () => {
    const root = path.join(ws, ".grok", "skills");
    expect(isPathContained(root, root)).toBe(true);
    expect(isPathContained(root, path.join(root, "plan", "SKILL.md"))).toBe(true);
    expect(isPathContained(root, ws)).toBe(false); // ancestor
    expect(isPathContained(root, path.join(ws, ".grok", "agents"))).toBe(false); // sibling
    expect(isPathContained(root, path.join("/", "etc", "shadow.md"))).toBe(false); // unrelated
  });

  // -------------------------------------------------------------------------
  // [R] Bounded directory work (DoS). A huge directory previously cost a
  // statSync + existsSync pair per entry with no ceiling at all — the entry
  // cap is checked BEFORE any per-entry syscall.
  // -------------------------------------------------------------------------

  it("[R] CAPABILITY_ROOT_ENTRY_CAP (injected entryCap) stops examining further entries in a root ⇒ truncated: true", () => {
    const files: Record<string, CapFileEntry> = {};
    const dirs = [ws, path.join(ws, ".grok"), path.join(ws, ".grok", "skills")];
    for (let i = 0; i < 5; i++) {
      const skillDir = path.join(ws, ".grok", "skills", `skill-${i}`);
      files[path.join(skillDir, "SKILL.md")] = { content: `---\nname: skill-${i}\n---\n` };
      dirs.push(skillDir);
    }
    const fs = buildCapFs(files, dirs);
    const result = scanCapabilityRoots({ fs, roots: [skillRoot], backend: "claude", workspaceDir: ws, homeDir: home, env: {}, entryCap: 2 });
    expect(result.truncated).toBe(true);
    expect(result.items.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// GROK_BUILTIN_AGENTS
// ---------------------------------------------------------------------------

describe("GROK_BUILTIN_AGENTS", () => {
  it("present for grok, absent for claude", () => {
    expect(GROK_BUILTIN_AGENTS("grok").length).toBeGreaterThan(0);
    expect(GROK_BUILTIN_AGENTS("claude")).toEqual([]);
  });

  it("[R] each built-in has no path and no invoke", () => {
    for (const item of GROK_BUILTIN_AGENTS("grok")) {
      expect(item.path).toBeUndefined();
      expect(item.invoke).toBeUndefined();
      expect(item.kind).toBe("agent");
    }
  });

  it("returns fresh objects on every call", () => {
    const a = GROK_BUILTIN_AGENTS("grok");
    const b = GROK_BUILTIN_AGENTS("grok");
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    expect(a).toEqual(b);
  });
});

describe("dedupeByPriority", () => {
  it("keeps the first occurrence of a kind|name key", () => {
    const items: CapabilityItem[] = [
      { kind: "skill", name: "plan", description: "project", source: "Project (.grok)", origin: "disk", path: "/ws/plan/SKILL.md" },
      { kind: "skill", name: "plan", description: "home", source: "User (~/.grok)", origin: "disk", path: "/home/plan/SKILL.md" },
    ];
    const out = dedupeByPriority(items);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("Project (.grok)");
  });

  it("a skill and an agent sharing a name both survive", () => {
    const items: CapabilityItem[] = [
      { kind: "skill", name: "plan", description: "", source: "Project (.grok)", origin: "disk" },
      { kind: "agent", name: "plan", description: "", source: "Built in", origin: "acp" },
    ];
    expect(dedupeByPriority(items)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Merge and grouping
// ---------------------------------------------------------------------------

describe("mergeAcpCommands", () => {
  const diskSkill = (overrides: Partial<CapabilityItem> = {}): CapabilityItem => ({
    kind: "skill",
    name: "plan",
    description: "",
    source: "Project (.grok)",
    origin: "disk",
    path: "/ws/.grok/skills/plan/SKILL.md",
    ...overrides,
  });

  it("[R] a disk skill matching an ACP command yields exactly one row (skill, disk, path retained, invoke set)", () => {
    const disk = diskSkill({ description: "Author a plan" });
    const acp: AcpCommandLike[] = [{ name: "plan", description: "ACP plan description" }];
    const out = mergeAcpCommands([disk], acp);
    const planRows = out.filter((i) => i.name === "plan");
    expect(planRows).toHaveLength(1);
    expect(planRows[0].kind).toBe("skill");
    expect(planRows[0].origin).toBe("disk");
    expect(planRows[0].path).toBe(disk.path);
    expect(planRows[0].invoke).toBe("/plan ");
    expect(out.some((i) => i.kind === "command" && i.name === "plan")).toBe(false);
  });

  it("[R] description stability: non-empty disk description wins over a different ACP description", () => {
    const disk = diskSkill({ description: "Author a durable plan" });
    const acp: AcpCommandLike[] = [{ name: "plan", description: "A totally different ACP description" }];
    const out = mergeAcpCommands([disk], acp);
    expect(out.find((i) => i.name === "plan")?.description).toBe("Author a durable plan");
  });

  it("[R] an empty disk description is filled from the ACP command", () => {
    const disk = diskSkill({ description: "" });
    const acp: AcpCommandLike[] = [{ name: "plan", description: "ACP-supplied description" }];
    const out = mergeAcpCommands([disk], acp);
    expect(out.find((i) => i.name === "plan")?.description).toBe("ACP-supplied description");
  });

  it("an ACP command with no disk match ⇒ kind: command, origin: acp, no path", () => {
    const out = mergeAcpCommands([], [{ name: "compact", description: "Compact the conversation" }]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "command", name: "compact", origin: "acp" });
    expect(out[0].path).toBeUndefined();
    expect(out[0].invoke).toBe("/compact ");
  });

  it("a disk skill with no ACP match keeps its own invoke/path untouched", () => {
    const disk = diskSkill({ invoke: "/plan ", description: "Own description" });
    const out = mergeAcpCommands([disk], []);
    expect(out).toEqual([disk]);
  });

  // -------------------------------------------------------------------------
  // hint precedence — the same disk-wins-when-non-empty rule as description,
  // so an argument-hint row never rewrites itself moments after it renders
  // (docs/plans/session-tab-ux-overhaul.md § Approach B bullet 3).
  // -------------------------------------------------------------------------

  it("[R] hint stability: a non-empty disk hint keeps it when the ACP command supplies a different one", () => {
    const disk = diskSkill({ hint: "[short decision title]" });
    const acp: AcpCommandLike[] = [{ name: "plan", input: { hint: "a totally different hint" } }];
    const out = mergeAcpCommands([disk], acp);
    expect(out.find((i) => i.name === "plan")?.hint).toBe("[short decision title]");
  });

  it("[R] an empty/absent disk hint is filled from the ACP command's input.hint", () => {
    const disk = diskSkill({ hint: undefined });
    const acp: AcpCommandLike[] = [{ name: "plan", input: { hint: "ACP-supplied hint" } }];
    const out = mergeAcpCommands([disk], acp);
    expect(out.find((i) => i.name === "plan")?.hint).toBe("ACP-supplied hint");
  });

  it("[R] an ACP command with no disk match carries its own hint onto the kind: command row", () => {
    const out = mergeAcpCommands([], [{ name: "compact", input: { hint: "[optional note]" } }]);
    expect(out[0].hint).toBe("[optional note]");
  });

  it("an ACP command with no input at all does not throw and yields no hint", () => {
    expect(() => mergeAcpCommands([], [{ name: "compact" }])).not.toThrow();
    const out = mergeAcpCommands([], [{ name: "compact" }]);
    expect(out[0].hint).toBeUndefined();
  });

  it("a disk skill with no hint and an ACP command with a blank input.hint stays without a hint", () => {
    const disk = diskSkill({ hint: undefined });
    const acp: AcpCommandLike[] = [{ name: "plan", input: { hint: "   " } }];
    const out = mergeAcpCommands([disk], acp);
    expect(out.find((i) => i.name === "plan")?.hint).toBeUndefined();
  });
});

describe("buildCapabilityGroups", () => {
  const diskSkill: CapabilityItem = {
    kind: "skill", name: "plan", description: "Author a plan", source: "Project (.grok)", origin: "disk", path: "/ws/.grok/skills/plan/SKILL.md", invoke: "/plan ",
  };
  const diskAgent: CapabilityItem = {
    kind: "agent", name: "code-reviewer", description: "Reviews code", source: "Project (.claude)", origin: "disk", path: "/ws/.claude/agents/code-reviewer.md",
  };

  it("[R] the same disk items yield the SAME Skills group across an empty-then-populated ACP list", () => {
    const before = buildCapabilityGroups([diskSkill, diskAgent], []);
    const after = buildCapabilityGroups([diskSkill, diskAgent], [{ name: "plan", description: "ACP description" }]);
    const skillsBefore = before.find((g) => g.kind === "skill");
    const skillsAfter = after.find((g) => g.kind === "skill");
    expect(skillsBefore?.items.map((i) => i.name)).toEqual(skillsAfter?.items.map((i) => i.name));
    expect(skillsBefore?.total).toBe(skillsAfter?.total);
    // Enrichment only ever FILLS a previously-empty field — the disk description
    // was already non-empty here, so it must not change.
    expect(skillsAfter?.items[0].description).toBe("Author a plan");
  });

  it("zero discoveries anywhere ⇒ groups: []", () => {
    expect(buildCapabilityGroups([], [])).toEqual([]);
  });

  // [R] The bundled Grokbit suite leads: it is the only group present and
  // identical on every backend, so it is what the menu is taught around
  // (docs/plans/grokbit-actions-and-bundled-skill-suite.md § D1). The user's
  // own skills follow; the CLI's own command plumbing stays last.
  it("[R] CAPABILITY_KIND_ORDER leads with the Grokbit suite, ends with the CLI's own command plumbing", () => {
    expect(CAPABILITY_KIND_ORDER).toEqual(["grokbit", "skill", "agent", "command"]);
  });

  it("[R] groups are ordered by CAPABILITY_KIND_ORDER (Grokbit suite leads, commands last), empty kinds omitted", () => {
    const suite: CapabilityItem = {
      kind: "grokbit", name: "grokbit-plan", description: "", source: "Grokbit", origin: "disk", invoke: "/grokbit-plan ",
    };
    const groups = buildCapabilityGroups([diskSkill, diskAgent, suite], [{ name: "compact" }]);
    // no "command" row would exist without the unmatched acp command above
    expect(groups.map((g) => g.kind)).toEqual(["grokbit", "skill", "agent", "command"]);
  });

  it("[R] no suite installed ⇒ no Grokbit group at all, never an empty placeholder", () => {
    const groups = buildCapabilityGroups([diskSkill], []);
    expect(groups.map((g) => g.kind)).toEqual(["skill"]);
  });

  it("a group's items are capped, but total reports the true pre-cap count", () => {
    const many: CapabilityItem[] = Array.from({ length: 5 }, (_, i) => ({
      kind: "skill", name: `s${i}`, description: "", source: "Project (.grok)", origin: "disk", invoke: `/s${i} `,
    }));
    const groups = buildCapabilityGroups(many, [], 2);
    const skills = groups.find((g) => g.kind === "skill");
    expect(skills?.items).toHaveLength(2);
    expect(skills?.total).toBe(5);
  });

  it("the default cap is CAPABILITY_GROUP_CAP — asserted against the export, never a literal", () => {
    // `+N more` is a dead end (no "show the rest" affordance on either mount),
    // so the cap decides how much of the user's OWN skills directory they can
    // ever see. Pinning it to the constant keeps that one number the source of
    // truth if it is ever retuned again.
    const many: CapabilityItem[] = Array.from({ length: CAPABILITY_GROUP_CAP + 3 }, (_, i) => ({
      kind: "skill", name: `s${i}`, description: "", source: "Project (.grok)", origin: "disk", invoke: `/s${i} `,
    }));
    const skills = buildCapabilityGroups(many, []).find((g) => g.kind === "skill");
    expect(skills?.items).toHaveLength(CAPABILITY_GROUP_CAP);
    expect(skills?.total).toBe(CAPABILITY_GROUP_CAP + 3);
  });
});
