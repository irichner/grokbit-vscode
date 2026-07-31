// Unit tests for the pure dashboard-dot policy. (The old selectReapable time/LRU
// reaping policy is retired with the native-tab UI — an open tab is user-owned
// and never silently killed; the process count is soft-bounded in sidebar.ts.)
import { describe, it, expect } from "vitest";
import { computeDot, shouldRecycleEmptySession } from "../src/session-pool";

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

// docs/plans/claude-code-backend.md § WP5 — the empty-primer-session recycle
// (#24) is grok-only; a closed Claude tab must never be swept, empty or not.
describe("shouldRecycleEmptySession — the empty-primer-session recycle-on-close policy (#24)", () => {
  const empty = { hasHistory: false, hasAfterTurn: false, busy: false, renamed: false };

  it("recycles an untouched, empty, idle, unrenamed session when the backend has emptyPrimerSweep", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: true, ...empty })).toBe(true);
  });

  it("a Claude tab (emptyPrimerSweep: false) is NEVER recycled, even when empty — the whole point of #WP5", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: false, ...empty })).toBe(false);
    // Still false no matter how "recyclable" every other flag looks — the
    // backend flag alone must gate it off for Claude.
    expect(shouldRecycleEmptySession({
      emptyPrimerSweep: false, hasHistory: false, hasAfterTurn: false, busy: false, renamed: false,
    })).toBe(false);
  });

  it("a grok session with real history is never recycled", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: true, ...empty, hasHistory: true })).toBe(false);
  });

  it("a grok session with a deferred afterTurn action is never recycled", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: true, ...empty, hasAfterTurn: true })).toBe(false);
  });

  it("a grok session still working/needs-you is never recycled", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: true, ...empty, busy: true })).toBe(false);
  });

  it("a renamed grok session is never recycled — a rename signals keep-intent", () => {
    expect(shouldRecycleEmptySession({ emptyPrimerSweep: true, ...empty, renamed: true })).toBe(false);
  });
});
