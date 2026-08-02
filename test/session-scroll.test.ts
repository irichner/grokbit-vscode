import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Session } from "../src/session";
import {
  applyScrollStateMessage,
  buildPanelReplayEnvelope,
  pickScrollRestore,
  resetSessionScrollMemory,
} from "../src/session-scroll";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("Session scroll memory defaults", () => {
  it("defaults to pinned at scrollTop 0", () => {
    const s = new Session();
    expect(s.scrollStickToBottom).toBe(true);
    expect(s.scrollTop).toBe(0);
  });
});

describe("applyScrollStateMessage", () => {
  it("coerces stick and non-finite scrollTop", () => {
    const s = { scrollStickToBottom: true, scrollTop: 0 };
    applyScrollStateMessage(s, { stickToBottom: 0, scrollTop: "nope" });
    expect(s.scrollStickToBottom).toBe(false);
    expect(s.scrollTop).toBe(0);

    applyScrollStateMessage(s, { stickToBottom: true, scrollTop: -12 });
    expect(s.scrollStickToBottom).toBe(true);
    expect(s.scrollTop).toBe(0);

    applyScrollStateMessage(s, { stickToBottom: false, scrollTop: 420.5 });
    expect(s.scrollStickToBottom).toBe(false);
    expect(s.scrollTop).toBe(420.5);
  });
});

describe("resetSessionScrollMemory", () => {
  it("restores pin defaults", () => {
    const s = { scrollStickToBottom: false, scrollTop: 999 };
    resetSessionScrollMemory(s);
    expect(s.scrollStickToBottom).toBe(true);
    expect(s.scrollTop).toBe(0);
  });
});

describe("pickScrollRestore", () => {
  it("returns null when pinned (default pin-to-bottom)", () => {
    expect(pickScrollRestore({ scrollStickToBottom: true, scrollTop: 50 })).toBeNull();
  });

  it("returns mid payload when unpinned", () => {
    expect(pickScrollRestore({ scrollStickToBottom: false, scrollTop: 300 })).toEqual({
      stickToBottom: false,
      scrollTop: 300,
    });
  });
});

describe("buildPanelReplayEnvelope", () => {
  it("orders begin then end message types", () => {
    const mid = { scrollStickToBottom: false, scrollTop: 80 };
    const env = buildPanelReplayEnvelope(mid);
    expect(env.begin.type).toBe("beginPanelReplay");
    expect(env.begin.restore).toEqual({ stickToBottom: false, scrollTop: 80 });
    expect(env.end.type).toBe("endPanelReplay");

    const pin = buildPanelReplayEnvelope({ scrollStickToBottom: true, scrollTop: 0 });
    expect(pin.begin.restore).toBeNull();
  });
});

describe("startSession wiring (source-text)", () => {
  it("calls resetSessionScrollMemory next to buffer clear", () => {
    const src = read("../src/sidebar.ts");
    expect(src).toMatch(/resetSessionScrollMemory/);
    // Choke point: buffer wiped and scroll memory reset in the same start path
    const startIdx = src.indexOf("private async startSession");
    expect(startIdx).toBeGreaterThan(-1);
    const chunk = src.slice(startIdx, startIdx + 800);
    expect(chunk).toMatch(/session\.buffer\s*=\s*\[\]/);
    expect(chunk).toMatch(/resetSessionScrollMemory\s*\(\s*session\s*\)/);
  });
});
