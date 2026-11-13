// POST /api/admin/logout  ->  removes the admin cookie
const { send, sessionCookie } = require('../_lib');

module.exports = (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  send(res, 200, { ok: true }, { 'set-cookie': sessionCookie(true) });
};
