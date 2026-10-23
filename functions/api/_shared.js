const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
}

export function errorJson(error, status, headers = {}) { return json({ error }, status, headers); }

export function cookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const entry = header.split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : null;
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function hmacKey(secret) {
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters.');
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signValue(value, secret) {
  const payload = base64url(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function verifyValue(value, secret) {
  if (!value || typeof value !== 'string' || value.length > 6000) return null;
  const [payload, signature, extra] = value.split('.');
  if (!payload || !signature || extra) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromBase64url(signature), encoder.encode(payload));
    if (!valid) return null;
    const decoded = new TextDecoder().decode(fromBase64url(payload));
    return JSON.parse(decoded);
  } catch { return null; }
}

function sessionIdString(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hashSessionId(sessionId) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(sessionId));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createSession(env, tokens) {
  if (!env.DB) throw new Error('D1 database binding DB is not configured.');
  const random = crypto.getRandomValues(new Uint8Array(32));
  const sessionId = sessionIdString(random);
  const sessionHash = await hashSessionId(sessionId);
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 30 * 24 * 60 * 60;
  await env.DB.prepare('INSERT INTO sessions (session_hash, access_token, refresh_token, token_expires_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(sessionHash, tokens.access_token, tokens.refresh_token, Date.now() + tokens.expires_in * 1000, expiresAt, now).run();
  return sessionId;
}

export async function destroySession(request, env) {
  const sessionId = cookie(request, 'rex_session');
  if (!env.DB || !sessionId || !/^[A-Za-z0-9_-]{40,60}$/.test(sessionId)) return;
  await env.DB.prepare('DELETE FROM sessions WHERE session_hash = ?').bind(await hashSessionId(sessionId)).run();
}

export function cookieOptions(request, maxAge) {
  const secure = new URL(request.url).protocol === 'https:';
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function sessionCookie(request, value, maxAge) {
  return `rex_session=${value}; ${cookieOptions(request, maxAge)}`;
}

export function clearCookie(request, name) {
  return `${name}=; ${cookieOptions(request, 0)}`;
}

async function exchangeRefreshToken(session, env) {
  const body = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: session.refresh_token
  });
  const response = await fetch('https://discord.com/api/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  if (!response.ok) return null;
  const data = await response.json();
  return { ...session, access_token: data.access_token, refresh_token: data.refresh_token || session.refresh_token, token_expires_at: Date.now() + (data.expires_in * 1000), exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 };
}

export async function getSession(request, env) {
  const sessionId = cookie(request, 'rex_session');
  if (!sessionId || !/^[A-Za-z0-9_-]{40,60}$/.test(sessionId)) return { session: null };
  if (!env.DB) return { session: null, configError: true };
  let row;
  try {
    const sessionHash = await hashSessionId(sessionId);
    row = await env.DB.prepare('SELECT access_token, refresh_token, token_expires_at, expires_at FROM sessions WHERE session_hash = ?').bind(sessionHash).first();
  } catch { return { session: null, storageError: true }; }
  if (!row) return { session: null };
  if (!row.access_token || !row.expires_at || row.expires_at < Math.floor(Date.now() / 1000)) {
    try { await env.DB.prepare('DELETE FROM sessions WHERE session_hash = ?').bind(await hashSessionId(sessionId)).run(); } catch {}
    return { session: null };
  }
  if (row.token_expires_at && row.token_expires_at < Date.now() + 60_000) {
    if (!row.refresh_token) return { session: null };
    let refreshed;
    try { refreshed = await exchangeRefreshToken(row, env); } catch { return { session: null, refreshError: true }; }
    if (!refreshed) return { session: null, refreshError: true };
    try {
      await env.DB.prepare('UPDATE sessions SET access_token = ?, refresh_token = ?, token_expires_at = ?, expires_at = ? WHERE session_hash = ?')
        .bind(refreshed.access_token, refreshed.refresh_token, refreshed.token_expires_at, refreshed.exp, await hashSessionId(sessionId)).run();
    } catch { return { session: null, storageError: true }; }
    return { session: { access_token: refreshed.access_token } };
  }
  return { session: { access_token: row.access_token } };
}

export function withSessionCookie(headers, value) {
  if (value) headers.append('set-cookie', value);
  return headers;
}

export const DISCORD_API = 'https://discord.com/api/v10';
