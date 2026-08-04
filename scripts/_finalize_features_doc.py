#!/usr/bin/env python3
import hashlib
import json
import re
from datetime import date
from pathlib import Path

root = Path(__file__).resolve().parents[1]
md = root / "docs" / "features-and-use-cases.md"
text = md.read_text(encoding="utf-8")
if text.startswith("---"):
    parts = text.split("---", 2)
    body = parts[2] if len(parts) >= 3 else text
else:
    body = text
h = hashlib.sha256(body.encode("utf-8")).hexdigest()
text2 = re.sub(r"content_hash: pending", f"content_hash: {h}", text, count=1)
if "content_hash: pending" in text2:
    raise SystemExit("failed to stamp content_hash")
md.write_text(text2, encoding="utf-8")
print("hash", h)

paths = [
    "README.md",
    "package.json",
    "docs/grokbit-workflows.md",
    "src/skill-suite.ts",
    "docs/architecture.md",
    "docs/SLASH-COMMANDS.md",
    "docs/privacy.md",
    "TESTS.md",
    "CLAUDE.md",
    "docs/Grokbit-Features-and-Use-Cases.docx",
    "docs/features-and-use-cases.md",
    "scripts/_gen_features_use_cases_docx.py",
]
missing = [p for p in paths if not (root / p).exists()]
print("missing", missing or "none")

ctx = root / ".grokbit" / "context"
ctx.mkdir(parents=True, exist_ok=True)
(ctx / "features-use-cases.md").write_text(
    """# features-use-cases (digest)

- Product: Grokbit VS Code extension (grokbit.grokbit) — thin ACP UI for Grok Build + optional Claude Code.
- Version stamp at emit: 2026.8.27 (package.json).
- Human docs: docs/features-and-use-cases.md + docs/Grokbit-Features-and-Use-Cases.docx
- Do NOT use docs/FEATURES.md or docs/USER_GUIDE.md for product claims (they describe a Claude template).
- Suite skills (src/skill-suite.ts): explore, plan, implement, test, document, ship.
- Safety: Plan first client gate; permission cards with inline diffs; path/command-bound grants.
- Surfaces: native tabs, launcher, session setup, Actions+User Workflows, carousel, status-bar HUD, /imagine, voice.
- Sources: README.md, package.json, docs/grokbit-workflows.md, src/skill-suite.ts @ f21d093.
""",
    encoding="utf-8",
)

manifest_path = root / ".grokbit" / "docs-manifest.json"
entry = {
    "type": "features-use-cases",
    "path": "docs/features-and-use-cases.md",
    "docx": "docs/Grokbit-Features-and-Use-Cases.docx",
    "verified": date.today().isoformat(),
    "derived_from": [
        "README.md@f21d093",
        "package.json@f21d093",
        "docs/grokbit-workflows.md@f21d093",
        "src/skill-suite.ts@f21d093",
    ],
    "content_hash": h,
}
if manifest_path.exists():
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
else:
    data = {"docs": []}
docs = [
    d
    for d in data.get("docs", [])
    if d.get("type") != "features-use-cases" and d.get("path") != entry["path"]
]
docs.append(entry)
data["docs"] = docs
manifest_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
print("manifest", manifest_path)
