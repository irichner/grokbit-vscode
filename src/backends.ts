/**
 * Backend descriptors — the single place that knows how Grok Build and Claude
 * Code differ. Everything else in the extension (the spawn parameterisation in
 * `acp.ts`, and the eventual `startSession` branch in `sidebar.ts` — see
 * docs/plans/claude-code-backend.md § WP3) reads a `BackendSpec` instead of
 * scattering `if (backend === "grok")` checks through the codebase. Pure, no
 * `vscode` import, so it is unit-testable without an extension host — see
 * `cli-locator.ts`/`claude-locator.ts` for the same split between pure policy
 * and impure spawn/search glue.
 */

export type BackendId = "grok" | "claude";

/**
 * grok's `--reasoning-effort` accepts exactly these six values (see
 * `buildGrokAgentArgs` below); the bogus `max` this extension used to expose
 * made grok exit with code 2 (#3/#4). Kept as the name existing code already
 * imports from `./acp` (`session.ts`, `sidebar.ts`) — `acp.ts` re-exports it
 * from here rather than duplicating the definition.
 */
export type EffortLevel = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

/** grok's effort levels, ordered least → most. */
export const GROK_EFFORT_LEVELS: readonly EffortLevel[] = ["none", "minimal", "low", "medium", "high", "xhigh"];

/**
 * Claude has no reasoning-effort concept at all: verified against the adapter,
 * its only thinking knob is `MAX_THINKING_TOKENS`, read from env at spawn —
 * there is no `--reasoning-effort`-shaped CLI flag to offer values for. Modeled
 * honestly as an empty level set rather than inventing one that doesn't exist;
 * a later work package may map UI effort dots onto thinking-token budgets (see
 * the plan's "per-tab settings" § prerequisite), but that mapping is not part
 * of this backend descriptor.
 */
export const CLAUDE_EFFORT_LEVELS: readonly EffortLevel[] = [];

/**
 * Grok-only client behaviours this extension must never apply to a Claude
 * session — Claude enforces plan mode and permissions for real, has its own
 * auth/versioning story, and never emits grok's `x.ai/*` extension methods or
 * `/imagine` media-gen tool calls. Every quirk is a named flag here so the
 * gating lives in one place instead of scattered `if (backend === …)` checks
 * (see docs/plans/claude-code-backend.md § Risks). `false` for every flag on
 * the Claude descriptor is a structural guarantee, not an assumption the rest
 * of the code has to remember.
 */
export interface BackendQuirks {
  /** grok only — the hidden plan-mode primer (`src/grok-primer.ts`). */
  planPrimer: boolean;
  /**
   * Client-side plan-mode enforcement of `fs/write_text_file` + `terminal/create`
   * (`src/plan-gate.ts`). True for both backends: Grok needs it because
   * `exit_plan_mode` is unreliable; Claude gets the same fs/terminal backstop
   * for parity (Phase A). Does **not** control permission pre-reject or plan
   * restore — those stay on `clientPlanPermissionReject`.
   */
  clientPlanGate: boolean;
  /**
   * grok only — auto-reject mutating `session/request_permission` while the
   * plan gate is up, and the resume-time plan-mode override driven by saved
   * plan verdicts. Off for Claude so native plan UX and genuine
   * `current_mode_update` replay are not clobbered.
   */
  clientPlanPermissionReject: boolean;
  /** grok only — the Windows `agent stdio` broken-build version pin (#22). */
  windowsVersionPin: boolean;
  /** grok only — the empty-primer-session sweep (#24). */
  emptyPrimerSweep: boolean;
  /** grok only — `/imagine`/`/imagine-video` generated-media tool-call tracking. */
  mediaGen: boolean;
  /** grok only — `x.ai/ask_user_question`, `x.ai/exit_plan_mode`. */
  xaiRequests: boolean;
}

export interface BackendSpec {
  id: BackendId;
  /** Human label — "Grok Build" | "Claude Code". */
  label: string;
  /**
   * Mode ids this agent uses for the Agent/Plan picker entries. Auto-accept
   * ("YOLO") stays client-side for both backends — it's already a local
   * auto-answer of permission requests (`session.autoApprove`), not an ACP
   * mode, so it needs no per-backend mapping here (see the plan's
   * Architecture § 1).
   */
  modes: { agent: string; plan: string };
  quirks: BackendQuirks;
  /**
   * Reasoning-effort levels this backend accepts, least → most effort. Empty
   * when the backend has no effort axis at all (Claude — see
   * `CLAUDE_EFFORT_LEVELS`). Typed `EffortLevel[]`, not the wider `string[]`,
   * so a reader of `backendSpec(id).effortLevels` keeps grok's `EffortLevel`
   * narrowing instead of losing it through this field.
   */
  effortLevels: readonly EffortLevel[];
}

export const GROK_BACKEND: BackendSpec = {
  id: "grok",
  label: "Grok Build",
  // The CLI's non-plan mode id is "default" (not "agent") — see CLAUDE.md § ACP
  // surfaces implemented.
  modes: { agent: "default", plan: "plan" },
  quirks: {
    planPrimer: true,
    clientPlanGate: true,
    clientPlanPermissionReject: true,
    windowsVersionPin: true,
    emptyPrimerSweep: true,
    mediaGen: true,
    xaiRequests: true,
  },
  effortLevels: GROK_EFFORT_LEVELS,
};

export const CLAUDE_BACKEND: BackendSpec = {
  id: "claude",
  label: "Claude Code",
  // Verified wire findings (research/claude-code-backend.md): the adapter's
  // non-plan mode id is also "default"; Claude's other modes (acceptEdits,
  // dontAsk, bypassPermissions) fall outside Grokbit's three-entry picker.
  modes: { agent: "default", plan: "plan" },
  quirks: {
    planPrimer: false,
    // Phase A: fs/terminal plan backstop on; permission pre-reject + grok
    // plan-restore override stay off.
    clientPlanGate: true,
    clientPlanPermissionReject: false,
    windowsVersionPin: false,
    emptyPrimerSweep: false,
    mediaGen: false,
    xaiRequests: false,
  },
  effortLevels: CLAUDE_EFFORT_LEVELS,
};

export const BACKENDS: Record<BackendId, BackendSpec> = {
  grok: GROK_BACKEND,
  claude: CLAUDE_BACKEND,
};

/** Look up a backend's descriptor by id. */
export function backendSpec(id: BackendId): BackendSpec {
  return BACKENDS[id];
}

/**
 * Pure argv construction for spawning `grok agent stdio`. `--reasoning-effort`
 * is an `agent`-level flag, so it must precede the `stdio` subcommand (after
 * `stdio` the CLI errors "unexpected argument"). Only the values grok actually
 * accepts are offered (see `GROK_EFFORT_LEVELS`); the bogus `max` this
 * extension used to expose made grok exit with code 2 (#3/#4). Re-exported
 * from `./acp` for the existing call sites/tests that import it from there —
 * see docs/plans/claude-code-backend.md § WP2.
 */
export function buildGrokAgentArgs(effort?: EffortLevel): string[] {
  return effort ? ["agent", "--reasoning-effort", effort, "stdio"] : ["agent", "stdio"];
}
