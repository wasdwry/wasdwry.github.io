'use strict';
const SITE_ORIGIN = 'https://wasdwry.github.io';
const channel = location.hash.slice(1), openerWindow = window.opener;
const $ = id => document.getElementById(id);
let started = false;
$('close').onclick = () => window.close();
function say(title, message) { $('title').textContent = title; $('status').textContent = message; }
function send(type, data = {}) { openerWindow?.postMessage({ type, channel, ...data }, SITE_ORIGIN); }
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(90000), ...options });
  const data = await response.json();
  if (!response.ok) { const error = new Error(data.error || '登录已过期，请重新登录。'); error.status = response.status; throw error; }
  return data;
}
function login() {
  say('登录后继续', '请使用站点作者的 GitHub 账号登录。授权完成后即可提交；无需在这里输入仓库令牌。');
  $('login').href = '/auth/login?channel=' + encodeURIComponent(channel); $('login').hidden = false;
}
async function execute(action, payload) {
  try {
    let session;
    try { session = await request('/session'); } catch (error) { if (error.status !== 401) throw error; }
    if (!session && action !== 'logout') { login(); return; }
    const options = { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Diary-CSRF': session?.csrf || '' } };
    let result;
    if (action === 'publish') {
      say('正在发布日记…', '提交成功后，网站会自动更新。请稍候。');
      result = await request('/publish', { ...options, body: JSON.stringify({ date: payload.date, content: payload.content }) });
    } else if (action === 'logout') result = await request('/logout', options);
    else result = { connected: true, login: session.login };
    say(action === 'publish' ? '日记已提交' : action === 'logout' ? '已退出登录' : '登录成功', '可以关闭此窗口，返回书桌。');
    $('close').hidden = false;
    send('diary-auth:result', { ok: true, result });
    setTimeout(() => window.close(), 800);
  } catch (error) {
    say('暂时未能完成', error.message); $('close').hidden = false;
    send('diary-auth:result', { ok: false, error: error.message });
  }
}
window.addEventListener('message', event => {
  const data = event.data;
  if (started || event.origin !== SITE_ORIGIN || event.source !== openerWindow || !openerWindow || data?.type !== 'diary-auth:request' || data.channel !== channel) return;
  if (!['connect', 'publish', 'logout'].includes(data.action)) return;
  if (data.action === 'publish' && (typeof data.payload?.date !== 'string' || typeof data.payload?.content !== 'string')) return;
  started = true; execute(data.action, data.payload);
});
if (!/^[A-Za-z0-9_-]{43}$/.test(channel)) {
  say('请从书桌进入', '请回到个人网站，打开书桌，再点击登录或发布。');
} else if (!openerWindow) {
  // GitHub/browser isolation can sever window.opener during OAuth. The first-party
  // session still persists; reopening from the desk completes the original action.
  request('/session').then(() => say('登录成功', '浏览器已保存登录。请关闭此窗口，回到书桌再次点击发布即可，无需重新授权。'))
    .catch(() => say('请返回书桌重试', '请关闭此窗口，回到书桌再次点击登录或发布。'));
  $('close').hidden = false;
} else {
  send('diary-auth:ready');
  setTimeout(() => { if (!started) { say('请返回书桌重试', '原来的页面可能已关闭或刷新。请重新打开发布窗口；已保存的登录仍然有效。'); $('close').hidden = false; } }, 10000);
}
