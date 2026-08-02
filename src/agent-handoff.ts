/**
 * Pure helpers for cross-backend Agent switch handoff.
 * No vscode / fs — unit-tested without spawning either CLI.
 *
 * True shared ACP sessions across Grok/Claude stores are impossible; this
 * module builds a bounded text seed from the host UI buffer so the new agent
 * can continue the thread after a process restart.
 */

/** Soft cap for injected handoff text (chars). Tail is kept when cutting. */
export const AGENT_HANDOFF_MAX_CHARS = 48_000;

export type AgentHandoffBuildResult = {
  text: string;
  truncated: boolean;
  turnCount: number;
};

type BufMsg = {
  type?: string;
  text?: string;
  call?: { title?: string; kind?: string };
};

/**
 * Build a plain-text handoff transcript from a session UI buffer.
 * Coalesces consecutive `messageChunk`s into one Assistant turn; tool calls
 * become a single title line (no diffs/stdout).
 */
export function buildAgentHandoffText(
  buffer: unknown[],
  opts?: { maxChars?: number },
): AgentHandoffBuildResult {
  const lines: string[] = [];
  let agentBuf = "";
  let turnCount = 0;

  const flushAgent = (): void => {
    const t = agentBuf.trim();
    if (!t) {
      agentBuf = "";
      return;
    }
    lines.push(`Assistant: ${t}`);
    agentBuf = "";
    turnCount += 1;
  };

  for (const raw of buffer) {
    if (!raw || typeof raw !== "object") continue;
    const m = raw as BufMsg;
    switch (m.type) {
      case "userMessage": {
        flushAgent();
        if (typeof m.text === "string" && m.text.trim()) {
          lines.push(`User: ${m.text}`);
          turnCount += 1;
        }
        break;
      }
      case "messageChunk": {
        if (typeof m.text === "string") agentBuf += m.text;
        break;
      }
      case "toolCall": {
        flushAgent();
        const title =
          (m.call && (m.call.title || m.call.kind)) || "tool";
        lines.push(`Tool: ${title}`);
        break;
      }
      case "agentEnd":
      case "promptComplete":
        flushAgent();
        break;
      default:
        // setBusy, tokenUsage, chips, modeChanged, cards, etc. — skip
        break;
    }
  }
  flushAgent();

  const joined = lines.join("\n\n");
  const max = opts?.maxChars ?? AGENT_HANDOFF_MAX_CHARS;
  const fitted = fitHandoffText(joined, max);
  return { text: fitted.text, truncated: fitted.truncated, turnCount };
}

/** Keep the most recent portion of `text` when over `maxChars`. */
export function fitHandoffText(
  text: string,
  maxChars: number,
): { text: string; truncated: boolean } {
  if (maxChars <= 0) return { text: "", truncated: text.length > 0 };
  if (text.length <= maxChars) return { text, truncated: false };

  const marker = "[…earlier conversation truncated…]\n";
  const budget = Math.max(0, maxChars - marker.length);
  let slice = text.slice(text.length - budget);
  // Prefer starting on a line boundary so we don't open mid-word when cheap.
  const nl = slice.indexOf("\n");
  if (nl >= 0 && nl < Math.min(200, slice.length / 2)) {
    slice = slice.slice(nl + 1);
  }
  return { text: marker + slice, truncated: true };
}

/** Prefix for the suppressed inject prompt on the new backend. */
export function agentHandoffEnvelope(fromLabel: string): string {
  return `[Context from previous session — switched from ${fromLabel}]\n`;
}

/** Empty-session flips discard the old id; history flips never do. */
export function shouldDiscardAfterBackendFlip(hadHistory: boolean): boolean {
  return !hadHistory;
}

/**
 * When non-null, the host should refuse the flip and show the message.
 * Same-backend / priming are handled by the caller before this.
 */
export function shouldBlockBackendFlip(opts: {
  promptInFlight: boolean;
  pendingPermissionCount: number;
}): string | null {
  if (opts.promptInFlight || opts.pendingPermissionCount > 0) {
    return "Finish the current turn (or answer any pending prompts) before switching agents.";
  }
  return null;
}

/** Banner copy for the webview after a successful handoff inject. */
export function agentSwitchContextBannerText(
  targetLabel: string,
  truncated: boolean,
): string {
  const base = `Switched to ${targetLabel} — prior conversation applied`;
  return truncated ? `${base} (truncated)` : base;
}
