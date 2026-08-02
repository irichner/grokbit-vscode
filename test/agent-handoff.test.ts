import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  AGENT_HANDOFF_MAX_CHARS,
  agentHandoffEnvelope,
  agentSwitchContextBannerText,
  buildAgentHandoffText,
  fitHandoffText,
  shouldBlockBackendFlip,
  shouldDiscardAfterBackendFlip,
} from "../src/agent-handoff";

describe("buildAgentHandoffText", () => {
  it("returns empty for an empty buffer", () => {
    const r = buildAgentHandoffText([]);
    expect(r.text).toBe("");
    expect(r.truncated).toBe(false);
    expect(r.turnCount).toBe(0);
  });

  it("formats user messages and coalesces consecutive messageChunks", () => {
    const r = buildAgentHandoffText([
      { type: "userMessage", text: "fix the login bug" },
      { type: "messageChunk", text: "Looking at " },
      { type: "messageChunk", text: "auth.ts…" },
      { type: "agentEnd" },
      { type: "userMessage", text: "also add tests" },
      { type: "messageChunk", text: "Will do." },
    ]);
    expect(r.text).toContain("User: fix the login bug");
    expect(r.text).toContain("Assistant: Looking at auth.ts…");
    expect(r.text).toContain("User: also add tests");
    expect(r.text).toContain("Assistant: Will do.");
    expect(r.turnCount).toBe(4);
    expect(r.truncated).toBe(false);
  });

  it("emits tool title lines only (no raw dumps)", () => {
    const r = buildAgentHandoffText([
      { type: "userMessage", text: "edit it" },
      { type: "toolCall", call: { title: "Edit auth.ts", kind: "edit" } },
      { type: "messageChunk", text: "Done." },
    ]);
    expect(r.text).toContain("Tool: Edit auth.ts");
    expect(r.text).not.toContain("old_string");
  });

  it("ignores chrome / unknown buffer types", () => {
    const r = buildAgentHandoffText([
      { type: "setBusy", value: true },
      { type: "tokenUsage", totalTokens: 12 },
      { type: "userMessage", text: "hi" },
      { type: "chips", chips: [] },
      { type: "mysteryFutureEvent", payload: 1 },
    ]);
    expect(r.text).toBe("User: hi");
    expect(r.turnCount).toBe(1);
  });

  it("tail-truncates when over maxChars", () => {
    const longAssistant = "x".repeat(500);
    const r = buildAgentHandoffText(
      [
        { type: "userMessage", text: "old topic" },
        { type: "messageChunk", text: longAssistant },
        { type: "userMessage", text: "recent ask" },
        { type: "messageChunk", text: "recent answer" },
      ],
      { maxChars: 80 },
    );
    expect(r.truncated).toBe(true);
    expect(r.text.length).toBeLessThanOrEqual(80);
    expect(r.text).toContain("truncated");
    // recent content should survive a tail keep
    expect(r.text).toMatch(/recent/);
  });
});

describe("fitHandoffText", () => {
  it("is a no-op under the budget", () => {
    expect(fitHandoffText("abc", 10)).toEqual({ text: "abc", truncated: false });
  });

  it("exports a positive default budget constant", () => {
    expect(AGENT_HANDOFF_MAX_CHARS).toBeGreaterThan(1000);
  });
});

describe("backend flip policy helpers", () => {
  it("discards only empty (no-history) sessions after flip", () => {
    expect(shouldDiscardAfterBackendFlip(false)).toBe(true);
    expect(shouldDiscardAfterBackendFlip(true)).toBe(false);
  });

  it("blocks mid-turn and pending permissions", () => {
    expect(shouldBlockBackendFlip({ promptInFlight: false, pendingPermissionCount: 0 })).toBeNull();
    expect(shouldBlockBackendFlip({ promptInFlight: true, pendingPermissionCount: 0 })).toMatch(/Finish/);
    expect(shouldBlockBackendFlip({ promptInFlight: false, pendingPermissionCount: 2 })).toMatch(/Finish/);
  });

  it("builds envelope and banner copy", () => {
    expect(agentHandoffEnvelope("Grok Build")).toContain("switched from Grok Build");
    expect(agentSwitchContextBannerText("Claude Code", false)).toBe(
      "Switched to Claude Code — prior conversation applied",
    );
    expect(agentSwitchContextBannerText("Claude Code", true)).toContain("truncated");
  });
});

describe("host source contract — lose-history modal removed", () => {
  it("sidebar switchBackend no longer claims history can't carry over", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/sidebar.ts"),
      "utf8",
    );
    expect(src).not.toMatch(/History can't carry over between backends/);
    // handoff module is wired
    expect(src).toMatch(/agent-handoff/);
    expect(src).toMatch(/buildAgentHandoffText/);
  });
});
