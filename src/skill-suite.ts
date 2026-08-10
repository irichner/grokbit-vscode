/**
 * The bundled Grokbit skill suite — what ships inside the vsix, where it gets
 * provisioned to, and how discovered items are recognized as suite members.
 *
 * Pure: no `vscode`, no top-level `node:fs`. The impure half (the actual
 * recursive copy) lives in `extension.ts`, mirroring the split every other
 * policy module in this codebase uses (`capabilities.ts`, `session-store.ts`,
 * `cli-locator.ts`).
 *
 * **Why the suite is copied into the user's home tier at all.** A skill only
 * exists as far as the CLI is concerned if it sits on one of the CLI's own
 * search paths (`~/.grok/skills`, `~/.claude/skills` — see `CAPABILITY_ROOTS`
 * in `capabilities.ts`). Shipping the files inside the extension makes them
 * *available*; copying them out is what makes them *runnable*. The home tier
 * rather than the workspace tier so one provisioning run covers every project
 * the user opens and nothing is ever written into their repository — at the
 * cost, stated plainly in the README and the setting description, of the
 * skills also appearing in CLI sessions that have nothing to do with this
 * extension.
 *
 * Copy, not symlink. The extension owns both destination copies and rewrites
 * them wholesale on version change, so a link buys nothing — and the suite's
 * previous shell installer demonstrated the failure mode: on native Windows
 * its symlink silently failed, the copy fallback ran, and later edits to the
 * canonical copy stopped propagating with no signal that they had.
 */
import * as path from "node:path";

import { BackendId } from "./backends";
import { CapabilityItem, CapabilityKind } from "./capabilities";

/**
 * The bundled skills in pipeline order (explore → plan → implement → test →
 * document → ship), not alphabetical — the group doubles as the workflow's own
 * documentation, so the order is the teaching. Nothing here sorts: the rendered
 * order comes from `CAPABILITY_FEATURED.grokbit` in `media/webview-helpers.js`,
 * whose `partitionFeatured` already reorders matched items into its configured
 * order. Keep that array in this same order.
 *
 * This list is the single source of truth for three things that must never
 * disagree: which directories are copied out of `resources/skills`, which
 * discovered items are re-keyed to `kind: "grokbit"`, and which names the
 * webview's featured-capabilities map covers. A skill added to
 * `resources/skills` but not to this array ships in the vsix, is never
 * provisioned, and never appears — so add it here in the same change.
 */
export const SUITE_SKILL_NAMES: readonly string[] = [
  "grokbit-explore",
  "grokbit-plan",
  "grokbit-implement",
  "grokbit-test",
  "grokbit-document",
  /** Full pipeline with human checkpoint after plan (Ultimate /ship pattern). */
  "grokbit-ship",
];

/** Directory inside the extension (relative to its root) holding the suite. */
export const SUITE_BUNDLE_DIR = path.join("resources", "skills");

/**
 * Written beside the provisioned skills, holding the extension version that
 * wrote them. Dot-prefixed so the capability scan's `skill-dir` layout skips
 * it (it looks for `<dir>/<name>/SKILL.md`, and this is a file, not a
 * directory) and so it stays out of the way in a directory the user may also
 * keep their own skills in.
 */
export const SUITE_MARKER_FILE = ".grokbit-suite-version";

/** Where the suite is provisioned for a given backend's CLI. */
export interface SuiteTarget {
  backend: BackendId;
  /** Absolute path to the CLI's home-tier skills directory. */
  dir: string;
}

/**
 * The home-tier skills directory of each backend's CLI. Both are written on
 * every provisioning run regardless of which backend the user actually has
 * installed — a directory for a CLI that isn't present is inert, costs a few
 * kilobytes, and means the suite is already in place if they install that CLI
 * later. Detecting "is this CLI installed" to skip one would be a race against
 * the user's own next action for no benefit.
 */
export function suiteTargets(homeDir: string): SuiteTarget[] {
  return [
    { backend: "grok", dir: path.join(homeDir, ".grok", "skills") },
    { backend: "claude", dir: path.join(homeDir, ".claude", "skills") },
  ];
}

/**
 * Whether the provisioned copy needs rewriting.
 *
 * Deliberately an inequality, not "bundled is newer": a version *downgrade*
 * (the user installs an older vsix, or rolls one back) must also re-copy,
 * because the correct suite for an installed extension is the one that shipped
 * with it. Treating a downgrade as up-to-date would silently leave a newer
 * suite paired with older extension code — exactly the drift this marker
 * exists to prevent. `undefined` (no marker, or an unreadable one) always
 * provisions.
 */
export function shouldProvision(installedVersion: string | undefined, bundledVersion: string): boolean {
  const installed = (installedVersion ?? "").trim();
  if (!installed) return true;
  return installed !== bundledVersion.trim();
}

/** True when `candidate` is `base` itself or sits underneath it. Pure string
 *  work on already-absolute paths — the symlink-resolving containment check
 *  (`isPathContained` in `capabilities.ts`) has already run against every
 *  scanned file by the time {@link applySuiteKind} sees it. */
function isUnder(base: string, candidate: string): boolean {
  const rel = path.relative(path.resolve(base), path.resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export interface ApplySuiteKindOptions {
  /** Suite member names — defaults to {@link SUITE_SKILL_NAMES}. */
  names?: readonly string[];
  /** The provisioned directories from {@link suiteTargets}. An item only
   *  qualifies if its `path` is inside one of these. */
  managedDirs: readonly string[];
}

/**
 * Re-key discovered items that are provisioned suite members to
 * `kind: "grokbit"`, so `buildCapabilityGroups` renders them as their own
 * leading group instead of scattering them through the user's own Skills.
 *
 * **Two conditions, both required.** Name membership alone would let any repo
 * ship `.grok/skills/grokbit-plan/SKILL.md` and have it promoted into a group
 * the UI presents as Grokbit's own — and workspace-tier items win
 * `dedupeByPriority`, so that impostor would be the *only* row rendered. So
 * the item's `path` must also sit inside a directory this extension actually
 * wrote. A workspace copy stays in Skills: still discovered, still invocable,
 * simply not badged as ours, which is the honest outcome for a user who
 * deliberately forked a suite skill.
 *
 * **Must run AFTER `scanCapabilityRoots`, before `buildCapabilityGroups`.**
 * `dedupeByPriority` keys on `` `${kind}|${name}` ``, so at scan time a
 * home-tier and a workspace-tier `grokbit-plan` share a key and collapse to
 * one item. Re-key first and they would carry different keys, both survive,
 * and the same skill would render twice — once in each group.
 *
 * Returns a new array; items are copied, never mutated in place (the scan's
 * result is also read by callers that must see original kinds).
 */
export function applySuiteKind(
  items: readonly CapabilityItem[],
  opts: ApplySuiteKindOptions,
): CapabilityItem[] {
  const names = new Set((opts.names ?? SUITE_SKILL_NAMES).map((n) => n.toLowerCase()));
  const dirs = opts.managedDirs ?? [];
  if (!dirs.length) return items.slice();

  return items.map((item) => {
    if (item.kind !== "skill") return item;
    if (!names.has((item.name || "").toLowerCase())) return item;
    const filePath = item.path;
    if (!filePath) return item;
    if (!dirs.some((dir) => isUnder(dir, filePath))) return item;
    const kind: CapabilityKind = "grokbit";
    return { ...item, kind, source: "Grokbit" };
  });
}

/** Max bytes read for a suite how-it-works guide (lazy detail load). */
export const HOW_IT_WORKS_MAX_BYTES = 64 * 1024;

/**
 * Absolute path to the product how-it-works guide for a suite skill inside the
 * extension bundle (`resources/skills/<name>/references/how-it-works.md`).
 */
export function suiteHowItWorksPath(extensionRoot: string, skillName: string): string {
  return path.join(extensionRoot, SUITE_BUNDLE_DIR, skillName, "references", "how-it-works.md");
}

/** Case-insensitive membership in the suite name list. */
export function isSuiteSkillName(
  name: string,
  names: readonly string[] = SUITE_SKILL_NAMES,
): boolean {
  const lc = (name || "").toLowerCase();
  return names.some((n) => n.toLowerCase() === lc);
}

/** Canonical suite skill name casing, or undefined if not a suite member. */
export function canonicalSuiteSkillName(
  name: string,
  names: readonly string[] = SUITE_SKILL_NAMES,
): string | undefined {
  const lc = (name || "").toLowerCase();
  return names.find((n) => n.toLowerCase() === lc);
}

export interface AttachSuiteHowItWorksOptions {
  extensionRoot: string;
  /** Injected existence check — pure relative to I/O. */
  fileExists: (absPath: string) => boolean;
  names?: readonly string[];
}

/**
 * Stamp `hasDetail` / `detailPath` on re-keyed suite items when the guide
 * file exists under the extension bundle. Non-suite items are unchanged.
 */
export function attachSuiteHowItWorks(
  items: readonly CapabilityItem[],
  opts: AttachSuiteHowItWorksOptions,
): CapabilityItem[] {
  const names = opts.names ?? SUITE_SKILL_NAMES;
  return items.map((item) => {
    if (item.kind !== "grokbit") return item;
    const canonical = canonicalSuiteSkillName(item.name, names);
    if (!canonical) return item;
    const detailPath = suiteHowItWorksPath(opts.extensionRoot, canonical);
    if (!opts.fileExists(detailPath)) return item;
    return { ...item, hasDetail: true, detailPath };
  });
}

/** The agents a suite phase runs and how much review it performs. */
export interface SuiteTileMeta {
  /** Role names, verbatim from the guide's `## Roles` table. */
  agents: readonly string[];
  /** Stands in for {@link agents} when a phase has no roster of its own. */
  agentsNote?: string;
  /** Short honest phrase; every numeral in it must appear in the guide. */
  reviews: string;
}

/**
 * Per-skill agents + reviews, rendered on the tile face so a user scanning the
 * welcome canvas can tell the six phases apart without opening Details.
 *
 * **Committed data, not a runtime parse.** These facts live authoritatively in
 * each skill's `references/how-it-works.md` (`## Roles` / `## Loops and caps`),
 * but re-reading and markdown-table-parsing six files on every panel render —
 * every reveal of a torn-down hidden panel, every Refresh click — to produce a
 * string that only changes when a new vsix ships is the wrong trade. The cost
 * of duplicating them here is drift, and `test/suite-tile-meta-parity.test.ts`
 * is what pays it: it reads the guides and fails the build when the two
 * disagree, the same idiom `test/hook-parity.test.ts` uses for the vendored
 * Python hooks. **Remove that test and this manifest is stale data waiting to
 * happen.**
 *
 * `reviews` is a phrase rather than an integer on purpose. The caps genuinely
 * differ in kind — Plan runs 3 adversarial rounds *plus* 1–2 plan-level passes,
 * Test runs 7 bounded loops one of which has no escape — so collapsing them to
 * one number would mean inventing a comparison the guides never make.
 */
export const SUITE_TILE_META: Readonly<Record<string, SuiteTileMeta>> = {
  "grokbit-explore": {
    agents: ["Scope Setter", "Cartographer", "Citation Checker"],
    reviews: "2 cite-check rounds",
  },
  "grokbit-plan": {
    agents: ["Business Analyst", "Systems Analyst", "Solutions Architect", "Plan Reviewer"],
    reviews: "3 adversarial rounds + 1–2 plan passes",
  },
  "grokbit-implement": {
    agents: [
      "Build Engineer",
      "Software Engineer",
      "Supply Chain Security Analyst",
      "Code Reviewer",
      "Orchestrator",
    ],
    reviews: "2 scope-audit rounds; 3 attempts per task",
  },
  "grokbit-test": {
    agents: [
      "QA Automation Engineer",
      "Frontend QA",
      "Application Security",
      "Maintenance Engineer",
      "Release Engineer",
    ],
    reviews: "7 bounded loops; security has no escape",
  },
  "grokbit-document": {
    agents: ["Information Architect", "Documentation Engineer", "Technical Writer", "Docs QA"],
    reviews: "3 verify passes + 2 fresh-reader rounds",
  },
  "grokbit-ship": {
    /** Ship genuinely has no roster — its guide says so verbatim. A blank line
     *  here, or a roster synthesized from the phases it delegates to, would
     *  both be wrong; {@link SuiteTileMeta.agentsNote} is the honest third
     *  option, and it lives here rather than as a renderer-side fallback so the
     *  copy stays testable and visible to whoever next edits this manifest. */
    agents: [],
    agentsNote: "Runs each phase's own roster",
    reviews: "inherits every phase's reviews; ~5 delegated phases",
  },
};

/** Separator between role names on a tile's Agents line. */
const AGENT_SEPARATOR = " · ";

export interface AttachSuiteTileMetaOptions {
  names?: readonly string[];
  /** Manifest override — defaults to {@link SUITE_TILE_META}. */
  meta?: Readonly<Record<string, SuiteTileMeta>>;
}

/**
 * Stamp `meta` (the Agents / Reviews lines) onto re-keyed suite items.
 *
 * Guarded on `kind === "grokbit"` plus canonical name membership — the same
 * two-condition shape {@link applySuiteKind} uses — so a deliberate workspace
 * fork of `grokbit-plan` (which stays `kind: "skill"` by design) never inherits
 * Grokbit's roster claims about code it may no longer resemble.
 *
 * Returns a new array; items are copied, never mutated in place.
 */
export function attachSuiteTileMeta(
  items: readonly CapabilityItem[],
  opts: AttachSuiteTileMetaOptions = {},
): CapabilityItem[] {
  const names = opts.names ?? SUITE_SKILL_NAMES;
  const table = opts.meta ?? SUITE_TILE_META;
  return items.map((item) => {
    if (item.kind !== "grokbit") return item;
    const canonical = canonicalSuiteSkillName(item.name, names);
    if (!canonical) return item;
    const entry = table[canonical];
    if (!entry) return item;
    const agents = entry.agents.length
      ? entry.agents.join(AGENT_SEPARATOR)
      : (entry.agentsNote ?? "").trim();
    const meta: { label: string; value: string }[] = [];
    // An empty value is dropped rather than rendered as a labelled blank —
    // a bare "Agents" with nothing after it reads as a load failure.
    if (agents) meta.push({ label: "Agents", value: agents });
    const reviews = (entry.reviews ?? "").trim();
    if (reviews) meta.push({ label: "Reviews", value: reviews });
    if (!meta.length) return item;
    return { ...item, meta };
  });
}

/**
 * Resolve a safe absolute path for reading a suite how-it-works guide.
 * Rejects names outside {@link SUITE_SKILL_NAMES} so the host never opens
 * arbitrary client-supplied paths.
 */
export function resolveSuiteHowItWorksPath(
  extensionRoot: string,
  skillName: string,
  names: readonly string[] = SUITE_SKILL_NAMES,
): { ok: true; path: string; name: string } | { ok: false; error: string } {
  const canonical = canonicalSuiteSkillName(skillName, names);
  if (!canonical) return { ok: false, error: "not-a-suite-skill" };
  return { ok: true, path: suiteHowItWorksPath(extensionRoot, canonical), name: canonical };
}
