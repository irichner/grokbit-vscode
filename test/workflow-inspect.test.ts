// Pure tests for the workflow deep-inspection parser (src/workflow-inspect.ts).
// Never executes a workflow script — every case here is text in, structure out.
//
// The fixture shape is the spec until a real saved workflow is captured from
// either CLI (see `.grokbit/plans/workflow-details-inspector/assumptions.md`
// A5/A6): no `.rhai` or `.claude/workflows/*.js` file exists on this machine,
// so these cases encode the documented call shape, and the parser's contract is
// that anything it cannot read is COUNTED, never guessed at.
import { describe, expect, it } from "vitest";

import { findCallSites, parseAgentArgs, AGENT_PROMPT_MAX_CHARS } from "../src/workflow-inspect";

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
