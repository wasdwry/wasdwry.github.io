/* Blend complete, consistently lit room paintings; animate their own water and lights. */
(()=>{'use strict';
const rooms=['hall','study'].map(name=>{const stage=document.querySelector(`#${name} .room-stage`),canvas=document.createElement('canvas');canvas.className='room-atmosphere';canvas.width=1660;canvas.height=948;canvas.setAttribute('aria-hidden','true');stage.prepend(canvas);const day=new Image(),night=new Image();day.src=`assets/pixel-cabin-${name}.webp`;night.src=`assets/pixel-cabin-${name}-night.webp`;return{name,stage,canvas,ctx:canvas.getContext('2d'),day,night,last:''};});
let elapsed=0,last=performance.now();
function paint(){const now=performance.now(),landscape=window.WasdwryLandscape;if(!landscape||document.hidden){last=now;return;}const paused=landscape.paused;if(!paused)elapsed+=Math.min(now-last,150)/1000;last=now;const light=landscape.daylight;
for(const room of rooms){if(document.body.dataset.scene!==room.name||!room.day.naturalWidth||!room.night.naturalWidth)continue;const key=`${light}:${paused?0:elapsed}`;if(room.last===key)continue;room.last=key;const {ctx,canvas,day,night}=room;
ctx.clearRect(0,0,1660,948);ctx.globalAlpha=1;ctx.drawImage(day,0,0,1660,948);ctx.globalAlpha=1-light;ctx.drawImage(night,0,0,1660,948);ctx.globalAlpha=1;
if(room.name==='study'){
 // Small displacements use pixels from the room artwork itself, never a pasted outdoor view.
 ctx.save();ctx.beginPath();ctx.rect(682,414,326,53);ctx.clip();
 for(let y=414;y<467;y+=3){const dx=paused?0:Math.sin(y*.23+elapsed*1.1)*.8;for(const [img,a] of [[day,1],[night,1-light]]){ctx.globalAlpha=a;ctx.drawImage(img,(681-dx)*img.naturalWidth/1660,y*img.naturalHeight/948,330*img.naturalWidth/1660,3*img.naturalHeight/948,681,y,330,3);}}
 ctx.restore();
}
if(!paused){ctx.save();ctx.globalCompositeOperation='screen';const [x,y,r]=room.name==='hall'?[500,470,95]:[1140,464,112];const glow=ctx.createRadialGradient(x,y,0,x,y,r);glow.addColorStop(0,`rgba(255,170,68,${(.022+.012*Math.sin(elapsed*1.8))*(1-light*.7)})`);glow.addColorStop(1,'rgba(255,170,68,0)');ctx.fillStyle=glow;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
canvas.dataset.daylight=String(light);canvas.dataset.frame=String(elapsed);room.stage.dataset.atmosphere='ready';
}}
setInterval(paint,100);document.addEventListener('visibilitychange',paint);for(const r of rooms){r.day.onload=paint;r.night.onload=paint;}
})();
