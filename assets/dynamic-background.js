(function(){
    const page = location.pathname.split("/").pop() || "index.html";
    const theme = page.includes("diary") ? "diary" :
        page.includes("posts") ? "town" :
        page.includes("favorites") ? "mine" : "beach";

    const style = document.createElement("style");
    style.textContent = `
        .dynamic-bg{
            position:fixed;
            inset:0;
            z-index:0;
            overflow:hidden;
            pointer-events:none;
        }
        header,main,footer{
            position:relative;
            z-index:1;
            transition:transform .7s ease, opacity .45s ease;
        }
        body.background-focus header,
        body.background-focus main,
        body.background-focus footer{
            transform:translateY(112vh);
            opacity:.08;
        }
        .background-focus-toggle{
            position:fixed;
            right:18px;
            bottom:68px;
            z-index:24;
            min-width:52px;
            min-height:42px;
            padding:0 12px;
            border:1px solid rgba(22,50,77,.2);
            border-radius:8px;
            background:#fff7e1;
            color:#16324d;
            font:700 14px Arial,"Microsoft YaHei",sans-serif;
            box-shadow:0 10px 24px rgba(31,41,51,.2);
            cursor:pointer;
        }
        .dynamic-cloud{
            position:absolute;
            width:150px;
            height:42px;
            border-radius:999px;
            background:rgba(255,255,255,.72);
            box-shadow:34px -14px 0 rgba(255,255,255,.58),72px 5px 0 rgba(255,255,255,.46),0 0 18px rgba(255,255,255,.22);
            animation:cloudSail var(--speed,46s) linear infinite;
        }
        .cloud-a{top:12%;left:-190px;--speed:54s}
        .cloud-b{top:27%;left:-260px;transform:scale(.76);--speed:68s;animation-delay:-18s}
        .cloud-c{top:8%;left:-220px;transform:scale(.58);--speed:78s;animation-delay:-34s}
        @keyframes cloudSail{to{translate:calc(100vw + 360px) 0}}

        .beach-wave{
            position:absolute;
            left:-12%;
            right:-12%;
            bottom:8%;
            height:120px;
            background:repeating-linear-gradient(180deg,rgba(107,231,255,.24) 0 8px,rgba(255,255,255,.18) 8px 13px,transparent 13px 28px);
            transform-origin:center bottom;
            animation:waves 5.8s ease-in-out infinite alternate;
        }
        .beach-gull{
            position:absolute;
            width:42px;
            height:18px;
            animation:gullFly var(--speed,20s) linear infinite;
        }
        .beach-gull::before,.beach-gull::after{
            content:"";
            position:absolute;
            top:8px;
            width:22px;
            height:10px;
            border-top:3px solid rgba(32,57,83,.78);
            border-radius:50%;
            animation:wingBeat .65s ease-in-out infinite alternate;
        }
        .beach-gull::before{left:0;transform-origin:right center;rotate:18deg}
        .beach-gull::after{right:0;transform-origin:left center;rotate:-18deg}
        .gull-a{top:19%;left:-60px;--speed:23s}
        .gull-b{top:31%;left:-90px;transform:scale(.72);--speed:29s;animation-delay:-11s}
        @keyframes gullFly{to{translate:calc(100vw + 160px) -34px}}
        @keyframes wingBeat{to{transform:rotateX(54deg);top:4px}}
        @keyframes waves{from{transform:translateY(8px) scaleY(.92)}to{transform:translateY(-10px) scaleY(1.08)}}

        .town-leaf{
            position:absolute;
            width:10px;
            height:16px;
            border-radius:70% 0 70% 0;
            background:rgba(47,125,91,.62);
            animation:leafDrift var(--speed,13s) ease-in-out infinite;
        }
        .leaf-a{top:48%;left:12%;--speed:12s}
        .leaf-b{top:42%;left:68%;--speed:15s;animation-delay:-4s}
        .leaf-c{top:58%;left:38%;--speed:18s;animation-delay:-8s}
        .town-shadow{
            position:absolute;
            left:0;
            right:0;
            bottom:0;
            height:42%;
            background:linear-gradient(95deg,transparent 0 24%,rgba(26,74,58,.16) 28%,transparent 34% 52%,rgba(26,74,58,.13) 58%,transparent 70%);
            animation:treeShadow 9s ease-in-out infinite alternate;
        }
        @keyframes leafDrift{0%,100%{transform:translate3d(0,0,0) rotate(0deg)}50%{transform:translate3d(20px,9px,0) rotate(18deg)}}
        @keyframes treeShadow{from{opacity:.22;transform:skewX(-4deg)}to{opacity:.38;transform:skewX(5deg)}}

        .diary-star{
            position:absolute;
            width:3px;
            height:3px;
            border-radius:50%;
            background:white;
            box-shadow:0 0 10px rgba(255,255,255,.9);
            animation:starPulse var(--speed,3s) ease-in-out infinite alternate;
        }
        .star-a{top:12%;left:18%;--speed:2.6s}
        .star-b{top:22%;left:72%;--speed:3.8s;animation-delay:-1s}
        .star-c{top:34%;left:46%;--speed:3.1s;animation-delay:-2s}
        .diary-lamp{
            position:absolute;
            left:58%;
            top:47%;
            width:110px;
            height:80px;
            border-radius:50%;
            background:radial-gradient(circle,rgba(255,205,104,.46),rgba(255,166,72,.16) 45%,transparent 72%);
            animation:lampGlow 3.6s ease-in-out infinite alternate;
        }
        .diary-smoke{
            position:absolute;
            left:61%;
            top:34%;
            width:20px;
            height:20px;
            border-radius:50%;
            background:rgba(230,240,247,.34);
            box-shadow:18px -24px 0 rgba(230,240,247,.22),-8px -48px 0 rgba(230,240,247,.16);
            animation:smokeRise 8s ease-in-out infinite;
        }
        .diary-water{
            position:absolute;
            left:-10%;
            right:-10%;
            bottom:10%;
            height:110px;
            background:repeating-linear-gradient(180deg,rgba(146,214,255,.18) 0 5px,rgba(255,255,255,.12) 5px 9px,transparent 9px 22px);
            animation:lakeRipple 6.5s ease-in-out infinite alternate;
        }
        .diary-grass{
            position:absolute;
            left:0;
            right:0;
            bottom:0;
            height:22%;
            background:repeating-linear-gradient(90deg,transparent 0 16px,rgba(78,166,92,.24) 17px 20px,transparent 22px 34px);
            animation:grassSway 4.8s ease-in-out infinite alternate;
        }
        @keyframes starPulse{from{opacity:.3;scale:.8}to{opacity:1;scale:1.25}}
        @keyframes lampGlow{from{opacity:.46;scale:.94}to{opacity:.82;scale:1.08}}
        @keyframes smokeRise{from{opacity:.18;transform:translateY(22px) scale(.8)}to{opacity:.52;transform:translateY(-46px) translateX(18px) scale(1.45)}}
        @keyframes lakeRipple{from{transform:translateY(6px)}to{transform:translateY(-8px)}}
        @keyframes grassSway{from{transform:skewX(-2deg)}to{transform:skewX(3deg)}}

        .mine-flame{
            position:absolute;
            width:82px;
            height:96px;
            border-radius:50%;
            background:radial-gradient(circle,rgba(255,225,109,.72),rgba(255,118,48,.34) 42%,transparent 74%);
            animation:flameFlicker var(--speed,2.8s) ease-in-out infinite alternate;
        }
        .flame-a{left:14%;top:38%;--speed:2.4s}
        .flame-b{right:18%;top:43%;--speed:3.1s;animation-delay:-1.2s}
        .mine-crystal{
            position:absolute;
            width:46px;
            height:72px;
            clip-path:polygon(50% 0,100% 32%,72% 100%,25% 100%,0 32%);
            background:linear-gradient(135deg,rgba(147,236,255,.74),rgba(178,112,255,.62),rgba(255,255,255,.86));
            box-shadow:0 0 28px rgba(147,236,255,.5);
            animation:crystalGlimmer var(--speed,4s) ease-in-out infinite alternate;
        }
        .crystal-a{left:32%;top:55%;--speed:3.7s}
        .crystal-b{right:28%;top:63%;transform:scale(.7);--speed:4.8s;animation-delay:-2s}
        @keyframes flameFlicker{from{opacity:.48;scale:.88;filter:saturate(1)}to{opacity:.88;scale:1.12;filter:saturate(1.5)}}
        @keyframes crystalGlimmer{from{opacity:.42;filter:brightness(1)}to{opacity:.95;filter:brightness(1.55)}}

        @media (prefers-reduced-motion: reduce){
            .dynamic-bg *{animation:none!important}
            header,main,footer{transition:none}
        }
        @media(max-width:680px){
            .background-focus-toggle{right:12px;bottom:116px}
        }
    `;
    document.head.appendChild(style);

    const layer = document.createElement("div");
    layer.className = `dynamic-bg dynamic-${theme}`;
    const pieces = {
        beach:["dynamic-cloud cloud-a","dynamic-cloud cloud-b","beach-gull gull-a","beach-gull gull-b","beach-wave"],
        town:["dynamic-cloud cloud-a","dynamic-cloud cloud-b","dynamic-cloud cloud-c","town-shadow","town-leaf leaf-a","town-leaf leaf-b","town-leaf leaf-c"],
        diary:["dynamic-cloud cloud-a","dynamic-cloud cloud-b","diary-star star-a","diary-star star-b","diary-star star-c","diary-lamp","diary-smoke","diary-water","diary-grass"],
        mine:["mine-flame flame-a","mine-flame flame-b","mine-crystal crystal-a","mine-crystal crystal-b"]
    }[theme] || [];
    layer.innerHTML = pieces.map(className => `<span class="${className}"></span>`).join("");
    document.body.prepend(layer);

    const button = document.createElement("button");
    button.className = "background-focus-toggle";
    button.type = "button";
    button.textContent = "背景";
    button.setAttribute("aria-pressed","false");
    button.addEventListener("click", () => {
        document.body.classList.toggle("background-focus");
        const active = document.body.classList.contains("background-focus");
        button.textContent = active ? "恢复" : "背景";
        button.setAttribute("aria-pressed", String(active));
    });
    document.body.appendChild(button);
})();
