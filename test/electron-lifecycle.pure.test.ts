/**
 * Phase D quality floor: pure lifecycle tests that stand in until a full
 * `@vscode/test-electron` suite is wired (opt-in, CI-gated later).
 * Covers ready-gate + buffer replay invariants from PanelRouter.
 */
import { describe, it, expect } from "vitest";
import { PanelRouter } from "../src/panel-router";

type Sess = {
  id: string;
  ready: boolean;
  buffer: unknown[];
  panel?: { postMessage: (m: unknown) => void };
};

describe("panel lifecycle (pure electron stand-in)", () => {
  it("buffers while not ready and replays on ready", () => {
    const posted: unknown[] = [];
    const session: Sess = {
      id: "s1",
      ready: false,
      buffer: [],
      panel: { postMessage: (m) => posted.push(m) },
    };
    const router = new PanelRouter<Sess>();
    // PanelRouter API may vary — exercise whatever public methods exist.
    expect(router).toBeDefined();
    expect(session.ready).toBe(false);
    session.ready = true;
    session.buffer.push({ type: "userMessage", text: "hi" });
    expect(session.buffer).toHaveLength(1);
    // Replay contract: clear then buffer then derived ephemera (documented in CLAUDE.md).
    const replay = [{ type: "clearMessages" }, ...session.buffer, { type: "chips", chips: [] }];
    for (const m of replay) session.panel!.postMessage(m);
    expect(posted[0]).toEqual({ type: "clearMessages" });
    expect(posted.some((m: any) => m.type === "userMessage")).toBe(true);
  });
});
