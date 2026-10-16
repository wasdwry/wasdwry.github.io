'use strict';
const SITE_ORIGIN = 'https://wasdwry.github.io';
const channel = location.hash.slice(1), openerWindow = window.opener;
const $ = id => document.getElementById(id);
let started = false;
$('close').onclick = () => window.close();
function say(title, message) { $('title').textContent = title; $('status').textContent = message; }
function send(type, data = {}) { openerWindow?.postMessage({ type, channel, ...data }, SITE_ORIGIN); }
async function request(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(120000), ...options });
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
    } else if (action === 'uploadMusic') {
      say('正在上传音乐…', '音频将公开到网站歌单。提交后还需等待网站自动发布，请保留此窗口。');
      result = await request('/music/upload', { method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Diary-CSRF': session.csrf, 'X-Music-Filename': encodeURIComponent(payload.file.name) },
        body: payload.file });
    } else if (action === 'logout') result = await request('/logout', options);
    else result = { connected: true, login: session.login };
    say(action === 'publish' ? '日记已提交' : action === 'uploadMusic' ? '音乐已提交' : action === 'logout' ? '已退出登录' : '登录成功', '可以关闭此窗口，返回网站。');
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
  if (!['connect', 'publish', 'logout', 'uploadMusic'].includes(data.action)) return;
  if (data.action === 'publish' && (typeof data.payload?.date !== 'string' || typeof data.payload?.content !== 'string')) return;
  if (data.action === 'uploadMusic' && (!(data.payload?.file instanceof Blob) || typeof data.payload.file.name !== 'string' || !data.payload.file.size || data.payload.file.size > 10 * 1024 * 1024)) return;
  started = true; execute(data.action, data.payload);
});
if (!/^[A-Za-z0-9_-]{43}$/.test(channel)) {
  say('请从网站进入', '请回到个人网站，从书桌或音乐播放器打开登录窗口。');
} else if (!openerWindow) {
  // GitHub/browser isolation can sever window.opener during OAuth. The first-party
  // session still persists; reopening from the desk completes the original action.
  request('/session').then(() => say('登录成功', '浏览器已保存登录。请关闭此窗口，回到网站再次点击发布或上传即可，无需重新授权。'))
    .catch(() => say('请返回网站重试', '请关闭此窗口，回到网站再次点击登录、发布或上传。'));
  $('close').hidden = false;
} else {
  send('diary-auth:ready');
  setTimeout(() => { if (!started) { say('请返回网站重试', '原来的页面可能已关闭或刷新。请重新打开操作窗口；已保存的登录仍然有效。'); $('close').hidden = false; } }, 10000);
}
