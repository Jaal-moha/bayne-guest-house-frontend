import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const { chromium } = createRequire(process.env.NODE_PATH + '/')('playwright-core');
const { WEB_URL, API_URL, CHROME, EVIDENCE_DIR, CONTROL } = process.env;
const STEP_TIMEOUT = 10_000;

const arg = process.argv[2];
const spec = JSON.parse(arg.trim().startsWith('{') ? arg : readFileSync(arg, 'utf8'));
const name = spec.name ?? 'inline';
const seq = String(readdirSync(EVIDENCE_DIR).filter((d) => /^\d{3}-/.test(d)).length + 1).padStart(3, '0');
const dir = join(EVIDENCE_DIR, `${seq}-${name}`);
mkdirSync(dir, { recursive: true });

const vars = { ...process.env, RUN: Date.now().toString(36) };
const iso = (days) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const sub = (v) =>
  typeof v === 'string'
    ? v.replace(/\$\{DATE([+-]\d+)\}/g, (_, n) => iso(Number(n))).replace(/\$\{(\w+)\}/g, (m, k) => vars[k] ?? m)
    : Array.isArray(v) ? v.map(sub)
    : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sub(x)]))
    : v;
const control = (...a) => execFileSync(CONTROL, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const report = { spec: name, role: spec.role ?? 'admin', viewport: spec.viewport ?? 'desktop', setup: [], steps: [], api: [], console: [], pageErrors: [] };
let failed = null;

function finish(browserClose) {
  const result = failed ? (spec.knownBug ? 'XFAIL' : 'FAIL') : (spec.knownBug ? 'XPASS' : 'PASS');
  report.result = result;
  report.failure = failed;
  writeFileSync(join(dir, 'result.json'), JSON.stringify(report, null, 2));
  for (const a of report.api) console.log(`API ${a.method} ${a.path} ${a.status}`);
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
    if (s.save) vars[s.save] = control('api', 'last', s.pick ?? '.id');
    report.setup.push({ ...s, evidence: out.match(/^EVIDENCE (.+)$/m)?.[1] });
    console.log(`SETUP ${String(i + 1).padStart(2, '0')} OK ${label}${s.save ? ` ${s.save}=${vars[s.save]}` : ''}`);
  } catch (e) {
    failed = `setup ${label}: ${(e.stdout || e.message).split('\n').filter(Boolean).slice(-2).join(' | ')}`;
    console.log(`SETUP FAIL ${failed}`);
    await finish();
    process.exit(1);
  }
}

const role = report.role;
const token = role === 'anon' ? null : control('api', 'token', role);
const browser = await chromium.launch({ executablePath: CHROME });
const ctx = await browser.newContext({ viewport: report.viewport === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
await ctx.addInitScript((t) => { if (t) localStorage.setItem('token', t); else localStorage.removeItem('token'); }, token);
const page = await ctx.newPage();
page.setDefaultTimeout(STEP_TIMEOUT);

const apiPath = (url) => url.slice(API_URL.length) || '/';
for (const f of sub(spec.failApi ?? [])) {
  const [method, prefix] = f.split(' ');
  await page.route((u) => u.href.startsWith(API_URL + prefix), (r) =>
    r.request().method() === method
      ? r.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"verify-injected failure"}' })
      : r.fallback());
}
page.on('response', (r) => {
  if (!r.url().startsWith(API_URL) || r.request().method() === 'OPTIONS') return;
  report.api.push({ method: r.request().method(), path: apiPath(r.url()), status: r.status(), body: r.request().postData() ?? undefined });
});
page.on('requestfailed', (r) => r.url().startsWith(API_URL) && report.api.push({ method: r.request().method(), path: apiPath(r.url()), status: 'failed' }));
page.on('console', (m) => m.type() === 'error' && report.console.push(m.text().slice(0, 300)));
page.on('pageerror', (e) => report.pageErrors.push(e.message.slice(0, 300)));

const scope = () => (page.locator('.fixed.inset-0').count().then((n) => (n ? page.locator('.fixed.inset-0').last() : page)));
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
  click: async (t) => { await (await target(t)).click(); await settle(); },
  fill: async (t, s) => { await (await target(t)).fill(String(s.value)); },
  select: async (t, s) => {
    const el = await target(t);
    await poll(async () => (await el.locator('option').evaluateAll((os, v) => os.some((o) => o.value === v || o.textContent.trim() === v), String(s.value))) || 'option missing', `option ${s.value}`);
    await el.selectOption(String(s.value)).catch(() => el.selectOption({ label: String(s.value) }));
    await settle();
  },
  press: async (k) => { await page.keyboard.press(k); await settle(); },
  wait: async (ms) => { await page.waitForTimeout(ms); },
  screenshot: async (n) => { await page.screenshot({ path: join(dir, `${n}.png`) }); },
  expectText: (s) => poll(async () => (await bodyText()).includes(s), `text "${s}" not on page`),
  expectNoText: (s) => poll(async () => !(await bodyText()).includes(s), `text "${s}" still on page`),
  expectVisible: async (t) => { await (await target(t)).waitFor({ state: 'visible' }); },
  expectHidden: async (t) => { await (await target(t)).waitFor({ state: 'hidden' }); },
  expectValue: async (t, s) => { const el = await target(t); await poll(async () => (await el.inputValue()) === String(s.value) || await el.inputValue(), `value "${s.value}"`); },
  expectUrl: (p) => poll(async () => new URL(page.url()).pathname === p || new URL(page.url()).pathname, `url ${p}`),
  expectTitle: (s) => poll(async () => (await page.title()) === s || await page.title(), `title "${s}"`),
  expectApi: (w) => poll(async () => apiMatch(w) || JSON.stringify(report.api.map((a) => `${a.method} ${a.path} ${a.status}`).slice(-4)), `api ${w}`),
  expectNoApi: async (w) => { await settle(); if (apiMatch(w)) throw new Error(`api ${w} was called`); },
  expectNoPageErrors: async () => { if (report.pageErrors.length) throw new Error(report.pageErrors[0]); },
  expectFits: async () => {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    if (w[0] > w[1]) throw new Error(`page is ${w[0]}px wide in a ${w[1]}px viewport`);
  },
  apiCheck: async (c) => {
    try {
      control('api', 'call', '--expect', String(c.expect ?? 200), c.as, 'GET', c.path);
      if (c.jq) control('api', 'last', c.jq);
    } catch (e) { throw new Error(`apiCheck ${c.path} ${c.jq ?? ''}: ${(e.stdout || e.message).trim().split('\n').pop()}`); }
  },
};

for (const [i, raw] of spec.steps.entries()) {
  const s = sub(raw);
  const verb = Object.keys(actions).find((k) => k in s);
  const n = String(i + 1).padStart(2, '0');
  const desc = `${verb} ${JSON.stringify(s[verb])}${'value' in s ? ` = ${JSON.stringify(s.value)}` : ''}`;
  try {
    if (!verb) throw new Error(`unknown step ${JSON.stringify(s)}`);
    await actions[verb](s[verb], s);
    report.steps.push({ n, desc, ok: true });
    console.log(`STEP ${n} OK ${desc}`);
  } catch (e) {
    failed = `step ${n} ${desc}: ${e.message.split('\n')[0]}`;
    report.steps.push({ n, desc, ok: false, error: e.message.split('\n')[0] });
    console.log(`STEP ${n} FAIL ${desc} :: ${e.message.split('\n')[0]}`);
    break;
  }
}
await page.screenshot({ path: join(dir, failed ? 'failure.png' : 'final.png') }).catch(() => {});
report.finalUrl = page.url();
report.title = await page.title().catch(() => '');
await finish(() => browser.close());
