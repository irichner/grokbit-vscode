/**
 * Pure policy for WebviewPanel serializer restore after a window reload.
 * No vscode imports — unit-tested without the extension host.
 *
 * See `.grokbit/plans/session-tab-window-restore/` and CLAUDE.md § Native tabs.
 */

import type { BackendId } from "./backends";

/** Inputs for a single deserializer / restorePanel decision. */
export interface PanelRestoreInput {
  /** Session id from webview `setState`, if any. */
  id?: string;
  /** Backend from webview state; missing → grok default. */
  backend?: BackendId;
  /** Another panel is already bound to this id. */
  alreadyOpen: boolean;
  /** Restored panel is currently visible (spawn now vs pendingStart). */
  panelVisible: boolean;
}

export type PanelRestoreDecision =
  | { action: "reveal-existing" }
  | { action: "resume"; id: string; backend: BackendId; spawn: "now" | "pending" }
  | { action: "dispose-orphan"; reason: "missing-id" };

/** True when `id` is usable as a resume target (non-empty after trim). */
export function isUsableSessionId(id: string | undefined | null): id is string {
  return typeof id === "string" && id.trim().length > 0;
}

/**
 * Decide how to handle a serializer-restored panel.
 * - already open → reveal existing (caller disposes the duplicate panel)
 * - missing/blank id → dispose orphan (never silent new session)
 * - else resume with backend default grok; spawn now if visible else pending
 */
export function decidePanelRestore(input: PanelRestoreInput): PanelRestoreDecision {
  const id = isUsableSessionId(input.id) ? input.id.trim() : undefined;
  if (!id) {
    return { action: "dispose-orphan", reason: "missing-id" };
  }
  if (input.alreadyOpen) {
    return { action: "reveal-existing" };
  }
  const backend: BackendId = input.backend === "claude" ? "claude" : "grok";
  return {
    action: "resume",
    id,
    backend,
    spawn: input.panelVisible ? "now" : "pending",
  };
}

/**
 * Which `activeSessionId` to keep at the top of `startSession`.
 * Resume keeps the id for the whole spawn/load window so open-tab checks work;
 * a brand-new session clears until `session/new` assigns one.
 */
export function activeSessionIdForStart(resumeId?: string): string | undefined {
  return isUsableSessionId(resumeId) ? resumeId.trim() : undefined;
}
