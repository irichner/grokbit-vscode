// Diagnose: context donut / status-bar shows 0 tokens on grok 0.2.9x.
// Runs initialize → session/new → session/prompt and dumps the RAW prompt
// response JSON (plus any update line mentioning "token"/"usage") to see
// where the CLI reports token usage now. Windows-friendly (shell:true).
const { spawn } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const CWD = path.join(os.tmpdir(), 'grok-token-probe');
fs.mkdirSync(CWD, { recursive: true });
const p = spawn(process.env.GROK_BIN || 'grok', ['agent', 'stdio'], { cwd: CWD, env: process.env, shell: true });

let buf = '', nextId = 1, initId, newId, promptId;
function send(method, params) { const id = nextId++; p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); return id; }
function respond(id, result) { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }

function handle(m, line) {
  if (m.id != null && m.method == null) {
    if (m.id === initId) {
      console.log('INITIALIZED');
      newId = send('session/new', { cwd: CWD, mcpServers: [] });
    } else if (m.id === newId) {
      console.log('SESSION/NEW RESULT:', JSON.stringify(m.result));
      promptId = send('session/prompt', {
        sessionId: m.result.sessionId,
        prompt: [{ type: 'text', text: 'Reply with exactly: ok. Do not use any tools.' }],
      });
    } else if (m.id === promptId) {
      console.log('\n=== RAW session/prompt RESPONSE ===');
      console.log(JSON.stringify(m, null, 2));
      setTimeout(() => { p.kill(); process.exit(0); }, 300);
    }
    return;
  }
  if (m.method === 'session/update') {
    const u = m.params && m.params.update;
    const t = u && u.sessionUpdate;
    if (/token|usage|meta/i.test(line) && t !== 'agent_message_chunk' && t !== 'agent_thought_chunk') {
      console.log('UPDATE (token-ish):', line.slice(0, 600));
    } else {
      console.log('  update:', t);
    }
    return;
  }
  if (m.method) { if (m.id != null) respond(m.id, {}); }
}

p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    handle(m, line);
  }
});
p.stderr.on('data', (d) => { const s = d.toString(); if (/error|panic/i.test(s)) console.log('STDERR:', s.slice(0, 200)); });
p.on('exit', (c) => console.log('EXIT', c));
initId = send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } });
setTimeout(() => { console.log('TIMEOUT'); p.kill(); process.exit(1); }, 120000);
