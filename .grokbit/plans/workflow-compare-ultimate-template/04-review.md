# Review log — workflow-compare-ultimate-template

Append-only.

---

## Round 1 — Prior design (two-way “which is better”)

Superseded by revision 2026-08-03. See git/plan history; findings closed by scope change.

---

## Round 2 — Three-way + extension goal (design adversarial)

**Inputs:** revised `01-intent.md`, `02-survey.md`, `03-design.md`.

### Findings

1. **[BLOCKER] none** on factual grounding of hooks absence + skill parity — directory list + `fc`/hash cited.

2. **[MAJOR] Wave 1 scope ambiguity: workspace vs home hooks** — Evidence: design lists both; template is workspace + `--with-hooks`; Grok global hooks always trusted (`hooks/README.md`). Shipping home-tier hooks could surprise every project (same disclosed cost as skill suite). **Resolution:** plan tasks must pick **workspace-first** provision + explicit setting; home-tier deferred or separate task with disclosure.

3. **[MAJOR] “Enhance extension” vs “copy hooks into monorepo only”** — Intent requires product capability. Option D Wave 1 includes product provision — good. **Resolution:** `plan.md` orders **extension provisioner + tests** before or with dogfood enable; dogfood-only is not sufficient for done-criteria.

4. **[MINOR] Ship skill may bloat suite** — COEXIST is fine; keep seed-only if skill is heavy.

5. **[MINOR] Persona lag UNVERIFIED** — record only; not Wave 1 blocker.

### Architect response

- Wave 1 tasks: workspace provision default; setting `off` by default for non-owned workspaces; optional command “Install Grok harness hooks in this workspace”.
- Dogfood enable is a separate task after provisioner exists (eat own dogfood).
- Ship is Wave 2; thin seed acceptable.

**Outstanding MAJOR:** 0 after response.

---

## Round 3 — Plan-level pass (Loop 4)

See `plan.md`. Checks:

- verify commands Windows-friendly
- baselines for extension behavior
- removes: none unless dogfood adds files only
- disposition REPLACE soft-only dogfood tied to T3/T4
- Verification matrix covers intent criteria

### Findings

1. **[MINOR]** Full live hook integration test needs real grok — keep out of `npm test`; unit-test pure functions only (matches template + Grokbit test taxonomy).

**Outstanding BLOCKER/MAJOR:** 0.
