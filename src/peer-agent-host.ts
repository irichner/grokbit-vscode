/**
 * Host-side PeerRunner — spawns the other backend's AcpClient for a nested run.
 * Impure glue; unit tests inject fakes. Permission/UI routing is provided by
 * the caller (sidebar) via callbacks.
 */
import type { BackendId } from "./backends";
import { backendSpec } from "./backends";
import {
  clampPeerTimeoutMs,
  decidePeerReadiness,
  fitPeerResultText,
  peerPromptEnvelope,
  peerTargetBackend,
  type PeerReadiness,
} from "./peer-agent";
import type { PeerRunRequest, PeerRunResult } from "./peer-agent-mcp-server";

export type PeerRunnerDeps = {
  enabled: () => boolean;
  /** Is the target backend spawnable right now? */
  isBackendAvailable: (id: BackendId) => boolean | Promise<boolean>;
  liveSessionCount: () => number;
  maxLiveSessions: number;
  /**
   * Run a one-shot peer prompt on `target`. Must omit peer MCP on that
   * session (depth 1). Collect assistant text; honor abort/timeout.
   */
  runPeerSession: (args: {
    target: BackendId;
    prompt: string;
    timeoutMs: number;
    signal: AbortSignal;
    onPermission?: (req: unknown) => void;
  }) => Promise<{ text: string }>;
  log?: (msg: string) => void;
  timeoutMs?: number;
};

export class PeerRunner {
  constructor(private readonly deps: PeerRunnerDeps) {}

  async readiness(parent: BackendId): Promise<PeerReadiness> {
    const target = peerTargetBackend(parent);
    const otherOk = await this.deps.isBackendAvailable(target);
    return decidePeerReadiness({
      parent,
      enabled: this.deps.enabled(),
      otherBackendAvailable: !!otherOk,
      liveSessionCount: this.deps.liveSessionCount(),
      maxLiveSessions: this.deps.maxLiveSessions,
    });
  }

  async run(req: PeerRunRequest): Promise<PeerRunResult> {
    const target = peerTargetBackend(req.parentBackend);
    const ready = await this.readiness(req.parentBackend);
    if (!ready.ok) {
      return { ok: false, text: "", target, error: ready.reason };
    }

    const timeoutMs = clampPeerTimeoutMs(this.deps.timeoutMs);
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    const parentLabel = backendSpec(req.parentBackend).label;
    const prompt = peerPromptEnvelope(parentLabel) + req.prompt;

    try {
      this.deps.log?.(
        `peer run start parent=${req.parentBackend} target=${target} timeoutMs=${timeoutMs}`,
      );
      const { text } = await this.deps.runPeerSession({
        target,
        prompt,
        timeoutMs,
        signal: ac.signal,
      });
      const fitted = fitPeerResultText(text);
      const suffix = fitted.truncated ? "\n\n[peer result truncated]" : "";
      return { ok: true, text: fitted.text + suffix, target };
    } catch (e: any) {
      const msg =
        e?.name === "AbortError" || ac.signal.aborted
          ? `Peer timed out after ${timeoutMs}ms`
          : e?.message || String(e);
      this.deps.log?.(`peer run failed: ${msg}`);
      return { ok: false, text: "", target, error: msg };
    } finally {
      clearTimeout(timer);
    }
  }
}
