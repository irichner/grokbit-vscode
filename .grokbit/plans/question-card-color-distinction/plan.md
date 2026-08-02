# Plan — Question card color distinction

## Task T1: Add purple color to question text

**Intent:** Make the AI's question text visually distinct from the answer text inside question cards.

**Files:**
- `media/chat.css` — add `color` property to the existing `.card .question-text` rule

**Change:**
Add `color: var(--vscode-charts-purple, #b180d7);` to the existing `.card .question-text` rule at line 2606.

Before:
```css
.card .question-text {
  font-weight: 600;
  margin: 2px 0 6px;
}
```

After:
```css
.card .question-text {
  font-weight: 600;
  margin: 2px 0 6px;
  color: var(--vscode-charts-purple, #b180d7);
}
```

**Baseline:** Question text currently renders in `var(--vscode-foreground)` (inherited), indistinguishable from generic card body text. Answer text renders in green (`--vscode-charts-green`).

**Removes:** `none`

**Verify:**
```bash
cwd: c:\Users\israe\Projects\Grokbit.ai
verify: npm test
```

**Rollback:** Remove the `color:` line from `.card .question-text`.
