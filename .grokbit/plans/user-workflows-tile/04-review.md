# Review log — User Workflows (Grok + Claude)

## Round 1–2 — Prior Grok-only design

Earlier findings (intent tension, kind-order test, root kind type, mount short-circuit) were addressed in the Grok-only draft. **Product direction then changed** to dual-backend; those fixes carry forward, Claude dead-end does not.

---

## Round 3 — Plan Reviewer (dual-backend revision)

Inputs: revised `01-intent.md`, `02-survey.md`, `03-design.md`.

### Findings

1. **[MAJOR] Claude invoke still UNVERIFIED** — Done-criterion “backend-appropriate launch command” fails if we seed a string Claude rejects. Design admits confirmation; plan T5 exists. Acceptable if gate acknowledges and T5 is not skippable without evidence.

2. **[MAJOR] Home Claude path vs `CLAUDE_CONFIG_DIR`** — Changelog references non-default config dir for user-scope saves. Skill roots today use `homeDir + ".claude/…"`. If implement hardcodes only `~/.claude/workflows` while user uses `CLAUDE_CONFIG_DIR`, discovery misses files.  
   **Resolve:** Plan notes: resolve home the same way Claude skill roots do in `CAPABILITY_ROOTS` / `listCapabilities` (`homeDir` from env/os); if `CLAUDE_CONFIG_DIR` is already handled elsewhere for skills, mirror it — if **not** handled for skills today, **LEAVE** as known limit (skills already miss that dir) and document in T4. Survey: skill roots use `home` + `.claude/skills` without special `CLAUDE_CONFIG_DIR` (`src/capabilities.ts` claude roots) — **consistent LEAVE**.

3. **[MINOR] `.ts` optional** — Design hedges; T2 should default **`.js` only** unless a one-line probe or doc says `.ts` is loaded, to avoid listing non-runnable files.

4. **[MINOR] whenToUse as description fallback** — Good; ensure truncation still sentence-aware only in webview (host hard-cap OK).

5. **[MINOR] Intent non-goal “no transpiler”** — Clear; prevents scope inflation. Good.

### Undeclared supersession

- Prior Grok-only empty product decision: design marks **REPLACE**. Good.
- Decision 1: REPLACE live claims. Good.

### Intent drift

- Dual done-criteria for both backends present. Non-goals block cross-format fantasy.

### Verdict (R3)

No BLOCKER. Open MAJORs are **gated assumptions** (invoke evidence; CLAUDE_CONFIG_DIR LEAVE aligned with skills). Architect: default T2 to `.js` only; keep T5; document CLAUDE_CONFIG_DIR as same limit as skills.

---

## Round 3 — Architect response

- T2 notes: **scan `*.js` only** unless evidence adds `.ts`.
- T5 remains required before calling Claude seed “done,” or fold evidence into T1 and check it off.
- `CLAUDE_CONFIG_DIR`: **LEAVE** — match skill roots; mention in T4 Known limits one line if docs mention workflows home path.
- Design table: Claude extension column “`.js` (default); `.ts` only with evidence.”

---

## Loop 4 — Plan-level pass (revised plan.md)

### Checks

- [x] Every task has runnable Windows-friendly verify
- [x] Dual-backend done-criteria mapped in verification matrix
- [x] Removal/REPLACE dispositions not silent
- [x] T3 short-circuit + dual empty messages present
- [x] Cross-pollution tests required in T2

### Findings

1. **[MINOR]** T5 may merge into T1 — OK; progress must not leave Claude invoke untested.
2. **[MINOR]** No separate “remove Grok-only empty copy” task — T3 replaces it by construction.

### Verdict

No BLOCKER. Ready for human approval of **dual-backend native User Workflows**.
