# Assumptions & unresolved

## Unverified

- `UNVERIFIED` Live `grok inspect --json` on Grokbit.ai workspace (hook list empty) was not re-run this revision; absence of `.grok/hooks/` is from directory listing.
- `UNVERIFIED` Exact product default for `grok.hooks.provision` (off vs auto) — design recommends **off** for foreign workspaces; operator may prefer on for Grokbit dogfood only.
- `UNVERIFIED` Whether extension should provision hooks to **home** `~/.grok/hooks/` (affects every project) vs **workspace only** — template install is workspace; global hooks exist per hooks README (always trusted). Product decision at implement.
- `UNVERIFIED` Empirical A/B of Ship Action success rate.
- `UNVERIFIED` Full line-by-line diff of all GrokForge vs Grokbit `.grok/personas` (plan/implement skills hash-matched; personas may lag).

## Unresolved loops

None blocking design. Wave defaults marked above for human gate.

## Pointers

- Comparison trees: Ultimate `C:\Users\israe\Projects\claude-code-ultimate-template`; GrokForge `C:\Users\israe\Projects\grokbuild-dev-team-template`.
