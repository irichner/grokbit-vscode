/**
 * Pure session↔panel routing core for the native-tab UI. Each grok session
 * renders in its own webview panel; this module owns the delivery rules the
 * whole architecture leans on, behind a minimal `{ postMessage }` port that a
 * real `vscode.WebviewPanel`'s webview satisfies and a test stub satisfies too
 * (same pure-module discipline as session-pool.ts).
 *
 * The three delivery intents (adjudicated per message type in sidebar.ts):
 *  - `emit`      — buffered chat content. Always appended to the session's
 *                  replay buffer; delivered live only while the panel is ready.
 *                  Content emitted while hidden is never lost — the next reveal
 *                  replays the buffer (`replayInto`).
 *  - `postTo`    — transient, one panel. Dropped when the panel isn't ready,
 *                  BY DESIGN: only replies to webview-initiated requests (the
 *                  panel is visible by construction) and safe-to-drop ephemera
 *                  whose current value is re-derived on replay may use it.
 *  - `broadcast` — global state, every ready panel (the host adds the launcher).
 *
 * `ready` is true only between a webview's `{type:"ready"}` message and the next
 * hide or dispose. With `retainContextWhenHidden:false` a hidden webview is torn
 * down and its next reveal re-runs the script, which re-fires `ready` — that's
 * what drives the replay. Flipping that flag to `true` silently breaks this
 * contract (`ready` would never re-fire); see the plan-mode research notes
 * before turning that dial.
 */

/** What the router needs from a panel: just a message sink. */
export interface PanelPort {
  postMessage(message: unknown): unknown;
}

/** What the router needs from a session: the ready gate + the replay buffer. */
export interface RoutableSession {
  ready: boolean;
  buffer: unknown[];
}

export class PanelRouter<S extends RoutableSession> {
  private readonly ports = new Map<S, PanelPort>();

  /**
   * Session ids with an open-a-panel operation in flight. Shared by EVERY entry
   * point that can materialize a panel for an id — launcher click, dropdown
   * click, `openTabForId`, serializer restore — so two racing opens for the
   * same session can't produce two panels.
   */
  private readonly opening = new Set<string>();

  /** Attach a panel's message port to a session (panel creation / restore). */
  bind(session: S, port: PanelPort): void {
    this.ports.set(session, port);
  }

  /** Detach on panel dispose. The session is no longer routable (and not ready). */
  unbind(session: S): void {
    this.ports.delete(session);
    session.ready = false;
  }

  isBound(session: S): boolean {
    return this.ports.has(session);
  }

  /** The webview signalled `ready` — live delivery may begin. */
  markReady(session: S): void {
    session.ready = true;
  }

  /** The panel was hidden — its webview is torn down; stop live delivery. */
  markHidden(session: S): void {
    session.ready = false;
  }

  /** Buffered chat content: always buffer, deliver only while ready.
   *  `clearMessages` resets the buffer (a replay issues its own clear). */
  emit(session: S, message: { type?: string }): void {
    if (message.type === "clearMessages") session.buffer = [];
    else session.buffer.push(message);
    if (session.ready) this.ports.get(session)?.postMessage(message);
  }

  /** Transient one-panel post: dropped when the panel isn't ready, by design. */
  postTo(session: S, message: unknown): void {
    if (session.ready) this.ports.get(session)?.postMessage(message);
  }

  /** Global state: every ready panel. */
  broadcast(message: unknown): void {
    for (const [session, port] of this.ports) {
      if (session.ready) port.postMessage(message);
    }
  }

  /**
   * Rebuild a panel's view after a (re)reveal: clear, replay the buffer, then
   * post the DERIVED per-session transients last (mode, chips — they aren't
   * buffered, so stale flips can never replay; the caller passes the current
   * values). No-op when the session has no bound panel.
   */
  replayInto(session: S, derived: unknown[] = []): void {
    const port = this.ports.get(session);
    if (!port) return;
    port.postMessage({ type: "clearMessages" });
    for (const m of session.buffer) port.postMessage(m);
    for (const m of derived) port.postMessage(m);
  }

  /**
   * Claim the open-in-flight slot for a session id. Returns false when another
   * entry point is already opening it (the caller should back off). Callers
   * must `endOpen` in a finally.
   */
  beginOpen(id: string): boolean {
    if (this.opening.has(id)) return false;
    this.opening.add(id);
    return true;
  }

  endOpen(id: string): void {
    this.opening.delete(id);
  }
}
