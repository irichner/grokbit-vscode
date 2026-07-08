// DOM-level test of the permission card's INLINE diff (#21 + the diff-tab
// focus-steal loop) — drives the REAL shipped media/chat.js in a happy-dom
// window. It seeds the edit diff (via the toolCallUpdate the host posts),
// renders the permission card, and asserts the webview now:
//   - renders the diff INSIDE the card (del/add rows) the moment it appears,
//   - never posts `openDiff` — a diff must not open an editor tab: the
//     auto-opened tab covered the chat webview, whose reveal-replay re-rendered
//     the pending card and re-opened the tab, so closing it brought it straight
//     back and clicking away bounced focus to it,
//   - still resolves the permission with the same requestId.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const DIFF = { type: "diff", path: "src/foo.ts", oldText: "a\nb", newText: "a\nB\nc" };

function seedDiffAndCard(window: any, requestId: number | string = 7, diff: any = DIFF) {
  // The host posts the edit content as a toolCallUpdate; chat.js stashes it in
  // pendingDiffByToolCallId keyed by toolCallId.
  dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "tc1", content: [diff] } });
  dispatch(window, {
    type: "permissionRequest",
    req: {
      id: requestId,
      toolCall: { toolCallId: "tc1", kind: "edit", title: "Edit src/foo.ts" },
      options: [
        { optionId: "allow", name: "Allow once", kind: "allow_once" },
        { optionId: "rej", name: "Reject", kind: "reject_once" },
      ],
    },
  });
}

// "same:a" / "del:b" — type prefix + text, for compact row assertions.
function diffRows(scope: Element): string[] {
  return [...scope.querySelectorAll(".inline-diff .diff-line")].map(
    (el) => `${[...el.classList].find((c) => c !== "diff-line")}:${el.textContent}`,
  );
}

describe("permission card inline diff (real chat.js in a DOM)", () => {
  it("renders the diff inside the card and never posts openDiff", () => {
    const { window, posted, doc } = bootWebview();
    seedDiffAndCard(window, 7);

    const card = doc.querySelector(".card.permission");
    expect(card).not.toBeNull();
    expect(card!.querySelector(".card-subtitle")!.textContent).toContain("src/foo.ts");

    expect(diffRows(card!)).toEqual(["same:a", "del:b", "add:B", "add:c"]);
    // No host round-trip: an editor tab would cover the chat webview and the
    // reveal-replay would reopen it in a loop.
    expect(posted.filter((m: any) => m.type === "openDiff")).toHaveLength(0);
  });

  it("a replay (clearMessages + re-post, what every tab reveal does) re-renders the card without any host side effect", () => {
    const { window, posted, doc } = bootWebview();
    seedDiffAndCard(window, 7);

    // retainContextWhenHidden:false → each reveal rebuilds the webview and the
    // host replays the buffer: clear, then the buffered messages again.
    dispatch(window, { type: "clearMessages" });
    seedDiffAndCard(window, 7);

    const cards = doc.querySelectorAll(".card.permission");
    expect(cards).toHaveLength(1);
    expect(diffRows(cards[0])).toEqual(["same:a", "del:b", "add:B", "add:c"]);
    expect(posted.filter((m: any) => m.type === "openDiff")).toHaveLength(0);
  });

  it("collapses long unchanged runs behind a clickable gap", () => {
    const ctx = Array.from({ length: 20 }, (_, i) => `ctx ${i}`);
    const bigDiff = {
      type: "diff",
      path: "src/foo.ts",
      oldText: ["start", ...ctx, "end"].join("\n"),
      newText: ["START", ...ctx, "END"].join("\n"),
    };
    const { window, doc } = bootWebview();
    seedDiffAndCard(window, 8, bigDiff);

    const diffEl = doc.querySelector(".card.permission .inline-diff")!;
    // 4 changed rows + 3 context lines on each side of the gap.
    expect(diffEl.querySelectorAll(".diff-line")).toHaveLength(10);
    const gap = diffEl.querySelector(".diff-gap") as HTMLButtonElement;
    expect(gap).not.toBeNull();
    expect(gap.textContent).toContain("14 unchanged lines");

    click(window, gap);
    expect(diffEl.querySelectorAll(".diff-line")).toHaveLength(24);
    expect(diffEl.querySelector(".diff-gap")).toBeNull();
  });

  it("answering carries the same requestId so the host can resolve the request", () => {
    const { window, posted, doc } = bootWebview();
    seedDiffAndCard(window, 11);

    const allow = [...doc.querySelectorAll(".card.permission .card-actions button")]
      .find((b) => b.textContent === "Allow once") as HTMLButtonElement;
    click(window, allow);

    const answer = posted.find((m: any) => m.type === "permissionAnswer");
    expect(answer).toEqual({ type: "permissionAnswer", requestId: 11, optionId: "allow" });
  });

  it("renders no diff block when the permission has none (e.g. a command)", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, {
      type: "permissionRequest",
      req: {
        id: 12,
        toolCall: { toolCallId: "tc-exec", kind: "execute", title: "Run npm test" },
        options: [{ optionId: "allow", name: "Allow once", kind: "allow_once" }],
      },
    });

    expect(doc.querySelector(".card.permission")).not.toBeNull();
    expect(doc.querySelector(".card.permission .inline-diff")).toBeNull();
    expect(posted.filter((m: any) => m.type === "openDiff")).toHaveLength(0);
  });
});
