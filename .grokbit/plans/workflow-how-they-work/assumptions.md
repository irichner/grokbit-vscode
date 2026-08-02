# Assumptions — workflow-how-they-work

## From intake
- Confirmed answers: five Grokbit Actions workflows; UI **and** docs; full technical depth.
- Inferred: short Actions `description:` stays; full detail is a second layer.
- Inferred: agent `SKILL.md` remains procedure SoT; how-it-works is product-facing derived layer.

## From grounding (Loop 2)
- None unresolved. `detail` field DOES NOT EXIST today (by design of this plan to add).

## From adversarial review (Loop 3)
- None outstanding after Round 2.

## From verifiability (Loop 4)
- None.

## Still open for implement
- `UNVERIFIED` Which exact chat.js function is the safe markdown render entry for agent bodies — reuse if clear; else `textContent` + whitespace for v1 Details body.
- `UNVERIFIED` Sidebar access to extension root string at `listCapabilities` — standard `ExtensionContext`; confirm call site when wiring T2/T3.

## Resolution
Carry open `UNVERIFIED` items into implement; resolve on first touch of T3/T4. Not gate-blocking if fallbacks in plan notes are followed.
