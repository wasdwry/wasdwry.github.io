import { random, digest } from './crypto.mjs';
import { createGitHub, PublicError } from './github.mjs';

const OWNER_ID = 73155150, OWNER = 'wasdwry';
const SESSION = '__Host-diary-session', LOGIN = '__Host-diary-login';
const SESSION_SECONDS = 30 * 24 * 60 * 60;
const validNonce = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const cookie = (name, value, age) => name + '=' + value + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + age;
function readCookie(request, name) {
  const value = (request.headers.get('Cookie') || '').split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
  return validNonce(value) ? value : '';
}
function secure(response) {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return new Response(response.body, { status: response.status, headers });
}
const json = (data, status = 200) => Response.json(data, { status });
const redirect = (url, cookies = []) => {
  const headers = new Headers({ Location: url });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
};
async function readJSON(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new PublicError('请求格式无效。', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new PublicError('缺少请求内容。');
  const chunks = []; let length = 0;
  for (;;) {
    const { value, done } = await reader.read(); if (done) break;
    length += value.length;
    if (length > 600000) { await reader.cancel(); throw new PublicError('请求过大，请缩短日记正文。', 413); }
    chunks.push(value);
  }
  const buffer = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(buffer)); } catch { throw new PublicError('请求格式无效。'); }
}

export function createWorker({ fetchImpl = globalThis.fetch.bind(globalThis), now = () => Math.floor(Date.now() / 1000) } = {}) {
  const github = createGitHub(fetchImpl, now);
  async function cleanup(env) {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM login_states WHERE expires_at <= ?').bind(now()),
      env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now())
    ]);
  }
  function configured(env) {
    try {
      const origin = new URL(env.PUBLIC_ORIGIN);
      return origin.protocol === 'https:' && origin.origin === env.PUBLIC_ORIGIN &&
        Boolean(env.DB && env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.GITHUB_APP_PRIVATE_KEY && /^\d+$/.test(env.GITHUB_INSTALLATION_ID));
    } catch { return false; }
  }
  async function session(request, env) {
    const value = readCookie(request, SESSION);
    if (!value) return null;
    return env.DB.prepare('SELECT id_hash, csrf, login, expires_at FROM sessions WHERE id_hash = ? AND user_id = ? AND expires_at > ?')
      .bind(await digest(value), OWNER_ID, now()).first();
  }
  async function handle(request, env) {
    const url = new URL(request.url), path = url.pathname;
    if (path === '/health' && request.method === 'GET') return json({ ready: configured(env) });
    if (!configured(env)) throw new PublicError('发布后台尚未配置完成，请稍后再试。', 503);
    if (url.origin !== env.PUBLIC_ORIGIN) throw new PublicError('请从正式发布地址访问。', 400);
    if (request.method === 'GET' && ['/', '/bridge.js', '/bridge.css'].includes(path)) return env.ASSETS.fetch(request);
    if (path === '/auth/login' && request.method === 'GET') {
      const channel = url.searchParams.get('channel');
      if (!validNonce(channel)) throw new PublicError('请从日记书桌打开登录窗口。');
      await cleanup(env);
      const state = random(), browser = random(), verifier = random();
      await env.DB.prepare('INSERT INTO login_states (state_hash, browser_hash, code_verifier, channel, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await digest(state), await digest(browser), verifier, channel, now() + 600).run();
      const authorize = new URL('https://github.com/login/oauth/authorize');
      authorize.search = new URLSearchParams({ client_id: env.GITHUB_CLIENT_ID, redirect_uri: env.PUBLIC_ORIGIN + '/auth/callback',
        state, code_challenge: await digest(verifier), code_challenge_method: 'S256', login: OWNER, allow_signup: 'false' });
      return redirect(authorize.href, [cookie(LOGIN, browser, 600)]);
    }
    if (path === '/auth/callback' && request.method === 'GET') {
      const state = url.searchParams.get('state'), browser = readCookie(request, LOGIN), code = url.searchParams.get('code');
      if (!validNonce(state) || !browser || !code || code.length > 512) throw new PublicError('登录未完成，请关闭此窗口，返回书桌重新登录。', 401);
      // Atomic consumption rejects callback replay; the cookie binds it to the initiating browser.
      const login = await env.DB.prepare('DELETE FROM login_states WHERE state_hash = ? AND browser_hash = ? AND expires_at > ? RETURNING code_verifier, channel')
        .bind(await digest(state), await digest(browser), now()).first();
      if (!login) throw new PublicError('登录已过期或不属于当前浏览器，请返回书桌重新登录。', 401);
      const user = await github.identify(env, code, login.code_verifier);
      if (user?.id !== OWNER_ID || user?.login?.toLowerCase() !== OWNER) throw new PublicError('只有站点作者 wasdwry 可以登录发布后台。', 403);
      const id = random(), csrf = random();
      const previous = readCookie(request, SESSION);
      if (previous) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await digest(previous)).run();
      await env.DB.prepare('INSERT INTO sessions (id_hash, csrf, user_id, login, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(await digest(id), csrf, OWNER_ID, OWNER, now() + SESSION_SECONDS).run();
      return redirect(env.PUBLIC_ORIGIN + '/#' + login.channel, [cookie(LOGIN, '', 0), cookie(SESSION, id, SESSION_SECONDS)]);
    }
    if (path === '/session' && request.method === 'GET') {
      const current = await session(request, env);
      return current ? json({ authenticated: true, login: current.login, csrf: current.csrf, expiresAt: current.expires_at }) : json({ authenticated: false }, 401);
    }
    if (['/publish', '/logout'].includes(path) && request.method === 'POST') {
      // All API requests originate in the first-party popup. No cross-site cookie access or CORS is needed.
      if (request.headers.get('Origin') !== env.PUBLIC_ORIGIN) throw new PublicError('请求来源无效。', 403);
      const current = await session(request, env);
      if (path === '/logout' && !current) return new Response(JSON.stringify({ authenticated: false }), {
        headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(SESSION, '', 0) }
      });
      if (!current) throw new PublicError('登录已过期，请重新登录。', 401);
      if (request.headers.get('X-Diary-CSRF') !== current.csrf) throw new PublicError('请求校验失败，请重新打开发布窗口。', 403);
      if (path === '/logout') {
        await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(current.id_hash).run();
        return new Response(JSON.stringify({ authenticated: false }), { headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie(SESSION, '', 0) } });
      }
      const data = await readJSON(request);
      if (!data || Object.keys(data).some(key => !['date', 'content'].includes(key))) throw new PublicError('仅支持提交日记日期与正文。');
      return json(await github.publish(env, data.date, data.content));
    }
    return json({ error: '没有此页面或不支持此操作。' }, 404);
  }
  return {
    async fetch(request, env) {
      try { return secure(await handle(request, env)); }
      catch (error) {
        const message = error instanceof PublicError ? error.message : '发布服务暂时不可用，草稿仍保留，请稍后重试。';
        const status = error instanceof PublicError ? error.status : 503;
        if (new URL(request.url).pathname === '/auth/callback') {
          const escaped = message.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
          return secure(new Response('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>登录未完成</title><link rel="stylesheet" href="/bridge.css"><body><main><h1>登录未完成</h1><p>' + escaped + '</p><p class="note">请关闭此窗口，返回书桌重试。您的草稿仍然保留。</p></main></body></html>', {
            status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': cookie(LOGIN, '', 0) }
          }));
        }
        return secure(json({ error: message }, status));
      }
    },
    async scheduled(_event, env) { await cleanup(env); }
  };
}
export default createWorker();
