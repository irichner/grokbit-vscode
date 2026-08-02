# Baseline — explore-workflow (pre-change)

Captured before implement of Grokbit Actions Explore skill (2026-08-01).

## Behaviors that will change

| Behavior | Pre-change observation | Proven by |
|---|---|---|
| Suite skill list | 4 names: plan → implement → test → document | `src/skill-suite.ts` `SUITE_SKILL_NAMES` |
| Actions featured order | Same four, plan-first | `media/webview-helpers.js` `CAPABILITY_FEATURED.grokbit` |
| Local-override suite names | Same four | `SUITE_SKILL_NAMES_LC` |
| Actions DOM fixture order | First row seeds `/grokbit-plan ` | `test/capabilities.dom.test.ts` |
| Product/settings copy | “four skills”, plan→implement→test→document | README, package.json settings |
| Explore suite skill package | Does not exist | `resources/skills/` listing |

## Behaviors that must not regress

| Behavior | Observation |
|---|---|
| `applySuiteKind` two-condition re-key | skill-suite tests green |
| Actions empty when suite absent | capabilities.dom empty-state test |
| Non-suite skills not re-keyed | skill-suite tests |
| Built-in agent `explore`/`explorer` featured under agents | still in CAPABILITY_FEATURED.agent |
| Full suite | 1391 green at preflight |
