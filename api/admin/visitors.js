// GET /api/admin/visitors  ->  { visitors: [...] }   (admin only)
// Every visitor record, newest visitor number first.
const { redis, send, isAdmin, adminReady } = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  if (!adminReady()) return send(res, 503, { error: 'The admin password is not set up yet (Vercel setting ADMIN_PASSWORD).' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Log in first.' });
  try {
    const [count] = await redis(['GET', 'ult:count']);
    const n = +count || 0, visitors = [];
    for (let from = n; from >= 1; from -= 500) {
      const keys = [];
      for (let id = from; id > Math.max(0, from - 500); id--) keys.push('ult:v:' + id);
      const [rows, elos] = await redis(['MGET', ...keys], ['MGET', ...keys.map(k => k.replace('ult:v:', 'ttt:elo:'))]);
      rows.forEach((r, i) => { if (!r) return; const v = JSON.parse(r); if (elos[i]) v.ttt = JSON.parse(elos[i]); visitors.push(v); });   // ttt: online Tic-Tac-Toe rating
    }
    send(res, 200, { visitors, now: Date.now() });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
