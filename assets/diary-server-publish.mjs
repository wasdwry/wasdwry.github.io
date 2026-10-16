// A first-party popup keeps the session usable when browsers block third-party cookies.
// Only drafts and public results cross windows. GitHub credentials never reach this page.
export function createServerPublisher(backendOrigin, browser = window) {
  const url = new URL(backendOrigin);
  if (url.protocol !== 'https:' || url.origin !== backendOrigin) throw new Error('发布后台地址必须是完整的 HTTPS 来源地址，不含路径。');
  let connected = false, busy = false, pending = null;
  const listeners = new Set();
  const status = () => ({ mode: 'server', connected, login: connected ? 'wasdwry' : null, busy });
  const notify = () => { for (const listener of listeners) { try { listener(status()); } catch {} } };
  function run(action, payload) {
    if (busy) return Promise.reject(new Error('正在处理上一项操作，请稍候。'));
    const bytes = browser.crypto.getRandomValues(new Uint8Array(32));
    const channel = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    // Open synchronously within the click handler, before any asynchronous work.
    const popup = browser.open(backendOrigin + '/#' + channel, '_blank', 'popup,width=520,height=640');
    if (!popup) return Promise.reject(new Error('浏览器拦截了登录窗口，请允许本站弹出窗口后再试。草稿仍保留。'));
    busy = true; notify();
    return new Promise((resolve, reject) => {
      let timer, interval;
      function finish(error, result) {
        browser.removeEventListener('message', receive);
        browser.clearTimeout(timer); browser.clearInterval(interval); pending = null;
        busy = false; notify();
        if (error) reject(error); else resolve(result);
      }
      function receive(event) {
        const data = event.data;
        if (event.origin !== backendOrigin || event.source !== popup || data?.channel !== channel) return;
        if (data.type === 'diary-auth:ready') popup.postMessage({ type: 'diary-auth:request', channel, action, payload }, backendOrigin);
        if (data.type !== 'diary-auth:result') return;
        if (!data.ok) { finish(new Error(typeof data.error === 'string' ? data.error : '操作未完成，请稍后重试。')); return; }
        if (action === 'publish' && (!/^diary\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-new-diary-[a-f0-9]{16}\.md$/.test(data.result?.path) || data.result?.fileUrl !== 'https://github.com/wasdwry/wasdwry.github.io/blob/main/' + data.result.path)) {
          finish(new Error('提交结果格式有误，草稿仍保留，请返回书桌重试。')); return;
        }
        connected = action !== 'logout'; finish(null, data.result);
      }
      browser.addEventListener('message', receive);
      pending = () => finish(new Error('页面已离开，草稿仍保留。重新打开后可继续使用已保存的登录。'));
      interval = browser.setInterval(() => {
        if (popup.closed) finish(new Error('窗口已关闭。若刚完成登录，请再点击一次发布；登录会继续保留，草稿也仍在。'));
      }, 500);
      timer = browser.setTimeout(() => finish(new Error('等待窗口超时。请关闭旧窗口后重试；已保存的登录和草稿仍保留。')), 300000);
    });
  }
  return Object.freeze({
    status,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    connect: () => run('connect'),
    disconnect: () => run('logout'),
    publish: (date, content) => run('publish', { date, content }),
    // Navigating away must never call /logout. The HttpOnly cookie survives page closure.
    dispose() { pending?.(); }
  });
}
