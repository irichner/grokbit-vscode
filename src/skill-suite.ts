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
 * document), not alphabetical — the group doubles as the workflow's own
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
