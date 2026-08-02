/**
 * Honest, best-effort MCP discovery from grok-style TOML config text.
 * Does not parse full TOML — counts `[mcp_servers.<name>]` table headers only.
 * Returns 0 when text is empty or has no matches (never invents servers).
 */
export function countMcpServersInToml(text: string | undefined | null): number {
  if (typeof text !== "string" || !text) return 0;
  const re = /^\s*\[mcp_servers\.[^\]]+\]/gm;
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

/**
 * Read candidate config paths and sum unique section names found.
 * Paths are tried in order; pure given injected readText (returns null on miss).
 */
export function countMcpServersFromFiles(
  paths: readonly string[],
  readText: (p: string) => string | null,
): { count: number; sources: string[] } {
  const names = new Set<string>();
  const sources: string[] = [];
  const headerRe = /^\s*\[mcp_servers\.([^\]]+)\]/gm;
  for (const p of paths) {
    let text: string | null;
    try {
      text = readText(p);
    } catch {
      text = null;
    }
    if (!text) continue;
    let m: RegExpExecArray | null;
    headerRe.lastIndex = 0;
    let found = false;
    while ((m = headerRe.exec(text)) !== null) {
      names.add(m[1].trim());
      found = true;
    }
    if (found) sources.push(p);
  }
  return { count: names.size, sources };
}
