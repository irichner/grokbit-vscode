// Shared test harness for driving the REAL shipped webview scripts
// (media/chat.js + media/webview-helpers.js) inside a happy-dom window.
//
// happy-dom doesn't execute inline <script> text synchronously, but window.eval
// runs in the window's realm and shares its globals — webview-helpers sets
// window.GrokWebviewHelpers, and chat.js reads it at startup. We stub
// acquireVsCodeApi to capture the postMessage payloads the webview sends back to
// the extension host, then dispatch the same messages sidebar.ts posts.
//
// This file is NOT a test (it has no *.test.ts suffix, so vitest's
// include glob "test/**/*.test.ts" skips it); it's imported by the DOM tests.
import { Window } from "happy-dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const helperSrc = read("../media/webview-helpers.js");
const chatSrc = read("../media/chat.js");

// Mirror of getHtml()'s <body> — only the ids chat.js queries at startup matter.
export const BODY = `
  <header class="top-bar">
    <button id="session-setup-chip" class="toolbar-btn session-setup-chip" type="button" hidden title="Session setup" aria-haspopup="dialog" aria-expanded="false"></button>
    <button id="history-btn"></button>
    <button id="new-btn"></button>
    <button id="docs-btn">Docs</button>
    <button id="capabilities-btn">Actions</button>
    <div id="history-popover" hidden></div>
    <div id="docs-popover" hidden></div>
    <div id="capabilities-popover" hidden></div>
  </header>
  <div id="plan-banner" class="plan-banner" hidden><span class="plan-banner-dot"></span><span class="plan-banner-text"></span></div>
  <main id="messages" class="messages">
    <div class="welcome" id="welcome">
      <h2>Grokbit</h2>
      <div id="welcome-grid" class="welcome-grid">
        <div id="capabilities-panel" class="capabilities-panel" hidden></div>
      </div>
      <div id="welcome-onboarding"></div>
    </div>
  </main>
  <footer class="composer">
    <button id="scroll-bottom-btn" class="scroll-bottom-btn"></button>
    <div id="changed-files" class="changed-files" hidden></div>
    <div id="attachments" class="attachments"></div>
    <div id="paste-image-notice" class="paste-image-notice muted" hidden></div>
    <div class="composer-input-wrap">
      <div id="input-highlight"></div>
      <textarea id="input"></textarea>
    </div>
    <button id="mic-btn"></button>
    <button id="add-btn"></button>
    <button id="gear-btn"></button>
    <div id="donut"><svg><circle id="donut-arc"/></svg><span id="donut-label"></span></div>
    <button id="model-label" hidden></button>
    <button id="backend-label" hidden></button>
    <div id="chips"></div>
    <button id="mode-btn"></button>
    <button id="send-btn"></button>
    <div id="mode-popover" hidden></div>
    <div id="backend-popover" hidden></div>
    <div id="session-settings-popover" hidden></div>
    <div id="gear-popover" hidden></div>
    <div id="add-popover" hidden></div>
    <div id="slash-popover" hidden></div>
  </footer>`;

export interface Posted { type: string; [k: string]: unknown }

export interface Harness {
  window: Window;
  posted: Posted[];
  doc: Document;
  /** Every payload the webview handed to `vscode.setState` (in order) — the
   *  panel-serializer persistence path (docs/plans/claude-code-backend.md §
   *  WP5); `getState()` mirrors the LAST one, like the real VS Code webview API. */
  states: unknown[];
}

export function bootWebview(opts: { ready?: boolean } = {}): Harness {
  const window = new Window({ url: "https://localhost/" });
  const posted: Posted[] = [];
  const states: unknown[] = [];
  (window as any).acquireVsCodeApi = () => ({
    postMessage: (m: Posted) => posted.push(m),
    setState: (s: unknown) => states.push(s),
    getState: () => states[states.length - 1],
  });
  const doc = (window as any).document as Document;
  doc.body.innerHTML = BODY;
  (window as any).eval(helperSrc);
  (window as any).eval(chatSrc);
  // The webview now boots busy+locked (startup spinner) and only goes idle once
  // the host posts setBusy:false after the session is live. Most tests exercise
  // that ready state, so simulate it by default; pass { ready: false } to assert
  // the startup spinner itself.
  if (opts.ready !== false) {
    dispatch(window, { type: "setBusy", value: false });
  }
  posted.length = 0; // drop chat.js's startup {type:"ready"} so tests see only their own messages
  return { window, posted, doc, states };
}

/** Deliver a message to the webview exactly as the extension host would. */
export function dispatch(window: Window, data: Posted): void {
  (window as any).dispatchEvent(new (window as any).MessageEvent("message", { data }));
}

/** Click via a real bubbling MouseEvent so onclick + stopPropagation behave like the browser. */
export function click(window: Window, el: Element): void {
  el.dispatchEvent(new (window as any).MouseEvent("click", { bubbles: true, cancelable: true }));
}
