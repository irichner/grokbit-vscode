/**
 * Pure path helpers for the read-only plan / SHIP-evidence surfaces
 * (`grok.openLatestPlan`, `grok.openReleaseReadiness`).
 *
 * Deliberately separate from `grok-hooks-policy.ts`: that module is a CI
 * mirror of the vendored Python hooks and exists to be compared against them,
 * not to hold shipped feature code.
 */
import * as path from "node:path";

/** Newest plan slug by directory mtime, ignoring dotted and non-directory entries. */
export function pickLatestPlanSlug(
  entries: readonly { name: string; mtimeMs: number; isDirectory: boolean }[],
): string | null {
  const dirs = entries
    .filter((e) => e.isDirectory && !e.name.startsWith("."))
    .slice()
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dirs[0]?.name ?? null;
}

export function planArtifactsDir(workspaceRoot: string, slug: string): string {
  return path.join(workspaceRoot, ".grokbit", "plans", slug);
}

export function releaseReadinessPath(workspaceRoot: string): string {
  return path.join(workspaceRoot, "test", "release-readiness.md");
}
