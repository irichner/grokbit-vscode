// Unit tests for the pure dashboard-dot policy. (The old selectReapable time/LRU
// reaping policy is retired with the native-tab UI — an open tab is user-owned
// and never silently killed; the process count is soft-bounded in sidebar.ts.)
import { describe, it, expect } from "vitest";
import { computeDot } from "../src/session-pool";

describe("computeDot — the dashboard dot color", () => {
  it("live status wins: working → working, needs-you → needs-you", () => {
    expect(computeDot({ liveStatus: "working" })).toBe("working");
    expect(computeDot({ liveStatus: "needs-you" })).toBe("needs-you");
    // ...even if the session is also flagged unread.
    expect(computeDot({ liveStatus: "working", unread: true })).toBe("working");
    expect(computeDot({ liveStatus: "needs-you", unread: true, unreadError: true })).toBe("needs-you");
  });

  it("unread (no blocking live state) → green, or red if it errored", () => {
    expect(computeDot({ liveStatus: "done", unread: true })).toBe("unread");
    expect(computeDot({ liveStatus: "done", unread: true, unreadError: true })).toBe("error");
    // unread survives with no live status at all (tab closed but still unread).
    expect(computeDot({ unread: true })).toBe("unread");
    expect(computeDot({ unread: true, unreadError: true })).toBe("error");
  });

  it("everything at rest collapses to none (gray)", () => {
    expect(computeDot({})).toBe("none");
    expect(computeDot({ liveStatus: "idle" })).toBe("none");
    expect(computeDot({ liveStatus: "done" })).toBe("none"); // done but read (not unread)
    expect(computeDot({ liveStatus: "error" })).toBe("none"); // errored but read
    expect(computeDot({ unread: false })).toBe("none");
  });
});
