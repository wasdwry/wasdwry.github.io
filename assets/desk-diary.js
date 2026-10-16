export default `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>山海小屋 · 日记簿</title><link rel="stylesheet" href="assets/diary.css?v=20261016-publish1"></head>
<body class="desk-__DESK_MODE__" data-initial-entry="__INITIAL_ENTRY__">
<main class="page">
 <header class="page-header"><div><h1 id="viewTitle">日记簿</h1><p id="viewSubtitle" class="muted">把平凡的日子，慢慢收进书里。</p></div><button id="toggleCompose" aria-controls="compose" aria-expanded="false">写一篇</button></header>
 <div id="indexNotice" class="notice browse-only" role="status" hidden></div>
 <section class="card browse-only" aria-label="日记日历">
  <div class="calendar-head"><button id="prevMonth" aria-label="上个月">‹</button><h2 id="calendarTitle"></h2><button id="nextMonth" aria-label="下个月">›</button></div>
  <div id="calendarGrid" class="calendar-grid"></div><div id="dayEntries" class="day-entries" aria-live="polite"></div>
 </section>
 <section class="card browse-only" aria-label="查找日记">
  <label class="visually-hidden" for="contentSearch">搜索标题或正文</label><div class="search-row"><input id="contentSearch" type="search" placeholder="搜索标题或正文…" autocomplete="off"><button id="clearSearch">清除</button></div>
  <p id="searchStatus" class="status" role="status"></p>
  <details id="diaryList" class="timeline"><summary>日记时间线 <span id="timelineCount" class="muted"></span></summary><div id="entryList" class="entry-list"></div><div id="pagination" class="pagination"><button id="previousPage">上一页</button><span id="pageStatus"></span><button id="nextPage">下一页</button></div></details>
 </section>
 <section id="compose" class="card compose-panel" aria-label="写日记">
  <h2>写下今天</h2><form id="entryForm">
   <label class="field"><span>日期与时间</span><input id="entryDate" type="datetime-local" required></label>
   <label class="field"><span>正文</span><textarea id="entryContent" placeholder="今天，有什么想留下的？"></textarea></label>
   <p id="draftStatus" class="status" role="status"></p>
   <div class="actions"><button type="button" id="publishDiary" class="primary">发布日记</button><button type="button" id="downloadDraft">导出 Markdown</button><button type="button" id="copyMarkdown">复制正文</button></div>
   <p id="publishStatus" class="status" role="status"></p><div id="publishResult" class="publish-result" hidden></div>
   <p class="draft-note">发布后访客可公开阅读。提交会新增一篇日记，不会覆盖已有内容；草稿仍留在这台设备上。</p>
   <details id="publishSettings" class="publish-settings"><summary>连接 GitHub · 仅站点作者</summary>
    <p id="connectionStatus" class="status" role="status">尚未连接。连接后可直接发布，无需复制正文。</p>
    <div id="connectionForm">
     <p class="draft-note">首次使用：<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">创建 Fine-grained token ↗</a>，仅选择 wasdwry.github.io 仓库，将 Contents 设为 Read and write，并设置有效期。</p>
     <label class="field"><span>GitHub 专用令牌</span><input id="githubToken" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…" aria-describedby="tokenNotice"></label>
     <p id="tokenNotice" class="draft-note">令牌只发送给 GitHub，并仅在当前页面内存中保留。刷新或关闭网站后需重新连接，请勿把令牌写入日记。</p>
     <button type="button" id="connectGithub">连接 GitHub</button>
    </div>
    <button type="button" id="disconnectGithub" hidden>断开连接</button>
   </details>
   <p class="draft-note">也可以<a id="createLink" href="https://github.com/wasdwry/wasdwry.github.io/new/main/diary" target="_blank" rel="noopener noreferrer">前往 GitHub 手动发布 ↗</a>。</p>
   <div class="actions"><button type="button" id="deleteDraft">清空草稿</button><button type="button" id="undoDraft" hidden>撤销清空</button></div><p id="draftActionStatus" class="status" role="status"></p>
  </form>
 </section>
</main>
<dialog id="readerModal" class="reader" aria-labelledby="readerTitle">
 <div class="reader-toolbar"><div class="reader-controls"><label for="readerFontSize" class="visually-hidden">阅读字号</label><select id="readerFontSize" aria-label="阅读字号"><option value="16">小字</option><option value="18" selected>标准</option><option value="20">大字</option><option value="22">特大</option></select><button id="shareEntry">分享</button></div><button id="closeReader" aria-label="返回日记目录">返回目录</button></div>
 <progress id="readingProgress" class="reading-progress" value="0" max="1" aria-label="阅读进度"></progress>
 <div id="readerScroll" class="reader-scroll" tabindex="0">
  <div id="readerNotice" class="notice" role="status" hidden></div><input id="shareFallback" class="share-fallback" aria-label="日记分享链接，请复制" readonly hidden>
  <article><h1 id="readerTitle"></h1><p id="readerDate" class="muted"></p><div id="readerBody" class="reader-body"></div></article>
  <nav class="reader-navigation" aria-label="翻阅日记"><button id="olderEntry">← 上一篇</button><button id="newerEntry">下一篇 →</button></nav>
  <footer class="reader-footer"><button id="showComments" hidden>留言</button><a id="readerGithubLink" target="_blank" rel="noopener noreferrer">在 GitHub 查看 ↗</a></footer><div id="commentsMount" hidden></div>
 </div>
</dialog>
<script src="assets/comments-config.js" defer></script><script src="assets/comments.js" defer></script><script type="module" src="assets/diary-app.js?v=20261016-publish1"></script>
</body></html>`;
