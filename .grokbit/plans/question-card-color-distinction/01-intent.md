# Intent — Question card color distinction

## Problem

When the AI asks a question via `ask_user_question`, the question text and the user's answer text are visually indistinct inside the question card. The question text (`.question-text`) renders in bold foreground and the answer text (`.question-answer`) renders in green, but both sit inside the same card body with no color differentiation on the question itself — it reads as the same foreground color as every other card element. A user scanning a resolved card has to read the content to tell question from answer rather than seeing it at a glance.

## Done-criteria

- [ ] The question text inside a live question card is visually distinct from the answer line via color
- [ ] The question text inside a restored/replay question card uses the same distinct color
- [ ] The color uses a VS Code theme token (not a hardcoded hex) so it works in both light and dark themes
- [ ] Existing question card behavior is unchanged: options, submit, skip, collapse, replay
- [ ] Existing tests pass (`npm test`)

## Non-goals

- Changing the card's structural layout, border color, or background
- Changing the answer line color (green `--vscode-charts-green` is correct and stays)
- Adding any new host-side logic, settings, or messages
- Changing permission cards, plan cards, or any other card type

## Constraints

- CSS-only change in `media/chat.css` — no JS, no host code
- Must use VS Code theme variables (the `--vscode-*` custom property convention), not hardcoded colors
- Must not break light-theme or dark-theme readability
