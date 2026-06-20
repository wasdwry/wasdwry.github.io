(function(){
    const style = document.createElement("style");
    style.textContent = `
        .music-player{
            position:fixed;
            left:18px;
            bottom:18px;
            z-index:21;
            width:min(360px,calc(100vw - 96px));
            padding:12px;
            border:1px solid rgba(31,41,51,.14);
            border-radius:8px;
            background:rgba(255,255,255,.92);
            box-shadow:0 12px 28px rgba(31,41,51,.18);
            color:#1f2933;
            backdrop-filter:blur(10px);
            font-family:Arial,"Microsoft YaHei",sans-serif;
        }
        .music-title{
            margin:0 0 8px;
            color:#34495e;
            font-size:14px;
            font-weight:700;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        }
        .music-controls{
            display:grid;
            grid-template-columns:auto auto auto 1fr;
            gap:8px;
            align-items:center;
        }
        .music-player button{
            min-width:34px;
            min-height:32px;
            border:1px solid rgba(22,50,77,.2);
            border-radius:8px;
            background:white;
            color:#16324d;
            cursor:pointer;
            font-weight:700;
        }
        .music-player input[type="range"]{
            width:100%;
        }
        .music-volume{
            display:flex;
            gap:6px;
            align-items:center;
            margin-top:8px;
            color:#607084;
            font-size:12px;
        }
        @media(max-width:680px){
            .music-player{
                left:12px;
                bottom:68px;
                width:calc(100vw - 24px);
            }
        }
    `;
    document.head.appendChild(style);

    const root = document.createElement("aside");
    root.className = "music-player";
    root.innerHTML = `
        <p class="music-title">音乐播放器：正在读取播放列表...</p>
        <div class="music-controls">
            <button type="button" data-action="prev">‹</button>
            <button type="button" data-action="play">▶</button>
            <button type="button" data-action="next">›</button>
            <input type="range" data-action="seek" min="0" max="100" value="0" step="1" aria-label="播放进度">
        </div>
        <div class="music-volume">
            <span>音量</span>
            <input type="range" data-action="volume" min="0" max="1" value="0.7" step="0.01" aria-label="音量">
        </div>
    `;
    document.body.appendChild(root);

    const audio = new Audio();
    audio.volume = 0.7;
    let playlist = [];
    let current = 0;
    const title = root.querySelector(".music-title");
    const playButton = root.querySelector('[data-action="play"]');
    const seek = root.querySelector('[data-action="seek"]');
    const volume = root.querySelector('[data-action="volume"]');

    function setEmpty(){
        title.textContent = "音乐播放器：暂无音乐";
        root.querySelectorAll("button,input").forEach(control => control.disabled = true);
    }

    function trackLabel(track){
        return `${track.title || "未命名音乐"}${track.artist ? " - " + track.artist : ""}`;
    }

    function loadTrack(index){
        if(!playlist.length) return;
        current = (index + playlist.length) % playlist.length;
        audio.src = playlist[current].src;
        title.textContent = trackLabel(playlist[current]);
        seek.value = 0;
        playButton.textContent = "▶";
    }

    root.addEventListener("click", event => {
        const action = event.target.dataset.action;
        if(!action || !playlist.length) return;
        if(action === "play"){
            if(audio.paused){
                audio.play();
            }else{
                audio.pause();
            }
        }
        if(action === "prev"){
            loadTrack(current - 1);
            audio.play();
        }
        if(action === "next"){
            loadTrack(current + 1);
            audio.play();
        }
    });

    seek.addEventListener("input", () => {
        if(audio.duration) audio.currentTime = audio.duration * Number(seek.value) / 100;
    });
    volume.addEventListener("input", () => {
        audio.volume = Number(volume.value);
    });
    audio.addEventListener("play", () => playButton.textContent = "暂停");
    audio.addEventListener("pause", () => playButton.textContent = "▶");
    audio.addEventListener("timeupdate", () => {
        if(audio.duration) seek.value = String((audio.currentTime / audio.duration) * 100);
    });
    audio.addEventListener("ended", () => {
        loadTrack(current + 1);
        audio.play();
    });

    fetch("assets/music/playlist.json")
        .then(response => response.ok ? response.json() : [])
        .then(data => {
            playlist = Array.isArray(data) ? data.filter(track => track && track.src) : [];
            if(!playlist.length){
                setEmpty();
                return;
            }
            loadTrack(0);
        })
        .catch(setEmpty);
})();
