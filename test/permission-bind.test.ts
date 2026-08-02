import { describe, it, expect } from "vitest";
import {
  BIND_BLOCKED_TERMINAL_MSG,
  BIND_BLOCKED_WRITE_MSG,
  consumeTerminalGrant,
  consumeWriteGrant,
  extractGrant,
  isAllowOptionKind,
  normalizeGrantPath,
  pushGrant,
  type PermissionGrant,
} from "../src/permission-bind";

describe("normalizeGrantPath", () => {
  it("unifies separators and lowercases Windows drive paths", () => {
    expect(normalizeGrantPath("C:\\Users\\x\\a.ts")).toBe("c:/users/x/a.ts");
    expect(normalizeGrantPath("C:/Users/x/a.ts")).toBe("c:/users/x/a.ts");
  });

  it("keeps POSIX case-sensitive", () => {
    expect(normalizeGrantPath("/Home/User/A.ts")).toBe("/Home/User/A.ts");
  });
});

describe("extractGrant", () => {
  it("extracts Claude write file_path", () => {
    const g = extractGrant(
      { toolCallId: "t1", rawInput: { file_path: "/w/a.ts", content: "x" } },
      "allow_once",
    );
    expect(g).toEqual({
      kind: "path",
      value: normalizeGrantPath("/w/a.ts"),
      durable: false,
      toolCallId: "t1",
    });
  });

  it("extracts edit old/new with file_path", () => {
    const g = extractGrant(
      { rawInput: { file_path: "/w/b.ts", old_string: "a", new_string: "b" } },
      "allow_once",
    );
    expect(g?.kind).toBe("path");
    expect(g?.value).toBe(normalizeGrantPath("/w/b.ts"));
  });

  it("extracts path field alias", () => {
    const g = extractGrant({ rawInput: { path: "/w/c.ts" } }, "allow_once");
    expect(g?.value).toBe(normalizeGrantPath("/w/c.ts"));
  });

  it("extracts command grants", () => {
    const g = extractGrant({ rawInput: { command: "npm  test" } }, "allow_once");
    expect(g).toEqual({
      kind: "command",
      value: "npm test",
      durable: false,
      toolCallId: undefined,
    });
  });

  it("allow_always is durable", () => {
    const g = extractGrant({ rawInput: { file_path: "/w/a.ts" } }, "allow_always");
    expect(g?.durable).toBe(true);
  });

  it("returns null for reject kinds", () => {
    expect(extractGrant({ rawInput: { file_path: "/w/a.ts" } }, "reject_once")).toBeNull();
  });

  it("returns null when no path or command", () => {
    expect(extractGrant({ rawInput: { foo: 1 } }, "allow_once")).toBeNull();
    expect(extractGrant(undefined, "allow_once")).toBeNull();
  });
});

describe("isAllowOptionKind", () => {
  it("accepts allow_* and rejects reject_*", () => {
    expect(isAllowOptionKind("allow_once")).toBe(true);
    expect(isAllowOptionKind("allow_always")).toBe(true);
    expect(isAllowOptionKind("reject_once")).toBe(false);
    expect(isAllowOptionKind("deny")).toBe(false);
  });
});

describe("consumeWriteGrant", () => {
  it("allows any write when no path grants", () => {
    const r = consumeWriteGrant("/other/x.ts", []);
    expect(r.ok).toBe(true);
    expect(r.grants).toEqual([]);
  });

  it("allows matching path and consumes allow_once", () => {
    const grants: PermissionGrant[] = [
      { kind: "path", value: normalizeGrantPath("/w/a.ts"), durable: false },
    ];
    const r = consumeWriteGrant("/w/a.ts", grants);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.grants).toEqual([]);
  });

  it("blocks mismatched path when grants exist", () => {
    const grants: PermissionGrant[] = [
      { kind: "path", value: normalizeGrantPath("/w/a.ts"), durable: false },
    ];
    const r = consumeWriteGrant("/w/b.ts", grants);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(BIND_BLOCKED_WRITE_MSG);
    expect(r.grants).toHaveLength(1);
  });

  it("keeps durable allow_always grants after match", () => {
    const grants: PermissionGrant[] = [
      { kind: "path", value: normalizeGrantPath("/w/a.ts"), durable: true },
    ];
    const r = consumeWriteGrant("/w/a.ts", grants);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.grants).toHaveLength(1);
      expect(r.grants[0].durable).toBe(true);
    }
  });

  it("matches Windows path forms", () => {
    const grants: PermissionGrant[] = [
      { kind: "path", value: normalizeGrantPath("C:\\proj\\a.ts"), durable: false },
    ];
    const r = consumeWriteGrant("c:/proj/a.ts", grants);
    expect(r.ok).toBe(true);
  });
});

describe("consumeTerminalGrant", () => {
  it("allows any command when no command grants", () => {
    expect(consumeTerminalGrant("rm -rf /", []).ok).toBe(true);
  });

  it("blocks mismatched command when grants exist", () => {
    const grants: PermissionGrant[] = [
      { kind: "command", value: "npm test", durable: false },
    ];
    const r = consumeTerminalGrant("npm run build", grants);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe(BIND_BLOCKED_TERMINAL_MSG);
  });

  it("matches normalized whitespace", () => {
    const grants: PermissionGrant[] = [
      { kind: "command", value: "npm test", durable: false },
    ];
    expect(consumeTerminalGrant("npm  test", grants).ok).toBe(true);
  });
});

describe("pushGrant", () => {
  it("no-ops on null", () => {
    expect(pushGrant([], null)).toEqual([]);
  });

  it("appends once grants", () => {
    const g: PermissionGrant = { kind: "path", value: "/a", durable: false };
    expect(pushGrant([], g)).toEqual([g]);
  });

  it("dedupes durable grants for same path", () => {
    const g: PermissionGrant = { kind: "path", value: "/a", durable: true };
    expect(pushGrant([g], g)).toEqual([g]);
  });
});
