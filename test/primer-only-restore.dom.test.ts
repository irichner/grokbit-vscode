// Resuming a lingering primer-only session (opened + primed but never
// messaged) replays nothing visible — every turn is the hidden primer's. The
// webview must keep the welcome screen up so the tab reads as a fresh session,
// not a completely blank pane (the original symptom: appendUserChunk cleared
// the welcome BEFORE the primer-suppression check, so the suppressed replay
// left a void). Companion host-side rule: startSession treats a zero
// real-user-message replay as still-new (hasHistory=false), so closing the tab
// recycles the session dir (#24) instead of letting it linger forever.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, Harness, Posted } from "./webview-harness";

const PRIMER = "[grok-build-vscode primer v4]\n\n## HIDDEN PRIMER\n\nThis is a system message.";

function replay(h: Harness, turns: Posted[]): void {
  const seq: Posted[] = [
    { type: "clearMessages" },
    { type: "setBusy", value: true, locked: true },
    { type: "historyReplay", active: true },
    ...turns,
    { type: "historyReplay", active: false },
    { type: "setBusy", value: false },
  ];
  for (const m of seq) dispatch(h.window, m);
}

function visibleMessages(h: Harness): Element[] {
  const messages = h.doc.getElementById("messages") as HTMLElement;
  return Array.from(messages.children).filter((c) => c.id !== "welcome");
}

describe("primer-only session restore", () => {
  it("keeps the welcome screen when the whole replay is suppressed", () => {
    const h = bootWebview({ ready: false });
    replay(h, [
      { type: "userMessageChunk", text: PRIMER },
      { type: "thoughtChunk", text: "hidden primer received" },
      { type: "messageChunk", text: "ok" },
      // Re-primed on an earlier resume — a lingering session accumulates these.
      { type: "userMessageChunk", text: PRIMER },
      { type: "messageChunk", text: "ok" },
    ]);
    const welcome = h.doc.getElementById("welcome") as HTMLElement;
    expect(visibleMessages(h).length).toBe(0);
    expect(welcome.hidden).toBe(false); // NOT a blank pane
  });

  it("still clears the welcome when the replay has real content", () => {
    const h = bootWebview({ ready: false });
    replay(h, [
      { type: "userMessageChunk", text: PRIMER },
      { type: "messageChunk", text: "ok" },
      { type: "userMessageChunk", text: "fix the login bug" },
      { type: "messageChunk", text: "Done — patched auth.ts." },
    ]);
    const welcome = h.doc.getElementById("welcome") as HTMLElement;
    const html = (h.doc.getElementById("messages") as HTMLElement).innerHTML;
    expect(welcome.hidden).toBe(true);
    expect(html).toContain("fix the login bug");
    expect(html).toContain("auth.ts");
    expect(html).not.toContain("HIDDEN PRIMER");
  });
});
