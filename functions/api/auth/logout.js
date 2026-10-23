import { clearCookie, destroySession } from '../_shared.js';

export async function onRequest({ request, env }) {
  try { await destroySession(request, env); } catch { /* The browser cookie is still cleared if storage is unavailable. */ }
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  headers.append('set-cookie', clearCookie(request, 'rex_session'));
  headers.append('set-cookie', clearCookie(request, 'rex_oauth_state'));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
