// POST /api/visit  { token?, device? }  ->  { id, token }
// A browser with no token (or an unknown one) gets the next visitor number and a new secret token.
const crypto = require('crypto');
const { redis, sha, body, send, cors, tooMany } = require('./_lib');

const DEVICES = ['computer', 'phone/tablet', 'android app'];

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req, 2000), now = Date.now();
    let token = typeof b.token === 'string' && /^[\w-]{20,80}$/.test(b.token) ? b.token : null;
    let id = token ? (await redis(['GET', 'ult:tok:' + sha(token)]))[0] : null;
    let v = null;
    if (id) {
      const [raw] = await redis(['GET', 'ult:v:' + id]);
      v = raw ? JSON.parse(raw) : null;
    } else {
      if (await tooMany(req, 'new', 30, 3600)) return send(res, 429, { error: 'too many new visitors from here, try later' });
      token = crypto.randomBytes(24).toString('base64url');
      [id] = await redis(['INCR', 'ult:count']);
      await redis(['SET', 'ult:tok:' + sha(token), String(id)]);
    }
    v = v || { id: +id, first: now, visits: 0, stats: null };
    if (!v.last || now - v.last > 30 * 60e3) v.visits++;   // back after more than half an hour: a new visit
    v.last = now;
    if (DEVICES.includes(b.device)) v.device = b.device;
    await redis(['SET', 'ult:v:' + id, JSON.stringify(v)]);
    send(res, 200, { id: +id, token });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
