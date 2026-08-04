// Grok Build workflow fixture — review a diff across dimensions, then verify.
//
// Committed because no real .rhai workflow exists on any machine this repo has
// been developed on (see the plan's assumptions A5/A6): until one is captured
// from the CLI, this file IS the spec the parser is written against. Keep it
// realistic — nested calls, computed prompts, comments and awkward quoting are
// the cases that matter, not a tidy minimal example.

let meta = #{
    name: "review-changes",
    description: "Review changed files across dimensions, then verify each finding",
    phases: [
        #{ title: "Review", detail: "one agent per dimension" },
        #{ title: "Verify", detail: "adversarially refute each finding" },
    ],
};

phase("Review");

// agent("this one is commented out and must not be counted");

let correctness = agent("Review the working diff for correctness bugs (report each as file:line).", #{
    label: "review:correctness",
    model: "sonnet",
    effort: "high",
    schema: FINDINGS_SCHEMA,
});

let perf = agent("Review the working diff for performance regressions.", #{
    label: "review:perf",
    effort: "low",
});

phase("Verify");

let verdict = agent("Try to refute every finding above. Default to refuted when uncertain.", #{
    label: "verify",
    agentType: "code-reviewer",
    isolation: "worktree",
});

verdict
