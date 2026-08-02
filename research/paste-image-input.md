# Paste image input (ACP `promptCapabilities.image`)

**Related plan:** [docs/plans/paste-screenshots.md](../docs/plans/paste-screenshots.md)  
**Date:** 2026-08-02

## Known baselines (prior research)

| Backend | `promptCapabilities` (from earlier probes) | Notes |
|---------|-----------------------------------------------|--------|
| Grok Build CLI | `{ image: false, audio: false, embeddedContext: true }` | [voice-input.md](voice-input.md), [image-generation.md](image-generation.md). Image **generation** (`/imagine`) is unrelated to prompt **input**. |
| Claude Code ACP adapter | Not permanently recorded here | Re-probe with `research/paste-image-probe.cjs` when claiming vision in release notes. |

## Client capability advertisement

ACP requires **agent** `promptCapabilities.image` for image content blocks in `session/prompt`. Clients are not required to advertise image support on `initialize` for outbound prompts; the agent rejects unsupported blocks with `-32602` if sent without the capability.

Grokbit stores the agent flag on `AcpClient.promptCapabilities` and only emits image blocks when `image === true`.

## Extension behavior (shipped)

1. Paste always stages a file under extension globalStorage `paste-images/<key>/`.
2. Composer shows thumbnail tiles; non-vision agents get an honest notice.
3. On send: multi-block prompt when `image: true`; path-in-text fallback otherwise.

## Manual probe

```bash
# When available: spawn real CLI / Claude adapter and log initialize + optional 1x1 PNG prompt.
# node research/paste-image-probe.cjs
```

Probe script is optional pre-release; unit tests cover the capability gate and block builder without a live CLI.
