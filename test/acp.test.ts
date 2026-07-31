import { describe, it, expect, vi } from "vitest";
import { AcpClient, buildGrokAgentArgs } from "../src/acp";

// Unit tests for AcpClient internals that don't need a real subprocess. We
// stand up the client with a fake writable proc and drive `request`/`onLine`
// directly.
function clientWithFakeProc(): { client: AcpClient; written: string[] } {
  const client = new AcpClient({
    command: "x",
    args: [],
    cwd: "/",
    log: () => {},
    quirks: { clientPlanGate: true, mediaGen: true, xaiRequests: true },
  });
  const written: string[] = [];
  (client as any).proc = {
    killed: false,
    stdin: { writable: true, write: (s: string) => written.push(s) },
  };
  return { client, written };
}

describe("AcpClient.request timer lifecycle", () => {
  it("clears the per-request timeout when the response arrives (no leaked timer)", async () => {
    vi.useFakeTimers();
    try {
      const { client } = clientWithFakeProc();
      const before = vi.getTimerCount();

      const p = (client as any).request("session/set_mode", { modeId: "plan" }); // id = 1
      expect(vi.getTimerCount()).toBe(before + 1); // timeout armed

      (client as any).onLine(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }));
      await p;

      expect(vi.getTimerCount()).toBe(before); // timeout cleared on response
    } finally {
      vi.useRealTimers();
    }
  });
});

// A stale `grok.defaultModel` (the retired `grok-build`, renamed to `grok-4.5`
// in grok ≥0.2.9x) must not take the session start down: the eager set_model on
// newSession would otherwise reject with -32602 "unknown model id", surfacing as
// "Failed to start Grok: Invalid params". The guard skips set_model when the id
// isn't in this build's model list.
describe("AcpClient.newSession set_model guard", () => {
  const NEW_RESULT = (id: number) => ({
    jsonrpc: "2.0",
    id,
    result: {
      sessionId: "s1",
      models: {
        currentModelId: "grok-4.5",
        availableModels: [
          { modelId: "grok-4.5", name: "Grok 4.5" },
          { modelId: "grok-composer-2.5-fast", name: "Composer 2.5" },
        ],
      },
    },
  });
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const sentSetModel = (written: string[]) =>
    written.some((w) => w.includes('"session/set_model"'));

  it("does NOT send set_model for a configured model absent from the list", async () => {
    const { client, written } = clientWithFakeProc();
    const p = client.newSession("grok-build"); // stale legacy id, no longer offered
    (client as any).onLine(JSON.stringify(NEW_RESULT(1)));
    await tick();
    await p; // resolves cleanly, no rejection
    expect(sentSetModel(written)).toBe(false);
    expect(client.currentModelId).toBe("grok-4.5"); // kept the CLI default
  });

  it("still sends set_model for a known model that differs from the current one", async () => {
    const { client, written } = clientWithFakeProc();
    const p = client.newSession("grok-composer-2.5-fast"); // offered, != current
    (client as any).onLine(JSON.stringify(NEW_RESULT(1)));
    await tick();
    expect(sentSetModel(written)).toBe(true);
    (client as any).onLine(
      JSON.stringify({ jsonrpc: "2.0", id: 2, result: { _meta: { model: { Ok: "grok-composer-2.5-fast" } } } }),
    );
    await p;
  });
});

// The media-gen tracking (mediaGenCallIds / isMediaGenToolCall /
// extractGeneratedMediaPaths, all inside emitToolMedia) is grok-only —
// gated by quirks.mediaGen (see src/backends.ts BackendQuirks.mediaGen). A
// Claude-shaped descriptor passes mediaGen: false, and this whole path-in-JSON
// detection must be structurally inert for it.
describe("AcpClient quirks.mediaGen gating (emitToolMedia)", () => {
  function clientWithQuirks(mediaGen: boolean): AcpClient {
    return new AcpClient({
      command: "x",
      args: [],
      cwd: "/",
      log: () => {},
      quirks: { clientPlanGate: true, mediaGen, xaiRequests: true },
    });
  }

  // grok's /imagine result: an initial titled tool_call ("imagine: …") followed
  // by a completed update (title null) whose content carries the path as JSON
  // text — see extractGeneratedMediaPaths. Both calls route through
  // emitToolMedia, exactly as handleSessionUpdate does for toolCall/toolCallUpdate.
  const initialCall = { toolCallId: "tc-media-1", title: "imagine: a sunset" };
  const completedUpdate = {
    toolCallId: "tc-media-1",
    title: null,
    content: [{ type: "content", content: { type: "text", text: JSON.stringify({ path: "/tmp/images/1.jpg" }) } }],
  };

  it("mediaGen=true: recognizes the media-gen call and extracts the generated path", () => {
    const client = clientWithQuirks(true);
    const media: unknown[] = [];
    client.on("mediaContent", (m) => media.push(m));

    (client as any).emitToolMedia(initialCall);
    (client as any).emitToolMedia(completedUpdate);

    expect(media).toEqual([{ media: "image", kind: "path", path: "/tmp/images/1.jpg" }]);
  });

  it("mediaGen=false: the grok-only path-in-JSON detection never fires", () => {
    const client = clientWithQuirks(false);
    const media: unknown[] = [];
    client.on("mediaContent", (m) => media.push(m));

    (client as any).emitToolMedia(initialCall);
    (client as any).emitToolMedia(completedUpdate);

    expect(media).toEqual([]);
  });
});

// #3/#4 (thanks @shugav for the crash report): the startup crash was the bogus
// `max` value, not reasoningEffort itself — grok accepts none|minimal|low|medium|
// high|xhigh, and the flag must precede the `stdio` subcommand.
describe("buildGrokAgentArgs", () => {
  it("starts ACP sessions with the stdio subcommand when no effort is set", () => {
    expect(buildGrokAgentArgs()).toEqual(["agent", "stdio"]);
  });

  it("forwards a valid effort as --reasoning-effort before the stdio subcommand", () => {
    expect(buildGrokAgentArgs("high")).toEqual(["agent", "--reasoning-effort", "high", "stdio"]);
    expect(buildGrokAgentArgs("none")).toEqual(["agent", "--reasoning-effort", "none", "stdio"]);
    expect(buildGrokAgentArgs("xhigh")).toEqual(["agent", "--reasoning-effort", "xhigh", "stdio"]);
  });
});
