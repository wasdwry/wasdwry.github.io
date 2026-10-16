# 日记目录

网站读取 assets/diary-index.json，点开某篇日记时才读取对应 Markdown。全文检索文件 assets/diary-search.json 只在搜索时下载。

在 GitHub 添加、修改或删除 diary/ 中的 Markdown 后，Update diary index 工作流会重建两个文件，再请求 GitHub Pages 发布。日记正文不被改写。工作流失败时可在 Actions 中重试。

本地维护：

    node --test tests/diary-core.test.mjs
    node scripts/build-diary-index.mjs

日记正文及搜索索引均公开。未来增加私密日记时，应通过受保护的服务存储和读取，不可放进此公开目录。

草稿、字号和阅读位置保存在当前浏览器。草稿可导出为 Markdown，不跨设备同步。

## 直接发布

书桌提供“发布日记”。作者自行在 GitHub 创建 Fine-grained personal access token，仅选择 wasdwry.github.io 仓库，授予 Contents: Read and write，设置有限的有效期，然后在书桌的“连接 GitHub”中输入。

令牌仅在主页面内存中保存，直接发送到 api.github.com；不会写入源码、浏览器存储、草稿或日志。关闭书桌后本次连接仍可用，刷新或关闭网站后需重新连接。令牌权限由 GitHub 限定到仓库，无法限定到单个文件夹；网站发布器自身只新增 diary/ 中的文件，并校验作者账号。不要创建 classic token 或给其他仓库授权。

发布请求只创建文件，不传入覆盖文件所需的 SHA。文件名含正文摘要，同一份日期和内容重试不会新增重复日记；网络中断时会核对仓库内容。提交成功与 Pages 发布完成分别提示。验证真实发布需要作者在自己浏览器中连接令牌，不要把令牌发送到聊天中。

测试：

    node --test tests/diary-core.test.mjs tests/diary-publish.test.mjs
