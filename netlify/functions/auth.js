import { authCookie, checkPassword, clearAuthCookie, isAuthenticated, makeToken } from './_lib/auth.js';
import { json, preflight } from './_lib/http.js';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return preflight();

  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, authenticated: isAuthenticated(event) });
  }

  if (event.httpMethod === 'DELETE' || event.queryStringParameters?.logout === '1') {
    const res = json(200, { ok: true, authenticated: false });
    res.headers['set-cookie'] = clearAuthCookie(event);
    return res;
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  try {
    const body = JSON.parse(event.body || '{}');
    if (!checkPassword(String(body.password || ''))) {
      return json(401, { error: 'bad_password' });
    }
    const { token, ttl } = makeToken(Boolean(body.remember));
    const res = json(200, { ok: true, authenticated: true });
    res.headers['set-cookie'] = authCookie(event, token, ttl);
    return res;
  } catch (e) {
    return json(500, { error: String(e?.message || e) });
  }
}
