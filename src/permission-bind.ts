/**
 * Permission → mutation binding (pure).
 *
 * Approving a permission card does not by itself constrain later
 * `fs/write_text_file` / `terminal/create` calls. This module extracts a
 * path- or command-scoped *grant* from the permission payload and matches
 * subsequent mutations against outstanding grants.
 *
 * Semantics (product):
 * - No path-/command-scoped grants outstanding → allow (Agent mode may write
 *   without a prior permission).
 * - Scoped grants outstanding → mutation must match one; allow_once consumes,
 *   allow_always keeps a durable grant.
 * - Permission with no extractable path/command → no scoped grant (do not
 *   invent false security).
 */

import * as nodePath from "node:path";

/** JSON-RPC error when a write/command does not match an approved grant. */
export const BIND_BLOCKED_CODE = -32011;
export const BIND_BLOCKED_WRITE_MSG =
  "Blocked: write path did not match the approved file.";
export const BIND_BLOCKED_TERMINAL_MSG =
  "Blocked: command did not match the approved command.";

export type PermissionGrantKind = "path" | "command";

export interface PermissionGrant {
  kind: PermissionGrantKind;
  /** Normalized path or trimmed command string. */
  value: string;
  /** True for allow_always — not consumed on match. */
  durable: boolean;
  toolCallId?: string;
}

export interface PermissionRawLike {
  file_path?: unknown;
  path?: unknown;
  command?: unknown;
  content?: unknown;
  old_string?: unknown;
  new_string?: unknown;
}

export interface PermissionToolCallLike {
  toolCallId?: string;
  kind?: string;
  title?: string;
  rawInput?: PermissionRawLike | null;
}

/**
 * Normalize a filesystem path for grant comparison.
 * Mirrors plan-gate's Windows-aware lowercasing for drive paths.
 */
export function normalizeGrantPath(p: string): string {
  let s = String(p || "").trim();
  if (!s) return "";
  // Strip Windows extended-length prefix
  if (/^[\\/]{2}\?[\\/]/.test(s)) s = s.slice(4);
  const windows = /^[a-zA-Z]:[\\/]/.test(s) || s.includes("\\");
  // Prefer path.normalize then unify separators
  try {
    s = nodePath.normalize(s);
  } catch {
    /* keep s */
  }
  s = s.replace(/\\/g, "/");
  // Collapse duplicate slashes except leading // for UNC (rare here)
  s = s.replace(/([^:]\/)\/+/g, "$1");
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  if (windows) s = s.toLowerCase();
  return s;
}

export function normalizeGrantCommand(cmd: string): string {
  return String(cmd || "").trim().replace(/\s+/g, " ");
}

function firstString(...vals: unknown[]): string | undefined {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * True if option kind is an allow (once or always). Reject/deny/cancel → false.
 */
export function isAllowOptionKind(kind: string | undefined): boolean {
  const k = String(kind || "").toLowerCase();
  if (!k) return false;
  if (/reject|deny|cancel|no/.test(k)) return false;
  return /allow|accept|yes|approve/.test(k) || k === "allow_once" || k === "allow_always";
}

export function isAllowAlwaysKind(kind: string | undefined): boolean {
  const k = String(kind || "").toLowerCase();
  return k === "allow_always" || k === "allow-always" || /always/.test(k) && /allow|accept/.test(k);
}

/**
 * Extract a scoped grant from a permission tool call + chosen option kind.
 * Returns null when nothing path/command-like is present.
 */
export function extractGrant(
  toolCall: PermissionToolCallLike | undefined | null,
  optionKind: string | undefined,
): PermissionGrant | null {
  if (!isAllowOptionKind(optionKind)) return null;
  const raw = (toolCall?.rawInput || {}) as PermissionRawLike;
  const pathVal = firstString(raw.file_path, raw.path);
  if (pathVal) {
    const norm = normalizeGrantPath(pathVal);
    if (!norm) return null;
    return {
      kind: "path",
      value: norm,
      durable: isAllowAlwaysKind(optionKind),
      toolCallId: typeof toolCall?.toolCallId === "string" ? toolCall.toolCallId : undefined,
    };
  }
  const cmdVal = firstString(raw.command);
  if (cmdVal) {
    const norm = normalizeGrantCommand(cmdVal);
    if (!norm) return null;
    return {
      kind: "command",
      value: norm,
      durable: isAllowAlwaysKind(optionKind),
      toolCallId: typeof toolCall?.toolCallId === "string" ? toolCall.toolCallId : undefined,
    };
  }
  return null;
}

function hasScoped(grants: readonly PermissionGrant[], kind: PermissionGrantKind): boolean {
  return grants.some((g) => g.kind === kind);
}

export type BindResult =
  | { ok: true; grants: PermissionGrant[] }
  | { ok: false; reason: string; grants: PermissionGrant[] };

/**
 * If any path-scoped grants exist, `path` must match one (consume non-durable).
 * If none exist, allow and leave grants unchanged.
 */
export function consumeWriteGrant(path: string, grants: readonly PermissionGrant[]): BindResult {
  const list = [...grants];
  if (!hasScoped(list, "path")) return { ok: true, grants: list };
  const want = normalizeGrantPath(path);
  if (!want) return { ok: false, reason: "empty path", grants: list };
  const idx = list.findIndex((g) => g.kind === "path" && g.value === want);
  if (idx < 0) {
    return { ok: false, reason: BIND_BLOCKED_WRITE_MSG, grants: list };
  }
  if (!list[idx].durable) list.splice(idx, 1);
  return { ok: true, grants: list };
}

/**
 * If any command-scoped grants exist, `command` must match one.
 * If none exist, allow.
 */
export function consumeTerminalGrant(command: string, grants: readonly PermissionGrant[]): BindResult {
  const list = [...grants];
  if (!hasScoped(list, "command")) return { ok: true, grants: list };
  const want = normalizeGrantCommand(command);
  if (!want) return { ok: false, reason: "empty command", grants: list };
  const idx = list.findIndex((g) => g.kind === "command" && g.value === want);
  if (idx < 0) {
    return { ok: false, reason: BIND_BLOCKED_TERMINAL_MSG, grants: list };
  }
  if (!list[idx].durable) list.splice(idx, 1);
  return { ok: true, grants: list };
}

/** Push a grant (no-op if null). Returns new array. */
export function pushGrant(
  grants: readonly PermissionGrant[],
  grant: PermissionGrant | null,
): PermissionGrant[] {
  if (!grant) return [...grants];
  // Dedupe durable path/command: keep one durable entry per value
  if (grant.durable) {
    const filtered = grants.filter(
      (g) => !(g.kind === grant.kind && g.value === grant.value && g.durable),
    );
    return [...filtered, grant];
  }
  return [...grants, grant];
}
