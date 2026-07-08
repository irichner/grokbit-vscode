// Replicates the extension's exact flow on grok 0.2.9x: session/new →
// session/set_model grok-build → prompt #1 (primer-like) → prompt #2 (real)
// → session/load of the same session. Dumps each response's _meta to see
// where totalTokens goes missing.
const { spawn } = require('node:child_process');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');

const CWD = path.join(os.tmpdir(), 'grok-token-probe');
fs.mkdirSync(CWD, { recursive: true });

function startProc() {
  return spawn(process.env.GROK_BIN || 'grok', ['agent', 'stdio'], { cwd: CWD, env: process.env, shell: true });
}

let p = startProc();
let buf = '', nextId = 1;
const pending = new Map();
function send(method, params) {
  const id = nextId++;
  p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  return new Promise((res, rej) => pending.set(id, { res, rej }));
}
function respond(id, result) { p.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n'); }

function wire(proc) {
  proc.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.id != null && m.method == null) {
        const w = pending.get(m.id);
        if (w) { pending.delete(m.id); m.error ? w.rej(new Error(JSON.stringify(m.error))) : w.res(m.result); }
      } else if (m.method && m.method !== 'session/update') {
        if (m.id != null) respond(m.id, {});
      }
    }
  });
  proc.stderr.on('data', (d) => { const s = d.toString(); if (/error|panic/i.test(s)) console.log('STDERR:', s.slice(0, 200)); });
}
wire(p);

const PRIMER = 'Standing instruction for this session: when a plan is presented, wait for [Plan approved]/[Plan rejected]/[Plan cancelled] in a follow-up message. Do not use any tools. Do not read files. Reply with exactly: ok';

(async () => {
  await send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } });
  const nu = await send('session/new', { cwd: CWD, mcpServers: [] });
  const sid = nu.sessionId;
  console.log('session:', sid);

  const sm = await send('session/set_model', { sessionId: sid, modelId: 'grok-build' });
  console.log('set_model _meta:', JSON.stringify(sm && sm._meta));

  const r1 = await send('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text: PRIMER }] });
  console.log('\nPROMPT#1 (primer) result:', JSON.stringify(r1));

  const r2 = await send('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text: 'What is 2+2? Answer with just the number. No tools.' }] });
  console.log('\nPROMPT#2 (real) result:', JSON.stringify(r2));

  // Now reload the session in a fresh process, like opening a history tab.
  p.kill();
  await new Promise((r) => setTimeout(r, 500));
  p = startProc(); buf = ''; wire(p);
  await send('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: true, writeTextFile: true }, terminal: true } });
  const ld = await send('session/load', { sessionId: sid, cwd: CWD, mcpServers: [] });
  console.log('\nSESSION/LOAD result:', JSON.stringify(ld));

  p.kill();
  process.exit(0);
})().catch((e) => { console.log('FAIL:', e.message); p.kill(); process.exit(1); });

setTimeout(() => { console.log('TIMEOUT'); p.kill(); process.exit(1); }, 180000);
