# Security — create-workflow-screen-ux

| Severity | Finding | Notes |
|---|---|---|
| — | none CRITICAL | |
| info | Craft result path | Host resolves `{name}.rhai` only under `workflowDetailRoots` with kebab-name allowlist; client cannot pass arbitrary absolute path via `getWorkflowCraftResult` |
| info | No new secrets/deps | zero new packages |

No CRITICAL findings.
