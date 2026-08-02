/**
 * Pure helpers for session-tab scroll memory (hide→reveal restore).
 * No vscode imports — unit-tested without the extension host.
 */

/** Minimal shape so Session and plain test objects both work. */
export interface ScrollMemory {
  scrollStickToBottom: boolean;
  scrollTop: number;
}

/** Payload the webview applies after a panel buffer rebuild. */
export type ScrollRestore =
  | null
  | { stickToBottom: true }
  | { stickToBottom: false; scrollTop: number };

/** Reset host memory to “pinned” (fresh session / startSession choke point). */
export function resetSessionScrollMemory(session: ScrollMemory): void {
  session.scrollStickToBottom = true;
  session.scrollTop = 0;
}

/**
 * Apply a webview `scrollState` message onto host memory.
 * Coerces bad inputs so a malformed post never stores NaN.
 */
export function applyScrollStateMessage(
  session: ScrollMemory,
  msg: { stickToBottom?: unknown; scrollTop?: unknown },
): void {
  session.scrollStickToBottom = !!msg.stickToBottom;
  const n = typeof msg.scrollTop === "number" ? msg.scrollTop : Number(msg.scrollTop);
  session.scrollTop = Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * Build the restore payload for beginPanelReplay.
 * Defaults / pin → null (webview treats as pin-to-bottom).
 * Mid-scroll → explicit unpinned offset.
 */
export function pickScrollRestore(session: ScrollMemory): ScrollRestore {
  if (session.scrollStickToBottom) return null;
  return { stickToBottom: false, scrollTop: session.scrollTop };
}

/**
 * Ordered bookends around router.replayInto.
 * Caller posts begin, runs clear+buffer+derived, then posts end (prefer finally).
 */
export function buildPanelReplayEnvelope(session: ScrollMemory): {
  begin: { type: "beginPanelReplay"; restore: ScrollRestore };
  end: { type: "endPanelReplay" };
} {
  return {
    begin: { type: "beginPanelReplay", restore: pickScrollRestore(session) },
    end: { type: "endPanelReplay" },
  };
}
