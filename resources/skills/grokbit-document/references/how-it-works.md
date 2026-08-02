# How Document works

## Purpose
**Document** writes human-facing project docs that stay **true**: derive from code and plan artifacts, ask only for gaps, then **verify** commands/paths/links. Wrong docs are worse than missing docs because people act on them.

Document types are **data** in `types/<id>.md` (registry-driven): readme, adr, changelog, api-reference, user-guide, contributing, test-plan, security-posture, runbook, sdd, pdd, brd — plus any types you add as files.

## Pipeline

```
 Necessity ──▶ Coverage ──▶ Gap fill ──▶ Draft ──▶ Executable verify ──▶ Fresh-reader ──▶ Emit + provenance
 (IA)          (Doc Eng)    (ask)       (Writer)   (Docs QA / D1)        (Docs QA / D2)    (manifest)
```

1. **Necessity** — who reads this, what changes for them? Refusal is valid.
2. **Coverage** — resolve `derive_from` against plans/source; report % before writing. Below ~30% → stop and say so.
3. **Gap fill** — batch questions up to type `ask_cap` (1–5).
4. **Draft** — sections per type; no invented claims (`TODO` or omit).
5. **Executable verify** — `scripts/verify_doc.py` (paths, links, commands listed; `--execute` only in containers/with explicit flag).
6. **Fresh-reader** — isolated reviewer attempts the task from the doc alone.
7. **Emit** — output path + `derived_from` / `content_hash` + `.grokbit/docs-manifest.json`.

### Plan-less (source-only) mode
Common for README/changelog without a plan slug: resolve only `src:` derivation sources; plan-only sections do not tank coverage.

## Roles

| Role | Job |
|---|---|
| **Information Architect** | Necessity / audience |
| **Documentation Engineer** | Coverage + structure |
| **Technical Writer** | Draft |
| **Docs QA** | verify_doc + fresh-reader |

## Loops and caps

| Loop | Cap | On cap |
|---|---|---|
| **D1** Executable verify | 3 | **Block** — do not ship a doc whose commands fail |
| **D2** Fresh-reader | 2 | Record BLOCKER gaps in the doc |

Ask cap is per type (`ask_cap`), not Plan’s flat three — looser because the user chose documentation, still bounded.

## Cap behavior
Failed command verification **blocks** ship (doc equivalent of verify-or-revert). Fresh-reader blockers are recorded, not silently polished away.

## Artifacts

| Path | Role |
|---|---|
| `docs/…` (per type `output`) | Human-facing document |
| `.grokbit/context/<type>.md` | Compact digest for future surveys |
| `.grokbit/docs-manifest.json` | type → path → provenance → verified |
| `types/<id>.md` | Registry definition (data, not skill prose) |
| `scripts/verify_doc.py` / `check_drift.py` | Executable truth + staleness |

Staleness: `derived_from: path@commit`; drift flags **specific** claims from changed sources.

## Human gates
- Necessity / coverage refusal may stop without a document.
- Gap-fill answers from the user.
- Extension Docs UI is optional; slash/natural language is enough. **Section assembly stays in the skill**, not TypeScript.

## Next step
None required. Optionally re-run Document after Test SHIP, or run `check_drift.py` in CI when sources move. Pipeline position is usually **after** Plan/Implement/Test when derived from those artifacts.

## Provenance
Derived from `resources/skills/grokbit-document/SKILL.md`, `references/loops.md`, `roles.md`, `registry.md`, `provenance.md`. **Agent procedure remains `SKILL.md`.**
