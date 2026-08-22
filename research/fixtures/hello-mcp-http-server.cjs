#!/usr/bin/env node
/**
 * Minimal HTTP MCP server for peer-mcp probes (Grok advertises http/sse, not stdio).
 * POST JSON-RPC: initialize | tools/list | tools/call(ping→pong) | notifications/*
 * Usage: node research/fixtures/hello-mcp-http-server.cjs [port]
 * Prints: HELLO_MCP_URL=http://127.0.0.1:<port>/mcp
 */
const http = require("node:http");

const port = Number(process.argv[2] || 0) || 0;

const tools = [
  {
    name: "ping",
    description: "Health check. Returns the text pong. No side effects.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

function handleRpc(msg) {
  if (!msg || typeof msg !== "object") return { error: { code: -32700, message: "parse error" } };
  // notification
  if (msg.method && msg.id === undefined) return null;
  const { id, method, params } = msg;
  if (method === "initialize") {
    return {
      id,
      result: {
        protocolVersion: params?.protocolVersion || "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "grokbit-hello-mcp-http", version: "0.0.1" },
      },
    };
  }
  if (method === "tools/list") return { id, result: { tools } };
  if (method === "tools/call") {
    if (params?.name !== "ping") {
      return { id, error: { code: -32601, message: `unknown tool: ${params?.name}` } };
    }
    return {
      id,
      result: { content: [{ type: "text", text: "pong" }], isError: false },
    };
  }
  if (method === "ping") return { id, result: {} };
  return { id, error: { code: -32601, message: `Method not found: ${method}` } };
}

const server = http.createServer((req, res) => {
  // CORS / simple health
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
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "parse error" }, id: null }));
      return;
    }
    const batch = Array.isArray(body);
    const msgs = batch ? body : [body];
    const out = [];
    for (const m of msgs) {
      const r = handleRpc(m);
      if (r) out.push({ jsonrpc: "2.0", ...r });
    }
    res.writeHead(200, { "content-type": "application/json" });
    if (batch) res.end(JSON.stringify(out));
    else res.end(JSON.stringify(out[0] ?? { jsonrpc: "2.0", result: {} }));
  });
});

server.listen(port, "127.0.0.1", () => {
  const addr = server.address();
  const url = `http://127.0.0.1:${addr.port}/mcp`;
  process.stdout.write(`HELLO_MCP_URL=${url}\n`);
  process.stderr.write(`[hello-mcp-http] listening ${url}\n`);
});
