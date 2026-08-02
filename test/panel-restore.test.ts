import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  activeSessionIdForStart,
  decidePanelRestore,
  isUsableSessionId,
} from "../src/panel-restore";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("isUsableSessionId", () => {
  it("rejects undefined, empty, and whitespace", () => {
    expect(isUsableSessionId(undefined)).toBe(false);
    expect(isUsableSessionId("")).toBe(false);
    expect(isUsableSessionId("   ")).toBe(false);
  });
  it("accepts a real id", () => {
    expect(isUsableSessionId("abc-123")).toBe(true);
  });
});

describe("decidePanelRestore", () => {
  it("missing/empty id → dispose-orphan", () => {
    expect(
      decidePanelRestore({ alreadyOpen: false, panelVisible: true }),
    ).toEqual({ action: "dispose-orphan", reason: "missing-id" });
    expect(
      decidePanelRestore({ id: "", alreadyOpen: false, panelVisible: true }),
    ).toEqual({ action: "dispose-orphan", reason: "missing-id" });
  });

  it("whitespace id treated as missing", () => {
    expect(
      decidePanelRestore({ id: "  \t  ", alreadyOpen: false, panelVisible: false }),
    ).toEqual({ action: "dispose-orphan", reason: "missing-id" });
  });

  it("alreadyOpen → reveal-existing", () => {
    expect(
      decidePanelRestore({
        id: "s1",
        backend: "claude",
        alreadyOpen: true,
        panelVisible: true,
      }),
    ).toEqual({ action: "reveal-existing" });
  });

  it("id + visible → resume spawn now + backend default grok", () => {
    expect(
      decidePanelRestore({ id: "s1", alreadyOpen: false, panelVisible: true }),
    ).toEqual({
      action: "resume",
      id: "s1",
      backend: "grok",
      spawn: "now",
    });
  });

  it("id + backend claude + not visible → resume pending", () => {
    expect(
      decidePanelRestore({
        id: "s-claude",
        backend: "claude",
        alreadyOpen: false,
        panelVisible: false,
      }),
    ).toEqual({
      action: "resume",
      id: "s-claude",
      backend: "claude",
      spawn: "pending",
    });
  });

  it("trims id on resume", () => {
    expect(
      decidePanelRestore({
        id: "  s2  ",
        alreadyOpen: false,
        panelVisible: true,
      }),
    ).toMatchObject({ action: "resume", id: "s2" });
  });
});

describe("activeSessionIdForStart", () => {
  it("resume keeps id; new clears", () => {
    expect(activeSessionIdForStart("resume-me")).toBe("resume-me");
    expect(activeSessionIdForStart("  resume-me  ")).toBe("resume-me");
    expect(activeSessionIdForStart(undefined)).toBeUndefined();
    expect(activeSessionIdForStart("")).toBeUndefined();
    expect(activeSessionIdForStart("   ")).toBeUndefined();
  });
});

describe("startSession identity (source-text)", () => {
  it("assigns activeSessionId via activeSessionIdForStart (not unconditional undefined)", () => {
    const src = read("../src/sidebar.ts");
    const fnIdx = src.indexOf("private async startSession(session: Session");
    expect(fnIdx).toBeGreaterThan(-1);
    const body = src.slice(fnIdx, fnIdx + 2500);
    expect(body).toMatch(/activeSessionIdForStart\s*\(/);
    // Must not wipe id with a bare unconditional assignment that ignores resumeId
    // while still allowing activeSessionIdForStart(resumeId).
    expect(body).toMatch(/session\.activeSessionId\s*=\s*activeSessionIdForStart\s*\(\s*resumeId\s*\)/);
  });
});

describe("restorePanel wires decidePanelRestore (source-text)", () => {
  it("calls decidePanelRestore and does not use empty-string pendingStart new-session pattern", () => {
    const src = read("../src/sidebar.ts");
    const fnIdx = src.indexOf("async restorePanel(panel:");
    expect(fnIdx).toBeGreaterThan(-1);
    const body = src.slice(fnIdx, fnIdx + 2200);
    expect(body).toMatch(/decidePanelRestore\s*\(/);
    // Old silent new-session path for missing id
    expect(body).not.toMatch(/pendingStart\s*=\s*id\s*\?\?\s*""/);
  });
});
