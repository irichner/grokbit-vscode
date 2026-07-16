/**
 * Pure helpers for the workspace business-documents browser (Studio E2).
 * Host gathers paths via vscode.workspace.findFiles; this module filters,
 * sorts, and caps so unit tests don't need vscode.
 */
import { businessDocKindForPath, type BusinessDocKind } from "./acp-dispatch";

export const WORKSPACE_DOCS_CAP = 50;

/** Glob fragments for findFiles (one extension per pattern for portability). */
export const WORKSPACE_DOC_GLOBS = [
  "**/*.docx",
  "**/*.xlsx",
  "**/*.pptx",
  "**/*.pdf",
  "**/*.csv",
  "**/*.md",
  "**/*.markdown",
  "**/*.txt",
  "**/*.rtf",
] as const;

/** findFiles exclude pattern (comma-separated VS Code style). */
export const WORKSPACE_DOC_EXCLUDE =
  "**/{node_modules,.git,out,dist,.vsix,coverage}/**";

export type WorkspaceDocEntry = {
  path: string;
  name: string;
  kind: BusinessDocKind;
  mtimeMs?: number;
};

export type WorkspaceDocListInput = {
  path: string;
  mtimeMs?: number;
};

function basename(p: string): string {
  const norm = p.replace(/\\/g, "/");
  const i = norm.lastIndexOf("/");
  return i >= 0 ? norm.slice(i + 1) : p;
}

/**
 * Build a capped, newest-first list of business docs from raw path stats.
 * Drops unknown extensions and de-dupes by normalized path.
 */
export function selectWorkspaceDocs(
  files: WorkspaceDocListInput[],
  cap: number = WORKSPACE_DOCS_CAP,
): { entries: WorkspaceDocEntry[]; capped: boolean; total: number } {
  const seen = new Set<string>();
  const ranked: WorkspaceDocEntry[] = [];
  for (const f of files || []) {
    if (!f || typeof f.path !== "string" || !f.path) continue;
    const path = f.path;
    const key = path.replace(/\\/g, "/").toLowerCase();
    if (seen.has(key)) continue;
    const kind = businessDocKindForPath(path);
    if (!kind) continue;
    seen.add(key);
    ranked.push({
      path,
      name: basename(path),
      kind,
      mtimeMs: typeof f.mtimeMs === "number" && Number.isFinite(f.mtimeMs) ? f.mtimeMs : 0,
    });
  }
  ranked.sort((a, b) => (b.mtimeMs ?? 0) - (a.mtimeMs ?? 0) || a.name.localeCompare(b.name));
  const total = ranked.length;
  const limit = Math.max(0, Math.floor(cap));
  const entries = ranked.slice(0, limit).map(({ path, name, kind }) => ({ path, name, kind }));
  return { entries, capped: total > limit, total };
}
