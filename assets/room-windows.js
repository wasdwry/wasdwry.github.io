/* Glass-only masks leave timber frames, mullions and foreground furnishings intact.
   Coordinates refer to the 1660 x 948 interior illustrations. */
(()=>{'use strict';
const specs={hall:[
 {rect:[0,90,85,440],panes:[[[0,97],[20,112],[20,222],[0,215]],[[35,122],[76,153],[76,237],[35,227]],[[0,246],[20,252],[20,516],[0,522]],[[35,259],[76,269],[76,492],[35,509]]]},
 {rect:[289,344,61,113],panes:[[[294,352],[316,354],[316,378],[294,376]],[[322,355],[341,357],[341,381],[322,379]],[[294,385],[316,387],[316,410],[294,408]],[[322,389],[341,391],[341,414],[322,412]],[[294,418],[316,420],[316,443],[294,440]],[[322,422],[341,424],[341,446],[322,444]]]},
 {rect:[1175,330,74,131],panes:[[[1179,337],[1202,337],[1202,360],[1179,360]],[[1210,337],[1238,337],[1238,360],[1210,360]],[[1179,370],[1202,370],[1202,393],[1179,393]],[[1210,370],[1238,370],[1238,393],[1210,393]],[[1179,403],[1202,403],[1202,440],[1179,440]],[[1210,403],[1238,403],[1238,449],[1210,449]]]},
 {rect:[1600,163,60,340],panes:[[[1606,198],[1660,176],[1660,309],[1606,324]],[[1606,339],[1660,327],[1660,428],[1636,432],[1620,418],[1606,427]]]}
],study:[{rect:[0,154,20,348],panes:[[[0,160],[14,168],[14,277],[0,275]],[[0,301],[14,304],[14,491],[0,495]]]}]};
const night=new Image();night.src='assets/pixel-starry-night-bg.webp';
const rooms=Object.entries(specs).map(([name,windows])=>{const canvas=document.createElement('canvas');canvas.className='room-windows';canvas.width=1660;canvas.height=948;canvas.setAttribute('aria-hidden','true');document.querySelector(`#${name} .room-stage`).appendChild(canvas);return{name,windows,canvas,ctx:canvas.getContext('2d'),last:''};});
let time=0,last=performance.now();
function draw(){const now=performance.now(),landscape=window.WasdwryLandscape;if(!landscape||!night.complete||!night.naturalWidth||document.hidden){last=now;return;}const moving=!landscape.paused;if(moving)time+=Math.min(now-last,150)/1000;last=now;const light=landscape.daylight,alpha=1-light;
 for(const room of rooms){if(document.body.dataset.scene!==room.name)continue;const key=`${light}:${moving?time:0}`;if(key===room.last)continue;room.last=key;const {ctx,canvas}=room;ctx.clearRect(0,0,1660,948);canvas.dataset.daylight=String(light);canvas.dataset.frame=String(time);if(alpha<=0)continue;
 for(const window of room.windows){ctx.save();ctx.beginPath();for(const pane of window.panes){ctx.moveTo(...pane[0]);for(const point of pane.slice(1))ctx.lineTo(...point);ctx.closePath();}ctx.clip();ctx.globalAlpha=alpha;const [x,y,w,h]=window.rect;
 // A shared moonlit landscape, cropped through each original perspective window.
 const sourceX=night.naturalWidth*.55+Math.sin(time*.25)*1.2;
 ctx.drawImage(night,sourceX,night.naturalHeight*.25,night.naturalWidth*.30,night.naturalHeight*.70,x,y,w,h);
 ctx.globalAlpha=alpha*(.12+.07*Math.sin(time*1.3));ctx.fillStyle='#dceaff';ctx.fillRect(x+w*.56,y+h*.28,1.4,1.4);ctx.restore();}
 }
}
night.addEventListener('load',draw);setInterval(draw,100);document.addEventListener('visibilitychange',draw);
})();
