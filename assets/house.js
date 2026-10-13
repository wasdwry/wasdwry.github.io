/* All room transitions remain in this document; existing publishing tools open on the desk. */
(()=>{'use strict';
const $=id=>document.getElementById(id),scenes=['outside','hall','study'];let scene='outside',lastFocus=null,noticeTimer,transition=0;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
function cabinLayout(){const w=innerWidth,h=innerHeight,s=Math.max(w/1716,h/916),iw=1716*s,ih=916*s,x=w<700?0:(w-iw)/2;const a=$('cabinArea');a.style.cssText=`left:${Math.max(8,x+.017*iw)}px;top:${.475*ih}px;width:${Math.min(.247*iw,w-Math.max(8,x+.017*iw)-8)}px;height:${.31*ih}px`;}
$('cabinHotspot').addEventListener('click',()=>changeScene('hall'));
document.addEventListener('pointerdown',e=>{if(!$('bookshelf').contains(e.target)&&!$('shelfMenu').contains(e.target))shelf(false);});
function shelf(open){$('shelfMenu').hidden=!open;$('bookshelf').setAttribute('aria-expanded',String(open));}
function notify(text){clearTimeout(noticeTimer);$('roomNotice').textContent=text;$('roomNotice').hidden=false;noticeTimer=setTimeout(()=>$('roomNotice').hidden=true,3500);}
const images={};for(const name of ['hall','study']){images[name]=new Image();images[name].src=`assets/pixel-cabin-${name}.webp`;}
async function changeScene(next,push=true){if(!scenes.includes(next))next='outside';const token=++transition;if(next!=='outside'){if(!images[next].complete){$('sceneLoading').hidden=false;try{await images[next].decode();}catch(_){}}if(!images[next].naturalWidth){$('sceneLoading').hidden=true;notify('房间图片暂未加载成功，请稍后再试。');return;}}if(token!==transition)return;$('sceneLoading').hidden=true;shelf(false);scene=next;document.body.dataset.scene=scene;for(const id of scenes)$(id).hidden=id!==scene;$(scene).classList.remove('scene-arrive');void $(scene).offsetWidth;$(scene).classList.add('scene-arrive');$('backScene').hidden=scene==='outside';const label=scene==='study'?'回到门厅':'回到庭院';$('backScene').setAttribute('aria-label',label);$('backScene').querySelector('span').textContent=label;if(scene!=='outside'&&matchMedia('(max-aspect-ratio:3/4)').matches){document.getElementById(scene).scrollLeft=(document.getElementById(scene).scrollWidth-innerWidth)/2;notify('左右滑动，可以看看房间的两侧。');}window.WasdwryLandscape?.setView(scene);if(push)history.pushState({scene},'',scene==='outside'?location.pathname:`#${scene}`);if(scene==='hall')$('enterStudy').focus({preventScroll:true});else if(scene==='study')$('writeDiary').focus({preventScroll:true});else $('cabinHotspot').blur();}
$('enterStudy').addEventListener('click',()=>changeScene('study'));$('studyDoor').addEventListener('click',()=>changeScene('hall'));$('backScene').addEventListener('click',()=>changeScene(scene==='study'?'hall':'outside'));
document.querySelectorAll('[data-room]').forEach(b=>b.addEventListener('click',()=>notify(b.dataset.room==='living'?'客厅留待慢慢布置，先去书房坐坐吧。':'厨房留待慢慢布置，先去书房坐坐吧。')));
$('bookshelf').addEventListener('click',()=>shelf($('shelfMenu').hidden));
const toolMap={write:['diary.html?desk=write','写日记'],diary:['diary.html?desk=read','日记簿'],favorites:['favorites.html?desk=read','我的收藏'],posts:['posts.html?desk=read','我的文章']};
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{const [url,title]=toolMap[b.dataset.tool];lastFocus=b;shelf(false);$('deskTitle').textContent=title;$('deskFrame').title=title;$('deskFrame').src=url;$('deskDialog').showModal();}));
$('closeDesk').addEventListener('click',()=>$('deskDialog').close());$('deskDialog').addEventListener('close',()=>lastFocus?.focus({preventScroll:true}));
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===$('deskFrame').contentWindow&&e.data==='close-desk')$('deskDialog').close();});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('deskDialog').open)return;shelf(false);});
window.addEventListener('popstate',()=>{if($('deskDialog').open)$('deskDialog').close();changeScene(location.hash.slice(1)||'outside',false);});
reduced.addEventListener('change',()=>document.body.classList.toggle('motion-paused',reduced.matches));document.body.classList.toggle('motion-paused',reduced.matches);window.addEventListener('resize',cabinLayout);cabinLayout();if(['hall','study'].includes(location.hash.slice(1)))changeScene(location.hash.slice(1),false);
})();
