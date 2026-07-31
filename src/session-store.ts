/**
 * `SessionStore` — the seam between the (per-backend) on-disk session layout and
 * the history popover's pagination/merge/search machinery in `sidebar.ts`. grok
 * stores one directory per session (`~/.grok/sessions/<urlencoded-cwd>/<id>/`,
 * see `sessions.ts`); Claude Code stores one flat file per session
 * (`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`). Both must feed the same
 * paginated, cache-friendly, searchable list — see
 * docs/plans/claude-code-backend.md § WP4 and CLAUDE.md § History pagination.
 *
 * `GrokSessionStore` is a thin, behaviour-preserving wrapper around the existing
 * pure functions in `sessions.ts` (unchanged there — this is a pure refactor for
 * grok). `ClaudeSessionStore` is new: it derives a title from head/tail slices of
 * the `.jsonl` (never the whole file — sessions run into the megabytes) and
 * resolves the project directory case-insensitively on Windows (see
 * `resolveClaudeProjectDir`).
 */
import * as nodeFs from "node:fs";
import * as path from "node:path";
import { BackendId } from "./backends";
import {
  FsLike,
  SessionListEntry,
  SessionMetaOverrides,
  clearSessions,
  deleteSessionDir,
  fallbackName,
  indexSessions,
  isSafeSessionId,
  isWithinDir,
  readSessionEntries,
  readSessionTokenUsage,
} from "./sessions";

/** {@link SessionListEntry} plus the backend it came from, so a merged list can
 *  badge/route each row without the caller re-deriving it from the id. */
export interface SessionStoreListEntry extends SessionListEntry {
  backend: BackendId;
}

/** Cheap ordering entry (mtime only, no content) tagged with its backend. */
export interface SessionStoreIndexEntry {
  id: string;
  mtimeMs: number;
  backend: BackendId;
}

/**
 * One backend's session storage, behind a layout-agnostic interface. `cwd` is an
 * explicit parameter on every call (not bound at construction) — mirrors the
 * existing `indexSessions`/`readSessionEntries` convention in `sessions.ts`
 * rather than the plan sketch's shorthand, which omitted it for brevity.
 */
export interface SessionStore {
  readonly backend: BackendId;
  /** Newest-first by last-activity mtime. Stat-only — no reads/parses. */
  index(cwd: string): SessionStoreIndexEntry[];
  /** Read + parse exactly the given ids (a page, or the whole catalog for search). */
  readEntries(cwd: string, ids: string[], overrides: SessionMetaOverrides): SessionStoreListEntry[];
  /** Remove one session. No-op if it doesn't exist. */
  remove(cwd: string, id: string): void;
  /** Remove every session under `cwd` except `exceptIds`. Best-effort (a locked/
   *  unremovable entry is skipped, not thrown) — returns the ids actually removed. */
  removeAll(cwd: string, exceptIds?: Set<string>): string[];
  /** Best on-disk estimate of context-tokens-used for one session, or undefined
   *  when unknown / not applicable to this backend. */
  readTokenUsage(cwd: string, id: string): number | undefined;
}

export interface GrokSessionStoreDeps {
  fs: FsLike;
  grokHome: string;
  log?: (msg: string) => void;
}

/** grok's existing directory-per-session layout, moved behind {@link SessionStore}.
 *  Every method delegates straight to the unchanged `sessions.ts` primitives —
 *  grok history behaviour is byte-identical to before WP4. */
export class GrokSessionStore implements SessionStore {
  readonly backend: BackendId = "grok";
  constructor(private readonly deps: GrokSessionStoreDeps) {}

  index(cwd: string): SessionStoreIndexEntry[] {
    const { fs, grokHome, log } = this.deps;
    return indexSessions({ fs, grokHome, cwd, log }).map((e) => ({ ...e, backend: this.backend }));
  }

  readEntries(cwd: string, ids: string[], overrides: SessionMetaOverrides): SessionStoreListEntry[] {
    const { fs, grokHome, log } = this.deps;
    return readSessionEntries({ fs, grokHome, cwd, ids, overrides, log }).map((e) => ({ ...e, backend: this.backend }));
  }

  remove(cwd: string, id: string): void {
    deleteSessionDir({ fs: this.deps.fs, grokHome: this.deps.grokHome, cwd, id });
  }

  removeAll(cwd: string, exceptIds?: Set<string>): string[] {
    return clearSessions({ fs: this.deps.fs, grokHome: this.deps.grokHome, cwd, exceptIds });
  }

  readTokenUsage(cwd: string, id: string): number | undefined {
    return readSessionTokenUsage({ fs: this.deps.fs, grokHome: this.deps.grokHome, cwd, id });
  }
}

// ---------------------------------------------------------------------------
// Claude Code session storage
// ---------------------------------------------------------------------------

/**
 * Filesystem seam for {@link ClaudeSessionStore}. Narrower reads than
 * `sessions.ts`'s `FsLike` (`readSlice` instead of `readFileSync`) because a
 * Claude `.jsonl` can run into the megabytes — title derivation reads only a
 * bounded head/tail slice, never the whole file (see `deriveClaudeRawTitleSource`).
 */
export interface ClaudeFsLike {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
  statSync(p: string): { mtimeMs: number; size: number };
  /** Read up to `length` bytes starting at byte offset `start`, decoded as UTF-8.
   *  `start`/`length` are clamped to the file's actual size. */
  readSlice(p: string, start: number, length: number): string;
  unlinkSync(p: string): void;
}

/** Production `ClaudeFsLike` backed by real positional reads (open/read/close),
 *  so `readSlice` never loads more than the requested window into memory. */
export const defaultClaudeFs: ClaudeFsLike = {
  existsSync: nodeFs.existsSync,
  readdirSync: (p) => nodeFs.readdirSync(p) as string[],
  statSync: (p) => nodeFs.statSync(p),
  readSlice: (p, start, length) => {
    const fd = nodeFs.openSync(p, "r");
    try {
      const size = nodeFs.fstatSync(fd).size;
      const from = Math.max(0, Math.min(start, size));
      const len = Math.max(0, Math.min(length, size - from));
      if (len === 0) return "";
      const buf = Buffer.alloc(len);
      nodeFs.readSync(fd, buf, 0, len, from);
      return buf.toString("utf8");
    } finally {
      nodeFs.closeSync(fd);
    }
  },
  unlinkSync: (p) => nodeFs.unlinkSync(p),
};

/** Resolve the Claude home directory honoring HOME/USERPROFILE — mirrors
 *  `resolveGrokHome` in `sessions.ts`. */
export function resolveClaudeHome(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME || env.USERPROFILE || "";
  return path.join(home, ".claude");
}

/**
 * Claude's project-directory encoding: every non-alphanumeric character of the
 * cwd is replaced with `-`, preserving the original case of the rest of the
 * string. Verified against real on-disk sessions
 * (research/claude-code-backend.md): `C:\Users\israe\Projects\Grokbit.ai` ->
 * `C--Users-israe-Projects-Grokbit-ai`.
 */
export function claudeProjectDirName(cwd: string): string {
  return cwd.replace(/[^A-Za-z0-9]/g, "-");
}

/**
 * Resolve the actual on-disk Claude project directory for `cwd`, falling back
 * (Windows only) to a case-insensitive match when the exact-case candidate
 * doesn't exist. The drive-letter case in the encoded name follows whatever
 * exact cwd string was given at session-creation time — verified on this
 * machine: the same user has BOTH a `C--Users-israe-...` and a
 * `c--Users-israe-...` directory for the same project, because different
 * tools normalize the drive letter differently. Without this fallback,
 * history for a session created under a differently-cased cwd silently comes
 * back empty on Windows.
 *
 * **Windows-only, not unconditional.** This fallback is justified ONLY by
 * that Windows drive-letter artifact — Windows filesystems are
 * case-insensitive, so `C--...` and `c--...` really are the same on-disk
 * entity there. On a case-sensitive filesystem (macOS/Linux, both real
 * options), `/home/u/Foo` and `/home/u/foo` are genuinely DIFFERENT projects;
 * an unconditional fallback would resolve one workspace's Claude sessions to
 * another's, and since this resolved dir is what `remove`/`removeAll` delete
 * from, "Clear all history" could delete another project's Claude sessions
 * (and `readEntries` could disclose their titles). `platform` is a parameter
 * (defaulting to the real `process.platform`) so this stays unit-testable
 * without mutating global state.
 *
 * Returns undefined when no match exists (no Claude sessions yet for this
 * workspace).
 */
export function resolveClaudeProjectDir(
  fs: ClaudeFsLike,
  claudeHome: string,
  cwd: string,
  platform: NodeJS.Platform = process.platform,
): string | undefined {
  const projectsDir = path.join(claudeHome, "projects");
  const wanted = claudeProjectDirName(cwd);
  const exact = path.join(projectsDir, wanted);
  if (fs.existsSync(exact)) return exact;
  if (platform !== "win32") return undefined;
  let names: string[];
  try {
    names = fs.readdirSync(projectsDir);
  } catch {
    return undefined;
  }
  const wantedLower = wanted.toLowerCase();
  const match = names.find((n) => n.toLowerCase() === wantedLower);
  return match ? path.join(projectsDir, match) : undefined;
}

const JSONL_EXT = ".jsonl";

/** One already-`JSON.parse`d line of a Claude `.jsonl` — the payload shape varies
 *  wildly by record `type` (see the title-derivation comment below), so this is
 *  intentionally loose rather than a exhaustive union. */
type ClaudeRecord = Record<string, any>;

/** Parse a (possibly slice-truncated) chunk of a `.jsonl` file into records,
 *  tolerating blank lines and a partial line at either edge (a head/tail slice
 *  is not line-aligned) — a broken line is skipped, never thrown. */
function parseJsonlLines(text: string): ClaudeRecord[] {
  const out: ClaudeRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      out.push(JSON.parse(s));
    } catch {
      // Truncated by a slice boundary, or genuinely malformed — skip it.
    }
  }
  return out;
}

/** The LAST `type:"ai-title"` record's `aiTitle` in `records`, or undefined.
 *  Claude Code regenerates this record repeatedly as a conversation grows (a
 *  real 1158-line session had 69 of them) — the last one is the most refined. */
function lastAiTitle(records: ClaudeRecord[]): string | undefined {
  let found: string | undefined;
  for (const r of records) {
    if (r?.type === "ai-title" && typeof r.aiTitle === "string" && r.aiTitle.trim()) {
      found = r.aiTitle.trim();
    }
  }
  return found;
}

/** Real free-text content of a Claude `type:"user"` record, or "" when the record
 *  is non-conversational: a sidechain turn (`isSidechain`), a `tool_result`
 *  content block (Claude logs tool output as a user-role turn — those blocks
 *  carry `content`, not `text`, so they never contribute text here), or
 *  slash-command scaffolding. None of the scaffolding record shapes
 *  (`<command-name>`, `<local-command-stdout>`/`<local-command-stderr>`,
 *  `<local-command-caveat>`, `<task-notification>`) are reliably flagged
 *  `isMeta` on disk, but every one of them starts with `<` — the same signal
 *  grok's own `extractUserQueries` uses to skip its `<user_info>`/
 *  `<system-reminder>` envelopes. */
function claudeUserText(record: ClaudeRecord): string {
  if (record?.type !== "user" || record?.isSidechain) return "";
  const content = record?.message?.content;
  const text = (
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((c: any) => (c && typeof c === "object" && typeof c.text === "string" ? c.text : "")).join("")
        : ""
  ).trim();
  if (!text || text.startsWith("<")) return "";
  return text;
}

/** First real user message's text in `records`, or undefined. */
function firstRealUserMessage(records: ClaudeRecord[]): string | undefined {
  for (const r of records) {
    const text = claudeUserText(r);
    if (text) return text;
  }
  return undefined;
}

/** Bytes read from the tail/head of a `.jsonl` to derive a title without parsing
 *  the whole file. Generous enough to comfortably span several trailing/leading
 *  records on a real session (verified against on-disk files up to ~3MB). */
const CLAUDE_TITLE_TAIL_BYTES = 16 * 1024;
const CLAUDE_TITLE_HEAD_BYTES = 64 * 1024;

/**
 * Derive the best available raw title source for a Claude session, WITHOUT
 * reading the whole `.jsonl` (a real session can run into the megabytes).
 *
 * Verified against real on-disk sessions (research/claude-code-backend.md, WP4
 * P6): Claude Code has no `type:"summary"` record — the plan's original
 * assumption. Instead the title lives in a `type:"ai-title"` record (`aiTitle`
 * field) that Claude Code regenerates repeatedly as the conversation grows. The
 * file also carries several non-conversational record types that must be
 * skipped when scanning for either the title or a fallback first message:
 * `last-prompt`, `mode`, `permission-mode`, `attachment`, `queue-operation`,
 * `file-history-snapshot`/`file-history-delta`, `system`, and `isSidechain`
 * user/assistant turns (nested Task-tool sub-transcripts).
 *
 * Tier 1: the latest `ai-title` found in a tail slice (the freshest title is
 * usually near the end of an active conversation). Tier 2: the latest
 * `ai-title` found in a head slice instead (covers a short file, or a session
 * whose only title sits near the start and never regenerated). Tier 3: the
 * first real user message from that same head slice. Tier 4 (no usable
 * source): "" — the caller runs this through {@link fallbackName} exactly like
 * a grok session with no `session_summary`, which turns "" into a dated
 * "Untitled (…)".
 */
/**
 * Bytes of `.jsonl` tail scanned for the latest per-turn usage record. Larger than
 * {@link CLAUDE_TITLE_TAIL_BYTES} because a single assistant record carries its
 * full content plus the `usage` object, so the last one can sit well back from EOF.
 */
const CLAUDE_USAGE_TAIL_BYTES = 256 * 1024;

/**
 * Context-tokens-used for a Claude session, read from the **last** `type:"assistant"`
 * record's `message.usage` — Claude Code's analog of grok's `signals.json`
 * `contextTokensUsed`, which `session/load` replay does not carry on either backend
 * (verified by research/claude-acp-resume-probe.cjs). Without this a resumed Claude
 * tab's context donut reads nothing until the next completed turn.
 *
 * The context total is the whole prompt plus the reply — `input_tokens` +
 * `cache_creation_input_tokens` + `cache_read_input_tokens` + `output_tokens`. The
 * cache fields are the bulk of it and omitting them understates usage by orders of
 * magnitude (a real record: 2 + 696 + 474_901 + 291 ≈ 476k against Opus's 1M window).
 *
 * Scans a bounded tail only — these files reach megabytes. Returns undefined when no
 * usage record is in the window rather than a misleading 0.
 */
function readClaudeUsageFromTail(fs: ClaudeFsLike, filePath: string, size: number): number | undefined {
  const start = Math.max(0, size - CLAUDE_USAGE_TAIL_BYTES);
  const records = parseJsonlLines(fs.readSlice(filePath, start, size - start));
  for (let i = records.length - 1; i >= 0; i--) {
    const rec = records[i] as any;
    if (rec?.type !== "assistant") continue;
    const u = rec.message?.usage;
    if (!u || typeof u !== "object") continue;
    const total =
      num(u.input_tokens) + num(u.cache_creation_input_tokens) +
      num(u.cache_read_input_tokens) + num(u.output_tokens);
    if (total > 0) return total;
  }
  return undefined;
}

function num(v: unknown): number {
  return typeof v === "number" && isFinite(v) ? v : 0;
}

function deriveClaudeRawTitleSource(fs: ClaudeFsLike, filePath: string, size: number): string {
  const tailStart = Math.max(0, size - CLAUDE_TITLE_TAIL_BYTES);
  const tailText = fs.readSlice(filePath, tailStart, size - tailStart);
  const tailTitle = lastAiTitle(parseJsonlLines(tailText));
  if (tailTitle) return tailTitle;

  const headText = fs.readSlice(filePath, 0, Math.min(CLAUDE_TITLE_HEAD_BYTES, size));
  const headRecords = parseJsonlLines(headText);
  const headTitle = lastAiTitle(headRecords);
  if (headTitle) return headTitle;

  return firstRealUserMessage(headRecords) ?? "";
}

export interface ClaudeSessionStoreDeps {
  fs: ClaudeFsLike;
  claudeHome: string;
  log?: (msg: string) => void;
}

/**
 * Claude Code's flat-file-per-session layout
 * (`~/.claude/projects/<encoded-cwd>/<uuid>.jsonl`), behind {@link SessionStore}.
 * `numMessages` is always 0 (counting turns needs a full parse, which the "no
 * megabyte reads" constraint rules out) — the history row simply omits the
 * "N msg" fragment, same as any entry with `numMessages: 0` today.
 */
export class ClaudeSessionStore implements SessionStore {
  readonly backend: BackendId = "claude";
  constructor(private readonly deps: ClaudeSessionStoreDeps) {}

  index(cwd: string): SessionStoreIndexEntry[] {
    const { fs, claudeHome, log } = this.deps;
    const dir = resolveClaudeProjectDir(fs, claudeHome, cwd);
    if (!dir) return [];
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch (e) {
      log?.(`[claude-sessions] failed to read ${dir}: ${(e as Error).message}`);
      return [];
    }
    const out: SessionStoreIndexEntry[] = [];
    for (const name of names) {
      if (!name.endsWith(JSONL_EXT)) continue;
      let st: { mtimeMs: number };
      try {
        st = fs.statSync(path.join(dir, name));
      } catch {
        continue;
      }
      out.push({ id: name.slice(0, -JSONL_EXT.length), mtimeMs: st.mtimeMs, backend: this.backend });
    }
    out.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return out;
  }

  readEntries(cwd: string, ids: string[], overrides: SessionMetaOverrides): SessionStoreListEntry[] {
    const { fs, claudeHome, log } = this.deps;
    const dir = resolveClaudeProjectDir(fs, claudeHome, cwd);
    const out: SessionStoreListEntry[] = [];
    if (!dir) return out;
    for (const id of ids) {
      const filePath = path.join(dir, `${id}${JSONL_EXT}`);
      let st: { mtimeMs: number; size: number };
      try {
        st = fs.statSync(filePath);
      } catch (e) {
        log?.(`[claude-sessions] could not stat ${id}: ${(e as Error).message}`);
        continue;
      }
      let raw = "";
      try {
        raw = deriveClaudeRawTitleSource(fs, filePath, st.size);
      } catch (e) {
        log?.(`[claude-sessions] could not derive a title for ${id}: ${(e as Error).message}`);
      }
      const override = overrides[id];
      const customName = override?.customName?.trim() || undefined;
      const updatedAt = st.mtimeMs;
      out.push({
        id,
        cwd,
        displayName: customName || fallbackName(raw, updatedAt),
        rawSummary: raw,
        customName,
        updatedAt,
        // No cheap on-disk "created" timestamp distinct from mtime — same
        // approximation grok falls back to when `created_at` is missing.
        createdAt: updatedAt,
        numMessages: 0,
        modelId: undefined,
        backend: this.backend,
      });
    }
    return out;
  }

  remove(cwd: string, id: string): void {
    if (!isSafeSessionId(id)) return; // defense-in-depth — see isSafeSessionId in sessions.ts
    const { fs, claudeHome } = this.deps;
    const dir = resolveClaudeProjectDir(fs, claudeHome, cwd);
    if (!dir) return;
    const filePath = path.join(dir, `${id}${JSONL_EXT}`);
    if (!isWithinDir(filePath, dir)) return;
    if (!fs.existsSync(filePath)) return;
    fs.unlinkSync(filePath);
  }

  removeAll(cwd: string, exceptIds?: Set<string>): string[] {
    const { fs, claudeHome } = this.deps;
    const dir = resolveClaudeProjectDir(fs, claudeHome, cwd);
    if (!dir) return [];
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    const removed: string[] = [];
    for (const name of names) {
      if (!name.endsWith(JSONL_EXT)) continue;
      const id = name.slice(0, -JSONL_EXT.length);
      if (exceptIds?.has(id)) continue;
      try {
        fs.unlinkSync(path.join(dir, name));
        removed.push(id);
      } catch {
        continue;
      }
    }
    return removed;
  }

  readTokenUsage(cwd: string, id: string): number | undefined {
    const { fs, claudeHome, log } = this.deps;
    const dir = resolveClaudeProjectDir(fs, claudeHome, cwd);
    if (!dir) return undefined;
    const filePath = path.join(dir, `${id}${JSONL_EXT}`);
    try {
      return readClaudeUsageFromTail(fs, filePath, fs.statSync(filePath).size);
    } catch (e) {
      log?.(`[claude-sessions] could not read token usage for ${id}: ${(e as Error).message}`);
      return undefined;
    }
  }
}

// ---------------------------------------------------------------------------
// Merge across backends
// ---------------------------------------------------------------------------

export interface MergedSessionsPage {
  entries: SessionStoreListEntry[];
  /** The merged (all backends), newest-first, UNWINDOWED index — exposed so a caller
   *  that also needs "is this id on disk at all" (e.g. live-session synthesis for an
   *  in-memory session with no file/dir flushed yet) doesn't have to recompute it.
   *  Deliberately not filtered by `sinceMs`/`pinnedIds`: windowing this set too would
   *  make an out-of-window live session look "absent from disk" and get synthesized
   *  as a DUPLICATE row (docs/plans/capability-surfacing-and-history-ux.md § Thread 3
   *  — "index stays unwindowed"). */
  index: SessionStoreIndexEntry[];
  /** The windowed count (post `sinceMs`/`pinnedIds`) — drives paging, `hasMore`, and
   *  the launcher's "showing the first N of total" ceiling notice. */
  total: number;
  /** The UNWINDOWED count across every session for this cwd (both backends) — drives
   *  only the "Clear all" footer, since `removeAll` deletes every session, not just
   *  the in-window ones. Never swap this with `total`: a footer keyed off `total`
   *  would hide a destructive action that still works; a ceiling notice keyed off
   *  `totalAll` would state a number the windowed list can never reach. */
  totalAll: number;
  /** Index SLOTS this page consumed from the windowed list (offset..offset+limit) —
   *  NOT `entries.length`, which counts only rows `readEntries` actually managed to
   *  parse. `readSessionEntries` (sessions.ts) silently drops an id whose
   *  `summary.json` is unparseable/locked (plausible on Windows, where grok
   *  re-persists a live session's file); if diskCount instead counted successfully-
   *  read rows, the host's authoritative `nextOffset` (`offset + diskCount`) would
   *  under-advance and re-read already-consumed slots — or, if an ENTIRE page failed
   *  to parse, get stuck at `nextOffset === offset` forever while `hasMore` stays
   *  true, so load-more could never reach the tail. Also distinct from the
   *  post-injection rendered row count (the host's live/synthetic rows), which would
   *  overshoot by their count and permanently skip real sessions at every page
   *  boundary. */
  diskCount: number;
  hasMore: boolean;
}

export type ReadEntriesFn = (
  store: SessionStore,
  ids: string[],
  mtimeById: Map<string, number>,
) => SessionStoreListEntry[];

export interface MergedSessionsPageDeps {
  /** One store per backend, e.g. `[grokStore, claudeStore]`. */
  stores: SessionStore[];
  cwd: string;
  offset: number;
  limit: number;
  /** Non-empty (after trim/lowercase) triggers a complete cross-backend search
   *  instead of a plain page. */
  query: string;
  /** Reads (or serves from a cache) the given ids for one store — called once
   *  per backend that has ids in the requested window (a plain page) or once
   *  per backend across the WHOLE catalog (search, so matching stays complete
   *  rather than limited to whatever page happens to be loaded). `mtimeById` is
   *  the merged index's id->mtime map, handed back so a cache-aware caller
   *  (`sidebar.ts`'s `sessionCache`) can decide staleness without re-deriving it. */
  readEntries: ReadEntriesFn;
  /** Cutoff (epoch ms) applied to the merged index's `mtimeMs` before pagination/
   *  search — undefined means no window (byte-identical to pre-WP3 behavior; the
   *  chat popover never passes this — only the launcher's history window does). */
  sinceMs?: number;
  /** Ids exempt from the `sinceMs` window — a live session whose on-disk mtime is
   *  stale (a resumed old session, or a narrow `launcherHistoryDays`) would
   *  otherwise fall out of the window along with its status dot; see § Thread 3 in
   *  the plan. Meaningless (and ignored) when `sinceMs` is undefined. */
  pinnedIds?: ReadonlySet<string>;
}

/**
 * Merge every store's cheap index pass into one newest-first list, then apply
 * either plain pagination or (for a non-empty query) a complete cross-backend
 * search. This is the same algorithm `buildSessionsMessage` used for grok
 * alone, generalized to N backends and extracted so it's unit-testable without
 * `vscode` — see `sidebar.ts`'s `buildSessionsMessage`, which is the thin,
 * cache-wiring caller.
 */
export function buildMergedSessionsPage(deps: MergedSessionsPageDeps): MergedSessionsPage {
  const { stores, cwd, offset, limit, query, readEntries, sinceMs, pinnedIds } = deps;

  const merged: SessionStoreIndexEntry[] = [];
  for (const store of stores) merged.push(...store.index(cwd));
  merged.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const totalAll = merged.length;

  // Window AFTER the sort, BEFORE pagination/search — a pinned id survives the
  // window regardless of its mtime. sinceMs undefined means no filtering at all,
  // so the (unwindowed) chat-popover path stays byte-identical to pre-WP3.
  const windowed = sinceMs === undefined
    ? merged
    : merged.filter((e) => e.mtimeMs >= sinceMs || pinnedIds?.has(e.id));

  const mtimeById = new Map(merged.map((e) => [e.id, e.mtimeMs]));
  const storeByBackend = new Map(stores.map((s) => [s.backend, s]));

  function readGroup(idxEntries: SessionStoreIndexEntry[]): SessionStoreListEntry[] {
    const idsByBackend = new Map<BackendId, string[]>();
    for (const e of idxEntries) {
      const list = idsByBackend.get(e.backend);
      if (list) list.push(e.id);
      else idsByBackend.set(e.backend, [e.id]);
    }
    const byId = new Map<string, SessionStoreListEntry>();
    for (const [backend, ids] of idsByBackend) {
      const store = storeByBackend.get(backend);
      if (!store) continue;
      for (const entry of readEntries(store, ids, mtimeById)) byId.set(entry.id, entry);
    }
    // Preserve idxEntries' (mtime-sorted) order.
    return idxEntries.map((e) => byId.get(e.id)).filter((e): e is SessionStoreListEntry => !!e);
  }

  let pageEntries: SessionStoreListEntry[];
  let total: number;
  let diskCount: number;
  const q = query.trim().toLowerCase();
  if (q) {
    const all = readGroup(windowed);
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    const matched = all.filter((e) => e.displayName.toLowerCase().includes(q));
    total = matched.length;
    pageEntries = matched.slice(offset, offset + limit);
    // Search reads the WHOLE catalog up front rather than paging through disk
    // slots, so there's no separate "index slot" cursor to advance here.
    diskCount = pageEntries.length;
  } else {
    total = windowed.length;
    const pageIdx = windowed.slice(offset, offset + limit);
    pageEntries = readGroup(pageIdx);
    // mtime is an approximate sort key; re-order the loaded page by exact updatedAt.
    pageEntries.sort((a, b) => b.updatedAt - a.updatedAt);
    // The cursor means "index slots consumed", not "rows successfully read" — see
    // the diskCount field doc above.
    diskCount = pageIdx.length;
  }

  const hasMore = offset + pageEntries.length < total;
  return { entries: pageEntries, index: merged, total, totalAll, diskCount, hasMore };
}

/**
 * Convert a launcher history window (in days) to a `sinceMs` cutoff — `0` means
 * "unlimited" and MUST short-circuit to `undefined` before the subtraction below,
 * or a `days: 0` setting would compute `now - 0` and filter out every session
 * instead of none (docs/plans/capability-surfacing-and-history-ux.md § Thread 3 —
 * "0 days = no window"). `now` is a parameter (defaulting to `Date.now()`) so the
 * MAPPING, not wall-clock arithmetic, is what tests assert.
 */
export function daysToSinceMs(days: number, now: number = Date.now()): number | undefined {
  if (days <= 0) return undefined;
  return now - days * 24 * 60 * 60 * 1000;
}
