# Handoff — Question card color distinction

## Tasks done

- **T1:** Added `color: var(--vscode-charts-purple, #b180d7)` to `.card .question-text` in `media/chat.css`

## Tasks blocked

None.

## Files touched

- `media/chat.css` — one line added (line 2611)

## Dependencies added

None.

## Deviations

None.

## What a test should look at

- Visual verification: open a session, trigger an `ask_user_question` (or restore one), and confirm the question text renders in purple while the answer line stays green
- Both live and restored question cards share the `.question-text` class, so both are covered by the single CSS rule
- Light theme and dark theme should both show adequate contrast (the same `--vscode-charts-purple` token is already used by `.card-title` and the card's left border)
