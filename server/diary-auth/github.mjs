import { prepareDiary } from '../../assets/diary-publish.mjs';
import { appJWT } from './crypto.mjs';

const REPO = 'wasdwry/wasdwry.github.io';
export class PublicError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function createGitHub(fetchImpl, now) {
  let cached, inflight;
  async function request(url, token, method = 'GET', body) {
    let response;
    try {
      response = await fetchImpl(url, {
        // Workers supports manual/follow; reject 3xx below without forwarding credentials.
        method, redirect: 'manual', signal: AbortSignal.timeout(20000),
        headers: { Accept: url.startsWith('https://github.com/') ? 'application/json' : 'application/vnd.github+json', 'User-Agent': 'wasdwry-diary-auth',
          'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
    } catch { throw new PublicError('GitHub 暂时无法连接，草稿仍保留，请稍后重试。', 502); }
    if (response.status === 404 && method === 'GET') return null;
    if (!response.ok) {
      if (response.status === 401) cached = null;
      throw new PublicError('GitHub 未完成操作，请检查应用授权或稍后重试。已有日记不会被覆盖。', 502);
    }
    return response.json();
  }
  async function installationToken(env) {
    if (cached?.env === env && cached.expires > now() + 90) return cached.token;
    if (inflight?.env === env) return inflight.promise;
    const promise = (async () => {
      const jwt = await appJWT(env.GITHUB_APP_PRIVATE_KEY, env.GITHUB_CLIENT_ID, now());
      const data = await request('https://api.github.com/app/installations/' + env.GITHUB_INSTALLATION_ID + '/access_tokens', jwt, 'POST', {
        repositories: ['wasdwry.github.io'], permissions: { contents: 'write' }
      });
      const expires = Date.parse(data.expires_at) / 1000;
      if (!data.token || !(expires > now())) throw new PublicError('GitHub 应用授权暂时不可用，请稍后重试。', 502);
      cached = { env, token: data.token, expires };
      return data.token;
    })();
    inflight = { env, promise };
    try { return await promise; } finally { if (inflight?.promise === promise) inflight = null; }
  }
  return {
    async identify(env, code, verifier) {
      const data = await request('https://github.com/login/oauth/access_token', null, 'POST', {
        client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET,
        code, code_verifier: verifier, redirect_uri: env.PUBLIC_ORIGIN + '/auth/callback'
      });
      if (typeof data.access_token !== 'string') throw new PublicError('GitHub 登录未完成，请重新登录。', 401);
      // OAuth tokens are only used for identity verification, never sent to the browser or stored.
      return request('https://api.github.com/user', data.access_token);
    },
    async publish(env, date, content) {
      let draft;
      try { draft = await prepareDiary(date, content); } catch (error) { throw new PublicError(error.message); }
      const token = await installationToken(env);
      const endpoint = 'https://api.github.com/repos/' + REPO + '/contents/' + draft.path;
      const result = (alreadyPublished, commit = null) => ({ path: draft.path, alreadyPublished,
        fileUrl: 'https://github.com/' + REPO + '/blob/main/' + draft.path,
        commitUrl: commit ? 'https://github.com/' + REPO + '/commit/' + commit : null });
      async function existing() {
        const file = await request(endpoint + '?ref=main', token);
        if (!file) return null;
        if (file.type !== 'file' || file.encoding !== 'base64' || String(file.content).replace(/\s/g, '') !== draft.content) {
          throw new PublicError('目标文件已存在且内容不同，本次没有覆盖它。', 409);
        }
        return result(true);
      }
      const found = await existing();
      if (found) return found;
      try {
        const saved = await request(endpoint, token, 'PUT', {
          message: 'Add diary for ' + date.replace('T', ' '), branch: 'main', content: draft.content
        });
        if (saved.content?.path !== draft.path || !/^[a-f0-9]{40}$/.test(saved.commit?.sha)) throw new Error('Unconfirmed write');
        return result(false, saved.commit.sha);
      } catch {
        // A successful write can lose its response. Reconcile before asking the author to retry.
        try { const recovered = await existing(); if (recovered) return recovered; } catch {}
        throw new PublicError('尚未确认提交结果，草稿仍保留。请重试，系统会先核对仓库，避免重复发布。', 502);
      }
    }
  };
}
