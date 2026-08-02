// DOM-level test for issue #30 — a permission that resolves to a *single* edit
// must stay expandable so its diff ("N → M lines" + "view diff") remains
// reviewable, both live and after a session restore. Drives the REAL shipped
// media/chat.js in a happy-dom window.
//
// Root cause guarded here: closeToolGroup() used to flatten ANY lone tool call
// into a `.tool-flat` (icon + label only — no chevron, no body), discarding the
// diff preview that attachDiffPreviewToToolItem appends to the tool-item in the
// body. A read+edit batch (≥2 calls) stayed an expandable `.tool-group`, so its
// diff survived — exactly the contrast the reporter saw. The fix keeps a lone
// edit as a group; these tests pin that in both orderings.
//
// The diff itself renders INLINE inside the tool item (never a separate editor
// tab — that tab covered the chat webview and its reveal-replay reopened it in
// a focus-stealing loop): "view diff" toggles the in-chat diff block.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

const DIFF = { type: "diff", path: "src/foo.ts", oldText: "a\nb", newText: "a\nB\nc" };
const EDIT_CALL = { toolCallId: "tc1", kind: "edit", title: "Edit src/foo.ts" };

// "same:a" / "del:b" — type prefix + text, for compact row assertions.
function diffRows(scope: Element): string[] {
  return [...scope.querySelectorAll(".inline-diff .diff-line")].map(
    (el) => `${[...el.classList].find((c) => c !== "diff-line")}:${el.textContent}`,
  );
}

describe("single-edit tool group stays expandable (#30)", () => {
  it("keeps a lone edit as an expandable group with its diff, not a flat row (live)", () => {
    const { window, posted, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: EDIT_CALL });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "tc1", content: [DIFF] } });
    // Close the open group without sealing the turn — intermediate tools are
    // destroyed on promptComplete (turn-container model). Diff review is a
    // mid-turn affordance.
    dispatch(window, { type: "messageChunk", text: "done" } as any);

    const group = doc.querySelector(".tool-group");
    expect(group).not.toBeNull(); // NOT collapsed into a bare `.tool-flat`
    expect(doc.querySelector(".tool-flat")).toBeNull();
    expect(group!.querySelector(".tool-chevron")).not.toBeNull(); // an expander exists

    const link = group!.querySelector(".tool-group-body .preview-link") as HTMLButtonElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain("view diff");
    expect(group!.querySelector(".tool-item-subtitle")!.textContent).toContain("2 → 3 lines");

    // The diff toggles open INLINE — no openDiff round-trip to the host (an
    // editor tab would cover the chat webview and replay would reopen it).
    click(window, link);
    expect(posted.filter((m: any) => m.type === "openDiff")).toHaveLength(0);
    const diffEl = group!.querySelector(".tool-item .inline-diff") as HTMLElement;
    expect(diffEl).not.toBeNull();
    expect(diffEl.hidden).toBe(false);
    expect(diffRows(group!)).toEqual(["same:a", "del:b", "add:B", "add:c"]);
    expect(link.textContent).toContain("hide diff");

    click(window, link); // toggle back off — the block hides, nothing is lost
    expect(diffEl.hidden).toBe(true);
    expect(link.textContent).toContain("view diff");
  });

  it("expands and collapses the body when its header is clicked", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: EDIT_CALL });
    dispatch(window, { type: "toolCallUpdate", call: { toolCallId: "tc1", content: [DIFF] } });
    dispatch(window, { type: "messageChunk", text: "done" } as any);

    const group = doc.querySelector(".tool-group") as HTMLElement;
    const body = group.querySelector(".tool-group-body") as HTMLElement;
    const header = group.querySelector(".tool-group-header") as HTMLElement;
    expect(body.hidden).toBe(true); // collapsed by default, like a multi-tool batch

    click(window, header);
    expect(body.hidden).toBe(false);
    expect(group.classList.contains("expanded")).toBe(true);

    click(window, header);
    expect(body.hidden).toBe(true);
    expect(group.classList.contains("expanded")).toBe(false);
  });

  it("still flattens a lone non-edit (a read) into a `.tool-flat`", () => {
    const { window, doc } = bootWebview();

    dispatch(window, { type: "toolCall", call: { toolCallId: "r1", kind: "read", title: "Read src/foo.ts" } });
    dispatch(window, { type: "messageChunk", text: "done" } as any);

    expect(doc.querySelector(".tool-flat")).not.toBeNull();
    expect(doc.querySelector(".tool-group")).toBeNull();
  });

  it("on restore, a completed edit attaches its diff mid-replay before seal destroys tools", () => {
    const { window, posted, doc } = bootWebview();

    // grok's REAL session/load wire: a completed edit replays as a single
    // tool_call carrying the diff. Mid-replay the expandable group + view-diff
    // must work; after replay seal, intermediate tools are destroyed (turn model).
    const REPLAYED_EDIT = { ...EDIT_CALL, status: "completed", content: [DIFF] };

    dispatch(window, { type: "historyReplay", active: true });
    dispatch(window, {
      type: "permissionHistoryQueue",
      permissions: [{ toolCallId: "tc1", title: "Edit src/foo.ts", outcome: "allowed" }],
    });
    dispatch(window, { type: "toolCall", call: REPLAYED_EDIT }); // single message, diff included

    const group = doc.querySelector(".tool-group");
    expect(group).not.toBeNull();
    expect(doc.querySelector(".tool-flat")).toBeNull();
    const link = group!.querySelector(".tool-group-body .preview-link") as HTMLButtonElement;
    expect(link).not.toBeNull();
    expect(link.textContent).toContain("view diff");
    expect(group!.querySelector(".tool-item-subtitle")!.textContent).toContain("2 → 3 lines");

    click(window, link);
    expect(posted.filter((m: any) => m.type === "openDiff")).toHaveLength(0);
    expect(diffRows(group!)).toEqual(["same:a", "del:b", "add:B", "add:c"]);

    dispatch(window, { type: "historyReplay", active: false });
    // Seal destroys intermediate tool rows; permission history line may remain.
    expect(doc.querySelector(".tool-group")).toBeNull();

    // The answered permission card replays right at the tool it gated.
    expect(doc.querySelector(".card.permission.perm-resolved")).not.toBeNull();
  });
});
