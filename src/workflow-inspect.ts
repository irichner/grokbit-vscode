/**
 * Deep, on-demand inspection of a saved workflow script — what agents it runs,
 * in what phases, with what settings and prompts.
 *
 * Pure: no `vscode`, no top-level `node:fs`, and — the load-bearing one — it
 * **never executes a workflow script**. Workflow files are untrusted repository
 * content in two languages this extension has no interpreter for, so everything
 * here is character scanning over text, exactly like the `name`/`description`
 * meta parsers in `capabilities.ts` that this module extends.
 *
 * **Separate from `capabilities.ts` on purpose.** That module owns the
 * *index-time* scan: every root, every file, an 8KB head read
 * (`CAPABILITY_HEAD_BYTES`) whose only job is to decide a tile's name. This one
 * owns the *on-demand deep read* a user pays for by clicking Details — a bigger
 * bound (`WORKFLOW_DETAIL_MAX_BYTES`) over exactly one file. Two jobs, two
 * bounds, two files, mirroring the existing `HOW_IT_WORKS_MAX_BYTES` split for
 * suite guides (`skill-suite.ts`).
 *
 * **Best-effort by contract, not by accident.** A regex-and-scanner parse of a
 * real programming language will meet scripts it cannot read: computed prompts,
 * agents built in loops, helpers that wrap `agent()`. Every such case is
 * *counted* rather than guessed at — see `opaqueAgentCalls` /
 * `overflowAgentCalls` / `promptKind` on {@link WorkflowDetail} — so the UI can
 * say what it could not read instead of quietly showing a shorter list than the
 * file actually contains.
 */
import { WorkflowScriptFormat, extractMetaStringField } from "./capabilities";

/**
 * Longest prompt text carried per agent. Display truncation is the webview
 * view-model's job; this is a payload bound, so a script with a 40KB embedded
 * prompt cannot bloat a single postMessage. A clipped prompt keeps a trailing
 * ellipsis rather than ending mid-word silently.
 */
export const AGENT_PROMPT_MAX_CHARS = 2000;

/** One `agent(...)` call recovered from a script. */
export interface WorkflowAgentCall {
  /** 1-based order of appearance in the file. */
  index: number;
  /**
   * `literal` — the first argument was a plain string this parse can show
   * verbatim. `dynamic` — it was an expression (a variable, a template literal
   * with `${}`, a concatenation); `prompt` then holds the raw source excerpt,
   * which is honest about being source rather than pretending to be the text
   * the agent will receive.
   */
  promptKind: "literal" | "dynamic";
  prompt?: string;
  label?: string;
  /** Explicit `phase` option on the call itself. */
  phase?: string;
  /** Nearest preceding `phase("…")` statement, when the call declares none. */
  inferredPhase?: string;
  model?: string;
  effort?: string;
  agentType?: string;
  isolation?: string;
  /** Key presence only — a schema is a JSON Schema object, never parsed here. */
  hasSchema: boolean;
}

/**
 * What {@link parseAgentArgs} can know from the argument text alone. `index`
 * and `inferredPhase` both need whole-file context (order of appearance, and
 * the preceding `phase()` statements), so the assembler stamps them.
 */
export type ParsedAgentArgs = Omit<WorkflowAgentCall, "index" | "inferredPhase">;

/** One located call site: where it starts, and the text between its parens. */
export interface WorkflowCallSite {
  /** Offset of the first character of the function name. */
  start: number;
  /** Argument text between the outermost parens, excluding them. */
  argsText: string;
}

const IDENT_CHAR = /[A-Za-z0-9_$]/;

/** True when `text[i]` opens a string in either supported syntax. */
function quoteAt(text: string, i: number): string | null {
  const c = text[i];
  return c === '"' || c === "'" || c === "`" ? c : null;
}

/**
 * Advance past a string literal that starts at `open` (which must index the
 * quote character). Returns the index of the closing quote, or `text.length`
 * when the literal is unterminated.
 *
 * Template literals are treated as plain delimited strings: a `${}` hole that
 * itself contains a backtick would end the scan early. That is a deliberate
 * bound — handling arbitrary nesting means writing a JS lexer, and the whole
 * module's contract is that anything it cannot read is *counted*, not guessed.
 */
function skipString(text: string, open: number): number {
  const quote = text[open];
  for (let i = open + 1; i < text.length; i++) {
    const c = text[i];
    if (c === "\\") {
      i++;
      continue;
    }
    if (c === quote) return i;
  }
  return text.length;
}

/**
 * Index of the last character of a comment starting at `i`, or `-1` when `i`
 * does not start one. Both Rhai and JS use line and block comments.
 */
function skipComment(text: string, i: number): number {
  if (text[i] !== "/") return -1;
  const next = text[i + 1];
  if (next === "/") {
    const nl = text.indexOf("\n", i + 2);
    return nl < 0 ? text.length : nl;
  }
  if (next === "*") {
    const close = text.indexOf("*/", i + 2);
    return close < 0 ? text.length : close + 1;
  }
  return -1;
}

/**
 * Every call to `fnName(` in `text` that is real code — not inside a string and
 * not inside a comment — with its parenthesised argument text.
 *
 * Matching requires a word boundary before the name, so `subagent(` and
 * `run.agent(` never match `agent(`. Paren balancing is string-aware, so a
 * `")"` inside a prompt cannot close the call early.
 *
 * `format` is accepted for symmetry with the rest of the module (and so a
 * future syntax divergence has somewhere to live); the scan itself is currently
 * identical for both, because Rhai and JS share string and comment syntax.
 */
export function findCallSites(
  text: string,
  fnName: string,
  format?: WorkflowScriptFormat,
): WorkflowCallSite[] {
  const s = String(text ?? "");
  const name = String(fnName ?? "");
  const out: WorkflowCallSite[] = [];
  if (!name) return out;

  for (let i = 0; i < s.length; i++) {
    const q = quoteAt(s, i);
    if (q) {
      i = skipString(s, i);
      continue;
    }
    const past = skipComment(s, i);
    if (past >= 0) {
      i = past;
      continue;
    }
    if (s[i] !== name[0] || !s.startsWith(name, i)) continue;
    const before = i > 0 ? s[i - 1] : "";
    if (before && (IDENT_CHAR.test(before) || before === ".")) continue;
    let j = i + name.length;
    while (j < s.length && /\s/.test(s[j])) j++;
    if (s[j] !== "(") continue;

    // Paren-balance from the opening paren, string- and comment-aware.
    let depth = 0;
    let end = -1;
    for (let k = j; k < s.length; k++) {
      const kq = quoteAt(s, k);
      if (kq) {
        k = skipString(s, k);
        continue;
      }
      const kPast = skipComment(s, k);
      if (kPast >= 0) {
        k = kPast;
        continue;
      }
      if (s[k] === "(") depth++;
      else if (s[k] === ")") {
        depth--;
        if (depth === 0) {
          end = k;
          break;
        }
      }
    }
    if (end < 0) {
      // Unterminated call — stop scanning rather than reporting a site whose
      // arguments we never actually delimited.
      break;
    }
    out.push({ start: i, argsText: s.slice(j + 1, end) });
    i = end;
  }
  return out;
}

/** Clip to the payload bound, marking the clip rather than hiding it. */
function clipPrompt(raw: string): string {
  const t = raw.trim();
  return t.length > AGENT_PROMPT_MAX_CHARS ? t.slice(0, AGENT_PROMPT_MAX_CHARS) + "…" : t;
}

/** Unescape a literal the same way {@link extractMetaStringField} does. */
function unescapeLiteral(inner: string, quote: string): string {
  if (quote === '"') {
    return inner.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
  }
  if (quote === "'") return inner.replace(/\\'/g, "'");
  return inner;
}

/** Offset of the first top-level `,` in `argsText`, or -1. String/brace aware. */
function topLevelComma(argsText: string, from: number): number {
  let depth = 0;
  for (let i = from; i < argsText.length; i++) {
    const q = quoteAt(argsText, i);
    if (q) {
      i = skipString(argsText, i);
      continue;
    }
    const past = skipComment(argsText, i);
    if (past >= 0) {
      i = past;
      continue;
    }
    const c = argsText[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) return i;
  }
  return -1;
}

/**
 * Slice the brace-delimited options block starting at or after `from`, for
 * either `#{ … }` (Rhai object map) or `{ … }` (JS object literal).
 */
function optionsBlock(argsText: string, from: number): string | undefined {
  let i = from;
  while (i < argsText.length && /\s/.test(argsText[i])) i++;
  if (argsText[i] === "#") i++; // Rhai's `#{`
  if (argsText[i] !== "{") return undefined;
  let depth = 0;
  for (let k = i; k < argsText.length; k++) {
    const q = quoteAt(argsText, k);
    if (q) {
      k = skipString(argsText, k);
      continue;
    }
    const past = skipComment(argsText, k);
    if (past >= 0) {
      k = past;
      continue;
    }
    if (argsText[k] === "{") depth++;
    else if (argsText[k] === "}") {
      depth--;
      if (depth === 0) return argsText.slice(i, k + 1);
    }
  }
  return undefined;
}

/** Whether `key` appears as an option key in the block (presence, not value). */
function hasOptionKey(block: string, key: string): boolean {
  return new RegExp(`(?:^|[\\s,{])(?:"${key}"|'${key}'|${key})\\s*[:=]`, "m").test(block);
}

/**
 * Recover one agent call's shape from its argument text.
 *
 * Returns `null` when the call cannot be read at all — no arguments, or a first
 * argument whose string literal never terminates. The caller counts those as
 * `opaqueAgentCalls` rather than dropping them, so the UI can report that the
 * file holds more agents than it managed to describe.
 */
export function parseAgentArgs(
  argsText: string,
  format?: WorkflowScriptFormat,
): ParsedAgentArgs | null {
  const s = String(argsText ?? "");
  let i = 0;
  while (i < s.length && /\s/.test(s[i])) i++;
  if (i >= s.length) return null;

  let promptKind: "literal" | "dynamic" = "dynamic";
  let prompt: string | undefined;
  let afterFirst: number;

  const quote = quoteAt(s, i);
  if (quote) {
    const close = skipString(s, i);
    if (close >= s.length) return null; // unterminated literal — unreadable
    const inner = s.slice(i + 1, close);
    // A template literal with a `${}` hole is source, not final text: showing
    // it as a literal prompt would misrepresent what the agent receives.
    if (quote === "`" && inner.includes("${")) {
      promptKind = "dynamic";
      prompt = clipPrompt(s.slice(i, close + 1));
    } else {
      promptKind = "literal";
      prompt = clipPrompt(unescapeLiteral(inner, quote));
    }
    afterFirst = close + 1;
  } else {
    const comma = topLevelComma(s, i);
    const rawEnd = comma < 0 ? s.length : comma;
    promptKind = "dynamic";
    prompt = clipPrompt(s.slice(i, rawEnd));
    afterFirst = rawEnd;
  }

  const parsed: ParsedAgentArgs = { promptKind, prompt: prompt || undefined, hasSchema: false };

  const comma = topLevelComma(s, afterFirst);
  if (comma < 0) return parsed;
  const block = optionsBlock(s, comma + 1);
  if (!block) return parsed;

  parsed.label = extractMetaStringField(block, "label");
  parsed.phase = extractMetaStringField(block, "phase");
  parsed.model = extractMetaStringField(block, "model");
  parsed.effort = extractMetaStringField(block, "effort");
  parsed.agentType = extractMetaStringField(block, "agentType") ?? extractMetaStringField(block, "agent_type");
  parsed.isolation = extractMetaStringField(block, "isolation");
  parsed.hasSchema = hasOptionKey(block, "schema");
  return parsed;
}
