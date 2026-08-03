# 0004. Workflow Builder canvas is a zero-dep vanilla pipeline (not React Flow in v1)

- **Status:** Accepted
- **Date:** 2026-08-02
- **Deciders:** Israel Richner (via plan approval + implement defaults)
- **Plan:** `.grokbit/plans/user-workflows-display-builder/`

## Context

User Workflows need a **Workflow Builder**: goal-first form + **visual canvas** of phases/agents, then **Craft with AI** hands a structured brief to the create-workflow skill. Business Studio E6 deferred React Flow pending an ADR covering dependency cost, webview CSP, test strategy, and thin-client coexistence (`docs/plans/grokbit-business-studio-3.0.md` § E6).

The session webview is plain `media/chat.js` + `media/webview-helpers.js` shipped without a webview bundler (`package.json` `compile` is host `tsc` only). Adding React Flow implies React + a webview bundle step + CSP/`localResourceRoots` review.

## Options

### A — Vanilla DOM pipeline canvas (zero new deps)

Horizontal/vertical phase cards with agent slots; ↑↓ / add / remove; pure draft model in JS helpers; happy-dom unit/DOM tests against real `chat.js`.

### B — React Flow (`@xyflow/react`) + React + webview esbuild

Industry graph UX; requires new runtime deps, bundler scripts, dual packaging (host tsc + webview bundle), heavier CSP surface.

### C — Other graph library without React

Still a new dependency and load path; little win vs vanilla for a linear phase pipeline.

## Decision

**Chosen: A — vanilla pipeline canvas for v1.**

React Flow remains a **future amendment** if the linear pipeline UX proves insufficient (true free-form graphs, pan/zoom at scale). Form wizard + visual phase/agent canvas still ship; AI still authors scripts via the CLI skill (thin client).

## Consequences

- **No new npm dependencies** for the builder canvas.
- Canvas lives in `media/chat.js` / `media/chat.css` with pure helpers in `media/webview-helpers.js` (or sibling pure module if size demands).
- Tests: vitest + happy-dom (existing pattern).
- CSP unchanged for canvas (no new script origins).
- E6 roadmap status: this ADR + the user-workflows plan supersede “canvas forever out of 3.0” for the **Grokbit Workflows Create path** only — not Business Studio export/n8n.

## Rejected for v1 (what B was better at)

- Power-user freeform graphs, pan/zoom, edge routing polish.
- Ecosystem of React Flow examples.

Revisit if builder graphs become multi-edge DAGs or if maintainers accept a webview bundler for other reasons.
