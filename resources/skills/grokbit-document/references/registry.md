# The type registry

Document types are data. Each is one file in `types/<id>.md`: YAML frontmatter the machinery reads, plus a markdown body of writing guidance the Technical Writer reads.

Adding a type means adding a file. Nothing in `SKILL.md` changes, nothing in the extension changes, and a consulting team can drop in house templates without forking anything.

## Schema

```yaml
---
id: adr                      # filename stem, stable, used by the extension
label: Architecture Decision Record
category: derived            # derived | hybrid | authored
audience: engineers deciding later whether to revisit this choice
answers: "Why is it built this way, and what else was considered?"
output: docs/adr/{nnnn}-{slug}.md
emit_at: plan-approval       # phase hook, or `on-request`
coverage_source: .grokbit/plans/{slug}/03-design.md
ask_cap: 3
sections:
  - id: context
    title: Context
    derive_from: 01-intent.md#problem
  - id: consequences
    title: Consequences
    derive_from: 03-design.md#decision
    ask: "What gets harder because of this choice?"
    required: true
verify: [links_follow, citations_valid]
---
```

### Field notes

**`category`** drives how much human input to expect, and the extension can group the picker by it.

- `derived` — assembled almost entirely from artifacts. Ask nothing if coverage is high.
- `hybrid` — real derivation plus real gaps.
- `authored` — the repo does not contain the answer. User guides need to know what the reader is *trying to accomplish*, and nothing in your code says why someone opened the app. That gap is the one place a human genuinely must supply input, so design the interaction around exactly that question rather than a generic "describe your feature."

**`answers`** is the reader's question in the reader's words. It is what the picker shows under the label, and it is what the necessity gate is checked against.

**`output`** is the emission path. A `{slug}` placeholder is filled from the invocation; a type whose `output` has no `{slug}` at all (`readme`, `changelog`, `contributing`) needs no slug to invoke — see § Extension contract. A numeric placeholder like `{nnnn}` (used by `adr`) is allocated at emit time, not asked for: scan the type's output directory for the highest existing number matching the placeholder's width, increment, zero-pad. If the resulting path already exists — a race, or a hand-created file with that number — increment again until it doesn't. Never overwrite an existing numbered file; `types/adr.md`'s own body rule ("never rewrite an ADR after the fact") depends on this.

**`derive_from`** is `<artifact>#<heading-slug>`, relative to `.grokbit/plans/{slug}/`. Prefix with `src:` to derive from source instead. A section may list several; they concatenate in order. Two `src:` resolvers exist, and only two — treat any other verb after `src:` as unresolved (0% coverage for that source), never guess at a behavior for it:

- `src:signatures:<glob>` — exported function/method/route signatures (name, parameters, and a return type where the language states one) from every file the glob matches, in file order.
- `src:env:<glob>` — every environment-variable reference (`process.env.X`, `os.environ["X"]`, `os.getenv("X")`, and equivalents) found in files the glob matches, deduplicated, names only — never values.

Adding a third resolver means adding it here first, the same discipline `SKILL.md` asks for adding a document type: define the vocabulary before two people implement it two different ways.

**`ask`** is the fallback prompt when derivation comes back empty or thin. Write it as a specific question, not a topic. "What should happen when the payment provider times out mid-checkout?" beats "Describe error handling" — the specific version gets a usable answer, the generic one gets a shrug.

**`ask_cap`** (1–5) is the per-type ceiling on Step 3's gap-fill batch. It always wins over any general guidance elsewhere — `SKILL.md`'s Step 3 states the suite-wide ceiling (5) but never overrides a type that sets fewer.

**`required: true`** means a section that is neither derivable nor answered blocks emission. Use sparingly; most gaps should degrade to a `TODO` marker rather than stopping the document.

**`emit_at`** is **guidance for the skill and for humans**, not a wired extension hook. Values: `plan-approval`, `implement-handoff`, `test-verdict`, or `on-request`. When you finish plan approval / implement handoff / test verdict, **prefer** emitting types whose `emit_at` matches that boundary (e.g. changelog at handoff). The shipped Grokbit extension does **not** auto-fire document generation at those phase boundaries today — natural language and the Docs picker (when present) invoke the skill. Do not claim the product auto-emits docs at phase hooks.

**`verify`** selects checks from `scripts/verify_doc.py`: `commands_run`, `paths_resolve`, `links_follow`, `samples_compile`, `citations_valid`. This list is exhaustive — every check named here is implemented, and nothing verify_doc.py can select is a no-op. (An earlier draft of this registry also listed `signatures_match`; it was never implemented — checking a documented signature against arbitrary source in an arbitrary language is not a thing a stdlib-only script can do honestly — and it has been removed from here and from every type that listed it, rather than left advertised and silently skipped.) **Optional; when a type omits it, the default is `[links_follow, citations_valid]`** — every type derives from *something* and can cite or link something, even a mostly-authored one, so those two checks are the floor. `commands_run`/`samples_compile`/`paths_resolve` only apply to types that plausibly contain runnable commands, real repo paths, or code samples, and are added per type accordingly.

## Coverage

Coverage is the fraction of sections whose `derive_from` resolves to non-empty content. **Template scaffolding counts as empty.** A section whose resolved content is nothing but an unfilled placeholder from the plan skill's own templates (`<...>`, `<name>`, `<A|B>`, and the like — see any `grokbit-plan/assets/*.template.md`) has not actually been answered; treat it as unresolved, or coverage inflates on documents that are mostly still asking their own questions.

When there is no plan directory for the given slug at all, coverage is computed over a narrower set — see `SKILL.md` § Plan-less invocation. That mode is not a fallback to apologize for; it is how the majority of `readme`/`changelog`/`contributing` requests actually arrive.

The extension computes coverage before the user commits to anything, so the picker can show real numbers instead of a list of aspirations:

```json
{
  "type": "pdd", "slug": "password-reset",
  "coverage": 0.67,
  "derivable": ["overview", "current-state", "..."],
  "needs_input": ["exceptions", "owner", "volumes"]
}
```

Below ~0.30, recommend against generating and say why. That preview is the honest replacement for the conversational necessity gate the click removed — it gives the user something to act on rather than a document that is 70% placeholders.

## Living documents

Most types emit once per invocation to a fresh or fully-owned path. Two shapes need their own rule instead:

**`changelog`** targets `CHANGELOG.md`, which accumulates across every release. Emitting a new entry means **prepending** a new dated/versioned section above whatever is already there — never regenerating or overwriting the file. If it doesn't exist yet, create it with just the new section.

**Regenerating a target that already exists.** Presence of this skill's `grokbit_type` frontmatter is **not** enough to overwrite silently — users often hand-tune emitted docs and leave the frontmatter in place. Safe in-place regenerate only when **both** are true: (1) the file has `grokbit_type` frontmatter, and (2) a recorded content hash (or byte-identical prior emit) still matches the on-disk body (excluding volatile fields you intentionally refresh). If the path exists and either condition fails — no frontmatter, missing hash, or hash mismatch — treat it like human-authored work: draft the proposed content, show a diff against the current file, and write only on confirmation. Prefer writing a new path or versioned section when the type allows it (`changelog` prepend is already the model). This is the common case for `README.md` and `CONTRIBUTING.md`, and for any re-emit after drift repair advice.

## Extension contract

**Target shape** (what a full Docs UX should do):

```
1. Enumerate types/*.md → picker (grouped by category, label + answers)
2. GET coverage for the active slug → badges
3. Invoke: grokbit-document {type_id, slug, target_path}
4. Render the returned doc path + verification report
```

**Shipped reality:** the Grokbit extension is a thin coding client. Docs browser / workspace doc listing may exist; a full type-registry picker with live coverage badges and phase-hook auto-emit is **not** guaranteed in every build. The skill must remain fully usable from natural language / slash invocation on both CLIs with **zero** extension UI. Treat the steps above as the contract for any future extension work — do not put section-assembly logic in TypeScript (CLI and extension would diverge).

`slug` is required only when the type's `output` contains `{slug}` — `readme`, `changelog`, and `contributing` have none, so a natural-language "write me a README" should never be blocked on supplying a slug it doesn't need. Every other seeded type does need one; when there is no plan directory to draw it from, ask for a short kebab-case name during Step 3's gap-fill batch rather than refusing outright.

## Writing a custom type

Copy the nearest existing type, change the frontmatter, rewrite the body guidance. Two things worth getting right:

Point `derive_from` at headings that actually exist in the artifact templates. Check `grokbit-plan/assets/*.template.md` for exact heading slugs — a `derive_from` that never resolves silently reports 0% coverage forever, and it looks like a content problem rather than a typo.

Write `ask` prompts a non-expert can answer in one sentence. The person filling gaps is usually not the person who will read the finished document.
