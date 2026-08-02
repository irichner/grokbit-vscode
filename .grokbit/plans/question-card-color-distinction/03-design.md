# Design — Question card color distinction

## Approach A: Purple question text (use the card's own accent)

Set `.card .question-text` color to `var(--vscode-charts-purple, #b180d7)` — the same purple the card already uses for its left border and `.card-title`. The question text becomes purple, the answer stays green.

**Pros:**
- Consistent: the question card's own accent color marks "this is a question"
- Already proven to work in both light and dark themes (the card title uses it today)
- Immediate visual pairing — purple question, green answer, at a glance
- No new color introduced to the palette

**Cons:**
- Purple-on-dark-background can feel muted in some themes (but the card title already reads fine)

## Approach B: Cyan question text (use the extension's accent)

Set `.card .question-text` color to `var(--neon-cyan-ink)` — the extension's blended accent used for links, code refs, and list markers.

**Pros:**
- Bolder contrast than purple in most dark themes
- Ties the question to the extension's overall visual identity

**Cons:**
- Cyan is already overloaded (links, code, markers, focus rings, activity dots) — adding it to question text reduces its semantic specificity
- Reads as "clickable" or "code reference" rather than "question"
- The card's own accent is purple; using cyan would create two competing accents on one card

## Decision: Approach A — Purple

Purple is the question card's established accent. The `.card-title` ("Grok is asking" / "You answered") already renders in purple and reads clearly in both themes. Applying the same color to `.question-text` creates an obvious visual hierarchy:

1. **Purple** = what the AI asked (the question)
2. **Green** = what you answered (the answer line)
3. **Default foreground** = card chrome (options, labels, body text)

This keeps the semantic mapping clean (purple = question, not purple = "everything in a question card"), and it doesn't introduce a new color or overload an existing one.

## Supersession

| Item | Disposition | Reason |
|------|------------|--------|
| (none) | — | Pure addition; nothing is replaced or duplicated |
