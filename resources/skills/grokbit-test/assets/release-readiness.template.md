# Release readiness — <slug>

## Deployment target
Detected: <Vercel | Netlify | Kubernetes | Docker/Compose | Heroku | other | NONE DETECTED>

<If NONE DETECTED:> No deployment target exists yet for this repo. The Build,
Environment parity, and Migrations sections below describe the local
production build only — they are not a claim about a live deployment,
because there is not one. SHIP here means "this build is sound enough to
deploy once a target exists," not "this is live."

## Verdict
**SHIP** | **SHIP WITH CAVEATS** | **DO NOT SHIP**

Folds in done-criteria coverage and regressions from `test/results.md` and
findings from `test/security.md` alongside the build/env/migration checks
below — this is the overall verdict for the change, not only for the build.

<One paragraph a non-engineer can act on.>

## Evidence
- Done-criteria proven: N of N (unverified: <list>; failed: <list>)
- Regressions: N (<list>)
- UNKNOWN residuals: N (<list> — each blocks plain SHIP; list as caveats or resolve with human)
- Security: N critical / N high / N medium
- Build: pass/fail · Visual: N pass / N fail

## Build
| Check | Result |
|---|---|
| Production build from clean | PASS |
| Production start + health check | PASS |
| Bundle size delta | +14kb (2.1%) |

## Environment parity
Names only. Never print values. `UNVERIFIED` means the target's tooling
could not be reached with the credentials available locally — it is not the
same claim as "checked, present." A missing deployment target (see above)
makes every row in this table `UNVERIFIED` for that same reason.

| Var | Code requires | Target defines |
|---|---|---|
| `STRIPE_KEY` | yes | yes |
| `RESET_TOKEN_TTL` | yes | **MISSING** |
| `SESSION_SECRET` | yes | UNVERIFIED — vercel CLI not authenticated locally |

## Migrations
| Migration | Reversible | Duration | Rolling-deploy safe |
|---|---|---|---|
| `0004_reset_tokens` | yes | ~2s | yes |

Rolling-deploy safety is read off the deployment target's own rollout
strategy where one exists (a Kubernetes Deployment's `strategy.type`, a
documented PaaS deploy model); mark it `UNVERIFIED` rather than guessing
where no target was detected.

## Caveats
Operationally concrete, not vague.
- Requires `RESET_TOKEN_TTL` set before deploy or resets fail closed.

## Blockers
- <only if DO NOT SHIP>
