# Assumptions — Collapsible long user prompts

## From intake

- `UNVERIFIED` “First line” means one **visual** line (line-clamp), not only text before the first `\n`.
- `UNVERIFIED` Expanded state need not persist across session restore.
- `UNVERIFIED` Applies to active sticky prompts and expanded prior-turn prompt bodies equally.
- `UNVERIFIED` Expand control must be discoverable without hover.

## From grounding (Loop 2)

None unresolved — all entities resolved with citations.

## From adversarial review (Loop 3)

None unresolved. Round-1 MAJORs closed by pure collapse criterion + explicit replay task.

## From verifiability (Loop 4)

None.

## Resolution

- Pure criterion constants (newline / min chars) are implementer-tunable; if live wrap-only long lines still feel tall, measurement enhancement already in design.
- Human may override at gate: prefer `\n`-only, or different char threshold.
