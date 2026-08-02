/**
 * Pure ranking for workspace file @-mention autocomplete.
 * Host gathers candidate relative paths; this filters/sorts/caps.
 */
export function rankWorkspaceFileHits(
  candidates: readonly string[],
  query: string,
  limit = 20,
): string[] {
  const q = String(query || "").trim().toLowerCase();
  const list = Array.isArray(candidates) ? candidates : [];
  const scored: { path: string; score: number }[] = [];
  for (const raw of list) {
    const p = String(raw || "").replace(/\\/g, "/");
    if (!p) continue;
    const lower = p.toLowerCase();
    const base = lower.split("/").pop() || lower;
    let score = -1;
    if (!q) {
      score = 0;
    } else if (base.startsWith(q)) {
      score = 100 - Math.min(base.length, 50);
    } else if (base.includes(q)) {
      score = 50 - Math.min(base.indexOf(q), 40);
    } else if (lower.includes(q)) {
      score = 10;
    }
    if (score >= 0) scored.push({ path: p, score });
  }
  scored.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (seen.has(s.path)) continue;
    seen.add(s.path);
    out.push(s.path);
    if (out.length >= limit) break;
  }
  return out;
}

/** Detect @-query at end of text before cursor (composer @-mention). */
export function parseAtMentionQuery(textBeforeCursor: string): string | null {
  const s = String(textBeforeCursor || "");
  // Avoid matching emails: require start or whitespace before @
  const m = s.match(/(?:^|[\s\n])@([^\s@]*)$/);
  return m ? m[1] : null;
}
