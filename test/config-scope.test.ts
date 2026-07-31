import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

// Security finding: grok.cliPath / grok.voiceApiKey / grok.claude.executablePath
// / grok.claude.adapterPath declared no "scope", which defaults to "window" —
// settable from a repo's .vscode/settings.json. adapterPath/executablePath are
// then spawned with extension-host privileges (process.execPath <path>,
// ELECTRON_RUN_AS_NODE=1) with no prompt: clone repo -> trust folder -> open a
// Claude tab -> arbitrary code runs. "machine" scope (not "machine-overridable",
// which a TRUSTED workspace can still override — exactly the step that
// precedes opening a tab) closes that: only User/Remote settings, never a
// repo's workspace settings, can set these. Regression guard against someone
// accidentally dropping the scope later.
describe("package.json executable/credential path settings are machine-scoped", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  const props = pkg.contributes.configuration.properties;

  const machineScoped = [
    "grok.cliPath",
    "grok.voiceApiKey",
    "grok.claude.executablePath",
    "grok.claude.adapterPath",
    // Same shape as cliPath: a path that gets spawned (voice-recorder.ts /
    // voice-streamer.ts), so a workspace-set value is code execution too.
    "grok.ffmpegPath",
    // Not a path, but it decides WHICH CREDENTIAL PAYS: a workspace flipping
    // this on could route a subscriber's usage onto their API credits.
    "grok.claude.allowInheritedApiKey",
  ];

  it.each(machineScoped)("%s has scope: machine", (key) => {
    expect(props[key]).toBeDefined();
    expect(props[key].scope).toBe("machine");
  });

  it("uses \"machine\", not the weaker \"machine-overridable\" (which a trusted workspace can still override)", () => {
    for (const key of machineScoped) {
      expect(props[key].scope).not.toBe("machine-overridable");
    }
  });

  // The list above is a snapshot; this catches the NEXT executable-path setting
  // someone adds without thinking about scope. Two of the entries above
  // (ffmpegPath, allowInheritedApiKey) were themselves found only by noticing
  // they matched the same shape as the ones under review — so encode the shape,
  // not just the instances.
  it("every path/executable/credential-shaped setting is machine-scoped", () => {
    const suspicious = Object.keys(props).filter((k) =>
      /(^|\.)([a-z]+)?(path|bin|executable|apikey|token|secret)$/i.test(k),
    );
    // Sanity-check the pattern actually matches the known ones, so a broken
    // regex can't make this test vacuously pass.
    expect(suspicious).toEqual(expect.arrayContaining(["grok.cliPath", "grok.ffmpegPath"]));

    const unscoped = suspicious.filter((k) => props[k].scope !== "machine");
    expect(unscoped, `these settings are spawnable/credential-bearing but not machine-scoped: ${unscoped.join(", ")}`)
      .toEqual([]);
  });
});
