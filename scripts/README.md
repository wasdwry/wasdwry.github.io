# 日记目录

网站读取 assets/diary-index.json，点开某篇日记时才读取对应 Markdown。全文检索文件 assets/diary-search.json 只在搜索时下载。

在 GitHub 添加、修改或删除 diary/ 中的 Markdown 后，Update diary index 工作流会重建两个文件，再请求 GitHub Pages 发布。日记正文不被改写。工作流失败时可在 Actions 中重试。

本地维护：

    node --test tests/diary-core.test.mjs
    node scripts/build-diary-index.mjs

日记正文及搜索索引均公开。未来增加私密日记时，应通过受保护的服务存储和读取，不可放进此公开目录。

草稿、字号和阅读位置保存在当前浏览器。草稿可导出为 Markdown，不跨设备同步；网站没有增加写入 GitHub 的凭据。
