# 网站音乐

把您有权公开播放的音频上传到这个文件夹，网站就会自动收录，无需手动编辑歌单。

## 在 GitHub 上传

1. 打开 [音频上传页面](https://github.com/wasdwry/wasdwry.github.io/upload/main/assets/music)。
2. 拖入音频文件，然后点击 **Commit changes**，提交到 `main` 分支。
3. 等待 Actions 中 **Update diary and music indexes** 以及后续 **pages build and deployment** 成功。
4. 重新打开或刷新网站，点击右上角留声机，再打开“列表”，即可选择播放。

上传不会立刻出现在已打开的网页里，需要先完成自动发布。若处理失败，可在 Actions 中查看原因并重试。

- 自动识别 MP3、OGG、WAV、M4A、AAC、FLAC、OPUS，支持子文件夹及大写扩展名；推荐兼容性较好的 MP3。
- 文件名（去掉扩展名）就是曲名，支持中文和空格。例如 `海边的午后.mp3` 会显示为“海边的午后”。
- 新增、删除、改名都会同步到歌单；覆盖同名文件也会更新音频缓存地址。
- `playlist.json` 是自动生成的文件，不要手工编辑，后续更新会覆盖它。
- 文件在公开仓库及网站中公开可访问。不要上传私密录音或无权公开播放的音乐。
- GitHub 网页上传的单文件上限为 25 MiB。建议保留规模适中的压缩音频歌单。
- 浏览器是否能播放取决于音频的实际编码，扩展名被识别不代表所有设备均支持。

## 网页里的“添加本地音乐”

这个按钮仍然只把文件保存在当前浏览器，不会上传到仓库，也不会分享给访客。“添加 URL”同样是个人浏览器歌单。

## 本地维护

在仓库根目录运行：

```sh
node scripts/build-music-playlist.mjs
node --test tests/music-playlist.test.mjs
```

网站从同站点读取自动生成的歌单，访客不需要 GitHub 登录或 API 令牌。打开网页会重新验证歌单缓存；音频等到点击播放时才加载。
