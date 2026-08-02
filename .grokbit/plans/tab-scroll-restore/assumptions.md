# Assumptions — Session tab scroll position restore

The one rolled-up ledger of every open item from this plan. Read at the
approval gate, and again by `grokbit-implement`'s Software Engineer before
touching a task one of these bears on — see `references/loops.md` for what
`UNVERIFIED` and `UNRESOLVED — <loop>` each mean and where they come from.

## From intake
Copied from `01-intent.md`'s `## Assumptions` — decided rather than asked.

- `UNVERIFIED` “Click on a tab” means Grokbit **session editor tabs** (`grok.session` WebviewPanel), not the activity-bar launcher list.
- `UNVERIFIED` “Hold its view” means keep the same approximate scroll offset into the message list after hide→reveal rebuild; if content only grew at the bottom while hidden, absolute `scrollTop` keeps the same messages in view.
- `UNVERIFIED` Restoring scroll after hide→reveal within the same VS Code window is sufficient; surviving a full window reload is optional.
- `UNVERIFIED` When the user was mid-scroll and a permission/question arrives while the tab is **visible**, existing force-scroll-to-bottom still applies. While the tab was **hidden**, restore mid-scroll on reveal rather than auto-jumping to a card that arrived while away.

## From grounding (Loop 2)
Entities the Systems Analyst could not resolve within 3 passes.

- _(none)_

## From adversarial review (Loop 3)
Findings that survived 3 rounds between the Reviewer and the Architect.

- _(none — Loop 3 exited Round 2 with 0 BLOCKER / 0 MAJOR)_

Residual **MINOR** (non-blocking, implement should still heed):
- try/finally around begin/end host wrap so `endPanelReplay` always posts
- do not force stick false in `resetForNewSession` — only skip forcing true
- suppress scrollState through the authoritative end post
- visibility flush is best-effort vs dispose race
- init `panelReplaying: false` on webview state bag

## From verifiability (Loop 4)
Anything that reached the plan without clearing the checklist or the plan-level
Reviewer pass, if it reached the plan at all rather than being split or rewritten.

- `UNVERIFIED` Full VS Code multi-tab hide/reveal cannot be automated in the grok-free suite; T5 requires a short **manual** pass for done-criteria 1–4 after install. Automated tests cover the mechanism.

## Resolution
Every item above is either resolved before the gate, carried into `plan.md`'s
`## Open assumptions` for the human to see, or explicitly waived at the gate.
An item that reaches implementation still unresolved is Implement's problem to
surface as a deviation, not to silently work around.

### Manual multi-tab checklist (T5 / human)
After install, in a real VS Code window:

1. Long session → scroll mid-history → other editor tab → back → still mid-history  
2. Scroll to bottom → switch away/back → still at bottom  
3. At bottom with streaming → stays pinned  
4. Mid-scroll with background growth → no yank to bottom on return  
