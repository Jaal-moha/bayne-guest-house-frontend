import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(process.env.NODE_PATH + '/')('playwright-core');
const { WEB_URL, API_URL, CHROME, EVIDENCE_DIR, CONTROL, DEMO_OUT } = process.env;
const STEP_TIMEOUT = 10_000;

const arg = process.argv[2];
const spec = JSON.parse(arg.trim().startsWith('{') ? arg : readFileSync(arg, 'utf8'));
const name = spec.name ?? 'inline';
const seq = String(readdirSync(EVIDENCE_DIR).filter((d) => /^\d{3}-/.test(d)).length + 1).padStart(3, '0');
const dir = join(EVIDENCE_DIR, `${seq}-${name}`);
mkdirSync(dir, { recursive: true });

const vars = { ...process.env, RUN: Date.now().toString(36) };
const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const text = (x) => (typeof x === 'string' ? x : JSON.stringify(x));
const sub = (v) =>
  typeof v === 'string'
    ? /^\$\{\w+\}$/.test(v) && v.slice(2, -1) in vars ? vars[v.slice(2, -1)]
    : v.replace(/\$\{DATE([+-]\d+)\}/g, (_, n) => iso(Number(n))).replace(/\$\{(\w+)\}/g, (m, k) => (k in vars ? text(vars[k]) : m))
    : Array.isArray(v) ? v.map(sub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]))
    : v;
const control = (...a) => execFileSync(CONTROL, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const responseBody = (out) => out.split('\n')[out.split('\n').findIndex((l) => l.startsWith('EVIDENCE ')) + 1];
const jq = (filter, input) => execFileSync('jq', ['-e', filter], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();

const report = { spec: name, role: spec.role ?? 'admin', viewport: spec.viewport ?? 'desktop', setup: [], steps: [], visits: [], api: [], requests: [], console: [], pageErrors: [] };
let failed = null;

function finish(browserClose) {
  const result = failed ? (spec.knownBug ? 'XFAIL' : 'FAIL') : (spec.knownBug ? 'XPASS' : 'PASS');
  report.result = result;
  report.failure = failed;
  writeFileSync(join(dir, 'result.json'), JSON.stringify(report, null, 2));
  for (const a of report.api) console.log(`API ${a.method} ${a.path} ${a.status}`);
  console.log(`BYTES ${report.requests.reduce((t, r) => t + (r.bytes ?? 0), 0)} requests=${report.requests.length}`);
  console.log(`PAGEERRORS ${report.pageErrors.length}`);
  console.log(`EVIDENCE ${dir}`);
  if (result === 'XFAIL') console.log(`KNOWN_BUG ${spec.knownBug}`);
  if (result === 'XPASS') console.log(`NEXT the known bug is fixed; delete "knownBug" from ${name}.json so this spec guards the fix`);
  console.log(`RESULT ${result}`);
  return browserClose?.().then(() => process.exit(result === 'PASS' || result === 'XFAIL' ? 0 : 1));
}

for (const [i, raw] of (spec.setup ?? []).entries()) {
  const s = sub(raw);
  const label = `${s.as} ${s.method} ${s.path}`;
  try {
    const out = control('api', 'call', '--expect', String(s.expect), s.as, s.method, s.path, ...(s.body ? [JSON.stringify(s.body)] : []));
    if (s.save) vars[s.save] = JSON.parse(jq(`${s.pick ?? '.id'} | select(.)`, responseBody(out)));
    report.setup.push({ ...s, evidence: out.match(/^EVIDENCE (.+)$/m)?.[1] });
    console.log(`SETUP ${String(i + 1).padStart(2, '0')} OK ${label}${s.save ? ` ${s.save}=${text(vars[s.save])}` : ''}`);
  } catch (e) {
    failed = `setup ${label}: ${(e.stdout || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')}`;
    console.log(`SETUP FAIL ${failed}`);
    await finish();
    process.exit(1);
  }
}

const role = report.role;
const token = role === 'anon' ? null : control('api', 'token', role);
const VIEWPORTS = { desktop: { width: 1280, height: 800 }, tablet: { width: 768, height: 1024 }, phone: { width: 390, height: 844 } };
if (!VIEWPORTS[report.viewport]) throw new Error(`viewport must be one of ${Object.keys(VIEWPORTS).join(', ')}`);
const browser = await chromium.launch({ executablePath: CHROME });
const viewport = VIEWPORTS[report.viewport];
const ctx = await browser.newContext({ viewport, ...(DEMO_OUT && { recordVideo: { dir: join(dir, 'video'), size: viewport } }) });
if (DEMO_OUT) await ctx.addInitScript(demoOverlay);
await ctx.addInitScript((t) => {
  if (sessionStorage.getItem('verify-seeded')) return;
  sessionStorage.setItem('verify-seeded', '1');
  if (t) localStorage.setItem('token', t); else localStorage.removeItem('token');
}, token);
const page = await ctx.newPage();
page.setDefaultTimeout(STEP_TIMEOUT);

// Headless Chromium draws no cursor and the video has no sound, so demo mode paints both the pointer and a caption bar.
function demoOverlay() {
  if (window !== window.top) return;
  let store;
  try { store = window.sessionStorage; } catch { return; }
  const draw = () => {
    if (!document.body || document.getElementById('demo-cursor')) return;
    const style = document.createElement('style');
    style.textContent = 'nextjs-portal{display:none!important}';
    document.head.appendChild(style);
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    const [x, y] = JSON.parse(store.getItem('demo-pos') || '[-40,-40]');
    cursor.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(239,68,68,.35);border:2px solid #ef4444;z-index:2147483647;pointer-events:none;transition:transform .12s`;
    document.body.appendChild(cursor);
    const bar = document.createElement('div');
    bar.id = 'demo-caption';
    bar.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);max-width:80%;padding:12px 22px;border-radius:12px;background:rgba(15,23,42,.88);color:#fff;font:600 18px/1.35 system-ui,sans-serif;text-align:center;z-index:2147483646;pointer-events:none;box-shadow:0 8px 30px rgba(0,0,0,.3)';
    document.body.appendChild(bar);
    window.__demoCaption = (text) => { store.setItem('demo-caption', text); bar.textContent = text; bar.style.display = text ? 'block' : 'none'; };
    window.__demoCaption(store.getItem('demo-caption') || '');
    document.addEventListener('mousemove', (e) => { cursor.style.left = e.clientX + 'px'; cursor.style.top = e.clientY + 'px'; store.setItem('demo-pos', JSON.stringify([e.clientX, e.clientY])); }, true);
    document.addEventListener('mousedown', () => { cursor.style.transform = 'scale(.6)'; }, true);
    document.addEventListener('mouseup', () => { cursor.style.transform = ''; }, true);
  };
  if (document.body) draw(); else document.addEventListener('DOMContentLoaded', draw);
}
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const titleCard = (d) => `<body style="margin:0;height:100vh;display:grid;place-items:center;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#fff;font-family:system-ui,sans-serif">
  <div style="text-align:center;max-width:80%">
    <div style="display:inline-block;padding:6px 16px;border-radius:999px;background:#38bdf8;color:#0f172a;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:15px">${esc(report.role === 'anon' ? (d.as ?? 'Any user') : report.role)}</div>
    <h1 style="font-size:44px;margin:22px 0 14px">${esc(d.title)}</h1>
    <p style="font-size:21px;color:#cbd5e1;line-height:1.5;margin:0">${esc(d.summary ?? '')}</p>
  </div></body>`;
let mouse = [-40, -40];
async function glide(el) {
  await el.scrollIntoViewIfNeeded().catch(() => {});
  const box = await el.boundingBox();
  if (!box) return;
  const to = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.move(...to, { steps: Math.max(8, Math.round(Math.hypot(to[0] - mouse[0], to[1] - mouse[1]) / 25)) });
  mouse = to;
  await page.waitForTimeout(250);
}
const PACE = 700;

const apiPath = (url) => url.slice(API_URL.length) || '/';
const failing = new Set(sub(spec.failApi ?? []));
const routeMatches = (rule, method, path) => {
  const [m, prefix] = rule.split(' ');
  const rest = path.slice(prefix.length);
  return method === m && path.startsWith(prefix) && (rest === '' || prefix.endsWith('/') || /^[/?]/.test(rest));
};
const fails = (req) => [...failing].some((f) => routeMatches(f, req.method(), apiPath(req.url())));
await page.route((u) => u.href.startsWith(API_URL), (r) =>
  fails(r.request())
    ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"verify-injected failure"}' })
    : r.fallback());
const sent = new Map();
page.on('request', (r) => {
  if (!r.url().startsWith(API_URL) || r.method() === 'OPTIONS') return;
  const entry = { method: r.method(), path: apiPath(r.url()), status: 'pending', body: r.postData() ?? undefined };
  sent.set(r, entry);
  report.api.push(entry);
});
page.on('response', (r) => { const entry = sent.get(r.request()); if (entry) entry.status = r.status(); });
page.on('requestfailed', (r) => { const entry = sent.get(r); if (entry) entry.status = 'failed'; });
page.on('framenavigated', (f) => f === page.mainFrame() && report.visits.push(new URL(f.url()).pathname));
const sizing = [];
page.on('request', (q) => report.requests.push({ url: q.url().slice(0, 200), q }));
page.on('requestfinished', (q) => sizing.push(q.sizes().then((z) => { report.requests.find((r) => r.q === q).bytes = z.responseHeadersSize + z.responseBodySize; }).catch(() => {})));
page.on('console', (m) => m.type() === 'error' && report.console.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => report.pageErrors.push(e.message.slice(0, 300)));

const scope = () => (page.locator('[role="dialog"]').count().then((n) => (n ? page.locator('[role="dialog"]').last().locator('xpath=..') : page)));
async function target(t) {
  if (typeof t === 'string') return page.locator(t).first();
  const root = await scope();
  if (t.label) {
    const byLabel = root.getByLabel(t.label, { exact: true });
    if (await byLabel.count()) return byLabel.first();
    const exact = root.locator(`div:has(> label:text-is("${t.label}")) > :is(input,select,textarea), div:has(> label:text-is("${t.label}")) :is(input,select,textarea)`);
    if (await exact.count()) return exact.first();
    return root.locator(`div:has(> label:has-text("${t.label}")) > :is(input,select,textarea)`).first();
  }
  if (t.role) return root.getByRole(t.role, { name: t.name, exact: true }).first();
  if (t.placeholder) return root.getByPlaceholder(t.placeholder, { exact: true }).first();
  if (t.text) return root.getByText(t.text, { exact: true }).first();
  throw new Error(`unknown target ${JSON.stringify(t)}`);
}
const settle = () => page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
// networkidle resolves at once after the first load, so track our own pending requests instead.
async function apiQuiet() {
  const end = Date.now() + 5_000;
  let quietSince = Date.now();
  while (Date.now() < end) {
    if (report.api.some((a) => a.status === 'pending')) quietSince = Date.now();
    else if (Date.now() - quietSince >= 500) return;
    await page.waitForTimeout(50);
  }
}
async function poll(check, what) {
  const end = Date.now() + STEP_TIMEOUT;
  let last;
  while (Date.now() < end) {
    last = await check();
    if (last === true) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`${what}${typeof last === 'string' ? ` (got: ${last})` : ''}`);
}
const bodyText = () => page.innerText('body').catch(() => '');
const apiMatch = (want) => {
  const [method, path, status] = want.split(' ');
  return report.api.some((a) => a.method === method && a.path.split('?')[0] === path.split('?')[0] && (!status || String(a.status) === status));
};

const actions = {
  goto: async (p) => { await page.goto(WEB_URL + p, { waitUntil: 'networkidle', timeout: 60_000 }); },
  click: async (t, s) => {
    const el = await target(t);
    if (DEMO_OUT && !s.at) await glide(el);
    await el.click(s.at ? { position: { x: s.at[0], y: s.at[1] } } : {});
    await settle();
  },
  fill: async (t, s) => {
    const el = await target(t);
    if (!DEMO_OUT || /^(date|datetime-local|time|month)$/.test(await el.getAttribute('type') ?? '')) return el.fill(String(s.value));
    await glide(el);
    await el.fill('');
    await el.pressSequentially(String(s.value), { delay: 45 });
  },
  caption: async (text) => {
    if (!DEMO_OUT) return;
    await page.evaluate((t) => window.__demoCaption?.(t), text);
    await page.waitForTimeout(Math.min(4_000, 1_200 + text.length * 35));
  },
  select: async (t, s) => {
    const el = await target(t);
    if (DEMO_OUT) await glide(el);
    await poll(async () => (await el.locator('option').evaluateAll((os, v) => os.some((o) => o.value === v || o.textContent.trim() === v), String(s.value))) || 'option missing', `option ${s.value}`);
    await el.selectOption(String(s.value)).catch(() => el.selectOption({ label: String(s.value) }));
    await settle();
  },
  press: async (k) => { await page.keyboard.press(k); await settle(); },
  wait: async (ms) => { await page.waitForTimeout(ms); },
  failApi: async (fs) => { for (const f of fs) failing.add(f); },
  unfailApi: async (fs) => { for (const f of fs) failing.delete(f); },
  screenshot: async (n) => { await page.screenshot({ path: join(dir, `${n}.png`) }); },
  expectText: (s) => poll(async () => (await bodyText()).includes(s), `text "${s}" not on page`),
  expectNoText: (s) => poll(async () => !(await bodyText()).includes(s), `text "${s}" still on page`),
  expectVisible: async (t) => { await (await target(t)).waitFor({ state: 'visible' }); },
  expectHidden: async (t) => { await (await target(t)).waitFor({ state: 'hidden' }); },
  expectValue: async (t, s) => { const el = await target(t); await poll(async () => (await el.inputValue()) === String(s.value) || await el.inputValue(), `value "${s.value}"`); },
  expectUrl: (p) => poll(async () => new URL(page.url()).pathname === p || new URL(page.url()).pathname, `url ${p}`),
  expectTitle: (s) => poll(async () => (await page.title()) === s || await page.title(), `title "${s}"`),
  expectApi: (w) => poll(async () => apiMatch(w) || JSON.stringify(report.api.map((a) => `${a.method} ${a.path} ${a.status}`).slice(-4)), `api ${w}`),
  expectNoApi: async (w) => {
    await apiQuiet();
    const hit = report.api.find((a) => routeMatches(w, a.method, a.path));
    if (hit) throw new Error(`api ${w} was called (${hit.method} ${hit.path} ${hit.status})`);
  },
  expectNoVisit: async (p) => { await settle(); if (report.visits.includes(p)) throw new Error(`visited ${p} (visits: ${report.visits.join(' ')})`); },
  expectNoRequest: async (s) => { await settle(); const hit = report.requests.find((r) => r.url.includes(s)); if (hit) throw new Error(`request to ${hit.url}`); },
  expectNoPageErrors: async () => { if (report.pageErrors.length) throw new Error(report.pageErrors[0]); },
  expectFits: async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (w[0] > w[1]) throw new Error(`page is ${w[0]}px wide in a ${w[1]}px viewport`);
    const off = await page.evaluate(() => [...document.querySelectorAll('button, a[href], input, select, textarea')]
      .filter((el) => !el.closest('table'))
      .map((el) => [el, el.getBoundingClientRect()])
      .filter(([, r]) => r.width > 0 && (r.left < 0 || r.right > window.innerWidth))
      .map(([el, r]) => `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 30)}" spans ${Math.round(r.left)}..${Math.round(r.right)}px`));
    if (off.length) throw new Error(`${off[0]} in a ${w[1]}px viewport`);
  },
  apiCheck: async (c) => {
    try {
      const out = control('api', 'call', '--expect', String(c.expect ?? 200), c.as, 'GET', c.path);
      if (c.jq) jq(c.jq, responseBody(out));
    } catch (e) { throw new Error(`apiCheck ${c.path} ${c.jq ?? ''}: ${(e.stdout || e.message).trim().split('\n').pop()}`); }
  },
};

if (DEMO_OUT) {
  if (!spec.demo?.title) throw new Error('a demo spec needs demo.title');
  await page.setContent(titleCard(spec.demo));
  await page.waitForTimeout(3_000);
}
const PACED = new Set(['goto', 'click', 'fill', 'select', 'press']);
for (const [i, raw] of spec.steps.entries()) {
  const s = sub(raw);
  const verb = Object.keys(actions).find((k) => k in s);
  const n = String(i + 1).padStart(2, '0');
  const desc = `${verb} ${JSON.stringify(s[verb])}${'value' in s ? ` = ${JSON.stringify(s.value)}` : ''}`;
  try {
    if (!verb) throw new Error(`unknown step ${JSON.stringify(s)}`);
    await actions[verb](s[verb], s);
    if (DEMO_OUT && PACED.has(verb)) await page.waitForTimeout(PACE);
    report.steps.push({ n, desc, ok: true });
    console.log(`STEP ${n} OK ${desc}`);
  } catch (e) {
    failed = `step ${n} ${desc}: ${e.message.split('\n')[0]}`;
    report.steps.push({ n, desc, ok: false, error: e.message.split('\n')[0] });
    console.log(`STEP ${n} FAIL ${desc} :: ${e.message.split('\n')[0]}`);
    break;
  }
}
if (DEMO_OUT) await page.waitForTimeout(2_000);
await page.screenshot({ path: join(dir, failed ? 'failure.png' : 'final.png') }).catch(() => {});
report.finalUrl = page.url();
report.title = await page.title().catch(() => '');
await Promise.all(sizing);
for (const r of report.requests) delete r.q;
await finish(async () => {
  const video = page.video();
  await ctx.close();
  if (video) renameSync(await video.path(), DEMO_OUT);
  await browser.close();
});
