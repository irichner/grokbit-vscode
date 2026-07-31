/**
 * Capability discovery — what the selected backend CLI can actually do: slash
 * commands, skills (incl. model-only ones the slash menu hides), and
 * subagents/agents. Pure: no `vscode`, no top-level `node:fs` — filesystem
 * access is injected via {@link CapabilityFsLike} (mirroring `sessions.ts`'s
 * `FsLike` and `session-store.ts`'s `ClaudeFsLike`), env via a plain object.
 * Only the thin glue in `sidebar.ts` touches real `fs`/`process.env`.
 *
 * The root list is grok's own documented search path
 * (`~/.grok/docs/user-guide/08-skills.md` § Skill Locations) plus its
 * subagent-file convention (`16-subagents.md`) — the two docs disagree on
 * scope: `08-skills.md` extends the *skills/commands* search into
 * `.claude`/`.cursor` for vendor compatibility, but `16-subagents.md` does
 * **not** — grok resolves agent definitions from `.grok/agents` only. So
 * {@link CAPABILITY_ROOTS} is keyed per **kind**, not just per backend: grok's
 * `agent` roots are `.grok`-only by design (see docs/plans/
 * capability-surfacing-and-history-ux.md § Root spec) — a flat per-backend
 * root list would wrongly list this repo's `.claude/agents/*.md` files as
 * grok subagents grok cannot actually resolve.
 */
import * as path from "node:path";
import { BackendId } from "./backends";

// ---------------------------------------------------------------------------
// Wire contract (frozen — see docs/plans/capability-surfacing-and-history-ux.md
// § Message contract). WP2 renders these; do not change shape without updating
// that plan's contract section.
// ---------------------------------------------------------------------------

/** No `"workflow"` member — workflows are deferred (Decision 1). Do not add one
 *  speculatively; see the plan's § Non-goals.
 *
 *  `"grokbit"` is the bundled suite (see `skill-suite.ts`). It is NOT produced
 *  by any {@link CapabilityRootSpec} — the suite is provisioned into the same
 *  home-tier skills directory the ordinary `skill` roots already scan, so its
 *  items arrive as `skill` and are re-keyed afterwards by `applySuiteKind`.
 *  That ordering is load-bearing; see the note on {@link dedupeByPriority}. */
export type CapabilityKind = "command" | "skill" | "agent" | "grokbit";

export interface CapabilityItem {
  kind: CapabilityKind;
  name: string;
  /** "" when unknown. */
  description: string;
  /** `"/name "` — present iff user-invocable. */
  invoke?: string;
  /** Absolute source file path. Absent for ACP builtins and {@link GROK_BUILTIN_AGENTS}. */
  path?: string;
  /** Display label, e.g. "Project (.grok)" | "User (~/.claude)" | "Built in". */
  source: string;
  origin: "acp" | "disk";
  /** Frontmatter `argument-hint` (disk) or the ACP command's `input.hint`
   *  (`SlashCommand.input.hint`, `src/acp.ts`) — e.g. `[short decision title]`.
   *  Absent, never "", when unknown; {@link mergeAcpCommands} fills it under
   *  the same disk-wins-when-non-empty rule as `description`. Truncated for
   *  display in the webview's pure view-model (`capabilityGroupsView`,
   *  `media/webview-helpers.js`), not here. */
  hint?: string;
}

export interface CapabilityGroup {
  kind: CapabilityKind;
  title: string;
  /** Capped at {@link CAPABILITY_GROUP_CAP}. */
  items: CapabilityItem[];
  /** Pre-cap count — drives the webview's "+N more". */
  total: number;
}

/** `CapabilityGroup[]` is an array the producer builds and the consumer
 *  iterates — never a fixed-arity tuple or `groups.skills`-shaped object, so a
 *  later kind (should workflows ever stop being deferred) is one entry in
 *  {@link CAPABILITY_KIND_ORDER}/{@link CAPABILITY_KIND_LABELS} plus a
 *  discovery source, not a renderer rewrite.
 *
 *  The bundled Grokbit suite leads — it is the one group that is present and
 *  identical on every backend, so it is what the menu can actually be taught
 *  and documented around. The user's own discovered skills follow; `command`
 *  (the CLI's own plumbing: `/new`, `/compact`, `/resume`, …) goes last, see
 *  docs/plans/session-tab-ux-overhaul.md § Approach B and
 *  docs/plans/grokbit-actions-and-bundled-skill-suite.md § D1. */
export const CAPABILITY_KIND_ORDER: readonly CapabilityKind[] = ["grokbit", "skill", "agent", "command"];

export const CAPABILITY_KIND_LABELS: Record<CapabilityKind, string> = {
  command: "Commands",
  skill: "Skills",
  agent: "Agents",
  grokbit: "Grokbit workflow",
};

// ---------------------------------------------------------------------------
// Root spec
// ---------------------------------------------------------------------------

/** `<dir>/<name>/SKILL.md` (a directory per skill) vs `<dir>/*.md` (one file per item). */
export type RootLayout = "skill-dir" | "flat-md";

export interface CapabilityRootSpec {
  /** Never `"command"` — commands are ACP-only, see {@link mergeAcpCommands}. */
  kind: "skill" | "agent";
  base: "workspace" | "home";
  /** Relative to `base`, e.g. `.grok/skills`. */
  dir: string;
  layout: RootLayout;
  source: string;
  /** Falsey value of this env var removes the root (grok's vendor
   *  skill-dir compat opt-out, e.g. `GROK_CLAUDE_SKILLS_ENABLED`). Only the
   *  env-var opt-out form is honored — grok's `config.toml` `[compat.claude]
   *  skills = false` form needs a TOML parser this extension doesn't have and
   *  doesn't want to add speculatively (see the plan's § Non-goals). */
  disabledByEnv?: string;
}

/** Ordered, highest priority first — see {@link dedupeByPriority}. */
export const CAPABILITY_ROOTS: Record<BackendId, CapabilityRootSpec[]> = {
  grok: [
    // workspace — skills (incl. the vendor-compat .claude/.cursor dirs grok also reads)
    { kind: "skill", base: "workspace", dir: ".grok/skills", layout: "skill-dir", source: "Project (.grok)" },
    { kind: "skill", base: "workspace", dir: ".grok/commands", layout: "flat-md", source: "Project (.grok)" },
    { kind: "skill", base: "workspace", dir: ".agents/skills", layout: "skill-dir", source: "Project (.agents)" },
    { kind: "skill", base: "workspace", dir: ".agents/commands", layout: "flat-md", source: "Project (.agents)" },
    { kind: "skill", base: "workspace", dir: ".claude/skills", layout: "skill-dir", source: "Project (.claude)", disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED" },
    { kind: "skill", base: "workspace", dir: ".claude/commands", layout: "flat-md", source: "Project (.claude)", disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED" },
    { kind: "skill", base: "workspace", dir: ".cursor/skills", layout: "skill-dir", source: "Project (.cursor)", disabledByEnv: "GROK_CURSOR_SKILLS_ENABLED" },
    // home — same set, rooted at the user's home dir instead of the workspace
    { kind: "skill", base: "home", dir: ".grok/skills", layout: "skill-dir", source: "User (~/.grok)" },
    { kind: "skill", base: "home", dir: ".grok/commands", layout: "flat-md", source: "User (~/.grok)" },
    { kind: "skill", base: "home", dir: ".agents/skills", layout: "skill-dir", source: "User (~/.agents)" },
    { kind: "skill", base: "home", dir: ".agents/commands", layout: "flat-md", source: "User (~/.agents)" },
    { kind: "skill", base: "home", dir: ".claude/skills", layout: "skill-dir", source: "User (~/.claude)", disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED" },
    { kind: "skill", base: "home", dir: ".claude/commands", layout: "flat-md", source: "User (~/.claude)", disabledByEnv: "GROK_CLAUDE_SKILLS_ENABLED" },
    { kind: "skill", base: "home", dir: ".cursor/skills", layout: "skill-dir", source: "User (~/.cursor)", disabledByEnv: "GROK_CURSOR_SKILLS_ENABLED" },
    // agents — `.grok`-only by design (16-subagents.md has no .claude/.cursor
    // equivalent for grok — see the module doc comment above).
    { kind: "agent", base: "workspace", dir: ".grok/agents", layout: "flat-md", source: "Project (.grok)" },
    { kind: "agent", base: "home", dir: ".grok/agents", layout: "flat-md", source: "User (~/.grok)" },
  ],
  claude: [
    { kind: "skill", base: "workspace", dir: ".claude/skills", layout: "skill-dir", source: "Project (.claude)" },
    { kind: "skill", base: "workspace", dir: ".claude/commands", layout: "flat-md", source: "Project (.claude)" },
    { kind: "skill", base: "home", dir: ".claude/skills", layout: "skill-dir", source: "User (~/.claude)" },
    { kind: "skill", base: "home", dir: ".claude/commands", layout: "flat-md", source: "User (~/.claude)" },
    { kind: "agent", base: "workspace", dir: ".claude/agents", layout: "flat-md", source: "Project (.claude)" },
    { kind: "agent", base: "home", dir: ".claude/agents", layout: "flat-md", source: "User (~/.claude)" },
  ],
};

// ---------------------------------------------------------------------------
// Discovery limits
// ---------------------------------------------------------------------------

/** Only the head of each file is read — same bounded-slice discipline as
 *  `deriveClaudeRawTitleSource` in session-store.ts. Frontmatter + a first
 *  paragraph never need more than this. */
export const CAPABILITY_HEAD_BYTES = 8 * 1024;

/** Overall file ceiling across ALL roots for one scan. */
export const CAPABILITY_SCAN_FILE_CAP = 300;

/** Rendered items per group; a group's `total` still reports the true count.
 *  Deliberately generous: {@link CAPABILITY_SCAN_FILE_CAP} is the real bound on
 *  the work, both mounts scroll, and the `+N more` tail is a dead end (there is
 *  no "show the rest" affordance) — so a low cap just hides the user's own
 *  skills from them. It should be a rare tail, not the default experience for
 *  anyone with a well-stocked skills directory. */
export const CAPABILITY_GROUP_CAP = 100;

/** A description longer than this is truncated with a trailing ellipsis. */
export const CAPABILITY_DESCRIPTION_MAX_CHARS = 160;

/**
 * A capability `name` is arbitrary attacker-controlled text once it comes from
 * frontmatter — a workspace-tier skill/agent file is fully attacker-authored by
 * whoever committed the repo. Validated before it becomes a slash command
 * (`` `/${name} ` ``, inserted into the composer) or is shown for display: a
 * `.capability-row-name` is `nowrap`/`ellipsis`, so an unbounded name would
 * render visibly clipped while the FULL string still lands in the composer.
 * A name that fails this charset/length check falls back to the (always safe)
 * file-path-derived name; if that too fails it, the item is rendered
 * non-invocable rather than trusted as a slash command — see
 * {@link capabilityFromSkillFile}.
 */
export const CAPABILITY_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;

/** Independent of invocability — caps the DISPLAY name's length so even a
 *  non-invocable item (whose name fell back to something the path-derived name
 *  still didn't satisfy {@link CAPABILITY_NAME_PATTERN} for, e.g. a directory
 *  name with spaces) can't render an unbounded string. */
export const CAPABILITY_NAME_MAX_CHARS = 64;

function truncateName(name: string, max: number = CAPABILITY_NAME_MAX_CHARS): string {
  const s = (name || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

// ---------------------------------------------------------------------------
// Frontmatter
// ---------------------------------------------------------------------------

function unquote(v: string): string {
  if (v.length >= 2) {
    const first = v[0];
    const last = v[v.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) return v.slice(1, -1);
  }
  return v;
}

/** `key: value` line pattern. Keys never contain a colon, so splitting on the
 *  first `:` naturally lets a value contain further colons (e.g.
 *  `description: Note: see below`). */
const KV_LINE = /^([A-Za-z0-9_.-]+):\s?(.*)$/;
/** A folded (`>`) or literal (`|`) YAML block-scalar indicator, optionally
 *  with a chomping modifier (`>-`, `|+`) — the value is the following
 *  indented lines, not the rest of this line. */
const BLOCK_SCALAR = /^[>|][+-]?\d*\s*$/;

function parseFrontmatterLines(bodyLines: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < bodyLines.length) {
    const m = bodyLines[i].match(KV_LINE);
    if (!m) {
      i++;
      continue;
    }
    const key = m[1];
    const rest = m[2];
    if (BLOCK_SCALAR.test(rest.trim())) {
      i++;
      const collected: string[] = [];
      while (i < bodyLines.length) {
        const line = bodyLines[i];
        if (line.trim() === "") {
          i++;
          continue;
        }
        if (!/^\s/.test(line)) break; // dedented back to column 0 — block ends
        collected.push(line.trim());
        i++;
      }
      out[key] = collected.join(" ").trim();
      continue;
    }
    out[key] = unquote(rest.trim());
    i++;
  }
  return out;
}

/**
 * Parse a small, consistent YAML subset — plain `key: value` scalars, quoted
 * scalars (colon-safe — the key/value split happens on the FIRST colon, so a
 * quoted value may itself contain one), and folded/literal block scalars
 * (collapsed to one space-joined line; real files only ever use this for
 * `description: >`). Returns raw text scalars — `user-invocable: false`
 * parses to the **string** `"false"`, not the boolean; see
 * {@link frontmatterBool} for the separate, explicit coercion.
 *
 * If `text` starts with a `---` fence, only the lines between the opening and
 * closing fence are parsed (an unterminated fence — no closing `---` — is
 * treated as no frontmatter: `{}`, never throws). Otherwise the WHOLE text is
 * parsed as frontmatter body — this lets a caller (or a unit test) hand this
 * function a bare frontmatter snippet directly. {@link capabilityFromSkillFile}
 * only ever calls this on text it has already confirmed starts with `---`, so
 * a frontmatter-less markdown body is never misparsed as key/value pairs.
 * Malformed input never throws.
 */
export function parseFrontmatter(text: string): Record<string, string> {
  const lines = String(text ?? "").split(/\r?\n/);
  if (lines[0]?.trim() === "---") {
    let closeIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        closeIdx = i;
        break;
      }
    }
    if (closeIdx === -1) return {}; // unterminated fence
    return parseFrontmatterLines(lines.slice(1, closeIdx));
  }
  return parseFrontmatterLines(lines);
}

/**
 * Coerce a raw frontmatter string scalar to a boolean: `"false"|"no"|"0"|"off"`
 * → `false`; `"true"|"yes"|"1"|"on"` → `true`; anything else (incl.
 * `undefined`) → `fallback`. Case-insensitive, trimmed. A naive
 * `raw !== "false"` / `raw ?? true` check inverts `user-invocable: false`
 * (its parsed value is the truthy JS string `"false"`) — this is the explicit
 * fix, kept as its own named helper so the coercion is never re-derived
 * ad hoc at a call site.
 */
export function frontmatterBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "false" || v === "no" || v === "0" || v === "off") return false;
  if (v === "true" || v === "yes" || v === "1" || v === "on") return true;
  return fallback;
}

// ---------------------------------------------------------------------------
// Item construction
// ---------------------------------------------------------------------------

function deriveNameFromPath(filePath: string, layout: RootLayout): string {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (layout === "skill-dir") {
    // <dir>/<name>/SKILL.md — the name is the parent directory.
    return parts.length >= 2 ? parts[parts.length - 2] : (parts[parts.length - 1] ?? "");
  }
  // <dir>/<name>.md — the name is the file stem.
  return (parts[parts.length - 1] ?? "").replace(/\.md$/i, "");
}

/** First non-heading paragraph of `body` (blank-line-separated blocks), or
 *  "" if every block is a heading or the body is empty. A block whose first
 *  line starts with `#` is skipped whole. Internal whitespace/newlines are
 *  collapsed to single spaces. */
function firstBodyParagraph(body: string): string {
  const paragraphs = body.split(/\r?\n\s*\r?\n/);
  for (const p of paragraphs) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const firstLine = trimmed.split(/\r?\n/)[0];
    if (/^#/.test(firstLine)) continue;
    return trimmed.replace(/\s+/g, " ");
  }
  return "";
}

function truncateDescription(desc: string, max: number = CAPABILITY_DESCRIPTION_MAX_CHARS): string {
  const s = (desc || "").trim();
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

/** Trims `s` and returns `undefined` for an absent/blank value — used for
 *  `hint`, which (unlike `description`) has no "" placeholder for "unknown":
 *  a blank hint must never survive as "" and be mistaken for a real one by
 *  {@link mergeAcpCommands}'s disk-wins-when-non-empty rule. */
function trimmedOrUndefined(s: string | undefined): string | undefined {
  const t = (s ?? "").trim();
  return t ? t : undefined;
}

export interface CapabilityFileInput {
  /** Never `"command"` — a disk file is always a skill or an agent; ACP
   *  builtins are the only `"command"`-kind items (see {@link mergeAcpCommands}). */
  kind: "skill" | "agent";
  rawText: string;
  /** Absolute path to the source file. */
  filePath: string;
  layout: RootLayout;
  source: string;
}

/**
 * Build a {@link CapabilityItem} from one skill/agent/command markdown file's
 * raw text. Name/description fall back to the file path / first body
 * paragraph when frontmatter doesn't supply them. `user-invocable` defaults to
 * `true` (via {@link frontmatterBool}) per `08-skills.md` § Optional
 * Frontmatter Fields; `disable-model-invocation` does NOT affect
 * invocability (it restricts the *model*, not the user). An agent is never
 * invocable regardless of frontmatter — agents are launched via
 * `spawn_subagent`, not a slash command.
 */
export function capabilityFromSkillFile(input: CapabilityFileInput): CapabilityItem {
  const { kind, rawText, filePath, layout, source } = input;
  const hasFrontmatter = /^---\s*(\r?\n|$)/.test(rawText);
  const fm = hasFrontmatter ? parseFrontmatter(rawText) : {};
  const rawName = fm.name?.trim();
  // The frontmatter `name` is arbitrary attacker-controlled text with no
  // charset/length limit of its own (see CAPABILITY_NAME_PATTERN) — an invalid
  // one falls back to the always-safe, file-path-derived name rather than
  // becoming part of a slash command or an unbounded display string.
  const safeName = rawName && CAPABILITY_NAME_PATTERN.test(rawName) ? rawName : deriveNameFromPath(filePath, layout);
  const name = truncateName(safeName);

  let body = rawText;
  if (hasFrontmatter) {
    const lines = rawText.split(/\r?\n/);
    let closeIdx = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        closeIdx = i;
        break;
      }
    }
    body = closeIdx === -1 ? "" : lines.slice(closeIdx + 1).join("\n");
  }
  const description = truncateDescription(fm.description?.trim() || firstBodyParagraph(body));

  // Even a safe, validated name only becomes a slash command when the
  // frontmatter also asked for it; a name that ends up unsafe even after the
  // path-derived fallback (e.g. a directory containing a space) is never
  // trusted as an invocation target — the item still lists, just inert.
  const invocable = kind === "agent" ? false : frontmatterBool(fm["user-invocable"], true) && CAPABILITY_NAME_PATTERN.test(safeName);
  const hint = trimmedOrUndefined(fm["argument-hint"]);

  return {
    kind,
    name,
    description,
    invoke: invocable ? `/${safeName} ` : undefined,
    path: filePath,
    source,
    origin: "disk",
    hint,
  };
}

/**
 * grok's three documented built-in `spawn_subagent` types
 * (`16-subagents.md`) — not disk files, so no `path`; not user-invocable via
 * slash command, so no `invoke`. Empty for Claude (it has no equivalent
 * built-in agent types). A **function**, not a plain array constant: every
 * call must return fresh objects so a downstream merge step is never handed
 * (and able to mutate) one shared, reused set of objects.
 */
export function GROK_BUILTIN_AGENTS(backend: BackendId): CapabilityItem[] {
  if (backend !== "grok") return [];
  return [
    {
      kind: "agent",
      name: "general-purpose",
      description: "Open-ended research and multi-step tasks across the workspace.",
      source: "Built in",
      origin: "acp",
    },
    {
      kind: "agent",
      name: "explore",
      description: "Read-only exploration of the codebase — no edits, no commands.",
      source: "Built in",
      origin: "acp",
    },
    {
      kind: "agent",
      name: "plan",
      description: "Drafts an implementation plan without making any changes.",
      source: "Built in",
      origin: "acp",
    },
  ];
}

/** Dedupe an ordered (highest-priority-first) list of items, keyed on
 *  `` `${kind}|${name}` `` — never name alone, so a skill and an agent that
 *  share a name (e.g. a project's `plan` skill and grok's built-in `plan`
 *  agent type) both survive. The first occurrence of a key wins, so callers
 *  must order `items` highest-priority-first (project before home).
 *
 *  Because the key includes `kind`, `applySuiteKind` (`skill-suite.ts`) MUST
 *  run after this pass, never before: a workspace-tier and a home-tier
 *  `grokbit-plan` collapse here only while both are still `kind: "skill"`.
 *  Re-key first and the two carry different keys, both survive, and the same
 *  skill renders twice — once in Skills, once in Grokbit workflow. */
export function dedupeByPriority(items: readonly CapabilityItem[]): CapabilityItem[] {
  const seen = new Set<string>();
  const out: CapabilityItem[] = [];
  for (const item of items) {
    const key = `${item.kind}|${item.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Disk scan
// ---------------------------------------------------------------------------

/** One `fs.readdirSync(p, { withFileTypes: true })` entry — `isDirectory()`/
 *  `isFile()` reflect the entry itself (never a followed symlink's target, and
 *  never true for a FIFO/socket/device), so these calls need no separate
 *  `statSync` per entry AND, as a side effect, never proceed to `openSync` a
 *  FIFO (which blocks the extension host until a writer shows up) or descend
 *  into a symlinked "directory". They are a cheap PRE-filter, not the
 *  authoritative defense against a symlink escaping the root — that's
 *  {@link isPathContained}, below, which is checked regardless. */
export interface CapabilityDirEntry {
  name: string;
  isDirectory(): boolean;
  isFile(): boolean;
}

export interface CapabilityFsLike {
  existsSync(p: string): boolean;
  readdirSync(p: string): CapabilityDirEntry[];
  /** Read up to `length` bytes from the start of the file, decoded as UTF-8. */
  readHead(p: string, length: number): string;
  /** Resolve symlinks (mirrors `fs.realpathSync`) — see {@link isPathContained}. */
  realpathSync(p: string): string;
}

export interface ScanCapabilityRootsDeps {
  fs: CapabilityFsLike;
  roots: readonly CapabilityRootSpec[];
  backend: BackendId;
  workspaceDir: string;
  homeDir: string;
  env: Record<string, string | undefined>;
  headBytes?: number;
  fileCap?: number;
  entryCap?: number;
}

export interface ScanCapabilityRootsResult {
  items: CapabilityItem[];
  /** Roots that existed and were actually read (after `disabledByEnv` skips). */
  scannedRoots: number;
  /** True when {@link CAPABILITY_SCAN_FILE_CAP}/{@link CAPABILITY_ROOT_ENTRY_CAP}
   *  (or an injected `fileCap`/`entryCap`) stopped the scan before every root
   *  was fully read. */
  truncated: boolean;
}

function rootEnabled(root: CapabilityRootSpec, env: Record<string, string | undefined>): boolean {
  if (!root.disabledByEnv) return true;
  return frontmatterBool(env[root.disabledByEnv], true);
}

/** Overall ceiling on directory ENTRIES EXAMINED per root (not just files
 *  queued for a head-read) — a huge directory previously cost a `statSync` +
 *  `existsSync` pair per entry with no ceiling at all, since
 *  {@link CAPABILITY_SCAN_FILE_CAP} only counted files actually read. This cap
 *  is checked FIRST, before any per-entry syscall, so it bounds the scan for
 *  real rather than just the memory it accumulates. */
export const CAPABILITY_ROOT_ENTRY_CAP = 2000;

/**
 * Whether `candidateRealPath` is `baseRealPath` itself or lies inside it — the
 * containment check a symlink escape is measured against. Git can check in a
 * symlink with an absolute target (a whole capability root, e.g. `.claude/skills`,
 * or a single entry inside one, e.g. `.grok/agents/notes.md -> ~/.ssh/id_rsa`),
 * and capability roots include workspace-tier directories an untrusted checked-in
 * repo controls — so this is checked for the ROOT ITSELF (against its `base`)
 * and for every candidate FILE (against the root), not just entries. Comparison
 * happens on REALPATHs (fully symlink-resolved) on both sides; rejecting a
 * symlinked root/entry outright (rather than trying to special-case it) is
 * deliberate — no real skill/agent layout needs one.
 */
export function isPathContained(baseRealPath: string, candidateRealPath: string): boolean {
  if (baseRealPath === candidateRealPath) return true;
  const rel = path.relative(baseRealPath, candidateRealPath);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Walk every {@link CapabilityRootSpec} in `roots`, reading disk skills/agents
 * into {@link CapabilityItem}s. A missing root (`readdirSync` throws, e.g.
 * `ENOENT`) is skipped silently — the real `~/.claude/skills` case on a
 * machine that's never used Claude Code — and does not abort later roots; a
 * file that throws on read is likewise skipped, not fatal. Bounded by
 * {@link CAPABILITY_SCAN_FILE_CAP} (or the injected `fileCap`) across ALL
 * roots combined, and by {@link CAPABILITY_ROOT_ENTRY_CAP} (or the injected
 * `entryCap`) per root, never a workspace-wide glob. grok's built-in agent
 * types ({@link GROK_BUILTIN_AGENTS}) are appended before the final
 * {@link dedupeByPriority} pass, so a real `.grok/agents/plan.md` (if one
 * exists) wins over the built-in placeholder of the same name.
 */
export function scanCapabilityRoots(deps: ScanCapabilityRootsDeps): ScanCapabilityRootsResult {
  const { fs, roots, backend, workspaceDir, homeDir, env } = deps;
  const headBytes = deps.headBytes ?? CAPABILITY_HEAD_BYTES;
  const fileCap = deps.fileCap ?? CAPABILITY_SCAN_FILE_CAP;
  const entryCap = deps.entryCap ?? CAPABILITY_ROOT_ENTRY_CAP;

  const items: CapabilityItem[] = [];
  let scannedRoots = 0;
  let filesRead = 0;
  let truncated = false;

  rootLoop: for (const root of roots) {
    if (!rootEnabled(root, env)) continue;
    const base = root.base === "home" ? homeDir : workspaceDir;
    const dir = path.join(base, root.dir);

    let exists = false;
    try {
      exists = fs.existsSync(dir);
    } catch {
      exists = false;
    }
    if (!exists) continue;

    // Containment for the ROOT ITSELF — an untrusted repo can check in e.g.
    // `.claude/skills` AS a symlink with an absolute target entirely outside
    // the workspace. A broken/unreadable link is treated like a missing root.
    let realBase: string;
    let realDir: string;
    try {
      realBase = fs.realpathSync(base);
      realDir = fs.realpathSync(dir);
    } catch {
      continue;
    }
    if (!isPathContained(realBase, realDir)) continue;
    scannedRoots++;

    let entries: CapabilityDirEntry[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }

    let entriesExamined = 0;
    for (const entry of entries) {
      if (entriesExamined >= entryCap) {
        truncated = true;
        break;
      }
      entriesExamined++;
      const name = entry.name;

      let filePath: string;
      if (root.layout === "skill-dir") {
        if (!entry.isDirectory()) continue; // also rejects a symlinked "directory" entry
        const subDir = path.join(dir, name);
        let subEntries: CapabilityDirEntry[];
        try {
          subEntries = fs.readdirSync(subDir);
        } catch {
          continue;
        }
        const skillEntry = subEntries.find((e) => e.name === "SKILL.md");
        if (!skillEntry || !skillEntry.isFile()) continue;
        filePath = path.join(subDir, "SKILL.md");
      } else {
        if (!name.toLowerCase().endsWith(".md")) continue;
        if (!entry.isFile()) continue; // rejects a symlink, FIFO, socket, or directory named *.md
        filePath = path.join(dir, name);
      }

      // Containment for the actual file about to be read — the authoritative
      // check regardless of what the dirent-type pre-filters above already
      // caught (a symlinked SKILL.md/*.md resolving outside the root).
      let realFilePath: string;
      try {
        realFilePath = fs.realpathSync(filePath);
      } catch {
        continue;
      }
      if (!isPathContained(realDir, realFilePath)) continue;

      if (filesRead >= fileCap) {
        truncated = true;
        break rootLoop;
      }
      filesRead++;

      let text = "";
      try {
        text = fs.readHead(filePath, headBytes);
      } catch {
        continue;
      }
      items.push(capabilityFromSkillFile({ kind: root.kind, rawText: text, filePath, layout: root.layout, source: root.source }));
    }
  }

  const merged = [...items, ...GROK_BUILTIN_AGENTS(backend)];
  return { items: dedupeByPriority(merged), scannedRoots, truncated };
}

// ---------------------------------------------------------------------------
// Merge + grouping
// ---------------------------------------------------------------------------

/** Minimal shape of `AcpClient.availableCommands` (`SlashCommand` in
 *  `acp.ts`) — a local, structural type so this module doesn't need to import
 *  `acp.ts`. `input.hint` mirrors `SlashCommand.input?.hint` (`src/acp.ts`). */
export interface AcpCommandLike {
  name: string;
  description?: string;
  input?: { hint?: string };
}

/**
 * The disk kind is authoritative; ACP only enriches. Every disk `skill` item
 * whose name matches an ACP command is enriched in place (invocability
 * confirmed; description AND hint filled ONLY when the disk value is empty —
 * disk-wins-when-non-empty keeps a row's text stable across the
 * `commandsUpdate` transition, so the panel never rewrites itself moments
 * after it renders) — it produces no second row. An ACP command with no disk
 * match becomes a `kind: "command"` row (the CLI's own builtins: `/new`,
 * `/compact`, `/resume`, …), carrying its own hint if it has one. Agents are
 * never matched against ACP commands — only skills are user-invocable slash
 * commands.
 */
export function mergeAcpCommands(diskItems: readonly CapabilityItem[], acpCommands: readonly AcpCommandLike[]): CapabilityItem[] {
  const skillIndex = new Map<string, number>();
  diskItems.forEach((item, i) => {
    if (item.kind === "skill") skillIndex.set(item.name, i);
  });

  const out = diskItems.slice();
  for (const cmd of acpCommands) {
    const cmdHint = trimmedOrUndefined(cmd.input?.hint);
    const idx = skillIndex.get(cmd.name);
    if (idx === undefined) {
      out.push({
        kind: "command",
        name: cmd.name,
        description: (cmd.description ?? "").trim(),
        invoke: `/${cmd.name} `,
        source: "Built in",
        origin: "acp",
        hint: cmdHint,
      });
      continue;
    }
    const disk = out[idx];
    out[idx] = {
      ...disk,
      description: disk.description || (cmd.description ?? "").trim(),
      invoke: disk.invoke ?? `/${disk.name} `,
      hint: disk.hint || cmdHint,
    };
  }
  return out;
}

/**
 * Merge disk items with ACP commands ({@link mergeAcpCommands}) and group by
 * {@link CapabilityKind}, ordered by {@link CAPABILITY_KIND_ORDER} — empty
 * kinds are omitted entirely (never an empty placeholder group). Each group's
 * `items` is capped at `cap`; `total` is the pre-cap count.
 */
export function buildCapabilityGroups(
  diskItems: readonly CapabilityItem[],
  acpCommands: readonly AcpCommandLike[],
  cap: number = CAPABILITY_GROUP_CAP,
): CapabilityGroup[] {
  const merged = mergeAcpCommands(diskItems, acpCommands);
  const byKind = new Map<CapabilityKind, CapabilityItem[]>();
  for (const item of merged) {
    const list = byKind.get(item.kind);
    if (list) list.push(item);
    else byKind.set(item.kind, [item]);
  }
  const groups: CapabilityGroup[] = [];
  for (const kind of CAPABILITY_KIND_ORDER) {
    const items = byKind.get(kind);
    if (!items || items.length === 0) continue;
    groups.push({ kind, title: CAPABILITY_KIND_LABELS[kind], items: items.slice(0, cap), total: items.length });
  }
  return groups;
}
