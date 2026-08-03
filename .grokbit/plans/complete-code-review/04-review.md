# Review log — Whole-product code review

Append-only. Never overwrite a previous round.

## Round 0 (superseded)

Earlier WIP-only design was reviewed then **rejected by user** (“I wanted a whole product review”). That design is replaced; findings from Round 0 do not apply to the new design.

---

## Round 1
Reviewed: revised `01-intent.md`, `02-survey.md`, `03-design.md` (whole product)

- `[MAJOR]` Intent DC6 names `npm run compile` OR tsc — survey cites CI `npm run compile` (`.github/workflows/ci.yml:28`) but plan must pick **one** verify command that exists in `package.json` — resolves by: confirm script name in plan T8 verify.
- `[MAJOR]` L3 lists `sidebar.ts` as required deep-dive but design allows sampling >800 lines without requiring a **minimum set of host message handlers** (startSession, permission, logout, plan exit) — risk of missing dual-backend bugs — resolves by: force-checklist of named host flows in L3.
- `[MINOR]` Live tests optional — OK; gate must still offer expand once.
- `[MINOR]` token-metrics in L7 — good.

### Architect response — Round 1

- `[MAJOR]` compile script → **REVISED**: plan uses CI-identical `npm run compile` and `npm test` (fail if script missing).
- `[MAJOR]` L3 force-checklist → **REVISED**: Session/host layer must explicitly cover: `startSession` backend branch, panel `ready`/replay, `logout` per-backend, permission request path, plan approve/reject follow-up, session resume with backend — listed in T4 notes.
- `[MINOR]` live tests → open assumption + gate note.

## Round 2

- Spot-check: `plan-gate.ts:242` `shouldBlockWrite` citation — valid from prior open.
- Disposition covers WIP-only replace — good.
- No BLOCKER remaining.

### Architect response — Round 2

None required.

## Outcome

Rounds used: 2 of 3  
Outstanding: optional live suite expansion (assumptions)

## Plan review (Loop 4)

Reviewed: `plan.md` (whole-product)

- Every DC1–DC9 maps to a task.
- L1–L7 covered by T2–T8.
- Product code `removes:` none; process REPLACE only.
- T8 always synthesizes even if Criticals found.

Outcome: clean for gate
