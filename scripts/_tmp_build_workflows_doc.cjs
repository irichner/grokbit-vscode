const fs = require("fs");
const path = require("path");
const names = [
  "grokbit-explore",
  "grokbit-plan",
  "grokbit-implement",
  "grokbit-test",
  "grokbit-document",
];
const labels = {
  "grokbit-explore": "Explore",
  "grokbit-plan": "Plan",
  "grokbit-implement": "Implement",
  "grokbit-test": "Test",
  "grokbit-document": "Document",
};
let body = `# Grokbit workflows — how they work

Full technical reference for the five bundled **Grokbit Actions** workflows. Short tile blurbs live in each skill's frontmatter; **this document** (and each skill's \`references/how-it-works.md\`) carry roles, loops, caps, artifacts, and gates.

Agent procedures remain each skill's \`SKILL.md\`. This guide is the product-facing layer.

## Pipeline overview

\`\`\`
  grokbit-explore (optional)
           │
           ▼
  grokbit-plan  ──▶  human approval  ──▶  grokbit-test (baseline)
                                                  │
                                                  ▼
       verdict  ◀──  grokbit-test (verify)  ◀──  grokbit-implement
\`\`\`

| Skill | Slash | Role |
|---|---|---|
| Explore | \`/grokbit-explore\` | Read-only orientation in chat |
| Plan | \`/grokbit-plan\` | Grounded plan + approval gate |
| Implement | \`/grokbit-implement\` | Task-by-task verify-or-revert |
| Test | \`/grokbit-test\` | Baseline + verify + SHIP verdict |
| Document | \`/grokbit-document\` | Derived docs with executable checks |

In the extension, open **Grokbit Actions**, pick a workflow tile, and click **Details** for the same content in-panel.

---

`;
for (const n of names) {
  const t = fs.readFileSync(
    path.join("resources/skills", n, "references", "how-it-works.md"),
    "utf8",
  );
  body += `## ${labels[n]} (\`${n}\`)\n\n`;
  body += `Source: \`resources/skills/${n}/references/how-it-works.md\`\n\n`;
  body += t.replace(/^# How .*\n+/, "") + "\n\n---\n\n";
}
body += `## Related

- Maintainer suite map: \`resources/skills/README.md\`
- Product Actions table: \`README.md\` (Grokbit Actions)
- Agentic Claude **template** loop (not this suite): \`docs/WORKFLOW.md\`
`;
fs.writeFileSync("docs/grokbit-workflows.md", body);
console.log("wrote", body.length);
