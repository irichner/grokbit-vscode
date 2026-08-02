# Baseline — vibe-coder-wave-1

Characterized **before** T1–T6 source edits for this wave (2026-08-02).

## T1 / T2 — permission bind

- Path-only grants: `extractGrant` ignores body; `consumeWriteGrant(path, grants)` path-matches only.
- Same path + different content **allowed** after allow_once if path matches.
- Empty grants → any write allowed.
- Durable allow_always kept after consume.

## T3 — mid-turn queue

- `queueFollowUpSend` pushes `{ text, sentChips, sentImages }`; no webview ack until drain.
- Composer clears; no “Queued” badge.

## T4 — steer

- Mid-turn send always queues; no `steer` flag; Ctrl+Enter is send when `useCtrlEnter`.

## T5 — docs

- CLAUDE.md: same-path content bait-and-switch “not covered (v1)”.
