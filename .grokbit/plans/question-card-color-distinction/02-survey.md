# Survey — Question card color distinction

## Entities

### Question card CSS (`media/chat.css`)

- `.card.question` — purple left border (`--vscode-charts-purple, #b180d7`): `chat.css:2595`
- `.card.question .card-title` — small uppercase label, uses `--vscode-charts-purple`: `chat.css:2598`
- `.card .question-text` — bold, inherits `var(--vscode-foreground)` (no explicit color set): `chat.css:2606`
- `.card .question-answer` — green, `color: var(--vscode-charts-green, #89d185)`: `chat.css:2615`
- `.card.question.resolved` — stays at `opacity: 1` (bright, not dimmed): `chat.css:2614`
- `.card .question-options` — flex column of option buttons: `chat.css:2620`
- `.card button.question-option` — toggleable button with selected state: `chat.css:2621–2643`
- `.card button.question-skip` — small underlined link: `chat.css:2646–2657`

### Question card JS (`media/chat.js`)

- `buildQuestionHead(el, headingText)` — creates `.card-title` with heading text: `chat.js:4457–4464`
- `answerLineEl(labels)` — creates `.question-answer` span with `✓ <labels>`: `chat.js:4466–4477`
- `addQuestionCard(req)` — renders live interactive card, title "Grok is asking": `chat.js:4480–4587`
- Question text element created with `className = "question-text"`: `chat.js:4520` and `chat.js:4686`
- `addRestoredQuestionCard(questions, answerText)` — renders replay card, title "You answered": `chat.js:4674–4695`
- `fillRestoredAnswer(el, answerText)` — fills answer into restored card: `chat.js:4699–4713`

### Color semantics (established patterns)

- **Purple** (`--vscode-charts-purple, #b180d7`) — questions, Claude-backend badge: `chat.css:2595`, `chat.css:2598`
- **Green** (`--vscode-charts-green`) — success/answered/approved: `chat.css:2615`
- **Orange** (`--vscode-charts-orange, #d7ba7d`) — rejected/warning: `chat.css:2559`
- **Cyan** (`--neon-cyan-ink`) — accent (links, focus rings, activity): `chat.css:14`
- Foreground — `var(--vscode-foreground)` — default card body text

### Existing question-text styling

`.card .question-text` at `chat.css:2606` currently sets:
```css
.card .question-text {
  font-weight: 600;
  margin: 2px 0 6px;
}
```
**No `color` property.** It inherits `var(--vscode-foreground)` from `.card`. This is the element that needs a distinct color.

### Tests

- `test/question-card.dom.test.ts` — 279 lines, covers single-click, multi-select, Submit gate, Skip, replay with two agent schemas. DOES NOT assert colors — only structure and behavior.

## Conventions

- Card accent colors are VS Code chart tokens (`--vscode-charts-*`)
- The question card already uses purple as its accent (left border, `.card-title` color)
- The answer line uses green (`--vscode-charts-green`)
- No hardcoded hex values appear without a CSS custom property fallback

## What is missing

Nothing. This is a one-property CSS addition to an existing selector.

## Supersession

Nothing is being replaced, duplicated, or made dead. This adds a `color` property to an existing CSS rule.
