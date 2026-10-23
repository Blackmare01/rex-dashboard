import { getSession, json, errorJson, DISCORD_API } from '../../_shared.js';

const MANAGE_GUILD = 1n << 5n;
const ADMINISTRATOR = 1n << 3n;
const COMMANDS = ['help','ping','warn','timeout','kick','ban','purge','userinfo','serverinfo','automod'];
const DEFAULTS = {
  general: { prefix: '!', language: 'en' },
  moderation: { enabled: true, requireReason: true, dmUser: true, logChannel: null },
  logging: { enabled: true, channel: null, memberEvents: true, moderationEvents: true, commandEvents: false },
  commands: { disabled: [] },
  automod: { enabled: false, spam: true, invites: true, badWords: false, massMentions: true, action: 'delete', timeoutMinutes: 10, blockedWords: [] }
};

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
function mergeDefaults(saved) {
  const result = structuredClone(DEFAULTS);
  if (!isObject(saved)) return result;
  for (const group of Object.keys(result)) if (isObject(saved[group])) result[group] = { ...result[group], ...saved[group] };
  return result;
}
function validChannelId(value, channelIds, field) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !channelIds.has(value)) throw new Error(`${field} must be a text channel in this server.`);
  return value;
}
function normalizeSettings(input, availableChannels) {
  if (!isObject(input)) throw new Error('Settings payload must be an object.');
  const channels = new Set(availableChannels.map(channel => channel.id));
  const settings = mergeDefaults(input);
  if (!isObject(input.general) || !isObject(input.moderation) || !isObject(input.logging) || !isObject(input.commands) || !isObject(input.automod)) throw new Error('One or more settings sections are missing. Reload and try again.');
  const boolKeys = {
    moderation: ['enabled','requireReason','dmUser'],
    logging: ['enabled','memberEvents','moderationEvents','commandEvents'],
    automod: ['enabled','spam','invites','badWords','massMentions']
  };
  for (const [group, keys] of Object.entries(boolKeys)) for (const key of keys) {
    if (typeof settings[group][key] !== 'boolean') throw new Error(`${group}.${key} must be on or off.`);
  }
  if (typeof settings.general.prefix !== 'string' || settings.general.prefix.length < 1 || settings.general.prefix.length > 4 || /\s|@/.test(settings.general.prefix)) throw new Error('Command prefix must be 1–4 characters with no spaces or @.');
  if (!['en','es','fr'].includes(settings.general.language)) throw new Error('Choose a supported dashboard language.');
  if (!['delete','timeout','none'].includes(settings.automod.action)) throw new Error('Choose a supported AutoMod action.');
  const timeout = Number(settings.automod.timeoutMinutes);
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 1440) throw new Error('AutoMod timeout must be between 1 and 1,440 minutes.');
  if (!Array.isArray(settings.automod.blockedWords) || settings.automod.blockedWords.length > 50 || settings.automod.blockedWords.some(word => typeof word !== 'string' || word.trim().length < 1 || word.trim().length > 40)) throw new Error('Add up to 50 blocked words, each 1–40 characters.');
  if (!Array.isArray(settings.commands.disabled) || settings.commands.disabled.some(name => !COMMANDS.includes(name))) throw new Error('The disabled command list contains an unsupported command.');
  settings.automod.blockedWords = [...new Set(settings.automod.blockedWords.map(word => word.trim().toLowerCase()))];
  settings.commands.disabled = [...new Set(settings.commands.disabled)];
  settings.moderation.logChannel = validChannelId(settings.moderation.logChannel, channels, 'Moderation log channel');
  settings.logging.channel = validChannelId(settings.logging.channel, channels, 'Server log channel');
  settings.automod.timeoutMinutes = timeout;
  return settings;
}

async function authorizeGuild(request, env, guildId) {
  const auth = await getSession(request, env);
  if (auth.configError) return { response: errorJson('Session storage is not configured.', 503) };
  if (auth.storageError) return { response: errorJson('Could not read your session. Please try again.', 503) };
  if (!auth.session) return { response: errorJson('Not authenticated', 401) };
  if (!env.DISCORD_BOT_TOKEN) return { response: errorJson('Rex bot configuration is incomplete.', 503) };
  let guildResponse;
  try { guildResponse = await fetch(`${DISCORD_API}/users/@me/guilds`, { headers: { authorization: `Bearer ${auth.session.access_token}` } }); }
  catch { return { response: errorJson('Discord is temporarily unavailable.', 502) }; }
  if (guildResponse.status === 401) return { response: errorJson('Your Discord session expired. Sign in again.', 401) };
  if (guildResponse.status === 429) return { response: errorJson('Discord is rate limiting requests. Try again shortly.', 429, { 'retry-after': guildResponse.headers.get('retry-after') || '5' }) };
  if (!guildResponse.ok) return { response: errorJson('Could not verify your server permissions.', 502) };
  const guilds = await guildResponse.json();
  const guild = guilds.find(item => item.id === guildId);
  if (!guild) return { response: errorJson('You do not have access to this server.', 403) };
  try {
    const permissions = BigInt(guild.permissions || '0');
    if (!(guild.owner || (permissions & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n)) return { response: errorJson('Manage Server permission is required to change Rex settings.', 403) };
  } catch { return { response: errorJson('Could not verify your server permissions.', 403) }; }
  return { guild };
}

async function getChannels(env, guildId) {
  const response = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` } });
  if (response.status === 429) throw new Error('Discord is rate limiting channel requests. Try again shortly.');
  if (!response.ok) throw new Error('Rex cannot read this server’s channels. Check the bot’s server access.');
  const channels = await response.json();
  return channels.filter(channel => channel.type === 0 || channel.type === 5).map(({ id, name, type }) => ({ id, name, type })).sort((a,b)=>a.name.localeCompare(b.name));
}

export async function onRequest({ request, env, params }) {
  const guildId = String(params.guildId || '');
  if (!/^\d{1,20}$/.test(guildId)) return errorJson('Invalid server ID.', 400);
  if (request.method !== 'GET' && request.method !== 'PUT') return errorJson('Method not allowed.', 405, { allow: 'GET, PUT' });
  if (request.method === 'PUT') {
    const origin = request.headers.get('Origin');
    if (origin && new URL(origin).origin !== new URL(request.url).origin) return errorJson('Cross-origin request rejected.', 403);
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return errorJson('Send settings as JSON.', 415);
  }
  const access = await authorizeGuild(request, env, guildId);
  if (access.response) return access.response;

  let channels;
  try { channels = await getChannels(env, guildId); }
  catch (error) { return errorJson(error.message || 'Could not load server channels.', error.message?.includes('rate limiting') ? 429 : 502); }

  if (request.method === 'GET') {
    try {
      const row = await env.DB.prepare('SELECT settings_json, updated_at FROM guild_settings WHERE guild_id = ?').bind(guildId).first();
      let saved = null;
      if (row) { try { saved = JSON.parse(row.settings_json); } catch { return errorJson('Stored server settings are invalid. Contact the dashboard administrator.', 500); } }
      return json({ settings: mergeDefaults(saved), channels, updatedAt: row?.updated_at || null });
    } catch { return errorJson('Could not load server settings from D1. Apply the latest schema.sql migration.', 503); }
  }

  if (!env.DB) return errorJson('D1 settings storage is not connected.', 503);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 20_000) return errorJson('Settings payload is too large.', 413);
    body = JSON.parse(raw);
  } catch { return errorJson('Request body must contain valid JSON.', 400); }
  let settings;
  try { settings = normalizeSettings(body.settings, channels); }
  catch (error) { return errorJson(error.message, 400); }
  const updatedAt = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare('INSERT INTO guild_settings (guild_id, settings_json, updated_at) VALUES (?, ?, ?) ON CONFLICT(guild_id) DO UPDATE SET settings_json = excluded.settings_json, updated_at = excluded.updated_at')
      .bind(guildId, JSON.stringify(settings), updatedAt).run();
  } catch { return errorJson('Could not save settings to D1. Check the guild_settings schema.', 503); }
  return json({ ok: true, settings, updatedAt });
}
