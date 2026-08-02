import { describe, it, expect } from "vitest";
import {
  buildSessionPromptBlocks,
  canAcceptPasteImage,
  canAcceptPasteImageBytes,
  imagePathContextSection,
  PASTE_IMAGE_MAX_BYTES,
  PASTE_IMAGE_MAX_COUNT,
  toBufferedUserImage,
  type PendingImage,
} from "../src/pending-images";
import { makeExplicitChip } from "../src/chips";

const img = (over: Partial<PendingImage> = {}): PendingImage => ({
  id: "paste:1",
  absPath: "C:/store/paste-images/s1/screenshot.png",
  fileName: "screenshot.png",
  mimeType: "image/png",
  byteLength: 100,
  createdAt: 1,
  ...over,
});

const deps = {
  readFile: () => "line1\nline2",
  readFileB64: (p: string) => (p.includes("screenshot") ? "QUJD" : ""),
  extName: (p: string) => {
    const i = p.lastIndexOf(".");
    return i >= 0 ? p.slice(i) : "";
  },
};

describe("canAcceptPasteImage", () => {
  it("accepts png under the size and count caps", () => {
    const r = canAcceptPasteImage({ currentCount: 0, byteLength: 1024, mimeType: "image/png" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mimeType).toBe("image/png");
  });

  it("normalizes image/jpg to image/jpeg", () => {
    const r = canAcceptPasteImage({ currentCount: 0, byteLength: 10, mimeType: "image/jpg" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.mimeType).toBe("image/jpeg");
  });

  it("rejects SVG", () => {
    const r = canAcceptPasteImage({
      currentCount: 0,
      byteLength: 10,
      mimeType: "image/svg+xml",
    });
    expect(r.ok).toBe(false);
  });

  it("rejects oversize", () => {
    const r = canAcceptPasteImage({
      currentCount: 0,
      byteLength: PASTE_IMAGE_MAX_BYTES + 1,
      mimeType: "image/png",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/too large/i);
  });

  it("rejects empty data", () => {
    expect(canAcceptPasteImage({ currentCount: 0, byteLength: 0, mimeType: "image/png" }).ok).toBe(
      false,
    );
  });

  it("rejects when count cap is reached", () => {
    const r = canAcceptPasteImage({
      currentCount: PASTE_IMAGE_MAX_COUNT,
      byteLength: 10,
      mimeType: "image/png",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/at most/i);
  });
});

describe("canAcceptPasteImageBytes", () => {
  it("is true for a normal screenshot size", () => {
    expect(canAcceptPasteImageBytes(50_000)).toBe(true);
  });
  it("is false over the cap (client gate before postMessage)", () => {
    expect(canAcceptPasteImageBytes(PASTE_IMAGE_MAX_BYTES + 1)).toBe(false);
  });
});

describe("buildSessionPromptBlocks", () => {
  it("returns text-only when no images", () => {
    const blocks = buildSessionPromptBlocks({
      text: "hello",
      chips: [],
      images: [],
      imageCapable: true,
      ...deps,
    });
    expect(blocks).toEqual([{ type: "text", text: "hello" }]);
  });

  it("imageCapable true: text + image blocks", () => {
    const blocks = buildSessionPromptBlocks({
      text: "what is this?",
      chips: [],
      images: [img()],
      imageCapable: true,
      ...deps,
    });
    expect(blocks[0]).toEqual({ type: "text", text: "what is this?" });
    expect(blocks[1]).toEqual({ type: "image", mimeType: "image/png", data: "QUJD" });
    expect(blocks.every((b) => b.type !== "image" || b.type === "image")).toBe(true);
  });

  it("imageCapable false: path text, never an image block", () => {
    const blocks = buildSessionPromptBlocks({
      text: "look",
      chips: [],
      images: [img()],
      imageCapable: false,
      ...deps,
    });
    expect(blocks.some((b) => b.type === "image")).toBe(false);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].text).toContain("Attached image file:");
      expect(blocks[0].text).toContain(img().absPath);
      expect(blocks[0].text).toContain("look");
    }
  });

  it("empty text + images only (vision): image blocks without requiring user text", () => {
    const blocks = buildSessionPromptBlocks({
      text: "",
      chips: [],
      images: [img()],
      imageCapable: true,
      ...deps,
    });
    expect(blocks.some((b) => b.type === "image")).toBe(true);
    // No empty-string text block required when images alone are present
    const textBlocks = blocks.filter((b) => b.type === "text");
    expect(textBlocks.every((b) => b.type === "text" && b.text !== "")).toBe(true);
  });

  it("empty text + images only (no vision): path-only text block", () => {
    const blocks = buildSessionPromptBlocks({
      text: "",
      chips: [],
      images: [img()],
      imageCapable: false,
      ...deps,
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].text).toContain(img().absPath);
    }
  });

  it("still includes file chips in text when images are present", () => {
    const blocks = buildSessionPromptBlocks({
      text: "fix",
      chips: [makeExplicitChip("/a.ts", "src/a.ts")],
      images: [img()],
      imageCapable: true,
      ...deps,
    });
    expect(blocks[0].type).toBe("text");
    if (blocks[0].type === "text") {
      expect(blocks[0].text).toContain("src/a.ts");
      expect(blocks[0].text).toContain("fix");
    }
  });
});

describe("imagePathContextSection / toBufferedUserImage", () => {
  it("lists multiple image paths", () => {
    const s = imagePathContextSection([
      img({ absPath: "/a.png" }),
      img({ id: "paste:2", absPath: "/b.png" }),
    ]);
    expect(s).toContain("Attached image files:");
    expect(s).toContain("- /a.png");
    expect(s).toContain("- /b.png");
  });

  it("buffer shape keeps absPath and drops nothing essential", () => {
    const b = toBufferedUserImage(img());
    expect(b).toEqual({
      id: "paste:1",
      absPath: img().absPath,
      fileName: "screenshot.png",
      mimeType: "image/png",
    });
    expect("previewUri" in b).toBe(false);
  });
});
