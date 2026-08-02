# Progress — Question card color distinction

## T1: Add purple color to question text

- **Status:** done
- **Attempt:** 1 of 3
- **Change:** Added `color: var(--vscode-charts-purple, #b180d7);` to `.card .question-text` in `media/chat.css:2611`
- **Verify:** `npm test` — 1391/1391 pass (64 test files, all green)
- **Scope audit:** IN_SCOPE — one line in the declared file, matching the declared intent
