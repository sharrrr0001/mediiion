#!/usr/bin/env node
/**
 * Load test (spec §12 Phase 6): N concurrent FICTIONAL patients each do a full pre-visit interview
 * against a LOCAL API with DEV_OUTBOX=true and the mock LLM: OTP login → consent → profile → interview
 * (all questions) → submit (summary written). Reports latency percentiles and errors per step.
 *
 *   node scripts/load-test.mjs                 # 200 patients against http://localhost:4000
 *   node scripts/load-test.mjs 50 http://localhost:4000
 *
 * Never point this at the live site: it needs the dev OTP outbox, which production never enables.
 */
const N = Number(process.argv[2] ?? 200);
const API = process.argv[3] ?? 'http://localhost:4000';
/** Seconds a patient takes to read + type each answer (real patients: 5-20 s). 0 = worst-case burst. */
const THINK = Number(process.env.THINK_SECONDS ?? 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ORIGIN = 'http://localhost:3001';
const BASE = 100_000_000 + Math.floor(Math.random() * 800_000_000); // fictional, unique per run
const timings = {};
const errors = {};

function record(step, ms, ok) {
  (timings[step] ??= []).push(ms);
  if (!ok) errors[step] = (errors[step] ?? 0) + 1;
}

class Client {
  constructor(i) {
    this.cookies = new Map();
    this.ip = `10.77.${(i >> 8) & 255}.${i & 255}`;
  }
  async call(step, method, path, body) {
    const started = performance.now();
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Origin: ORIGIN,
        'X-Forwarded-For': this.ip,
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }), headers: new Headers() }));
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const [k, ...v] = kv.split('=');
      this.cookies.set(k.trim(), v.join('='));
    }
    const json = await res.json().catch(() => ({}));
    record(step, performance.now() - started, res.ok);
    if (!res.ok) throw new Error(`${step} → ${res.status} ${JSON.stringify(json).slice(0, 120)}`);
    return json;
  }
}

async function patient(i) {
  const c = new Client(i);
  const phone = `+919${String(BASE + i).padStart(9, '0')}`;
  const r = await c.call('otp_request', 'POST', '/auth/otp/request', { channel: 'sms', phone });
  const otp = await (await fetch(`${API}/dev/outbox?to=${encodeURIComponent(phone)}`)).json();
  await c.call('otp_verify', 'POST', '/auth/otp/verify', { challengeId: r.challengeId, code: otp.code });
  await c.call('consent', 'POST', '/consents', { type: 'data_processing', version: '2026-11-v1', agreed: true });
  const profile = await c.call('profile', 'POST', '/patients/profiles', { name: `Load Test ${i}`, age: 30 + (i % 40), gender: i % 2 ? 'male' : 'female', city: 'Indore', language: 'hi-Latn' });
  let view = await c.call('start', 'POST', '/intake/sessions', { profileId: profile.id });
  await sleep(Math.random() * THINK * 1000); // patients do not all start in the same millisecond
  for (let q = 0; q < 30 && view.awaiting !== 'done'; q++) {
    if (THINK) await sleep((THINK * 0.5 + Math.random() * THINK) * 1000);
    view = await c.call('answer', 'POST', `/intake/sessions/${view.id}/messages`, { text: q === 2 ? 'Bukhar 2 din se, 101 tak' : 'Nahi' });
  }
  await c.call('submit', 'POST', `/intake/sessions/${view.id}/submit`);
}

const pct = (arr, p) => {
  const s = [...arr].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : 0;
};

const t0 = performance.now();
const results = await Promise.allSettled(Array.from({ length: N }, (_, i) => patient(i)));
const seconds = ((performance.now() - t0) / 1000).toFixed(1);
const failed = results.filter((r) => r.status === 'rejected');
console.log(`\n${N} concurrent interviews in ${seconds}s · completed ${N - failed.length} · failed ${failed.length}`);
console.log('step           calls   p50ms   p95ms   p99ms  errors');
for (const [step, arr] of Object.entries(timings)) {
  console.log(`${step.padEnd(14)} ${String(arr.length).padStart(5)} ${String(pct(arr, 0.5)).padStart(7)} ${String(pct(arr, 0.95)).padStart(7)} ${String(pct(arr, 0.99)).padStart(7)} ${String(errors[step] ?? 0).padStart(7)}`);
}
if (failed.length) console.log('\nFirst failures:', failed.slice(0, 3).map((f) => f.reason?.message));
process.exit(failed.length ? 1 : 0);
