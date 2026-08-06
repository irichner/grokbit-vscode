import { describe, it, expect } from "vitest";
// @ts-expect-error — plain JS module, no types
import { looksLikeFileRef, isSafeHref, formatRelativeTime, FILE_EXTS, modelDisplayName, nextMicState, trailingSendPhrase, buildQuestionAnswers, isSubagentToolCall, subagentLabel, shouldStickToBottom, clampScrollTop, splitMath, stripUnsupportedTex, parseAttachmentContext, formatTokenCount, formatLauncherMeta, formatLauncherMetaTooltip, activityPeek, activityPosText, backendBadgeLabel, inferPermissionKind, permissionDiffFromRawInput, sessionSetupModel, sessionSetupChipLabel, capabilityGroupsView, sessionToggleGroup, CAPABILITY_FEATURED, CAPABILITY_FEATURED_FALLBACK, SHOW_USER_WORKFLOWS, CAPABILITY_VISIBLE_KINDS, visibleCapabilityGroups, userWorkflowsPanelState, withCreateWorkflowTile, CAPABILITY_ROW_DESCRIPTION_MAX, capabilityDisplayLabel, capabilityInvokeLabel, defaultWorkflowGraphFromGoal, validateWorkflowBuilderDraft, buildWorkflowCraftBrief, workflowDetailToBuilderDraft, workflowDetailView, USER_PROMPT_COLLAPSE_MIN_CHARS, userPromptShouldCollapse } from "../media/webview-helpers.js";
import { buildPrompt } from "../src/prompt-builder";
import { makeExplicitChip, makeImplicitChip } from "../src/chips";

describe("looksLikeFileRef", () => {
  it("accepts a bare filename with a known extension", () => {
    expect(looksLikeFileRef("package.json")).toBe(true);
    expect(looksLikeFileRef("CLAUDE.md")).toBe(true);
    expect(looksLikeFileRef("AGENTS.md")).toBe(true);
    expect(looksLikeFileRef("tsconfig.json")).toBe(true);
  });

  it("accepts a path with separators", () => {
    expect(looksLikeFileRef("src/sidebar.ts")).toBe(true);
    expect(looksLikeFileRef("media/chat.js")).toBe(true);
    expect(looksLikeFileRef("test\\sessions.test.ts")).toBe(true);
  });

  it("accepts a path with a :line suffix and strips it before checking", () => {
    expect(looksLikeFileRef("src/sidebar.ts:42")).toBe(true);
    expect(looksLikeFileRef("media/chat.js:1-100")).toBe(true);
  });

  it("accepts a path with a #Lstart-Lend anchor", () => {
    expect(looksLikeFileRef("src/sidebar.ts#L10-L20")).toBe(true);
  });

  it("is case-insensitive on the extension", () => {
    expect(looksLikeFileRef("Foo.TS")).toBe(true);
    expect(looksLikeFileRef("Bar.Json")).toBe(true);
  });

  it("rejects plain identifiers without an extension", () => {
    expect(looksLikeFileRef("undefined")).toBe(false);
    expect(looksLikeFileRef("null")).toBe(false);
    expect(looksLikeFileRef("foo")).toBe(false);
    expect(looksLikeFileRef("myVariable")).toBe(false);
  });

  it("rejects unknown extensions", () => {
    expect(looksLikeFileRef("foo.unknownextname")).toBe(false);
    expect(looksLikeFileRef("foo.xyz")).toBe(false);
  });

  it("rejects strings with whitespace or shell metacharacters", () => {
    expect(looksLikeFileRef("foo bar.ts")).toBe(false);
    expect(looksLikeFileRef("rm -rf foo.ts")).toBe(false);
    expect(looksLikeFileRef('"foo.ts"')).toBe(false);
    expect(looksLikeFileRef("a;b.ts")).toBe(false);
    expect(looksLikeFileRef("a|b.ts")).toBe(false);
    expect(looksLikeFileRef("a&b.ts")).toBe(false);
  });

  it("rejects empty, null-ish, or absurdly long strings", () => {
    expect(looksLikeFileRef("")).toBe(false);
    expect(looksLikeFileRef(null as unknown as string)).toBe(false);
    expect(looksLikeFileRef(undefined as unknown as string)).toBe(false);
    expect(looksLikeFileRef("a".repeat(201) + ".ts")).toBe(false);
  });

  it("rejects code-looking spans with a trailing dot only", () => {
    expect(looksLikeFileRef("obj.")).toBe(false);
    expect(looksLikeFileRef(".")).toBe(false);
  });

  it("FILE_EXTS exposes the configured set", () => {
    expect(FILE_EXTS.has("ts")).toBe(true);
    expect(FILE_EXTS.has("json")).toBe(true);
    expect(FILE_EXTS.has("lock")).toBe(true);
    expect(FILE_EXTS.has("env")).toBe(true);
    expect(FILE_EXTS.has("gitignore")).toBe(true);
    expect(FILE_EXTS.has("zzz")).toBe(false);
  });
});

describe("formatRelativeTime", () => {
  const now = Date.UTC(2026, 4, 22, 12, 0, 0);

  it("returns '' for falsy timestamps", () => {
    expect(formatRelativeTime(0, now)).toBe("");
    expect(formatRelativeTime(undefined, now)).toBe("");
    expect(formatRelativeTime(null, now)).toBe("");
  });

  it("formats seconds when under a minute", () => {
    expect(formatRelativeTime(now - 5_000, now)).toBe("5s ago");
    expect(formatRelativeTime(now - 30_000, now)).toBe("30s ago");
  });

  it("formats minutes when under an hour", () => {
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 45 * 60_000, now)).toBe("45m ago");
  });

  it("formats hours when under a day", () => {
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
    expect(formatRelativeTime(now - 23 * 3_600_000, now)).toBe("23h ago");
  });

  it("formats days when under a week", () => {
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
    expect(formatRelativeTime(now - 6 * 86_400_000, now)).toBe("6d ago");
  });

  it("falls back to localeDateString for timestamps older than a week", () => {
    const ts = now - 30 * 86_400_000;
    const out = formatRelativeTime(ts, now);
    expect(out).not.toMatch(/ago$/);
    expect(out.length).toBeGreaterThan(0);
  });

  it("uses Date.now() when no second arg is provided", () => {
    const out = formatRelativeTime(Date.now() - 2_000);
    expect(out).toMatch(/s ago$/);
  });
});

describe("modelDisplayName", () => {
  const models = [
    { modelId: "grok-build", name: "Grok Build" },
    { modelId: "grok-composer-2.5-fast", name: "Composer 2.5 Fast" },
  ];

  it("resolves a model ID to its user-facing name", () => {
    expect(modelDisplayName("grok-build", models)).toBe("Grok Build");
    expect(modelDisplayName("grok-composer-2.5-fast", models)).toBe("Composer 2.5 Fast");
  });

  it("falls back to the ID when the model is unknown or unnamed", () => {
    expect(modelDisplayName("grok-mystery", models)).toBe("grok-mystery");
    expect(modelDisplayName("grok-build", [{ modelId: "grok-build" }])).toBe("grok-build");
    expect(modelDisplayName("grok-build", [])).toBe("grok-build");
    expect(modelDisplayName("grok-build", undefined)).toBe("grok-build");
  });

  it("returns '' for a falsy model ID", () => {
    expect(modelDisplayName("", models)).toBe("");
    expect(modelDisplayName(undefined, models)).toBe("");
  });
});

describe("parseAttachmentContext", () => {
  const deps = { readFile: () => "", extName: (p: string) => (p.includes(".") ? p.slice(p.lastIndexOf(".")) : "") };

  it("returns the input as body with no files when there's no envelope", () => {
    expect(parseAttachmentContext("just a message")).toEqual({ files: [], body: "just a message" });
  });

  it("round-trips a single attached file from buildPrompt", () => {
    const prompt = buildPrompt("fix it", [makeExplicitChip("/x/CLAUDE.md", "CLAUDE.md")], deps);
    expect(parseAttachmentContext(prompt)).toEqual({ files: ["CLAUDE.md"], body: "fix it" });
  });

  it("round-trips multiple attached files + an open-editor file", () => {
    const prompt = buildPrompt(
      "compare these",
      [
        makeExplicitChip("/x/CLAUDE.md", "CLAUDE.md"),
        makeExplicitChip("/d/pic.png", "c:\\Users\\Dell\\Downloads\\pic.png"),
        makeImplicitChip("/x/src/foo.ts", "src/foo.ts"),
      ],
      deps,
    );
    expect(parseAttachmentContext(prompt)).toEqual({
      files: ["CLAUDE.md", "c:\\Users\\Dell\\Downloads\\pic.png", "src/foo.ts"],
      body: "compare these",
    });
  });

  it("keeps a fenced selection block in the body (it's not part of the envelope)", () => {
    const prompt = buildPrompt("what is this", [makeExplicitChip("/x/a.ts", "a.ts", 1, 1)], {
      readFile: () => "const x = 1;",
      extName: () => ".ts",
    });
    const { files, body } = parseAttachmentContext(prompt);
    expect(files).toEqual([]);
    expect(body).toContain("```ts");
    expect(body).toContain("what is this");
  });
});

describe("nextMicState", () => {
  it("start enters 'connecting' (the listening waves come from the host, not the reducer)", () => {
    expect(nextMicState("idle", "start")).toBe("connecting");
    expect(nextMicState("listening", "stop")).toBe("transcribing");
    expect(nextMicState("transcribing", "transcript")).toBe("idle");
  });

  it("is stoppable while connecting (cancel before the stream is ready)", () => {
    expect(nextMicState("connecting", "stop")).toBe("transcribing");
  });

  it("resets to idle on error or reset from any state", () => {
    expect(nextMicState("connecting", "error")).toBe("idle");
    expect(nextMicState("listening", "error")).toBe("idle");
    expect(nextMicState("transcribing", "error")).toBe("idle");
    expect(nextMicState("listening", "reset")).toBe("idle");
  });

  it("does not start a new recording while transcribing or already active", () => {
    expect(nextMicState("transcribing", "start")).toBe("transcribing");
    expect(nextMicState("listening", "start")).toBe("listening");
  });

  it("ignores stop from idle or transcribing", () => {
    expect(nextMicState("idle", "stop")).toBe("idle");
    expect(nextMicState("transcribing", "stop")).toBe("transcribing");
  });

  it("ignores unknown events", () => {
    expect(nextMicState("listening", "wat")).toBe("listening");
  });
});

describe("trailingSendPhrase", () => {
  it("locates a trailing 'grok send' (returns its range)", () => {
    expect(trailingSendPhrase("fix the bug grok send", "grok send")).toEqual({ index: 12, length: 9 });
  });

  it("is case-insensitive and highlights only the phrase, not trailing punctuation", () => {
    const r = trailingSendPhrase("Refactor this Grok Send!", "grok send");
    expect(r).not.toBeNull();
    // The "!" stays part of the message, so it is NOT inside the highlighted span.
    expect("Refactor this Grok Send!".slice(r!.index, r!.index + r!.length)).toBe("Grok Send");
  });

  it("does NOT match a non-trailing or partial occurrence", () => {
    expect(trailingSendPhrase("explain grok send to me", "grok send")).toBeNull();
    expect(trailingSendPhrase("press send", "grok send")).toBeNull();
  });

  it("also highlights the 'grok sent' STT variant", () => {
    const r = trailingSendPhrase("add a button grok sent", "grok send");
    expect(r).not.toBeNull();
    expect("add a button grok sent".slice(r!.index, r!.index + r!.length)).toBe("grok sent");
  });

  it("does NOT match a bare 'sent' without 'grok' before it", () => {
    expect(trailingSendPhrase("the file was sent", "grok send")).toBeNull();
    expect(trailingSendPhrase("make sure it gets sent", "grok send")).toBeNull();
  });

  it("returns null for empty text or empty phrase", () => {
    expect(trailingSendPhrase("", "grok send")).toBeNull();
    expect(trailingSendPhrase("grok send", "")).toBeNull();
    expect(trailingSendPhrase(null as unknown as string, "grok send")).toBeNull();
  });

  it("supports a custom phrase", () => {
    expect(trailingSendPhrase("do it now go", "go")).toEqual({ index: 10, length: 2 });
  });
});

describe("buildQuestionAnswers", () => {
  it("keys the answer map by question text → chosen label", () => {
    const questions = [{ question: "Pick a color?", options: [{ label: "Red" }, { label: "Blue" }] }];
    const { answers, allAnswered } = buildQuestionAnswers(questions, [["Blue"]]);
    expect(answers).toEqual({ "Pick a color?": "Blue" });
    expect(allAnswered).toBe(true);
  });

  it("joins multi-select labels with ', '", () => {
    const questions = [{ question: "Which?", options: [], multiSelect: true }];
    const { answers } = buildQuestionAnswers(questions, [["A", "C"]]);
    expect(answers).toEqual({ "Which?": "A, C" });
  });

  it("flags allAnswered=false while any question is unanswered", () => {
    const questions = [{ question: "Q1" }, { question: "Q2" }];
    const r = buildQuestionAnswers(questions, [["A"], []]);
    expect(r.allAnswered).toBe(false);
    expect(r.answers).toEqual({ Q1: "A", Q2: "" });
  });

  it("handles empty / missing inputs", () => {
    expect(buildQuestionAnswers([], [])).toEqual({ answers: {}, allAnswered: true });
    expect(buildQuestionAnswers(undefined, undefined)).toEqual({ answers: {}, allAnswered: true });
  });
});

describe("isSubagentToolCall", () => {
  it("matches grok's confirmed spawn_subagent shape", () => {
    // Real shape from grok 0.2.33 (research/subagents.md): tool `spawn_subagent`
    // with a `subagent_type` parameter.
    expect(isSubagentToolCall({
      title: "spawn_subagent",
      rawInput: { subagent_type: "general-purpose", prompt: "investigate" },
    })).toBe(true);
  });

  it("matches by tool name", () => {
    expect(isSubagentToolCall({ tool: "task" })).toBe(true);
    expect(isSubagentToolCall({ name: "spawn_agent" })).toBe(true);
    expect(isSubagentToolCall({ name: "run_subagent" })).toBe(true);
    expect(isSubagentToolCall({ title: "Delegate" })).toBe(true);
  });

  it("matches by kind", () => {
    expect(isSubagentToolCall({ kind: "subagent" })).toBe(true);
    expect(isSubagentToolCall({ kind: "agent" })).toBe(true);
  });

  it("matches by rawInput shape", () => {
    expect(isSubagentToolCall({ tool: "x", rawInput: { subagent_type: "tester" } })).toBe(true);
    expect(isSubagentToolCall({ tool: "x", input: { agentType: "reviewer" } })).toBe(true);
  });

  it("does not match ordinary tools", () => {
    expect(isSubagentToolCall({ tool: "read_file", kind: "read" })).toBe(false);
    expect(isSubagentToolCall({ tool: "bash", kind: "execute" })).toBe(false);
    expect(isSubagentToolCall(null)).toBe(false);
    expect(isSubagentToolCall({})).toBe(false);
  });

  it("does NOT match grok's get_command_or_subagent_output poller", () => {
    // Native-Windows grok 0.2.x delegates via a background run_terminal_command
    // and reads its output with `get_command_or_subagent_output` (variant
    // "TaskOutput", task_id). That output reader's NAME contains "subagent" but
    // it is not a delegation — it must never get a Subagent card. Verbatim wire
    // shape from research/subagents.md.
    expect(isSubagentToolCall({ title: "get_command_or_subagent_output", rawInput: { task_id: "t1" } })).toBe(false);
    expect(isSubagentToolCall({ title: "Get task output: t1", rawInput: { variant: "TaskOutput", task_id: "t1", block: true } })).toBe(false);
  });

  it("matches grok 0.2.x's background-task delegation (its real subagent mechanism)", () => {
    // No spawn_subagent on the native build — a delegation is a backgrounded
    // run_terminal_command (research/subagents.md § Ground truth). Card it so it
    // doesn't disappear into the generic tool group.
    expect(isSubagentToolCall({ title: "run_terminal_command", rawInput: { variant: "Bash", command: "Spawn background subagent to investigate", is_background: true } })).toBe(true);
    expect(isSubagentToolCall({ title: "[bg] Background task t1 started", rawInput: { variant: "Bash" } })).toBe(true);
  });

  it("does NOT match a foreground run_terminal_command", () => {
    // A normal command (is_background false or absent) stays in the tool group —
    // this is the shape grok used in the real session that prompted the fix.
    expect(isSubagentToolCall({ title: "run_terminal_command", rawInput: { variant: "Bash", command: "git status", is_background: false } })).toBe(false);
    expect(isSubagentToolCall({ title: "run_terminal_command", rawInput: { variant: "Bash", command: "git status" } })).toBe(false);
  });
});

describe("subagentLabel", () => {
  it("prefers the named agent type", () => {
    expect(subagentLabel({ title: "spawn_subagent", rawInput: { subagent_type: "general-purpose" } })).toBe("general-purpose");
    expect(subagentLabel({ tool: "task", rawInput: { subagent_type: "tester" } })).toBe("tester");
    expect(subagentLabel({ tool: "task", input: { agentType: "Explore" } })).toBe("Explore");
    expect(subagentLabel({ tool: "task", rawInput: { description: "Fix the build" } })).toBe("Fix the build");
  });

  it("derives a label from the backgrounded command, truncating if long", () => {
    expect(subagentLabel({ title: "run_terminal_command", rawInput: { command: "investigate the parser", is_background: true } })).toBe("investigate the parser");
    const long = subagentLabel({ rawInput: { command: "x".repeat(80), is_background: true } });
    expect(long.endsWith("…")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(48);
  });

  it("falls back to a generic label", () => {
    expect(subagentLabel({ tool: "task" })).toBe("Subagent");
    expect(subagentLabel({ rawInput: { is_background: true } })).toBe("background task");
    expect(subagentLabel(null)).toBe("Subagent");
  });
});

describe("shouldStickToBottom", () => {
  it("is pinned when scrolled exactly to the bottom", () => {
    // scrollTop + clientHeight === scrollHeight
    expect(shouldStickToBottom(900, 1000, 100)).toBe(true);
  });

  it("is pinned when within the default threshold of the bottom", () => {
    // 30px from the bottom (default threshold 40)
    expect(shouldStickToBottom(870, 1000, 100)).toBe(true);
  });

  it("is NOT pinned once scrolled up past the threshold", () => {
    // 200px from the bottom — the user is reading history (#16)
    expect(shouldStickToBottom(700, 1000, 100)).toBe(false);
  });

  it("is pinned when content fits without scrolling", () => {
    // scrollHeight <= clientHeight, scrollTop 0 → distance is negative
    expect(shouldStickToBottom(0, 80, 100)).toBe(true);
  });

  it("honors a custom threshold", () => {
    // 150px from bottom: pinned only with a generous threshold
    expect(shouldStickToBottom(750, 1000, 100, 200)).toBe(true);
    expect(shouldStickToBottom(750, 1000, 100, 50)).toBe(false);
  });
});

describe("clampScrollTop", () => {
  it("clamps below 0 and non-finite to 0", () => {
    expect(clampScrollTop(-10, 1000, 200)).toBe(0);
    expect(clampScrollTop(NaN, 1000, 200)).toBe(0);
  });

  it("clamps above maxScroll", () => {
    // max = 1000 - 200 = 800
    expect(clampScrollTop(9999, 1000, 200)).toBe(800);
  });

  it("passes through an in-range value", () => {
    expect(clampScrollTop(400, 1000, 200)).toBe(400);
  });

  it("restore decision reuses shouldStickToBottom (no second predicate)", () => {
    const top = clampScrollTop(700, 1000, 100);
    expect(shouldStickToBottom(top, 1000, 100)).toBe(false);
    const pinTop = clampScrollTop(900, 1000, 100);
    expect(shouldStickToBottom(pinTop, 1000, 100)).toBe(true);
  });
});

describe("splitMath", () => {
  it("returns the whole string as one text segment when there is no math", () => {
    expect(splitMath("just plain prose with no tex")).toEqual([
      { type: "text", value: "just plain prose with no tex" },
    ]);
  });

  it("extracts inline \\(...\\) math with display:false", () => {
    expect(splitMath("the value \\(x^2\\) here")).toEqual([
      { type: "text", value: "the value " },
      { type: "math", value: "x^2", display: false },
      { type: "text", value: " here" },
    ]);
  });

  it("extracts display \\[...\\] math with display:true", () => {
    expect(splitMath("before\n\\[E = mc^2\\]\nafter")).toEqual([
      { type: "text", value: "before\n" },
      { type: "math", value: "E = mc^2", display: true },
      { type: "text", value: "\nafter" },
    ]);
  });

  it("treats $$...$$ as display math", () => {
    expect(splitMath("$$a+b$$")).toEqual([
      { type: "math", value: "a+b", display: true },
    ]);
  });

  it("handles multiple math spans in one string", () => {
    const segs = splitMath("\\(a\\) and \\(b\\) then \\[c\\]");
    expect(segs.map((s) => s.type)).toEqual(["math", "text", "math", "text", "math"]);
    expect(segs.filter((s) => s.type === "math").map((s) => s.display)).toEqual([
      false,
      false,
      true,
    ]);
  });

  it("supports multi-line display math (e.g. matrices)", () => {
    const src = "\\[\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}\\]";
    const segs = splitMath(src);
    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("math");
    expect(segs[0].display).toBe(true);
    expect(segs[0].value).toContain("\\begin{pmatrix}");
  });

  it("does NOT treat bare dollar amounts as math", () => {
    expect(splitMath("it costs $5 and then $10 total")).toEqual([
      { type: "text", value: "it costs $5 and then $10 total" },
    ]);
  });

  it("leaves empty delimiters as literal text", () => {
    expect(splitMath("a \\(\\) b")).toEqual([
      { type: "text", value: "a \\(\\) b" },
    ]);
  });

  it("coerces null/undefined to an empty result", () => {
    expect(splitMath(null)).toEqual([]);
    expect(splitMath(undefined)).toEqual([]);
  });
});

describe("stripUnsupportedTex", () => {
  it("removes \\label{...} (KaTeX can't render it — shows a red error otherwise)", () => {
    expect(stripUnsupportedTex("f(x) = x^2 \\label{eq:quadratic} + 1")).toBe(
      "f(x) = x^2  + 1",
    );
  });

  it("strips every \\label in an align block, leaving the equations intact", () => {
    const src =
      "\\begin{align} a &= b \\label{one} \\\\ c &= d \\label{two} \\end{align}";
    const out = stripUnsupportedTex(src);
    expect(out).not.toContain("\\label");
    expect(out).toContain("\\begin{align}");
    expect(out).toContain("a &= b");
    expect(out).toContain("c &= d");
  });

  it("tolerates whitespace before the brace", () => {
    expect(stripUnsupportedTex("x \\label {foo} y")).toBe("x  y");
  });

  it("leaves math without \\label unchanged", () => {
    const src = "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}";
    expect(stripUnsupportedTex(src)).toBe(src);
  });

  it("coerces null/undefined to an empty string", () => {
    expect(stripUnsupportedTex(null)).toBe("");
    expect(stripUnsupportedTex(undefined)).toBe("");
  });
});

describe("formatTokenCount", () => {
  it("keeps small counts as plain integers", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(42)).toBe("42");
    expect(formatTokenCount(999)).toBe("999");
  });

  it("uses one decimal for all K values", () => {
    expect(formatTokenCount(1000)).toBe("1.0K");
    expect(formatTokenCount(12500)).toBe("12.5K");
    expect(formatTokenCount(11947)).toBe("11.9K");
    expect(formatTokenCount(100_000)).toBe("100.0K");
    expect(formatTokenCount(512_345)).toBe("512.3K");
  });

  it("uses one decimal for millions", () => {
    expect(formatTokenCount(1_000_000)).toBe("1.0M");
    expect(formatTokenCount(1_503_035)).toBe("1.5M");
  });

  it("uses one decimal for billions", () => {
    expect(formatTokenCount(1_000_000_000)).toBe("1.0B");
    expect(formatTokenCount(1_183_097_859)).toBe("1.2B");
    expect(formatTokenCount(12_500_000_000)).toBe("12.5B");
  });

  // Each tier is selected before rounding, so a value a hair under the next
  // threshold rounds up INTO it and renders as "1000.0<lower unit>". Long-
  // standing at the K/M boundary; the B tier inherits it rather than growing a
  // special case for a one-in-a-billion display edge.
  it("rounds up within the lower tier at a boundary", () => {
    expect(formatTokenCount(999_999)).toBe("1000.0K");
    expect(formatTokenCount(999_999_999)).toBe("1000.0M");
  });

  it("rejects non-finite / negative inputs", () => {
    expect(formatTokenCount(NaN)).toBe("");
    expect(formatTokenCount(-1)).toBe("");
    expect(formatTokenCount(undefined as unknown as number)).toBe("");
  });
});

describe("formatLauncherMeta", () => {
  it("shows version alone when tokens are unknown", () => {
    expect(formatLauncherMeta({ extVersion: "2.0.2" })).toBe("v2.0.2");
  });

  it("does not double-prefix a version that already starts with v", () => {
    expect(formatLauncherMeta({ extVersion: "v1.4.0" })).toBe("v1.4.0");
  });

  it("joins version and compact token count (1 decimal)", () => {
    expect(formatLauncherMeta({ extVersion: "2.0.2", totalTokens: 12_500 })).toBe(
      "v2.0.2 · 12.5K tokens",
    );
    expect(formatLauncherMeta({ extVersion: "2.0.2", totalTokens: 1000 })).toBe(
      "v2.0.2 · 1.0K tokens",
    );
  });

  it("shows tokens alone when version is missing", () => {
    expect(formatLauncherMeta({ totalTokens: 42 })).toBe("42 tokens");
  });

  it("returns empty when neither version nor tokens are known", () => {
    expect(formatLauncherMeta({})).toBe("");
    expect(formatLauncherMeta(undefined as unknown as { extVersion?: string })).toBe("");
  });

  it("treats zero tokens as a known count (not hidden)", () => {
    expect(formatLauncherMeta({ extVersion: "2.0.2", totalTokens: 0 })).toBe(
      "v2.0.2 · 0 tokens",
    );
  });
});

describe("formatLauncherMetaTooltip", () => {
  it("names the scope, dates the figure, and denies it is your usage", () => {
    expect(
      formatLauncherMetaTooltip({
        extVersion: "2.0.4",
        totalTokens: 42_700_000,
        generatedAt: "2026-07-30T12:34:56Z",
      }),
    ).toBe(
      "Grokbit v2.0.4 — 42,700,000 tokens spent developing this extension " +
        "(all maintainers, all sessions, as of 2026-07-30). This is not your usage.",
    );
  });

  it("drops the as-of clause when the stamp is missing or unparseable", () => {
    for (const generatedAt of [undefined, "", "not-a-date"]) {
      const tip = formatLauncherMetaTooltip({
        extVersion: "2.0.4",
        totalTokens: 1234,
        generatedAt,
      });
      expect(tip).not.toContain("as of");
      expect(tip).toContain("1,234 tokens spent developing this extension");
      expect(tip).toContain("This is not your usage.");
    }
  });

  it("falls back to the bare version when no token constant shipped", () => {
    expect(formatLauncherMetaTooltip({ extVersion: "2.0.4" })).toBe("Extension v2.0.4");
    expect(formatLauncherMetaTooltip({})).toBe("");
    expect(
      formatLauncherMetaTooltip(undefined as unknown as { extVersion?: string }),
    ).toBe("");
  });

  it("omits the version segment when the host has none", () => {
    expect(formatLauncherMetaTooltip({ totalTokens: 5 })).toBe(
      "Grokbit — 5 tokens spent developing this extension " +
        "(all maintainers, all sessions). This is not your usage.",
    );
  });
});

// Activity-carousel peek state machine — view -1 means "live" (follow latest).
describe("activityPeek", () => {
  it("steps back from live to the second-newest step", () => {
    expect(activityPeek(-1, 5, -1)).toBe(3);
  });

  it("clamps at the first step", () => {
    expect(activityPeek(0, 5, -1)).toBe(0);
  });

  it("stepping forward onto the newest step returns to live", () => {
    expect(activityPeek(3, 5, 1)).toBe(-1);
    expect(activityPeek(2, 5, 1)).toBe(3);
  });

  it("has nothing to peek at with 0 or 1 steps", () => {
    expect(activityPeek(-1, 0, -1)).toBe(-1);
    expect(activityPeek(-1, 1, -1)).toBe(-1);
  });

  it("re-clamps a stale peek index when the step list shrank", () => {
    expect(activityPeek(9, 3, -1)).toBe(1);
  });
});

describe("activityPosText", () => {
  it("live shows the running total; a peek shows position", () => {
    expect(activityPosText(-1, 7)).toBe("7");
    expect(activityPosText(2, 7)).toBe("3/7");
  });

  it("empty carousel shows nothing", () => {
    expect(activityPosText(-1, 0)).toBe("");
  });
});

// Labels BOTH backends (docs/plans/capability-surfacing-and-history-ux.md § Thread
// 4) — a deliberate reversal of the original "quiet for grok" idiom, for the
// history row only (the status-bar HUD keeps that idiom — see test/status-bar.test.ts,
// unchanged by this reversal).
describe("backendBadgeLabel", () => {
  it("labels a grok row", () => {
    expect(backendBadgeLabel("grok")).toBe("Grok");
  });

  it("labels a Claude row", () => {
    expect(backendBadgeLabel("claude")).toBe("Claude");
  });

  it("defaults a missing/legacy backend field to Grok (rows that predate the field)", () => {
    expect(backendBadgeLabel(undefined)).toBe("Grok");
    expect(backendBadgeLabel("")).toBe("Grok");
  });

  it("never invents a label for a backend it doesn't recognize", () => {
    expect(backendBadgeLabel("something-else")).toBe("");
  });
});

// Claude's session/request_permission carries no toolCall.kind at all — see
// docs/plans/claude-code-backend.md § WP3.
describe("inferPermissionKind", () => {
  it("prefers the payload's own kind when present (grok always has one)", () => {
    expect(inferPermissionKind("edit", "execute", { file_path: "a", content: "x" })).toBe("edit");
  });

  it("falls back to a kind already seen for this toolCallId (Claude's preceding tool_call)", () => {
    expect(inferPermissionKind(undefined, "edit", {})).toBe("edit");
    expect(inferPermissionKind("", "execute", { command: "npm test" })).toBe("execute");
  });

  it("infers Write from file_path + content when nothing else is known", () => {
    expect(inferPermissionKind(undefined, "", { file_path: "notes.txt", content: "hello" })).toBe("write");
  });

  it("infers Edit from file_path + old_string + new_string when nothing else is known", () => {
    expect(inferPermissionKind(undefined, "", {
      file_path: "notes.txt", old_string: "hello", new_string: "goodbye",
    })).toBe("edit");
  });

  it("returns empty when nothing correlates (e.g. a command permission)", () => {
    expect(inferPermissionKind(undefined, "", { command: "npm test" })).toBe("");
    expect(inferPermissionKind(undefined, "", undefined)).toBe("");
    expect(inferPermissionKind(undefined, "", null)).toBe("");
  });
});

describe("permissionDiffFromRawInput", () => {
  it("builds an Edit preview from old_string/new_string", () => {
    expect(permissionDiffFromRawInput(
      { file_path: "src/foo.ts", old_string: "hello", new_string: "goodbye" },
      "edit",
    )).toEqual({ path: "src/foo.ts", oldText: "hello", newText: "goodbye" });
  });

  it("builds a Write preview as an all-added file (no 'before' available client-side)", () => {
    expect(permissionDiffFromRawInput(
      { file_path: "notes.txt", content: "line one\nline two" },
      "write",
    )).toEqual({ path: "notes.txt", oldText: "", newText: "line one\nline two" });
  });

  it("returns null for a non-edit kind (e.g. a command)", () => {
    expect(permissionDiffFromRawInput({ command: "npm test" }, "execute")).toBeNull();
  });

  it("returns null when rawInput has no file_path", () => {
    expect(permissionDiffFromRawInput({ old_string: "a", new_string: "b" }, "edit")).toBeNull();
  });

  it("returns null when rawInput is missing entirely", () => {
    expect(permissionDiffFromRawInput(undefined, "edit")).toBeNull();
    expect(permissionDiffFromRawInput(null, "write")).toBeNull();
  });
});

// Pure view-model shared by the new-tab "Session setup" card and the composer
// quick-settings popover — docs/plans/claude-code-backend.md § WP7.
describe("sessionSetupModel", () => {
  const MODELS = [
    { modelId: "grok-build", name: "Grok Build" },
    { modelId: "grok-code", name: "Grok Code" },
  ];
  const GROK_EFFORT_LEVELS = ["none", "minimal", "low", "medium", "high", "xhigh"];

  it("grok: renders all four rows in order (Agent, Model, Thinking, Mode)", () => {
    const m = sessionSetupModel({
      backend: "grok", modelId: "grok-build", availableModels: MODELS,
      effort: "medium", effortLevels: GROK_EFFORT_LEVELS, mode: "agent",
    });
    expect(m.backend).toBe("grok");
    expect(m.rows.map((r) => r.id)).toEqual(["agent", "model", "thinking", "mode"]);
  });

  it("claude: omits the Thinking row entirely (no effort axis) rather than rendering it empty", () => {
    const m = sessionSetupModel({
      backend: "claude", modelId: "sonnet",
      availableModels: [{ modelId: "sonnet", name: "Sonnet" }],
      effort: "", effortLevels: [], mode: "agent",
    });
    expect(m.rows.map((r) => r.id)).toEqual(["agent", "model", "mode"]);
    expect(m.rows.find((r) => r.id === "thinking")).toBeUndefined();
  });

  it("Agent row selects the current backend and offers both", () => {
    const m = sessionSetupModel({ backend: "claude", effortLevels: [] });
    const agent = m.rows.find((r) => r.id === "agent")!;
    expect(agent.kind).toBe("segmented");
    expect(agent.selectedId).toBe("claude");
    expect(agent.options).toEqual([
      { id: "grok", label: "Grok Build", selected: false },
      { id: "claude", label: "Claude Code", selected: true },
    ]);
  });

  it("Model row resolves the selected option from availableModels", () => {
    const m = sessionSetupModel({
      backend: "grok", modelId: "grok-code", availableModels: MODELS, effortLevels: GROK_EFFORT_LEVELS,
    });
    const model = m.rows.find((r) => r.id === "model")!;
    expect(model.kind).toBe("dropdown");
    expect(model.selectedId).toBe("grok-code");
    expect(model.options).toEqual([
      { id: "grok-build", label: "Grok Build", selected: false },
      { id: "grok-code", label: "Grok Code", selected: true },
    ]);
  });

  it("Model row: an unknown/stale model id echoes selectedId but marks no option selected", () => {
    const m = sessionSetupModel({
      backend: "grok", modelId: "stale-id", availableModels: MODELS, effortLevels: GROK_EFFORT_LEVELS,
    });
    const model = m.rows.find((r) => r.id === "model")!;
    expect(model.selectedId).toBe("stale-id");
    expect(model.options.every((o) => !o.selected)).toBe(true);
  });

  it("Model row: a missing model id / empty model list degrades to an empty options list", () => {
    const m = sessionSetupModel({ backend: "grok", effortLevels: GROK_EFFORT_LEVELS });
    const model = m.rows.find((r) => r.id === "model")!;
    expect(model.selectedId).toBe("");
    expect(model.options).toEqual([]);
  });

  it("Thinking row fills dots up to the selected level and labels xhigh specially", () => {
    const m = sessionSetupModel({ backend: "grok", effort: "high", effortLevels: GROK_EFFORT_LEVELS });
    const thinking = m.rows.find((r) => r.id === "thinking")!;
    expect(thinking.kind).toBe("dots");
    expect(thinking.selectedId).toBe("high");
    expect(thinking.selectedIndex).toBe(4); // ["none","minimal","low","medium","high","xhigh"]
    expect(thinking.options.find((o) => o.id === "xhigh")!.label).toBe("XHigh");
    expect(thinking.options.filter((o) => o.selected)).toEqual([{ id: "high", label: "High", selected: true }]);
  });

  it("Thinking row: no effort chosen selects nothing (selectedIndex -1)", () => {
    const m = sessionSetupModel({ backend: "grok", effort: "", effortLevels: GROK_EFFORT_LEVELS });
    const thinking = m.rows.find((r) => r.id === "thinking")!;
    expect(thinking.selectedIndex).toBe(-1);
    expect(thinking.options.every((o) => !o.selected)).toBe(true);
  });

  it("Mode row selects the current mode among Agent/Plan/Auto accept", () => {
    const m = sessionSetupModel({ backend: "grok", mode: "plan", effortLevels: GROK_EFFORT_LEVELS });
    const mode = m.rows.find((r) => r.id === "mode")!;
    expect(mode.kind).toBe("segmented");
    expect(mode.selectedId).toBe("plan");
    expect(mode.options.map((o) => o.id)).toEqual(["agent", "plan", "yolo"]);
    expect(mode.options.find((o) => o.id === "plan")!.selected).toBe(true);
  });

  it("defaults an unrecognized backend to grok and mode to agent", () => {
    const m = sessionSetupModel({ backend: "not-a-backend", effortLevels: [] });
    expect(m.backend).toBe("grok");
    expect(m.rows.find((r) => r.id === "agent")!.selectedId).toBe("grok");
    expect(m.rows.find((r) => r.id === "mode")!.selectedId).toBe("agent");
  });

  it("locked:true propagates to every row", () => {
    const m = sessionSetupModel({ backend: "grok", effortLevels: GROK_EFFORT_LEVELS, locked: true });
    expect(m.rows.every((r) => r.locked === true)).toBe(true);
  });

  it("locked is false by default", () => {
    const m = sessionSetupModel({ backend: "grok", effortLevels: GROK_EFFORT_LEVELS });
    expect(m.rows.every((r) => r.locked === false)).toBe(true);
  });

  it("tolerates being called with no options at all", () => {
    const m = sessionSetupModel();
    expect(m.backend).toBe("grok");
    expect(m.rows.map((r) => r.id)).toEqual(["agent", "model", "mode"]); // no effortLevels -> Thinking omitted
  });
});

// Top-bar Session setup chip label (session-setup-top-bar) — pure segments only.
describe("sessionSetupChipLabel", () => {
  it("joins Grok · model · short effort · mode", () => {
    const r = sessionSetupChipLabel({
      backend: "grok", modelName: "Grok Build", effort: "medium", modeId: "agent",
    });
    expect(r.label).toBe("Grok · Grok Build · med · Agent");
    expect(r.title).toContain("Session setup");
    expect(r.title).toMatch(/click to change/i);
    expect(r.title).toContain("Grok Build");
    expect(r.title).toContain("Medium effort");
    expect(r.title).toContain("Agent");
  });

  it("omits effort when empty (Claude / no axis)", () => {
    const r = sessionSetupChipLabel({
      backend: "claude", modelName: "Sonnet", effort: "", modeId: "plan",
    });
    expect(r.label).toBe("Claude · Sonnet · Plan");
    expect(r.label).not.toMatch(/med|min|hig|xhi/);
    expect(r.agentShort).toBe("Claude");
  });

  it("shortens yolo mode to Auto in the label but Auto accept in the title", () => {
    const r = sessionSetupChipLabel({
      backend: "grok", modelName: "Grok Code", effort: "high", modeId: "yolo",
    });
    expect(r.label).toBe("Grok · Grok Code · hig · Auto");
    expect(r.modeShort).toBe("Auto");
    expect(r.modeFull).toBe("Auto accept");
    expect(r.title).toContain("Auto accept");
  });

  it("defaults backend to grok and mode to agent", () => {
    const r = sessionSetupChipLabel({ modelName: "X" });
    expect(r.label).toBe("Grok · X · Agent");
  });
});

// Pure view-model for the capability browser (slash commands, skills, agents) —
// rendered into BOTH the welcome canvas and the top-bar Skills popover by the
// SAME builder. See docs/plans/capability-surfacing-and-history-ux.md § Approach
// (WP2) and test/capabilities.dom.test.ts for the two DOM mounts.
describe("sessionToggleGroup", () => {
  const autoAccept = (modeId?: string, locked?: boolean) =>
    sessionToggleGroup({ modeId, locked }).items[0];

  it("mirrors the tri-state mode onto a two-state switch, naming the OFF target explicitly", () => {
    // "Auto-accept: off" is ambiguous on its own (agent? or back to plan?) —
    // the item has to carry both targets or the renderer would have to guess.
    expect(autoAccept("yolo").on).toBe(true);
    expect(autoAccept("agent").on).toBe(false);
    expect(autoAccept("plan").on).toBe(false);
    expect(autoAccept("agent").onModeId).toBe("yolo");
    expect(autoAccept("yolo").offModeId).toBe("agent");
  });

  it("says that turning it on leaves Plan mode — only while in Plan mode", () => {
    expect(autoAccept("plan").description).toMatch(/Plan mode/);
    expect(autoAccept("agent").description).not.toMatch(/Plan mode/);
    expect(autoAccept("yolo").description).not.toMatch(/Plan mode/);
  });

  it("propagates locked onto every item", () => {
    expect(autoAccept("agent", true).locked).toBe(true);
    expect(autoAccept("agent", false).locked).toBe(false);
  });

  it("is structurally a capability group, so the renderer needs no special case beyond the control branch", () => {
    const g = sessionToggleGroup({ modeId: "agent" });
    expect(g.title).toBe("Session controls");
    expect(g.total).toBe(g.items.length);
    expect(g.remaining).toBe(0);
    // The one thing the renderer keys off — never the kind string.
    expect(g.items.every((i: { control: string }) => i.control === "switch")).toBe(true);
  });

  it("is backend-agnostic — auto-accept is a client-side gate, not a grok quirk", () => {
    expect(sessionToggleGroup({ modeId: "yolo", backend: "claude" })).toEqual(
      sessionToggleGroup({ modeId: "yolo", backend: "grok" }),
    );
  });

  it("defaults to agent mode when called with no opts at all", () => {
    expect(() => sessionToggleGroup()).not.toThrow();
    expect(sessionToggleGroup().items[0].on).toBe(false);
  });
});

describe("visibleCapabilityGroups", () => {
  it("keeps allowlisted kinds and drops skill/agent/command", () => {
    const input = [
      { kind: "grokbit", title: "Grokbit workflow", total: 1, items: [{ kind: "grokbit", name: "grokbit-plan" }] },
      { kind: "workflow", title: "User Workflows", total: 1, items: [{ kind: "workflow", name: "review-changes" }] },
      { kind: "skill", title: "Skills", total: 1, items: [{ kind: "skill", name: "plan" }] },
      { kind: "agent", title: "Agents", total: 1, items: [{ kind: "agent", name: "explore" }] },
      { kind: "command", title: "Commands", total: 1, items: [{ kind: "command", name: "new" }] },
    ];
    const out = visibleCapabilityGroups(input);
    expect(out.map((g: { kind: string }) => g.kind)).toEqual(
      SHOW_USER_WORKFLOWS ? ["grokbit", "workflow"] : ["grokbit"],
    );
  });

  it("drops a group with an unknown kind", () => {
    const out = visibleCapabilityGroups([
      { kind: "persona", title: "Personas", total: 1, items: [{ kind: "persona", name: "x" }] },
      { kind: "grokbit", title: "Grokbit workflow", total: 1, items: [{ kind: "grokbit", name: "grokbit-plan" }] },
      { kind: "workflow", title: "User Workflows", total: 1, items: [{ kind: "workflow", name: "x" }] },
    ]);
    expect(out.map((g: { kind: string }) => g.kind)).toEqual(
      SHOW_USER_WORKFLOWS ? ["grokbit", "workflow"] : ["grokbit"],
    );
  });

  it("returns [] for undefined or non-array input", () => {
    expect(visibleCapabilityGroups(undefined)).toEqual([]);
    expect(visibleCapabilityGroups(null as unknown as never[])).toEqual([]);
    expect(visibleCapabilityGroups({} as unknown as never[])).toEqual([]);
  });

  it("returns a fresh array, not the caller's", () => {
    const input = [
      { kind: "grokbit", title: "Grokbit workflow", total: 1, items: [] },
    ];
    const out = visibleCapabilityGroups(input);
    expect(out).not.toBe(input);
    expect(out).toEqual(input);
  });

  it("exposes CAPABILITY_VISIBLE_KINDS as the allowlist (suite; + user workflows when enabled)", () => {
    expect(CAPABILITY_VISIBLE_KINDS).toEqual(
      SHOW_USER_WORKFLOWS ? ["grokbit", "workflow"] : ["grokbit"],
    );
  });

  it("scope all keeps non-workflow groups", () => {
    const input = [
      { kind: "grokbit", items: [{ name: "a" }] },
      { kind: "skill", items: [{ name: "b" }] },
      { kind: "workflow", items: [{ name: "c" }] },
    ];
    const out = visibleCapabilityGroups(input, { scope: "all" });
    expect(out.map((g: { kind: string }) => g.kind)).toEqual(
      SHOW_USER_WORKFLOWS ? ["grokbit", "skill", "workflow"] : ["grokbit", "skill"],
    );
  });
});

describe("userWorkflowsPanelState", () => {
  it("returns null when User Workflows UI is hidden (SHOW_USER_WORKFLOWS false)", () => {
    if (SHOW_USER_WORKFLOWS) return;
    expect(userWorkflowsPanelState({ backend: "grok", hasWorkflowItems: false })).toBeNull();
    expect(userWorkflowsPanelState({ backend: "claude", hasWorkflowItems: false })).toBeNull();
    expect(userWorkflowsPanelState({ backend: "grok", hasWorkflowItems: true })).toBeNull();
  });

  it("returns null when workflow tiles are present", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    expect(userWorkflowsPanelState({ backend: "grok", hasWorkflowItems: true })).toBeNull();
  });

  it("Grok empty copy points at rhai / create-workflow", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    const s = userWorkflowsPanelState({ backend: "grok", hasWorkflowItems: false });
    expect(s?.showEmpty).toBe(true);
    expect(s?.title).toBe("User Workflows");
    expect(s?.message).toMatch(/\.rhai|create-workflow/i);
    expect(s?.message).not.toMatch(/claude only|grok only/i);
  });

  it("Claude empty copy points at .claude/workflows, not Grok-only dead-end", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    const s = userWorkflowsPanelState({ backend: "claude", hasWorkflowItems: false });
    expect(s?.showEmpty).toBe(true);
    expect(s?.message).toMatch(/\.claude\/workflows/i);
    expect(s?.message).not.toMatch(/available on Grok only|Grok only/i);
  });
});

describe("capabilityDisplayLabel / capabilityInvokeLabel", () => {
  it("Title Cases workflow kebab names and strips grokbit- suite names", () => {
    expect(capabilityDisplayLabel("workflow", "create-workflow")).toBe("Create Workflow");
    expect(capabilityDisplayLabel("workflow", "review-changes")).toBe("Review Changes");
    expect(capabilityDisplayLabel("grokbit", "grokbit-explore")).toBe("Explore");
    expect(capabilityDisplayLabel("skill", "create-workflow")).toBe("create-workflow");
  });

  it("invoke chip is first token of first line only", () => {
    expect(capabilityInvokeLabel("/create-workflow ")).toBe("/create-workflow");
    expect(capabilityInvokeLabel("/create-workflow\n\nMy goal: ")).toBe("/create-workflow");
    expect(capabilityInvokeLabel("/workflow review-changes ")).toBe("/workflow");
  });
});

describe("workflow builder pure helpers", () => {
  it("validate requires goal and kebab name", () => {
    expect(validateWorkflowBuilderDraft({ goal: "", name: "ok-name" }).ok).toBe(false);
    expect(validateWorkflowBuilderDraft({ goal: "  ship it  ", name: "" }).ok).toBe(false);
    expect(validateWorkflowBuilderDraft({ goal: "ship it", name: "Bad_Name" }).ok).toBe(false);
    expect(validateWorkflowBuilderDraft({ goal: "  ship it  ", name: "ship-it" }).ok).toBe(true);
  });

  it("buildWorkflowCraftBrief includes goal, scope, and phases without Constraints section", () => {
    const brief = buildWorkflowCraftBrief({
      goal: "Review PRs",
      name: "review-prs",
      scope: "project",
      phases: defaultWorkflowGraphFromGoal("Review PRs"),
    });
    expect(brief.startsWith("/create-workflow")).toBe(true);
    expect(brief).toMatch(/Review PRs/);
    expect(brief).toMatch(/review-prs/);
    expect(brief).toMatch(/Pipeline structure/);
    expect(brief).toMatch(/Plan/);
    expect(brief).not.toMatch(/## Constraints/);
  });

  it("workflowDetailToBuilderDraft groups agents by inferred phase", () => {
    const draft = workflowDetailToBuilderDraft(
      {
        name: "review-prs",
        description: "from file",
        agents: [
          { label: "planner", inferredPhase: "Plan" },
          { label: "coder", inferredPhase: "Implement" },
        ],
      },
      { goal: "Review PRs safely", scope: "project", name: "review-prs" },
    );
    expect(draft.name).toBe("review-prs");
    expect(draft.goal).toBe("Review PRs safely");
    expect(draft.phases.map((p) => p.title)).toEqual(["Plan", "Implement"]);
    expect(draft.phases[0].agents[0].label).toBe("planner");
    expect(draft.phases[1].agents[0].label).toBe("coder");
  });
});

describe("withCreateWorkflowTile", () => {
  it("is a no-op while User Workflows UI is hidden", () => {
    if (SHOW_USER_WORKFLOWS) return;
    const input = [{ kind: "grokbit", title: "", total: 1, items: [{ kind: "grokbit", name: "grokbit-plan" }] }];
    const out = withCreateWorkflowTile(input, { backend: "grok" });
    expect(out).toEqual(input);
    expect(out.find((g: { kind: string }) => g.kind === "workflow")).toBeUndefined();
  });

  it("Grok with no workflow group gets a User Workflows group with create-workflow first", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    const out = withCreateWorkflowTile(
      [{ kind: "grokbit", title: "", total: 1, items: [{ kind: "grokbit", name: "grokbit-plan" }] }],
      { backend: "grok" },
    );
    const wf = out.find((g: { kind: string }) => g.kind === "workflow") as {
      title: string; items: { name: string; invoke: string; openWorkflowBuilder?: boolean }[];
    };
    expect(wf).toBeDefined();
    expect(wf.title).toBe("User Workflows");
    expect(wf.items[0].name).toBe("create-workflow");
    expect(wf.items[0].invoke).toBe("/create-workflow ");
    expect(wf.items[0].openWorkflowBuilder).toBe(true);
  });

  it("prepends create-workflow ahead of saved workflow tiles without duplicating", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    const input = [{
      kind: "workflow",
      title: "User Workflows",
      total: 1,
      items: [{ kind: "workflow", name: "review-changes", invoke: "/workflow review-changes " }],
    }];
    const out = withCreateWorkflowTile(input, { backend: "grok" });
    const names = (out[0] as { items: { name: string }[] }).items.map((i) => i.name);
    expect(names).toEqual(["create-workflow", "review-changes"]);
    expect((out[0] as { total: number }).total).toBe(2);
    // Idempotent — a second pass must not double-insert.
    const again = withCreateWorkflowTile(out, { backend: "grok" });
    expect((again[0] as { items: unknown[] }).items).toHaveLength(2);
  });

  it("Claude is unchanged — no /create-workflow skill on that backend", () => {
    const input = [{ kind: "grokbit", total: 1, items: [{ name: "x" }] }];
    expect(withCreateWorkflowTile(input, { backend: "claude" })).toEqual(input);
    expect(withCreateWorkflowTile([], { backend: "claude" })).toEqual([]);
  });

  it("does not mutate the input groups array or item lists", () => {
    const items = [{ kind: "workflow", name: "review-changes" }];
    const input = [{ kind: "workflow", title: "User Workflows", total: 1, items }];
    withCreateWorkflowTile(input, { backend: "grok" });
    expect(items).toHaveLength(1);
    expect(input[0].items).toBe(items);
  });

  it("does not feature-pin workflow (prepend + fallback keeps create first without hiding scripts)", () => {
    expect(CAPABILITY_FEATURED.workflow).toBeUndefined();
  });

  it("capabilityGroupsView labels Create Workflow and marks builder action", () => {
    if (!SHOW_USER_WORKFLOWS) return;
    const groups = withCreateWorkflowTile([], { backend: "grok" });
    const v = capabilityGroupsView({ groups });
    const item = v[0].items[0];
    expect(item.name).toBe("create-workflow");
    expect(item.label).toBe("Create Workflow");
    expect(item.invokeLabel).toBe("/create-workflow");
    expect(item.action).toBe("builder");
    expect(item.openWorkflowBuilder).toBe(true);
  });
});

describe("capabilityGroupsView", () => {
  it("preserves the supplied group order — never reorders by kind", () => {
    const v = capabilityGroupsView({
      groups: [
        { kind: "skill", title: "Skills", total: 1, items: [{ kind: "skill", name: "plan", invoke: "/plan " }] },
        { kind: "command", title: "Commands", total: 1, items: [{ kind: "command", name: "new", invoke: "/new " }] },
        { kind: "agent", title: "Agents", total: 1, items: [{ kind: "agent", name: "explore" }] },
      ],
    });
    expect(v.map((g) => g.kind)).toEqual(["skill", "command", "agent"]);
  });

  it("reports +N more when total exceeds the items given", () => {
    const v = capabilityGroupsView({
      groups: [{ kind: "skill", title: "Skills", total: 43, items: [{ kind: "skill", name: "a", invoke: "/a " }] }],
    });
    expect(v[0].remaining).toBe(42);
  });

  it("drops empty groups", () => {
    const v = capabilityGroupsView({
      groups: [
        { kind: "skill", title: "Skills", total: 0, items: [] },
        { kind: "agent", title: "Agents", total: 1, items: [{ kind: "agent", name: "explore" }] },
      ],
    });
    expect(v.map((g) => g.kind)).toEqual(["agent"]);
  });

  it("truncates a long description", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "command", title: "Commands", total: 1,
        items: [{ kind: "command", name: "long", invoke: "/long ", description: "x".repeat(500) }],
      }],
    });
    const desc = v[0].items[0].description;
    expect(desc.length).toBeLessThan(500);
    expect(desc.endsWith("…")).toBe(true);
  });

  // Synthetic multi-sentence wall (> CAPABILITY_ROW_DESCRIPTION_MAX) so trim
  // behavior stays covered without coupling the suite to live skill copy.
  it("sentence-aware trim keeps complete sentences on a long multi-sentence description", () => {
    const longDesc =
      "First complete sentence stays intact under the row cap. " +
      "Second complete sentence also ends with a period and a space. " +
      "Third complete sentence is still under the display budget when cut here. " +
      "Fourth sentence and everything after it should be dropped by the sentence-aware trim " +
      "because the full string is deliberately longer than CAPABILITY_ROW_DESCRIPTION_MAX " +
      "and must not appear in the truncated tile text the user sees.";
    expect(longDesc.length).toBeGreaterThan(CAPABILITY_ROW_DESCRIPTION_MAX);
    const v = capabilityGroupsView({
      groups: [{
        kind: "grokbit", title: "Grokbit workflow", total: 1,
        items: [{ kind: "grokbit", name: "grokbit-plan", invoke: "/grokbit-plan ", description: longDesc }],
      }],
    });
    const desc = v[0].items[0].description;
    expect(desc.endsWith("…")).toBe(false);
    expect(desc.endsWith(".")).toBe(true);
    expect(desc).toContain("when cut here.");
    expect(desc).not.toContain("Fourth sentence");
    expect(desc.length).toBeLessThanOrEqual(CAPABILITY_ROW_DESCRIPTION_MAX);
    // No mid-word cut: last char is sentence terminator, not a partial token.
    expect(desc).toBe(
      "First complete sentence stays intact under the row cap. " +
      "Second complete sentence also ends with a period and a space. " +
      "Third complete sentence is still under the display budget when cut here.",
    );
  });

  it("marks an item with neither invoke nor path as inert", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "agent", title: "Agents", total: 1,
        items: [{ kind: "agent", name: "general-purpose", description: "Built in." }],
      }],
    });
    expect(v[0].items[0].inert).toBe(true);
    expect(v[0].items[0].action).toBe("inert");
  });

  it("an invocable item resolves to the invoke action, even when it also has a path", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{ kind: "skill", name: "plan", invoke: "/plan ", path: "/ws/.grok/skills/plan/SKILL.md" }],
      }],
    });
    expect(v[0].items[0].action).toBe("invoke");
    expect(v[0].items[0].inert).toBe(false);
  });

  // [R] The row's primary text is the PLAIN NAME, not the slash token — the
  // inversion this package exists to ship (docs/plans/
  // session-tab-ux-overhaul.md § Approach B bullet 2). This replaces the old
  // `label: invoke ? invoke.trim() : name` shape entirely; it is not appended
  // alongside it.
  it("[R] label is always the plain name; invokeLabel carries the trimmed slash form for an invocable item", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{ kind: "skill", name: "plan", invoke: "/plan ", path: "/ws/.grok/skills/plan/SKILL.md" }],
      }],
    });
    expect(v[0].items[0].label).toBe("plan");
    expect(v[0].items[0].invokeLabel).toBe("/plan");
  });

  it("a non-invocable item with a path resolves to the open action", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{ kind: "skill", name: "internal", path: "/ws/.grok/skills/internal/SKILL.md" }],
      }],
    });
    expect(v[0].items[0].action).toBe("open");
    expect(v[0].items[0].inert).toBe(false);
  });

  it("a non-invocable item (open or inert) has no invokeLabel; label is still the plain name", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 2,
        items: [
          { kind: "skill", name: "internal", path: "/ws/.grok/skills/internal/SKILL.md" },
          { kind: "agent", name: "general-purpose" },
        ],
      }],
    });
    expect(v[0].items[0].invokeLabel).toBeUndefined();
    expect(v[0].items[0].label).toBe("internal");
    expect(v[0].items[1].invokeLabel).toBeUndefined();
    expect(v[0].items[1].label).toBe("general-purpose");
  });

  it("truncates a long hint (untrusted workspace text), same as description", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{ kind: "skill", name: "adr", invoke: "/adr ", hint: "x".repeat(400) }],
      }],
    });
    const hint = v[0].items[0].hint;
    expect(hint.length).toBeLessThan(400);
    expect(hint.endsWith("…")).toBe(true);
  });

  it("an item with no hint at all renders no hint field", () => {
    const v = capabilityGroupsView({
      groups: [{ kind: "skill", title: "Skills", total: 1, items: [{ kind: "skill", name: "adr", invoke: "/adr " }] }],
    });
    expect(v[0].items[0].hint).toBeUndefined();
  });

  it("tolerates being called with no groups at all", () => {
    expect(capabilityGroupsView()).toEqual([]);
    expect(capabilityGroupsView({})).toEqual([]);
  });

  // [R] B6 — workspace-tier provenance was computed host-side but only ever
  // rendered into the `title` tooltip, so a repo-authored skill was
  // indistinguishable from a builtin at a glance — even though
  // dedupeByPriority is workspace-first, so a repo skill can silently shadow a
  // same-named one under the user's home dir.
  it("[R] flags a workspace-tier (\"Project (…)\") item so the renderer can show its source visibly", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{ kind: "skill", name: "code-review", invoke: "/code-review ", source: "Project (.grok)" }],
      }],
    });
    expect(v[0].items[0].workspaceSource).toBe(true);
    expect(v[0].items[0].source).toBe("Project (.grok)");
  });

  it("[R] does not flag a home-tier or built-in item as workspace-sourced", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 2,
        items: [
          { kind: "skill", name: "code-review", invoke: "/code-review ", source: "User (~/.grok)" },
          { kind: "command", name: "new", invoke: "/new ", source: "Built in" },
        ],
      }],
    });
    expect(v[0].items[0].workspaceSource).toBe(false);
    expect(v[0].items[1].workspaceSource).toBe(false);
  });

  it("does not flag an item with no source at all", () => {
    const v = capabilityGroupsView({
      groups: [{ kind: "agent", title: "Agents", total: 1, items: [{ kind: "agent", name: "explore" }] }],
    });
    expect(v[0].items[0].workspaceSource).toBe(false);
  });
});

// Featured-set partition (docs/plans/actions-panel-featured-capabilities.md) —
// capabilityGroupsView calls the pure partitionFeatured internally and stamps
// the result's featuredCount onto the returned group; the renderer slices on
// it, it never re-sorts.
describe("capabilityGroupsView — featured partition", () => {
  it("CAPABILITY_FEATURED carries the operator's configured names per kind", () => {
    // The Skills list is the operator's command names, dual-listed so a
    // disk-discovered skill of the same name is still featured (see the next
    // test: mergeAcpCommands keeps the disk kind on a name collision, and disk
    // roots never yield "command").
    expect(CAPABILITY_FEATURED.skill).toContain("cold-review");
    expect(CAPABILITY_FEATURED.agent).toEqual(["explore", "explorer"]);
    // Both spellings of "always-approve" — the operator's request had the typo.
    expect(CAPABILITY_FEATURED.command).toContain("always-approve");
    expect(CAPABILITY_FEATURED.command).toContain("alawys-approve");
  });

  // [R] mergeAcpCommands keeps the DISK kind on a name collision, and every
  // disk root (src/capabilities.ts) yields "skill" or "agent", never
  // "command" — so an install where e.g. docx/pptx ship as real skill
  // directories would otherwise land in Skills (matching neither "plan" nor
  // "implement") while Commands matches nothing and silently degrades to
  // plain first-N truncation. Every command name the operator configured must
  // also be reachable under "skill", or the feature quietly stops surfacing
  // exactly the items it was built for on that kind of install.
  it("[R] every configured command name is also listed under skill, so a disk-discovered skill of the same name is still featured", () => {
    for (const name of CAPABILITY_FEATURED.command) {
      expect(CAPABILITY_FEATURED.skill).toContain(name);
    }
  });

  it("[R] both agent spellings (explore / explorer) are featured — one intent, two names in the wild", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "agent", title: "Agents", total: 2,
        items: [
          { kind: "agent", name: "explorer" },
          { kind: "agent", name: "unrelated-agent" },
        ],
      }],
    });
    expect(v[0].items[0].name).toBe("explorer");
    expect(v[0].featuredCount).toBe(1);
  });

  it("CAPABILITY_FEATURED_FALLBACK is 5, per the confirmed decision", () => {
    expect(CAPABILITY_FEATURED_FALLBACK).toBe(5);
  });

  it("featured items sort to the front, in the configured order, ahead of the host's own order", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 3,
        items: [
          { kind: "skill", name: "init-repo", invoke: "/init-repo " },
          { kind: "skill", name: "zzz-unfeatured", invoke: "/zzz-unfeatured " },
          { kind: "skill", name: "cold-review", invoke: "/cold-review " },
        ],
      }],
    });
    // Configured order starts ["cold-review", "init-repo"] — "cold-review"
    // leads even though the host listed "init-repo" first.
    expect(v[0].items.map((i) => i.name)).toEqual(["cold-review", "init-repo", "zzz-unfeatured"]);
    expect(v[0].featuredCount).toBe(2);
  });

  // [R] The Grokbit group's whole point is that it teaches the pipeline, so
  // every member is featured and the group renders no expander. If a member is
  // ever dropped from this list, featuredCount < items.length and the last
  // steps of the workflow silently hide behind a "Show all" link.
  it("[R] every bundled suite skill is featured, in SUITE_SKILL_NAMES pipeline order", () => {
    expect(CAPABILITY_FEATURED.grokbit).toEqual([
      "grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document", "grokbit-ship",
    ]);
    const v = capabilityGroupsView({
      groups: [{
        kind: "grokbit", title: "Grokbit workflow", total: 6,
        items: [
          { kind: "grokbit", name: "grokbit-test", invoke: "/grokbit-test " },
          { kind: "grokbit", name: "grokbit-document", invoke: "/grokbit-document " },
          { kind: "grokbit", name: "grokbit-plan", invoke: "/grokbit-plan " },
          { kind: "grokbit", name: "grokbit-implement", invoke: "/grokbit-implement " },
          { kind: "grokbit", name: "grokbit-explore", invoke: "/grokbit-explore " },
          { kind: "grokbit", name: "grokbit-ship", invoke: "/grokbit-ship " },
        ],
      }],
    });
    expect(v[0].items.map((i) => i.name)).toEqual([
      "grokbit-explore", "grokbit-plan", "grokbit-implement", "grokbit-test", "grokbit-document", "grokbit-ship",
    ]);
    expect(v[0].featuredCount).toBe(v[0].items.length);
  });

  it("matches case-insensitively on item.name", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "agent", title: "Agents", total: 1,
        items: [{ kind: "agent", name: "Explore" }],
      }],
    });
    expect(v[0].items[0].name).toBe("Explore");
    expect(v[0].featuredCount).toBe(1);
  });

  it("falls back to the first CAPABILITY_FEATURED_FALLBACK items when nothing in the group matches", () => {
    const items = Array.from({ length: 8 }, (_, i) => ({ kind: "command", name: `cmd-${i}`, invoke: `/cmd-${i} ` }));
    const v = capabilityGroupsView({
      groups: [{ kind: "command", title: "Commands", total: 8, items }],
    });
    expect(v[0].featuredCount).toBe(CAPABILITY_FEATURED_FALLBACK);
    // Order is otherwise untouched — no match means no reordering either.
    expect(v[0].items.map((i) => i.name)).toEqual(items.map((i) => i.name));
  });

  it("a group smaller than the fallback still never collapses to zero — featuredCount caps at the group's own size", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "command", title: "Commands", total: 2,
        items: [
          { kind: "command", name: "one-off", invoke: "/one-off " },
          { kind: "command", name: "another", invoke: "/another " },
        ],
      }],
    });
    expect(v[0].featuredCount).toBe(2);
  });

  it("an unconfigured kind (no CAPABILITY_FEATURED entry) falls back the same way as a kind with no matches", () => {
    const items = Array.from({ length: 6 }, (_, i) => ({ kind: "workflow", name: `w-${i}` }));
    const v = capabilityGroupsView({
      groups: [{ kind: "workflow", title: "Workflows", total: 6, items }],
    });
    expect(v[0].featuredCount).toBe(CAPABILITY_FEATURED_FALLBACK);
  });

  it("both always-approve spellings are recognized as featured", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "command", title: "Commands", total: 2,
        items: [
          { kind: "command", name: "alawys-approve", invoke: "/alawys-approve " },
          { kind: "command", name: "unrelated", invoke: "/unrelated " },
        ],
      }],
    });
    expect(v[0].items[0].name).toBe("alawys-approve");
    expect(v[0].featuredCount).toBe(1);
  });

  it("passes through hasDetail and detailPath when the host stamped them", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "grokbit", title: "Grokbit workflow", total: 1,
        items: [{
          kind: "grokbit",
          name: "grokbit-plan",
          description: "Plan",
          invoke: "/grokbit-plan ",
          hasDetail: true,
          detailPath: "/ext/resources/skills/grokbit-plan/references/how-it-works.md",
          source: "Grokbit",
          origin: "disk",
        }],
      }],
    });
    expect(v[0].items[0].hasDetail).toBe(true);
    expect(v[0].items[0].detailPath).toContain("how-it-works.md");
    expect(v[0].items[0].label).toBe("Plan");
  });

  it("workflowDetailView — the honesty split is what the empty line is for", () => {
    // Genuinely no agent calls: a legitimate workflow shape, not a failure.
    expect(workflowDetailView({ agents: [], agentCallSites: 0 }).emptyLine).toBe(
      "No agent calls found — this workflow may build its steps as it runs.",
    );
    // Calls found, none readable: a different fact, and saying "no agents"
    // here would be a lie about the user's own file.
    expect(workflowDetailView({ agents: [], agentCallSites: 4, opaqueAgentCalls: 4 }).emptyLine).toBe(
      "Couldn't read this workflow's 4 agent calls.",
    );
    expect(workflowDetailView({ agents: [], agentCallSites: 1, opaqueAgentCalls: 1 }).emptyLine).toBe(
      "Couldn't read this workflow's 1 agent call.",
    );
  });

  it("workflowDetailView — opaque, overflow and truncated are separate statements", () => {
    const v = workflowDetailView({
      agents: [{ index: 1, promptKind: "literal", prompt: "p", hasSchema: false }],
      agentCallSites: 6,
      opaqueAgentCalls: 1,
      overflowAgentCalls: 4,
      truncated: true,
    });
    expect(v.emptyLine).toBeUndefined();
    expect(v.opaqueLine).toBe("1 agent call couldn't be read.");
    expect(v.overflowLine).toBe("4 more agent calls not shown.");
    expect(v.truncatedLine).toBe("This file was longer than we read — later agents may be missing.");
  });

  it("workflowDetailView — suppresses the opaque line when nothing rendered, so one problem reads as one line", () => {
    const v = workflowDetailView({ agents: [], agentCallSites: 2, opaqueAgentCalls: 2 });
    expect(v.emptyLine).toBeTruthy();
    expect(v.opaqueLine).toBeUndefined();
  });

  it("workflowDetailView — summarises an agent, falling back to its position when unlabelled", () => {
    const v = workflowDetailView({
      agents: [
        { index: 1, promptKind: "literal", prompt: "p", label: "worker", inferredPhase: "Build", model: "sonnet", effort: "high", hasSchema: true },
        { index: 2, promptKind: "dynamic", prompt: "`${x}`", hasSchema: false },
      ],
      agentCallSites: 2,
    });
    expect(v.agents[0].summary).toBe("worker · Build · sonnet · high · schema ✓");
    expect(v.agents[0].promptLabel).toBe("Prompt");
    expect(v.agents[1].summary).toBe("agent 2");
    expect(v.agents[1].promptIsDynamic).toBe(true);
    expect(v.agents[1].promptLabel).toBe("Prompt (built at run time — showing the script's own text)");
  });

  it("workflowDetailView — an explicit phase option wins over the inferred one", () => {
    const v = workflowDetailView({
      agents: [{ index: 1, promptKind: "literal", prompt: "p", phase: "Explicit", inferredPhase: "Inferred", hasSchema: false }],
      agentCallSites: 1,
    });
    expect(v.agents[0].summary).toBe("agent 1 · Explicit");
    expect(v.agents[0].settings).toContainEqual({ label: "Phase", value: "Explicit" });
  });

  it("workflowDetailView — survives a malformed or empty payload", () => {
    for (const junk of [undefined, {}, { agents: null, phases: "nope" }]) {
      const v = workflowDetailView(junk as never);
      expect(v.agents).toEqual([]);
      expect(v.phases).toEqual([]);
      expect(v.emptyLine).toBeTruthy();
    }
    // A phase with no title is dropped rather than rendered blank.
    expect(workflowDetailView({ phases: [{ title: "" }, { title: "Real" }], agents: [], agentCallSites: 0 }).phases)
      .toEqual([{ title: "Real" }]);
  });

  it("passes through detailKind so the row can echo it back to the host", () => {
    const view = (detailKind?: string) =>
      capabilityGroupsView({
        groups: [{
          kind: "workflow", title: "User Workflows", total: 1,
          items: [{
            kind: "workflow",
            name: "review-changes",
            description: "Review a diff",
            invoke: "/workflow review-changes ",
            path: "/ws/.grok/workflows/review-changes.rhai",
            hasDetail: true,
            detailPath: "/ws/.grok/workflows/review-changes.rhai",
            detailKind,
            source: "Project (.grok)",
            origin: "disk",
          }],
        }],
      })[0].items.find((i: { name: string }) => i.name === "review-changes");

    expect(view("workflow").detailKind).toBe("workflow");
    expect(view("guide").detailKind).toBe("guide");
    // An unrecognized or absent kind becomes undefined, so the host falls
    // through to its suite flow — the same outcome a client that predates the
    // field produces, rather than a value nothing knows how to route.
    expect(view("something-new").detailKind).toBeUndefined();
    expect(view(undefined).detailKind).toBeUndefined();
  });

  it("omits detailKind when hasDetail is false, exactly as it omits detailPath", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "workflow", title: "User Workflows", total: 1,
        items: [{
          kind: "workflow",
          name: "w",
          invoke: "/workflow w ",
          hasDetail: false,
          detailPath: "/ws/.grok/workflows/w.rhai",
          detailKind: "workflow",
          source: "Project (.grok)",
          origin: "disk",
        }],
      }],
    });
    const row = v[0].items.find((i: { name: string }) => i.name === "w");
    expect(row.hasDetail).toBe(false);
    expect(row.detailKind).toBeUndefined();
    expect(row.detailPath).toBeUndefined();
  });

  it("omits detailPath when hasDetail is false even if detailPath was sent", () => {
    const v = capabilityGroupsView({
      groups: [{
        kind: "skill", title: "Skills", total: 1,
        items: [{
          kind: "skill",
          name: "other",
          description: "x",
          hasDetail: false,
          detailPath: "/evil/path.md",
          source: "User",
          origin: "disk",
        }],
      }],
    });
    expect(v[0].items[0].hasDetail).toBe(false);
    expect(v[0].items[0].detailPath).toBeUndefined();
  });
});



describe("userPromptShouldCollapse", () => {
  it("returns false for empty, whitespace, and short single-line prompts", () => {
    expect(userPromptShouldCollapse("")).toBe(false);
    expect(userPromptShouldCollapse("   ")).toBe(false);
    expect(userPromptShouldCollapse("Fix the login bug")).toBe(false);
    expect(userPromptShouldCollapse("a".repeat(USER_PROMPT_COLLAPSE_MIN_CHARS))).toBe(false);
  });

  it("returns true when the prompt contains a newline after trim", () => {
    expect(userPromptShouldCollapse("line one\nline two")).toBe(true);
    expect(userPromptShouldCollapse("  first\nsecond  ")).toBe(true);
  });

  it("returns true when trimmed length exceeds USER_PROMPT_COLLAPSE_MIN_CHARS", () => {
    expect(userPromptShouldCollapse("a".repeat(USER_PROMPT_COLLAPSE_MIN_CHARS + 1))).toBe(true);
  });

  it("exports a positive min-chars constant", () => {
    expect(USER_PROMPT_COLLAPSE_MIN_CHARS).toBeGreaterThan(0);
    expect(USER_PROMPT_COLLAPSE_MIN_CHARS).toBe(120);
  });
});

// M1 product-review: agent/user markdown must not inject active URL schemes.
describe("isSafeHref", () => {
  it("allows http(s) and vscode schemes", () => {
    expect(isSafeHref("https://example.com/a")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("vscode://file/foo")).toBe(true);
    expect(isSafeHref("vscode-insiders://file/foo")).toBe(true);
  });

  it("allows scheme-less relative paths and fragments", () => {
    expect(isSafeHref("src/foo.ts")).toBe(true);
    expect(isSafeHref("./docs/README.md")).toBe(true);
    expect(isSafeHref("#section")).toBe(true);
  });

  it("rejects javascript, data, vbscript, protocol-relative, and empty", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("JAVASCRIPT:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,hi")).toBe(false);
    expect(isSafeHref("vbscript:msgbox")).toBe(false);
    expect(isSafeHref("//evil.example/x")).toBe(false);
    expect(isSafeHref("")).toBe(false);
    expect(isSafeHref("   ")).toBe(false);
  });
});
