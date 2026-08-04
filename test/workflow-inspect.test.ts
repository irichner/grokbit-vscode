// Pure tests for the workflow deep-inspection parser (src/workflow-inspect.ts).
// Never executes a workflow script — every case here is text in, structure out.
//
// The fixture shape is the spec until a real saved workflow is captured from
// either CLI (see `.grokbit/plans/workflow-details-inspector/assumptions.md`
// A5/A6): no `.rhai` or `.claude/workflows/*.js` file exists on this machine,
// so these cases encode the documented call shape, and the parser's contract is
// that anything it cannot read is COUNTED, never guessed at.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_ROOTS, rootEnabled } from "../src/capabilities";

import {
  AGENT_PROMPT_MAX_CHARS,
  WORKFLOW_AGENT_CAP,
  extractMetaPhases,
  findCallSites,
  parseAgentArgs,
  parseWorkflowDetail,
  resolveWorkflowDetailPath,
} from "../src/workflow-inspect";

const fixture = (name: string) =>
  readFileSync(fileURLToPath(new URL(`./fixtures/workflows/${name}`, import.meta.url)), "utf8");

describe("findCallSites", () => {
  it("finds each real agent( call and slices its argument text", () => {
    const src = [
      'phase("Review");',
      'let a = agent("first prompt", #{ label: "one" });',
      'let b = agent("second prompt");',
    ].join("\n");
    const sites = findCallSites(src, "agent", "rhai");
    expect(sites).toHaveLength(2);
    expect(sites[0].argsText).toBe('"first prompt", #{ label: "one" }');
    expect(sites[1].argsText).toBe('"second prompt"');
  });

  it("ignores agent( inside a string literal", () => {
    const src = 'let note = "call agent(\\"nope\\") later"; let r = agent("real");';
    const sites = findCallSites(src, "agent", "claude-js");
    expect(sites).toHaveLength(1);
    expect(sites[0].argsText).toBe('"real"');
  });

  it("ignores agent( inside line and block comments", () => {
    const src = [
      '// agent("commented out")',
      '/* agent("also out")',
      '   agent("still out") */',
      'const r = agent("live");',
    ].join("\n");
    const sites = findCallSites(src, "agent", "claude-js");
    expect(sites).toHaveLength(1);
    expect(sites[0].argsText).toBe('"live"');
  });

  it("requires a word boundary — subagent( and obj.agent( never match agent(", () => {
    const src = 'subagent("no"); runner.agent("no"); myagent("no"); agent("yes");';
    const sites = findCallSites(src, "agent", "claude-js");
    expect(sites).toHaveLength(1);
    expect(sites[0].argsText).toBe('"yes"');
  });

  it("balances parens across a prompt containing parens and quotes", () => {
    const src = 'agent("count the ) and ( in this (tricky) prompt", { label: "p" });';
    const sites = findCallSites(src, "agent", "claude-js");
    expect(sites).toHaveLength(1);
    expect(sites[0].argsText).toBe(
      '"count the ) and ( in this (tricky) prompt", { label: "p" }',
    );
  });

  it("finds a call nested inside another call's arguments", () => {
    const src = 'await parallel(items.map((f) => () => agent(f.prompt, { phase: "Find" })));';
    const sites = findCallSites(src, "agent", "claude-js");
    expect(sites).toHaveLength(1);
    expect(sites[0].argsText).toBe('f.prompt, { phase: "Find" }');
  });

  it("tolerates whitespace and a newline between the name and its paren", () => {
    const src = 'agent\n  ("spaced");';
    expect(findCallSites(src, "agent", "rhai")[0].argsText).toBe('"spaced"');
  });

  it("returns nothing for an empty name or empty text", () => {
    expect(findCallSites("", "agent", "rhai")).toEqual([]);
    expect(findCallSites('agent("x")', "", "rhai")).toEqual([]);
  });

  it("stops rather than reporting a call whose parens never close", () => {
    expect(findCallSites('agent("unterminated', "agent", "rhai")).toEqual([]);
  });

  it("locates phase( statements the same way", () => {
    const src = 'phase("Find");\nagent("a");\nphase("Verify");\nagent("b");';
    const phases = findCallSites(src, "phase", "rhai");
    expect(phases.map((p) => p.argsText)).toEqual(['"Find"', '"Verify"']);
    expect(phases[0].start).toBeLessThan(findCallSites(src, "agent", "rhai")[0].start);
  });
});

describe("parseAgentArgs", () => {
  it("reads a literal prompt with no options block", () => {
    const parsed = parseAgentArgs('"Review the diff"', "rhai");
    expect(parsed).toEqual({
      promptKind: "literal",
      prompt: "Review the diff",
      hasSchema: false,
    });
  });

  it("reads every documented option out of a Rhai #{ } map", () => {
    const parsed = parseAgentArgs(
      '"Do the thing", #{ label: "worker", phase: "Build", model: "sonnet", effort: "high", agentType: "explorer", isolation: "worktree", schema: SHAPE }',
      "rhai",
    );
    expect(parsed).toMatchObject({
      promptKind: "literal",
      prompt: "Do the thing",
      label: "worker",
      phase: "Build",
      model: "sonnet",
      effort: "high",
      agentType: "explorer",
      isolation: "worktree",
      hasSchema: true,
    });
  });

  it("reads the same options out of a JS { } literal", () => {
    const parsed = parseAgentArgs(
      "'Do it', { label: 'w', model: 'opus', schema: FINDINGS }",
      "claude-js",
    );
    expect(parsed).toMatchObject({
      promptKind: "literal",
      prompt: "Do it",
      label: "w",
      model: "opus",
      hasSchema: true,
    });
  });

  it("hasSchema is key presence, never a parse of the schema value", () => {
    expect(parseAgentArgs('"p", { schema: {"type":"object"} }', "claude-js")!.hasSchema).toBe(true);
    expect(parseAgentArgs('"p", { label: "no schema here" }', "claude-js")!.hasSchema).toBe(false);
    // A prompt that merely mentions the word must not set the flag.
    expect(parseAgentArgs('"describe the schema please"', "claude-js")!.hasSchema).toBe(false);
  });

  it("ignores unknown option keys instead of failing", () => {
    const parsed = parseAgentArgs('"p", { label: "l", somethingNew: "x", nested: { a: 1 } }', "claude-js");
    expect(parsed).toMatchObject({ label: "l", hasSchema: false });
  });

  it("marks a template literal containing ${} as dynamic and keeps the raw source", () => {
    const parsed = parseAgentArgs("`Review ${file} now`, { label: 'x' }", "claude-js");
    expect(parsed!.promptKind).toBe("dynamic");
    expect(parsed!.prompt).toBe("`Review ${file} now`");
    expect(parsed!.label).toBe("x");
  });

  it("treats a plain backtick literal with no hole as literal text", () => {
    const parsed = parseAgentArgs("`just text`", "claude-js");
    expect(parsed!.promptKind).toBe("literal");
    expect(parsed!.prompt).toBe("just text");
  });

  it("marks a variable or expression first argument as dynamic with an excerpt", () => {
    const parsed = parseAgentArgs('d.prompt + suffix, { phase: "Review" }', "claude-js");
    expect(parsed!.promptKind).toBe("dynamic");
    expect(parsed!.prompt).toBe("d.prompt + suffix");
    expect(parsed!.phase).toBe("Review");
  });

  it("unescapes a double-quoted prompt the way the meta parser does", () => {
    const parsed = parseAgentArgs('"say \\"hi\\"\\nthen stop"', "rhai");
    expect(parsed!.prompt).toBe('say "hi"\nthen stop');
  });

  it("does not mistake a comma inside the prompt for the argument separator", () => {
    const parsed = parseAgentArgs('"one, two, three", #{ label: "l" }', "rhai");
    expect(parsed!.prompt).toBe("one, two, three");
    expect(parsed!.label).toBe("l");
  });

  it("does not mistake a comma inside a nested call for the argument separator", () => {
    const parsed = parseAgentArgs('buildPrompt(a, b), { label: "l" }', "claude-js");
    expect(parsed!.promptKind).toBe("dynamic");
    expect(parsed!.prompt).toBe("buildPrompt(a, b)");
    expect(parsed!.label).toBe("l");
  });

  it("clips an oversized prompt and marks the clip", () => {
    const long = "x".repeat(AGENT_PROMPT_MAX_CHARS + 500);
    const parsed = parseAgentArgs(`"${long}"`, "rhai");
    expect(parsed!.prompt!.length).toBe(AGENT_PROMPT_MAX_CHARS + 1);
    expect(parsed!.prompt!.endsWith("…")).toBe(true);
  });

  it("returns null for arguments it cannot read at all", () => {
    expect(parseAgentArgs("", "rhai")).toBeNull();
    expect(parseAgentArgs("   ", "rhai")).toBeNull();
    // Unterminated literal: the caller counts this as an opaque call site.
    expect(parseAgentArgs('"never closed', "rhai")).toBeNull();
  });

  it("survives an options block that is not a block at all", () => {
    const parsed = parseAgentArgs('"p", opts', "claude-js");
    expect(parsed).toMatchObject({ promptKind: "literal", prompt: "p", hasSchema: false });
    expect(parsed!.label).toBeUndefined();
  });
});

describe("extractMetaPhases", () => {
  it("reads a Rhai phases array with titles and details", () => {
    const block = `#{
      name: "w",
      phases: [
        #{ title: "Review", detail: "one agent per dimension" },
        #{ title: "Verify" },
      ],
    }`;
    expect(extractMetaPhases(block, "rhai")).toEqual([
      { title: "Review", detail: "one agent per dimension" },
      { title: "Verify", detail: undefined },
    ]);
  });

  it("reads a JS phases array", () => {
    const block = `{ name: 'w', phases: [ { title: 'Scan', detail: 'grep logs' }, { title: 'Fix' } ] }`;
    expect(extractMetaPhases(block, "claude-js")).toEqual([
      { title: "Scan", detail: "grep logs" },
      { title: "Fix", detail: undefined },
    ]);
  });

  it("is not fooled by brackets or braces inside strings", () => {
    const block = `{ phases: [ { title: 'a ] } weird', detail: 'has ] and }' }, { title: 'b' } ] }`;
    expect(extractMetaPhases(block, "claude-js").map((p) => p.title)).toEqual(["a ] } weird", "b"]);
  });

  it("returns [] when there is no phases key, or it is unreadable", () => {
    expect(extractMetaPhases(`{ name: 'w' }`, "claude-js")).toEqual([]);
    expect(extractMetaPhases(`{ phases: [ { title: 'x' }`, "claude-js")).toEqual([]);
    expect(extractMetaPhases("", "claude-js")).toEqual([]);
  });

  it("skips a phase entry with no readable title rather than rendering a blank row", () => {
    const block = `{ phases: [ { detail: 'no title here' }, { title: 'Real' } ] }`;
    expect(extractMetaPhases(block, "claude-js")).toEqual([{ title: "Real", detail: undefined }]);
  });
});

describe("parseWorkflowDetail — Rhai fixture", () => {
  const detail = parseWorkflowDetail(fixture("review-changes.rhai"), "rhai");

  it("recovers meta, phases and every agent call", () => {
    expect(detail.name).toBe("review-changes");
    expect(detail.description).toBe(
      "Review changed files across dimensions, then verify each finding",
    );
    expect(detail.phases).toEqual([
      { title: "Review", detail: "one agent per dimension" },
      { title: "Verify", detail: "adversarially refute each finding" },
    ]);
    expect(detail.agentCallSites).toBe(3);
    expect(detail.agents).toHaveLength(3);
    expect(detail.opaqueAgentCalls).toBe(0);
    expect(detail.overflowAgentCalls).toBe(0);
    expect(detail.truncated).toBe(false);
  });

  it("does not count the commented-out agent call", () => {
    expect(detail.agents.some((a) => a.prompt?.includes("commented out"))).toBe(false);
  });

  it("carries each agent's settings", () => {
    expect(detail.agents[0]).toMatchObject({
      index: 1,
      promptKind: "literal",
      label: "review:correctness",
      model: "sonnet",
      effort: "high",
      hasSchema: true,
      inferredPhase: "Review",
    });
    expect(detail.agents[0].prompt).toContain("correctness bugs (report each as file:line)");
    expect(detail.agents[1]).toMatchObject({ label: "review:perf", effort: "low", hasSchema: false });
    expect(detail.agents[2]).toMatchObject({
      label: "verify",
      agentType: "code-reviewer",
      isolation: "worktree",
      inferredPhase: "Verify",
    });
  });
});

describe("parseWorkflowDetail — Claude JS fixture", () => {
  const detail = parseWorkflowDetail(fixture("spot-review-fanout.js"), "claude-js");

  it("recovers meta and phases", () => {
    expect(detail.name).toBe("spot-review-fanout");
    expect(detail.description).toBe("Review every rendered spot across four lenses");
    expect(detail.phases).toEqual([
      { title: "Review", detail: "four lenses per spot" },
      { title: "Synthesize", detail: undefined },
    ]);
  });

  it("finds agents nested inside pipeline() and marks the template-literal prompt dynamic", () => {
    expect(detail.agentCallSites).toBe(3);
    expect(detail.agents[0]).toMatchObject({ promptKind: "dynamic", phase: "Review" });
    expect(detail.agents[0].prompt).toContain("${lens}");
    expect(detail.agents[1]).toMatchObject({ promptKind: "literal", model: "haiku" });
  });

  it("infers a phase from the nearest preceding phase() statement", () => {
    expect(detail.agents[1].inferredPhase).toBe("Review");
    expect(detail.agents[2]).toMatchObject({ inferredPhase: "Synthesize", hasSchema: true });
  });
});

describe("parseWorkflowDetail — degraded and edge shapes", () => {
  it("an agent-free script reports zero call sites rather than looking broken", () => {
    const src = [
      "export const meta = { name: 'noop', description: 'builds steps dynamically' };",
      "phase('Run');",
      "const out = await pipeline(items, (i) => transform(i));",
    ].join("\n");
    const d = parseWorkflowDetail(src, "claude-js");
    expect(d.agentCallSites).toBe(0);
    expect(d.agents).toEqual([]);
    expect(d.opaqueAgentCalls).toBe(0);
    expect(d.overflowAgentCalls).toBe(0);
    expect(d.name).toBe("noop");
  });

  it("counts unreadable calls as opaque, distinct from a script with none", () => {
    const d = parseWorkflowDetail('agent();\nagent( );\nagent("real");', "claude-js");
    expect(d.agentCallSites).toBe(3);
    expect(d.agents).toHaveLength(1);
    expect(d.opaqueAgentCalls).toBe(2);
    expect(d.overflowAgentCalls).toBe(0);
  });

  it("counts sites past the cap as overflow, never as opaque", () => {
    const many = Array.from({ length: WORKFLOW_AGENT_CAP + 5 }, (_, i) => `agent("p${i}");`).join("\n");
    const d = parseWorkflowDetail(many, "claude-js");
    expect(d.agentCallSites).toBe(WORKFLOW_AGENT_CAP + 5);
    expect(d.agents).toHaveLength(WORKFLOW_AGENT_CAP);
    expect(d.overflowAgentCalls).toBe(5);
    expect(d.opaqueAgentCalls).toBe(0);
  });

  it("stamps the host-observed truncated flag through, defaulting to false", () => {
    const src = 'agent("p");';
    expect(parseWorkflowDetail(src, "claude-js").truncated).toBe(false);
    expect(parseWorkflowDetail(src, "claude-js", {}).truncated).toBe(false);
    expect(parseWorkflowDetail(src, "claude-js", { truncated: true }).truncated).toBe(true);
  });

  it("still describes the agents when there is no meta block at all", () => {
    const d = parseWorkflowDetail('phase("Go");\nagent("do it", { label: "x" });', "claude-js");
    expect(d.name).toBeUndefined();
    expect(d.description).toBeUndefined();
    expect(d.phases).toEqual([]);
    expect(d.agents).toHaveLength(1);
    expect(d.agents[0]).toMatchObject({ label: "x", inferredPhase: "Go" });
  });

  it("leaves inferredPhase unset for an agent that precedes every phase() call", () => {
    const d = parseWorkflowDetail('agent("early");\nphase("Later");\nagent("late");', "claude-js");
    expect(d.agents[0].inferredPhase).toBeUndefined();
    expect(d.agents[1].inferredPhase).toBe("Later");
  });

  it("never throws on junk input", () => {
    for (const junk of ["", "   ", "}{)(", "let meta = #{", 'agent("unclosed']) {
      expect(() => parseWorkflowDetail(junk, "rhai")).not.toThrow();
    }
  });
});

describe("resolveWorkflowDetailPath", () => {
  const WS = path.join(path.sep === "\\" ? "C:\\ws" : "/ws");
  const GROK_ROOT = path.join(WS, ".grok", "workflows");
  const CLAUDE_ROOT = path.join(WS, ".claude", "workflows");
  const ROOTS = [GROK_ROOT, CLAUDE_ROOT];
  /** Default resolver: the path resolves to itself (no symlinks in play). */
  const identity = (p: string) => p;

  const resolve = (requestedPath: string, opts: Partial<{ allowedRoots: string[]; realpath: (p: string) => string | null }> = {}) =>
    resolveWorkflowDetailPath({
      requestedPath,
      allowedRoots: opts.allowedRoots ?? ROOTS,
      realpath: opts.realpath ?? identity,
    });

  it("accepts a .rhai file inside an allowed root", () => {
    const p = path.join(GROK_ROOT, "review-changes.rhai");
    expect(resolve(p)).toEqual({ ok: true, path: p, format: "rhai" });
  });

  it("accepts a .js file inside an allowed root and reports the Claude format", () => {
    const p = path.join(CLAUDE_ROOT, "spot-review-fanout.js");
    expect(resolve(p)).toEqual({ ok: true, path: p, format: "claude-js" });
  });

  it("accepts a nested file inside a root", () => {
    const p = path.join(GROK_ROOT, "sub", "nested.rhai");
    expect(resolve(p).ok).toBe(true);
  });

  it("refuses a path outside every allowed root", () => {
    const p = path.join(WS, "src", "evil.rhai");
    expect(resolve(p)).toEqual({ ok: false, error: "not-a-workflow-path" });
  });

  it("refuses a symlink that escapes the root, judging the RESOLVED path", () => {
    const requested = path.join(GROK_ROOT, "innocent.rhai");
    const escaped = path.join(path.sep === "\\" ? "C:\\Users\\me" : "/home/me", ".ssh", "id_rsa.rhai");
    expect(resolve(requested, { realpath: () => escaped })).toEqual({
      ok: false,
      error: "not-a-workflow-path",
    });
  });

  it("refuses a workflow in a root this session was not given", () => {
    const p = path.join(CLAUDE_ROOT, "other.js");
    expect(resolve(p, { allowedRoots: [GROK_ROOT] })).toEqual({
      ok: false,
      error: "not-a-workflow-path",
    });
  });

  it("refuses everything when the allowed-root list is empty — fail closed", () => {
    expect(resolve(path.join(GROK_ROOT, "x.rhai"), { allowedRoots: [] })).toEqual({
      ok: false,
      error: "not-a-workflow-path",
    });
  });

  it("refuses a non-workflow extension", () => {
    for (const name of ["notes.md", "secrets.env", "script.ts", "noextension"]) {
      expect(resolve(path.join(GROK_ROOT, name))).toEqual({
        ok: false,
        error: "not-a-workflow-path",
      });
    }
  });

  it("accepts an uppercase extension", () => {
    const p = path.join(GROK_ROOT, "SHOUTY.RHAI");
    expect(resolve(p)).toMatchObject({ ok: true, format: "rhai" });
  });

  it("refuses when the resolved path is not a workflow even though the request looked like one", () => {
    const requested = path.join(GROK_ROOT, "looks-fine.rhai");
    const real = path.join(GROK_ROOT, "actually.txt");
    expect(resolve(requested, { realpath: () => real })).toEqual({
      ok: false,
      error: "not-a-workflow-path",
    });
  });

  it("reports read-failed when the path will not resolve — deleted between scan and click", () => {
    const p = path.join(GROK_ROOT, "gone.rhai");
    expect(resolve(p, { realpath: () => null })).toEqual({ ok: false, error: "read-failed" });
    expect(
      resolve(p, {
        realpath: () => {
          throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
        },
      }),
    ).toEqual({ ok: false, error: "read-failed" });
  });

  it("refuses an empty or whitespace request without touching the filesystem", () => {
    let called = 0;
    const spy = (p: string) => {
      called++;
      return p;
    };
    expect(resolve("", { realpath: spy })).toEqual({ ok: false, error: "not-a-workflow-path" });
    expect(resolve("   ", { realpath: spy })).toEqual({ ok: false, error: "not-a-workflow-path" });
    expect(called).toBe(0);
  });
});

describe("rootEnabled (exported for the detail read)", () => {
  it("honors the same disabledByEnv switch the scan honors", () => {
    const workflowRoot = CAPABILITY_ROOTS.grok.find((r) => r.kind === "workflow");
    expect(workflowRoot).toBeDefined();
    expect(rootEnabled(workflowRoot!, {})).toBe(true);
    if (workflowRoot!.disabledByEnv) {
      expect(rootEnabled(workflowRoot!, { [workflowRoot!.disabledByEnv]: "false" })).toBe(false);
    }
  });
});
