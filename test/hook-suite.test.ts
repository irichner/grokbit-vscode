import * as path from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOOK_BUNDLE_DIR,
  HOOK_BUNDLE_FILES,
  HOOK_DEFAULT_INTERPRETER,
  HOOK_MARKER_FILE,
  decideHooksProvision,
  detectDualHookStacks,
  dirLooksLikeHooks,
  hasNonMarkerContent,
  hooksBackupDirName,
  missingHookFiles,
  pickHookInterpreter,
  retargetHookSettings,
  shouldProvisionHooks,
  workspaceClaudeHooksDir,
  workspaceHooksBackupDir,
  workspaceHooksDir,
} from "../src/hook-suite";

const WS = path.join(path.sep === "\\" ? "C:\\ws" : "/ws", "proj");

describe("hook-suite paths", () => {
  it("targets workspace .grok/hooks (not home tier)", () => {
    expect(workspaceHooksDir(WS)).toBe(path.join(WS, ".grok", "hooks"));
    expect(workspaceClaudeHooksDir(WS)).toBe(path.join(WS, ".claude", "hooks"));
    expect(HOOK_BUNDLE_DIR.replace(/\\/g, "/")).toContain("resources/hooks/grok");
    expect(HOOK_MARKER_FILE.startsWith(".")).toBe(true);
    expect(HOOK_BUNDLE_FILES).toContain("verify_on_stop.py");
    expect(HOOK_BUNDLE_FILES).toContain("protect_paths.py");
    expect(HOOK_BUNDLE_FILES).toContain("settings.json");
  });

  it("builds a UTC backup dir name", () => {
    const name = hooksBackupDirName(Date.UTC(2026, 7, 3, 12, 0, 0));
    expect(name).toMatch(/^hooks-backup-20260803T120000000Z$/);
    expect(workspaceHooksBackupDir(WS, Date.UTC(2026, 7, 3, 12, 0, 0))).toBe(
      path.join(WS, ".grok", "hooks-backup-20260803T120000000Z"),
    );
  });

  // [R] Second precision let two forced installs inside one second resolve to
  // the same directory, so the second backup merged into (and partly
  // overwrote) the first — the one copy of the user's hooks we promised.
  it("[R] backup names taken in the same second stay distinct", () => {
    const a = hooksBackupDirName(Date.UTC(2026, 7, 3, 12, 0, 0, 120));
    const b = hooksBackupDirName(Date.UTC(2026, 7, 3, 12, 0, 0, 880));
    expect(a).not.toBe(b);
  });
});

describe("shouldProvisionHooks", () => {
  it("provisions when no marker or blank", () => {
    expect(shouldProvisionHooks(undefined, "3.0.19")).toBe(true);
    expect(shouldProvisionHooks("", "3.0.19")).toBe(true);
  });

  it("skips when versions match", () => {
    expect(shouldProvisionHooks("3.0.19", "3.0.19")).toBe(false);
  });

  it("[R] provisions on downgrade", () => {
    expect(shouldProvisionHooks("3.0.20", "3.0.19")).toBe(true);
  });
});

describe("decideHooksProvision", () => {
  const base = {
    destHasContent: false,
    installedVersion: undefined as string | undefined,
    bundledVersion: "2026.8.1",
  };

  it("skips when mode is off and not force", () => {
    expect(decideHooksProvision({ ...base, mode: "off", force: false }).action).toBe("skip");
  });

  it("copies fresh when mode workspace and empty dest", () => {
    const d = decideHooksProvision({ ...base, mode: "workspace", force: false });
    expect(d.action).toBe("copy");
  });

  it("skips workspace mode when version current", () => {
    const d = decideHooksProvision({
      ...base,
      mode: "workspace",
      force: false,
      destHasContent: true,
      installedVersion: "2026.8.1",
    });
    expect(d.action).toBe("skip");
    expect(d.reason).toBe("version-current");
  });

  it("[R] refuses auto-overwrite of foreign hooks without force", () => {
    const d = decideHooksProvision({
      ...base,
      mode: "workspace",
      force: false,
      destHasContent: true,
      installedVersion: undefined,
    });
    expect(d.action).toBe("refuse");
    expect(d.reason).toBe("existing-hooks-require-force");
  });

  it("backup-and-copy on force when dest has content", () => {
    const d = decideHooksProvision({
      ...base,
      mode: "off",
      force: true,
      destHasContent: true,
    });
    expect(d.action).toBe("backup-and-copy");
  });

  it("force fresh copy when empty", () => {
    const d = decideHooksProvision({ ...base, mode: "off", force: true });
    expect(d.action).toBe("copy");
  });

  it("[R] unknown/typo mode without force never installs (no fallthrough to force path)", () => {
    for (const mode of ["command", "auto", "", "on"]) {
      const d = decideHooksProvision({ ...base, mode, force: false, destHasContent: false });
      expect(d.action).toBe("skip");
      expect(d.reason).toBe("provision-off-or-unknown-mode");
    }
  });

  it("backup-and-copy on version rewrite of managed hooks", () => {
    const d = decideHooksProvision({
      ...base,
      mode: "workspace",
      force: false,
      destHasContent: true,
      installedVersion: "2026.7.1",
    });
    expect(d.action).toBe("backup-and-copy");
  });
});

describe("detectDualHookStacks", () => {
  it("warns only when both stacks present", () => {
    expect(detectDualHookStacks({ hasGrokHooks: true, hasClaudeHooks: true }).dual).toBe(true);
    expect(detectDualHookStacks({ hasGrokHooks: true, hasClaudeHooks: true }).message).toMatch(
      /double Stop/i,
    );
    expect(detectDualHookStacks({ hasGrokHooks: true, hasClaudeHooks: false }).dual).toBe(false);
    expect(detectDualHookStacks({ hasGrokHooks: false, hasClaudeHooks: true }).dual).toBe(false);
  });
});

describe("dirLooksLikeHooks / hasNonMarkerContent", () => {
  it("dirLooksLikeHooks answers the dual-stack question (live hook layer?)", () => {
    expect(dirLooksLikeHooks(["verify_on_stop.py"])).toBe(true);
    expect(dirLooksLikeHooks(["settings.json"])).toBe(true);
    expect(dirLooksLikeHooks(["README.md", HOOK_MARKER_FILE])).toBe(false);
  });

  // [R] The overwrite guard used to run off dirLooksLikeHooks, which only sees
  // `.py`/`settings.json`. Grok discovers wiring from *.json and a repo may
  // keep .sh/.ps1 hook scripts, so a curated hooks dir read as "empty" and the
  // auto path copied over the top of it with no backup and no refusal.
  it("[R] hasNonMarkerContent sees hook trees dirLooksLikeHooks misses", () => {
    for (const names of [["my-hooks.json"], ["guard.sh"], ["guard.ps1"], ["notes.md"]]) {
      expect(dirLooksLikeHooks(names)).toBe(false);
      expect(hasNonMarkerContent(names)).toBe(true);
    }
    expect(hasNonMarkerContent([])).toBe(false);
    expect(hasNonMarkerContent([HOOK_MARKER_FILE])).toBe(false);
  });
});

describe("missingHookFiles", () => {
  it("reports nothing missing when the bundle is whole", () => {
    expect(missingHookFiles([...HOOK_BUNDLE_FILES])).toEqual([]);
  });

  // [R] A partial bundle used to install silently: the copy loop skipped what
  // wasn't there, the version marker was written anyway, and every later
  // activation read "version-current" and skipped — a permanently dead gate
  // reporting itself installed.
  it("[R] names every absent manifest file", () => {
    expect(missingHookFiles(["settings.json", "verify_on_stop.py"])).toContain("_common.py");
  });
});

describe("pickHookInterpreter / retargetHookSettings", () => {
  it("prefers python, falls back to python3, else null", () => {
    expect(pickHookInterpreter(["python", "python3"])).toBe("python");
    expect(pickHookInterpreter(["python3"])).toBe("python3");
    expect(pickHookInterpreter([])).toBeNull();
  });

  // [R] Every wired command is `python "<script>.py"`, and most macOS/Linux
  // boxes only have python3 — wiring the bundled default there installs a gate
  // that can never fire.
  it("[R] rewrites every wired command to the detected interpreter", () => {
    const wired = JSON.stringify({
      _comment: "keep me",
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: 'python ".grok/hooks/verify_on_stop.py"' }] }],
        PreToolUse: [
          {
            matcher: "write",
            hooks: [{ type: "command", command: 'python ".grok/hooks/protect_paths.py"' }],
          },
        ],
      },
    });
    const out = retargetHookSettings(wired, "python3");
    const parsed = JSON.parse(out);
    expect(parsed.hooks.Stop[0].hooks[0].command).toBe('python3 ".grok/hooks/verify_on_stop.py"');
    expect(parsed.hooks.PreToolUse[0].hooks[0].command).toBe(
      'python3 ".grok/hooks/protect_paths.py"',
    );
    expect(parsed.hooks.PreToolUse[0].matcher).toBe("write");
    expect(parsed._comment).toBe("keep me");
  });

  it("is a no-op for the bundled default and for unparseable text", () => {
    const wired = '{"hooks":{"Stop":[{"hooks":[{"command":"python \\"x.py\\""}]}]}}';
    expect(retargetHookSettings(wired, HOOK_DEFAULT_INTERPRETER)).toBe(wired);
    expect(retargetHookSettings("not json", "python3")).toBe("not json");
    expect(retargetHookSettings("[]", "python3")).toBe("[]");
  });
});
