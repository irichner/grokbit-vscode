// Does a tool-using turn on grok 0.2.9x still return _meta.totalTokens?
// Handles fs/read_text_file + request_permission so grok can actually run
// the tool, then dumps the final session/prompt response.
const { spawn } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const CWD = path.join(os.tmpdir(), 'grok-token-probe');
fs.mkdirSync(CWD, { recursive: true });
fs.writeFileSync(path.join(CWD, 'answer.txt'), 'The magic word is PINEAPPLE.\n');

const p = spawn(process.env.GROK_BIN || 'grok', ['agent', 'stdio'], { cwd: CWD, env: process.env, shell: true });
let buf = '', nextId = 1;
const pending = new Map();
function send(method, params) {
  const id = nextId++;
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
function respond(id, result) { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }

p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.id != null && m.method == null) {
      const w = pending.get(m.id);
      if (w) { pending.delete(m.id); m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result); }
      return;
    }
    if (m.method === 'fs/read_text_file') {
      console.log('  [fs/read_text_file]', m.params && m.params.path);
      try { respond(m.id, { content: fs.readFileSync(m.params.path, 'utf8') }); }
      catch (e) { respond(m.id, { content: '' }); }
      return;
    }
    if (m.method === 'session/request_permission') {
      const opts = (m.params && m.params.options) || [];
      const pick = opts.find((o) => /allow/i.test(o.optionId) || /allow/i.test(o.name || '')) || opts[0];
      console.log('  [permission]', JSON.stringify(opts.map((o) => o.optionId)), '→', pick && pick.optionId);
      respond(m.id, { outcome: { outcome: 'selected', optionId: pick.optionId } });
      return;
    }
    if (m.method === 'session/update') {
      const u = m.params && m.params.update;
      const t = u && u.sessionUpdate;
      if (t === 'tool_call' || t === 'tool_call_update') console.log('  update:', t, u.status || '', JSON.stringify(u.title || '').slice(0, 60));
      else if (t !== 'agent_thought_chunk' && t !== 'agent_message_chunk') console.log('  update:', t);
      return;
    }
    if (m.method) {
      console.log('  [server req]', m.method, JSON.stringify(m.params || {}).slice(0, 200));
      if (m.id != null) respond(m.id, {});
    }
  }
});
p.stderr.on('data', (d) => { const s = d.toString(); if (/error|panic/i.test(s)) console.log('STDERR:', s.slice(0, 200)); });

(async () => {
  await send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } });
  console.log('initialized');
  const nu = await send('session/new', { cwd: CWD, mcpServers: [] });
  console.log('session:', nu.sessionId);
  await send('session/set_model', { sessionId: nu.sessionId, modelId: 'grok-build' });
  console.log('model set, prompting…');
  const r = await send('session/prompt', {
    sessionId: nu.sessionId,
    prompt: [{ type: 'text', text: 'Read the file answer.txt in this directory and tell me the magic word.' }],
  });
  console.log('\nTOOL-TURN prompt result:', JSON.stringify(r));
  p.kill();
  process.exit(0);
})().catch((e) => { console.log('FAIL:', e.message); p.kill(); process.exit(1); });

setTimeout(() => { console.log('TIMEOUT'); p.kill(); process.exit(1); }, 180000);
