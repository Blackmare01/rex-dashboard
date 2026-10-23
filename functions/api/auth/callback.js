import { cookie, cookieOptions, clearCookie, signValue, verifyValue, sessionCookie, createSession } from '../_shared.js';

function fail(request, reason, status = 302) {
  const location = new URL('/', request.url); location.searchParams.set('error', reason);
  return new Response(null, { status, headers: { location: location.toString(), 'cache-control': 'no-store', 'set-cookie': clearCookie(request, 'rex_oauth_state') } });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.has('error')) return fail(request, 'discord_denied');
  const code = url.searchParams.get('code');
  const returnedState = url.searchParams.get('state');
  const signedState = cookie(request, 'rex_oauth_state');
  if (!code || code.length > 2048 || !returnedState || returnedState.length > 256 || !signedState) return fail(request, 'invalid_callback');
  const expected = await verifyValue(signedState, env.SESSION_SECRET);
  if (!expected || expected.exp < Math.floor(Date.now() / 1000) || expected.state !== returnedState) return fail(request, 'invalid_state');
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_REDIRECT_URI || !env.SESSION_SECRET) return fail(request, 'server_config');

  let tokenResponse;
  try {
    tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: env.DISCORD_REDIRECT_URI })
    });
  } catch { return fail(request, 'discord_unavailable'); }
  if (!tokenResponse.ok) return fail(request, 'token_exchange');
  const token = await tokenResponse.json();
  if (!token.access_token || !token.refresh_token || !Number.isFinite(token.expires_in)) return fail(request, 'token_exchange');
  let identityResponse;
  try { identityResponse = await fetch('https://discord.com/api/v10/users/@me', { headers: { authorization: `Bearer ${token.access_token}` } }); }
  catch { return fail(request, 'discord_unavailable'); }
  if (!identityResponse.ok) return fail(request, 'discord_identity');
  const identity = await identityResponse.json();
  if (!identity.id || !identity.username) return fail(request, 'discord_identity');
  let sessionId;
  try { sessionId = await createSession(env, token); }
  catch { return fail(request, 'server_config'); }
  const headers = new Headers({ location: new URL('/dashboard.html', request.url).toString(), 'cache-control': 'no-store' });
  headers.append('set-cookie', sessionCookie(request, sessionId, 30 * 24 * 60 * 60));
  headers.append('set-cookie', clearCookie(request, 'rex_oauth_state'));
  return new Response(null, { status: 302, headers });
}
