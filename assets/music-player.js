(function(){
    const userListKey = "wasdwry-music-user-list";
    const dbName = "wasdwry-music-library";
    const storeName = "files";
    const supportedAudio = ["mp3","ogg","wav","m4a","aac","flac"];

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
        .music-status{margin:8px 0 0;color:#607084;font-size:12px;line-height:1.5}
        .music-panel{display:none;margin-top:10px;padding-top:10px;border-top:1px solid rgba(31,41,51,.12)}
        .music-panel.open{display:block}
        .music-add-row{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0}
        .music-add-row input[type="url"]{min-height:34px;border:1px solid rgba(31,41,51,.14);border-radius:8px;padding:0 10px;font:inherit}
        .music-file-label{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:0 12px;border:1px solid rgba(22,50,77,.2);border-radius:8px;background:white;color:#16324d;font-weight:700;cursor:pointer}
        .music-file-label input{display:none}
        .music-list{display:grid;gap:8px;max-height:220px;overflow:auto;margin-top:8px}
        .music-list-item{display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:8px;border:1px solid rgba(31,41,51,.12);border-radius:8px;background:#fbfdff}
        .music-list-item.active{border-color:#1769aa;background:#f0f7ff}
        .music-list-title{min-width:0;color:#34495e;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .music-embed{display:none;margin-top:10px;border-radius:8px;overflow:hidden;background:#102033}
        .music-embed.show{display:block}
        .music-embed iframe{width:100%;height:96px;border:0;display:block}
        @media(max-width:680px){.music-player{left:12px;bottom:68px;width:calc(100vw - 72px)}.music-player.is-collapsed{transform:translateX(calc(-100% + 6px))}.music-toggle{right:-40px}.music-controls{grid-template-columns:auto auto auto auto}.music-controls input[data-action="seek"]{grid-column:1/-1}.music-list-item{grid-template-columns:1fr auto}}
    `;
    document.head.appendChild(style);

    const root = document.createElement("aside");
    root.className = "music-player";
    root.innerHTML = `
        <button class="music-toggle" type="button" data-action="toggle" aria-label="收起音乐播放器">‹</button>
        <div class="music-shell">
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
                <label class="music-file-label">添加本地音乐<input id="musicFileInput" type="file" accept="audio/*" multiple></label>
                <div class="music-add-row">
                    <input id="musicUrlInput" type="url" placeholder="粘贴音频、YouTube、Vimeo、Spotify 或网易云链接">
                    <button type="button" data-action="add-url">添加 URL</button>
                </div>
                <div class="music-list" id="musicList"></div>
            </div>
        </div>
    `;
    document.body.appendChild(root);

    const audio = new Audio();
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
    const embedBox = root.querySelector("#musicEmbed");

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
        userTracks = JSON.parse(localStorage.getItem(userListKey) || "[]")
            .filter(track => track && track.id && track.source);
    }

    function rebuildPlaylist(){
        playlist = [...defaultTracks, ...userTracks];
        if(current >= playlist.length) current = 0;
        renderList();
        if(!playlist.length){
            title.textContent = "音乐播放器：暂无音乐";
            setStatus("可从列表里添加本地音乐或 URL。");
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

    async function idbPut(id, blob){
        const db = await openDb();
        return new Promise((resolve,reject) => {
            const tx = db.transaction(storeName, "readwrite");
            tx.objectStore(storeName).put(blob, id);
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
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
            list.innerHTML = `<div class="music-status">列表为空。添加本地音乐或 URL 后会出现在这里。</div>`;
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
            if(window.YT && window.YT.Player) embedPlayer = new YT.Player("musicEmbedFrame");
        }
        if(track.provider === "vimeo"){
            await loadVimeoApi();
            if(window.Vimeo && window.Vimeo.Player) embedPlayer = new Vimeo.Player(document.getElementById("musicEmbedFrame"));
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
            if(autoplay) audio.play();
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
                    playButton.textContent = "暂停";
                    return;
                }
                if(track.provider === "vimeo" && embedPlayer && embedPlayer.play){
                    await embedPlayer.play();
                    embedPlaying = true;
                    playButton.textContent = "暂停";
                    return;
                }
            }catch(error){
                setStatus("浏览器阻止自动播放，请在嵌入播放器中点击播放。");
                return;
            }
            setStatus("请在嵌入播放器中点击播放。");
            return;
        }
        if(audio.paused) audio.play(); else audio.pause();
    }

    async function pauseEmbed(){
        const track = playlist[current];
        try{
            if(track && track.provider === "youtube" && embedPlayer && embedPlayer.pauseVideo) embedPlayer.pauseVideo();
            if(track && track.provider === "vimeo" && embedPlayer && embedPlayer.pause) await embedPlayer.pause();
            embedPlaying = false;
            playButton.textContent = "▶";
        }catch(error){
            setStatus("这个嵌入播放器不支持外部暂停。");
        }
    }

    async function addLocalFiles(files){
        const accepted = [...files].filter(file => file.type.startsWith("audio/") || supportedAudio.includes(file.name.split(".").pop().toLowerCase()));
        if(!accepted.length){
            setStatus("请选择音频文件。");
            return;
        }
        for(const file of accepted){
            const dbId = uid("file");
            await idbPut(dbId, file);
            userTracks.push({ id:uid("local"), source:"local", type:"audio", title:file.name.replace(/\.[^.]+$/,""), artist:"本地文件", dbId, user:true });
        }
        saveUserTracks();
        rebuildPlaylist();
        setStatus("本地音乐已添加。");
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
        const action = event.target.dataset.action;
        if(!action) return;
        if(action === "toggle"){
            root.classList.toggle("is-collapsed");
            const collapsed = root.classList.contains("is-collapsed");
            toggleButton.textContent = collapsed ? "›" : "‹";
            toggleButton.setAttribute("aria-label", collapsed ? "展开音乐播放器" : "收起音乐播放器");
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
        addLocalFiles(event.target.files);
        event.target.value = "";
    });
    seek.addEventListener("input", () => {
        if(activeMode === "audio" && audio.duration) audio.currentTime = audio.duration * Number(seek.value) / 100;
    });
    volume.addEventListener("input", () => {
        audio.volume = Number(volume.value);
    });
    audio.addEventListener("play", () => playButton.textContent = "暂停");
    audio.addEventListener("pause", () => playButton.textContent = "▶");
    audio.addEventListener("timeupdate", () => {
        if(activeMode === "audio" && audio.duration) seek.value = String((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener("ended", () => loadTrack(current + 1, true));

    Promise.all([
        fetch("assets/music/playlist.json").then(response => response.ok ? response.json() : []).catch(() => []),
        Promise.resolve(loadUserTracks())
    ]).then(([data]) => {
        defaultTracks = Array.isArray(data) ? data.filter(track => track && track.src).map((track,index) => ({
            id:`default-${index}`,
            source:"default",
            type:"audio",
            title:track.title || "未命名音乐",
            artist:track.artist || "",
            src:track.src,
            user:false
        })) : [];
        rebuildPlaylist();
        if(playlist.length) loadTrack(0, false);
    }).catch(() => {
        rebuildPlaylist();
    });
})();
