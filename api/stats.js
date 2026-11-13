// POST /api/stats  { token, stats }  ->  { ok }
// Saves the latest game stats of the visitor that token belongs to (see visitor.js for what is in them).
const { redis, sha, body, send, cors } = require('./_lib');

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req, 12000);
    if (typeof b.token !== 'string' || !/^[\w-]{20,80}$/.test(b.token)) return send(res, 400, { error: 'no token' });
    if (!b.stats || typeof b.stats !== 'object' || Array.isArray(b.stats)) return send(res, 400, { error: 'no stats' });
    const [id] = await redis(['GET', 'ult:tok:' + sha(b.token)]);
    if (!id) return send(res, 404, { error: 'unknown visitor' });
    const [raw] = await redis(['GET', 'ult:v:' + id]);
    const v = raw ? JSON.parse(raw) : { id: +id, first: Date.now(), visits: 1 };
    v.stats = b.stats;
    v.last = Date.now();
    await redis(['SET', 'ult:v:' + id, JSON.stringify(v)]);
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
