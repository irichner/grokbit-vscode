import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import * as vscode from "vscode";
import { GrokSidebar } from "./sidebar";
import { BackendId } from "./backends";
import {
  SUITE_BUNDLE_DIR,
  SUITE_MARKER_FILE,
  SUITE_SKILL_NAMES,
  shouldProvision,
  suiteTargets,
} from "./skill-suite";

/**
 * Copy the bundled Grokbit skill suite onto each CLI's home-tier skills path
 * so the CLI can actually resolve it — see the module comment in
 * `skill-suite.ts` for why a copy into the user's home is what makes a bundled
 * skill runnable at all.
 *
 * Deliberately best-effort and fully async. Every failure mode here (no home
 * directory, a read-only `~/.claude`, a partially-written previous run) has the
 * same correct outcome: the suite simply isn't discovered, `applySuiteKind`
 * matches nothing, and the Grokbit workflow group is absent from the Actions
 * menu — which is exactly what a user who set `grok.skills.provision: off`
 * gets. So nothing here throws into activation, and nothing here is awaited by
 * it; a skills copy must never be able to stop the extension from starting.
 */
async function provisionSkillSuite(context: vscode.ExtensionContext, output: vscode.OutputChannel): Promise<void> {
  const mode = vscode.workspace.getConfiguration("grok").get<string>("skills.provision", "auto");
  if (mode === "off") return;

  const version = String(context.extension?.packageJSON?.version ?? "").trim();
  const source = path.join(context.extensionPath, SUITE_BUNDLE_DIR);
  const homeDir = process.env.HOME || process.env.USERPROFILE || os.homedir();
  if (!version || !homeDir) return;
  if (!fs.existsSync(source)) return;

  for (const target of suiteTargets(homeDir)) {
    const marker = path.join(target.dir, SUITE_MARKER_FILE);
    try {
      let installed: string | undefined;
      try {
        installed = await fs.promises.readFile(marker, "utf8");
      } catch {
        installed = undefined;
      }
      if (!shouldProvision(installed, version)) continue;

      await fs.promises.mkdir(target.dir, { recursive: true });
      for (const name of SUITE_SKILL_NAMES) {
        const from = path.join(source, name);
        if (!fs.existsSync(from)) continue;
        // Replace, don't merge. `cp` overwrites the files it copies but never
        // removes ones a newer version dropped, so a merge would leave a file
        // deleted upstream lingering in the user's home forever — and a stale
        // `references/loops.md` a skill no longer mentions is exactly the kind
        // of debris that quietly poisons a later session's context.
        //
        // Scoped to `<dir>/<suite skill>` and never to `dir` itself: the
        // destination is a directory the user may also keep their OWN skills
        // in. Editing the provisioned copy in place is not supported (the
        // README points forks at the project tier, which wins by workspace-
        // first precedence), so overwriting one is intended, not a data loss.
        const to = path.join(target.dir, name);
        await fs.promises.rm(to, { recursive: true, force: true });
        await fs.promises.cp(from, to, { recursive: true, force: true });
      }
      await fs.promises.writeFile(marker, version, "utf8");
      output.appendLine(`[skills] provisioned Grokbit suite ${version} → ${target.dir}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      output.appendLine(`[skills] skipped ${target.dir}: ${msg}`);
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Grok");
  const sidebar = new GrokSidebar(context, output);

  void provisionSkillSuite(context, output);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GrokSidebar.viewId, sidebar, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    // Window-reload persistence: restored session tabs re-bind through the same
    // opening guard as every other panel entry point, and background tabs defer
    // their spawn to first reveal (see restorePanel). `backend` was stashed by
    // chat.js alongside `id` (docs/plans/claude-code-backend.md § WP5) so a
    // reloaded Claude tab respawns Claude, not grok.
    vscode.window.registerWebviewPanelSerializer(GrokSidebar.panelViewType, {
      deserializeWebviewPanel: (panel, state: { id?: string; backend?: BackendId } | undefined) =>
        sidebar.restorePanel(panel, state?.id, state?.backend),
    }),
    output,
    { dispose: () => sidebar.dispose() },
    vscode.commands.registerCommand("grok.open", () =>
      vscode.commands.executeCommand("workbench.view.extension.grokSidebar"),
    ),
    vscode.commands.registerCommand("grok.newSession", () => sidebar.newSession()),
    vscode.commands.registerCommand("grok.compact", () => {
      // emulated by sending the slash command as a prompt; CLI handles it
      vscode.window.showInformationMessage(
        "Type /compact in the composer to compress the conversation.",
      );
    }),
    vscode.commands.registerCommand("grok.pickModel", () => sidebar.pickModel()),
    vscode.commands.registerCommand("grok.toggleMode", () => sidebar.openModePopover()),
    vscode.commands.registerCommand("grok.sendSelection", () =>
      sidebar.insertActiveMention({ selection: true }),
    ),
    vscode.commands.registerCommand(
      "grok.sendFile",
      (uri?: vscode.Uri) => sidebar.insertActiveMention({ uri }),
    ),
    vscode.commands.registerCommand("grok.insertAtMention", () =>
      sidebar.insertActiveMention(),
    ),
    vscode.commands.registerCommand("grok.newWorktreeSession", () =>
      sidebar.newWorktreeSession(),
    ),
    vscode.commands.registerCommand("grok.showLogs", () => output.show()),
    vscode.commands.registerCommand("grok.logout", () => sidebar.logout()),
    // Internal debug helper for manually exercising the plan-review card UI
    // (Approve / Reject / Cancel flows) without a live CLI session.
    vscode.commands.registerCommand("grok._debugDummyPlan", () => sidebar.debugShowDummyPlan()),
  );
}

export function deactivate(): void {
  // disposables handle cleanup
}
