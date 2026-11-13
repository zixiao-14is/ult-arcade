// Shared by the server functions in api/ (Vercel doesn't turn files starting with _ into web addresses).
//
// Data lives in a database from Vercel's Storage tab: Neon (Postgres, DATABASE_URL; what the site uses) or Upstash
// Redis (KV_REST_API_URL / KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL / _TOKEN). Keys:
//   ult:count            the last visitor number handed out
//   ult:tok:<hash>       visitor number for a browser's secret token (only a hash of the token is stored)
//   ult:v:<number>       that visitor: first and last visit, number of visits, device, game stats
// The admin password is the private Vercel setting ADMIN_PASSWORD (never in the code); the username is "admin"
// unless ADMIN_USER says otherwise.
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ON_VERCEL = process.env.VERCEL === '1';

// Run Redis commands in one round trip; returns their results in order.
// Without a database on this computer (testing), a stand-in in memory is used instead.
const mem = new Map();
function memCmd([cmd, k, ...a]) {
  switch (cmd.toUpperCase()) {
    case 'GET': return mem.has(k) ? mem.get(k) : null;
    case 'SET': if (a[1] === 'NX' && mem.has(k)) return null; mem.set(k, String(a[0])); return 'OK';
    case 'INCR': { const n = (+mem.get(k) || 0) + 1; mem.set(k, String(n)); return n; }
    case 'MGET': return [k, ...a].map(x => mem.has(x) ? mem.get(x) : null);
    case 'EXPIRE': return 1;
    default: throw new Error('test database: no ' + cmd);
  }
}
async function redis(...cmds) {
  if (!URL_ || !TOKEN) {
    if (NEON_URL) return neon(cmds);
    if (ON_VERCEL) throw Object.assign(new Error('The database is not set up yet (Vercel → Storage).'), { status: 503 });
    return cmds.map(memCmd);
  }
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' }, body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('database error ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error('database: ' + x.error); return x.result; });
}

// ---- or a Postgres database from Neon (Vercel → Storage → Neon gives the project DATABASE_URL) ----
// The same few commands, kept in one table: ult_kv(k, v, exp). Sent over Neon's web address for SQL, so no packages
// are needed, and all the commands of one call run together in one transaction.
const NEON_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const TABLE = /^[a-z_]+$/.test(process.env.ULT_TABLE || '') ? process.env.ULT_TABLE : 'ult_kv';
const LIVE = `(exp is null or exp > now())`;
function neonSql([cmd, k, ...a]) {
  switch (cmd.toUpperCase()) {
    case 'GET': return { query: `select v from ${TABLE} where k = $1 and ${LIVE}`, params: [k] };
    case 'SET': return a[1] === 'NX'   // NX: only if the key isn't there yet (or has run out)
      ? { query: `insert into ${TABLE} as t (k, v) values ($1, $2) on conflict (k) do update set v = excluded.v, exp = null where t.exp <= now() returning 1`, params: [k, String(a[0])] }
      : { query: `insert into ${TABLE} (k, v) values ($1, $2) on conflict (k) do update set v = excluded.v, exp = null`, params: [k, String(a[0])] };
    // like Redis: a key that has run out starts again from 1, with no time limit
    case 'INCR': return { query: `insert into ${TABLE} as t (k, v) values ($1, '1') on conflict (k) do update set
        v = case when t.exp <= now() then '1' else (t.v::bigint + 1)::text end,
        exp = case when t.exp <= now() then null else t.exp end returning v`, params: [k] };
    case 'EXPIRE': return { query: `update ${TABLE} set exp = now() + make_interval(secs => $2) where k = $1`, params: [k, Number(a[0])] };
    case 'MGET': return { query: `select k, v from ${TABLE} where k in (select jsonb_array_elements_text($1::jsonb)) and ${LIVE}`, params: [JSON.stringify([k, ...a])] };
    default: throw new Error('database: no ' + cmd);
  }
}
let neonReady = false;
async function neon(cmds) {
  const queries = cmds.map(neonSql);
  // the first call after the server starts makes the table if needed and clears out old limit counters
  const setup = neonReady ? [] : [
    { query: `create table if not exists ${TABLE} (k text primary key, v text not null, exp timestamptz)`, params: [] },
    { query: `delete from ${TABLE} where exp < now()`, params: [] },
  ];
  const host = new URL(NEON_URL).hostname;
  const r = await fetch(`https://${host.replace(/^[^.]+\./, 'api.')}/sql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'Neon-Connection-String': NEON_URL, 'Neon-Raw-Text-Output': 'true', 'Neon-Array-Mode': 'true', 'Neon-Batch-Isolation-Level': 'ReadCommitted' },
    body: JSON.stringify({ queries: [...setup, ...queries] }),
  });
  if (!r.ok) throw new Error('database error ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const results = (await r.json()).results.slice(setup.length);
  neonReady = true;
  return cmds.map(([cmd, ...keys], i) => {
    const rows = results[i].rows;
    switch (cmd.toUpperCase()) {
      case 'GET': return rows.length ? rows[0][0] : null;
      case 'SET': return keys[2] === 'NX' && !rows.length ? null : 'OK';
      case 'INCR': return Number(rows[0][0]);
      case 'EXPIRE': return results[i].rowCount ? 1 : 0;
      case 'MGET': { const m = new Map(rows.map(([k, v]) => [k, v])); return keys.map(k => m.has(k) ? m.get(k) : null); }
    }
  });
}

const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const sameText = (a, b) => crypto.timingSafeEqual(Buffer.from(sha(a), 'hex'), Buffer.from(sha(b), 'hex'));

// The request body as JSON. Sent as text/plain from the arcade; Vercel may have read it already.
async function body(req, limit = 16000) {
  let raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw;
  if (raw == null) {
    raw = await new Promise((ok, fail) => {
      let s = '';
      req.on('data', c => { s += c; if (s.length > limit) { fail(Object.assign(new Error('too big'), { status: 413 })); req.destroy(); } });
      req.on('end', () => ok(s)); req.on('error', fail);
    });
  }
  raw = String(raw);
  if (raw.length > limit) throw Object.assign(new Error('too big'), { status: 413 });
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('not JSON'), { status: 400 }); }
}

function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader('cache-control', 'no-store');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (data === undefined) return res.end();
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

// The Android app runs at https://localhost and calls the website, so that origin is let in for visits and stats.
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];
function cors(req, res) {
  const o = req.headers.origin;
  if (o && APP_ORIGINS.includes(o)) { res.setHeader('access-control-allow-origin', o); res.setHeader('vary', 'origin'); }
}

// Counts something per caller for a while (for limits). Only a hash of the address is used, and it expires.
async function tooMany(req, what, max, seconds) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const key = `ult:limit:${what}:${sha('ult' + ip).slice(0, 24)}`;
  const [n] = await redis(['INCR', key], ['EXPIRE', key, seconds]);
  return n > max;
}

// ---- admin sessions: a signed cookie that lasts 12 hours ----
const COOKIE = 'ult_admin', HOURS = 12;
const adminReady = () => !!process.env.ADMIN_PASSWORD;
const signKey = () => sha('ult-admin-session|' + process.env.ADMIN_PASSWORD + '|' + (process.env.ADMIN_SESSION_SECRET || ''));
const sign = exp => crypto.createHmac('sha256', signKey()).update(String(exp)).digest('hex');
function sessionCookie(clear) {
  const secure = ON_VERCEL ? '; Secure' : '';
  if (clear) return `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
  const exp = Date.now() + HOURS * 3600e3;
  return `${COOKIE}=${exp}.${sign(exp)}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${HOURS * 3600}${secure}`;
}
function isAdmin(req) {
  if (!adminReady()) return false;
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=(\\d+)\\.([0-9a-f]{64})`));
  if (!m || +m[1] < Date.now()) return false;
  return crypto.timingSafeEqual(Buffer.from(m[2], 'hex'), Buffer.from(sign(m[1]), 'hex'));
}
function checkLogin(user, pass) {
  if (!adminReady() || typeof user !== 'string' || typeof pass !== 'string') return false;
  const okUser = sameText(user, process.env.ADMIN_USER || 'admin'), okPass = sameText(pass, process.env.ADMIN_PASSWORD);
  return okUser && okPass;
}

module.exports = { redis, sha, body, send, cors, tooMany, sessionCookie, isAdmin, checkLogin, adminReady };
