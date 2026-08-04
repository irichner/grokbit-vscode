# Design — Enhance Grokbit extension from three templates

## Options considered

### Option A — Dogfood-only: install GrokForge hooks into Grokbit.ai

**Approach:** Copy `.grok/hooks/` (+ tests if portable) into this repo; enable Stop gate for Grok dogfood sessions. No product UI.

**Trade-off:** Fast correctness for maintainers; **zero** Marketplace user value; does not “enhance extension capabilities.”

### Option B — Productize Ultimate patterns only (`/ship` + Claude-style UX)

**Approach:** Add Ship Action and Claude-side bootstrap polish; ignore GrokForge hooks.

**Trade-off:** Improves orchestration UX; leaves Grok sessions soft-gated; duplicates Ultimate without the proven Grok hook contract.

### Option C — Full suite rewrite to absorb project team + Ultimate

**Approach:** Collapse dogfood `gf-*` and Ultimate into one mega-suite.

**Trade-off:** Huge blast radius; dual purpose (product vs dogfood) gets muddled; violates non-goal of full suite rewrite in wave 1.

### Option D — Layered extension roadmap (chosen)

**Approach:** Treat the three systems as **sources of features**, not competitors to pick one of. Ship extension enhancements in priority order:

1. **Deterministic Grok enforcement (from GrokForge)** — highest correctness leverage; Grokbit already has identical plan/implement skills but **no hooks**.
2. **Orchestration UX (from Ultimate + suite)** — Ship / full-pipeline Action without killing phase tiles.
3. **Dual-stack safety (from GrokForge ADR 0002 + Grokbit dual backend)** — collision and double-hook policy visible in product.
4. **Evidence surfaces (from suite)** — thin UI for plan progress / SHIP verdict paths (read markdown; no heavy Studio).
5. **Dogfood alignment** — install hooks into this monorepo so maintainers eat the dogfood product path.

**Trade-off:** Multi-phase; not one PR. Explicitly better for “enhance extension” than A/B/C.

## Decision

**Chosen: Option D.**

### Three-sentence recommendation

1. **Best source of Grok hard gates:** GrokForge template (Python `.grok/hooks/`, ADR 0001) — Grokbit dogfood is **behind** this template on hooks only; skills already match.  
2. **Best source of one-shot operator loop:** Ultimate `/ship` (+ checkpoint discipline) — map to a Grokbit Action that **seeds** suite phases or a thin orchestrator skill, not a second accuracy protocol.  
3. **Best source of portable change science & vibe-coder evidence:** Grokbit suite — keep as default Actions pipeline; extension should **surface** its artifacts more than reimplement them.

What rejected options were better at: A is fastest dogfood; B is simplest Claude-centric story; C is cleanest long-term architecture if we ever freeze one stack.

## Scorecard (three systems → extension leverage)

| Axis | Ultimate | GrokForge template | Grokbit suite | Grokbit dogfood now | Best import into **extension** |
|---|---|---|---|---|---|
| Deterministic stop | W (Claude) | **W (Grok Python)** | L | L (no hooks) | Provision Grok hooks (template) |
| Plan depth | L | T | **W** | T | Keep suite; optional progress UI |
| Baseline regression science | L | L | **W** | L | Surface baseline/SHIP paths in UI |
| Operator one-shot | **W `/ship`** | two skills | five tiles | two skills | Ship Action (Ultimate pattern) |
| Dual runtime product | L (rejected) | dual monorepo careful | portable skills | Grok-centric | ADR 0002-style policy + UI |
| Windows-safe hooks | bash+jq risk | **Python stdlib** | n/a | n/a | Use template lineage |
| Thin-client fit | commands in tree | files in tree | skills provisioned | files | Prefer provision like suite |
| Agent economy defaults | **W** | heavy accuracy | heavy plan | heavy | Ship skill documents budget |

## Shape of the change (extension)

### Wave 1 — Grok hooks as a first-class provision (product + dogfood)

- Vendor (or submodule-copy) GrokForge hook scripts into e.g. `resources/hooks/grok/` (extension-owned copy, version-stamped like skills).
- On activation (or setting `grok.hooks.provision: auto|off`, default **off** for user workspaces; **auto** optional later): copy into workspace `.grok/hooks/` **or** document “Install harness hooks” command.
- Respect template opt-in: never force hooks on every user’s repo without consent (`--with-hooks` philosophy, README:55-56 template).
- Pure decision functions stay unit-testable in extension test suite (mirror `tests/test_grok_hooks.py` idea) **without** spawning grok in CI.
- Surface in UI: settings + optional “Hooks: on/off/trust needed” chip (read `grok inspect` if available — degrade gracefully).

### Wave 2 — Ship / Run pipeline Action

- New invocable: seed composer with structured multi-phase brief **or** thin skill `grokbit-ship` that orchestrates suite order with human checkpoint after plan (Ultimate `ship.md` steps 1–2).
- Do **not** reimplement accuracy protocol inside extension TS.

### Wave 3 — Dual-stack / dual-backend policy productization

- Document and, where possible, detect: Claude agent name collisions, double hook stacks when both `.claude` and `.grok` hooks present (ADR 0002).
- Extension already dual-backend: add Known limits / onboarding line; optional workspace scan warning.

### Wave 4 — Artifact surfaces (thin)

- Read-only “open plan folder / latest SHIP verdict” from `.grokbit/plans/` — no second source of truth.

## Disposition of superseded / overlapping items

| Item | Disposition | Reason | Obligation |
|---|---|---|---|
| Soft-only dogfood (no hooks) | **REPLACE** (when Wave 1 lands) | Template already supersedes | After hooks verify, dogfood uses provisioned hooks |
| Five Actions without orchestrator | **COEXIST** with Ship | Phase tiles remain discoverable | Ship is extra entry; tiles stay |
| Project `/plan` vs suite `grokbit-plan` | **COEXIST** | Dogfood vs product audiences | Labels in Actions + AGENTS; no silent merge |
| Ultimate as installable whole into Grokbit | **LEAVE** | Claude-only ADR conflicts with dual product | Steal patterns only |
| Replacing suite with gf-* accuracy | **LEAVE** | Different audiences | — |
| Bash Claude hooks for Grok path | **LEAVE** | Windows + contract; use Python lineage | — |

## Unhappy paths

| Scenario | Behavior |
|---|---|
| User repo has no AGENTS Project Test Commands | Stop gate fail-open with stderr note (template behavior) — never silent green claim |
| Hooks not trusted (`/hooks-trust`) | UI says “hooks installed, not trusted”; gate inactive |
| Claude session + Grok hooks both present | ADR 0002: Grok Lead policy wins for Grok tabs; Claude hooks for Claude tabs; warn if both fire |
| Provision fails mid-copy | Same degrade-as-absent as skill suite |
| Ship skill too long / agent ignores checkpoint | Ship skill must pause after plan like Ultimate; user must approve |

## Migration

Schema: no DB.  
Files: optional `.grok/hooks/` in workspaces; `resources/hooks/` in vsix.  
Reversible: setting off + delete hooks dir; vsix uninstall removes provisioner only (user files remain unless uninstall script cleans — document).

## New dependencies

None preferred (Python stdlib hooks; extension TypeScript only for provision/UI).
