# Review log — workflow-how-they-work

Append-only. Never overwrite a previous round.

## Round 1
Reviewed: `01-intent.md`, `02-survey.md`, `03-design.md`

- `[MAJOR]` Done-criterion requires content in **Grokbit Actions surface** (`01-intent.md` done criteria), but Option B v1 only `openFile`s a markdown tab — that leaves the Actions UI. openFile satisfies “not hunting disk by hand” but not “in Actions surface.” — evidence: `03-design.md` Shape → Webview; intent line on product UI — resolves by: in-panel expand (or slide-over) that shows the guide body inside Actions; open-in-editor may be secondary.
- `[MAJOR]` Dual-write drift: five `how-it-works.md` + `docs/grokbit-workflows.md` + existing `resources/skills/README.md` + skill bodies = four layers. Design under-specifies which is editorial SoT and how the docs file is produced. — evidence: `03-design.md` Content model + Disposition COEXIST on suite README — resolves by: declare `resources/skills/*/references/how-it-works.md` as product how-it-works SoT; `docs/grokbit-workflows.md` = pipeline overview + **inlined or linked** copies with a “source path” header; suite README cross-links only.
- `[MAJOR]` Host resolve path “prefer extension bundle” is not grounded in a cited `extensionPath` call site in survey; if implement invents a wrong root, Details 404s for Marketplace installs. — evidence: survey absences / danger; design Host section — resolves by: survey/design name the real API (`ExtensionContext.extensionUri` / `asAbsolutePath`) and a pure helper with unit tests for path join from skill name.
- `[MINOR]` No explicit verify that guide section headings match skill loop names after skill edits (drift) beyond “file exists.” — resolves by: checklist of required H2s in plan verify script.
- `[MINOR]` Document skill has more reference files (`provenance.md`, etc.); how-it-works must not pretend Document is a tiny phase. — content completeness, not architecture.

### Architect response — Round 1
- `[MAJOR]` Actions surface → **REVISED**: Details loads guide markdown **into Actions** (expandable panel/row body or slide-over). Lazy host message `getCapabilityDetail` / reply `capabilityDetail`. Optional secondary “Open in editor” via existing openFile. openFile-only is no longer the primary UX.
- `[MAJOR]` Drift → **REVISED**: SoT = per-skill `how-it-works.md` under the suite bundle. `docs/grokbit-workflows.md` = overview + one section per skill that **includes the same body** (implement may copy-paste at authoring time with provenance header; no runtime codegen required). Suite README gains links only (COEXIST).
- `[MAJOR]` extension path → **REVISED**: pure `suiteHowItWorksPath(extensionRoot, skillName)` helper; wired from sidebar with `this.context.extensionPath` (or equivalent already used by provision). Unit-tested path construction; DOM test for Details expand + openFile secondary if present.
- `[MINOR]` Required H2 checklist → **ACCEPTED** into plan verify.
- `[MINOR]` Document completeness → **ACCEPTED** into content notes for T1 Document guide.

## Round 2
Reviewed revised design (in-file after Round 1 response; design body updated below in `03-design.md`).

- `[MAJOR]` Lazy detail payload: untrusted markdown from disk into webview needs the same caution as other workspace text (XSS if rendered as HTML). — evidence: skill frontmatter already treated as untrusted for display — resolves by: render detail as **textContent / escaped** or reuse existing chat markdown sanitizer path only; never `innerHTML` raw. Prefer `textContent` + simple structure, or the same markdown pipeline chat uses if it is already safe.
- `[MINOR]` Expanding five long technical guides in the popover may overflow UX — acceptable with max-height scroll; note in CSS task.

### Architect response — Round 2
- `[MAJOR]` XSS → **REVISED**: detail body rendered via the **same markdown path as agent messages** if that path is already sanitizing; otherwise plain `textContent` with preserved newlines for v1. Explicit non-goal: no new HTML injection. Test asserts no raw `innerHTML` assignment of the detail string.
- `[MINOR]` scroll → **ACCEPTED** — CSS `max-height` + overflow on detail region.

## Outcome
Rounds used: 2 of 3  
Outstanding at exit: none (BLOCKER/MAJOR cleared)

## Plan review (Loop 4)
Reviewed: `plan.md`

- `[MINOR]` T3 verify is weak if no unit test for path allowlist — implement should add pure guard test when extracting refuse-arbitrary-path logic.
- `[MINOR]` T5 and T1 can race in parallel in theory; depends already allows T5∥T2 after T1 — fine.
- No BLOCKER: every done-criterion maps to a task; dispositions match design; verify commands are Windows-runnable `node`/`npx`/`npm`.

### Architect response
- `[MINOR]` allowlist test → **ACCEPTED** as note under T3 (extract pure resolve+allowlist if needed).

Outcome: clean (no BLOCKER)
