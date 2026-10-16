import { entryFromHash, entryHash } from './diary-core.mjs';
import { coverGeometry } from './scene-clock.mjs';
import { createGitHubPublisher } from './diary-publish.mjs?v=20261016-auth1';
import { createServerPublisher } from './diary-server-publish.mjs?v=20261016-auth1';
import { publishingConfig } from './publishing-config.mjs?v=20261016-auth2';
window.WasdwryDiaryPublisher = publishingConfig.backendOrigin ? createServerPublisher(publishingConfig.backendOrigin) : createGitHubPublisher();
window.addEventListener('pagehide', () => {
  const publisher = window.WasdwryDiaryPublisher;
  if (publisher.status().mode === 'server') publisher.dispose(); else publisher.disconnect();
});
/* All room transitions remain in this document; existing publishing tools open on the desk. */
(()=>{'use strict';
const $=id=>document.getElementById(id),scenes=['outside','hall','study'];let scene='outside',lastFocus=null,noticeTimer,transition=0;
function cabinLayout(){const w=innerWidth,{width:iw,height:ih,x}=coverGeometry(w,innerHeight);const a=$('cabinArea');a.style.cssText=`left:${Math.max(8,x+.017*iw)}px;top:${.475*ih}px;width:${Math.min(.247*iw,w-Math.max(8,x+.017*iw)-8)}px;height:${.31*ih}px`;}
$('cabinHotspot').addEventListener('click',()=>changeScene('hall'));
document.addEventListener('pointerdown',e=>{if(!$('bookshelf').contains(e.target)&&!$('shelfMenu').contains(e.target))shelf(false);});
function shelf(open){$('shelfMenu').hidden=!open;$('bookshelf').setAttribute('aria-expanded',String(open));}
function notify(text){clearTimeout(noticeTimer);$('roomNotice').textContent=text;$('roomNotice').hidden=false;noticeTimer=setTimeout(()=>$('roomNotice').hidden=true,3500);}
const images={};for(const name of ['hall','study']){images[name]=new Image();images[name].src=`assets/pixel-cabin-${name}.webp`;}
async function changeScene(next,push=true){if(!scenes.includes(next))next='outside';const token=++transition;if(next!=='outside'){if(!images[next].complete){$('sceneLoading').hidden=false;try{await images[next].decode();}catch(_){}}if(!images[next].naturalWidth){$('sceneLoading').hidden=true;notify('房间图片暂未加载成功，请稍后再试。');return;}}if(token!==transition)return;$('sceneLoading').hidden=true;shelf(false);scene=next;document.body.dataset.scene=scene;for(const id of scenes)$(id).hidden=id!==scene;$(scene).classList.remove('scene-arrive');void $(scene).offsetWidth;$(scene).classList.add('scene-arrive');$('backScene').hidden=scene==='outside';const label=scene==='study'?'回到门厅':'回到庭院';$('backScene').setAttribute('aria-label',label);$('backScene').querySelector('span').textContent=label;if(scene!=='outside'&&matchMedia('(max-aspect-ratio:3/4)').matches){document.getElementById(scene).scrollLeft=(document.getElementById(scene).scrollWidth-innerWidth)/2;notify('左右滑动，可以看看房间的两侧。');}window.WasdwryLandscape?.setView(scene);if(push){history.pushState({scene},'',scene==='outside'?location.pathname:`#${scene}`);lastRouteHash=location.hash;}if(scene==='hall')$('enterStudy').focus({preventScroll:true});else if(scene==='study')$('writeDiary').focus({preventScroll:true});else $('cabinHotspot').blur();}
$('enterStudy').addEventListener('click',()=>changeScene('study'));$('studyDoor').addEventListener('click',()=>changeScene('hall'));$('backScene').addEventListener('click',()=>changeScene(scene==='study'?'hall':'outside'));
document.querySelectorAll('[data-room]').forEach(b=>b.addEventListener('click',()=>notify(b.dataset.room==='living'?'客厅留待慢慢布置，先去书房坐坐吧。':'厨房留待慢慢布置，先去书房坐坐吧。')));
$('bookshelf').addEventListener('click',()=>shelf($('shelfMenu').hidden));
const toolMap={write:['diary','write','写日记'],diary:['diary','read','日记簿'],favorites:['favorites','read','我的收藏'],posts:['posts','read','我的文章']};
let deskRequest=0,activeTool=null,lastRouteHash=location.hash;
function preserveDesk(){try{$('deskFrame').contentWindow.WasdwryDiary?.flushDraft();}catch(_){}}
async function openTool(tool,initialEntry=''){
 const [kind,mode,title]=toolMap[tool],request=++deskRequest;preserveDesk();activeTool=kind;lastFocus=document.querySelector('[data-tool="'+tool+'"]');shelf(false);$('deskTitle').textContent=title;$('deskFrame').title=title;$('deskFrame').srcdoc='<p style="padding:24px;color:#65513b">正在打开……</p>';if(!$('deskDialog').open)$('deskDialog').showModal();
 try{const {default:markup}=await import('./desk-'+kind+'.js?v=20261016-auth1');if(request!==deskRequest||!$('deskDialog').open)return;$('deskFrame').srcdoc=markup.replace('__DESK_MODE__',mode).replace('__INITIAL_ENTRY__',encodeURIComponent(initialEntry));}catch(_){if(request===deskRequest&&$('deskDialog').open)$('deskFrame').srcdoc='<p style="padding:24px;color:#65513b">暂时无法打开，请合上后重试。</p>';}
}
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>openTool(b.dataset.tool)));
function clearDiaryRoute(){if(entryFromHash(location.hash)){history.replaceState({scene:'study'},'','#study');lastRouteHash=location.hash;}}
function closeDesk(){preserveDesk();deskRequest++;$('deskDialog').close();clearDiaryRoute();}
$('closeDesk').addEventListener('click',closeDesk);
$('deskDialog').addEventListener('cancel',e=>{e.preventDefault();closeDesk();});
$('deskDialog').addEventListener('close',()=>{preserveDesk();lastFocus?.focus({preventScroll:true});});
window.addEventListener('pagehide',preserveDesk);
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==$('deskFrame').contentWindow)return;
 if(e.data==='close-desk'){closeDesk();return;}
 if(e.data?.type==='diary:route'&&activeTool==='diary'&&$('deskDialog').open){
  if(e.data.path===null)clearDiaryRoute();
  else if(typeof e.data.path==='string'&&entryFromHash(entryHash(e.data.path))===e.data.path){const hash=entryHash(e.data.path);if(location.hash!==hash)history.pushState({scene:'study'},'',hash);lastRouteHash=location.hash;}
 }
});
document.addEventListener('keydown',e=>{if(e.key!=='Escape'||$('deskDialog').open)return;shelf(false);});
let routeRequest=0;
async function restoreRoute(){
 const request=++routeRequest;
 const path=entryFromHash(location.hash);
 if(path){await changeScene('study',false);if(request!==routeRequest)return;const diary=$('deskFrame').contentWindow.WasdwryDiary;if($('deskDialog').open&&activeTool==='diary'&&diary)diary.openEntry(path);else openTool('diary',path);}
 else {preserveDesk();if($('deskDialog').open){if(location.hash==='#study'&&activeTool==='diary'&&$('deskFrame').contentWindow.WasdwryDiary)$('deskFrame').contentWindow.WasdwryDiary.openEntry(null);else{deskRequest++;$('deskDialog').close();}}changeScene(location.hash.slice(1)||'outside',false);}
}
function onRouteChange(){if(lastRouteHash===location.hash)return;lastRouteHash=location.hash;restoreRoute();}
window.addEventListener('popstate',onRouteChange);window.addEventListener('hashchange',onRouteChange);
window.addEventListener('resize',cabinLayout);cabinLayout();restoreRoute();
})();
