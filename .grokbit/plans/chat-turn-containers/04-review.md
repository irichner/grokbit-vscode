# Review log — Chat turn containers

## Round 1 — Plan Reviewer (adversarial)

Inputs: `01-intent.md`, `02-survey.md`, `03-design.md` (re-read from disk).

### Findings

1. **[MAJOR] Late toolCallUpdate after seal — design accepts no-op but survey danger zone tests encode opposite contract**  
   Evidence: `test/activity-carousel.dom.test.ts:154-175` (late output after freeze); design says clear map and no-op.  
   Resolve: Explicit task to rewrite those tests and clear `toolItemsByToolCallId` / failure maps on activity destroy. Not a design change — must appear in `plan.md`.

2. **[MAJOR] Interactive cards after resolve vs “only final answer remains”**  
   Evidence: DC4 says only prompt + final answer; DC8 says cards stay until answered; design says “prefer keep collapsed history line until turn seal.” Ambiguous after seal: do collapsed “Allowed” lines remain?  
   Resolve: **Product rule for implement:** after `commitAgentTurn` seal, strip resolved permission/question chrome for that turn as well (same ephemeral class as tools). Plan cards that are the *deliverable* of a plan-mode turn may remain if they are the user’s outcome — but default plan-mode “implement it now” follow-up is a new turn. Document in design notes below.

3. **[MAJOR] Narration-only then tools then answer — answer slot ownership**  
   Evidence: design reuses fold-into-activity for narration (`media/chat.js:3098-3112`) but `appendAgent` currently always uses `addMessage("agent")` on `#messages`. Without an explicit “answer slot” vs “narration” rule on every `appendAgent`, implementers will leave narration as permanent `.msg.agent` under the turn.  
   Resolve: Design must require: agent text is **provisional** until seal; if tools start after it, fold into activity (existing); if `promptComplete` fires with an open agent bubble not in activity, reparent/keep as `.turn-answer`. Task must cover this.

4. **[MINOR] COEXIST classic mode complexity**  
   Evidence: disposition for `compactActivity: false` still describes two behaviors. Risk of dual bugs.  
   Resolve: Acceptable if plan has one code path: turn wrappers always; compact only changes live presentation; seal always destroys intermediate.

5. **[MINOR] Sticky under `zoom` / composer**  
   Evidence: ADR 0002 zoom model; sticky `top: 0` is relative to `.messages` scrollport — should work, but verify with font scale in a DOM or manual note.  
   Resolve: One verify step or test that `.turn-prompt` computed style includes sticky when active.

6. **[MINOR] `makeCollapsible` LEAVE may still compete**  
   Evidence: two expand affordances.  
   Resolve: In turn-header UX task, disable or skip `makeCollapsible` when the prompt is already inside a turn header that truncates the summary line.

### Grounding spot-check

- `media/chat.css:160-168` — `.messages` flex scroll: **confirmed** via survey (file read this session).
- `finalizeActivity` freeze at `media/chat.js:3011-3043`: **confirmed**.
- No `.turn` entity: **confirmed** DOES NOT EXIST.

### Intent drift

- Design covers DC1–DC9; non-goals respected (no ACP/host redesign).
- No scope inflation into launcher/status bar.

### Undeclared supersession

- All survey supersession rows have dispositions in design table.

### Exit Round 1

Architect must address MAJOR 1–3 before Loop 3 exit.

---

## Round 1 — Architect responses (design amendments)

1. **Late updates:** Accepted. `plan.md` T3/T5 will clear tool maps on activity destroy and replace late-attach tests with “late update after seal is a no-op” assertions.

2. **Resolved cards at seal:** **Amendment:** On turn seal (`commitAgentTurn`), remove from the turn: `.turn-activity`, thinking rows, tool groups, **and** resolved permission/question cards (`.card.perm-resolved`, collapsed question cards). Unresolved cards **block seal visually** only in the sense they remain until the user acts (agent may still complete — if `promptComplete` fires while a card is unresolved, keep the unresolved card, destroy only activity). Plan-review card: while awaiting verdict it stays; after verdict the existing afterTurn flow starts a new agent phase — treat as same turn or new turn per current host behavior (today `commitAgentTurn` can fire before afterTurn). **Pragmatic rule:** do not delete an **unresolved** `.card` on seal; do delete resolved ones and all activity. Final answer remains.

3. **Answer slot:** **Amendment:** Introduce `ensureTurnAnswerEl()`; `appendAgent` writes there when not being folded into activity. Fold path unchanged. On seal, destroy activity; keep answer el.

4. Classic mode: single path confirmed — always turns; compact only live presentation; seal always destroys intermediate.

5–6. Accepted as implement notes for T1/T4.

### Design file

Amendments above are normative; `03-design.md` Decision section stands with these clarifications treated as binding for Implement.

---

## Round 2 — Plan Reviewer

Re-check MAJORs:

1. Late updates — assigned to tasks: **cleared**.
2. Cards at seal — explicit rule: **cleared**.
3. Answer slot — `ensureTurnAnswerEl`: **cleared**.

**Outstanding:** zero BLOCKER, zero MAJOR.

**MINOR residual:** sticky+zoom manual check — track in assumptions as `UNVERIFIED` visual if no headless browser beyond happy-dom.

### Loop 3 exit

Zero BLOCKER / MAJOR. Proceed to decompose.

---

## Plan-level pass (Loop 4) — after `plan.md`

Inputs: `plan.md` + prior artifacts (re-read).

### Checklist

| Check | Result |
|---|---|
| Every task has runnable `verify:` for this repo (`npm test -- …` / `npm test`) | PASS |
| `cwd:` none appropriate (single package) | PASS |
| Files named specifically | PASS |
| `depends:` chain T1→T6 linear and honest | PASS |
| `baseline:` filled (non-none where behavior shifts) | PASS |
| `removes:` on T3/T6 for REPLACE work | PASS |
| `state-after: working` throughout | PASS |
| Verification matrix covers DC1–DC9 | PASS |
| Disposition summary matches design (REPLACE/COEXIST/LEAVE) | PASS |
| Each `verify:` proves task intent (not only `tsc`) | PASS — DOM tests + full suite |

### Findings

1. **[MINOR] T1 verify alone cannot prove sticky pin in real VS Code** — happy-dom can assert class/style; residual in `assumptions.md`. Accept.
2. **[MINOR] T6 may be thin if T3 already removed freeze behavior** — still valuable as explicit REPLACE cleanup + grep gate. Accept.

**BLOCKER:** none · **MAJOR:** none.

Loop 4 exit: plan is implementable.
