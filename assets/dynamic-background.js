/* Real-time pixel landscapes, illuminated by the visitor's local clock. */
(function () {
    'use strict';
    const page = location.pathname.split('/').pop() || 'index.html';
    const theme = page.includes('diary') ? 'lake' : page.includes('posts') ? 'town' : page.includes('favorites') ? 'mine' : 'beach';
    const canvas = document.createElement('canvas');
    canvas.className = 'dynamic-bg';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) return;
    const style = document.createElement('style');
    style.textContent = `
        body{background-image:none!important;background-color:#182a42}
        body::before,body::after{display:none!important}
        .dynamic-bg{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;image-rendering:pixelated}
        header,main,footer{position:relative;z-index:1}
        header .navbar,header .hero{color:#f7fcff;text-shadow:0 2px 8px #142d46}
        header nav a,header .hero p{color:#f7fcff;text-shadow:0 2px 8px #142d46}
        header .button{text-shadow:none}
        footer{color:#f7fcff;text-shadow:0 1px 5px #142d46}
        body.background-focus header,body.background-focus main,body.background-focus footer{visibility:hidden;pointer-events:none}
        body.background-focus .music-player,body.background-focus .top-button{visibility:hidden;pointer-events:none}
        .background-controls{position:fixed;right:18px;bottom:68px;z-index:24;display:flex;gap:6px}
        .background-controls button{min-width:52px;min-height:42px;padding:0 12px;border:1px solid #b6c9d5;border-radius:8px;background:#fff7e1;color:#16324d;font:700 14px Arial,"Microsoft YaHei",sans-serif;box-shadow:0 6px 20px #142d4626;cursor:pointer}
        .background-controls button:focus-visible{outline:3px solid #1769aa;outline-offset:3px}
        @media(max-width:680px){.background-controls{left:12px;right:auto;bottom:18px}}
    `;
    document.head.appendChild(style);
    document.body.prepend(canvas);
    document.body.dataset.landscape = theme;
    let w=0,h=0,frame=0,lastFrame=0,elapsed=0;
    const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
    let paused=reducedMotion.matches;
    const controls=document.createElement('div');controls.className='background-controls';
    const focusButton=document.createElement('button'),pauseButton=document.createElement('button');
    focusButton.type=pauseButton.type='button';
    function focusBackground(active){
        document.body.classList.toggle('background-focus',active);
        focusButton.textContent=active?'返回网页':'背景';
        focusButton.setAttribute('aria-label',active?'返回网页':'欣赏动态背景');
        focusButton.setAttribute('aria-pressed',String(active));
    }
    focusBackground(false);
    focusButton.addEventListener('click',()=>focusBackground(!document.body.classList.contains('background-focus')));
    document.addEventListener('keydown',event=>{if(event.key==='Escape')focusBackground(false);});
    function updatePauseButton(){pauseButton.textContent=paused?'播放动画':'暂停动画';pauseButton.setAttribute('aria-label',paused?'播放背景动画':'暂停背景动画');pauseButton.setAttribute('aria-pressed',String(paused));}
    pauseButton.addEventListener('click',()=>{paused=!paused;updatePauseButton();restart();});
    reducedMotion.addEventListener('change',()=>{paused=reducedMotion.matches;updatePauseButton();restart();});
    updatePauseButton();controls.append(focusButton,pauseButton);document.body.appendChild(controls);

    function noise(i){const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n);}
    const stars=Array.from({length:90},(_,i)=>({x:noise(i),y:noise(i+90)*.57,phase:noise(i+180)*6.28}));
    const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
    const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
    const rgb=c=>`rgb(${c.map(Math.round).join(',')})`;
    // Fixed local-time dawn/dusk; no geolocation or astronomical sunrise claim.
    const keys=[
        [0,[8,17,42],[43,58,88],0], [5,[25,32,67],[116,86,119],.08],
        [7,[91,161,192],[255,205,157],.8], [10,[63,151,193],[191,226,221],1],
        [16,[65,149,190],[193,224,209],1], [18,[87,83,143],[248,156,119],.48],
        [20,[15,26,60],[68,76,111],0], [24,[8,17,42],[43,58,88],0]
    ];
    let light,skyTop,skyBottom,hour,previousMinute=-1;
    function updateClock(){
        const date=new Date(),minute=date.getHours()*60+date.getMinutes();
        if(minute===previousMinute)return;
        previousMinute=minute;hour=minute/60;
        const end=keys.findIndex(k=>k[0]>hour),a=keys[end-1],b=keys[end],t=(hour-a[0])/(b[0]-a[0]);
        skyTop=mix(a[1],b[1],t);skyBottom=mix(a[2],b[2],t);light=a[3]+(b[3]-a[3])*t;
        document.body.dataset.timeOfDay=hour<5||hour>=20?'night':hour<8?'dawn':hour<17?'day':'dusk';
        canvas.dataset.localHour=String(date.getHours());
    }
    function color(night,day){return rgb(mix(night,day,light));}
    function rect(x,y,width,height,fill){ctx.fillStyle=fill;ctx.fillRect(Math.floor(x),Math.floor(y),Math.ceil(width),Math.ceil(height));}
    function polygon(points,fill){ctx.fillStyle=fill;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(Math.round(x),Math.round(y)):ctx.moveTo(Math.round(x),Math.round(y)));ctx.closePath();ctx.fill();}
    function disk(x,y,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
    function glow(x,y,r,fill){const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,fill);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}
    function celestialProgress(){return hour>=6&&hour<19?(hour-6)/13:((hour+5)%24)/11;}
    function drawSky(t){
        const g=ctx.createLinearGradient(0,0,0,h*.72);g.addColorStop(0,rgb(skyTop));g.addColorStop(1,rgb(skyBottom));ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
        for(const s of stars){ctx.globalAlpha=clamp(1-light*1.8)*(.5+.5*Math.sin(t*.8+s.phase)**2);rect(s.x*w,s.y*h,1,1,'#f3f3d7');}ctx.globalAlpha=1;
        const day=hour>=6&&hour<19,progress=celestialProgress(),x=w*(.14+.72*progress),y=h*(.53-Math.sin(progress*Math.PI)*.39),r=Math.max(7,Math.min(w,h)*.035);
        glow(x,y,r*4,day?'#ffd99b66':'#cde5ff30');disk(x,y,r,day?'#ffe9ab':'#e3e8db');
        if(!day)disk(x+r*.4,y-r*.25,r*.8,rgb(skyTop));
        for(let i=0;i<7;i++){
            const cw=36+noise(i+9)*45,cx=((noise(i+3)*(w+180)+t*(1+i*.12))%(w+180))-90,cy=h*(.11+noise(i+21)*.28),cloud=color([60,72,104],[232,240,227]);
            ctx.globalAlpha=.6;rect(cx,cy,cw,7,cloud);rect(cx+cw*.12,cy-5,cw*.66,6,cloud);rect(cx+cw*.3,cy-10,cw*.3,6,cloud);ctx.globalAlpha=1;
        }
        const meteor=t%23;
        if(light<.3&&meteor<1.3){ctx.strokeStyle=`rgba(221,239,255,${Math.sin(meteor/1.3*Math.PI)*.8})`;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(w*.7+meteor*35,h*.13+meteor*16);ctx.lineTo(w*.7+meteor*35-20,h*.13+meteor*16-9);ctx.stroke();}
        if(light>.35&&theme!=='mine')for(let i=0;i<3;i++){
            const bx=((t*5+i*27)%(w+80))-40,by=h*.32+Math.sin(t*.3+i)*5+i*5,flap=Math.sin(t*5+i)*2;
            ctx.strokeStyle=color([89,106,129],[52,89,101]);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(bx-4,by+flap);ctx.lineTo(bx,by);ctx.lineTo(bx+4,by+flap);ctx.stroke();
        }
    }
    function ridge(base,amplitude,seed,fill){const points=[[0,h]];for(let x=0;x<=w+8;x+=8)points.push([x,base+Math.sin(x/w*8+seed)*amplitude+Math.sin(x/w*19+seed)*amplitude*.3]);points.push([w,h]);polygon(points,fill);}
    function water(top,t,beach){
        const g=ctx.createLinearGradient(0,top,0,h);g.addColorStop(0,color([32,57,88],[71,154,166]));g.addColorStop(1,color([10,30,52],[22,108,129]));ctx.fillStyle=g;ctx.fillRect(0,top,w,h-top);
        for(let i=0;i<95;i++){const depth=noise(i+710),y=top+depth*(h-top),x=(noise(i+930)*w+Math.sin(t*.6+i)*4+w)%w;ctx.globalAlpha=.12+.2*(.5+.5*Math.sin(t*1.5+i));rect(x,y,3+depth*18,1,color([166,196,217],[208,243,222]));}ctx.globalAlpha=1;
        const reflectionX=w*(.14+.72*celestialProgress());
        for(let i=0;i<20;i++){const y=top+4+i*3,span=4+i*1.2;ctx.globalAlpha=.13;rect(reflectionX-span/2+Math.sin(t*1.2+i)*4,y,span,1,'#fff1c2');}ctx.globalAlpha=1;
        if(beach){
            const shore=h*.83;polygon([[0,shore+7],[w*.3,shore],[w*.65,shore+10],[w,shore+1],[w,h],[0,h]],color([67,68,76],[219,197,147]));
            for(let j=0;j<3;j++){
                ctx.strokeStyle=color([99,130,151],[223,246,225]);ctx.globalAlpha=.65-j*.15;ctx.beginPath();
                for(let x=0;x<=w;x+=3){const y=shore-3-j*7+Math.sin(x*.035+t*.8+j)*3+Math.sin(t*.55)*2;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
            }ctx.globalAlpha=1;
            for(let i=0;i<100;i++)rect(noise(i+270)*w,shore+15+noise(i+470)*Math.max(0,h-shore-15),1,1,color([87,83,82],[190,169,125]));
        }
    }
    function tree(x,base,size,t,pine=false){
        const sway=Math.sin(t*.7+x)*size*.025;rect(x-2,base-size*.65,4,size*.65,color([24,34,44],[101,91,64]));
        if(pine)for(let i=0;i<3;i++)polygon([[x+sway,base-size+i*size*.2],[x-size*(.23+i*.05),base-size*.45+i*size*.19],[x+size*(.23+i*.05),base-size*.45+i*size*.19]],color([20,45,54],[43,100+i*9,82]));
        else{disk(x+sway,base-size*.72,size*.32,color([24,55,57],[65,125,83]));disk(x-size*.19+sway,base-size*.6,size*.25,color([20,45,52],[48,106,75]));disk(x+size*.19+sway,base-size*.58,size*.24,color([26,58,60],[79,137,86]));}
    }
    function house(x,base,size,t,index){
        rect(x,base-size*.65,size,size*.65,color([50,58,78],[224,202,156]));rect(x+size*.72,base-size*.65,size*.28,size*.65,color([38,45,63],[182,161,128]));
        polygon([[x-4,base-size*.65],[x+size*.48,base-size],[x+size+5,base-size*.65]],color([55,45,63],[145,91,75]));rect(x+size*.68,base-size*.99,5,size*.28,color([48,44,57],[131,92,75]));
        const warm=light<.65?`rgb(255,${Math.round(193+Math.sin(t*1.1+index)*8)},112)`:'#6b9a9e';
        for(let k=0;k<2;k++){const wx=x+size*(.14+k*.48);rect(wx,base-size*.45,size*.19,size*.19,warm);rect(wx+size*.09,base-size*.45,1,size*.19,'#74654e');}
        rect(x+size*.43,base-size*.27,size*.16,size*.27,color([24,33,49],[106,91,68]));
        for(let k=0;k<4;k++){const rise=(t*5+k*10)%40;ctx.globalAlpha=(1-rise/40)*.25;disk(x+size*.73+Math.sin(t*.5+k)*3,base-size-rise,2+rise*.07,color([175,182,197],[235,236,221]));}ctx.globalAlpha=1;
    }
    function grass(base,t){
        ctx.strokeStyle=color([23,53,53],[66,111,66]);ctx.lineWidth=1;
        for(let i=0;i<90;i++){const x=noise(i+550)*w,y=base+noise(i+660)*(h-base);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+Math.sin(t*1.1+i)*2,y-3-noise(i)*6);ctx.stroke();}
        if(light<.5)for(let i=0;i<12;i++){const x=noise(i+890)*w+Math.sin(t*.4+i)*9,y=base-8+Math.cos(t*.6+i)*12;ctx.globalAlpha=(.5+.5*Math.sin(t*1.4+i))*(1-light);disk(x,y,1,'#eee8a3');}ctx.globalAlpha=1;
    }
    function drawBeach(t){
        ridge(h*.57,h*.018,2,color([32,51,72],[103,165,171]));water(h*.59,t,true);
        const x=w*.08,y=h*.9,s=Math.min(w*.28,h*.4);
        polygon([[x-3,y],[x+2,y],[x+s*.18,y-s],[x+s*.12,y-s]],color([32,39,46],[115,100,70]));
        const crown=x+s*.15,top=y-s;
        for(let i=0;i<7;i++){const direction=i/6*Math.PI,reach=s*.62,sway=Math.sin(t*.9+i)*3,ex=crown+Math.cos(direction)*reach,ey=top+Math.sin(direction)*reach*.35+sway;polygon([[crown,top],[crown+Math.cos(direction)*reach*.5,top-8+Math.sin(direction)*8],[ex,ey],[crown+Math.cos(direction)*reach*.45,top+8]],color([21,53,52],[49,112+i*3,77]));}
        const bx=((t*.9+w*.56)%(w+70))-35,by=h*.64+Math.sin(t*.8)*1.5;
        polygon([[bx-7,by],[bx+8,by],[bx+4,by+4],[bx-4,by+4]],color([24,36,53],[118,81,62]));rect(bx,by-15,1,15,'#acb6ad');polygon([[bx-1,by-15],[bx-1,by-2],[bx-10,by-2]],color([132,151,167],[249,235,197]));
    }
    function drawLake(t){
        ridge(h*.53,h*.11,1,color([34,43,72],[122,158,164]));ridge(h*.61,h*.065,3,color([24,43,62],[69,119,119]));water(h*.65,t,false);
        polygon([[0,h*.68],[w*.24,h*.71],[w*.35,h*.79],[w*.12,h*.89],[0,h*.91]],color([19,44,49],[79,121,83]));
        house(w*.06,h*.72,Math.min(w*.14,48),t,0);tree(w*.025,h*.72,55,t,true);tree(w*.23,h*.76,38,t,true);
        polygon([[0,h*.94],[w*.28,h*.91],[w*.56,h*.96],[w,h*.87],[w,h],[0,h]],color([17,37,42],[63,102,70]));
        for(let i=0;i<4;i++)tree(w*(.88+i*.045),h*.94,40+i*10,t,true);grass(h*.94,t);
    }
    function drawTown(t){
        ridge(h*.58,h*.07,2,color([39,54,76],[111,151,136]));ridge(h*.68,h*.045,5,color([30,52,57],[90,131,91]));rect(0,h*.77,w,h*.23,color([31,45,49],[146,151,107]));
        polygon([[w*.44,h*.69],[w*.54,h*.69],[w*.78,h],[w*.3,h]],color([58,62,73],[202,187,155]));
        for(let i=0;i<6;i++){const x=w*(.03+i*.175),base=h*(.72+(i%2)*.08);house(x,base,Math.min(w*.13,52),t,i);}
        for(let i=0;i<5;i++)tree(w*(.02+i*.24),h*.89,35+noise(i)*20,t);
        for(let i=0;i<4;i++){const x=w*(.38+i*.09),y=h*(.78+i*.055);rect(x,y-19,2,19,color([25,37,46],[82,87,76]));rect(x-2,y-22,6,4,light<.6?'#ffdb94':'#a6ad96');if(light<.6)glow(x+1,y-20,17,`rgba(255,205,118,${(1-light)*.3})`);}grass(h*.93,t);
    }
    function drawMine(t){
        // A cave opening reveals the time-sensitive sky; crystals and torches stay animated.
        ridge(h*.62,h*.06,2,color([26,47,64],[86,132,112]));rect(0,h*.76,w,h*.24,color([22,24,40],[66,64,76]));
        polygon([[0,0],[w*.32,0],[w*.29,h*.16],[w*.25,h*.28],[w*.26,h*.54],[w*.18,h*.78],[0,h]],'#212039');
        polygon([[w,0],[w*.7,0],[w*.76,h*.2],[w*.73,h*.4],[w*.81,h*.68],[w,h]],'#29233f');
        polygon([[0,0],[w,0],[w,h*.13],[w*.8,h*.12],[w*.68,h*.2],[w*.58,h*.14],[w*.39,h*.19],[w*.2,h*.12],[0,h*.22]],'#171b30');
        for(let i=0;i<30;i++){const x=i%2?w*(.83+noise(i+10)*.17):w*noise(i+10)*.2,y=h*noise(i+30);polygon([[x,y],[x+14,y-9],[x+23,y+5],[x+9,y+13]],i%3?'#302944':'#3b304d');}
        polygon([[w*.46,h*.76],[w*.48,h*.76],[w*.36,h],[w*.33,h]],'#81717b');polygon([[w*.53,h*.76],[w*.55,h*.76],[w*.68,h],[w*.65,h]],'#81717b');
        for(let i=0;i<7;i++){const z=i/7;rect(w*(.45-.13*z),h*(.78+.22*z*z),w*(.13+.23*z),2,'#554451');}
        for(let i=0;i<8;i++){
            const x=w*(i<4?.04+i*.048:.79+(i-4)*.052),base=h*(.68+noise(i+50)*.26),size=12+noise(i+70)*17,pulse=.65+.35*Math.sin(t*1.1+i);
            glow(x,base-size*.4,size*1.6,`rgba(107,211,228,${pulse*.22})`);
            polygon([[x,base-size],[x+size*.3,base-size*.65],[x+size*.2,base],[x-size*.23,base],[x-size*.32,base-size*.6]],'#6099b8');
            polygon([[x,base-size],[x+size*.3,base-size*.65],[x+size*.2,base],[x,base-size*.14]],'#b8cee3');rect(x,base-size*.65,1,3,`rgba(233,254,255,${pulse})`);
        }
        for(const x of [w*.19,w*.81]){const y=h*.5,f=Math.sin(t*8+x)*1.4+Math.sin(t*13)*.6;glow(x,y,35+f,'#ffac5245');rect(x-1,y,3,15,'#775b50');polygon([[x-4,y+1],[x-3,y-6],[x+f,y-13-f],[x+4,y-4],[x+3,y+2]],'#f4ac66');polygon([[x-2,y],[x,y-7],[x+2,y]],'#ffe5a0');}
        for(let i=0;i<18;i++){ctx.globalAlpha=.15+.2*Math.sin(t+i)**2;rect(noise(i+830)*w,(noise(i+860)*h+t*2)%h,1,1,'#d8c7a1');}ctx.globalAlpha=1;
    }
    const scenes={beach:drawBeach,lake:drawLake,town:drawTown,mine:drawMine};
    function draw(){
        updateClock();const t=elapsed/1000;drawSky(t);scenes[theme](t);
        const shade=ctx.createLinearGradient(0,0,0,h*.56);shade.addColorStop(0,'#071c3545');shade.addColorStop(1,'#071c3500');ctx.fillStyle=shade;ctx.fillRect(0,0,w,h*.56);
    }
    function animate(now){
        frame=0;if(document.hidden||paused)return;
        if(!lastFrame)lastFrame=now;const delta=now-lastFrame;
        if(delta>=1000/30){elapsed+=Math.min(delta,100);lastFrame=now;draw();}frame=requestAnimationFrame(animate);
    }
    function restart(){cancelAnimationFrame(frame);frame=0;lastFrame=0;if(document.hidden)return;draw();if(!paused)frame=requestAnimationFrame(animate);}
    function resize(){
        // Bound cost on high-DPI/large screens. CSS scales the pixel art, not devicePixelRatio.
        const scale=Math.max(2.5,innerWidth/720,innerHeight/480);
        w=canvas.width=Math.max(1,Math.round(innerWidth/scale));h=canvas.height=Math.max(1,Math.round(innerHeight/scale));ctx.imageSmoothingEnabled=false;restart();
    }
    window.addEventListener('resize',resize);document.addEventListener('visibilitychange',restart);
    setInterval(()=>{if(!document.hidden){updateClock();if(paused)draw();}},30000);
    resize();
})();
