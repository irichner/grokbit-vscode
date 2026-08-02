# Scope Audit — Question card color distinction

## T1: Add purple color to question text

### Diff

```diff
 .card .question-text {
   font-size: 14px;
   font-weight: 600;
   line-height: 1.35;
   font-family: var(--vscode-font-family);
+  color: var(--vscode-charts-purple, #b180d7);
 }
```

### Classification

| Hunk | Classification | Reason |
|------|---------------|--------|
| `+  color: var(--vscode-charts-purple, #b180d7);` | IN_SCOPE | Plan declared this exact property addition in `media/chat.css` |

### Findings

No OUT_OF_SCOPE or INCIDENTAL hunks. No deletions. No undeclared files touched.
