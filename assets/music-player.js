import { validateMusicFile, MUSIC_EXTENSIONS } from './music-upload.mjs';

(function(){
    if(new URLSearchParams(location.search).has("desk")&&window.parent!==window)return;
    const userListKey = "wasdwry-music-user-list";
    const dbName = "wasdwry-music-library";
    const storeName = "files";
    const supportedAudio = ["mp3","ogg","wav","m4a","aac","flac","opus"];

    const style = document.createElement("style");
    style.textContent = `
        .music-player{position:fixed;left:18px;bottom:18px;z-index:21;width:min(390px,calc(100vw - 96px));padding:12px;border:1px solid rgba(31,41,51,.14);border-radius:8px;background:rgba(255,255,255,.94);box-shadow:0 12px 28px rgba(31,41,51,.18);color:#1f2933;backdrop-filter:blur(10px);font-family:Arial,"Microsoft YaHei",sans-serif;transition:transform .22s ease,opacity .22s ease}
        .music-player.is-collapsed{transform:translateX(calc(-100% + 6px))}
        .music-shell{opacity:1;transition:opacity .18s ease}.music-player.is-collapsed .music-shell{opacity:0;pointer-events:none}
        .music-toggle{position:absolute;right:-44px;top:12px;width:38px;min-width:38px;min-height:42px;border:1px solid rgba(22,50,77,.2);border-radius:0 8px 8px 0;background:#16324d;color:white;box-shadow:0 10px 24px rgba(31,41,51,.2)}
        .music-title{margin:0 0 8px;color:#34495e;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .music-controls{display:grid;grid-template-columns:auto auto auto auto 1fr;gap:8px;align-items:center}
        .music-player button{min-width:34px;min-height:32px;border:1px solid rgba(22,50,77,.2);border-radius:8px;background:white;color:#16324d;cursor:pointer;font-weight:700}
        .music-player button:disabled,.music-player input:disabled{opacity:.45;cursor:not-allowed}
        .music-player input[type="range"],.music-player input[type="url"]{width:100%}
        .music-volume{display:flex;gap:6px;align-items:center;margin-top:8px;color:#607084;font-size:12px}
        .music-volume span{white-space:nowrap}
        .music-status{margin:8px 0 0;color:#607084;font-size:12px;line-height:1.5}
        .music-panel{display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(31,41,51,.12)}
        .music-panel.open{display:block}
        .music-add-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0}
        .music-add-row input[type="url"]{min-height:34px;border:1px solid rgba(31,41,51,.14);border-radius:8px;padding:0 10px;font:inherit}
        .music-upload{margin-top:12px;padding-top:10px;border-top:1px solid #d9c69c}
        .music-upload input[type="file"]{display:block;max-width:100%;margin:10px 0;font:inherit;font-size:12px}
        .music-upload input::file-selector-button{border:1px solid #d9c69c;border-radius:8px;background:#fff9ed;padding:8px;color:#493d31;cursor:pointer}
        .music-library-tools{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px}
        .music-upload a{display:inline-block;font-size:12px;margin-top:6px;color:#48633e}
        .music-upload [hidden]{display:none!important}
        .music-list{display:grid;gap:8px;max-height:220px;overflow:auto;margin-top:8px}
        .music-list-item{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(31,41,51,.12);border-radius:8px;background:#fbfdff}
        .music-list-item.active{border-color:#1769aa;background:#f0f7ff}
        .music-list-title{min-width:0;color:#34495e;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .music-embed{display:none;margin-top:10px;border-radius:8px;overflow:hidden;background:#102033}
        .music-embed.show{display:block}
        .music-embed iframe{width:100%;height:96px;border:0;display:block}
        @media(max-width:680px){.music-player{left:12px;bottom:68px;width:calc(100vw - 72px)}.music-player.is-collapsed{transform:translateX(calc(-100% + 6px))}.music-toggle{right:-40px}.music-controls{grid-template-columns:auto auto auto auto}.music-controls input[data-action="seek"]{grid-column:1/-1}.music-list-item{grid-template-columns:1fr auto}}

        .music-player{left:auto;bottom:auto;right:max(18px,env(safe-area-inset-right));top:max(78px,calc(env(safe-area-inset-top) + 66px));width:min(390px,calc(100vw - 28px));z-index:40;padding:0;border:0;box-shadow:none;background:transparent;backdrop-filter:none;transition:none}
        .music-player.is-collapsed{transform:none}.music-shell{padding:15px;border:1px solid #d9c69c;border-radius:14px;background:#fff9edee;backdrop-filter:blur(14px);box-shadow:0 12px 40px #18232c40;max-height:calc(100dvh - 100px);overflow:auto}.music-player.is-collapsed .music-shell{visibility:hidden;opacity:0;pointer-events:none}
        .music-player .music-toggle{position:fixed;right:max(18px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));width:52px;height:52px;padding:3px;min-width:52px;border:1px solid #f1dcac66;border-radius:50%;background:#302b24bd;box-shadow:0 4px 18px #111b2930;backdrop-filter:blur(8px);color:#f2d89e;overflow:visible}
        .music-toggle svg{display:block;width:44px;height:44px;pointer-events:none}.music-toggle .music-notes{opacity:0}.music-player.is-playing .music-toggle{border-color:#ffdc89;box-shadow:0 0 18px #f9c76366}.music-player.is-playing .music-notes{opacity:1;animation:musicFloat 1.7s ease-in-out infinite alternate}.music-player.is-playing .gramophone-disc{animation:recordGlow 1s linear infinite alternate}.music-toggle:focus-visible{outline:3px solid #ffe4a1;outline-offset:4px}@keyframes musicFloat{to{transform:translateY(-3px)}}@keyframes recordGlow{to{filter:brightness(1.6)}}
        body:not([data-immersive]) .navbar{padding-right:65px}@media(max-width:680px){.music-player{left:auto;right:12px;bottom:auto;top:74px;width:calc(100vw - 24px)}.music-player.is-collapsed{transform:none}.music-player .music-toggle{right:12px;top:12px}}@media(prefers-reduced-motion:reduce){.music-player *{animation:none!important;transition:none!important}}
    `;
    document.head.appendChild(style);

    const root = document.createElement("aside");
    root.className = "music-player is-collapsed";
    root.innerHTML = `
        <button class="music-toggle" type="button" data-action="toggle" aria-label="打开留声机（未播放）" aria-expanded="false" aria-controls="musicShell" title="留声机"><svg viewBox="0 0 64 64" aria-hidden="true"><path d="M31 36V26Q27 19 31 14" fill="none" stroke="#bd8a49" stroke-width="4"/><path d="M29 14Q43 16 50 5L57 28Q42 25 33 28Z" fill="#d4aa62" stroke="#78522b" stroke-width="2"/><ellipse cx="53" cy="16" rx="5" ry="12" transform="rotate(-17 53 16)" fill="#60452e" stroke="#f1d398" stroke-width="2"/><path d="M11 40L44 37L54 44L20 49Z" fill="#bd834d"/><path d="M11 40V53L20 59L54 53V44L20 49Z" fill="#784d33" stroke="#dfb67a" stroke-width="1.5"/><g class="gramophone-disc"><ellipse cx="31" cy="41" rx="14" ry="4" fill="#2b3439" stroke="#dab776"/><path d="M22 40L40 42" stroke="#607477"/><ellipse cx="31" cy="41" rx="3" ry="1.5" fill="#edc57f"/></g><path d="M46 33L46 40L36 43" fill="none" stroke="#edcb85" stroke-width="2"/><path class="music-notes" d="M12 13v12m0-10l9-3v10m-9 3c-5-2-7 5-2 4 3 0 3-2 2-4m9-3c-5-2-7 5-2 4 3 0 3-2 2-4" fill="none" stroke="#ffe1a0" stroke-width="2"/></svg></button>
        <div class="music-shell" id="musicShell" inert>
            <p class="music-title">音乐播放器：正在读取播放列表...</p>
            <div class="music-controls">
                <button type="button" data-action="prev">‹</button>
                <button type="button" data-action="play">▶</button>
                <button type="button" data-action="next">›</button>
                <button type="button" data-action="panel">列表</button>
                <input type="range" data-action="seek" min="0" max="100" value="0" step="1" aria-label="播放进度">
            </div>
            <div class="music-volume">
                <span>音量</span>
                <input type="range" data-action="volume" min="0" max="1" value="0.7" step="0.01" aria-label="音量">
            </div>
            <div class="music-embed" id="musicEmbed"></div>
            <p class="music-status" id="musicStatus"></p>
            <div class="music-panel" id="musicPanel">
                <div class="music-library-tools"><strong>音乐列表</strong><button type="button" data-action="refresh">刷新歌单</button></div>
                <div class="music-list" id="musicList"></div>
                <div class="music-upload" id="musicUpload">
                    <strong>上传音乐</strong>
                    <p class="music-status">仅作者可上传，每首最多 10 MiB。上传的音频会公开给所有访客播放。</p>
                    <input id="musicFileInput" type="file" accept="${MUSIC_EXTENSIONS.map(ext => '.' + ext).join(',')}" aria-label="选择要上传的音频">
                    <button type="button" data-action="upload" disabled>上传并公开</button>
                    <p class="music-status" id="musicUploadStatus" role="status">沿用日记的 GitHub 登录；尚未登录时会提示登录。</p>
                    <a id="musicUploadResult" target="_blank" rel="noopener noreferrer" hidden>查看仓库中的音频</a>
                </div>
                <p class="music-status">添加网址仅保存在当前浏览器。</p>
                <div class="music-add-row">
                    <input id="musicUrlInput" type="url" placeholder="粘贴音频、YouTube、Vimeo、Spotify 或网易云链接">
                    <button type="button" data-action="add-url">添加 URL</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const audio = new Audio();
    audio.preload = "none";
    audio.volume = 0.7;
    let defaultTracks = [];
    let userTracks = [];
    let playlist = [];
    let current = 0;
    let objectUrls = new Map();
    let activeMode = "audio";
    let youtubeApiReady = null;
    let vimeoApiReady = null;
    let embedPlayer = null;
    let embedPlaying = false;
    let uploadFile = null, uploading = false, uploadPoll = null, uploadGeneration = 0;

    const title = root.querySelector(".music-title");
    const toggleButton = root.querySelector('[data-action="toggle"]');
    const playButton = root.querySelector('[data-action="play"]');
    const seek = root.querySelector('[data-action="seek"]');
    const volume = root.querySelector('[data-action="volume"]');
    const panel = root.querySelector("#musicPanel");
    const list = root.querySelector("#musicList");
    const statusText = root.querySelector("#musicStatus");
    const urlInput = root.querySelector("#musicUrlInput");
    const fileInput = root.querySelector("#musicFileInput");
    const uploadButton = root.querySelector('[data-action="upload"]');
    const uploadStatus = root.querySelector("#musicUploadStatus");
    const uploadResult = root.querySelector("#musicUploadResult");
    const embedBox = root.querySelector("#musicEmbed");

    function updatePlaying(){
        const playing=activeMode==='audio'?!audio.paused&&!audio.ended:embedPlaying;
        root.classList.toggle('is-playing',playing);
        const collapsed=root.classList.contains('is-collapsed');
        toggleButton.setAttribute('aria-label',`${collapsed?'打开':'收起'}留声机（${playing?'正在播放':'未播放'}）`);
        playButton.textContent=playing?'暂停':'▶';
    }
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!root.classList.contains('is-collapsed')){root.classList.add('is-collapsed');root.querySelector('.music-shell').inert=true;toggleButton.setAttribute('aria-expanded','false');updatePlaying();toggleButton.focus();}});
    function uid(prefix){
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function setStatus(message){
        statusText.textContent = message || "";
    }

    function trackLabel(track){
        return `${track.title || "未命名音乐"}${track.artist ? " - " + track.artist : ""}`;
    }

    function saveUserTracks(){
        localStorage.setItem(userListKey, JSON.stringify(userTracks));
    }

    function loadUserTracks(){
        // Unavailable or corrupted browser storage must not hide the public playlist.
        try{
            const saved = JSON.parse(localStorage.getItem(userListKey) || "[]");
            userTracks = Array.isArray(saved) ? saved.filter(track => track && track.id && track.source) : [];
        }catch(error){
            userTracks = [];
        }
    }

    function rebuildPlaylist(){
        playlist = [...defaultTracks, ...userTracks];
        if(current >= playlist.length) current = 0;
        root.querySelector('[data-action="panel"]').textContent = `列表（${playlist.length}）`;
        for(const action of ["prev", "play", "next", "seek"]){
            root.querySelector(`[data-action="${action}"]`).disabled = !playlist.length;
        }
        renderList();
        if(!playlist.length){
            title.textContent = "音乐播放器：暂无音乐";
            setStatus("网站暂未收录音乐，作者可在列表中上传。");
        }
    }

    function openDb(){
        return new Promise((resolve,reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(storeName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function idbGet(id){
        const db = await openDb();
        return new Promise((resolve,reject) => {
            const tx = db.transaction(storeName, "readonly");
            const request = tx.objectStore(storeName).get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function idbDelete(id){
        const db = await openDb();
        return new Promise((resolve,reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).delete(id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    function extensionFromUrl(value){
        try{
            const url = new URL(value);
            return url.pathname.split(".").pop().toLowerCase();
        }catch(error){
            return "";
        }
    }

    function parseTime(value){
        const text = String(value || "").toLowerCase();
        if(/^\d+$/.test(text)) return Number(text);
        const h = Number((text.match(/(\d+)\s*h/) || [0,0])[1]);
        const m = Number((text.match(/(\d+)\s*m/) || [0,0])[1]);
        const s = Number((text.match(/(\d+)\s*s/) || [0,0])[1]);
        return h * 3600 + m * 60 + s;
    }

    function parseExternalUrl(rawUrl){
        let parsed;
        try{
            parsed = new URL(rawUrl);
        }catch(error){
            return null;
        }
        const host = parsed.hostname.replace(/^www\./,"");
        const ext = extensionFromUrl(rawUrl);
        if(supportedAudio.includes(ext)){
            return { id:uid("url"), source:"url", type:"audio", title:decodeURIComponent(parsed.pathname.split("/").pop() || "URL 音频"), src:rawUrl, user:true };
        }
        if(host.includes("youtube.com") || host === "youtu.be"){
            let id = parsed.searchParams.get("v");
            if(host === "youtu.be") id = parsed.pathname.split("/").filter(Boolean)[0];
            if(!id && parsed.pathname.startsWith("/shorts/")) id = parsed.pathname.split("/")[2];
            if(!id) return null;
            const start = parseTime(parsed.searchParams.get("t") || parsed.searchParams.get("start") || "");
            return { id:uid("youtube"), source:"youtube", type:"embed", provider:"youtube", videoId:id, title:"YouTube 视频", src:rawUrl, embedUrl:`https://www.youtube.com/embed/${encodeURIComponent(id)}?enablejsapi=1${start ? `&start=${start}` : ""}`, user:true };
        }
        if(host.includes("vimeo.com")){
            const id = parsed.pathname.split("/").filter(part => /^\d+$/.test(part)).pop();
            if(!id) return null;
            const start = parseTime(parsed.hash.replace(/^#t=/,""));
            return { id:uid("vimeo"), source:"vimeo", type:"embed", provider:"vimeo", videoId:id, title:"Vimeo 视频", src:rawUrl, embedUrl:`https://player.vimeo.com/video/${id}${start ? `#t=${start}s` : ""}`, user:true };
        }
        if(host.includes("spotify.com")){
            const parts = parsed.pathname.split("/").filter(Boolean);
            const kind = parts[0];
            const id = parts[1];
            if(!["album","track","playlist","episode","show"].includes(kind) || !id) return null;
            return { id:uid("spotify"), source:"spotify", type:"embed", provider:"spotify", title:"Spotify", src:rawUrl, embedUrl:`https://open.spotify.com/embed/${kind}/${id}`, user:true };
        }
        if(host.includes("music.163.com")){
            const songId = parsed.searchParams.get("id") || (parsed.hash.match(/id=(\d+)/) || [])[1];
            const type = parsed.pathname.includes("playlist") || parsed.hash.includes("playlist") ? "0" : "2";
            if(!songId) return null;
            return { id:uid("netease"), source:"netease", type:"embed", provider:"netease", title:"网易云音乐", src:rawUrl, embedUrl:`https://music.163.com/outchain/player?type=${type}&id=${songId}&auto=0&height=66`, user:true };
        }
        return null;
    }

    async function fetchEmbedTitle(track){
        try{
            if(track.provider === "youtube"){
                const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(track.src)}`);
                if(response.ok) return (await response.json()).title || track.title;
            }
            if(track.provider === "vimeo"){
                const response = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(track.src)}`);
                if(response.ok) return (await response.json()).title || track.title;
            }
            if(track.provider === "spotify"){
                const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(track.src)}`);
                if(response.ok) return (await response.json()).title || track.title;
            }
        }catch(error){
            return track.title;
        }
        return track.title;
    }

    function renderList(){
        if(!playlist.length){
            list.innerHTML = `<div class="music-status">歌单还没有音乐。音频上传并发布后会自动出现在这里。</div>`;
            return;
        }
        list.innerHTML = playlist.map((track,index) => `
            <div class="music-list-item ${index === current ? "active" : ""}">
                <span class="music-list-title">${escapeHtml(trackLabel(track))}</span>
                <button type="button" data-action="select" data-index="${index}">播放</button>
                ${track.user ? `<button type="button" data-action="remove" data-id="${track.id}">删除</button>` : `<span></span>`}
            </div>
        `).join("");
    }

    function escapeHtml(text){
        return String(text).replace(/[&<>"']/g, char => ({
            "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
        }[char]));
    }

    function setControlsForTrack(track){
        const isAudio = track && track.type === "audio";
        seek.disabled = !isAudio;
        volume.disabled = false;
    }

    function stopEmbed(){
        embedBox.classList.remove("show");
        embedBox.innerHTML = "";
        embedPlayer = null;
        embedPlaying = false;
        updatePlaying();
    }

    function loadScript(src,id){
        if(document.getElementById(id)) return Promise.resolve();
        return new Promise((resolve,reject) => {
            const script = document.createElement("script");
            script.id = id;
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    function loadYoutubeApi(){
        if(window.YT && window.YT.Player) return Promise.resolve();
        if(window.__wasdwryYoutubeApiReady) return window.__wasdwryYoutubeApiReady;
        window.__wasdwryYoutubeApiReady = new Promise(resolve => {
            const previous = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                if(typeof previous === "function") previous();
                resolve();
            };
            loadScript("https://www.youtube.com/iframe_api","youtube-iframe-api").catch(resolve);
        });
        return window.__wasdwryYoutubeApiReady;
    }

    function loadVimeoApi(){
        if(window.Vimeo && window.Vimeo.Player) return Promise.resolve();
        return loadScript("https://player.vimeo.com/api/player.js","vimeo-player-api");
    }

    async function prepareEmbed(track){
        stopEmbed();
        activeMode = "embed";
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        embedBox.innerHTML = `<iframe id="musicEmbedFrame" src="${escapeHtml(track.embedUrl)}" title="${escapeHtml(trackLabel(track))}" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
        embedBox.classList.add("show");
        if(track.provider === "youtube"){
            await loadYoutubeApi();
            if(window.YT && window.YT.Player) embedPlayer = new YT.Player("musicEmbedFrame",{events:{onStateChange:event=>{embedPlaying=event.data===1;updatePlaying();}}});
        }
        if(track.provider === "vimeo"){
            await loadVimeoApi();
            if(window.Vimeo && window.Vimeo.Player) {embedPlayer = new Vimeo.Player(document.getElementById("musicEmbedFrame"));for(const name of ["play","pause","ended"])embedPlayer.on(name,()=>{embedPlaying=name==="play";updatePlaying();});}
        }
        setStatus(track.provider === "spotify" || track.provider === "netease" ? "这个平台需要在嵌入播放器里操作播放。" : "已加载嵌入播放器。");
    }

    async function resolveAudioSource(track){
        if(track.source !== "local") return track.src;
        if(objectUrls.has(track.dbId)) return objectUrls.get(track.dbId);
        const blob = await idbGet(track.dbId);
        if(!blob) throw new Error("本地音频文件不存在");
        const objectUrl = URL.createObjectURL(blob);
        objectUrls.set(track.dbId, objectUrl);
        return objectUrl;
    }

    async function loadTrack(index, autoplay){
        if(!playlist.length) return;
        current = (index + playlist.length) % playlist.length;
        const track = playlist[current];
        title.textContent = trackLabel(track);
        playButton.textContent = "▶";
        renderList();
        setControlsForTrack(track);
        if(track.type === "embed"){
            await prepareEmbed(track);
            if(autoplay) playCurrent();
            return;
        }
        activeMode = "audio";
        stopEmbed();
        try{
            audio.src = await resolveAudioSource(track);
            seek.value = 0;
            setStatus("");
            if(autoplay) audio.play().catch(()=>setStatus("播放未能开始，请再次点击播放。"));
        }catch(error){
            setStatus("无法加载这首音乐，可能文件已被浏览器清理。");
        }
    }

    async function playCurrent(){
        const track = playlist[current];
        if(!track) return;
        if(activeMode === "embed"){
            try{
                if(track.provider === "youtube" && embedPlayer && embedPlayer.playVideo){
                    embedPlayer.playVideo();
                    embedPlaying = true;
                    updatePlaying();
                    return;
                }
                if(track.provider === "vimeo" && embedPlayer && embedPlayer.play){
                    await embedPlayer.play();
                    embedPlaying = true;
                    updatePlaying();
                    return;
                }
            }catch(error){
                setStatus("浏览器阻止自动播放，请在嵌入播放器中点击播放。");
                return;
            }
            setStatus("请在嵌入播放器中点击播放。");
            return;
        }
        if(audio.paused) audio.play().catch(()=>setStatus("播放未能开始，请再次点击播放。")); else audio.pause();
    }

    async function pauseEmbed(){
        const track = playlist[current];
        try{
            if(track && track.provider === "youtube" && embedPlayer && embedPlayer.pauseVideo) embedPlayer.pauseVideo();
            if(track && track.provider === "vimeo" && embedPlayer && embedPlayer.pause) await embedPlayer.pause();
            embedPlaying = false;
            updatePlaying();
        }catch(error){
            setStatus("这个嵌入播放器不支持外部暂停。");
        }
    }

    async function testAudioUrl(track){
        return new Promise(resolve => {
            const probe = new Audio();
            const done = ok => {
                probe.src = "";
                resolve(ok);
            };
            probe.preload = "metadata";
            probe.addEventListener("loadedmetadata", () => done(true), { once:true });
            probe.addEventListener("error", () => done(false), { once:true });
            probe.src = track.src;
            setTimeout(() => done(true), 3500);
        });
    }

    async function addUrl(){
        const value = urlInput.value.trim();
        if(!value) return;
        const track = parseExternalUrl(value);
        if(!track){
            setStatus("这个链接暂不支持作为音乐源。");
            return;
        }
        if(track.type === "audio"){
            const ok = await testAudioUrl(track);
            if(!ok){
                setStatus("这个音频链接无法被浏览器播放。");
                return;
            }
        }else{
            track.title = await fetchEmbedTitle(track);
        }
        userTracks.push(track);
        saveUserTracks();
        rebuildPlaylist();
        current = playlist.findIndex(item => item.id === track.id);
        await loadTrack(current, false);
        urlInput.value = "";
        setStatus("已添加到播放列表。");
    }

    async function removeTrack(id){
        const track = userTracks.find(item => item.id === id);
        if(!track) return;
        if(!confirm(`从播放列表删除“${trackLabel(track)}”？`)) return;
        userTracks = userTracks.filter(item => item.id !== id);
        if(track.source === "local" && track.dbId){
            await idbDelete(track.dbId);
            if(objectUrls.has(track.dbId)){
                URL.revokeObjectURL(objectUrls.get(track.dbId));
                objectUrls.delete(track.dbId);
            }
        }
        saveUserTracks();
        rebuildPlaylist();
        if(playlist.length) loadTrack(Math.min(current, playlist.length - 1), false);
    }

    root.addEventListener("click", event => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        if(!action) return;
        if(action === "toggle"){
            root.classList.toggle("is-collapsed");
            const collapsed = root.classList.contains("is-collapsed");
            root.querySelector(".music-shell").inert=collapsed;
            toggleButton.setAttribute("aria-expanded",String(!collapsed));
            updatePlaying();
            return;
        }
        if(action === "panel"){
            panel.classList.toggle("open");
            return;
        }
        if(action === "add-url"){
            addUrl();
            return;
        }
        if(action === "upload"){
            uploadMusic();
            return;
        }
        if(action === "refresh"){
            refreshRepositoryPlaylist().then(() => setStatus("歌单已更新。")).catch(() => setStatus("暂时未能刷新歌单，请稍后重试。"));
            return;
        }
        if(action === "select"){
            loadTrack(Number(event.target.dataset.index), true);
            return;
        }
        if(action === "remove"){
            removeTrack(event.target.dataset.id);
            return;
        }
        if(!playlist.length) return;
        if(action === "play"){
            if(activeMode === "embed" && embedPlaying) pauseEmbed();
            else playCurrent();
        }
        if(action === "prev") loadTrack(current - 1, true);
        if(action === "next") loadTrack(current + 1, true);
    });

    fileInput.addEventListener("change", event => {
        uploadFile = null;
        const file = event.target.files[0];
        uploadResult.hidden = true;
        if(file){
            try{
                validateMusicFile(file.name, file.size);
                uploadFile = file;
                uploadStatus.textContent = `已选择：${file.name}（${(file.size / 1024 / 1024).toFixed(1)} MiB）。点击“上传并公开”开始。`;
            }catch(error){ uploadStatus.textContent = error.message; }
        }else uploadStatus.textContent = "请选择要上传的音频。";
        uploadButton.disabled = !uploadFile || uploading;
    });
    seek.addEventListener("input", () => {
        if(activeMode === "audio" && audio.duration) audio.currentTime = audio.duration * Number(seek.value) / 100;
    });
    volume.addEventListener("input", () => {
        audio.volume = Number(volume.value);
    });
    audio.addEventListener("play", updatePlaying);
    audio.addEventListener("pause", updatePlaying);
    audio.addEventListener("ended",updatePlaying);
    audio.addEventListener("error",()=>{updatePlaying();setStatus("暂时无法播放这首音乐，请检查链接或选择其他曲目。");});
    audio.addEventListener("timeupdate", () => {
        if(activeMode === "audio" && audio.duration) seek.value = String((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener("ended", () => loadTrack(current + 1, true));

    function repositoryTracks(data){
        if(!Array.isArray(data)) throw new Error("Invalid playlist");
        return data.filter(track => track && typeof track.src === "string" && track.src).map(track => ({
            id:`default-${track.src}`, source:"default", type:"audio",
            title:track.title || "未命名音乐", artist:track.artist || "", src:track.src, user:false
        }));
    }
    async function readRepositoryPlaylist(refresh = false){
        const response = await fetch("assets/music/playlist.json" + (refresh ? `?updated=${Date.now()}` : ""), { cache:"no-cache", signal:AbortSignal.timeout(10000) });
        if(!response.ok) throw new Error("Playlist unavailable");
        return repositoryTracks(await response.json());
    }
    async function refreshRepositoryPlaylist(){
        const tracks = await readRepositoryPlaylist(true);
        const activeId = playlist[current]?.id;
        defaultTracks = tracks;
        playlist = [...defaultTracks, ...userTracks];
        const preserved = playlist.findIndex(track => track.id === activeId);
        current = Math.max(0, preserved);
        rebuildPlaylist();
        if(preserved >= 0) setControlsForTrack(playlist[current]);
        if(preserved < 0){
            if(playlist.length) await loadTrack(0, false);
            else { audio.pause(); stopEmbed(); }
        }
        return tracks;
    }
    async function waitForPublishedMusic(path, generation, attempts = 0){
        if(generation !== uploadGeneration) return;
        try{
            const tracks = await refreshRepositoryPlaylist();
            if(generation !== uploadGeneration) return;
            if(tracks.some(track => {
                try { return decodeURIComponent(new URL(track.src, location.href).pathname) === '/' + path; } catch { return false; }
            })){
                uploadStatus.textContent = "音乐已发布，并加入网站歌单。所有访客现在都能播放。";
                return;
            }
        }catch{}
        if(generation !== uploadGeneration) return;
        if(attempts >= 19){
            uploadStatus.textContent = "音频已提交到仓库，网站尚未完成更新。稍后点击“刷新歌单”查看，也可从下方链接确认文件。";
            return;
        }
        uploadPoll = setTimeout(() => waitForPublishedMusic(path, generation, attempts + 1), 15000);
    }
    async function uploadMusic(){
        if(uploading || !uploadFile) return;
        const publisher = window.WasdwryDiaryPublisher;
        if(typeof publisher?.uploadMusic !== "function"){
            uploadStatus.textContent = "上传登录模块暂未就绪，请稍后刷新页面重试。";
            return;
        }
        uploading = true; uploadButton.disabled = true; fileInput.disabled = true;
        root.querySelector('#musicUpload').setAttribute('aria-busy', 'true');
        clearTimeout(uploadPoll); const generation = ++uploadGeneration;
        uploadResult.hidden = true;
        uploadStatus.textContent = "正在连接作者登录并上传音频，请在弹出窗口中继续。";
        try{
            // Opens the existing first-party login bridge synchronously in this click.
            const result = await publisher.uploadMusic(uploadFile);
            uploadResult.href = result.fileUrl; uploadResult.hidden = false;
            uploadStatus.textContent = result.alreadyPublished ? "仓库中已有这首音频，正在检查网站歌单…" : "音频已提交到仓库，正在等待网站自动发布…";
            uploadFile = null; fileInput.value = "";
            waitForPublishedMusic(result.path, generation);
        }catch(error){
            uploadStatus.textContent = error.message || "上传未完成，所选文件仍保留，请重试。";
        }finally{
            uploading = false; fileInput.disabled = false; uploadButton.disabled = !uploadFile;
            root.querySelector('#musicUpload').setAttribute('aria-busy', 'false');
        }
    }

    async function initialisePlaylist(){
        loadUserTracks();
        let data = [], loadFailed = false;
        try{
            data = await readRepositoryPlaylist();
        }catch(error){
            data = [];
            loadFailed = true;
        }
        defaultTracks = data;
        rebuildPlaylist();
        if(playlist.length) await loadTrack(0, false);
        if(loadFailed) setStatus("网站歌单暂时未能加载，请稍后刷新重试。本机音乐仍可使用。");
    }
    initialisePlaylist();
})();

