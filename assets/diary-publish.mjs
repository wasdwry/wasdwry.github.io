import { draftMarkdown } from './diary-core.mjs';

const OWNER = 'wasdwry', OWNER_ID = 73155150;
const REPO = 'wasdwry/wasdwry.github.io', BRANCH = 'main';
const API = 'https://api.github.com';
const repoUrl = 'https://github.com/' + REPO;

export function encodeMarkdown(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}
export async function prepareDiary(date, content) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date)) throw new Error('请填写完整的日期与时间。');
  const parsed = new Date(date + ':00Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 16) !== date) throw new Error('日期或时间无效，请检查后重试。');
  if (typeof content !== 'string' || !content.trim()) throw new Error('请先写下日记正文。');
  const markdown = draftMarkdown(date, content);
  const bytes = new TextEncoder().encode(markdown);
  if (bytes.length > 500000) throw new Error('这篇日记超过 500 KB，请先导出备份，再缩短正文。');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const fingerprint = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  // Same draft maps to the same path, including after a refresh or an uncertain response.
  const path = 'diary/' + date.replace(/[T:]/g, '-') + '-new-diary-' + fingerprint.slice(0, 16) + '.md';
  return { path, content: encodeMarkdown(markdown), fingerprint };
}
export function createGitHubPublisher(fetchImpl = globalThis.fetch.bind(globalThis)) {
  // The token exists only in this closure. Never return, log, or persist it.
  let token = '', account = null, busy = false, generation = 0;
  const listeners = new Set();
  const status = () => ({ connected: Boolean(token && account), login: account?.login || null, busy });
  const notify = () => { for (const listener of listeners) { try { listener(status()); } catch {} } };
  const disconnect = () => { token = ''; account = null; generation++; notify(); };
  async function request(path, accessToken, options = {}) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetchImpl(API + path, {
        method: options.body ? 'PUT' : 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
        referrerPolicy: 'no-referrer', signal: controller.signal,
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + accessToken, 'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
      });
      if (response.status === 404 && options.missingOK) return null;
      if (!response.ok) {
        if (response.status === 401 && token === accessToken) disconnect();
        const message = response.status === 401 ? '连接凭据无效或已过期，请重新连接 GitHub。'
          : response.status === 403 || response.status === 404 ? 'GitHub 未允许此操作。请确认令牌只选择了本站仓库，并开启 Contents 的 Read and write 权限；若触发访问限额，请稍后重试。'
          : response.status === 409 || response.status === 422 ? '仓库状态发生变化，请重试。已有日记不会被覆盖。'
          : response.status === 429 ? '请求过于频繁，请稍后重试。'
          : 'GitHub 暂时无法处理请求，请稍后重试。';
        const error = new Error(message); error.status = response.status; throw error;
      }
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  function result(file, draft, alreadyPublished = false, commit = null) {
    return { path: draft.path, fileUrl: repoUrl + '/blob/' + BRANCH + '/' + draft.path, commitUrl: commit?.sha ? repoUrl + '/commit/' + commit.sha : null, alreadyPublished };
  }
  async function existing(draft, accessToken) {
    const file = await request('/repos/' + REPO + '/contents/' + draft.path + '?ref=' + BRANCH, accessToken, { missingOK: true });
    if (!file) return null;
    if (file.type !== 'file' || file.encoding !== 'base64' || String(file.content).replace(/\s/g, '') !== draft.content) {
      throw new Error('目标文件已存在且内容不同。为保护已有日记，本次未覆盖它。');
    }
    return result(file, draft, true);
  }
  return Object.freeze({
    status,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    disconnect,
    async connect(value) {
      if (busy) throw new Error('正在处理上一项操作，请稍候。');
      const candidate = typeof value === 'string' ? value.trim() : '';
      // Only fine-grained tokens are accepted; classic tokens have broader scopes.
      if (!/^github_pat_[A-Za-z0-9_]+$/.test(candidate)) throw new Error('请使用 GitHub 的 Fine-grained personal access token（以 github_pat_ 开头）。');
      disconnect(); const connection = generation; busy = true; notify();
      try {
        const user = await request('/user', candidate);
        if (user.id !== OWNER_ID || user.login.toLowerCase() !== OWNER) throw new Error('只有站点作者 wasdwry 的 GitHub 账号可以发布日记。');
        await request('/repos/' + REPO, candidate);
        if (connection !== generation) throw new Error('连接已取消，请重新连接。');
        token = candidate; account = { login: user.login }; return status();
      } catch (error) {
        throw new Error(error.status || error.message?.includes('只有') || error.message?.includes('取消') ? error.message : '无法连接 GitHub，请检查网络和令牌后重试。');
      } finally { busy = false; notify(); }
    },
    async publish(date, content) {
      if (busy) throw new Error('正在提交，请勿重复点击。');
      if (!token || !account) throw new Error('请先连接站点作者的 GitHub 账号。');
      const accessToken = token, connection = generation;
      busy = true; notify();
      try {
        const draft = await prepareDiary(date, content);
        const found = await existing(draft, accessToken);
        if (found) return found;
        if (connection !== generation) throw new Error('连接已断开，本次未提交。');
        try {
          const saved = await request('/repos/' + REPO + '/contents/' + draft.path, accessToken, {
            body: { message: 'Add diary for ' + date.replace('T', ' '), content: draft.content, branch: BRANCH }
          });
          if (saved.content?.path !== draft.path || !saved.commit?.sha) throw new Error('Uncertain response');
          return result(saved.content, draft, false, saved.commit);
        } catch (error) {
          // The server may have committed even if its response was lost.
          if (connection === generation) {
            try { const found = await existing(draft, accessToken); if (found) return found; } catch {}
          }
          if (error.status) throw error;
          throw new Error('提交结果尚未确认，草稿仍保留。请重试，系统会先核对仓库，避免重复发布。');
        }
      } catch (error) {
        if (error.name === 'AbortError' || error instanceof TypeError) throw new Error('网络连接暂时失败，草稿仍保留，请稍后重试。');
        throw error;
      } finally { busy = false; notify(); }
    }
  });
}
