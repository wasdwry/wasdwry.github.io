import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as core from '../assets/diary-core.mjs';

// Exercise the actual composer handlers with a controllable clock and deferred publisher.
const source = readFileSync(new URL('../assets/diary-app.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/, '');
function composer(draft = null, time = '2026-10-26T09:10:00') {
  let clock = new Date(time).getTime(), timerId = 0, pending;
  const nodes = new Map(), timers = new Map(), intervals = new Map(), windowEvents = new Map(), documentEvents = new Map();
  const saved = new Map(draft ? [[core.DRAFT_KEY, JSON.stringify(draft)]] : []);
  const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
  const document = { baseURI: 'https://example.test/', hidden: false, activeElement: null,
    getElementById: id => {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
    createElement: () => element(), createTextNode: text => ({ textContent: text }),
    addEventListener(type, listener) { documentEvents.set(type, listener); }
  };
  function element() {
    const classes = new Set(), events = new Map();
    return { value: '', hidden: false, textContent: '', children: [], dataset: {}, style: { setProperty() {} },
      classList: { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name),
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } },
      addEventListener(type, listener) { events.set(type, listener); },
      emit(type) { events.get(type)?.({ target: this }); },
      setAttribute() {}, replaceChildren(...children) { this.children = children; }, append(...children) { this.children.push(...children); },
      focus() { document.activeElement = this; this.emit('focus'); }, reportValidity() { return Boolean(this.value); }
    };
  }
  document.body = element(); document.body.classList.add('desk-write');
  const publisher = { status: () => ({ mode: 'server', connected: true, login: 'wasdwry', busy: false }), subscribe: () => () => {},
    publish(date, content) { return new Promise((resolve, reject) => { pending = { date, content, resolve, reject }; }); } };
  const window = { localStorage: storage, sessionStorage: storage,
    addEventListener(type, listener) { const listeners = windowEvents.get(type) || []; listeners.push(listener); windowEvents.set(type, listeners); } };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const context = { ...core, Date: Clock, document, window, parent: { WasdwryDiaryPublisher: publisher, postMessage() {} }, URL, Blob,
    setTimeout(fn) { timers.set(++timerId, fn); return timerId; }, clearTimeout(id) { timers.delete(id); },
    setInterval(fn) { intervals.set(++timerId, fn); return timerId; }, clearInterval(id) { intervals.delete(id); },
    fetch() { throw new Error('The writing tests must not fetch or publish real content'); }
  };
  vm.runInNewContext(source, context);
  const node = id => document.getElementById(id);
  return { node, saved, storage, publisher,
    get pending() { return pending; },
    advance(minutes) { clock += minutes * 60000; },
    input(id, value) { const target = node(id); target.emit('beforeinput'); target.value = value; target.emit('input'); },
    flushTimers() { const tasks = [...timers.values()]; timers.clear(); tasks.forEach(fn => fn()); },
    tick() { intervals.forEach(fn => fn()); },
    focusWindow() { windowEvents.get('focus')?.forEach(fn => fn()); },
    show() { document.hidden = false; documentEvents.get('visibilitychange')?.(); },
    preserve() { window.WasdwryDiary.flushDraft(); },
    success(alreadyPublished = false) { pending.resolve({ alreadyPublished, fileUrl: 'https://github.com/wasdwry/wasdwry.github.io/blob/main/diary/example.md' }); }
  };
}

test('empty and whitespace-only restored drafts get today; text drafts keep their original date', () => {
  for (const content of ['', ' \n\t']) {
    const f = composer({ date: '2026-10-16T12:00', content });
    assert.equal(f.node('entryDate').value, '2026-10-26T09:10');
    f.advance(24 * 60); f.focusWindow();
    assert.equal(f.node('entryDate').value, '2026-10-27T09:10');
  }
  const f = composer({ date: '2026-10-16T12:00', content: '未完成的日记' });
  f.advance(24 * 60); f.focusWindow(); f.tick(); f.show();
  assert.equal(f.node('entryDate').value, '2026-10-16T12:00');
  assert.equal(f.node('entryContent').value, '未完成的日记');
});

test('first typing after midnight takes the new date, then freezes it until the text is cleared', () => {
  const f = composer(null, '2026-10-26T23:59:00');
  f.advance(2); f.input('entryContent', '新的一天'); f.flushTimers();
  assert.equal(f.node('entryDate').value, '2026-10-27T00:01');
  f.advance(60); f.tick(); f.input('entryContent', '新的一天，继续写');
  assert.equal(f.node('entryDate').value, '2026-10-27T00:01');
  f.input('entryDate', '2026-09-01T08:00'); f.tick();
  assert.equal(f.node('entryDate').value, '2026-09-01T08:00', 'a nonempty diary may still be backdated manually');
  f.input('entryContent', ''); f.flushTimers();
  assert.equal(f.node('entryDate').value, '2026-10-27T01:01');
  assert.equal(JSON.parse(f.saved.get(core.DRAFT_KEY)).content, '');
});

test('confirmed publication and confirmed retry both clear the draft, undo state and pending autosave', async () => {
  for (const alreadyPublished of [false, true]) {
    const f = composer({ date: '2026-10-16T12:00', content: '旧草稿' });
    f.node('deleteDraft').onclick(); f.node('undoDraft').onclick();
    f.input('entryContent', '待发布的正文');
    const pending = f.node('publishDiary').onclick();
    assert.equal(f.pending.content, '待发布的正文');
    assert.equal(f.node('entryContent').value, '待发布的正文');
    f.advance(3); f.success(alreadyPublished); await pending;
    assert.equal(f.node('entryContent').value, '');
    assert.equal(f.node('entryDate').value, '2026-10-26T09:13');
    assert.equal(f.saved.has(core.DRAFT_KEY), false);
    assert.equal(f.node('undoDraft').hidden, true);
    f.node('undoDraft').onclick(); f.flushTimers(); f.preserve();
    assert.equal(f.node('entryContent').value, '');
    assert.equal(f.saved.has(core.DRAFT_KEY), false, 'a stale timer must not restore the published diary');
    assert.match(f.node('publishStatus').textContent, /草稿已清空，日期已更新/);
  }
});

test('failed or unconfirmed publication preserves the exact date and content for retry', async () => {
  const draft = { date: '2026-10-24T21:14', content: '不能丢失的正文' };
  const f = composer(draft);
  const pending = f.node('publishDiary').onclick();
  f.advance(3); f.pending.reject(new Error('网络中断，尚未确认提交')); await pending;
  assert.equal(f.node('entryDate').value, draft.date);
  assert.equal(f.node('entryContent').value, draft.content);
  assert.deepEqual(JSON.parse(f.saved.get(core.DRAFT_KEY)), draft);
  assert.match(f.node('publishStatus').textContent, /尚未确认提交/);
});

test('edits made during publication and drafts saved by another tab are not discarded', async () => {
  const draft = { date: '2026-10-24T21:14', content: '正在发布的正文' };
  const f = composer(draft), pending = f.node('publishDiary').onclick();
  f.input('entryContent', '等待期间补写的内容'); f.success(); await pending;
  assert.equal(f.node('entryContent').value, '等待期间补写的内容');
  assert.equal(JSON.parse(f.saved.get(core.DRAFT_KEY)).content, '等待期间补写的内容');
  assert.match(f.node('publishStatus').textContent, /修改的草稿仍保留/);
  const other = composer(draft), otherPending = other.node('publishDiary').onclick();
  const nextDraft = { date: '2026-10-26T09:12', content: '另一个窗口的新草稿' };
  other.storage.setItem(core.DRAFT_KEY, JSON.stringify(nextDraft));
  other.success(); await otherPending; other.preserve();
  assert.deepEqual(JSON.parse(other.saved.get(core.DRAFT_KEY)), nextDraft);
  assert.equal(other.node('entryContent').value, '');
});

test('storage cleanup failures are reported without pretending the persisted draft was deleted', async () => {
  const f = composer({ date: '2026-10-24T21:14', content: '已发布正文' });
  const pending = f.node('publishDiary').onclick();
  f.storage.removeItem = () => { throw Error('storage unavailable'); };
  f.storage.setItem = () => { throw Error('storage unavailable'); };
  f.success(); await pending;
  assert.equal(f.node('entryContent').value, '');
  assert.equal(f.saved.has(core.DRAFT_KEY), true);
  assert.match(f.node('publishStatus').textContent, /本机草稿清理失败/);
});
