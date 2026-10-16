import { DRAFT_KEY, parseDiary, readDraft, writeDraft, draftMarkdown, paginate, entryHash, safeContentUrl } from './diary-core.mjs';

const $ = id => document.getElementById(id);
let storage, cache;
try { storage = window.localStorage; cache = window.sessionStorage; } catch {}
const get = (key, fallback) => { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } };
const put = (key, value) => { try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const localDate = () => { const now = new Date(); return new Date(now - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
function notice(id, message, retry) {
  const node = $(id); node.replaceChildren(); node.hidden = !message;
  if (!message) return;
  node.append(document.createTextNode(message));
  if (retry) { const button = document.createElement('button'); button.textContent = '重试'; button.onclick = retry; node.append(button); }
}
async function request(url, json = false) {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return await (json ? response.json() : response.text());
  } finally { clearTimeout(timeout); }
}
// srcdoc has an about: URL, so location.origin is "null" despite inheriting the host origin.
const parentOrigin = new URL(document.baseURI).origin;
function route(path) { if (parent !== window) parent.postMessage({ type: 'diary:route', path }, parentOrigin); }

// Existing drafts use the same key and fields; saving never depends on the network.
const restored = readDraft(storage);
$('entryDate').value = restored.draft?.date || localDate();
$('entryContent').value = restored.draft?.content || '';
$('draftStatus').textContent = restored.error ? '无法读取本机草稿。写作后请导出备份。' : restored.draft ? '已恢复本机草稿。' : '开始写作后，将自动保存草稿。';
let dirty = false, draftTimer, undoDraft = null;
function snapshot() { return { date: $('entryDate').value, content: $('entryContent').value, savedAt: new Date().toISOString() }; }
function flushDraft() {
  clearTimeout(draftTimer);
  if (!dirty) return true;
  const success = writeDraft(storage, snapshot());
  if (success) dirty = false;
  $('draftStatus').textContent = success ? '已自动保存 · ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '未能保存到本机，请导出草稿备份。';
  return success;
}
function updatePublishLink() {
  const filename = ($('entryDate').value || localDate()).replace(/[T:]/g, '-') + '-new-diary.md';
  $('createLink').href = 'https://github.com/wasdwry/wasdwry.github.io/new/main/diary?filename=' + encodeURIComponent(filename);
}
for (const id of ['entryDate', 'entryContent']) $(id).addEventListener('input', () => {
  dirty = true; clearTimeout(draftTimer); $('draftStatus').textContent = '正在保存…';
  draftTimer = setTimeout(flushDraft, 600); updatePublishLink();
});
updatePublishLink();
$('entryForm').onsubmit = e => e.preventDefault();
function markdown() { return draftMarkdown($('entryDate').value, $('entryContent').value); }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
$('copyMarkdown').onclick = async () => {
  flushDraft();
  if (!$('entryDate').reportValidity()) return;
  const copied = await copy(markdown());
  $('draftActionStatus').textContent = copied ? '已复制 Markdown，可粘贴到 GitHub。' : '浏览器未允许复制，请导出 Markdown 文件。';
};
$('downloadDraft').onclick = () => {
  flushDraft();
  if (!$('entryDate').reportValidity()) return;
  const url = URL.createObjectURL(new Blob([markdown()], { type: 'text/markdown;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = $('entryDate').value.replace(/[T:]/g, '-') + '-new-diary.md';
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  $('draftActionStatus').textContent = '已准备好草稿文件，请保留下载的备份。';
};
$('createLink').onclick = e => { flushDraft(); if (!$('entryDate').reportValidity()) e.preventDefault(); };
// The publisher lives in the host page, so closing the desk does not lose the connection.
const publisher = parent.WasdwryDiaryPublisher;
function connectionState(state) {
  const server = state.mode === 'server';
  $('publishDiary').disabled = Boolean(state.busy);
  $('connectGithub').disabled = Boolean(state.busy);
  $('loginGithub').disabled = Boolean(state.busy);
  $('disconnectGithub').disabled = Boolean(state.busy);
  $('connectionForm').hidden = server || state.connected;
  $('serverConnection').hidden = !server;
  $('loginGithub').hidden = state.connected;
  $('disconnectGithub').hidden = !server && !state.connected;
  $('disconnectGithub').textContent = server ? '退出这台设备的登录' : '断开连接';
  $('connectionStatus').textContent = server
    ? state.connected ? '已登录 ' + state.login + '。刷新或关闭网站后仍可继续发布。' : '点击发布时会检查已保存的登录；首次使用或登录到期时，请在弹出的窗口中登录。'
    : state.connected ? '已连接 ' + state.login + '，本次打开网站期间有效。' : '尚未连接。连接后可直接发布，无需复制正文。';
}
if (publisher) {
  connectionState(publisher.status());
  let unsubscribe = publisher.subscribe(connectionState);
  window.addEventListener('pagehide', () => { $('githubToken').value = ''; unsubscribe?.(); unsubscribe = null; });
  window.addEventListener('pageshow', () => { if (!unsubscribe) { unsubscribe = publisher.subscribe(connectionState); connectionState(publisher.status()); } });
} else {
  $('publishDiary').disabled = true; $('connectGithub').disabled = true;
  $('connectionStatus').textContent = '发布组件尚未就绪，请刷新网站后重试。';
}
$('connectGithub').onclick = async () => {
  if (!publisher) return;
  let token = $('githubToken').value; $('githubToken').value = '';
  $('connectionStatus').textContent = '正在验证 GitHub 连接…';
  try {
    const pending = publisher.connect(token); token = '';
    await pending; connectionState(publisher.status());
    $('publishStatus').textContent = '已连接。检查正文后，点击“发布日记”即可提交。';
    $('publishSettings').open = false;
  } catch (error) {
    token = ''; connectionState(publisher.status()); $('connectionStatus').textContent = error.message;
  }
};
$('githubToken').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('connectGithub').click(); } };
$('loginGithub').onclick = () => $('connectGithub').click();
$('disconnectGithub').onclick = async () => {
  if (!publisher) return;
  $('githubToken').value = '';
  try { await publisher.disconnect(); $('publishStatus').textContent = publisher.status().mode === 'server' ? '已退出这台设备的登录。' : '已断开 GitHub 连接。'; }
  catch (error) { $('publishStatus').textContent = error.message; }
};
$('publishDiary').onclick = async () => {
  flushDraft();
  if (!publisher) return;
  if (!$('entryDate').reportValidity()) return;
  if (!$('entryContent').value.trim()) { $('publishStatus').textContent = '请先写下日记正文。'; $('entryContent').focus(); return; }
  if (publisher.status().mode !== 'server' && !publisher.status().connected) {
    $('publishSettings').open = true; $('publishStatus').textContent = '首次发布，请先连接站点作者的 GitHub 账号。';
    $('githubToken').focus(); return;
  }
  const draft = snapshot();
  $('publishResult').hidden = true; $('publishResult').replaceChildren();
  $('publishStatus').textContent = publisher.status().mode === 'server' ? '请在弹出的窗口中继续，已保存的登录会自动恢复。' : '正在提交到日记仓库…'; $('publishDiary').textContent = '正在提交…';
  try {
    const saved = await publisher.publish(draft.date, draft.content);
    $('publishStatus').textContent = saved.alreadyPublished ? '这份内容已在仓库中，没有重复发布。草稿仍保留。' : '已提交到仓库。网站正在自动更新，草稿仍保留。';
    const result = $('publishResult'); result.hidden = false;
    const note = document.createElement('p'); note.textContent = '网页更新完成后，新日记会出现在目录中。';
    result.append(note);
    for (const [label, href] of [['查看已提交的日记 ↗', saved.fileUrl], ['查看网站更新进度 ↗', 'https://github.com/wasdwry/wasdwry.github.io/actions']]) {
      const a = document.createElement('a'); a.textContent = label; a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; result.append(a);
    }
    indexLoaded = false; searchData = null;
  } catch (error) { $('publishStatus').textContent = error.message; }
  finally { $('publishDiary').textContent = '发布日记'; connectionState(publisher.status()); }
};
$('deleteDraft').onclick = () => {
  undoDraft = snapshot(); clearTimeout(draftTimer); dirty = false;
  $('entryContent').value = ''; $('entryDate').value = localDate(); updatePublishLink();
  let success = false; try { storage.removeItem(DRAFT_KEY); success = true; } catch {}
  $('undoDraft').hidden = false;
  $('draftStatus').textContent = success ? '草稿已清空，可以撤销。' : '输入框已清空，但无法删除本机存储。';
};
$('undoDraft').onclick = () => {
  if (!undoDraft) return;
  $('entryDate').value = undoDraft.date; $('entryContent').value = undoDraft.content;
  dirty = true; flushDraft(); updatePublishLink(); $('undoDraft').hidden = true;
};
let writing = document.body.classList.contains('desk-write');
function setWriting(next) {
  writing = next; document.body.classList.toggle('desk-write', next);
  $('viewTitle').textContent = next ? '书桌前' : '日记簿';
  $('viewSubtitle').textContent = next ? '不必写得完美，留下此刻就好。' : '把平凡的日子，慢慢收进书里。';
  $('toggleCompose').textContent = next ? '翻阅日记' : '写一篇';
  $('toggleCompose').setAttribute('aria-expanded', String(next));
  if (next) $('entryContent').focus(); else { flushDraft(); ensureIndex(); }
}
$('toggleCompose').onclick = () => setWriting(!writing);

let entries = [], filtered = [], page = 1, selectedDay = '', month = new Date(), indexPromise, indexLoaded = false;
let searchData, searchPromise, searchTimer, searchGeneration = 0;
function validIndex(data) {
  return data?.version === 1 && Array.isArray(data.items) && data.items.every(item => typeof item.title === 'string' && typeof item.version === 'string' && /^diary\/.+\.md$/i.test(item.path) && !item.path.split('/').includes('..'));
}
async function ensureIndex(force = false) {
  if (indexLoaded && !force) return true;
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    notice('indexNotice', '正在翻开日记目录…');
    let data;
    try {
      data = await request('assets/diary-index.json', true);
      if (!validIndex(data)) throw new Error('Invalid index');
      put('wasdwry-diary-index-v1', data); notice('indexNotice', '');
    } catch {
      data = get('wasdwry-diary-index-v1', null);
      if (!validIndex(data)) { notice('indexNotice', '目录暂时无法加载，请检查网络后重试。', () => ensureIndex(true)); return false; }
      notice('indexNotice', '正在显示上次保存的目录，可能还没有最新日记。', () => ensureIndex(true));
    }
    entries = data.items; filtered = entries; indexLoaded = true;
    if (!selectedDay && entries.length) { selectedDay = entries[0].dateKey; month = new Date(selectedDay + 'T12:00:00'); }
    if (Number.isNaN(month.getTime())) month = new Date();
    renderCalendar(); renderList();
    if ($('contentSearch').value.trim()) search();
    return true;
  })();
  try { return await indexPromise; } finally { indexPromise = null; }
}
function entryButton(entry, excerpt = false) {
  const button = document.createElement('button'); button.className = 'entry-button';
  const title = document.createElement('strong'); title.textContent = entry.title;
  const date = document.createElement('small'); date.textContent = entry.date;
  button.append(title, date);
  if (excerpt) { const p = document.createElement('span'); p.className = 'excerpt'; p.textContent = entry.excerpt; button.append(p); }
  button.onclick = () => openEntry(entry.path);
  return button;
}
function renderCalendar() {
  const year = month.getFullYear(), number = month.getMonth();
  $('calendarTitle').textContent = year + ' 年 ' + (number + 1) + ' 月';
  const grid = $('calendarGrid'); grid.replaceChildren();
  for (const day of ['日', '一', '二', '三', '四', '五', '六']) { const node = document.createElement('span'); node.className = 'weekday'; node.textContent = day; grid.append(node); }
  for (let i = 0; i < new Date(year, number, 1).getDay(); i++) grid.append(document.createElement('span'));
  const days = new Set(entries.map(entry => entry.dateKey)), today = localDate().slice(0, 10);
  for (let day = 1; day <= new Date(year, number + 1, 0).getDate(); day++) {
    const key = year + '-' + String(number + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    const button = document.createElement('button'); button.className = 'calendar-day';
    button.textContent = day; button.classList.toggle('has-entry', days.has(key)); button.classList.toggle('today', key === today);
    button.setAttribute('aria-label', key + (days.has(key) ? '，有日记' : '，没有日记')); button.setAttribute('aria-pressed', String(selectedDay === key));
    button.onclick = () => { selectedDay = key; renderCalendar(); }; grid.append(button);
  }
  $('dayEntries').replaceChildren();
  const items = entries.filter(entry => entry.dateKey === selectedDay);
  const label = document.createElement('p'); label.className = 'muted';
  label.textContent = selectedDay ? selectedDay + (items.length ? ' · ' + items.length + ' 篇日记' : ' · 这一天没有日记') : '还没有日记。';
  $('dayEntries').append(label, ...items.map(entry => entryButton(entry)));
}
for (const [id, step] of [['prevMonth', -1], ['nextMonth', 1]]) $(id).onclick = () => {
  month = new Date(month.getFullYear(), month.getMonth() + step, 1);
  selectedDay = month.getFullYear() + '-' + String(month.getMonth() + 1).padStart(2, '0') + '-01'; renderCalendar();
};
function renderList() {
  const result = paginate(filtered, page); page = result.current;
  $('timelineCount').textContent = '· ' + filtered.length + ' 篇';
  $('entryList').replaceChildren(...result.items.map(entry => entryButton(entry, true)));
  $('pagination').hidden = result.count <= 1;
  $('pageStatus').textContent = page + ' / ' + result.count;
  $('previousPage').disabled = page === 1; $('nextPage').disabled = page === result.count;
}
for (const [id, step] of [['previousPage', -1], ['nextPage', 1]]) $(id).onclick = () => { page += step; renderList(); $('diaryList').scrollIntoView({ block: 'start' }); };
async function search() {
  const generation = ++searchGeneration, query = $('contentSearch').value.trim().toLocaleLowerCase(); page = 1;
  if (!query) { filtered = entries; $('searchStatus').textContent = ''; renderList(); return; }
  $('diaryList').open = true; $('searchStatus').textContent = '正在查找…';
  try {
    if (!searchData) {
      if (!searchPromise) searchPromise = request('assets/diary-search.json', true).then(data => {
        if (data?.version !== 1 || !Array.isArray(data.items)) throw new Error('Invalid search');
        searchData = new Map(data.items.map(item => [item.path, item.text])); return searchData;
      }).finally(() => { searchPromise = null; });
      await searchPromise;
    }
    if (generation !== searchGeneration) return;
    const words = query.split(/\s+/);
    filtered = entries.filter(entry => words.every(word => (searchData.get(entry.path) || entry.title.toLocaleLowerCase()).includes(word)));
    renderList(); $('searchStatus').textContent = filtered.length ? '找到 ' + filtered.length + ' 篇日记。' : '没有找到，试试其他关键词。';
  } catch {
    if (generation !== searchGeneration) return;
    notice('searchStatus', '搜索暂时不可用。', search);
  }
}
$('contentSearch').oninput = () => { clearTimeout(searchTimer); searchGeneration++; searchTimer = setTimeout(search, 250); };
$('clearSearch').onclick = () => { clearTimeout(searchTimer); $('contentSearch').value = ''; search(); };

// Cache a bounded set of opened entries. Unopened Markdown is never downloaded.
const bodyCache = new Map();
try { const saved = JSON.parse(cache.getItem('wasdwry-diary-bodies-v1')); if (Array.isArray(saved)) for (const [key, body] of saved.slice(-20)) if (typeof body === 'string') bodyCache.set(key, body); } catch {}
async function bodyFor(entry) {
  const key = entry.path + '@' + entry.version;
  if (bodyCache.has(key)) return bodyCache.get(key);
  const markdown = await request(entry.path.split('/').map(encodeURIComponent).join('/') + '?v=' + encodeURIComponent(entry.version));
  bodyCache.set(key, markdown);
  while (bodyCache.size > 20) bodyCache.delete(bodyCache.keys().next().value);
  try { cache.setItem('wasdwry-diary-bodies-v1', JSON.stringify([...bodyCache])); } catch {}
  return markdown;
}
function inline(node, text, base) {
  const pattern = /(!?)\[([^\]]*)\]\(([^)\s]+)\)/g; let offset = 0, match;
  while ((match = pattern.exec(text))) {
    node.append(document.createTextNode(text.slice(offset, match.index)));
    const url = safeContentUrl(match[3], base);
    if (!url) node.append(document.createTextNode(match[0]));
    else if (match[1]) { const image = document.createElement('img'); image.src = url; image.alt = match[2]; image.loading = 'lazy'; image.decoding = 'async'; node.append(image); }
    else { const a = document.createElement('a'); a.href = url; a.textContent = match[2]; a.target = '_blank'; a.rel = 'noopener noreferrer'; node.append(a); }
    offset = pattern.lastIndex;
  }
  node.append(document.createTextNode(text.slice(offset)));
}
function renderBody(body, path) {
  const container = $('readerBody'); container.replaceChildren();
  const base = new URL(path, document.baseURI).href, lines = body.split('\n');
  let paragraph = [], code = null;
  const flush = () => { if (!paragraph.length) return; const p = document.createElement('p'); inline(p, paragraph.join('\n'), base); container.append(p); paragraph = []; };
  for (const line of lines) {
    if (/^\x60{3}/.test(line)) { flush(); if (code !== null) { const pre = document.createElement('pre'); pre.textContent = code.join('\n'); container.append(pre); code = null; } else code = []; continue; }
    if (code !== null) { code.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flush(); const h = document.createElement('h' + Math.min(heading[1].length + 1, 6)); inline(h, heading[2], base); container.append(h); }
    else if (/^>\s?/.test(line)) { flush(); const block = document.createElement('blockquote'); inline(block, line.replace(/^>\s?/, ''), base); container.append(block); }
    else paragraph.push(line);
  }
  flush();
  if (code !== null) { const pre = document.createElement('pre'); pre.textContent = code.join('\n'); container.append(pre); }
}
let currentEntry = null, readerGeneration = 0, suppressCloseRoute = false, readerReady = false;
let positions = get('wasdwry-diary-positions-v1', {});
if (!positions || typeof positions !== 'object' || Array.isArray(positions)) positions = {};
function savePosition() {
  if (!currentEntry || !readerReady) return;
  positions[currentEntry.path] = { version: currentEntry.version, top: $('readerScroll').scrollTop, at: Date.now() };
  const recent = Object.entries(positions).sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0)).slice(0, 100);
  positions = Object.fromEntries(recent); put('wasdwry-diary-positions-v1', positions);
}
function progress() {
  const node = $('readerScroll'), range = node.scrollHeight - node.clientHeight;
  $('readingProgress').value = range > 0 ? Math.min(1, node.scrollTop / range) : 1;
}
let positionTimer;
$('readerScroll').onscroll = () => { progress(); clearTimeout(positionTimer); positionTimer = setTimeout(savePosition, 250); };
async function openEntry(path, sendRoute = true) {
  savePosition(); readerReady = false;
  const generation = ++readerGeneration;
  document.body.classList.add('reader-open');
  if (!$('readerModal').open) $('readerModal').showModal();
  $('readerTitle').textContent = '正在打开…'; $('readerBody').replaceChildren(); $('readerDate').textContent = '';
  $('readerScroll').scrollTop = 0; $('shareFallback').hidden = true; $('commentsMount').hidden = true; $('commentsMount').replaceChildren();
  notice('readerNotice', '');
  $('olderEntry').disabled = true; $('newerEntry').disabled = true; $('shareEntry').disabled = true;
  $('readerGithubLink').hidden = true; $('showComments').hidden = true;
  const available = await ensureIndex();
  if (generation !== readerGeneration) return;
  const entry = entries.find(item => item.path === path);
  if (!available) { $('readerTitle').textContent = '暂时无法打开日记'; notice('readerNotice', '日记目录尚未加载。', () => openEntry(path, sendRoute)); return; }
  if (!entry) { currentEntry = null; $('readerTitle').textContent = '没有找到这篇日记'; notice('readerNotice', '链接可能已变更，可以返回目录看看其他日记。'); return; }
  currentEntry = entry;
  if (sendRoute) route(entry.path);
  $('readerTitle').textContent = entry.title; $('readerDate').textContent = entry.date; $('shareEntry').disabled = false;
  const index = entries.indexOf(entry);
  for (const [id, other, label] of [['olderEntry', entries[index + 1], '← 上一篇'], ['newerEntry', entries[index - 1], '下一篇 →']]) {
    $(id).disabled = !other; $(id).textContent = other ? label + ' · ' + other.date : label;
    $(id).onclick = () => other && openEntry(other.path);
  }
  $('readerGithubLink').hidden = false; $('readerGithubLink').href = 'https://github.com/wasdwry/wasdwry.github.io/blob/main/' + entry.path;
  try {
    const markdown = await bodyFor(entry);
    if (generation !== readerGeneration) return;
    renderBody(parseDiary(markdown, entry.path).body, entry.path);
    const position = positions[entry.path];
    await new Promise(resolve => requestAnimationFrame(resolve));
    if (generation !== readerGeneration) return;
    $('readerScroll').scrollTop = position?.version === entry.version ? Number(position.top) || 0 : 0;
    readerReady = true; progress();
    const config = window.WasdwryCommentsConfig;
    $('showComments').hidden = !(config?.repoId && config?.categoryId && config?.category);
  } catch {
    if (generation !== readerGeneration) return;
    notice('readerNotice', '正文暂时无法加载，请检查网络后重试。', () => openEntry(entry.path, false));
  }
}
function closeEntry(sendRoute = true) {
  savePosition(); readerGeneration++; readerReady = false; currentEntry = null;
  document.body.classList.remove('reader-open');
  if ($('readerModal').open) { suppressCloseRoute = !sendRoute; $('readerModal').close(); }
}
$('closeReader').onclick = () => closeEntry();
$('readerModal').addEventListener('cancel', e => { e.preventDefault(); closeEntry(); });
$('readerModal').addEventListener('close', () => { if (!suppressCloseRoute) route(null); suppressCloseRoute = false; });
$('readerFontSize').value = String([16, 18, 20, 22].includes(get('wasdwry-reading-size', 18)) ? get('wasdwry-reading-size', 18) : 18);
function fontSize() { $('readerBody').style.setProperty('--reading-size', $('readerFontSize').value + 'px'); put('wasdwry-reading-size', Number($('readerFontSize').value)); progress(); }
fontSize(); $('readerFontSize').onchange = fontSize;
$('shareEntry').onclick = async () => {
  if (!currentEntry) return;
  const url = new URL(document.baseURI); url.hash = entryHash(currentEntry.path); url.search = '';
  if (await copy(url.href)) notice('readerNotice', '链接已复制，访客可以直接打开这篇日记。');
  else { notice('readerNotice', '请复制下面的日记链接。'); $('shareFallback').hidden = false; $('shareFallback').value = url.href; $('shareFallback').focus(); $('shareFallback').select(); }
};
$('showComments').onclick = () => {
  if (!currentEntry) return;
  $('commentsMount').hidden = false;
  window.WasdwryComments?.render({ mountId: 'commentsMount', term: 'diary:' + currentEntry.path });
  $('commentsMount').scrollIntoView({ block: 'start' });
};
function preserve() { flushDraft(); savePosition(); }
window.addEventListener('pagehide', preserve);
document.addEventListener('visibilitychange', () => { if (document.hidden) preserve(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('readerModal').open) { preserve(); parent.postMessage('close-desk', parentOrigin); }
});
window.WasdwryDiary = { flushDraft: preserve, openEntry: path => path ? openEntry(path, false) : closeEntry(false) };
setWriting(writing);
const initial = document.body.dataset.initialEntry;
if (initial && initial !== '__INITIAL_ENTRY__') { try { setWriting(false); openEntry(decodeURIComponent(initial), false); } catch {} }
