#!/usr/bin/env node
/**
 * Minimal stdio MCP server for peer-mcp probes.
 * Speaks a tiny JSON-RPC MCP subset: initialize, tools/list, tools/call.
 * Tool: `ping` → text "pong".
 * Never used by npm test/CI — research only.
 */
const readline = require("node:readline");

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function result(id, value) {
  send({ jsonrpc: "2.0", id, result: value });
}

function error(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

const tools = [
  {
    name: "ping",
    description: "Health check. Returns the text pong. No side effects.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  // Notifications (no id)
  if (msg.method && msg.id === undefined) return;

  const { id, method, params } = msg;
  if (method === "initialize") {
    result(id, {
      protocolVersion: params?.protocolVersion || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "grokbit-hello-mcp", version: "0.0.1" },
    });
    return;
  }
  if (method === "tools/list") {
    result(id, { tools });
    return;
  }
  if (method === "tools/call") {
    const name = params?.name;
    if (name !== "ping") {
      error(id, -32601, `unknown tool: ${name}`);
      return;
    }
    result(id, {
      content: [{ type: "text", text: "pong" }],
      isError: false,
    });
    return;
  }
  if (method === "ping") {
    result(id, {});
    return;
  }
  error(id, -32601, `Method not found: ${method}`);
});

process.stderr.write("[hello-mcp] ready\n");
