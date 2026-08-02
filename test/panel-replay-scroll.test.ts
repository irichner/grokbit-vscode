import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildPanelReplayEnvelope,
  pickScrollRestore,
} from "../src/session-scroll";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("buildPanelReplayEnvelope", () => {
  it("emits begin then end types; mid vs pin restore", () => {
    const mid = buildPanelReplayEnvelope({ scrollStickToBottom: false, scrollTop: 120 });
    expect(mid.begin.type).toBe("beginPanelReplay");
    expect(mid.end.type).toBe("endPanelReplay");
    expect(mid.begin.restore).toEqual({ stickToBottom: false, scrollTop: 120 });

    const pin = buildPanelReplayEnvelope({ scrollStickToBottom: true, scrollTop: 0 });
    expect(pin.begin.restore).toBeNull();
    expect(pickScrollRestore({ scrollStickToBottom: true, scrollTop: 0 })).toBeNull();
  });
});

describe("GrokSidebar.replayInto wire order (source-text)", () => {
  it("posts beginPanelReplay before router.replayInto and endPanelReplay in finally", () => {
    const src = read("../src/sidebar.ts");
    const fnIdx = src.indexOf("private replayInto(session: Session)");
    expect(fnIdx).toBeGreaterThan(-1);
    // Bound the method body roughly
    const body = src.slice(fnIdx, fnIdx + 900);
    expect(body).toMatch(/buildPanelReplayEnvelope\s*\(\s*session\s*\)/);
    expect(body).toMatch(/beginPanelReplay|begin\b/);
    expect(body).toMatch(/this\.postTo\s*\(\s*session\s*,\s*begin\s*\)/);
    const beginPost = body.indexOf("this.postTo(session, begin)");
    const routerCall = body.indexOf("this.router.replayInto");
    const finallyIdx = body.indexOf("finally");
    const endPost = body.indexOf("this.postTo(session, end)");
    expect(beginPost).toBeGreaterThan(-1);
    expect(routerCall).toBeGreaterThan(beginPost);
    expect(finallyIdx).toBeGreaterThan(routerCall);
    expect(endPost).toBeGreaterThan(finallyIdx);
  });
});
