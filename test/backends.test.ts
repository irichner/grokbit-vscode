import { describe, it, expect } from "vitest";
import {
  BACKENDS,
  BackendId,
  BackendQuirks,
  CLAUDE_BACKEND,
  CLAUDE_EFFORT_LEVELS,
  EffortLevel,
  GROK_BACKEND,
  GROK_EFFORT_LEVELS,
  backendSpec,
  buildGrokAgentArgs,
} from "../src/backends";

describe("GROK_BACKEND / CLAUDE_BACKEND descriptors", () => {
  it("grok's quirks are all true — every existing grok-only behaviour stays on", () => {
    const expected: BackendQuirks = {
      planPrimer: true,
      clientPlanGate: true,
      windowsVersionPin: true,
      emptyPrimerSweep: true,
      mediaGen: true,
      xaiRequests: true,
    };
    expect(GROK_BACKEND.quirks).toEqual(expected);
  });

  it("Claude's quirks are all false — every grok-only behaviour must be gated off for it", () => {
    const expected: BackendQuirks = {
      planPrimer: false,
      clientPlanGate: false,
      windowsVersionPin: false,
      emptyPrimerSweep: false,
      mediaGen: false,
      xaiRequests: false,
    };
    expect(CLAUDE_BACKEND.quirks).toEqual(expected);
  });

  it("carries the right id + label", () => {
    expect(GROK_BACKEND.id).toBe("grok");
    expect(GROK_BACKEND.label).toBe("Grok Build");
    expect(CLAUDE_BACKEND.id).toBe("claude");
    expect(CLAUDE_BACKEND.label).toBe("Claude Code");
  });

  it("both backends use the same mode ids for the Agent/Plan picker entries (verified wire findings)", () => {
    expect(GROK_BACKEND.modes).toEqual({ agent: "default", plan: "plan" });
    expect(CLAUDE_BACKEND.modes).toEqual({ agent: "default", plan: "plan" });
  });

  it("BACKENDS indexes both specs by id", () => {
    expect(BACKENDS.grok).toBe(GROK_BACKEND);
    expect(BACKENDS.claude).toBe(CLAUDE_BACKEND);
  });

  it("backendSpec looks up a descriptor by id", () => {
    expect(backendSpec("grok")).toBe(GROK_BACKEND);
    expect(backendSpec("claude")).toBe(CLAUDE_BACKEND);
  });

  it("every BackendId resolves to a spec (exhaustiveness)", () => {
    const ids: BackendId[] = ["grok", "claude"];
    for (const id of ids) {
      expect(backendSpec(id).id).toBe(id);
    }
  });
});

describe("effort level sets", () => {
  it("grok accepts exactly the six reasoning-effort values the CLI supports", () => {
    expect(GROK_BACKEND.effortLevels).toEqual(["none", "minimal", "low", "medium", "high", "xhigh"]);
    expect(GROK_EFFORT_LEVELS).toEqual(GROK_BACKEND.effortLevels);
  });

  it("does NOT include the bogus 'max' level that used to crash grok (#3/#4)", () => {
    expect(GROK_BACKEND.effortLevels).not.toContain("max");
  });

  it("Claude has no reasoning-effort axis at all — an empty level set, not an invented flag", () => {
    expect(CLAUDE_BACKEND.effortLevels).toEqual([]);
    expect(CLAUDE_EFFORT_LEVELS).toEqual([]);
  });

  // Typing finding (#12): `effortLevels` used to be declared `readonly string[]`
  // on BackendSpec, which widened grok's descriptor and lost EffortLevel
  // narrowing through the field. This is a compile-time proof, not a runtime
  // one: `first` is typed `EffortLevel | undefined` with no cast, and
  // buildGrokAgentArgs only accepts EffortLevel — `tsc -p . --noEmit` fails
  // here (not the assertion below) if effortLevels ever widens back to string[].
  it("BackendSpec.effortLevels keeps EffortLevel typing, not the wider string[]", () => {
    const first: EffortLevel | undefined = GROK_BACKEND.effortLevels[0];
    expect(buildGrokAgentArgs(first)).toEqual(["agent", "--reasoning-effort", "none", "stdio"]);
  });
});

// #3/#4 (thanks @shugav for the crash report): the startup crash was the bogus
// `max` value, not reasoningEffort itself — grok accepts none|minimal|low|medium|
// high|xhigh, and the flag must precede the `stdio` subcommand (an agent-level
// flag; after `stdio` the CLI errors "unexpected argument").
describe("buildGrokAgentArgs", () => {
  it("starts ACP sessions with the stdio subcommand when no effort is set", () => {
    expect(buildGrokAgentArgs()).toEqual(["agent", "stdio"]);
  });

  it("forwards a valid effort as --reasoning-effort before the stdio subcommand", () => {
    expect(buildGrokAgentArgs("high")).toEqual(["agent", "--reasoning-effort", "high", "stdio"]);
    expect(buildGrokAgentArgs("none")).toEqual(["agent", "--reasoning-effort", "none", "stdio"]);
    expect(buildGrokAgentArgs("xhigh")).toEqual(["agent", "--reasoning-effort", "xhigh", "stdio"]);
  });

  it("places --reasoning-effort strictly before stdio, not after", () => {
    const args = buildGrokAgentArgs("medium");
    expect(args.indexOf("--reasoning-effort")).toBeLessThan(args.indexOf("stdio"));
  });
});
