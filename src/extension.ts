import { execFile } from "node:child_process";
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
import {
  HOOK_BUNDLE_DIR,
  HOOK_INTERPRETER_CANDIDATES,
  HOOK_MARKER_FILE,
  decideHooksProvision,
  detectDualHookStacks,
  dirLooksLikeHooks,
  hasNonMarkerContent,
  installHooks,
  pickHookInterpreter,
  workspaceClaudeHooksDir,
  workspaceClaudeSettingsPath,
  workspaceHooksBackupDir,
  workspaceHooksDir,
  type HooksProvisionMode,
} from "./hook-suite";
import {
  pickLatestPlanSlug,
  planArtifactsDir,
  releaseReadinessPath,
} from "./plan-artifacts";

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

/**
 * Which Python interpreters answer `--version` on this machine.
 *
 * The wired hook commands are `python "<script>.py"`, and on most macOS/Linux
 * installs `python` does not exist at all (only `python3`) — so a copy that
 * didn't check would leave the user with a gate that reports itself installed
 * and silently never fires. Probed once per install, never on activation.
 */
async function probeHookInterpreters(): Promise<string[]> {
  const found: string[] = [];
  for (const candidate of HOOK_INTERPRETER_CANDIDATES) {
    const ok = await new Promise<boolean>((resolve) => {
      try {
        execFile(candidate, ["--version"], { timeout: 5000 }, (err) => resolve(!err));
      } catch {
        resolve(false);
      }
    });
    if (ok) found.push(candidate);
  }
  return found;
}

/** One-time-per-window nag guard for the auto-mode refusal notice. */
let hooksRefusalNoticeShown = false;

/**
 * Copy bundled Grok harness hooks into the open workspace `.grok/hooks/`.
 * Default setting is off — command path uses force. Never throws into activate.
 *
 * After install, project hooks still require `/hooks-trust` (or CLI trust) and
 * a Python interpreter on PATH; both are stated in the completion notice
 * rather than assumed.
 */
async function provisionWorkspaceHooks(
  context: vscode.ExtensionContext,
  output: vscode.OutputChannel,
  opts: { force: boolean; workspaceRoot?: string } = { force: false },
): Promise<"ok" | "skipped" | "refused" | "failed"> {
  const mode = vscode.workspace
    .getConfiguration("grok")
    .get<HooksProvisionMode>("hooks.provision", "off");
  const version = String(context.extension?.packageJSON?.version ?? "").trim();
  const source = path.join(context.extensionPath, HOOK_BUNDLE_DIR);
  const root =
    opts.workspaceRoot ||
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
    "";
  if (!version || !root) {
    if (opts.force) {
      void vscode.window.showWarningMessage(
        "Grokbit hooks: open a workspace folder first.",
      );
    }
    return "skipped";
  }

  const dest = workspaceHooksDir(root);
  let installed: string | undefined;
  try {
    installed = await fs.promises.readFile(path.join(dest, HOOK_MARKER_FILE), "utf8");
  } catch {
    installed = undefined;
  }

  let destHasContent = false;
  let destExists = false;
  try {
    const names = await fs.promises.readdir(dest);
    destExists = true;
    // Any entry other than our own marker counts — a repo may keep hook wiring
    // we don't recognise (`*.json`, `.sh`, `.ps1`) in here, and the auto path
    // must back that up rather than quietly copy over the top of it.
    destHasContent = hasNonMarkerContent(names);
  } catch {
    destExists = false;
    destHasContent = false;
  }

  const decision = decideHooksProvision({
    mode,
    force: opts.force,
    destHasContent,
    installedVersion: installed,
    bundledVersion: version,
  });

  if (decision.action === "skip") {
    output.appendLine(`[hooks] skip: ${decision.reason}`);
    return "skipped";
  }
  if (decision.action === "refuse") {
    output.appendLine(`[hooks] refuse: ${decision.reason}`);
    // Auto mode re-evaluates on every activation, so a toast here would nag on
    // every window open forever. Once per window, then the Output channel.
    if (!hooksRefusalNoticeShown) {
      hooksRefusalNoticeShown = true;
      void vscode.window.showInformationMessage(
        "Grokbit: workspace already has `.grok/hooks/`. Use “Install workspace harness hooks” to back up and overwrite.",
      );
    }
    return "refused";
  }

  const interpreters = await probeHookInterpreters();
  const interpreter = pickHookInterpreter(interpreters);
  const result = await installHooks({
    fs: fs.promises,
    source,
    dest,
    version,
    backupDir:
      decision.action === "backup-and-copy" && destExists
        ? workspaceHooksBackupDir(root)
        : undefined,
    interpreter,
    log: (line) => output.appendLine(line),
  });

  if (result.status === "failed") {
    output.appendLine(`[hooks] failed: ${result.reason}`);
    if (opts.force) {
      void vscode.window.showErrorMessage(
        `Grokbit hooks install failed: ${result.reason}` +
          (result.backedUpTo ? ` (previous hooks preserved at ${result.backedUpTo})` : ""),
      );
    }
    return "failed";
  }

  output.appendLine(
    `[hooks] provisioned Grok harness hooks ${version} → ${dest} ` +
      `(${result.copied.length} files, interpreter: ${interpreter ?? "none found"})`,
  );
  void warnDualHookStacks(root, output);
  if (opts.force) {
    const trust =
      "Run /hooks-trust in Grok so project hooks fire. Hooks are a backstop only — " +
      "not a substitute for the accuracy protocol.";
    if (interpreter) {
      void vscode.window.showInformationMessage(
        `Grokbit harness hooks installed under \`.grok/hooks/\` (wired to \`${interpreter}\`). ${trust}`,
      );
    } else {
      void vscode.window.showWarningMessage(
        "Grokbit harness hooks installed under `.grok/hooks/`, but no Python interpreter " +
          "was found on PATH — the hooks will not run until `python` or `python3` is " +
          `installed. ${trust}`,
      );
    }
  }
  return "ok";
}

/**
 * Log once when both hook stacks are present. Fully async: this runs on the
 * activation path, where a handful of synchronous `readdirSync`/`readFileSync`
 * calls would block the extension host's event loop for every window.
 */
async function warnDualHookStacks(
  workspaceRoot: string,
  output: vscode.OutputChannel,
): Promise<void> {
  const listing = async (dir: string): Promise<string[]> => {
    try {
      return await fs.promises.readdir(dir);
    } catch {
      return [];
    }
  };

  const hasGrok = dirLooksLikeHooks(await listing(workspaceHooksDir(workspaceRoot)));
  let hasClaude = dirLooksLikeHooks(await listing(workspaceClaudeHooksDir(workspaceRoot)));
  if (!hasClaude) {
    try {
      const text = await fs.promises.readFile(
        workspaceClaudeSettingsPath(workspaceRoot),
        "utf8",
      );
      hasClaude = /"hooks"\s*:/.test(text);
    } catch {
      hasClaude = false;
    }
  }

  const hit = detectDualHookStacks({ hasGrokHooks: hasGrok, hasClaudeHooks: hasClaude });
  if (hit.message) {
    output.appendLine(`[hooks] dual-stack: ${hit.message}`);
  }
}

/** Open latest `.grokbit/plans/<slug>/` or release-readiness.md (read-only). */
async function openPlanArtifacts(which: "latest-plan" | "release-readiness"): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!root) {
    void vscode.window.showWarningMessage("Grokbit: open a workspace folder first.");
    return;
  }
  if (which === "release-readiness") {
    const p = releaseReadinessPath(root);
    if (!fs.existsSync(p)) {
      void vscode.window.showInformationMessage(
        "No test/release-readiness.md found in this workspace.",
      );
      return;
    }
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(p));
    await vscode.window.showTextDocument(doc);
    return;
  }
  const plansRoot = path.join(root, ".grokbit", "plans");
  let entries: { name: string; mtimeMs: number; isDirectory: boolean }[] = [];
  try {
    const names = await fs.promises.readdir(plansRoot, { withFileTypes: true });
    for (const d of names) {
      if (!d.isDirectory()) continue;
      const full = path.join(plansRoot, d.name);
      let mtimeMs = 0;
      try {
        mtimeMs = (await fs.promises.stat(full)).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      entries.push({ name: d.name, mtimeMs, isDirectory: true });
    }
  } catch {
    void vscode.window.showInformationMessage("No .grokbit/plans/ directory yet.");
    return;
  }
  const slug = pickLatestPlanSlug(entries);
  if (!slug || slug.includes("..") || slug.includes("/") || slug.includes("\\")) {
    void vscode.window.showInformationMessage("No plan folders under .grokbit/plans/.");
    return;
  }
  const plansRootResolved = path.resolve(plansRoot);
  const dir = path.resolve(planArtifactsDir(root, slug));
  const underPlans =
    dir === plansRootResolved || dir.startsWith(plansRootResolved + path.sep);
  if (!underPlans) {
    void vscode.window.showWarningMessage("Grokbit: refused path outside .grokbit/plans/.");
    return;
  }
  const planMd = path.join(dir, "plan.md");
  if (fs.existsSync(planMd)) {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(planMd));
    await vscode.window.showTextDocument(doc);
  } else {
    await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(dir));
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Grok");
  const sidebar = new GrokSidebar(context, output);

  void provisionSkillSuite(context, output);
  // One dual-stack check per activation, after provisioning has had its say —
  // a successful install already logs its own, so chaining here (rather than
  // firing a second, racing check alongside it) keeps it to exactly one line.
  const wf = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  void provisionWorkspaceHooks(context, output, { force: false })
    .then((status) => {
      if (wf && status !== "ok") void warnDualHookStacks(wf, output);
    })
    // Nothing about hooks may reach activation as an unhandled rejection: a
    // workspace that can't take them degrades to not having them, exactly as
    // if the setting were off.
    .catch((e) => output.appendLine(`[hooks] ${e instanceof Error ? e.message : String(e)}`));

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
    vscode.commands.registerCommand("grok.installWorkspaceHooks", () =>
      provisionWorkspaceHooks(context, output, { force: true }),
    ),
    vscode.commands.registerCommand("grok.openLatestPlan", () => openPlanArtifacts("latest-plan")),
    vscode.commands.registerCommand("grok.openReleaseReadiness", () =>
      openPlanArtifacts("release-readiness"),
    ),
    vscode.commands.registerCommand("grok.runPeerAgent", () => sidebar.runPeerAgentCommand()),

    // Internal debug helper for manually exercising the plan-review card UI
    // (Approve / Reject / Cancel flows) without a live CLI session.
    vscode.commands.registerCommand("grok._debugDummyPlan", () => sidebar.debugShowDummyPlan()),
  );
}

export function deactivate(): void {
  // disposables handle cleanup
}
