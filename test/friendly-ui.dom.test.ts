// Friendly-UI pass: pure helpers (welcome starters, permission labels, mode
// display) + DOM wiring for the empty-session starter cards and permission
// button copy. Drives the real media/webview-helpers.js + media/chat.js.
import { describe, it, expect } from "vitest";
import {
  welcomeStarters,
  businessDocTypeStarters,
  docTypeIcons,
  permissionButtonLabel,
  modeDisplayMeta,
  MODE_DISPLAY,
  SESSION_DOT_LABELS,
  sessionDotLabel,
  isRejectedPermissionKind,
  permissionCollapseVerb,
} from "../media/webview-helpers.js";
import { bootWebview, dispatch, click } from "./webview-harness";

describe("welcomeStarters (pure catalog)", () => {
  it("returns five ready-to-edit starters when voice is configured", () => {
    const cards = welcomeStarters({ voiceConfigured: true });
    expect(cards.map((c: { id: string }) => c.id)).toEqual([
      "explain",
      "write-fix",
      "plan",
      "imagine",
      "voice",
    ]);
    expect(cards.find((c: { id: string }) => c.id === "imagine").prompt).toMatch(/^\/imagine/);
    expect(cards.find((c: { id: string }) => c.id === "plan").action).toBe("plan");
  });

  it("businessDocTypeStarters lists office types with Create …: prompts", () => {
    const types = businessDocTypeStarters() as Array<{ id: string; label: string; prompt: string }>;
    expect(types.map((t) => t.id)).toEqual([
      "word", "excel", "powerpoint", "pdf", "csv", "markdown",
    ]);
    for (const t of types) {
      expect(t.prompt).toMatch(/^Create .+: $/);
      expect(t.prompt).toContain(t.label === "CSV" || t.label === "PDF" ? t.label : t.label);
    }
    expect(types.find((t) => t.id === "word")!.prompt).toBe("Create Word document: ");
    expect(types.find((t) => t.id === "excel")!.prompt).toBe("Create Excel spreadsheet: ");
  });

  it("docTypeIcons covers every businessDocTypeStarters id", () => {
    const icons = docTypeIcons() as Record<string, string>;
    for (const t of businessDocTypeStarters() as Array<{ id: string }>) {
      expect(icons[t.id]).toMatch(/<svg/i);
    }
  });

  it("swaps the voice card for a setup hint when voice is not configured", () => {
    const cards = welcomeStarters({ voiceConfigured: false });
    expect(cards.map((c: { id: string }) => c.id)).toContain("voice-setup");
    expect(cards.map((c: { id: string }) => c.id)).not.toContain("voice");
    expect(cards.find((c: { id: string }) => c.id === "voice-setup").action).toBe("voice-hint");
  });

  it("every insert/plan card carries a non-empty prompt users can edit", () => {
    for (const c of welcomeStarters({ voiceConfigured: true }) as Array<{ action: string; prompt: string }>) {
      if (c.action === "insert" || c.action === "plan") {
        expect(c.prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("permissionButtonLabel (pure)", () => {
  it("maps ACP kinds to plain-language button labels", () => {
    expect(permissionButtonLabel({ kind: "allow_once", name: "Allow once" })).toBe("Allow this change");
    expect(permissionButtonLabel({ kind: "allow_always", name: "Allow always" })).toBe("Allow always");
    expect(permissionButtonLabel({ kind: "reject_once", name: "Reject" })).toBe("Don't allow");
  });

  it("falls back to the CLI name for unknown kinds", () => {
    expect(permissionButtonLabel({ kind: "custom_thing", name: "Maybe later" })).toBe("Maybe later");
  });

  it("handles missing opt without throwing", () => {
    expect(permissionButtonLabel(null)).toBe("Continue");
    expect(permissionButtonLabel(undefined)).toBe("Continue");
  });
});

describe("modeDisplayMeta (pure)", () => {
  it("exposes friendlier Agent / Plan first / Auto accept labels", () => {
    expect(modeDisplayMeta("agent").label).toBe("Agent");
    expect(modeDisplayMeta("plan").label).toBe("Plan first");
    expect(modeDisplayMeta("yolo").label).toBe("Auto accept");
    expect(MODE_DISPLAY.yolo.desc).not.toContain("YOLO");
  });

  it("falls back to Agent for unknown ids", () => {
    expect(modeDisplayMeta("nope").label).toBe("Agent");
  });
});

describe("sessionDotLabel (pure, shared chat + launcher)", () => {
  it("uses soft wording for every known dot value", () => {
    expect(sessionDotLabel("working")).toBe("Working on it");
    expect(sessionDotLabel("needs-you")).toBe("Needs your OK");
    expect(sessionDotLabel("unread")).toBe("Done — not opened yet");
    expect(sessionDotLabel("error")).toBe("Finished with an error — not opened yet");
    expect(SESSION_DOT_LABELS.working).toBe(sessionDotLabel("working"));
  });

  it("returns empty string for unknown / none", () => {
    expect(sessionDotLabel("none")).toBe("");
    expect(sessionDotLabel("nope")).toBe("");
  });
});

describe("permission collapse helpers (pure)", () => {
  it("treats reject_* and deny_* as rejected", () => {
    expect(isRejectedPermissionKind("reject_once")).toBe(true);
    expect(isRejectedPermissionKind("reject_always")).toBe(true);
    expect(isRejectedPermissionKind("deny_once")).toBe(true);
    expect(isRejectedPermissionKind("deny_always")).toBe(true);
    expect(isRejectedPermissionKind("allow_once")).toBe(false);
  });

  it("maps collapse verbs for allow / reject / unknown", () => {
    expect(permissionCollapseVerb("allow_once")).toBe("Allowed");
    expect(permissionCollapseVerb("deny_once")).toBe("Rejected");
    expect(permissionCollapseVerb("reject_always")).toBe("Rejected");
    expect(permissionCollapseVerb("weird")).toBe("Answered");
  });
});

describe("welcome starter cards (real chat.js DOM)", () => {
  it("renders starter cards once the session is ready", () => {
    const { doc } = bootWebview(); // ready → setBusy:false → renderWelcomeStarters
    const starters = doc.getElementById("welcome-starters") as HTMLElement;
    expect(starters).not.toBeNull();
    expect(starters.hidden).toBe(false);
    const buttons = [...starters.querySelectorAll(".welcome-starter")] as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    expect(buttons.map((b) => b.dataset.starterId)).toContain("explain");
    expect(buttons.map((b) => b.dataset.starterId)).toContain("plan");
    expect(buttons.map((b) => b.dataset.starterId)).toContain("imagine");
    expect(buttons.map((b) => b.dataset.starterId)).not.toContain("business-doc");
    // Document-type icons moved to the activity-bar launcher (not welcome).
    expect(starters.querySelectorAll(".welcome-doc-type")).toHaveLength(0);
  });

  it("seedComposer host message fills Create <type>: in the composer", () => {
    const { window, doc } = bootWebview();
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    dispatch(window, { type: "seedComposer", text: "Create Word document: " });
    expect(input.value).toBe("Create Word document: ");
  });

  it("insert starter fills the composer with a ready-to-edit prompt", () => {
    const { window, doc } = bootWebview();
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    const explain = doc.querySelector('.welcome-starter[data-starter-id="explain"]') as HTMLButtonElement;
    expect(explain).not.toBeNull();
    click(window, explain);
    expect(input.value).toMatch(/Explain this project/i);
  });

  it("plan starter posts setMode plan and seeds a planning prompt", () => {
    const { window, posted, doc } = bootWebview();
    const plan = doc.querySelector('.welcome-starter[data-starter-id="plan"]') as HTMLButtonElement;
    click(window, plan);
    expect(posted).toContainEqual({ type: "setMode", modeId: "plan" });
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value.toLowerCase()).toContain("plan");
  });

  it("imagine starter seeds /imagine for image generation", () => {
    const { window, doc } = bootWebview();
    const imagine = doc.querySelector('.welcome-starter[data-starter-id="imagine"]') as HTMLButtonElement;
    click(window, imagine);
    const input = doc.getElementById("input") as HTMLTextAreaElement;
    expect(input.value.startsWith("/imagine")).toBe(true);
  });

  it("hides starters during onboarding and restores them when cleared", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "onboarding", state: "auth-required" });
    expect((doc.getElementById("welcome-starters") as HTMLElement).hidden).toBe(true);

    // Unknown mode clears onboarding markup and re-shows starters.
    dispatch(window, { type: "onboarding", state: "ready" });
    expect((doc.getElementById("welcome-starters") as HTMLElement).hidden).toBe(false);
  });

  it("hides starters while the session is priming (startingPhase)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, { type: "initialized", info: { version: "0.2.91" } });
    expect((doc.getElementById("welcome-starters") as HTMLElement).hidden).toBe(true);
    dispatch(window, { type: "setBusy", value: false });
    expect((doc.getElementById("welcome-starters") as HTMLElement).hidden).toBe(false);
  });

  it("voice starter pulses the mic and does not post voiceStart or setMode", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, { type: "voiceConfigured", value: true });
    // Re-render after voiceConfigured so the voice card is present.
    const voice = doc.querySelector('.welcome-starter[data-starter-id="voice"]') as HTMLButtonElement;
    expect(voice).not.toBeNull();
    posted.length = 0;
    const mic = doc.getElementById("mic-btn") as HTMLButtonElement;
    click(window, voice);
    expect(mic.classList.contains("starter-pulse")).toBe(true);
    expect(posted.filter((m: any) => m.type === "voiceStart" || m.type === "setMode")).toHaveLength(0);
    // Welcome stays up — user can pick another card.
    expect((doc.getElementById("welcome") as HTMLElement).hidden).toBe(false);
  });

  it("voice-setup starter when unconfigured only nudges the mic (no host capture)", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, { type: "voiceConfigured", value: false });
    const setup = doc.querySelector('.welcome-starter[data-starter-id="voice-setup"]') as HTMLButtonElement;
    expect(setup).not.toBeNull();
    posted.length = 0;
    const mic = doc.getElementById("mic-btn") as HTMLButtonElement;
    click(window, setup);
    expect(mic.classList.contains("starter-pulse")).toBe(true);
    expect(posted.some((m: any) => m.type === "voiceStart")).toBe(false);
    expect(posted.some((m: any) => m.type === "setMode")).toBe(false);
    expect((doc.getElementById("welcome") as HTMLElement).hidden).toBe(false);
    expect((doc.getElementById("welcome-starters") as HTMLElement).hidden).toBe(false);
  });
});

describe("permission card friendly button copy (real chat.js DOM)", () => {
  it("shows Allow this change / Allow always / Don't allow and keeps optionIds", () => {
    const { window, posted, doc } = bootWebview();
    dispatch(window, {
      type: "permissionRequest",
      req: {
        id: 42,
        toolCall: { toolCallId: "tc1", kind: "edit", title: "Edit src/app.ts" },
        options: [
          { optionId: "once", name: "Allow once", kind: "allow_once" },
          { optionId: "always", name: "Allow always", kind: "allow_always" },
          { optionId: "rej", name: "Reject", kind: "reject_once" },
        ],
      },
    });
    const labels = [...doc.querySelectorAll(".card.permission .card-actions button")].map(
      (b) => b.textContent,
    );
    expect(labels).toEqual(["Allow this change", "Allow always", "Don't allow"]);

    const deny = [...doc.querySelectorAll(".card.permission .card-actions button")].find(
      (b) => b.textContent === "Don't allow",
    ) as HTMLButtonElement;
    click(window, deny);
    expect(posted).toContainEqual({
      type: "permissionAnswer",
      requestId: 42,
      optionId: "rej",
    });
  });

  it("collapses deny_* kinds to red Rejected (not green Answered)", () => {
    const { window, doc } = bootWebview();
    dispatch(window, {
      type: "permissionRequest",
      req: {
        id: 99,
        toolCall: { toolCallId: "tc-d", kind: "edit", title: "Edit x.ts" },
        options: [
          { optionId: "ok", name: "Allow", kind: "allow_once" },
          { optionId: "no", name: "Deny", kind: "deny_once" },
        ],
      },
    });
    const denyBtn = [...doc.querySelectorAll(".card.permission .card-actions button")].find(
      (b) => b.textContent === "Don't allow",
    ) as HTMLButtonElement;
    click(window, denyBtn);
    const line = doc.querySelector(".card.permission .perm-resolved-line")!;
    expect(line.classList.contains("perm-rejected")).toBe(true);
    expect(line.querySelector(".perm-resolved-verb")!.textContent).toBe("Rejected");
  });
});
