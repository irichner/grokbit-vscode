// Raw-log EVERYTHING grok sends during a tool-using turn on 0.2.9x to see
// why/where the session/prompt response (with _meta.totalTokens) goes missing.
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

const counts = {};
p.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    let m; try { m = JSON.parse(line); } catch { console.log('UNPARSEABLE:', line.slice(0, 200)); continue; }
    if (m.id != null && m.method == null) {
      console.log('RESPONSE id=' + m.id + ':', line.slice(0, 500));
      const w = pending.get(m.id);
      if (w) { pending.delete(m.id); m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result); }
      return;
    }
    if (m.method === 'session/update') {
      const t = m.params?.update?.sessionUpdate || '?';
      counts[t] = (counts[t] || 0) + 1;
      if (t === 'agent_thought_chunk' || t === 'agent_message_chunk' || t === 'user_message_chunk') {
        if (counts[t] % 25 === 1) console.log(`  …${t} x${counts[t]}`);
      } else {
        console.log('  UPDATE:', line.slice(0, 400));
      }
      return;
    }
    if (m.method === 'fs/read_text_file') {
      console.log('  FS READ:', m.params?.path);
      try { respond(m.id, { content: fs.readFileSync(m.params.path, 'utf8') }); }
      catch { respond(m.id, { content: '' }); }
      return;
    }
    if (m.method === 'session/request_permission') {
      console.log('  PERMISSION REQ:', line.slice(0, 500));
      const opts = m.params?.options || [];
      const pick = opts.find((o) => /allow/i.test(o.optionId)) || opts[0];
      respond(m.id, { outcome: { outcome: 'selected', optionId: pick.optionId } });
      return;
    }
    console.log('  SRV:', m.method, (m.id != null ? '(req id=' + m.id + ')' : '(notif)'), JSON.stringify(m.params || {}).slice(0, 250));
    if (m.id != null) respond(m.id, {});
  }
});
p.stderr.on('data', (d) => console.log('STDERR:', d.toString().slice(0, 300)));
p.on('exit', (c) => console.log('CLI EXIT', c));

(async () => {
  await send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } });
  const nu = await send('session/new', { cwd: CWD, mcpServers: [] });
  console.log('=== session', nu.sessionId, '— prompting (tool turn) ===');
  const r = await send('session/prompt', {
    sessionId: nu.sessionId,
    prompt: [{ type: 'text', text: 'Read the file answer.txt in this directory and tell me the magic word.' }],
  });
  console.log('\n=== TOOL-TURN RESULT ===');
  console.log(JSON.stringify(r, null, 2));
  console.log('update counts:', JSON.stringify(counts));
  p.kill();
  process.exit(0);
})().catch((e) => { console.log('FAIL:', e.message); p.kill(); process.exit(1); });

setTimeout(() => { console.log('TIMEOUT; counts:', JSON.stringify(counts)); p.kill(); process.exit(1); }, 240000);
