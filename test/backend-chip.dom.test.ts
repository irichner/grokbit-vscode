// DOM-level test for the composer backend chip (Grok Build / Claude Code) —
// docs/plans/claude-code-backend.md § WP3. Drives the REAL shipped
// media/chat.js in a happy-dom window.
import { describe, it, expect } from "vitest";
import { bootWebview, dispatch, click } from "./webview-harness";

describe("composer backend chip", () => {
  it("stays hidden until the host tells it the backend, then shows the short label", () => {
    const { window, doc } = bootWebview();
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.hidden).toBe(true);

    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    expect(chip.hidden).toBe(false);
    expect(chip.textContent).toContain("Grok");
    expect(chip.title).toContain("Grok Build");
  });

  it("shows the Claude label and does not carry a stale account tooltip from a prior grok tab", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });

    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.textContent).toContain("Claude");
    expect(chip.classList.contains("backend-claude")).toBe(true);
    expect(chip.title).toContain("Claude Code");
    expect(chip.title).not.toContain("signed in as");
  });

  it("surfaces the signed-in Claude account + plan in the tooltip once known", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "backendChanged",
      backend: "claude",
      label: "Claude Code",
      account: { email: "dev@example.com", subscriptionType: "max" },
    });

    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.title).toContain("signed in as dev@example.com");
    expect(chip.title).toContain("(max)");
  });

  // Security finding: disclosure over silence — authMethod/apiProvider make
  // it visible whether the subscription or something else (an API key, a
  // gateway) is actually being billed.
  it("surfaces authMethod/apiProvider in the tooltip when known", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "backendChanged",
      backend: "claude",
      label: "Claude Code",
      account: { email: "dev@example.com", subscriptionType: "max", authMethod: "oauth", apiProvider: "anthropic" },
    });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.title).toContain("via oauth/anthropic");
  });

  // Names only, never values — the tooltip must never render a secret.
  it("surfaces credential/routing override NAMES in the tooltip, never values", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "backendChanged",
      backend: "claude",
      label: "Claude Code",
      account: { overrides: ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL"] },
    });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.title).toContain("env overrides in effect: ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL");
  });

  it("still surfaces overrides even when the auth check failed (no email known)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "backendChanged",
      backend: "claude",
      label: "Claude Code",
      account: { overrides: ["ANTHROPIC_BASE_URL"] },
    });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.title).toContain("env overrides in effect: ANTHROPIC_BASE_URL");
    expect(chip.title).not.toContain("signed in as");
  });

  it("omits the via/overrides segments when neither is present (unchanged base tooltip)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "backendChanged",
      backend: "claude",
      label: "Claude Code",
      account: { email: "dev@example.com" },
    });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.title).toBe("Claude Code — signed in as dev@example.com — click to switch agent");
  });

  it("opens a popover offering the OTHER backend; picking it posts switchBackend", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });

    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    const popover = doc.getElementById("backend-popover") as HTMLElement;
    expect(popover.hidden).toBe(true);

    click(window, chip);
    expect(popover.hidden).toBe(false);
    const items = [...popover.querySelectorAll(".toolbar-popover-item")];
    expect(items.map((i) => i.querySelector(".mode-item-label")?.textContent)).toEqual([
      "Grok Build", "Claude Code",
    ]);
    // The current backend is marked active and does nothing on click.
    expect(items[0].classList.contains("active")).toBe(true);
    expect(items[1].classList.contains("active")).toBe(false);

    click(window, items[1]); // pick Claude Code
    expect(posted).toContainEqual({ type: "switchBackend", backend: "claude" });
    expect(popover.hidden).toBe(true); // closes after picking
  });

  it("does nothing when the active backend is clicked again", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    click(window, chip);
    const active = doc.querySelector("#backend-popover .toolbar-popover-item.active") as HTMLElement;
    click(window, active);
    expect(posted.filter((m: any) => m.type === "switchBackend")).toHaveLength(0);
  });

  it("stays closed while the composer is busy (session-start window, same as model/effort)", () => {
    const { window, doc } = bootWebview({ ready: false }); // busy: true
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    const popover = doc.getElementById("backend-popover") as HTMLElement;
    click(window, chip);
    expect(popover.hidden).toBe(true);
  });

  it("omits the gear popover's effort-dots row entirely for a Claude session (no effort axis)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    dispatch(window, {
      type: "session",
      sessionId: "s1",
      currentModelId: "sonnet",
      models: [{ modelId: "sonnet", name: "Sonnet 4.5" }],
    });
    const gearBtn = doc.getElementById("gear-btn") as HTMLButtonElement;
    click(window, gearBtn);
    const gear = doc.getElementById("gear-popover") as HTMLElement;
    expect(gear.hidden).toBe(false);
    expect(gear.querySelector(".model-effort-row")).not.toBeNull();
    expect(gear.querySelector(".effort-dots")).toBeNull();
  });

  // Code-review finding: switchBackend used to only mutate session.backend
  // host-side and let the later "session" event flip state.backend directly
  // (the ONLY message that used to touch it on a live flip) — the chip's TEXT
  // already read "Claude" from that event (updateBackendLabel keys text off
  // state.backend), but its TOOLTIP kept the stale label ("Grok Build") until
  // a LATER backendChanged happened to arrive (only when refreshClaudeAccount's
  // best-effort auth check succeeded — never on a failed/absent check).
  // switchBackend now posts backendChanged BEFORE startSession, so it always
  // precedes the flip's "session" event — verifying that ordering here: chip
  // text + tooltip agree from the very first session event of a flip, with no
  // stale-tooltip window in between.
  it("a backend flip's chip label AND tooltip agree from the first session event (backendChanged now precedes session)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });

    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    dispatch(window, {
      type: "session",
      sessionId: "s2",
      currentModelId: "sonnet",
      models: [{ modelId: "sonnet", name: "Sonnet" }],
      backend: "claude",
    });

    const chip = doc.getElementById("backend-label") as HTMLButtonElement;
    expect(chip.textContent).toContain("Claude");
    expect(chip.title).toContain("Claude Code — click to switch agent");
    expect(chip.title).not.toContain("Grok Build");
  });

  it("still shows the effort-dots row for a grok session", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    dispatch(window, {
      type: "session",
      sessionId: "s1",
      currentModelId: "grok-build",
      models: [{ modelId: "grok-build", name: "Grok Build" }],
    });
    click(window, doc.getElementById("gear-btn") as HTMLButtonElement);
    expect(doc.getElementById("gear-popover")!.querySelector(".effort-dots")).not.toBeNull();
  });
});

// docs/plans/claude-code-backend.md § WP5 — the panel serializer persists
// {id, backend} so a reloaded window respawns the right agent.
describe("session event persists {id, backend} for the panel serializer", () => {
  it("stashes the backend from the session event's OWN field, not stale webview state", () => {
    const { window, states } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "claude", label: "Claude Code" });
    dispatch(window, {
      type: "session",
      sessionId: "claude-session-1",
      currentModelId: "sonnet",
      models: [{ modelId: "sonnet", name: "Sonnet" }],
      backend: "claude",
    });
    expect(states.at(-1)).toEqual({ id: "claude-session-1", backend: "claude" });
  });

  it("a grok session's event persists backend:grok", () => {
    const { window, states } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    dispatch(window, {
      type: "session",
      sessionId: "grok-session-1",
      currentModelId: "grok-build",
      models: [{ modelId: "grok-build", name: "Grok Build" }],
      backend: "grok",
    });
    expect(states.at(-1)).toEqual({ id: "grok-session-1", backend: "grok" });
  });

  it("a mid-session backend flip's fresh session event updates the persisted backend immediately", () => {
    const { window, states } = bootWebview();
    dispatch(window, { type: "backendChanged", backend: "grok", label: "Grok Build" });
    dispatch(window, {
      type: "session",
      sessionId: "s1",
      currentModelId: "grok-build",
      models: [{ modelId: "grok-build", name: "Grok Build" }],
      backend: "grok",
    });
    expect(states.at(-1)).toEqual({ id: "s1", backend: "grok" });

    // The flip's fresh "session" event carries the NEW backend directly — this
    // must win even if backendChanged for the new backend hasn't posted yet.
    dispatch(window, {
      type: "session",
      sessionId: "s2",
      currentModelId: "sonnet",
      models: [{ modelId: "sonnet", name: "Sonnet" }],
      backend: "claude",
    });
    expect(states.at(-1)).toEqual({ id: "s2", backend: "claude" });
  });

  // session-tab-window-restore T4 — host re-stashes on ready before ACP session
  it("sessionIdentity message stashes {id, backend} for the panel serializer", () => {
    const { window, states } = bootWebview();
    dispatch(window, {
      type: "sessionIdentity",
      sessionId: "restored-1",
      backend: "claude",
    });
    expect(states.at(-1)).toEqual({ id: "restored-1", backend: "claude" });
  });
});
