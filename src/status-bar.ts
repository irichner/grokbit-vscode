// Pure builder for the VS Code status-bar HUD (roadmap item #2 — "Status-bar
// indicator: current model + effort + token usage"). The status bar is a global,
// always-visible surface, so it moves session state out of the webview-internal
// gear popover / mode button / context donut and onto a native VS Code affordance
// (the direction the fork is already taking). This module is framework-free (no
// `vscode` import) so it can be unit-tested like the other pure modules; the
// impure `GrokSidebar` gathers the live state and feeds it in.

/** The mode a session is in, as the UI labels it (see displayMode in sidebar). */
export type StatusMode = "agent" | "plan" | "yolo";

export interface StatusBarInputs {
  /** Is there an active session panel to describe? When false the item hides
   *  (unless a background session needs the user — see needsYouCount). */
  hasActive: boolean;
  /** Resolved model display name (e.g. "Grok Build"), already looked up from the
   *  client's model list. Empty/undefined falls back to a neutral label. */
  modelName?: string;
  /** grok.defaultEffort ("", "low", "medium", …). Empty = CLI default (hidden). */
  effort?: string;
  /** The active session's derived mode. */
  mode?: StatusMode;
  /** Tokens used so far in the active session's context (client.lastMeta). */
  usedTokens?: number;
  /** The active model's context ceiling (ModelInfo.totalContextTokens). */
  contextWindow?: number;
  /** The active session is mid-turn (status "working"). */
  working?: boolean;
  /** How many live sessions are waiting on the user (permission / question /
   *  plan-review). A global aggregate, not just the active session. */
  needsYouCount?: number;
}

export interface StatusBarView {
  /** Text with codicon markup, for StatusBarItem.text. */
  text: string;
  /** Plain multi-line tooltip. */
  tooltip: string;
  /** Whether the item should be visible at all. */
  show: boolean;
  /** Use the warning background (something needs the user). */
  warning: boolean;
}

const MODE_LABEL: Record<StatusMode, string> = {
  agent: "Agent",
  plan: "Plan",
  yolo: "Auto",
};

const MODE_TOOLTIP: Record<StatusMode, string> = {
  agent: "Agent",
  plan: "Plan — writes and commands blocked until you approve a plan",
  yolo: "Auto accept — every permission auto-approved",
};

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Compact "42K" style number for the status-bar text (tooltip shows exact). */
function toK(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return (k >= 100 ? Math.round(k) : Math.round(k * 10) / 10) + "K";
}

function contextPct(used?: number, max?: number): number | null {
  // A known zero renders as 0% (matches the donut); only an unknown count hides.
  if (used == null || !max || max <= 0) return null;
  return Math.min(100, Math.round((used / max) * 100));
}

/**
 * Build the status-bar view from the current active-session state. Pure — the
 * caller owns the StatusBarItem and just copies `text`/`tooltip`/visibility over.
 */
export function computeStatusBar(inputs: StatusBarInputs): StatusBarView {
  const needsYou = Math.max(0, inputs.needsYouCount ?? 0);
  const warning = needsYou > 0;

  // Nothing to show: no active chat and nobody waiting. Hide the item entirely
  // rather than parking a dead "Grokbit" label in the status bar.
  if (!inputs.hasActive && needsYou === 0) {
    return { text: "", tooltip: "", show: false, warning: false };
  }

  // A background session needs the user but no chat is active/focused — surface
  // the alert on its own so the click still leads somewhere useful.
  if (!inputs.hasActive) {
    const n = needsYou;
    return {
      text: `$(bell) Grokbit: ${n} waiting`,
      tooltip: `${n} Grok session${n === 1 ? "" : "s"} waiting for you.\nClick to open.`,
      show: true,
      warning: true,
    };
  }

  const model = (inputs.modelName || "").trim() || "Grok";
  const parts: string[] = [model];
  if (inputs.effort) parts.push(capitalize(inputs.effort));
  if (inputs.mode) parts.push(MODE_LABEL[inputs.mode]);
  const pct = contextPct(inputs.usedTokens, inputs.contextWindow);
  if (pct != null) parts.push(`${pct}%`);

  // Lead glyph reflects the active session's own state; the needs-you badge is a
  // separate trailing count because it aggregates every session, not just this one.
  const lead = inputs.working ? "$(loading~spin)" : "$(sparkle)";
  let text = `${lead} ${parts.join(" · ")}`;
  if (needsYou > 0) text += `  $(bell) ${needsYou}`;

  const tip: string[] = [`Grokbit — ${model}`];
  tip.push(`Effort: ${inputs.effort ? capitalize(inputs.effort) : "CLI default"}`);
  if (inputs.mode) tip.push(`Mode: ${MODE_TOOLTIP[inputs.mode]}`);
  if (pct != null) {
    tip.push(`Context: ${toK(inputs.usedTokens!)} / ${toK(inputs.contextWindow!)} (${pct}%)`);
  }
  tip.push(`Status: ${inputs.working ? "Working…" : "Idle"}`);
  if (needsYou > 0) {
    tip.push(`${needsYou} session${needsYou === 1 ? "" : "s"} waiting for you`);
  }
  tip.push("Click to open the active session");

  return { text, tooltip: tip.join("\n"), show: true, warning };
}
