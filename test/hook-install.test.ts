/**
 * Exercises the real provisioning path — the same `installHooks` the
 * "Grokbit: Install workspace harness hooks" command runs — against a real
 * temporary filesystem, with the actual `resources/hooks/grok/` bundle as its
 * source. `extension.ts` adds only `vscode` chrome on top of this.
 *
 * Real fs rather than a fake: the failure modes this guards (a destructive
 * backup ahead of a copy, a marker written for an incomplete install) are
 * about ordering and partial state, which a hand-written stub would model
 * exactly as well as its author already believed the code worked.
 */
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HOOK_BUNDLE_FILES,
  HOOK_MARKER_FILE,
  installHooks,
  workspaceHooksDir,
} from "../src/hook-suite";

const BUNDLE = path.join(__dirname, "..", "resources", "hooks", "grok");

let tmp: string;

beforeEach(async () => {
  tmp = await fsp.mkdtemp(path.join(os.tmpdir(), "grokbit-hooks-"));
});

afterEach(async () => {
  await fsp.rm(tmp, { recursive: true, force: true });
});

async function listing(dir: string): Promise<string[]> {
  try {
    return (await fsp.readdir(dir)).sort();
  } catch {
    return [];
  }
}

describe("installHooks — the real product path", () => {
  it("copies the whole bundle and stamps the version marker", async () => {
    const dest = workspaceHooksDir(tmp);
    const result = await installHooks({
      fs: fsp,
      source: BUNDLE,
      dest,
      version: "2026.8.26",
    });

    expect(result.status).toBe("ok");
    expect(result.copied.sort()).toEqual([...HOOK_BUNDLE_FILES].sort());
    expect(await listing(dest)).toEqual([HOOK_MARKER_FILE, ...HOOK_BUNDLE_FILES].sort());
    expect(await fsp.readFile(path.join(dest, HOOK_MARKER_FILE), "utf8")).toBe("2026.8.26");
    // The copied scripts are the bundle's, byte for byte.
    expect(await fsp.readFile(path.join(dest, "_common.py"), "utf8")).toBe(
      await fsp.readFile(path.join(BUNDLE, "_common.py"), "utf8"),
    );
  });

  it("wires the copied settings.json to the detected interpreter", async () => {
    const dest = workspaceHooksDir(tmp);
    await installHooks({
      fs: fsp,
      source: BUNDLE,
      dest,
      version: "1.0.0",
      interpreter: "python3",
    });
    const wired = JSON.parse(await fsp.readFile(path.join(dest, "settings.json"), "utf8"));
    const commands: string[] = [];
    for (const matchers of Object.values(wired.hooks) as { hooks: { command: string }[] }[][]) {
      for (const entry of matchers) for (const h of entry.hooks) commands.push(h.command);
    }
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((c) => c.startsWith("python3 "))).toBe(true);
  });

  it("backs the previous tree up before replacing it", async () => {
    const dest = workspaceHooksDir(tmp);
    await fsp.mkdir(dest, { recursive: true });
    await fsp.writeFile(path.join(dest, "my-hooks.json"), "{}", "utf8");
    await fsp.writeFile(path.join(dest, "old.py"), "print(1)", "utf8");
    const backup = path.join(tmp, ".grok", "hooks-backup-test");

    const result = await installHooks({
      fs: fsp,
      source: BUNDLE,
      dest,
      version: "1.0.0",
      backupDir: backup,
    });

    expect(result.status).toBe("ok");
    expect(result.backedUpTo).toBe(backup);
    // Everything the user had is recoverable...
    expect(await listing(backup)).toEqual(["my-hooks.json", "old.py"]);
    // ...and gone from the live tree, which is now exactly ours.
    expect(await listing(dest)).toEqual([HOOK_MARKER_FILE, ...HOOK_BUNDLE_FILES].sort());
  });

  // [R] The copy loop used to skip whatever the bundle was missing, write the
  // marker anyway and report success — so a damaged vsix produced an empty
  // `.grok/hooks/` that every later activation read as "version-current" and
  // skipped forever: a dead gate claiming to be installed.
  it("[R] refuses an incomplete bundle without writing the marker", async () => {
    const partial = path.join(tmp, "partial-bundle");
    await fsp.mkdir(partial, { recursive: true });
    await fsp.writeFile(path.join(partial, "settings.json"), "{}", "utf8");
    const dest = workspaceHooksDir(tmp);

    const result = await installHooks({ fs: fsp, source: partial, dest, version: "1.0.0" });

    expect(result.status).toBe("failed");
    expect(result.reason).toContain("bundle-incomplete");
    expect(result.reason).toContain("_common.py");
    expect(result.copied).toEqual([]);
    expect(await listing(dest)).toEqual([]);
  });

  // [R] Validation runs before the destructive step, so a damaged bundle can
  // never leave the workspace with neither its own hooks nor ours.
  it("[R] leaves an existing tree untouched when the bundle is incomplete", async () => {
    const partial = path.join(tmp, "partial-bundle");
    await fsp.mkdir(partial, { recursive: true });
    const dest = workspaceHooksDir(tmp);
    await fsp.mkdir(dest, { recursive: true });
    await fsp.writeFile(path.join(dest, "precious.py"), "print(1)", "utf8");

    const result = await installHooks({
      fs: fsp,
      source: partial,
      dest,
      version: "1.0.0",
      backupDir: path.join(tmp, ".grok", "hooks-backup-test"),
    });

    expect(result.status).toBe("failed");
    expect(result.backedUpTo).toBeUndefined();
    expect(await listing(dest)).toEqual(["precious.py"]);
  });

  it("fails cleanly on an unreadable bundle", async () => {
    const result = await installHooks({
      fs: fsp,
      source: path.join(tmp, "does-not-exist"),
      dest: workspaceHooksDir(tmp),
      version: "1.0.0",
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toContain("bundle-unreadable");
  });

  it("refuses a blank version rather than stamping an empty marker", async () => {
    const result = await installHooks({
      fs: fsp,
      source: BUNDLE,
      dest: workspaceHooksDir(tmp),
      version: "  ",
    });
    expect(result.status).toBe("failed");
    expect(result.reason).toBe("no-bundled-version");
  });
});
