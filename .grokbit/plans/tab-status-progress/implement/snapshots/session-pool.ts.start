import { SessionStatus } from "./session";

/**
 * Pure dashboard-dot policy for the session launcher (and each panel's history
 * dropdown). The old time/LRU reaping policy that used to live here is retired:
 * with the native-tab UI every live session is a visible, user-owned editor tab,
 * and silently killing a tab's process is confusing — the process count is now
 * soft-bounded instead (a one-time warning past MAX_LIVE_SESSIONS in sidebar.ts;
 * lazy start keeps hidden tabs from spawning at all).
 */

/**
 * The visible dot for one history row (Agent Dashboard). Pure so the policy can be
 * unit-tested without a process pool. Precedence:
 *   working → needs-you → unread (error? → error) → none (gray default).
 *
 * `working`/`needs-you` come from the live session's `status`; `unread`/`error`
 * come from a *persisted* flag set when a turn finishes while the session isn't
 * visible, and cleared when it's opened — so green/red survive both a closed tab
 * and a reload (they aren't tied to the live process). Everything else — idle,
 * already read, cold, loaded-from-disk — collapses to `none`, a single gray
 * "at rest".
 */
export type Dot = "working" | "needs-you" | "unread" | "error" | "none";

export function computeDot(opts: {
  liveStatus?: SessionStatus;
  unread?: boolean;
  unreadError?: boolean;
}): Dot {
  if (opts.liveStatus === "working") return "working";
  if (opts.liveStatus === "needs-you") return "needs-you";
  if (opts.unread) return opts.unreadError ? "error" : "unread";
  return "none";
}

/**
 * Should a just-closed tab's on-disk session be recycled (deleted) — grok's
 * empty-primer-session cleanup (#24: abandoning an untouched "New session"
 * must not pile primer sessions into history)? `emptyPrimerSweep` is the
 * backend's own quirk flag (`BackendSpec.quirks.emptyPrimerSweep` in
 * `backends.ts`) — Claude never receives the hidden primer, so it has no
 * "empty primer-only" session to recycle in the first place, and a closed
 * Claude tab (empty or not) always keeps its history
 * (docs/plans/claude-code-backend.md § WP5). Pure so the policy — not just the
 * quirk *value* — is unit-tested directly, mirroring {@link computeDot};
 * `sidebar.ts`'s `onPanelClosed` is the only caller (impure: globalState read,
 * disk delete, timers).
 */
export function shouldRecycleEmptySession(opts: {
  emptyPrimerSweep: boolean;
  hasHistory: boolean;
  hasAfterTurn: boolean;
  busy: boolean;
  renamed: boolean;
}): boolean {
  return opts.emptyPrimerSweep && !opts.hasHistory && !opts.hasAfterTurn && !opts.busy && !opts.renamed;
}
