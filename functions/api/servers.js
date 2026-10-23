import { getSession, json, errorJson, DISCORD_API } from './_shared.js';

const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;
const BOT_PERMISSIONS = '1099511720096';

function canManage(guild) {
  try { const permissions = BigInt(guild.permissions || '0'); return (permissions & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n; }
  catch { return false; }
}

async function discordFetch(url, authorization) {
  return fetch(url, { headers: { authorization } });
}

export async function onRequest({ request, env }) {
  const auth = await getSession(request, env);
  if (auth.configError) return errorJson('Session storage is not configured. Set up the Rex D1 database binding.', 503);
  if (auth.storageError) return errorJson('Could not read the session store. Please try again.', 503);
  if (!auth.session) return errorJson('Not authenticated', 401);
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_CLIENT_ID) return errorJson('Rex bot configuration is incomplete. Set DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID on the server.', 503);

  let response;
  try { response = await discordFetch(`${DISCORD_API}/users/@me/guilds?with_counts=true`, `Bearer ${auth.session.access_token}`); }
  catch { return errorJson('Discord is temporarily unavailable. Please try again.', 502); }
  if (response.status === 401) return errorJson('Your Discord session has expired. Please sign in again.', 401);
  if (response.status === 429) return errorJson('Discord is rate limiting requests. Please try again shortly.', 429, { 'retry-after': response.headers.get('retry-after') || '5' });
  if (!response.ok) return errorJson('Could not retrieve your Discord servers.', 502);
  const guilds = await response.json();
  const manageable = guilds.filter(canManage);
  const botAuthorization = `Bot ${env.DISCORD_BOT_TOKEN}`;

  const servers = await Promise.all(manageable.map(async guild => {
    try {
      const botResponse = await discordFetch(`${DISCORD_API}/guilds/${encodeURIComponent(guild.id)}?with_counts=true`, botAuthorization);
      const installed = botResponse.ok ? true : (botResponse.status === 403 || botResponse.status === 404) ? false : null;
      let botGuild = null;
      if (botResponse.ok) botGuild = await botResponse.json();
      const install = new URL('https://discord.com/oauth2/authorize');
      install.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, permissions: BOT_PERMISSIONS, scope: 'bot applications.commands', guild_id: guild.id, disable_guild_select: 'true' }).toString();
      return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.${guild.icon.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
        approximate_member_count: botGuild?.approximate_member_count ?? guild.approximate_member_count ?? null,
        owner: !!guild.owner,
        installed,
        install_url: install.toString()
      };
    } catch {
      const install = new URL('https://discord.com/oauth2/authorize');
      install.search = new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, permissions: BOT_PERMISSIONS, scope: 'bot applications.commands', guild_id: guild.id, disable_guild_select: 'true' }).toString();
      return { id: guild.id, name: guild.name, icon: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128` : null, approximate_member_count: guild.approximate_member_count ?? null, owner: !!guild.owner, installed: null, install_url: install.toString() };
    }
  }));
  servers.sort((a,b)=>a.name.localeCompare(b.name, undefined, { sensitivity:'base' }));
  return json({ servers });
}
