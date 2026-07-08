// Unit tests for the session↔panel routing core (native-tab UI). These are the
// delivery rules the whole architecture leans on; a regression here loses chat
// content silently:
//   - emit while hidden buffers, and the next replay delivers it (nothing lost)
//   - postTo to a not-ready panel drops, BY DESIGN (transients only)
//   - broadcast reaches all ready panels and skips hidden ones
//   - replayInto posts clear → buffer → DERIVED transients last
//   - the shared `opening` set dedupes concurrent open attempts per session id
import { describe, it, expect } from "vitest";
import { PanelRouter, PanelPort, RoutableSession } from "../src/panel-router";

interface S extends RoutableSession {
  name: string;
}

const makeSession = (name: string): S => ({ name, ready: false, buffer: [] });

function makePort(): PanelPort & { posted: any[] } {
  const posted: any[] = [];
  return { posted, postMessage: (m: unknown) => posted.push(m) };
}

describe("PanelRouter.emit — buffer always, deliver only while ready", () => {
  it("buffers while hidden and delivers nothing", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.emit(s, { type: "messageChunk", text: "hello" });
    expect(s.buffer).toEqual([{ type: "messageChunk", text: "hello" }]);
    expect(port.posted).toEqual([]);
  });

  it("delivers live once ready, still buffering", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.markReady(s);
    router.emit(s, { type: "messageChunk", text: "hi" });
    expect(port.posted).toEqual([{ type: "messageChunk", text: "hi" }]);
    expect(s.buffer).toHaveLength(1);
  });

  it("content emitted while hidden is never lost — the reveal replays it", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.markReady(s);
    router.emit(s, { type: "userMessage", text: "q" });
    router.markHidden(s); // tab hidden mid-turn
    router.emit(s, { type: "messageChunk", text: "answer" });
    router.emit(s, { type: "agentEnd" });
    expect(port.posted).toHaveLength(1); // only the pre-hide message went live

    port.posted.length = 0;
    router.markReady(s); // reveal → webview re-fired ready
    router.replayInto(s);
    expect(port.posted).toEqual([
      { type: "clearMessages" },
      { type: "userMessage", text: "q" },
      { type: "messageChunk", text: "answer" },
      { type: "agentEnd" },
    ]);
  });

  it("clearMessages resets the buffer", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    router.bind(s, makePort());
    router.emit(s, { type: "messageChunk", text: "old" });
    router.emit(s, { type: "clearMessages" });
    expect(s.buffer).toEqual([]);
  });
});

describe("PanelRouter.postTo — transient, drops on not-ready by design", () => {
  it("drops when the panel is hidden/not-ready", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.postTo(s, { type: "chips", chips: [] });
    expect(port.posted).toEqual([]);
    expect(s.buffer).toEqual([]); // and never buffers
  });

  it("delivers when ready", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.markReady(s);
    router.postTo(s, { type: "modeChanged", modeId: "plan" });
    expect(port.posted).toEqual([{ type: "modeChanged", modeId: "plan" }]);
    expect(s.buffer).toEqual([]);
  });
});

describe("PanelRouter.broadcast — all ready panels, hidden ones skipped", () => {
  it("reaches every ready panel and no hidden one", () => {
    const router = new PanelRouter<S>();
    const a = makeSession("a");
    const b = makeSession("b");
    const c = makeSession("c");
    const pa = makePort();
    const pb = makePort();
    const pc = makePort();
    router.bind(a, pa);
    router.bind(b, pb);
    router.bind(c, pc);
    router.markReady(a);
    router.markReady(c);
    router.broadcast({ type: "cliUpdating" });
    expect(pa.posted).toEqual([{ type: "cliUpdating" }]);
    expect(pb.posted).toEqual([]); // hidden — its reveal rebuilds from scratch
    expect(pc.posted).toEqual([{ type: "cliUpdating" }]);
  });
});

describe("PanelRouter.replayInto — derived state last", () => {
  it("posts clear, then the buffer in order, then the derived transients", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.emit(s, { type: "userMessage", text: "q" });
    router.replayInto(s, [
      { type: "modeChanged", modeId: "yolo" },
      { type: "chips", chips: ["x"] },
    ]);
    expect(port.posted).toEqual([
      { type: "clearMessages" },
      { type: "userMessage", text: "q" },
      { type: "modeChanged", modeId: "yolo" },
      { type: "chips", chips: ["x"] },
    ]);
  });

  it("is a no-op for an unbound session", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    expect(() => router.replayInto(s)).not.toThrow();
  });
});

describe("PanelRouter — bind/unbind lifecycle", () => {
  it("unbind stops delivery and clears ready", () => {
    const router = new PanelRouter<S>();
    const s = makeSession("a");
    const port = makePort();
    router.bind(s, port);
    router.markReady(s);
    router.unbind(s);
    expect(s.ready).toBe(false);
    router.emit(s, { type: "messageChunk", text: "late" });
    expect(port.posted).toEqual([]);
    expect(s.buffer).toHaveLength(1); // the session's record survives its panel
  });
});

describe("PanelRouter.opening — shared open-attempt dedupe", () => {
  it("the second concurrent open for the same id backs off", () => {
    const router = new PanelRouter<S>();
    expect(router.beginOpen("id-1")).toBe(true);
    expect(router.beginOpen("id-1")).toBe(false); // launcher click racing a restore
    expect(router.beginOpen("id-2")).toBe(true); // other ids unaffected
    router.endOpen("id-1");
    expect(router.beginOpen("id-1")).toBe(true); // freed after the first completes
  });
});
