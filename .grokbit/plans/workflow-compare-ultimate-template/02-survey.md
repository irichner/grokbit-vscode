# Survey — Three systems (extension enhancement brief)

Every claim confirmed by open/list this session unless marked.

## Entity resolution

| Entity | Status | Location |
|---|---|---|
| Grokbit product suite | EXISTS | `resources/skills/README.md:1-65`, five `grokbit-*` dirs |
| Grokbit project `/plan`+`/implement` | EXISTS | `.grok/skills/plan/SKILL.md`, `.grok/skills/implement/SKILL.md` |
| Grokbit `.grok/hooks/` Stop gate | **DOES NOT EXIST** | listed `.grok/` — no `hooks` dir; vs template has full hooks tree |
| Grokbit extension skill provision | EXISTS | `Claude.md` § Grokbit Actions; `src/skill-suite.ts` (map); home-tier copy |
| Grokbit capability/workflow discovery | EXISTS | `src/capabilities.ts:43-167` (`grokbit` + `workflow` kinds) |
| Ultimate six surfaces | EXISTS | `...\claude-code-ultimate-template\docs\FEATURES.md:9-95` |
| Ultimate Stop hook (bash) | EXISTS | `...\.claude\hooks\verify-on-stop.sh:1-80` |
| Ultimate `/ship` | EXISTS | `...\.claude\commands\ship.md:1-48` |
| Ultimate Claude-only ADR | EXISTS | `...\docs\adr\0004-claude-code-only-template.md` |
| GrokForge template README | EXISTS | `...\grokbuild-dev-team-template\README.md:1-70` |
| GrokForge `/plan`+`/implement` pipeline | EXISTS | `...\docs\WORKFLOW.md:1-80` |
| GrokForge Python hooks | EXISTS | `...\.grok\hooks\` (`verify_on_stop.py`, `protect_paths.py`, …) |
| GrokForge hooks ADR | EXISTS | `...\docs\adr\0001-grok-hooks-enforce-gates.md:1-100` |
| GrokForge dual-stack ADR | EXISTS | `...\docs\adr\0002-dual-stack-precedence.md:1-100` |
| GrokForge installer | EXISTS | `scripts/install_agentic_team.py` (README:17-46) |
| plan/implement skill parity Grokbit↔template | EXISTS identical | `fc` no differences plan; implement SHA256 match this session |

---

## System 1 — Grokbit.ai (extension monorepo)

### A. Product suite (shipped to users)

- Pipeline: explore → plan → approve → test(baseline) → implement → test(verify) (`resources/skills/README.md:45-65`).
- Artifacts: `.grokbit/plans/<slug>/` multi-file contracts.
- Differentiator: baseline-before-change, verify-or-revert, supersession dispositions, multi-host skills, document skill.

### B. Project agentic team (dogfood)

- Same lineage as GrokForge template skills (byte-identical plan/implement verified).
- Accuracy protocol, `gf-*`, hard gates, metrics/VERSION ceremony (`AGENTS.md`, `.grok/skills/implement/SKILL.md`).
- **Missing vs current GrokForge template:** `.grok/hooks/` runtime enforcement (Stop Lint+Unit, protect_paths, session token capture) — **absent in this workspace**.

### C. Extension host (the enhancement target)

| Capability | Evidence |
|---|---|
| Dual backend Grok + Claude | `Claude.md` ACP / backends map |
| Actions UI: suite tiles + User Workflows | `src/capabilities.ts` kinds `grokbit`/`workflow`; plans under `.grokbit/plans/user-workflows-*` |
| Home-tier skill suite provision | `resources/skills/README.md:23-38` |
| Workflow Builder (vanilla canvas) | `docs/adr/0004-workflow-builder-canvas.md` |
| Plan mode primer / client plan gate | `Claude.md` plan-mode sections |
| **No** first-class Grok hooks provision UI | absences: no `.grok/hooks` product path like skill suite |
| **No** `/ship`-equivalent Action | suite skills are phase tiles, not one-shot orchestrator |
| MCP not enumerated in capability browser | `Claude.md` Known limits |

---

## System 2 — Claude Code Ultimate Template

| Surface | Role | Cite |
|---|---|---|
| `CLAUDE.md` | Always-on loop + Project Facts | `CLAUDE.md:8-58` |
| 9 agents | Least-privilege + model tiers | `FEATURES.md:21-37` |
| 7 skills | verification-loop, tdd, … | `FEATURES.md:46-60` |
| 9 commands | `/ship`, `/plan`, … manual-only | `ship.md`, `FEATURES.md:62-68` |
| Hooks | Stop verify, protect paths, format | `settings.json`, `verify-on-stop.sh` |
| MCP | examples | `.mcp.json` |

**Design principle:** deterministic hooks are the backbone; policy alone is advisory (`WORKFLOW.md:96-100`).  
**Runtime:** Claude-only (ADR 0004).  
**Agent budget:** ~5 subagents (`ship.md:15-18`).

**Extension-relevant ideas:** one-command ship; Stop gate; protect secrets; bootstrap Project Facts → gate commands; checkpoint UX.

---

## System 3 — GrokForge Agentic Dev Team Template

| Surface | Role | Cite |
|---|---|---|
| `AGENTS.md` + `.grok/` | Lead + plan/implement ownership | `WORKFLOW.md:1-24`, `FEATURES.md:10-56` |
| Personas `gf-*` | Skill-owned only | `FEATURES.md:26-38` |
| Standards docs | plan/UI/coverage/test-accuracy | `FEATURES.md:60-66` |
| **Python hooks** | Stop Lint+Unit; protect paths; tokens | `FEATURES.md:87-89`, `hooks/README.md:1-25`, ADR 0001 |
| Dual-stack | Claude optional; Grok wins; rename collisions | ADR 0002 |
| Installer | `install_agentic_team.py` (+ `--with-hooks`) | `README.md:17-46` |
| Fixtures A–E | Acceptance for template quality | `FEATURES.md:79-81` |
| Sample app | TaskBoard (not installed out) | `README.md:69-102` |

**Confirmed CLI facts (hooks):** discovery `.grok/hooks/*.json` not bare `.grok/settings.json`; no `${VAR}` expansion; Python for Windows; backstop only (`hooks/README.md:51-62`, ADR 0001:29-50).

**Extension-relevant ideas:** productize Grok Stop/protect hooks; dual-backend collision policy (extension already dual); installer/provision patterns; harness health check (`check_harness.py`); fixtures for Actions regression.

---

## Overlap map (who already owns what in Grokbit)

| Capability | Ultimate | GrokForge template | Grokbit product suite | Grokbit dogfood | Grokbit **extension** |
|---|---|---|---|---|---|
| Deep multi-artifact plan | thin | hard gates | **full** | hard gates | surfaces tiles + plan mode |
| Accuracy/coverage protocol | verify+review | **full** | implement verify-or-revert | **full** | no dedicated UI |
| Baseline-before-change | no | no | **yes** | no | no dedicated UI |
| Deterministic Stop gate | **Claude bash** | **Grok Python** | no | **missing** | **not provisioned** |
| Protect secrets on write | **yes** | **yes** | skill-only | missing hooks | permission-bind exists for ACP |
| One-shot orchestrate | **`/ship`** | two skills | five tiles | two skills | Actions tiles only |
| Multi-host skills | Claude only | Grok primary + optional Claude | **both** | Grok | dual backend + provision both homes |
| Dual-stack collision policy | removed multi | **ADR 0002** | n/a | partial | dual backend product — needs explicit collision policy in UI/docs |
| User workflow builder | no | no | n/a | n/a | **yes** (ADR 0004) |

---

## Reusable code for enhancement

| Asset | Source | Reuse path for extension |
|---|---|---|
| `verify_on_stop.py` + friends | GrokForge `.grok/hooks/` | Vendor/adapt into `resources/hooks/` or install script; provision like skills |
| `protect_paths.py` | same | Same |
| `verify-on-stop.sh` pattern | Ultimate | Reference only; Windows dogfood prefers Python lineage |
| `/ship` orchestration text | Ultimate `ship.md` | New suite skill or Actions “Ship” tile seeding multi-phase prompt |
| Dual-stack rename + checker | GrokForge ADR 0002 + `check_harness.py` | Extension docs + optional workspace scan warning |
| Suite how-it-works | Grokbit `docs/grokbit-workflows.md` | Already productized |

## Supersession (if we enhance)

| Item | Location | Callers | Why |
|---|---|---|---|
| Soft-only dogfood enforcement | Grokbit no hooks | every Grok session in repo | Template already fixed; Grokbit lagged |
| Five separate Actions without orchestrator | suite tiles | Actions UI | Ultimate `/ship` fills gap; optional COEXIST with tiles |
| Duplicate “plan” stories (suite vs project `/plan`) | skills | operators | COEXIST with clear labels in UI or LEAVE with docs |

## Prior attempts

- GrokForge ADR 0001: added Grok hooks after “soft enforcement” residual risk.
- Ultimate ADR 0004: removed multi-runtime after AGENTS clobber — opposite of Grokbit product need.
- Grokbit suite already productized portable pipeline; dogfood install is older agentic team **without hooks**.

## Conventions

- Grokbit extension: pure modules + vitest; thin client (`Claude.md`).
- GrokForge hooks: pure decision functions + `tests/test_grok_hooks.py` pattern (`hooks/README.md:27-29`).
- Ultimate hooks: bash + jq assumptions (`USER_GUIDE` mentions jq).

## Absences (Grokbit extension / monorepo)

1. No `.grok/hooks/` in Grokbit.ai (template has full set).  
2. No extension setting to provision/trust Grok hooks into workspace or home.  
3. No Ship/Run-pipeline Action.  
4. No in-UI display of Stop-gate / hook status.  
5. No harness health scan Action (`check_harness`-like).  
6. Suite baseline/SHIP not mirrored as first-class extension progress UI (markdown on disk only).  
7. MCP servers not in capability browser (`Claude.md` Known limits).

## Danger zones

- Dual hooks: Grok may attempt Claude + Grok hooks together (ADR 0002 evidence) — extension dual-backend must not double-fire destructive gates.
- Provisioning hooks into user repos: opt-in only (template already `--with-hooks`).
- Soft-copy of Ultimate bash hooks onto Windows Grok path without CLI contract probe.
