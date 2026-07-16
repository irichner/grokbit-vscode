import * as nodeFs from "node:fs";
import * as path from "node:path";
import { isPrimerText, isPrimerSummary } from "./grok-primer";

/** A session with at most this many recorded messages is cheap to confirm as empty
 *  (a primer-only session has ~4). The sweep only reads `chat_history.jsonl` for
 *  sessions under this bound, so it never touches large real sessions. */
export const EMPTY_PRIMER_MAX_MESSAGES = 20;

export interface SessionListEntry {
  id: string;
  cwd: string;
  displayName: string;
  rawSummary: string;
  customName?: string;
  updatedAt: number;
  createdAt: number;
  numMessages: number;
  modelId?: string;
}

export interface SessionMetaOverride {
  customName?: string;
  pinnedAt?: number;
  /** Last verdict the user gave to an exit_plan_mode card in this session, for the restore-card label. */
  lastPlanVerdict?: "approved" | "rejected" | "abandoned";
  /** Every plan the user resolved in this session, in chronological order. grok's plan.md only
   *  retains the latest plan content on disk; saving each one here lets the resume view replay
   *  rejected/cancelled plans that grok overwrote later in the conversation. `afterUserMessage`
   *  is the count of user messages that had been sent at the moment the plan was resolved, so
   *  the resume view can render each card right after that message instead of dumping all the
   *  plan cards at the bottom of the restored conversation. */
  plans?: { text: string; verdict: "approved" | "rejected" | "abandoned"; afterUserMessage?: number }[];
  /** Every permission card the user answered in this session, in order. The CLI
   *  doesn't replay `session/request_permission` on `session/load` (it's a server
   *  request, not a session update), so we persist the title + outcome here and
   *  replay each as a collapsed card. `afterUserMessage` positions it inline, like
   *  `plans`. */
  permissions?: { title: string; outcome: "allowed" | "rejected"; toolCallId?: string; afterUserMessage?: number }[];
  /** Dashboard "unread" badge: a turn finished while this session wasn't focused and
   *  hasn't been opened since. Drives the green/red dot; cleared on open. Persisted
   *  (not tied to the live process) so the badge survives reaping and a reload. */
  unread?: boolean;
  /** The unread turn ended in an error (red dot instead of green). */
  unreadError?: boolean;
}
export type SessionMetaOverrides = Record<string, SessionMetaOverride>;

/** Move a renamed session's `customName` from one id to another and drop the source entry. Used when
 *  a primer-only session is discarded and restarted under a new grok id (a model/effort switch on an
 *  empty session): the user's rename should follow to the new session, and the abandoned id's
 *  override must not linger. Only `customName` carries — a fresh session has no plans/unread/etc.
 *  worth keeping. Pure: removing the on-disk dir is the caller's job. Returns a new map; the input is
 *  left untouched. No-op carry when the source has no `customName` or `toId` is undefined. */
export function carrySessionName(
  overrides: SessionMetaOverrides,
  fromId: string,
  toId: string | undefined,
): SessionMetaOverrides {
  const next: SessionMetaOverrides = { ...overrides };
  const carried = next[fromId]?.customName?.trim();
  delete next[fromId];
  if (carried && toId) next[toId] = { ...(next[toId] ?? {}), customName: carried };
  return next;
}

export interface FsLike {
  existsSync(p: string): boolean;
  readdirSync(p: string): string[];
  readFileSync(p: string, encoding: "utf8"): string;
  statSync(p: string): { isDirectory(): boolean; mtimeMs: number };
  rmSync?(p: string, opts?: { recursive?: boolean; force?: boolean }): void;
  rmdirSync(p: string, opts?: { recursive?: boolean }): void;
}

export interface ListDeps {
  fs: FsLike;
  grokHome: string;
  cwd: string;
  overrides: SessionMetaOverrides;
  now?: () => number;
  log?: (msg: string) => void;
}

/** Locator for one session's on-disk directory — shared by per-session reads and deletes. */
export interface SessionDirDeps {
  fs: FsLike;
  grokHome: string;
  cwd: string;
  id: string;
}

/** Build the directory grok uses for sessions rooted at `cwd`. Mirrors grok's URL-encoded layout. */
export function sessionsDirFor(grokHome: string, cwd: string): string {
  return path.join(grokHome, "sessions", encodeURIComponent(cwd));
}

/** Tab label for a session that hasn't been named yet (no prompt sent). */
export const NEW_TAB_TITLE = "Grokbit New";

/**
 * Editor-tab title for a session. Tab labels are small, so the name is
 * whitespace-collapsed, trimmed, and truncated to ~24 chars with an ellipsis;
 * a session with no name yet (nothing sent) reads {@link NEW_TAB_TITLE}.
 * Name precedence is the caller's job (customName → in-memory first prompt →
 * on-disk displayName); this just formats whatever won. Pure.
 */
export function tabTitleFor(name: string | undefined, maxLen = 24): string {
  const collapsed = (name ?? "").replace(/\s+/g, " ").trim();
  if (!collapsed) return NEW_TAB_TITLE;
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1).trimEnd() + "…";
}

/** Default friendly name when no `customName` or `session_summary` is available. */
export function fallbackName(summary: string, updatedAt: number): string {
  const s = (summary || "").trim();
  if (s) return s.length > 60 ? s.slice(0, 57) + "…" : s;
  const d = new Date(updatedAt || Date.now());
  if (isNaN(d.getTime())) return "Untitled";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `Untitled (${yyyy}-${mm}-${dd} ${hh}:${mi})`;
}

function parseTimestamp(s: unknown, fallback: number): number {
  if (typeof s !== "string") return fallback;
  const t = Date.parse(s);
  return isNaN(t) ? fallback : t;
}

/** Parse one already-read summary.json into a list entry, applying any customName override. */
function buildEntry(
  dirName: string,
  raw: any,
  cwd: string,
  overrides: SessionMetaOverrides,
  fallbackNow: number,
): SessionListEntry {
  const id = (raw?.info?.id as string) ?? dirName;
  const sessCwd = (raw?.info?.cwd as string) ?? cwd;
  const rawSummary = typeof raw?.session_summary === "string" ? raw.session_summary : "";
  const updatedAt = parseTimestamp(raw?.updated_at, fallbackNow);
  const createdAt = parseTimestamp(raw?.created_at, updatedAt);
  const numMessages = typeof raw?.num_messages === "number" ? raw.num_messages : 0;
  const modelId = typeof raw?.current_model_id === "string" ? raw.current_model_id : undefined;
  const override = overrides[id];
  const customName = override?.customName?.trim() || undefined;
  const displayName = customName || fallbackName(rawSummary, updatedAt);
  return { id, cwd: sessCwd, displayName, rawSummary, customName, updatedAt, createdAt, numMessages, modelId };
}

export interface SessionIndexEntry {
  /** Directory name = grok session id. */
  id: string;
  /** Modification time of the session's `summary.json` (ms). A cheap proxy for last activity —
   *  grok rewrites that file (which also holds `updated_at`) on every turn. */
  mtimeMs: number;
}

export interface IndexDeps {
  fs: FsLike;
  grokHome: string;
  cwd: string;
  log?: (msg: string) => void;
}

/** Cheap ordering pass: every session id newest-first by `summary.json` mtime, WITHOUT reading or
 *  parsing any summary content. One `stat` per dir instead of a `stat` + `read` + `JSON.parse`, so
 *  it stays fast even with thousands of sessions. The caller reads (via `readSessionEntries`) only
 *  the window it actually shows. mtime is an approximate sort key; the exact `updated_at` order is
 *  re-applied within the loaded page after reading. */
export function indexSessions(deps: IndexDeps): SessionIndexEntry[] {
  const { fs, grokHome, cwd, log } = deps;
  const dir = sessionsDirFor(grokHome, cwd);
  if (!fs.existsSync(dir)) return [];
  let names: string[];
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    log?.(`[sessions] failed to read ${dir}: ${(e as Error).message}`);
    return [];
  }
  const out: SessionIndexEntry[] = [];
  for (const name of names) {
    const summaryPath = path.join(dir, name, "summary.json");
    let st: { mtimeMs: number };
    try {
      // A stat on summary.json doubles as the "is this a real session dir?" check: a stray file
      // entry (or a dir without summary.json) makes the join non-existent and statSync throws.
      st = fs.statSync(summaryPath);
    } catch {
      continue;
    }
    out.push({ id: name, mtimeMs: st.mtimeMs });
  }
  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

export interface ReadEntriesDeps {
  fs: FsLike;
  grokHome: string;
  cwd: string;
  ids: string[];
  overrides: SessionMetaOverrides;
  now?: () => number;
  log?: (msg: string) => void;
}

/** Read + parse summary.json for exactly the given ids (a page), returning full list entries in the
 *  same order. Malformed or vanished entries are skipped. This is the only path that touches file
 *  content, so callers keep it to the visible window. */
export function readSessionEntries(deps: ReadEntriesDeps): SessionListEntry[] {
  const { fs, grokHome, cwd, ids, overrides, log } = deps;
  const now = deps.now ? deps.now() : Date.now();
  const dir = sessionsDirFor(grokHome, cwd);
  const out: SessionListEntry[] = [];
  for (const id of ids) {
    const summaryPath = path.join(dir, id, "summary.json");
    let raw: any;
    try {
      raw = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
    } catch (e) {
      log?.(`[sessions] could not read summary.json for ${id}: ${(e as Error).message}`);
      continue;
    }
    out.push(buildEntry(id, raw, cwd, overrides, now));
  }
  return out;
}

/** Full session list sorted by last activity. Equivalent to `indexSessions` + `readSessionEntries`
 *  over every id; reads every summary.json, so prefer the paginated index/read primitives on hot
 *  paths. Kept for callers that genuinely need the whole list at once. */
export function listSessions(deps: ListDeps): SessionListEntry[] {
  const { fs, grokHome, cwd, overrides, log } = deps;
  const now = deps.now ? deps.now() : Date.now();
  const index = indexSessions({ fs, grokHome, cwd, log });
  const out = readSessionEntries({
    fs,
    grokHome,
    cwd,
    ids: index.map((e) => e.id),
    overrides,
    now: () => now,
    log,
  });
  out.sort((a, b) => b.updatedAt - a.updatedAt);
  return out;
}

/** Pull the user-visible queries out of a grok `chat_history.jsonl`. grok wraps the
 *  user's actual prompt in `<user_query>…</user_query>` inside a `role:"user"`
 *  message; the separate `role:"user"` `<user_info>` context block carries no
 *  `<user_query>` and is naturally skipped. Non-user roles (system/assistant/
 *  reasoning) are ignored. Unparseable lines are skipped. Pure. */
export function extractUserQueries(chatHistoryJsonl: string): string[] {
  const out: string[] = [];
  for (const line of (chatHistoryJsonl ?? "").split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    let o: any;
    try { o = JSON.parse(s); } catch { continue; }
    // grok keys the role on `type` (string like "system"/"user"/"reasoning"); some
    // builds use `role`. Either way we want only user turns.
    const role = o?.type ?? o?.role;
    if (role !== "user") continue;
    // Synthetic user turns — injected <system-reminder> / project-instructions /
    // background-task results — are not real queries; grok tags them `synthetic_reason`.
    if (o?.synthetic_reason) continue;
    const content = o?.content;
    const text = (
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((c: any) => (typeof c === "string" ? c : c?.text ?? "")).join("")
          : ""
    ).trim();
    if (!text) continue;
    // Skip the environment-context block (carries no user prompt) and any stray
    // reminder that wasn't flagged synthetic.
    if (/^<user_info>/.test(text) || /^<system-reminder>/.test(text)) continue;
    // The prompt is usually wrapped in <user_query>…</user_query>, but NOT always —
    // grok/composer sends some prompts (notably slash commands like `/imagine`) as a
    // plain user message with no wrapper. Counting only wrapped queries made those
    // sessions look primer-only, so a real one could be swept. Unwrap when present,
    // otherwise take the message verbatim. (Tolerate a missing closing tag.)
    const m = text.match(/<user_query>([\s\S]*?)(?:<\/user_query>|$)/);
    out.push((m ? m[1] : text).trim());
  }
  return out;
}

/** Split a session's user queries into primer vs. real. A session is "empty" when
 *  it received our hidden primer and never a real (non-primer) query. Pure. */
export function classifyUserQueries(chatHistoryJsonl: string): { primer: number; real: number } {
  let primer = 0;
  let real = 0;
  for (const q of extractUserQueries(chatHistoryJsonl)) {
    if (isPrimerText(q)) primer++;
    else real++;
  }
  return { primer, real };
}

export interface EmptyPrimerInput {
  /** A user rename means the session matters — never empty, whatever its content. */
  customName?: string;
  /** `num_messages` from summary.json (the cheap gate; a primer-only session is ~4). */
  numMessages: number;
  /** `session_summary` from summary.json (fallback signal when no chat history). */
  summary?: string;
  /** `generated_title` from summary.json (fallback signal when no chat history). */
  generatedTitle?: string;
  /** `chat_history.jsonl` contents — the authoritative signal when provided. */
  chatHistory?: string;
}

/** Decide whether a session is an empty, primer-only extension session safe to
 *  delete. Bulletproof when `chatHistory` is supplied: true iff the session got our
 *  primer and zero real user queries — so a session we didn't start (no primer) or
 *  one with any real turn is never flagged. Without chat history it falls back to
 *  the conservative title heuristic ({@link isPrimerSummary}) gated on a low message
 *  count. Pure. */
export function isEmptyPrimerSession(
  inp: EmptyPrimerInput,
  maxMessages = EMPTY_PRIMER_MAX_MESSAGES,
): boolean {
  if (inp.customName?.trim()) return false;
  // Chat history is authoritative: a session is empty iff it got our primer and
  // ZERO real user queries — regardless of message count. An *agentic* primer turn
  // can balloon to dozens of tool/reasoning messages with no real user query (and
  // grok re-primes on restore/compact), so `num_messages` must NOT veto the content
  // signal — that false-negative left such sessions (e.g. a 74-message primer-only
  // session) in history forever.
  if (typeof inp.chatHistory === "string") {
    const { primer, real } = classifyUserQueries(inp.chatHistory);
    return primer > 0 && real === 0;
  }
  // No chat history available — fall back to the conservative title heuristic, gated
  // on a low message count so a large real session can't be flagged on its title.
  if (inp.numMessages > maxMessages) return false;
  return isPrimerSummary(`${inp.summary ?? ""} ${inp.generatedTitle ?? ""}`);
}

/**
 * Recover a resumed session's context-token usage from grok's on-disk
 * `signals.json` (`contextTokensUsed`). `session/load` carries no token meta,
 * so without this every reopened tab (history rows, serializer-restored tabs
 * after a window reload) shows 0 in the context donut / status bar until the
 * next turn completes. Returns undefined when the file is missing (older grok
 * builds), unreadable, or carries no positive count. Pure.
 */
export function readSessionTokenUsage(deps: SessionDirDeps): number | undefined {
  const { fs, grokHome, cwd, id } = deps;
  const file = path.join(sessionsDirFor(grokHome, cwd), id, "signals.json");
  try {
    const used = JSON.parse(fs.readFileSync(file, "utf8"))?.contextTokensUsed;
    return typeof used === "number" && isFinite(used) && used > 0 ? used : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Best on-disk estimate of tokens a single session has used for this project:
 * current context (`contextTokensUsed`) plus tokens dropped by compaction
 * (`totalTokensBeforeCompaction`). Grok does not persist a full billable
 * input+output lifetime counter — this is the closest durable signal. Pure.
 */
export function sessionTokenEstimate(signals: {
  contextTokensUsed?: unknown;
  totalTokensBeforeCompaction?: unknown;
}): number {
  const ctx =
    typeof signals.contextTokensUsed === "number" && isFinite(signals.contextTokensUsed)
      ? Math.max(0, signals.contextTokensUsed)
      : 0;
  const compacted =
    typeof signals.totalTokensBeforeCompaction === "number" &&
    isFinite(signals.totalTokensBeforeCompaction)
      ? Math.max(0, signals.totalTokensBeforeCompaction)
      : 0;
  return ctx + compacted;
}

export interface WorkspaceTokenUsage {
  /** Sum of per-session estimates for every on-disk session under this cwd. */
  total: number;
  /** Per-session estimates (id → tokens) for live lift-up. */
  byId: Record<string, number>;
}

/**
 * Project lifetime token estimate: sum of every session's on-disk
 * `signals.json` estimate for this workspace cwd. Pure — no network, no
 * vscode. Missing/unreadable dirs contribute 0.
 */
export function readWorkspaceTokenUsage(deps: ListDeps | Omit<ListDeps, "overrides" | "now">): WorkspaceTokenUsage {
  const { fs, grokHome, cwd } = deps;
  const root = sessionsDirFor(grokHome, cwd);
  const byId: Record<string, number> = {};
  let total = 0;
  if (!fs.existsSync(root)) return { total: 0, byId };
  let names: string[] = [];
  try {
    names = fs.readdirSync(root);
  } catch {
    return { total: 0, byId };
  }
  for (const id of names) {
    const dir = path.join(root, id);
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
    } catch {
      continue;
    }
    const file = path.join(dir, "signals.json");
    try {
      if (!fs.existsSync(file)) continue;
      const n = sessionTokenEstimate(JSON.parse(fs.readFileSync(file, "utf8")) ?? {});
      if (n > 0) {
        byId[id] = n;
        total += n;
      }
    } catch {
      // skip unreadable / malformed
    }
  }
  return { total, byId };
}

/**
 * Lift the disk total with in-memory session context so a live turn that has
 * not flushed `signals.json` yet still counts. Pure.
 */
export function mergeWorkspaceTokenUsage(
  disk: WorkspaceTokenUsage,
  live: Iterable<{ id?: string | null; tokens?: number | null }>,
): number {
  let sum = disk.total;
  for (const s of live) {
    const id = s.id || undefined;
    const tokens = s.tokens;
    if (!id || typeof tokens !== "number" || !isFinite(tokens) || tokens < 0) continue;
    const prev = disk.byId[id] ?? 0;
    if (tokens > prev) sum += tokens - prev;
  }
  return sum;
}

/** Remove the on-disk session directory. No-op if missing. */
export function deleteSessionDir(deps: SessionDirDeps): void {
  const { fs, grokHome, cwd, id } = deps;
  const dir = path.join(sessionsDirFor(grokHome, cwd), id);
  if (!fs.existsSync(dir)) return;
  if (fs.rmSync) {
    fs.rmSync(dir, { recursive: true, force: true });
  } else {
    fs.rmdirSync(dir, { recursive: true });
  }
}

export interface ClearDeps {
  fs: FsLike;
  grokHome: string;
  cwd: string;
  /** Session ids to keep — every open panel's session (a live CLI re-persists its
   *  own session, so deleting one wouldn't stick; the tab would also go orphaned). */
  exceptIds?: Set<string>;
}

/** Remove every session directory under `cwd`, keeping the given ids. Returns the ids it removed.
 *  Best-effort: a directory that fails to remove is skipped, not thrown, so one locked dir doesn't
 *  abort the sweep. The directory name is the session id (mirrors `deleteSessionDir`). */
export function clearSessions(deps: ClearDeps): string[] {
  const { fs, grokHome, cwd, exceptIds } = deps;
  const dir = sessionsDirFor(grokHome, cwd);
  if (!fs.existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of entries) {
    if (exceptIds?.has(name)) continue;
    const full = path.join(dir, name);
    try {
      if (!fs.statSync(full).isDirectory()) continue;
    } catch {
      continue;
    }
    try {
      if (fs.rmSync) fs.rmSync(full, { recursive: true, force: true });
      else fs.rmdirSync(full, { recursive: true });
      removed.push(name);
    } catch {
      continue;
    }
  }
  return removed;
}

/** Default node fs adapter for production use. */
export const defaultFs: FsLike = {
  existsSync: nodeFs.existsSync,
  readdirSync: (p) => nodeFs.readdirSync(p) as string[],
  readFileSync: (p, enc) => nodeFs.readFileSync(p, enc),
  statSync: (p) => nodeFs.statSync(p),
  rmSync: (nodeFs as any).rmSync
    ? (p, opts) => (nodeFs as any).rmSync(p, opts)
    : undefined,
  rmdirSync: (p, opts) => nodeFs.rmdirSync(p, opts as any),
};

/** Resolve the grok home directory honoring HOME/USERPROFILE (matching cli-locator semantics). */
export function resolveGrokHome(env: NodeJS.ProcessEnv = process.env): string {
  const home = env.HOME || env.USERPROFILE || "";
  return path.join(home, ".grok");
}
