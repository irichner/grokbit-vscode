import { describe, it, expect } from "vitest";
import {
  clearImplicitChips,
  makeExplicitChip,
  makeImplicitChip,
  removeChip,
  toggleChip,
} from "../src/chips";
import { Session } from "../src/session";

describe("chips", () => {
  it("creates an implicit chip with a stable id", () => {
    const c = makeImplicitChip("/abs/path/foo.ts", "foo.ts");
    expect(c.id).toBe("implicit:/abs/path/foo.ts");
    expect(c.hidden).toBe(false);
    expect(c.selectionStart).toBeUndefined();
  });

  it("creates an explicit chip with a unique id and selection range", () => {
    const c1 = makeExplicitChip("/a.ts", "a.ts", 1, 10);
    const c2 = makeExplicitChip("/a.ts", "a.ts", 1, 10);
    expect(c1.selectionStart).toBe(1);
    expect(c1.selectionEnd).toBe(10);
    expect(c1.id).not.toBe(c2.id); // Date.now suffix makes them unique
  });

  it("removeChip removes by id", () => {
    const a = makeImplicitChip("/a", "a");
    const b = makeImplicitChip("/b", "b");
    const result = removeChip([a, b], a.id);
    expect(result).toEqual([b]);
  });

  it("toggleChip flips hidden without mutating", () => {
    const a = makeImplicitChip("/a", "a");
    const result = toggleChip([a], a.id);
    expect(result[0].hidden).toBe(true);
    expect(a.hidden).toBe(false); // original untouched
    const back = toggleChip(result, a.id);
    expect(back[0].hidden).toBe(false);
  });

  it("toggleChip leaves other chips alone", () => {
    const a = makeImplicitChip("/a", "a");
    const b = makeImplicitChip("/b", "b");
    const result = toggleChip([a, b], a.id);
    expect(result[0].hidden).toBe(true);
    expect(result[1].hidden).toBe(false);
  });

  it("clearImplicitChips removes only implicit ones", () => {
    const imp = makeImplicitChip("/a", "a");
    const exp = makeExplicitChip("/b", "b");
    const result = clearImplicitChips([imp, exp]);
    expect(result).toEqual([exp]);
  });
});

// Chips moved from a host-global list onto each Session so every composer keeps
// its own attachments. The invariant that matters (and would regress silently if
// chips ever became shared/static again): mutating one session's list — adding,
// removing, or the send path's clear — never touches another session's.
describe("per-session chips isolation", () => {
  it("two sessions' chip lists are independent", () => {
    const a = new Session();
    const b = new Session();
    a.chips.push(makeExplicitChip("/a.ts", "a.ts"));
    expect(a.chips).toHaveLength(1);
    expect(b.chips).toHaveLength(0);

    b.chips.push(makeImplicitChip("/b.ts", "b.ts"));
    b.chips = removeChip(b.chips, b.chips[0].id);
    expect(a.chips).toHaveLength(1); // untouched by b's remove
  });

  it("the send path's clear empties only the sending session", () => {
    const sender = new Session();
    const other = new Session();
    sender.chips.push(makeExplicitChip("/s.ts", "s.ts"));
    other.chips.push(makeExplicitChip("/o.ts", "o.ts"));
    sender.chips = []; // what handleSend does after building the prompt
    expect(sender.chips).toHaveLength(0);
    expect(other.chips).toHaveLength(1);
  });
});
