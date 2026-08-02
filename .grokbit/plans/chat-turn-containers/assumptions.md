# Assumptions — Chat turn containers

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on.

## From intake

Copied from `01-intent.md`'s `## Assumptions`.

- `UNVERIFIED` Expanding a **previous** turn shows **user prompt + final answer only** (not tools/thinking).
- `UNVERIFIED` Intermediate activity is **ephemeral** (not frozen into a permanent summary strip).
- `UNVERIFIED` Sticky applies to the **active** turn’s prompt only; collapsed priors may scroll away.
- `UNVERIFIED` Unresolved interactive cards stay until answered; resolved cards need not remain after seal (design amendment: strip resolved on seal).
- `UNVERIFIED` Generated media / business document cards count as final answer surface.
- `UNVERIFIED` Classic `compactActivity: false` remains as live-presentation variant under the same turn model (seal still destroys intermediate).

## From grounding (Loop 2)

- None — entity list resolved within one pass (sample bounded to chat webview surface).

## From adversarial review (Loop 3)

- None outstanding (MAJORs addressed in design amendments + plan tasks).
- `UNVERIFIED` Sticky prompt under non-default `grok.chatFontScale` (`zoom`) is correct in real VS Code (happy-dom may not fully prove visual pin). Manual smoke after implement recommended.

## From verifiability (Loop 4)

- None — every task has a runnable `npm test` verify on Windows-friendly npm scripts.

## Resolution

Human at approval gate may override:

1. Whether resolved permission lines should remain for audit (default: strip on seal).
2. Whether classic mode must keep intermediate rows **after** seal (default: **no** — always clean final surface).
