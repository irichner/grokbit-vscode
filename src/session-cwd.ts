/**
 * Per-session working directory policy (pure).
 * Default is the VS Code workspace folder; worktree sessions set an override
 * so the agent process and its on-disk history key off that tree.
 */
export function resolveSessionCwd(
  sessionCwd: string | undefined,
  workspaceRoot: string | undefined,
  processCwd: string,
): string {
  const override = typeof sessionCwd === "string" ? sessionCwd.trim() : "";
  if (override) return override;
  const ws = typeof workspaceRoot === "string" ? workspaceRoot.trim() : "";
  if (ws) return ws;
  return processCwd;
}
