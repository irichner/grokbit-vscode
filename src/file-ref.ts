/**
 * Pure helpers for the webview → host "open file" / "drop file" flows. Split out
 * so the path-ref parsing and the large-file guard can be unit-tested without a
 * `vscode` or `fs` dependency.
 */

export interface FileRef {
  path: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Split a `path[#L<start>[-[L]<end>]]` reference into its parts. The `#L…`
 * fragment is anchored to the *end* of the string (via lazy `.*?`), so a literal
 * `#` earlier in the path — C#/F# project folders, for instance — stays part of
 * the path instead of breaking the match. Line numbers are returned 1-based,
 * exactly as written.
 */
/**
 * Whether `value` is a usable file-ref path — a non-empty (post-trim) string.
 * Guards `parseFileRef`'s call sites (e.g. the webview's "openFile" message)
 * against a missing/blank/non-string payload: `parseFileRef` calls
 * `raw.match(...)`, which throws a TypeError on anything that isn't a string
 * (a number, `null`, an object, …) — a falsy-only check (`!value`) misses that
 * case (a truthy non-string like `5` slips through) and also misses a
 * whitespace-only string.
 */
export function isUsableFilePath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function parseFileRef(raw: string): FileRef {
  const m = raw.match(/^(.*?)(?:#L(\d+)(?:-L?(\d+))?)?$/i);
  if (!m) return { path: raw };
  const startLine = m[2] ? Number(m[2]) : undefined;
  if (startLine == null) return { path: m[1] };
  const endLine = m[3] ? Number(m[3]) : undefined;
  return endLine == null ? { path: m[1], startLine } : { path: m[1], startLine, endLine };
}

/** Files at or below this size may be read synchronously to count lines. */
export const MAX_INLINE_CHIP_BYTES = 10 * 1024 * 1024;

/**
 * Whether a dropped file is small enough to `readFileSync` on the extension-host
 * thread (to count lines for an inline chip). Larger files would freeze the UI —
 * the caller should fall back to a no-selection chip.
 */
export function shouldReadFileInline(sizeBytes: number, maxBytes = MAX_INLINE_CHIP_BYTES): boolean {
  return sizeBytes <= maxBytes;
}
