import { buildPrompt, type PromptBuilderDeps } from "./prompt-builder";
import type { FileChip } from "./chips";

/** Staged clipboard image waiting in the composer (host + pure helpers). */
export interface PendingImage {
  id: string;
  absPath: string;
  fileName: string;
  mimeType: string;
  byteLength: number;
  createdAt: number;
}

/** Durable fields for Session.buffer userMessage.images (no previewUri). */
export interface BufferedUserImage {
  id: string;
  absPath: string;
  fileName: string;
  mimeType: string;
}

export const PASTE_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const PASTE_IMAGE_MAX_COUNT = 6;

export const PASTE_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/** Subdir under extension globalStorage for staged pastes. */
export const PASTE_IMAGES_DIR_NAME = "paste-images";

export type AcpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; mimeType: string; data: string };

export function normalizePasteMime(mimeType: string): string {
  const m = (mimeType || "").toLowerCase().trim();
  if (m === "image/jpg") return "image/jpeg";
  return m;
}

export function canAcceptPasteImage(opts: {
  currentCount: number;
  byteLength: number;
  mimeType: string;
  maxBytes?: number;
  maxCount?: number;
}): { ok: true; mimeType: string } | { ok: false; reason: string } {
  const maxBytes = opts.maxBytes ?? PASTE_IMAGE_MAX_BYTES;
  const maxCount = opts.maxCount ?? PASTE_IMAGE_MAX_COUNT;
  const mime = normalizePasteMime(opts.mimeType);
  if (!PASTE_IMAGE_MIME.has(mime) && !PASTE_IMAGE_MIME.has(opts.mimeType.toLowerCase())) {
    return { ok: false, reason: "Only PNG, JPEG, WebP, and GIF images can be pasted." };
  }
  // SVG and other non-raster types are rejected above; double-check svg.
  if (mime.includes("svg")) {
    return { ok: false, reason: "SVG images cannot be pasted." };
  }
  if (!Number.isFinite(opts.byteLength) || opts.byteLength <= 0) {
    return { ok: false, reason: "Image data is empty." };
  }
  if (opts.byteLength > maxBytes) {
    return {
      ok: false,
      reason: `Image is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB).`,
    };
  }
  if (opts.currentCount >= maxCount) {
    return {
      ok: false,
      reason: `At most ${maxCount} images can be attached at once.`,
    };
  }
  return { ok: true, mimeType: mime === "image/jpg" ? "image/jpeg" : mime };
}

/** Webview-side size gate before postMessage (raw bytes, not base64 length). */
export function canAcceptPasteImageBytes(
  byteLength: number,
  maxBytes: number = PASTE_IMAGE_MAX_BYTES,
): boolean {
  return Number.isFinite(byteLength) && byteLength > 0 && byteLength <= maxBytes;
}

export function toBufferedUserImage(img: PendingImage): BufferedUserImage {
  return {
    id: img.id,
    absPath: img.absPath,
    fileName: img.fileName,
    mimeType: img.mimeType,
  };
}

export function imagePathContextSection(images: PendingImage[]): string {
  if (images.length === 0) return "";
  if (images.length === 1) return `Attached image file: ${images[0].absPath}`;
  return "Attached image files:\n" + images.map((i) => `- ${i.absPath}`).join("\n");
}

export interface BuildSessionPromptBlocksOpts {
  text: string;
  chips: FileChip[];
  images: PendingImage[];
  imageCapable: boolean;
  readFile: PromptBuilderDeps["readFile"];
  readFileB64: (path: string) => string;
  extName: PromptBuilderDeps["extName"];
}

/**
 * Build ACP session/prompt content blocks for a user send.
 * - Always includes text from buildPrompt (+ path notes when !imageCapable).
 * - Image blocks only when imageCapable (never otherwise — avoids -32602).
 */
export function buildSessionPromptBlocks(opts: BuildSessionPromptBlocksOpts): AcpContentBlock[] {
  const baseText = buildPrompt(opts.text, opts.chips, {
    readFile: opts.readFile,
    extName: opts.extName,
  });

  const pathNote =
    !opts.imageCapable && opts.images.length > 0
      ? imagePathContextSection(opts.images)
      : "";

  const fullText = [pathNote, baseText].filter((s) => s.length > 0).join("\n\n");

  const blocks: AcpContentBlock[] = [];
  if (fullText) {
    blocks.push({ type: "text", text: fullText });
  }

  if (opts.imageCapable) {
    for (const img of opts.images) {
      const data = opts.readFileB64(img.absPath);
      if (!data) continue;
      blocks.push({
        type: "image",
        mimeType: normalizePasteMime(img.mimeType) || "image/png",
        data,
      });
    }
  }

  // Image-only + vision: may be image blocks only. Image-only + no vision: path text only.
  // Empty send should not reach here; if it does, send an empty text block so the wire is valid.
  if (blocks.length === 0) {
    blocks.push({ type: "text", text: opts.text || "" });
  }
  return blocks;
}

/** Extension under globalStorage for a session's paste staging. */
export function pasteStagingRelPath(sessionKey: string): string {
  const safe = sessionKey.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "session";
  return `${PASTE_IMAGES_DIR_NAME}/${safe}`;
}

export function defaultScreenshotFileName(mimeType: string, n: number): string {
  const mime = normalizePasteMime(mimeType);
  const ext =
    mime === "image/jpeg" ? "jpg"
    : mime === "image/webp" ? "webp"
    : mime === "image/gif" ? "gif"
    : "png";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `screenshot-${ts}-${n}.${ext}`;
}
