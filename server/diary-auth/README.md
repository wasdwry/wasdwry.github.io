# 日记持久登录后台

网站仍由 GitHub Pages 托管。这个独立的 Cloudflare Worker 负责作者登录与日记提交，D1 只保存登录会话和短期登录校验信息。日记仍写入 `wasdwry/wasdwry.github.io` 的 `main` 分支。

**当前启用状态**：查看仓库中的 `assets/publishing-config.mjs`。`backendOrigin` 为空时仍使用原来的临时令牌连接；只有完成以下配置、验证成功并填入真实地址后，网站才启用后台登录。提交这些代码本身不会创建 Cloudflare 服务。

## 登录后的使用方式

- 第一次在书桌点击“用 GitHub 登录”，在弹出窗口中授权作者账号 `wasdwry`。
- 本机登录最多保存 30 天。刷新、关闭网页后，直接点击“发布日记”，窗口会恢复已有登录并提交，不需要重新粘贴令牌。
- 点击“退出这台设备的登录”立即撤销当前会话。其他设备的登录不受影响。
- 清除 Cookie、使用隐私窗口、更换浏览器或登录到期后需要重新登录。部分浏览器在 GitHub 授权后会切断窗口联系；页面会提示返回书桌再点一次发布。
- 页面关闭后不会自行发布尚未提交的草稿。每篇日记仍需要作者点击发布；本机草稿始终保留。

## 一次性配置

建议使用独立名称 `wasdwry-diary-auth`。不要覆盖现有的 `subscription-manager`、`cfnew-terminal`，也无需修改 `wasdwry.dpdns.org` 的绑定。

以下命令在仓库的 `server/diary-auth` 目录执行，需要 Node.js 22 或更新版本。所有 `npx wrangler` 命令使用本目录锁定的 Cloudflare 官方工具。

### 1. 登录 Cloudflare 并创建 D1

```powershell
npm ci
npx wrangler login
npx wrangler d1 create wasdwry-diary-sessions
Copy-Item wrangler.example.jsonc wrangler.local.jsonc
```

在 `wrangler.local.jsonc` 的 `database_id` 填入返回的数据库 ID。这个文件已被 Git 忽略。Cloudflare 的 Workers & Pages 页面可以查看自己账户的 `workers.dev` 子域名。

将 `PUBLIC_ORIGIN` 改成将要部署的真实来源地址，例如 `https://wasdwry-diary-auth.<你的子域名>.workers.dev`，结尾不带 `/`。不要直接照抄占位符。

```powershell
npx wrangler d1 execute wasdwry-diary-sessions --remote --file schema.sql --config wrangler.local.jsonc
npm run deploy
```

首次部署时授权配置尚未齐全，`/health` 返回 `ready: false` 属正常情况，发布接口会拒绝操作。

### 2. 创建仅供自己的 GitHub App

打开 [GitHub App 创建页](https://github.com/settings/apps/new)，填写：

| 项目 | 填写内容 |
| --- | --- |
| GitHub App name | 一个未被占用的名称，如 `wasdwry-diary-writer` |
| Homepage URL | `https://wasdwry.github.io` |
| Callback URL | 真实后台地址加 `/auth/callback` |
| Expire user authorization tokens | 保持启用 |
| Webhook / Active | 取消选中；本服务不接收 Webhook |
| Repository permissions → Contents | `Read and write` |
| Repository permissions → Metadata | 保留自动附带的读取权限 |
| 其他权限 | 不添加 |
| Where can this GitHub App be installed? | `Only on this account` |

创建后，在应用的 **Install App** 页面安装到自己的账号，选择 **Only select repositories**，仅勾选 `wasdwry.github.io`。

将应用设置页的 **Client ID** 填入 `GITHUB_CLIENT_ID`（不是 App ID）。从安装详情页地址 `/settings/installations/数字` 中取得安装 ID，填入 `GITHUB_INSTALLATION_ID`。

在应用设置页进入 **Credentials → Client secrets → New secret**，生成后立即复制完整 Client secret；列表中的星号和尾号不能用于配置。如果没有保存完整值，需要重新生成。再到 **Credentials → Key pairs → New key** 下载私钥。这些是秘密，只放入 Cloudflare Secrets，不要写入代码、仓库变量、日记或聊天。下载的 `.pem` 文件留在本机安全位置，已有对应私钥文件时无需重复生成。

### 3. 把两个秘密交给后台

在 Cloudflare 控制台进入新建的 `wasdwry-diary-auth` → Settings → Runtime variables and secrets → Add variable。将名称填入 **Key**、完整内容填入 **Value**，勾选 **Secret** 后保存并部署。需要以下两项：

| Secret 名称 | 内容 |
| --- | --- |
| `GITHUB_CLIENT_SECRET` | GitHub App 的 Client secret |
| `GITHUB_APP_PRIVATE_KEY` | `.pem` 文件的完整内容，包括 BEGIN/END 行 |

也可以通过官方命令行设置。Client secret 在提示中输入；私钥通过文件传入，不写进命令参数或仓库：

```powershell
npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.local.jsonc
Get-Content -Raw -LiteralPath 'C:\安全位置\你的应用私钥.pem' | npx wrangler secret put GITHUB_APP_PRIVATE_KEY --config wrangler.local.jsonc
npm run deploy
```

再次打开真实后台的 `/health`，应返回 `{"ready":true}`。这只说明配置齐全，仍需下一步实际登录验证权限。

### 4. 开启网站入口并验证

把 `assets/publishing-config.mjs` 中 `backendOrigin` 的空字符串改成真实后台来源地址，提交到 GitHub。同时更新 `assets/house.js` 对该配置的版本参数，以及 `index.html` 的 house 版本参数，避免旧缓存。

先登录验证，不必为了测试发布虚构日记：

1. 打开网站 → 小屋 → 书房 → 书桌 → 连接 GitHub → 用 GitHub 登录。
2. 在 GitHub 确认仅授予上述应用权限，完成后应显示已登录 `wasdwry`。
3. 关闭网站并重新打开，再点击登录，应直接恢复身份，无需再次输入令牌。
4. 发布一篇自己确实想公开的日记，确认仓库新增 Markdown，网站目录随后更新；同一内容重试不会重复发布。
5. 退出登录后，再进入应重新要求登录。浏览器可以复用 GitHub 自身的登录，但本站会话已撤销。

若后台故障，把 `backendOrigin` 暂时改回空字符串并更新版本参数，即可恢复原来的临时令牌连接。

## 安全和维护边界

- 浏览器只持有 `Secure`、`HttpOnly`、`SameSite=Lax` 的会话 Cookie。D1 保存 Cookie 的散列值，不保存 GitHub 凭据、日记正文或原始会话 ID。
- GitHub App 私钥及 Client secret 保存在 Worker Secrets。登录时的 OAuth token 只用于验证身份；发布使用限制到本站仓库、只授予 Contents 写入的短期安装令牌，过期后后台自动重新取得。
- 后台只接受固定作者 ID `73155150` 和账号 `wasdwry`。发布接口只能新增 `diary/` 下的 Markdown，不支持任意仓库、路径、覆盖或删除。
- GitHub App 的仓库级 Contents 权限本身不能限制到 `diary/` 目录；目录限制由本服务实现。因此仍需保护 Cloudflare 账户和应用私钥。
- OAuth 校验包含浏览器 Cookie、一次性 state 和 PKCE；写入要求同源请求与 CSRF 校验。跨窗口通信严格验证来源、窗口和随机编号。
- 每日清理过期会话。若需撤销所有设备，可在 D1 控制台执行 `DELETE FROM sessions;`；若需停止全部仓库写入，在 GitHub 卸载该应用。GitHub 取消用户 OAuth 授权不等于删除本服务已建立的会话，应同时退出或清除 D1 会话。
- 不开启请求正文日志。当前 Worker 的可观测日志默认关闭，代码不记录密钥或授权码。密钥文件、`.dev.vars`、本地配置、依赖和构建缓存已被 Git 忽略。
- 不自动购买套餐。部署前可在 Cloudflare 控制台确认账户套餐；流量、数据库操作和存储仍受当前配额约束。

## 本地验证

在仓库根目录运行 `node --test tests/*.test.mjs`，覆盖登录有效期、退出、身份限制、状态重放、CSRF、窗口来源校验、密钥格式、重复提交和不确定写入结果。

在本目录执行 `npm ci`、`npm run check`，检查 Cloudflare 打包。测试使用内存 SQLite 和模拟 GitHub 请求，不会向真实仓库写测试日记。最终仍需在自己的账户中完成真实 OAuth 与发布验证。

参考：[GitHub App 用户授权](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app)、[GitHub App 安装令牌](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)、[Cloudflare Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[D1](https://developers.cloudflare.com/d1/)。
