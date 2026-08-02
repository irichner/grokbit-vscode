# Deviations — chat-turn-containers

## Waivers — recorded here, never counted

- Baseline declined — n/a — `test/baseline.md` written instead.
- Auto-commit per task — 2026-08-01 — project `CLAUDE.md` forbids automatic commits; user must commit. Not a plan contradiction.
- Hand-back intake — none.

## D1 — T3 — resolved cards not stripped on seal

Plan expected: strip resolved permission/question chrome on `commitAgentTurn` (design amendment).
Actually found: stripping broke restored permission history and mid-turn audit lines; tests require collapsed cards to remain.
Impact: durable collapsed cards stay; only tools/thinking/activity are ephemeral.
Resolution: adapted in T3 — destroy activity/tools/thinking only; keep `.card` nodes. Recorded as intentional product refinement.

---

Count: 1 of 3
