# Assumptions — Workflow details inspector + per-agent prompt editing

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on — see `references/loops.md` for what
`UNVERIFIED` and `UNRESOLVED — <loop>` each mean and where they come from.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` **A1** — "Workflows" means the tiles in Grokbit Actions — agent-level detail
  applies to User Workflows (`kind: "workflow"`), the only kind that *contains* agents; suite
  tiles are skills and get the defined-behavior treatment instead. (Bears on the whole plan's
  scoping; design Axis D handles suite tiles via T9.)
- `UNVERIFIED` **A2** — The "another feature where you run multiple workflows" question is
  answered as a recommendation in the design/gate, not committed as buildable scope in this plan.
  (Answered in `03-design.md` § Strategic recommendation; confirm the human accepts that framing
  at the gate.)
- `UNVERIFIED` **A3** — Per-agent change-by-prompt may deviate from the strict seed-only precedent
  (ADR 0004) only if the design explicitly justifies direct file writes; otherwise it composes an
  edit brief and seeds the composer. The choice is presented at the gate. (Design chose seed-only
  — Axis C1; the rejected write channel is documented with reasons. Bears on T7.)
- `UNVERIFIED` **A4** — The Details view lives inside the existing chat webview (overlay/panel
  idiom like the Workflow Builder), not a separate native editor tab. (Design chose the in-row
  detail body, Axis B1. Bears on T5/T6.)

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- None. (The survey resolved every entity; its two `DOES NOT EXIST` findings — no real `.rhai` /
  `.claude/workflows/*.js` script on this machine, no webview→host write channel — are recorded
  as A5/A6 below and as the design's Axis C evidence respectively, not as unresolved entities.)

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- None. Round 1 (1 BLOCKER / 1 MAJOR / 7 MINOR) and Round 2 (3 MINOR) were all resolved by
  revision — see `04-review.md` §§ Round 1/Round 2 — Architect response. Loop exited at Round 2
  with 0 BLOCKER / 0 MAJOR.

## From the design (`03-design.md` § Assumptions introduced)
Copied verbatim in substance; the design's items 3 and 4 were RESOLVED during review and are not
open items.

- `UNVERIFIED` **A5** — The `agent(prompt, opts)` call shape (opts keys `label`, `phase`,
  `schema`, `model`, `effort`, `isolation`, `agentType`; helpers `parallel()`, `pipeline()`,
  `phase()`) matches what the CLIs actually save. No real script exists on this machine for
  either format; the shape rests on plan prose + test fixtures (`02-survey.md` § Workflow file
  formats, final bullet). Mitigation is structural: Axis A3's degraded view means a shape mismatch
  degrades to an honest "couldn't read" state, never a crash — but **the fixtures must be treated
  as the spec** until a real file is captured; a `research/`-style capture of a genuine saved
  workflow from each CLI is the verification step. (Bears on T1/T2.)
- `UNVERIFIED` **A6** — Grok Rhai scripts use the same `agent("…", #{…})` two-arg convention with
  `#{` object maps. Entirely uncorroborated; the Rhai arm of `parseAgentArgs` is written to the
  fixture shape and covered by the same degradation guarantee. (Bears on T1/T2.)
- `UNVERIFIED` **A7** — 420px bounded scroll with per-agent collapse is adequate UX for realistic
  agent counts (~3–10). No real script exists to measure against; if real workflows routinely
  carry 20+ agents, revisit Axis B's rejected overlay — the `WorkflowDetail` payload ports
  unchanged. (Bears on T6.)

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist or the plan-level
Reviewer pass, if it reached the plan at all rather than being split or rewritten.

- None. All tasks carry runnable Windows-PowerShell verifies, baselines, and rollbacks; the loop
  exited under cap.

## Resolution
Every item above is either resolved before the gate, carried into `plan.md`'s
`## Open assumptions` for the human to see, or explicitly waived at the gate.
An item that reaches implementation still unresolved is Implement's problem to
surface as a deviation, not to silently work around. Concretely: A1–A4 are gate
decisions (accept the design's choices or redirect); A5/A6 resolve by capturing
one real saved workflow per CLI (research probe) — until then the committed
fixtures are the spec; A7 resolves by observation once real scripts exist.
