(function(){
    const styleId = "wasdwry-comments-style";

    function ensureStyles(){
        if(document.getElementById(styleId)) return;
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            .comments-box{margin-top:24px;padding-top:20px;border-top:1px solid rgba(31,41,51,.12)}
            .comments-box h3{margin:0 0 10px;font-size:20px}
            .comments-note{margin:0 0 14px;color:#607084;line-height:1.7}
            .comments-pending{padding:16px;border:1px dashed rgba(96,112,132,.45);border-radius:8px;background:rgba(255,255,255,.78);color:#607084;line-height:1.7}
        `;
        document.head.appendChild(style);
    }

    function completeConfig(config){
        return Boolean(config && config.repo && config.repoId && config.category && config.categoryId);
    }

    function clearNode(node){
        while(node.firstChild) node.removeChild(node.firstChild);
    }

    function renderPending(node){
        node.innerHTML = `
            <div class="comments-pending">
                留言功能待配置。请先在 GitHub 开启 Discussions，安装 giscus，并把 repoId、category、categoryId 填入 assets/comments-config.js。
            </div>
        `;
    }

    function renderComments(options){
        ensureStyles();
        const mount = document.getElementById(options.mountId || "commentsMount");
        if(!mount) return;

        const config = window.WasdwryCommentsConfig || {};
        clearNode(mount);
        mount.classList.add("comments-box");
        mount.innerHTML = `
            <h3>留言</h3>
            <p class="comments-note">留言由 GitHub Discussions 保存。发布、修改和删除都需要 GitHub 登录，时间记录以 GitHub 为准。</p>
        `;

        if(!completeConfig(config)){
            renderPending(mount);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://giscus.app/client.js";
        script.async = true;
        script.crossOrigin = "anonymous";
        script.setAttribute("data-repo", config.repo);
        script.setAttribute("data-repo-id", config.repoId);
        script.setAttribute("data-category", config.category);
        script.setAttribute("data-category-id", config.categoryId);
        script.setAttribute("data-mapping", config.mapping || "specific");
        script.setAttribute("data-term", options.term);
        script.setAttribute("data-strict", "1");
        script.setAttribute("data-reactions-enabled", config.reactionsEnabled || "1");
        script.setAttribute("data-emit-metadata", config.emitMetadata || "0");
        script.setAttribute("data-input-position", config.inputPosition || "bottom");
        script.setAttribute("data-theme", config.theme || "light");
        script.setAttribute("data-lang", config.lang || "zh-CN");
        script.setAttribute("data-loading", config.loading || "lazy");
        mount.appendChild(script);
    }

    function scrollToComments(){
        const mount = document.getElementById("commentsMount");
        if(!mount) return;
        setTimeout(() => mount.scrollIntoView({ behavior:"smooth", block:"start" }), 120);
    }

    window.WasdwryComments = {
        render: renderComments,
        scrollToComments
    };
})();
