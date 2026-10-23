import { getSession, json, errorJson, DISCORD_API } from './_shared.js';

export async function onRequest({ request, env }) {
  const auth = await getSession(request, env);
  if (auth.configError) return errorJson('Session storage is not configured. Set up the Rex D1 database binding.', 503);
  if (auth.storageError) return errorJson('Could not read the session store. Please try again.', 503);
  if (!auth.session) return errorJson('Not authenticated', 401);
  let response;
  try { response = await fetch(`${DISCORD_API}/users/@me`, { headers: { authorization: `Bearer ${auth.session.access_token}` } }); }
  catch { return errorJson('Discord is temporarily unavailable. Please try again.', 502); }
  if (response.status === 401) return errorJson('Your Discord session has expired. Please sign in again.', 401);
  if (response.status === 429) return errorJson('Discord is rate limiting requests. Please try again shortly.', 429, { 'retry-after': response.headers.get('retry-after') || '5' });
  if (!response.ok) return errorJson('Discord could not verify your account. Please sign in again.', 502);
  const user = await response.json();
  return json({ id: user.id, username: user.username, global_name: user.global_name || null, discriminator: user.discriminator, avatar: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128` : null });
}
