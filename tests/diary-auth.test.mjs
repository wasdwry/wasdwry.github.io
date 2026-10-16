import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createWorker } from '../server/diary-auth/worker.mjs';
import { createGitHub } from '../server/diary-auth/github.mjs';
import { appJWT, digest } from '../server/diary-auth/crypto.mjs';

const ORIGIN = 'https://diary.test', CHANNEL = 'x'.repeat(43);
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey.export({ type: 'pkcs1', format: 'pem' });
const schema = readFileSync(new URL('../server/diary-auth/schema.sql', import.meta.url), 'utf8');
const response = (value, status = 200) => Response.json(value, { status });
function fixture() {
  const sqlite = new DatabaseSync(':memory:'); sqlite.exec(schema);
  let clock = 1800000000, userId = 73155150, calls = [], writes = 0, tokens = 0, loseResponse = false, denyWrite = false;
  const files = new Map();
  const DB = {
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      function bound(values) { return { first: async () => statement.get(...values) || null, run: async () => statement.run(...values) }; }
      return { ...bound([]), bind: (...values) => bound(values) };
    },
    async batch(statements) { sqlite.exec('BEGIN'); try { const results = await Promise.all(statements.map(s => s.run())); sqlite.exec('COMMIT'); return results; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } }
  };
  const env = { DB, PUBLIC_ORIGIN: ORIGIN, GITHUB_CLIENT_ID: 'Iv1.test', GITHUB_INSTALLATION_ID: '123', GITHUB_CLIENT_SECRET: 'fake-client-secret', GITHUB_APP_PRIVATE_KEY: privateKey };
  const worker = createWorker({ now: () => clock, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login/oauth/access_token')) return response({ access_token: 'fake-user-token' });
    if (url.endsWith('/user')) return response({ id: userId, login: userId === 73155150 ? 'wasdwry' : 'visitor' });
    if (url.endsWith('/access_tokens')) {
      tokens++;
      assert.deepEqual(JSON.parse(options.body), { repositories: ['wasdwry.github.io'], permissions: { contents: 'write' } });
      return response({ token: 'fake-install-token', expires_at: new Date((clock + 3600) * 1000).toISOString() });
    }
    const path = new URL(url).pathname.split('/contents/')[1];
    assert.ok(path?.startsWith('diary/')); assert.ok(url.startsWith('https://api.github.com/repos/wasdwry/wasdwry.github.io/'));
    if (options.method === 'GET') return files.has(path) ? response(files.get(path)) : response({}, 404);
    assert.equal(options.method, 'PUT');
    if (denyWrite) return response({}, 403);
    const body = JSON.parse(options.body); assert.equal(body.branch, 'main'); assert.equal(body.sha, undefined);
    writes++; files.set(path, { type: 'file', encoding: 'base64', content: body.content });
    if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
    return response({ content: { path }, commit: { sha: 'a'.repeat(40) } });
  } });
  const fetch = (path, options) => worker.fetch(new Request(ORIGIN + path, options), env);
  const start = async () => {
    const result = await fetch('/auth/login?channel=' + CHANNEL);
    assert.equal(result.status, 303);
    const target = new URL(result.headers.get('Location'));
    assert.equal(target.origin, 'https://github.com'); assert.equal(target.searchParams.get('code_challenge_method'), 'S256');
    return { state: target.searchParams.get('state'), cookie: result.headers.getSetCookie()[0].split(';')[0], challenge: target.searchParams.get('code_challenge') };
  };
  const callback = login => fetch('/auth/callback?code=fake-code&state=' + login.state, { headers: { Cookie: login.cookie } });
  const login = async () => {
    const result = await callback(await start()); assert.equal(result.status, 303);
    const sessionCookie = result.headers.getSetCookie().find(c => c.startsWith('__Host-diary-session='));
    const cookie = sessionCookie.split(';')[0];
    const session = await (await fetch('/session', { headers: { Cookie: cookie } })).json();
    return { cookie, session, sessionCookie, response: result };
  };
  const post = (path, auth, data, headers = {}) => fetch(path, { method: 'POST', headers: { Origin: ORIGIN, Cookie: auth.cookie, 'X-Diary-CSRF': auth.session.csrf, 'Content-Type': 'application/json', ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
  return { worker, env, sqlite, fetch, start, callback, login, post, calls, files, get writes() { return writes; }, get tokens() { return tokens; }, advance(seconds) { clock += seconds; }, wrongUser() { userId = 42; }, loseResponse() { loseResponse = true; }, denyWrite() { denyWrite = true; } };
}
test('GitHub RSA key formats produce verifiable short-lived JWTs', async () => {
  for (const type of ['pkcs1', 'pkcs8']) {
    const jwt = await appJWT(keys.privateKey.export({ type, format: 'pem' }), 'Iv1.test', 1800000000);
    const [header, payload, signature] = jwt.split('.');
    assert.equal(createVerify('RSA-SHA256').update(header + '.' + payload).verify(keys.publicKey, Buffer.from(signature, 'base64url')), true);
    assert.deepEqual(JSON.parse(Buffer.from(payload, 'base64url')), { iat: 1799999940, exp: 1800000540, iss: 'Iv1.test' });
  }
});

test('GitHub redirects are rejected without forwarding login credentials', async () => {
  const calls = [];
  const github = createGitHub(async (url, options) => {
    calls.push(url);
    assert.equal(options.redirect, 'manual', 'Workers requires manual handling to reject redirects');
    return new Response(null, { status: 302, headers: { Location: 'https://untrusted.test/collect' } });
  }, () => 1800000000);
  await assert.rejects(github.identify({ GITHUB_CLIENT_ID: 'test', GITHUB_CLIENT_SECRET: 'fake-secret', PUBLIC_ORIGIN: ORIGIN }, 'fake-code', 'fake-verifier'), /GitHub 未完成操作/);
  assert.deepEqual(calls, ['https://github.com/login/oauth/access_token']);
});
test('OAuth state is bound to browser and PKCE, single-use, and expires', async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  const started = await f.start();
  const row = f.sqlite.prepare('SELECT * FROM login_states').get();
  assert.equal(row.state_hash, await digest(started.state)); assert.equal(await digest(row.code_verifier), started.challenge);
  assert.equal((await f.callback({ ...started, cookie: '__Host-diary-login=' + 'z'.repeat(43) })).status, 401);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.callback(started)).status, 303);
  assert.equal(JSON.parse(f.calls[0].options.body).code_verifier, row.code_verifier);
  assert.equal((await f.callback(started)).status, 401);
  const expired = await f.start(); f.advance(601); assert.equal((await f.callback(expired)).status, 401);
});
test('only owner can log in; response does not expose credentials or database errors', async t => {
  const f = fixture(); t.after(() => f.sqlite.close()); f.wrongUser();
  const result = await f.callback(await f.start()); assert.equal(result.status, 403);
  assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
  assert.doesNotMatch(await result.text(), /fake-user-token|fake-client-secret|PRIVATE KEY/);
  assert.equal((await f.fetch('/publish', { method: 'POST', headers: { Origin: ORIGIN } })).status, 401);
  assert.equal((await f.fetch('/health')).headers.get('Access-Control-Allow-Origin'), null);
  const missing = await f.worker.fetch(new Request(ORIGIN + '/session'), {}); assert.equal(missing.status, 503);
  assert.doesNotMatch(await missing.text(), /TypeError|SELECT|undefined/);
});
test('persistent HttpOnly session survives fresh requests, expires at 30 days, logout revokes it', async t => {
  const f = fixture(); t.after(() => f.sqlite.close());
  const auth = await f.login();
  assert.match(auth.sessionCookie, /HttpOnly; Secure; SameSite=Lax; Max-Age=2592000/);
  assert.equal(auth.response.headers.get('Location'), ORIGIN + '/#' + CHANNEL);
  assert.equal(auth.response.headers.get('Cache-Control'), 'no-store');
  assert.match(auth.response.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  const dbRow = f.sqlite.prepare('SELECT * FROM sessions').get();
  assert.equal(dbRow.id_hash, await digest(auth.cookie.split('=')[1]));
  assert.doesNotMatch(JSON.stringify(dbRow), /fake-user-token|fake-install-token|fake-client-secret/);
  f.advance(29 * 86400);
  const fresh = await f.fetch('/session', { headers: { Cookie: auth.cookie } }); assert.equal(fresh.status, 200);
  assert.equal((await f.post('/logout', auth)).status, 200);
  assert.equal((await f.fetch('/session', { headers: { Cookie: auth.cookie } })).status, 401);
  const second = await f.login(); f.advance(30 * 86400);
  assert.equal((await f.fetch('/session', { headers: { Cookie: second.cookie } })).status, 401);
  await f.worker.scheduled({}, f.env); assert.equal(f.sqlite.prepare('SELECT count(*) AS n FROM sessions').get().n, 0);
});
test('cross-origin writes, missing CSRF, arbitrary paths and oversized bodies are rejected', async t => {
  const f = fixture(); t.after(() => f.sqlite.close()); const auth = await f.login();
  const draft = { date: '2026-10-16T12:30', content: '测试正文' };
  for (const path of ['/publish', '/logout']) {
    assert.equal((await f.post(path, auth, draft, { Origin: 'https://attacker.test' })).status, 403);
    assert.equal((await f.post(path, auth, draft, { 'X-Diary-CSRF': '' })).status, 403);
  }
  assert.equal((await f.post('/publish', auth, { ...draft, path: 'index.html' })).status, 400);
  assert.equal((await f.post('/publish', auth, draft, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await f.post('/publish', auth, { ...draft, content: 'a'.repeat(600001) })).status, 413);
  assert.equal((await f.post('/publish', auth, { ...draft, date: '2026-02-30T12:00' })).status, 400);
  assert.equal(f.writes, 0); assert.equal(f.tokens, 0);
});
test('publishing is create-only, Unicode-safe and idempotent, and renews installation tokens', async t => {
  const f = fixture(); t.after(() => f.sqlite.close()); const auth = await f.login();
  const draft = { date: '2026-10-16T12:30', content: '海边 🌊\n新的一天' };
  const first = await (await f.post('/publish', auth, draft)).json();
  assert.equal(first.alreadyPublished, false); assert.equal(f.writes, 1); assert.equal(f.tokens, 1);
  assert.match(Buffer.from(f.files.get(first.path).content, 'base64').toString(), /海边 🌊/);
  assert.doesNotMatch(JSON.stringify(first), /fake-install-token|fake-user-token|PRIVATE KEY/);
  const second = await (await f.post('/publish', auth, draft)).json(); assert.equal(second.alreadyPublished, true); assert.equal(f.writes, 1);
  f.advance(3601); await f.post('/publish', auth, draft); assert.equal(f.tokens, 2);
  f.files.get(first.path).content = 'different'; assert.equal((await f.post('/publish', auth, draft)).status, 409); assert.equal(f.writes, 1);
});
test('uncertain write responses reconcile; failures keep the request retryable', async t => {
  const f = fixture(); t.after(() => f.sqlite.close()); const auth = await f.login();
  const draft = { date: '2026-10-16T12:30', content: '保留草稿' };
  f.loseResponse(); const result = await (await f.post('/publish', auth, draft)).json();
  assert.equal(result.alreadyPublished, true); assert.equal(f.writes, 1);
  f.denyWrite(); const failed = await f.post('/publish', auth, { ...draft, content: '另一篇' });
  assert.equal(failed.status, 502); assert.match((await failed.json()).error, /草稿仍保留/); assert.equal(f.writes, 1);
});
