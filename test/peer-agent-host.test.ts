import { describe, it, expect, vi } from "vitest";
import { PeerRunner } from "../src/peer-agent-host";

describe("PeerRunner", () => {
  it("returns readiness error without calling runPeerSession", async () => {
    const runPeerSession = vi.fn();
    const runner = new PeerRunner({
      enabled: () => false,
      isBackendAvailable: () => true,
      liveSessionCount: () => 1,
      maxLiveSessions: 8,
      runPeerSession,
    });
    const r = await runner.run({ prompt: "hi", parentBackend: "grok" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/disabled/i);
    expect(runPeerSession).not.toHaveBeenCalled();
  });

  it("runs peer and returns fitted text", async () => {
    const runner = new PeerRunner({
      enabled: () => true,
      isBackendAvailable: (id) => id === "claude",
      liveSessionCount: () => 1,
      maxLiveSessions: 8,
      runPeerSession: async ({ target, prompt }) => {
        expect(target).toBe("claude");
        expect(prompt).toContain("nested peer");
        expect(prompt).toContain("do the thing");
        return { text: "peer done" };
      },
    });
    const r = await runner.run({ prompt: "do the thing", parentBackend: "grok" });
    expect(r).toEqual({ ok: true, text: "peer done", target: "claude" });
  });

  it("maps AbortError to timeout-style failure", async () => {
    const runner = new PeerRunner({
      enabled: () => true,
      isBackendAvailable: () => true,
      liveSessionCount: () => 0,
      maxLiveSessions: 8,
      timeoutMs: 5_000,
      runPeerSession: async () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        throw e;
      },
    });
    const r = await runner.run({ prompt: "x", parentBackend: "claude" });
    expect(r.ok).toBe(false);
    expect(r.target).toBe("grok");
    expect(r.error).toMatch(/timed out/i);
  });
});
