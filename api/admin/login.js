// POST /api/admin/login  { user, pass }  ->  sets the admin cookie (12 hours)
// At most 10 tries per 15 minutes from one place, so the password can't be guessed by trying many.
const { body, send, tooMany, sessionCookie, checkLogin, adminReady } = require('../_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    if (!adminReady()) return send(res, 503, { error: 'The admin password is not set up yet (Vercel setting ADMIN_PASSWORD).' });
    if (await tooMany(req, 'login', 10, 900)) return send(res, 429, { error: 'Too many tries. Wait 15 minutes.' });
    const b = await body(req, 1000);
    if (!checkLogin(b.user, b.pass)) return send(res, 401, { error: 'Wrong username or password.' });
    send(res, 200, { ok: true }, { 'set-cookie': sessionCookie() });
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
};
