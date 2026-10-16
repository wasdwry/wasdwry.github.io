/* Layered animation retains the original artwork and never moves the buildings. */
import { clamp, lerp, smooth, lightingAtHour } from './scene-clock.mjs';

export function newCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
}

export function loadArtwork(name) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Unable to load scene: ' + name));
        image.src = new URL(name, import.meta.url).href;
    });
}

export function seededRandom(seed = 1479) {
    return () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
    };
}

export async function createOutdoorScene() {
  const W = 1716, H = 916;
  const canvas = newCanvas(W, H), ctx = canvas.getContext('2d', {alpha:false});
  const makeCanvas = newCanvas;
  const random = seededRandom();
  let t = 0;
  let dayGround, nightGround, dayWater, nightWater, moon;
  let cloudLayers = [];
  const stars=Array.from({length:170}, () => ({x:random()*W,y:20+random()*650,s:random()>.92?3:2,p:random()*6.28,v:.5+random()}));
  const fireflies=Array.from({length:20}, () => ({x:40+random()*650,y:690+random()*180,p:random()*6.28,s:.4+random()*.7}));
  function groundCanvas(img, mask) {
    const c=makeCanvas(W,H),g=c.getContext('2d');
    g.drawImage(img,0,0,W,H); const data=g.getImageData(0,0,W,H);
    for(let i=0;i<mask.length;i++) data.data[i*4+3]=mask[i];
    g.putImageData(data,0,0); return c;
  }
  function waterCanvas(img, dayPixels) {
    const c=makeCanvas(W,H),g=c.getContext('2d');
    g.drawImage(img,0,0,W,H);
    const data=g.getImageData(0,0,W,H);
    const outline=[[1067,741],[1302,741],[1280,755],[1350,771],[1468,780],[1435,817],[1384,860],[1250,879],[1170,867],[1070,848],[975,819],[880,810],[843,798],[770,785],[759,777],[932,766],[1050,756]];
    const path=new Path2D(); outline.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y)); path.closePath();
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
      const i=(y*W+x)*4;
      const r=dayPixels[i],gg=dayPixels[i+1],b=dayPixels[i+2];
      const isWater=(b>gg*.99&&gg>r*1.08)||(r>155&&gg>190&&b>210);
      if(y<740||y>880||!isWater||!g.isPointInPath(path,x,y)) data.data[i+3]=0;
    }
    g.putImageData(data,0,0); return c;
  }
  function prepare(day,night) {
    const source=makeCanvas(W,H),sg=source.getContext('2d',{willReadFrequently:true});
    sg.drawImage(day,0,0,W,H);
    const pixels=sg.getImageData(0,0,W,H).data;
    const mask=new Uint8ClampedArray(W*H);
    const sky=new Uint8Array(W*H);
    const house=new Path2D();
    [[21,581],[92,481],[153,477],[152,438],[199,438],[199,466],[305,454],[397,574],[438,599],[438,705],[21,705]].forEach(([x,y],i)=>i?house.lineTo(x,y):house.moveTo(x,y));
    house.closePath();
    for(let y=0;y<H;y++) for(let x=0;x<W;x++) {
      const k=y*W+x,i=k*4,r=pixels[i],g=pixels[i+1],b=pixels[i+2];
      const blue=b>g*1.055&&b>r*1.15&&b>145;
      const pale=r>140&&g>170&&b>180&&b>=r*.9;
      const protectedHouse=x<439&&y>434&&y<707&&sg.isPointInPath(house,x,y);
      const clearHorizon=y<575||g>185+(y-590)*.19;
      const isSky=!protectedHouse&&y<738&&clearHorizon&&(blue||pale);
      sky[k]=isSky?1:0; mask[k]=isSky?0:255;
    }
    dayGround=groundCanvas(day,mask);
    nightGround=groundCanvas(day,mask);
    const nground=nightGround.getContext('2d');
    const ndark=nground.getImageData(0,0,W,H);
    for(let i=0;i<ndark.data.length;i+=4) {
      const r=ndark.data[i],g=ndark.data[i+1],b=ndark.data[i+2];
      ndark.data[i]=r*.29+b*.04;ndark.data[i+1]=g*.36+b*.03;ndark.data[i+2]=b*.49+g*.1+12;
    }
    nground.putImageData(ndark,0,0);
    nground.globalCompositeOperation='source-atop';
    for(const [x,y,radius] of [[104,630,58],[176,627,55],[302,539,40],[307,644,76],[260,622,34],[355,631,36]]) {
      const g=nground.createRadialGradient(x,y,2,x,y,radius);
      g.addColorStop(0,'rgba(255,177,65,.26)');g.addColorStop(1,'rgba(255,177,65,0)');
      nground.fillStyle=g;nground.fillRect(x-radius,y-radius,radius*2,radius*2);
    }
    nground.globalCompositeOperation='source-over';
    for(const [x,y,w,h] of [[88,608,31,43],[158,607,34,43],[289,520,25,38],[293,613,35,61],[252,610,16,22],[349,620,14,20]]) nground.drawImage(night,x,y,w,h,x,y,w,h);
    dayWater=waterCanvas(day,pixels); nightWater=waterCanvas(nightGround,pixels);
    const cloudRects=[
      [0,95,354,235,-3.2], [65,334,115,34,-1.2], [197,380,566,127,-3.1],
      [638,510,404,68,2.5], [1125,318,591,260,3.2],
      [486,578,148,55,0], [643,605,180,33,1], [723,642,144,35,.6],
      [888,624,199,35,.8], [1150,600,179,31,1], [1120,649,295,33,.5],
      [1372,578,208,58,.7], [1624,578,92,58,0]
    ];
    cloudLayers=cloudRects.map(([x,y,w,h,speed])=>{
      const c=makeCanvas(w,h),g=c.getContext('2d');
      const d=g.createImageData(w,h);
      for(let cy=0;cy<h;cy++) for(let cx=0;cx<w;cx++) {
        const sx=x+cx,sy=y+cy,k=sy*W+sx,i=k*4,j=(cy*w+cx)*4;
        if(!sky[k]) continue;
        const r=pixels[i],gg=pixels[i+1],b=pixels[i+2];
        const skyR=pixels[(sy*W+1100)*4];
        const leftEdge=x===0?1:smooth(0,10,cx);
        const rightEdge=x+w===W?1:smooth(0,10,w-1-cx);
        const a=smooth(8,36,r-skyR)*leftEdge*rightEdge*smooth(0,3,cy)*smooth(0,3,h-1-cy);
        d.data[j]=r;d.data[j+1]=gg;d.data[j+2]=b;d.data[j+3]=Math.round(a*255);
      }
      g.putImageData(d,0,0);
      const n=makeCanvas(w,h),ng=n.getContext('2d');
      const nd=ng.createImageData(w,h);
      const dusk=makeCanvas(w,h),dg=dusk.getContext('2d');
      const dd=dg.createImageData(w,h);
      for(let i=0;i<d.data.length;i+=4) {
        nd.data[i]=d.data[i]*.24;nd.data[i+1]=d.data[i+1]*.4;nd.data[i+2]=d.data[i+2]*.67;nd.data[i+3]=d.data[i+3];
        dd.data[i]=Math.min(255,d.data[i]*.96+25);dd.data[i+1]=d.data[i+1]*.69+25;dd.data[i+2]=d.data[i+2]*.65+15;dd.data[i+3]=d.data[i+3];
      }
      ng.putImageData(nd,0,0);dg.putImageData(dd,0,0);
      return {day:c,night:n,dusk,x,y,w,h,speed};
    });
    moon=makeCanvas(132,132);const mg=moon.getContext('2d');
    mg.drawImage(night,1148,78,132,132,0,0,132,132);
    const md=mg.getImageData(0,0,132,132);
    for(let i=0;i<md.data.length;i+=4) md.data[i+3]*=smooth(55,90,md.data[i]);
    mg.putImageData(md,0,0);
  }
  function color(day,night,warm,l) {
    const a=day.map((v,i)=>lerp(night[i],v,l.daylight));
    return 'rgb('+a.map((v,i)=>Math.round(lerp(v,warm[i],l.dusk))).join(',')+')';
  }
  function drawSky(l) {
    const gradient=ctx.createLinearGradient(0,0,0,740);
    gradient.addColorStop(0,color([46,154,244],[7,12,65],[87,94,164],l));
    gradient.addColorStop(.62,color([76,176,249],[17,51,135],[202,137,161],l));
    gradient.addColorStop(1,color([129,211,254],[35,104,193],[255,204,142],l));
    ctx.fillStyle=gradient;ctx.fillRect(0,0,W,H);
    const starAlpha=smooth(.36,.92,l.night)*(1-l.dusk*.7);
    if(starAlpha>.01) {
      for(const s of stars) {
        const glow=.46+.25*Math.sin(t*s.v+s.p)+.12*Math.sin(t*.27+s.p);
        ctx.globalAlpha=starAlpha*glow;ctx.fillStyle='#c7e9ff';
        ctx.fillRect(Math.floor(s.x),Math.floor(s.y),s.s,s.s);
        if(s.s===3) {
          ctx.globalAlpha=starAlpha*glow*.33;
          ctx.fillRect(Math.floor(s.x)-3,Math.floor(s.y)+1,9,1);
          ctx.fillRect(Math.floor(s.x)+1,Math.floor(s.y)-3,1,9);
        }
      }
    }
    ctx.globalAlpha=smooth(.25,.88,l.night);
    const glow=ctx.createRadialGradient(1214,144,40,1214,144,112);
    glow.addColorStop(0,'rgba(157,206,255,.15)');glow.addColorStop(1,'rgba(157,206,255,0)');
    ctx.fillStyle=glow;ctx.fillRect(1100,30,230,230);ctx.drawImage(moon,1148,78);
    ctx.globalAlpha=1;
    for(const c of cloudLayers) {
      const drift=c.speed*12*(1-Math.cos(t/12));
      const x=c.x+drift;
      const px=Math.round(x),py=c.y;
      ctx.globalAlpha=1;ctx.drawImage(c.day,px,py);
      if(l.night>.001) {ctx.globalAlpha=l.night;ctx.drawImage(c.night,px,py);}
      if(l.dusk>.001) {ctx.globalAlpha=l.dusk;ctx.drawImage(c.dusk,px,py);}
    }
    ctx.globalAlpha=1;
  }
  function drawLandscape(l) {
    ctx.drawImage(dayGround,0,0);
    ctx.globalAlpha=l.night;ctx.drawImage(nightGround,0,0);ctx.globalAlpha=1;
    for(let y=740;y<881;y+=3) {
      const depth=(y-740)/141;
      const dx=Math.round(Math.sin(y*.33-t*1.65)*(1+depth*2.4)+Math.sin(y*.075+t*.75)*1.3);
      ctx.globalAlpha=1;ctx.drawImage(dayWater,600,y,1000,3,600+dx,y,1000,3);
      ctx.globalAlpha=l.night;ctx.drawImage(nightWater,600,y,1000,3,600+dx,y,1000,3);
    }
    ctx.globalAlpha=1;
    for(let i=0;i<52;i++) {
      const phase=(i*.61803398875+t*.021)%1;
      const y=743+phase*98;
      const spread=15+phase*82;
      const x=1190+Math.sin(i*34.17)*spread+Math.sin(t*.6+i)*9;
      const flicker=Math.pow(Math.max(0,Math.sin(t*1.7+i*2.3)),3);
      ctx.globalAlpha=(.06+flicker*.30)*(1-l.dusk*.3);
      ctx.fillStyle=l.night>.6?'#bce4ff':'#efffff';
      ctx.fillRect(Math.round(x),Math.round(y),Math.round(3+phase*13),1+(phase>.7?1:0));
    }
    ctx.globalAlpha=1;
  }
  function drawLife(l) {
    // Sparse stepped puffs keep the motion compatible with the original pixel art.
    for(let i=0;i<20;i++) {
      const age=(t*.19+i/20)%1;
      const x=177+age*26+Math.sin(age*10-t*.55)*age*10;
      const y=437-age*105;
      const size=Math.round(3+age*10);
      const alpha=Math.sin(age*Math.PI)*(.12+l.night*.035);
      ctx.globalAlpha=alpha;ctx.fillStyle=l.night>.6?'#abb9dd':'#e9f0ee';
      const px=Math.round(x/2)*2,py=Math.round(y/2)*2;
      ctx.fillRect(px-size/2,py-size*.5,size,size*.6);
      ctx.fillRect(px-size*.25,py-size*.7,size*.65,size);
    }
    ctx.globalAlpha=1;
    const flyAlpha=smooth(.25,.9,l.night);
    if(flyAlpha>.01) {
      for(const f of fireflies) {
        const x=f.x+Math.sin(t*f.s*.32+f.p)*23,y=f.y+Math.cos(t*.34+f.p)*11;
        const alpha=Math.pow(Math.max(0,Math.sin(t*.8+f.p)),3)*flyAlpha;
        ctx.globalAlpha=alpha*.14;ctx.fillStyle='#e6ef97';ctx.fillRect(Math.round(x)-3,Math.round(y)-3,8,8);
        ctx.globalAlpha=alpha*.85;ctx.fillRect(Math.round(x),Math.round(y),2,2);
      }
    }
    ctx.globalAlpha=1;
    // A quiet pair of birds crosses the open sky; no movement is applied to the house.
    if(l.daylight>.4) {
      const bx=(t*11+820)%(W+240)-120,by=315+Math.sin(t*.25)*12;
      ctx.globalAlpha=l.daylight*.58;ctx.fillStyle='#426585';
      for(let k=0;k<2;k++) {
        const x=Math.round(bx-k*22),y=Math.round(by+k*10),wing=Math.sin(t*5+k)>.1?-2:1;
        ctx.fillRect(x,y,2,2);ctx.fillRect(x-3,y+wing,3,1);ctx.fillRect(x+2,y+wing,3,1);
      }
    }
    ctx.globalAlpha=1;
  }

  const [day, night] = await Promise.all([
    loadArtwork('pixel-lake-day-bg.webp'), loadArtwork('pixel-starry-night-bg.webp')
  ]);
  prepare(day, night);
  return {
    canvas,
    render(time, light = lightingAtHour(new Date().getHours())) {
      t = time;
      ctx.imageSmoothingEnabled = false;
      drawSky(light);
      drawLandscape(light);
      drawLife(light);
      return canvas;
    }
  };
}
