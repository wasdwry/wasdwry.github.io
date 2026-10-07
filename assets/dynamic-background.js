/* Original illustrations animated with spatially masked GPU distortion and local lighting. */
(function () {
    'use strict';
    const page=location.pathname.split('/').pop()||'index.html';
    const theme=page.includes('diary')?'lake':page.includes('posts')?'town':page.includes('favorites')?'mine':'beach';
    const themes={beach:'pixel-beach-bg',lake:'pixel-starry-night-bg',town:'pixel-town-bg',mine:'pixel-mine-bg'};
    const original=`assets/${themes[theme]}.webp`;
    const canvas=document.createElement('canvas');canvas.className='dynamic-bg';canvas.setAttribute('aria-hidden','true');
    const style=document.createElement('style');
    style.textContent=`
        body{background-image:url("${original}")!important;background-color:#182a42;background-size:cover;background-position:center top;background-attachment:fixed}
        body::before,body::after{display:none!important}
        .dynamic-bg{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
        header,main,footer{position:relative;z-index:1}
        header{background:linear-gradient(180deg,#08182c38,transparent)}
        header .navbar,header .hero,header nav a,header .hero p{color:#fff;text-shadow:0 2px 5px #142d46,0 3px 16px #142d4670}
        header .button{text-shadow:none}
        footer{color:#fff;text-shadow:0 1px 5px #142d46}
        body.background-focus header,body.background-focus main,body.background-focus footer,
        body.background-focus .music-player,body.background-focus .top-button{visibility:hidden;pointer-events:none}
        .background-controls{position:fixed;right:18px;bottom:68px;z-index:24;display:flex;gap:6px}
        .background-controls button{min-width:52px;min-height:42px;padding:0 12px;border:1px solid #b6c9d5;border-radius:8px;background:#fff7e1;color:#16324d;font:700 14px Arial,"Microsoft YaHei",sans-serif;box-shadow:0 6px 20px #142d4626;cursor:pointer}
        .background-controls button:focus-visible{outline:3px solid #1769aa;outline-offset:3px}
        @media(max-width:680px){.background-controls{left:12px;right:auto;bottom:18px}}
    `;
    document.head.appendChild(style);document.body.prepend(canvas);document.body.dataset.landscape=theme;
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    let paused=media.matches,frame=0,last=0,elapsed=0,ready=false,contextLost=false,dayImage,nightImage;
    let light=0,warmth=0,previousMinute=-1,program,locations,textures=[];
    let gl=null,ctx=null;
    try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});}catch(_){/* Canvas fallback below. */}
    if(!gl)ctx=canvas.getContext('2d',{alpha:false});
    const controls=document.createElement('div');controls.className='background-controls';
    const focusButton=document.createElement('button'),pauseButton=document.createElement('button');
    focusButton.type=pauseButton.type='button';
    function focusBackground(active){document.body.classList.toggle('background-focus',active);focusButton.textContent=active?'返回网页':'背景';focusButton.setAttribute('aria-label',active?'返回网页':'欣赏动态背景');focusButton.setAttribute('aria-pressed',String(active));}
    function updatePauseButton(){pauseButton.textContent=paused?'播放动画':'暂停动画';pauseButton.setAttribute('aria-label',paused?'播放背景动画':'暂停背景动画');pauseButton.setAttribute('aria-pressed',String(paused));}
    focusBackground(false);updatePauseButton();
    focusButton.addEventListener('click',()=>focusBackground(!document.body.classList.contains('background-focus')));
    pauseButton.addEventListener('click',()=>{paused=!paused;updatePauseButton();restart();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape')focusBackground(false);});
    media.addEventListener('change',()=>{paused=media.matches;updatePauseButton();restart();});
    controls.append(focusButton,pauseButton);document.body.appendChild(controls);
    function updateClock(){
        const d=new Date(),minute=d.getHours()*60+d.getMinutes();if(minute===previousMinute)return;
        previousMinute=minute;const hour=minute/60;
        const keys=[[0,0,0],[5,0,.1],[7,.85,.35],[9,1,0],[16,1,0],[18,.42,.7],[20,0,0],[24,0,0]];
        const i=keys.findIndex(k=>k[0]>hour),a=keys[i-1],b=keys[i],p=(hour-a[0])/(b[0]-a[0]);
        light=a[1]+(b[1]-a[1])*p;warmth=a[2]+(b[2]-a[2])*p;
        document.body.dataset.timeOfDay=hour<5||hour>=20?'night':hour<8?'dawn':hour<17?'day':'dusk';
        canvas.dataset.localHour=String(d.getHours());
    }
    const vertex=`attribute vec2 position;varying vec2 screenUV;void main(){screenUV=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
    const fragment=`
        precision highp float;
        uniform sampler2D dayTexture,nightTexture;
        uniform vec2 crop,offset;
        uniform float time,daylight,warmth,scene;
        varying vec2 screenUV;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float band(float a,float b,float c,float d,float x){return smoothstep(a,b,x)*(1.-smoothstep(c,d,x));}
        float spot(vec2 p,vec2 center,vec2 radius){vec2 q=(p-center)/radius;return exp(-dot(q,q)*3.);}
        vec3 artwork(vec2 p){vec3 d=texture2D(dayTexture,p).rgb;if(scene>.5&&scene<1.5)return mix(texture2D(nightTexture,p).rgb,d,daylight);return d;}
        void main(){
            vec2 uv=screenUV*crop+offset;
            vec3 source=artwork(uv);
            float beach=1.-step(.5,scene),lake=step(.5,scene)*(1.-step(1.5,scene)),town=step(1.5,scene)*(1.-step(2.5,scene)),mine=step(2.5,scene);
            float water=0.,foliage=0.,sky=0.,smoke=0.;
            if(beach>.5){
                water=smoothstep(.67,.69,uv.y)*smoothstep(.28+max(uv.y-.76,0.)*1.8,.32+max(uv.y-.76,0.)*1.8,uv.x);
                water*=smoothstep(.015,.12,source.b-source.r)*smoothstep(.015,.12,source.g-source.r);
                foliage=(1.-smoothstep(.30,.37,uv.x))*(1.-smoothstep(.48,.60,uv.y));
                sky=(1.-smoothstep(.51,.62,uv.y))*smoothstep(.32,.40,uv.x);
            }else if(lake>.5){
                water=band(.79,.82,.93,.98,uv.y)*band(.36,.50,.82,.95,uv.x);
                foliage=(1.-smoothstep(.08,.15,uv.x))*band(.27,.35,.70,.80,uv.y)+smoothstep(.88,.97,uv.y);
                sky=(1.-smoothstep(.59,.68,uv.y))*smoothstep(.18,.27,uv.x);
                smoke=band(.075,.09,.12,.145,uv.x)*band(.28,.32,.45,.48,uv.y);
            }else if(town>.5){
                foliage=(1.-smoothstep(.26,.32,uv.x))*(1.-smoothstep(.45,.53,uv.y))+smoothstep(.68,.77,uv.x)*band(.30,.36,.69,.76,uv.y);
                sky=band(.27,.33,.78,.87,uv.x)*(1.-smoothstep(.27,.42,uv.y));
            }
            foliage*=smoothstep(.02,.13,source.g-source.r*.9)*smoothstep(.01,.1,source.g-source.b*.8);
            vec2 animated=uv;
            animated.x+=water*(sin(uv.y*180.-time*1.1)*.0015+sin(uv.y*65.+time*.7)*.0006);
            animated.y+=water*sin(uv.x*90.+uv.y*50.-time*.9)*.00045;
            animated.x+=foliage*sin(time*.65+uv.y*12.)*.0018;
            animated.y+=foliage*cos(time*.54+uv.x*9.)*.00055;
            animated.x+=smoke*sin(uv.y*70.-time*.9)*.002;
            float cloud=sky*smoothstep(.45,.82,source.r+source.g*.18);
            animated.x+=cloud*sin(time*.12+uv.y*13.)*.002;
            animated.y+=cloud*cos(time*.14+uv.x*7.)*.0006;
            float fire=mine*(spot(uv,vec2(.345,.311),vec2(.026,.04))+spot(uv,vec2(.713,.337),vec2(.025,.04)));
            animated.x+=fire*sin(time*4.+uv.y*130.)*.001;
            vec3 col=artwork(clamp(animated,vec2(.001),vec2(.999)));
            // Outdoor daytime originals are graded into a detailed moonlit scene at night.
            if(lake<.5&&mine<.5){
                float lum=dot(col,vec3(.2126,.7152,.0722));
                vec3 moonlit=mix(col*vec3(.23,.34,.58),vec3(lum*.23,lum*.31,lum*.51),.26);
                col=mix(moonlit,col,daylight);
            }
            if(mine>.5)col*=.90+.10*daylight;
            col=mix(col,col*vec3(1.13,.94,.82)+vec3(.055,.008,0.),warmth*.35*(1.-mine));
            // Travel and shimmer stay inside actual water; the pier, rocks and buildings stay still.
            float ripple=pow(max(0.,sin(uv.y*360.+uv.x*24.-time*1.1)),20.)*.026;
            col+=water*ripple*vec3(.55,.85,1.);
            if(lake>.5){
                float star=sky*smoothstep(.48,.83,dot(source,vec3(.3,.5,.2)))*(1.-spot(uv,vec2(.71,.155),vec2(.055,.085)));
                col+=star*(1.-daylight)*(.08+.10*sin(time*1.3+hash(floor(uv*500.))*6.28));
                float lamp=spot(uv,vec2(.174,.581),vec2(.055,.09))+spot(uv,vec2(.061,.69),vec2(.03,.06));
                col+=lamp*(1.-daylight)*(.018+.012*sin(time*1.3))*vec3(1.,.55,.17);
            }
            if(town>.5){
                float lamps=spot(uv,vec2(.62,.53),vec2(.023,.04))+spot(uv,vec2(.10,.59),vec2(.018,.035))+spot(uv,vec2(.923,.511),vec2(.016,.03));
                col+=lamps*(1.-daylight)*vec3(.38,.23,.075)*(.92+.08*sin(time*1.5));
            }
            if(mine>.5){
                float lamps=spot(uv,vec2(.168,.241),vec2(.065,.115))+spot(uv,vec2(.345,.31),vec2(.048,.08))+spot(uv,vec2(.714,.337),vec2(.05,.09))+spot(uv,vec2(.219,.69),vec2(.036,.06));
                float flicker=.6+.23*sin(time*3.7)+.12*sin(time*7.3)+.05*sin(time*11.);
                col+=lamps*flicker*vec3(.10,.044,.008);
                float crystal=smoothstep(.14,.38,max(source.b,source.g)-source.r)*smoothstep(.18,.5,source.b)+smoothstep(.1,.3,source.b-source.g)*smoothstep(.30,.6,source.r);
                col+=crystal*(.02+.018*sin(time*1.6+uv.x*19.))*vec3(.45,.75,1.);
                vec2 dustUV=uv*vec2(110.,65.)+vec2(time*.16,-time*.20);
                vec2 cell=floor(dustUV),f=fract(dustUV)-.5;
                float dust=(1.-smoothstep(.015,.065,length(f)))*step(.988,hash(cell));
                col+=dust*.14*vec3(1.,.77,.42);
            }
            if(lake<.5&&mine<.5){
                vec2 grid=uv*vec2(130.,75.),cell=floor(grid),p=fract(grid)-.5;
                float stars=(1.-smoothstep(.015,.085,length(p)))*step(.977,hash(cell));
                col+=stars*sky*(1.-daylight)*(.17+.12*sin(time*.9+hash(cell)*20.))*vec3(.8,.88,1.);
            }
            gl_FragColor=vec4(clamp(col,0.,1.),1.);
        }
    `;
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
    function setupGPU(){
        const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);
        program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
        gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        const p=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
        locations={};for(const key of ['crop','offset','time','daylight','warmth','scene'])locations[key]=gl.getUniformLocation(program,key);
        textures=[dayImage,nightImage].map((image,i)=>{
            const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
            gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);gl.uniform1i(gl.getUniformLocation(program,i?'nightTexture':'dayTexture'),i);return texture;
        });
        gl.uniform1f(locations.scene,['beach','lake','town','mine'].indexOf(theme));canvas.dataset.renderer='webgl';
    }
    function geometry(){const scale=Math.max(canvas.width/nightImage.naturalWidth,canvas.height/nightImage.naturalHeight);return {width:nightImage.naturalWidth*scale,height:nightImage.naturalHeight*scale};}
    function drawFallback(){
        const {width,height}=geometry(),x=(canvas.width-width)/2;
        ctx.globalAlpha=1;ctx.drawImage(nightImage,x,0,width,height);
        if(theme==='lake'){ctx.globalAlpha=light;ctx.drawImage(dayImage,x,0,width,height);ctx.globalAlpha=1;}
        else{ctx.fillStyle=`rgba(7,20,54,${(1-light)*(theme==='mine'?.08:.65)})`;ctx.fillRect(0,0,canvas.width,canvas.height);}
        const t=elapsed/1000;
        // Graceful non-WebGL renderer: animated highlights, original full-detail artwork.
        for(let i=0;i<24;i++){
            const px=((i*.618)%1)*canvas.width,py=(theme==='beach'?.72:theme==='lake'?.83:.2)+((i*.37)%1)*.12;
            const alpha=(.04+.04*Math.sin(t*.8+i))*(theme==='town'?1-light:1);
            ctx.fillStyle=`rgba(221,237,255,${alpha})`;ctx.fillRect(px+Math.sin(t+i)*3,py*canvas.height,theme==='beach'||theme==='lake'?9:2,1);
        }
    }
    function draw(){
        updateClock();if(!ready||contextLost)return;
        if(gl){
            const {width,height}=geometry();gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(locations.crop,canvas.width/width,canvas.height/height);gl.uniform2f(locations.offset,(1-canvas.width/width)/2,0);
            gl.uniform1f(locations.time,elapsed/1000);gl.uniform1f(locations.daylight,light);gl.uniform1f(locations.warmth,warmth);gl.drawArrays(gl.TRIANGLES,0,6);
        }else if(ctx)drawFallback();
    }
    function animate(now){frame=0;if(document.hidden||paused||contextLost)return;if(!last)last=now;const delta=now-last;if(delta>=1000/30){elapsed+=Math.min(delta,100);last=now;draw();}frame=requestAnimationFrame(animate);}
    function restart(){cancelAnimationFrame(frame);frame=0;last=0;if(document.hidden||!ready||contextLost)return;draw();if(!paused)frame=requestAnimationFrame(animate);}
    function resize(){const dpr=Math.min(devicePixelRatio||1,1.5,1920/innerWidth,1200/innerHeight);canvas.width=Math.max(1,Math.round(innerWidth*dpr));canvas.height=Math.max(1,Math.round(innerHeight*dpr));restart();}
    function loadImage(url){return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Background unavailable: '+url));image.src=url;});}
    async function init(){
        try{
            nightImage=await loadImage(original);dayImage=theme==='lake'?await loadImage('assets/pixel-lake-day-bg.webp').catch(()=>nightImage):nightImage;
            if(gl)setupGPU();else canvas.dataset.renderer='canvas2d';
            ready=true;canvas.dataset.artwork=themes[theme];resize();
        }catch(error){canvas.style.display='none';console.warn('Using original background fallback.',error);}
    }
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;cancelAnimationFrame(frame);canvas.style.visibility='hidden';});
    canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;try{setupGPU();canvas.style.visibility='visible';restart();}catch(_){canvas.style.display='none';}});
    window.addEventListener('resize',resize);document.addEventListener('visibilitychange',restart);
    setInterval(()=>{if(!document.hidden){updateClock();if(paused)draw();}},30000);
    updateClock();init();
})();
