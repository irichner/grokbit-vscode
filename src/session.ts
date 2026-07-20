import type * as vscode from "vscode";
import { AcpClient } from "./acp";
import { FileChip } from "./chips";

/** Live state for the dashboard dot. `cold` (no live process) is represented by
 *  the absence of a Session, so it isn't in this union. */
export type SessionStatus = "idle" | "working" | "needs-you" | "done" | "error";

/**
 * All state that belongs to a single grok session — extracted from GrokSidebar so
 * the sidebar can hold a *pool* of these (one live `grok agent stdio` process per
 * session) and switch focus between them without tearing the others down.
 *
 * Today the sidebar keeps exactly one of these (the focused session). Steps C–F
 * add the pool, a per-session generation guard (`gen`), the webview post buffer,
 * and a derived `status` for the dashboard dots. For now this is a pure state bag
 * so the extraction is behavior-preserving (the field set + defaults mirror the
 * singletons it replaces 1:1).
 */
export class Session {
  /** The live ACP client (one spawned `grok agent stdio` process), once started. */
  client?: AcpClient;

  /** YOLO: auto-approve every permission request for this session. */
  autoApprove = false;

  /** Plan-mode gate is up for this session (client-side enforcement mirror). */
  planActive = false;

  /**
   * Deferred post-turn action. The CLI's exit_plan_mode arrives *during* an
   * in-flight session/prompt, so we can't send a new prompt/set_mode from the
   * approval handler — we'd collide with the running turn. We stash the action
   * here and run it once the current prompt resolves (see handleSend).
   */
  afterTurn?: () => Promise<void>;

  /**
   * True while handleSend owns the CLI turn lane (an in-flight session/prompt
   * and any chained afterTurn / queued follow-ups). A second user send while
   * this is set is queued (see pendingUserSends) rather than overlapping
   * client.prompt — the in-flight turn is NOT cancelled; the queue drains
   * FIFO after it fully completes.
   */
  promptInFlight = false;

  /**
   * User messages submitted while a turn was already running. Additive FIFO:
   * each entry is drained as its own sequential turn after the current one
   * finishes (no cancel, no last-wins). UI ack (user bubble + Grokking) is
   * deferred until the entry actually runs. Cleared on Stop/cancel so
   * abandoned follow-ups do not run. Drained without flashing idle (no
   * agentEnd between chained turns while the queue has work).
   */
  pendingUserSends: { text: string; finalPrompt: string; sentChips: FileChip[] }[] = [];

  /**
   * Drop remaining stream content from a cancelled turn (same content set as
   * plan-reject suppress) so lifecycle (promptComplete) can still finalize.
   * Ordinary mid-turn follow-up queueing does NOT set this — the current turn
   * keeps painting until it completes. Cleared when the next prompt starts or
   * the turn lane is released.
   */
  suppressTurnTail = false;

  /** This session has conversational history (vs. a fresh, empty one). */
  hasHistory = false;

  /**
   * True for the whole session-start window (spawn → newSession/load → primer).
   * Model/effort changes are settings that restart or race the session, so they
   * are ignored while priming — the webview also disables the controls (busy),
   * this is the host-side backstop for a click that slips through that window.
   */
  priming = false;

  /**
   * False until the hidden primer has been sent on THIS session load. The primer
   * is no longer sent at session start — it's deferred to the first outbound
   * prompt (ensurePrimed), so a startup or glance-only restore costs nothing.
   * It's (re-)sent on the first send of every load, new OR restored: a primer
   * buried in a restored session's replayed history isn't reliably honored by
   * grok (a /compact can drop it from effective context), so we re-assert it
   * once before the first post-restore turn rather than trusting history.
   */
  primed = false;

  /**
   * In-flight (or settled) hidden-primer turn for THIS session load, if one has
   * been kicked off. The primer now fires eagerly + non-blocking the moment a
   * session goes live (ensurePrimed in sidebar), so the user can send straight
   * away; their first real prompt awaits this promise (grok can't run two turns
   * at once) and is released the instant the silent primer acks. Reused so a
   * concurrent send doesn't start a second primer; cleared on failure so the
   * next send retries. undefined until the primer is first requested.
   */
  primingPromise?: Promise<void>;

  /** Drop streaming content from the webview (primer / summary injection). */
  suppressContent = false;

  /**
   * Plan-reject specific suppression: drop streaming output (the false-approval
   * ramble) but let lifecycle events through so the webview clears `busy` and
   * re-enables the send button when the cancelled turn finally ends.
   */
  suppressPlanReject = false;

  /** Live permission requests awaiting an answer, by request id. Set when the
   *  card is shown, read when the user answers so we can persist the resolved
   *  card (title + outcome) for replay on a resumed session, then deleted. */
  pendingPermissions = new Map<number | string, { title: string; toolCallId?: string; options: { optionId: string; kind: string }[] }>();

  /** Most recent plan text seen for this session (exit_plan_mode fallback). */
  lastPlanText = "";

  /**
   * Plan text currently shown in the live exit_plan_mode card. Set when we post
   * the card to the webview, read by persistPlanVerdict when the user picks a
   * verdict, then cleared. Decoupled from lastPlanText (which gets nuked the
   * moment we render the card) so the saved history actually has content.
   */
  pendingPlanText = "";

  /**
   * Count of user messages that have entered this session (replayed + live).
   * Persisted on each resolved plan as `afterUserMessage` so the resume view
   * can render plan cards inline with the conversation rather than at the end.
   */
  userMessageCount = 0;

  /**
   * True while a sequence of user_message_chunk events is mid-flight, so we
   * only increment userMessageCount once per user message during replay.
   */
  inUserMessage = false;

  /**
   * True only while replaying a resumed session (session/load). grok ≥0.2.33
   * echoes the *live* prompt back as user_message_chunk too, so this gates the
   * handler to replay-only — the live bubble already comes from send().
   */
  replaying = false;

  /** grok's id for this session (set on session/new or session/load). */
  activeSessionId?: string;

  /** Most recent user prompt text. Used to derive the live tab title and
   *  history row name (when there is no explicit user `customName` rename).
   *  Updated on every send so titles and history reflect each new prompt. */
  latestUserMessageForTitle?: string;

  /**
   * Per-session generation counter — bumped only when THIS session's client is
   * torn down/restarted. Replaces the old global `sessionGen`: in a pool a
   * backgrounded session's in-flight events must not be judged "stale" just
   * because focus moved to another session, so each session guards its own
   * events against its own gen (captured when its handlers were wired).
   */
  gen = 0;

  /** Derived status for the dashboard dot (see SessionStatus). */
  status: SessionStatus = "idle";

  /**
   * ms-epoch of the last time this session was made the focus, created, or put to
   * work — its "recency" for the pool's LRU/TTL reaping (see session-pool.ts).
   * 0 until the sidebar touches it (kept off the constructor so this stays a pure
   * state bag — the host stamps it via `touch`).
   */
  lastActiveAt = 0;

  /**
   * Every webview post that built this session's current view, in order. The
   * focused session flushes straight to the webview; a backgrounded session
   * buffers here, so re-focusing replays the buffer (clearMessages + replay)
   * to reconstruct the view losslessly — no grok reload, no process kill.
   */
  buffer: unknown[] = [];

  /**
   * This session's composer attachments. Per-session (not host-global) so each
   * chat keeps its own attachment list — two composers must never share one.
   */
  chips: FileChip[] = [];

  /**
   * The editor tab rendering this session, once opened (type-only vscode import
   * — this module stays runtime-pure so tests can import it without a VS Code
   * host). Undefined between panel dispose and the session's own teardown.
   */
  panel?: vscode.WebviewPanel;

  /**
   * True only between the panel webview's `{type:"ready"}` message and the next
   * hide or dispose (with retainContextWhenHidden:false a hidden webview is torn
   * down; its reveal re-runs the script and re-fires `ready`). Gates live
   * delivery — see panel-router.ts for the full contract.
   */
  ready = false;

  /**
   * Lazy-start marker: this session's panel exists but its grok process should
   * only spawn on the next reveal (`ready` consumes it). The value is the grok
   * session id to resume, or "" to start fresh. Set by the CLI-update respawn
   * (hidden tabs) and by serializer restore (background tabs), so N restored
   * tabs never spawn N processes at once.
   */
  pendingStart?: string;
}
