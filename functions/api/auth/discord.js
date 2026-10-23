import { cookieOptions, signValue, json } from '../_shared.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_REDIRECT_URI || !env.SESSION_SECRET) return json({ error: 'Discord OAuth is not configured. Add the required values to .dev.vars.' }, 503);
  if (env.SESSION_SECRET.length < 32) return json({ error: 'SESSION_SECRET must contain at least 32 characters.' }, 500);
  const state = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + 600;
  const signedState = await signValue({ state, exp: expires }, env.SESSION_SECRET);
  const authorize = new URL('https://discord.com/oauth2/authorize');
  authorize.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: env.DISCORD_REDIRECT_URI, response_type: 'code', scope: 'identify guilds', state }).toString();
  return new Response(null, { status: 302, headers: { location: authorize.toString(), 'cache-control': 'no-store', 'set-cookie': `rex_oauth_state=${signedState}; ${cookieOptions(request, 600)}` } });
}
