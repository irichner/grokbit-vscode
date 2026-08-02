/**
 * Paste-screenshot composer UX (docs/plans/paste-screenshots.md).
 * Drives the real media/chat.js via the happy-dom harness.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { bootWebview, type Harness } from "./webview-harness";

let h: Harness;

beforeEach(() => {
  h = bootWebview({ ready: true });
  // Unlock composer so send isn't blocked by priming busy.
  h.window.dispatchEvent(
    new h.window.MessageEvent("message", {
      data: { type: "setBusy", value: false, locked: false },
    }),
  );
});

afterEach(() => {
  h.window.close();
});

function dispatchHost(data: Record<string, unknown>) {
  h.window.dispatchEvent(new h.window.MessageEvent("message", { data }));
}

describe("paste image composer", () => {
  it("renders pending image tiles and coexists with a file attachment chip", () => {
    dispatchHost({
      type: "chips",
      chips: [
        {
          id: "explicit:/a.ts:0-0:1",
          path: "/a.ts",
          relPath: "src/a.ts",
          hidden: false,
        },
      ],
    });
    dispatchHost({
      type: "pendingImages",
      images: [
        {
          id: "paste:1",
          fileName: "screenshot.png",
          mimeType: "image/png",
          byteLength: 100,
          previewUri: "https://localhost/preview.png",
        },
      ],
      imagePromptSupported: false,
    });
    const atts = h.doc.getElementById("attachments")!;
    expect(atts.querySelectorAll(".attachment").length).toBe(2);
    expect(atts.querySelector(".attachment-image img")?.getAttribute("src")).toBe(
      "https://localhost/preview.png",
    );
    const notice = h.doc.getElementById("paste-image-notice")!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent || "").toMatch(/can’t view images|can't view images/i);
  });

  it("image-only send posts send when pendingImages exist", () => {
    dispatchHost({
      type: "pendingImages",
      images: [
        {
          id: "paste:1",
          fileName: "shot.png",
          mimeType: "image/png",
          byteLength: 50,
          previewUri: "https://localhost/p.png",
        },
      ],
      imagePromptSupported: true,
    });
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "";
    // Enter without modifiers (default send key)
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    const send = h.posted.find((p) => p.type === "send");
    expect(send).toBeTruthy();
  });

  it("mid-turn busy still allows image-only follow-up send", () => {
    dispatchHost({ type: "setBusy", value: true, locked: false });
    dispatchHost({
      type: "pendingImages",
      images: [
        {
          id: "paste:2",
          fileName: "b.png",
          mimeType: "image/png",
          byteLength: 20,
          previewUri: "https://localhost/b.png",
        },
      ],
    });
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "";
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(h.posted.some((p) => p.type === "send")).toBe(true);
  });

  it("empty composer without images does not send", () => {
    h.posted.length = 0;
    const input = h.doc.getElementById("input") as HTMLTextAreaElement;
    input.value = "";
    input.dispatchEvent(
      new h.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(h.posted.some((p) => p.type === "send")).toBe(false);
  });

  it("remove posts removePendingImage", () => {
    dispatchHost({
      type: "pendingImages",
      images: [
        {
          id: "paste:rm",
          fileName: "x.png",
          mimeType: "image/png",
          byteLength: 10,
          previewUri: "https://localhost/x.png",
        },
      ],
    });
    h.posted.length = 0;
    const rm = h.doc.querySelector(".attachment-image .attachment-remove") as HTMLButtonElement;
    expect(rm).toBeTruthy();
    rm.click();
    expect(h.posted.some((p) => p.type === "removePendingImage" && p.id === "paste:rm")).toBe(
      true,
    );
  });

  it("userMessage with images renders bubble thumbs", () => {
    dispatchHost({
      type: "userMessage",
      text: "see this",
      chips: [],
      images: [
        {
          id: "paste:1",
          absPath: "/tmp/s.png",
          fileName: "s.png",
          mimeType: "image/png",
          previewUri: "https://localhost/s.png",
        },
      ],
    });
    const img = h.doc.querySelector(".msg.user .msg-images img");
    expect(img?.getAttribute("src")).toBe("https://localhost/s.png");
  });

  it("pasteImageError shows error notice", () => {
    dispatchHost({ type: "pasteImageError", message: "Image is too large (max 8 MB)." });
    const notice = h.doc.getElementById("paste-image-notice")!;
    expect(notice.hidden).toBe(false);
    expect(notice.textContent).toMatch(/too large/i);
    expect(notice.classList.contains("is-error")).toBe(true);
  });
});

describe("paste helpers (webview)", () => {
  it("exports client size/mime gates", async () => {
    const helpers = await import("../media/webview-helpers.js");
    expect(helpers.canAcceptPasteImageBytes(100)).toBe(true);
    expect(helpers.canAcceptPasteImageBytes(helpers.PASTE_IMAGE_MAX_BYTES + 1)).toBe(false);
    expect(helpers.isAllowedPasteImageMime("image/png")).toBe(true);
    expect(helpers.isAllowedPasteImageMime("image/svg+xml")).toBe(false);
  });
});
