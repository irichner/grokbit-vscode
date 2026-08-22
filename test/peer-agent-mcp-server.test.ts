import { describe, it, expect, afterEach } from "vitest";
import * as http from "node:http";
import { startPeerMcpServer, type PeerMcpServerHandle } from "../src/peer-agent-mcp-server";
import { PEER_MCP_TOOL_NAME } from "../src/peer-agent";

function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string>,
): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: "POST", headers: { "content-type": "application/json", ...headers } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          resolve({ status: res.statusCode || 0, json });
        });
      },
    );
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}

describe("startPeerMcpServer", () => {
  let handle: PeerMcpServerHandle | undefined;

  afterEach(async () => {
    if (handle) {
      await handle.close();
      handle = undefined;
    }
  });

  it("rejects unauthorized requests", async () => {
    handle = await startPeerMcpServer({
      runPeer: async () => ({ ok: true, text: "x", target: "claude" }),
    });
    const r = await postJson(handle.url, { jsonrpc: "2.0", id: 1, method: "tools/list" }, {});
    expect(r.status).toBe(401);
  });

  it("lists run_peer_agent and executes it with bearer token", async () => {
    const calls: string[] = [];
    handle = await startPeerMcpServer({
      defaultParentBackend: "grok",
      runPeer: async (req) => {
        calls.push(req.prompt);
        expect(req.parentBackend).toBe("grok");
        return { ok: true, text: `echo:${req.prompt}`, target: "claude" };
      },
    });

    const auth = { Authorization: `Bearer ${handle.token}` };
    const listed = await postJson(
      handle.url,
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      auth,
    );
    expect(listed.status).toBe(200);
    expect(listed.json.result.tools[0].name).toBe(PEER_MCP_TOOL_NAME);

    const called = await postJson(
      handle.url,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: PEER_MCP_TOOL_NAME, arguments: { prompt: "hello peer" } },
      },
      auth,
    );
    expect(called.status).toBe(200);
    expect(called.json.result.isError).toBe(false);
    expect(called.json.result.content[0].text).toBe("echo:hello peer");
    expect(calls).toEqual(["hello peer"]);
  });

  it("returns isError when peer fails", async () => {
    handle = await startPeerMcpServer({
      runPeer: async () => ({
        ok: false,
        text: "",
        target: "claude",
        error: "not signed in",
      }),
    });
    const auth = { Authorization: `Bearer ${handle.token}` };
    const called = await postJson(
      handle.url,
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: PEER_MCP_TOOL_NAME, arguments: { prompt: "x" } },
      },
      auth,
    );
    expect(called.json.result.isError).toBe(true);
    expect(called.json.result.content[0].text).toMatch(/not signed in/);
  });

  it("exposes mcpConfig for session/new", async () => {
    handle = await startPeerMcpServer({
      runPeer: async () => ({ ok: true, text: "ok", target: "grok" }),
    });
    expect(handle.mcpConfig.type).toBe("http");
    expect(handle.mcpConfig.url).toBe(handle.url);
    expect(handle.mcpConfig.headers.some((h) => h.value.includes(handle!.token))).toBe(true);
  });
});
