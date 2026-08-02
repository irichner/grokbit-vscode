# Loops — Document

Two loops, and they trade off differently. D1 is machine-checked and binary —
a command either exits zero or it doesn't — so its cap behavior is block, the
same verify-or-revert instinct Implement and Test's security loop share. D2 is
reviewer judgment, not ground truth, so its cap behavior is record and
continue, the same idiom Plan uses for its own soft caps.

---

## Loop D1 — Executable verification

| | |
|---|---|
| **Trigger** | A document has been drafted (Step 4) |
| **Runs** | Docs QA (verification) |
| **Cap** | 3 passes |

**Body:**
1. Run `scripts/verify_doc.py` against the drafted document.
2. Every `BLOCKER` finding is a defect: a command that failed, a path or link
   that doesn't resolve, a broken anchor, a cited source that doesn't exist,
   a code sample that doesn't parse.
3. Route each finding to whoever can fix it — a wrong command or a stale path
   goes back to the Technical Writer; a citation pointing at the wrong
   artifact goes back to the Documentation Engineer, since that means the
   derivation itself was wrong, not just the prose around it.
4. Re-run `verify_doc.py` against the corrected draft.

**Exit:** zero `BLOCKER` findings.

**Cap behavior: block. Do not emit the document.** This is not a permanent
refusal the way a `CRITICAL` security finding is — the same document,
corrected, can re-enter this loop later — but it does not ship in its current
form under any circumstance. Report exactly which commands, paths, links, or
citations still fail and why, so the human looking at a blocked document
knows precisely what to fix, rather than being told only that it's blocked.

This is hard rule 3 and Step 5 with teeth: **a document whose commands fail
is blocked, not shipped with a warning.** A quickstart whose first command
doesn't work is the single most common documentation defect there is, and
the one this skill has no excuse for shipping, because checking it is fully
automatable. Shipping it anyway with a caveat trains the reader to distrust
every quickstart this skill produces, not just this one.

`verify_doc.py --execute` is what actually runs the commands; without
`--execute` they are only listed, which the script itself reports as a
distinct, non-passing result — see hard rule 3 and `scripts/verify_doc.py`'s
own `--help`.

**Command classification (required before `--execute`):** for every fenced
command the type expects to run, classify it as:

- **probe** — read-only inspect (`ls`, `node -c`, version checks, dry-runs)
- **mutating** — install, migrate, deploy, rollback, delete, or anything that
  changes data, services, or the tree
- **long-running** — servers, watchers (do not hang D1 on these)

Only **probe** commands may be executed automatically under `--execute`.
**Mutating** and **long-running** commands must be marked
`<!-- doc-verify:skip -->` (or equivalent skip fence) **or** listed in the
verification report as `NOT EXECUTED — mutating/long-running; human must run`
with the exact command text. A cap-3 pass counts when every **probe** command
was executed and every other command is either skip-marked or explicitly
reported as not executed for that reason. Listing every command three times
without classifying or running probes is still not this loop.

**CI / container env does not waive safety.** Env vars like `CI` or
`CODESPACES` may mean a disposable filesystem, but they often still hold
deploy tokens and network reach to real databases. Never treat CI as license
to run mutating documented commands without the same classification and
skip rules.

---

## Loop D2 — Fresh-reader test

| | |
|---|---|
| **Trigger** | Loop D1 has exited clean |
| **Runs** | Docs QA (fresh-reader) |
| **Cap** | 2 passes |

**Body:**
1. Dispatch a reviewer with **only the document** — no codebase, no
   conversation, no plan artifacts. See `references/roles.md` for the
   isolation requirement; a reviewer with any of that context cannot perform
   this check and should say so rather than performing it badly.
2. The reviewer attempts the task the document describes and records every
   point where it had to guess, look elsewhere, or already happen to know
   something the document never stated — classified `BLOCKER` / `MAJOR` /
   `MINOR` per `references/roles.md`.
3. The Technical Writer addresses every `BLOCKER` and every `MAJOR`: revise
   the document, or note explicitly why the finding doesn't apply.
4. Re-run the fresh-reader test against the revised document, with a reviewer
   who has not seen the previous round's findings — otherwise round two is
   scoring against its own answer key.

**Exit:** zero `BLOCKER` findings.

**Cap behavior:** the document still ships. Every surviving `BLOCKER` and
`MAJOR` finding is written into the document as a visible, dated `Known
gaps` note — not silently dropped, and not hidden in a manifest nobody
opens. A reviewer's confusion after two honest attempts to resolve it is
real evidence a future reader needs, and burying it is worse than the gap
it would have flagged.

This differs from D1 on purpose. D1 checks a fact a computer can verify with
certainty; D2 checks something only a fresh, unbiased mind can judge, and
that judgment does not converge to certainty just because you asked twice
more. Blocking forever on it would substitute an arbitrary iteration count
for the human decision this loop exists to surface.

---

## Loop budget

Best case, a `derived` type with high coverage: D1 clears on the first pass,
D2 clears on the first pass — two role invocations past drafting. Worst case:
3 D1 passes plus 2 D2 passes, each D2 pass isolated and therefore expensive —
5 invocations, weighted toward the fresh-reader tier since that's the one
that cannot be run cheaply without losing the isolation that makes it work.

Compare against the cost of not running either. A wrong document sits there
being confidently wrong indefinitely; five role invocations is cheap next to
that, and it is the entire reason this skill spends more effort on
verification than on writing — see `SKILL.md`'s opening paragraph.
