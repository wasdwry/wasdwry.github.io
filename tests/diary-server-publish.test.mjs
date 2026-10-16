import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createServerPublisher } from '../assets/diary-server-publish.mjs';

const ORIGIN = 'https://diary.test', SITE = 'https://wasdwry.github.io';
const saved = { path: 'diary/2026-10-16-12-30-new-diary-0123456789abcdef.md', alreadyPublished: false };
saved.fileUrl = 'https://github.com/wasdwry/wasdwry.github.io/blob/main/' + saved.path;
function browserFixture(blocked = false) {
  let listener, interval, timeout, opened;
  const sent = [], popup = { closed: false, postMessage(data, origin) { sent.push({ data, origin }); } };
  const browser = {
    crypto, open(url) { opened = url; return blocked ? null : popup; },
    addEventListener(type, value) { assert.equal(type, 'message'); listener = value; },
    removeEventListener(type, value) { if (listener === value) listener = null; },
    setInterval(fn) { interval = fn; return 1; }, clearInterval() { interval = null; },
    setTimeout(fn) { timeout = fn; return 2; }, clearTimeout() { timeout = null; }
  };
  return { browser, popup, sent, get channel() { return new URL(opened).hash.slice(1); },
    emit(data, origin = ORIGIN, source = popup) { listener?.({ data: { channel: this.channel, ...data }, origin, source }); },
    tick() { interval?.(); }, timeout() { timeout?.(); }, get listening() { return Boolean(listener); } };
}
test('popup bridge checks origin, source and nonce before sending a draft', async () => {
  const f = browserFixture(), publisher = createServerPublisher(ORIGIN, f.browser);
  const pending = publisher.publish('2026-10-16T12:30', '日记正文 🌊');
  assert.equal(publisher.status().busy, true); assert.equal(publisher.status().connected, false);
  await assert.rejects(publisher.connect(), /上一项/);
  f.emit({ type: 'diary-auth:ready' }, 'https://attacker.test');
  f.emit({ type: 'diary-auth:ready' }, ORIGIN, {});
  f.emit({ type: 'diary-auth:ready', channel: 'wrong' });
  assert.equal(f.sent.length, 0);
  f.emit({ type: 'diary-auth:ready' });
  assert.deepEqual(f.sent[0], { origin: ORIGIN, data: { type: 'diary-auth:request', action: 'publish', channel: f.channel, payload: { date: '2026-10-16T12:30', content: '日记正文 🌊' } } });
  f.emit({ type: 'diary-auth:result', ok: true, result: saved });
  assert.deepEqual(await pending, saved); assert.equal(publisher.status().connected, true); assert.equal(f.listening, false);
});
test('new page can publish without reconnecting; navigation does not log out', async () => {
  const f = browserFixture(), publisher = createServerPublisher(ORIGIN, f.browser);
  const action = publisher.publish('2026-10-16T12:30', '重新打开网页');
  f.emit({ type: 'diary-auth:ready' }); assert.equal(f.sent[0].data.action, 'publish');
  f.emit({ type: 'diary-auth:result', ok: true, result: saved }); await action;
  publisher.dispose(); assert.equal(f.sent.length, 1); assert.equal(publisher.status().connected, true);
  const logout = publisher.disconnect(); f.emit({ type: 'diary-auth:ready' });
  assert.equal(f.sent[1].data.action, 'logout');
  f.emit({ type: 'diary-auth:result', ok: true, result: { authenticated: false } }); await logout;
  assert.equal(publisher.status().connected, false);
});
test('blocked or closed popup, timeout, malformed results and navigation fail without losing the draft', async () => {
  const blocked = browserFixture(true); await assert.rejects(createServerPublisher(ORIGIN, blocked.browser).connect(), /拦截/);
  const f = browserFixture(), publisher = createServerPublisher(ORIGIN, f.browser);
  let action = publisher.connect(); f.popup.closed = true; f.tick(); await assert.rejects(action, /窗口已关闭/);
  assert.equal(f.listening, false); f.popup.closed = false;
  action = publisher.publish('2026-10-16T12:30', '保留'); f.timeout(); await assert.rejects(action, /超时/);
  action = publisher.publish('2026-10-16T12:30', '保留');
  f.emit({ type: 'diary-auth:result', ok: true, result: { ...saved, fileUrl: 'javascript:alert(1)' } });
  await assert.rejects(action, /结果格式/);
  action = publisher.connect(); publisher.dispose(); await assert.rejects(action, /页面已离开/);
  assert.equal(publisher.status().busy, false);
});
function bridgeFixture({ authenticated = true, opener = true, failPublish = false } = {}) {
  const nodes = new Map(), messages = [], requests = []; let listener;
  const parent = { postMessage(data, origin) { messages.push({ data, origin }); } };
  const context = {
    location: { hash: '#' + 'x'.repeat(43) }, window: { opener: opener ? parent : null, close() {}, addEventListener(type, fn) { if (type === 'message') listener = fn; } },
    document: { getElementById(id) { if (!nodes.has(id)) nodes.set(id, { hidden: true }); return nodes.get(id); } },
    setTimeout() {}, AbortSignal, URL, encodeURIComponent,
    fetch: async (path, options) => {
      requests.push({ path, options });
      if (path === '/session') return Response.json(authenticated ? { login: 'wasdwry', csrf: 'csrf-value' } : { authenticated: false }, { status: authenticated ? 200 : 401 });
      if (path === '/publish') {
        assert.equal(options.headers['X-Diary-CSRF'], 'csrf-value');
        assert.deepEqual(JSON.parse(options.body), { date: '2026-10-16T12:30', content: '正文' });
        return Response.json(failPublish ? { error: '模拟提交失败，草稿仍保留' } : saved, { status: failPublish ? 502 : 200 });
      }
      return Response.json({ authenticated: false });
    }
  };
  vm.runInNewContext(readFileSync(new URL('../server/diary-auth/public/bridge.js', import.meta.url), 'utf8'), context);
  return { nodes, requests, messages,
    emit(origin = SITE, source = parent, channel = 'x'.repeat(43)) { listener({ origin, source, data: { type: 'diary-auth:request', channel, action: 'publish', payload: { date: '2026-10-16T12:30', content: '正文' } } }); } };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
test('first-party bridge restores cookie session and only accepts the original site window', async () => {
  const f = bridgeFixture(); assert.equal(f.messages[0].data.type, 'diary-auth:ready');
  f.emit('https://attacker.test'); f.emit(SITE, {}); assert.equal(f.requests.length, 0);
  f.emit(); await settle();
  assert.deepEqual(f.requests.map(r => r.path), ['/session', '/publish']);
  assert.equal(f.requests[0].options.credentials, 'same-origin');
  assert.equal(f.messages.at(-1).data.ok, true); assert.equal(f.messages.at(-1).origin, SITE);
  assert.equal(JSON.stringify(f.messages).includes('csrf-value'), false);
  f.emit(); await settle(); assert.equal(f.requests.length, 2);
});
test('bridge prompts login for missing session, reports failures, handles lost opener after OAuth', async () => {
  const missing = bridgeFixture({ authenticated: false }); missing.emit(); await settle();
  assert.equal(missing.nodes.get('login').hidden, false); assert.equal(missing.requests.length, 1);
  const failed = bridgeFixture({ failPublish: true }); failed.emit(); await settle(); assert.equal(failed.messages.at(-1).data.ok, false);
  const isolated = bridgeFixture({ opener: false }); await settle();
  assert.match(isolated.nodes.get('status').textContent, /再次点击发布/); assert.equal(isolated.requests.length, 1);
});
