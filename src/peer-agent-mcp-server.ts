/**
 * Loopback HTTP MCP server that exposes `run_peer_agent`.
 * Owned by the extension host (same process). Pure enough to unit-test with
 * injected `runPeer` — no vscode import.
 *
 * Transport: simple JSON-RPC over HTTP POST (verified against Grok + Claude
 * ACP in research/peer-agent-mcp.md).
 */
import * as http from "node:http";
import * as crypto from "node:crypto";
import {
  PEER_MCP_SERVER_NAME,
  PEER_MCP_TOOL_NAME,
  peerToolDescription,
  type PeerMcpHttpConfig,
} from "./peer-agent";
import type { BackendId } from "./backends";

export type PeerRunRequest = {
  prompt: string;
  /** Parent session backend (the caller). */
  parentBackend: BackendId;
  /** Optional correlation id from Authorization / client. */
  parentSessionKey?: string;
};

export type PeerRunResult = {
  ok: boolean;
  text: string;
  target: BackendId;
  error?: string;
};

export type PeerMcpServerOptions = {
  /** Execute a peer run. Required. */
  runPeer: (req: PeerRunRequest) => Promise<PeerRunResult>;
  /** Resolve parent backend from an optional session key header. */
  resolveParentBackend?: (parentSessionKey: string | undefined) => BackendId | undefined;
  /** Default parent backend when key missing. */
  defaultParentBackend?: BackendId;
  log?: (msg: string) => void;
};

export type PeerMcpServerHandle = {
  url: string;
  token: string;
  /** ACP mcpServers entry for parent sessions. */
  mcpConfig: PeerMcpHttpConfig;
  close: () => Promise<void>;
};

function toolList(targetHint: string) {
  return [
    {
      name: PEER_MCP_TOOL_NAME,
      description: peerToolDescription(targetHint),
      inputSchema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Task for the peer agent to perform.",
          },
        },
        required: ["prompt"],
        additionalProperties: false,
      },
    },
  ];
}

function unauthorized() {
  return {
    jsonrpc: "2.0" as const,
    error: { code: -32001, message: "unauthorized" },
    id: null,
  };
}

function checkAuth(req: http.IncomingMessage, token: string): boolean {
  const h = req.headers.authorization;
  if (typeof h === "string" && h === `Bearer ${token}`) return true;
  // Some agents may forward custom headers from mcpServers.headers under different casings
  const alt = req.headers["x-grokbit-peer-token"];
  if (typeof alt === "string" && alt === token) return true;
  return false;
}

/**
 * Start a 127.0.0.1 HTTP MCP server. Returns url + token for session/new.
 */
export function startPeerMcpServer(opts: PeerMcpServerOptions): Promise<PeerMcpServerHandle> {
  const token = crypto.randomBytes(24).toString("hex");
  const log = opts.log ?? (() => undefined);

  const server = http.createServer((req, res) => {
    const sendJson = (status: number, body: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "GET" && (req.url === "/" || req.url === "/health")) {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405);
      res.end();
      return;
    }

    if (!checkAuth(req, token)) {
      sendJson(401, unauthorized());
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      void (async () => {
        let body: unknown;
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
        } catch {
          sendJson(400, {
            jsonrpc: "2.0",
            error: { code: -32700, message: "parse error" },
            id: null,
          });
          return;
        }

        const parentKeyHeader = req.headers["x-grokbit-parent-session"];
        const parentSessionKey =
          typeof parentKeyHeader === "string" ? parentKeyHeader : undefined;

        const handleOne = async (msg: any): Promise<object | null> => {
          if (!msg || typeof msg !== "object") {
            return { jsonrpc: "2.0", error: { code: -32600, message: "invalid request" }, id: null };
          }
          if (msg.method && msg.id === undefined) return null; // notification

          const id = msg.id;
          const method = msg.method;
          const params = msg.params;

          if (method === "initialize") {
            return {
              jsonrpc: "2.0",
              id,
              result: {
                protocolVersion: params?.protocolVersion || "2024-11-05",
                capabilities: { tools: {} },
                serverInfo: { name: PEER_MCP_SERVER_NAME, version: "0.1.0" },
              },
            };
          }
          if (method === "ping") {
            return { jsonrpc: "2.0", id, result: {} };
          }
          if (method === "tools/list") {
            return {
              jsonrpc: "2.0",
              id,
              result: { tools: toolList("the other connected agent") },
            };
          }
          if (method === "tools/call") {
            const name = params?.name;
            if (name !== PEER_MCP_TOOL_NAME) {
              return {
                jsonrpc: "2.0",
                id,
                error: { code: -32601, message: `unknown tool: ${name}` },
              };
            }
            const prompt = String(params?.arguments?.prompt ?? params?.prompt ?? "").trim();
            if (!prompt) {
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: "error: prompt is required" }],
                  isError: true,
                },
              };
            }

            const parentBackend =
              opts.resolveParentBackend?.(parentSessionKey) ??
              opts.defaultParentBackend ??
              "grok";

            try {
              const result = await opts.runPeer({
                prompt,
                parentBackend,
                parentSessionKey,
              });
              const text = result.ok
                ? result.text
                : `Peer error (${result.target}): ${result.error || result.text || "failed"}`;
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text }],
                  isError: !result.ok,
                },
              };
            } catch (e: any) {
              log(`run_peer_agent failed: ${e?.message || e}`);
              return {
                jsonrpc: "2.0",
                id,
                result: {
                  content: [{ type: "text", text: `Peer error: ${e?.message || String(e)}` }],
                  isError: true,
                },
              };
            }
          }

          return {
            jsonrpc: "2.0",
            id,
            error: { code: -32601, message: `Method not found: ${method}` },
          };
        };

        const batch = Array.isArray(body);
        const msgs: unknown[] = batch ? (body as unknown[]) : [body];
        const out: object[] = [];
        for (const m of msgs) {
          const r = await handleOne(m);
          if (r) out.push(r);
        }
        if (batch) sendJson(200, out);
        else sendJson(200, out[0] ?? { jsonrpc: "2.0", result: {} });
      })();
    });
  });

  return new Promise((resolve, reject) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("peer MCP server failed to bind"));
        return;
      }
      const url = `http://127.0.0.1:${addr.port}/mcp`;
      log(`peer MCP listening ${url}`);
      resolve({
        url,
        token,
        mcpConfig: {
          type: "http",
          name: PEER_MCP_SERVER_NAME,
          url,
          headers: [
            { name: "Authorization", value: `Bearer ${token}` },
            // Optional correlation — agents that ignore unknown headers are fine
            { name: "X-Grokbit-Peer-Token", value: token },
          ],
        },
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
    server.on("error", reject);
  });
}
