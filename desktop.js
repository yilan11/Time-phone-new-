/* 桌面布局独立保存；保留原节点和 APP 事件，不接触业务数据。 */
(()=>{
'use strict';
const KEY='snowfall-desktop-layout-v3',COLS=4,ROWS=6,MAX_PAGES=1000;
const validSize=(w,h)=>Number.isInteger(w)&&w>=1&&w<=COLS&&Number.isInteger(h)&&h>=1&&h<=ROWS;
const widgetUI=window.snowfallWidgetUI;
if(!widgetUI){console.warn('小组件模块未加载，保留原始桌面和本地布局。');return;}
const widgetDefs=[
 {id:'clock',category:'时间与日期',selector:'.home-top',name:'时间',icon:'◷',description:'实时显示时间与日期',w:2,h:1,initial:{page:0,x:0,y:0}},
 {id:'calendar',category:'时间与日期',create:createCalendarWidget,name:'日历',icon:'▦',description:'查看月历，轻点打开完整日历',w:2,h:2,optional:true},
 {id:'countdown',category:'时间与日期',card:true,name:'倒计时',icon:'◴',description:'查看距离一个特别日子还有几天',w:2,h:2,optional:true},
 {id:'year',category:'时间与日期',card:true,name:'年度进度',icon:'◒',description:'看今年过了多少、还剩几天',w:2,h:2,optional:true},
 {id:'memo',category:'记录与装饰',card:true,name:'便签',icon:'▤',description:'把想记住的小事放在桌面',w:2,h:2,optional:true},
 {id:'photo',category:'记录与装饰',card:true,name:'图片',icon:'▧',description:'展示自选照片或默认小猫',w:2,h:2,optional:true},
 {id:'art',category:'记录与装饰',selector:'.home-art',name:'装饰',icon:'✧',description:'原来的冰蓝插画',w:2,h:2,initial:{page:0,x:2,y:0}},
 {id:'quote',category:'记录与装饰',selector:'.widget',name:'文字',icon:'❞',description:'显示「美化」里设置的桌面文案',w:4,h:1,initial:{page:0,x:0,y:2}}
];
const home=document.getElementById('home'),inbox=home.querySelector('.app-grid');
const items=new Map(),widgets=new Map(),removed=new Set();let pages=1,current=0,editing=false,gesture=null,ghost=null,target=null,edgeTimer=null,edgeLock=0,suppressUntil=0,readable=true;
let saved=null;
// 内容和尺寸用同一次本地写入保存，避免空间不足时只保存了一半；不写入任何 App 的业务键。
const widgetSettings=new Map();
try{
 const raw=localStorage.getItem(KEY);
 if(raw){
  saved=JSON.parse(raw);
  if(!saved||saved.version!==3||!Number.isInteger(saved.pages)||saved.pages<1||saved.pages>MAX_PAGES||!saved.items||typeof saved.items!=='object'||Array.isArray(saved.items))throw Error('invalid layout');
  if(saved.removedWidgets!==undefined&&(!Array.isArray(saved.removedWidgets)||saved.removedWidgets.some(id=>!widgetDefs.some(def=>def.id===id))))throw Error('invalid removed widgets');
  if(saved.widgetSettings!==undefined&&(!saved.widgetSettings||typeof saved.widgetSettings!=='object'||Array.isArray(saved.widgetSettings)))throw Error('invalid widget settings');
  pages=saved.pages;current=Math.max(0,Math.min(pages-1,Number.isInteger(saved.current)?saved.current:0));
  for(const id of saved.removedWidgets||[])removed.add(id);
  for(const def of widgetDefs){const value=widgetUI?.clean(def.id,saved.widgetSettings?.[def.id]);if(value&&Object.keys(value).length)widgetSettings.set(def.id,value);}
 }
}catch(e){saved=null;readable=false;console.warn('桌面布局读取失败，保留原始存储：',e);}
home.classList.add('desktop-home');
const toolbar=document.createElement('div');toolbar.className='desktop-toolbar';
toolbar.innerHTML='<button type="button" class="desktop-create" hidden>＋新增页面</button><button type="button" class="desktop-done" aria-label="完成并保存桌面编辑" hidden>√</button>';
const hint=document.createElement('p');hint.className='desktop-hint';hint.setAttribute('role','status');hint.setAttribute('aria-live','polite');
const stage=document.createElement('div');stage.className='desktop-stage';
const track=document.createElement('div');track.className='desktop-track';stage.append(track);
const grids=new Map();
function pageGrid(page){
 let grid=grids.get(page);if(grid)return grid;
 grid=document.createElement('div');grid.className='desktop-grid';grid.dataset.page=page;
 grid.hidden=page!==current;
 grid.setAttribute('aria-label',`桌面第 ${page+1} 页，4列6行`);track.append(grid);grids.set(page,grid);return grid;
}
const nav=document.createElement('nav');nav.className='desktop-pages';nav.setAttribute('aria-label','桌面页面');
const dock=document.createElement('nav');dock.className='desktop-dock';dock.setAttribute('aria-label','固定应用栏');
const dockIds=new Set(['communications','settings','beauty','encounter']);
for(const node of [...inbox.children])if(dockIds.has(node.dataset.go)){node.classList.add('desktop-app');dock.append(node);}
const note=home.querySelector('.home-note');note.hidden=true;inbox.hidden=true;
home.prepend(toolbar,hint,stage,nav,dock);
const done=toolbar.querySelector('.desktop-done');
 const layoutReadError='原布局读取异常，未覆盖存储。';
 function persist(){
  if(!readable){hint.textContent=layoutReadError;return false;}
  try{
   const placed=Object.fromEntries([...items].map(([id,{page,x,y,w,h}])=>[id,{page,x,y,w,h}]));
   localStorage.setItem(KEY,JSON.stringify({version:3,pages,current,removedWidgets:[...removed],items:placed,widgetSettings:Object.fromEntries(widgetSettings)}));
   return true;
  }catch(e){hint.textContent='保存失败：本机存储不可用或已满。';console.warn('桌面保存失败',e);return false;}
 }
 function fits(item,p,x,y,ignore=item){if(p<0||p>=MAX_PAGES||x<0||y<0||x+item.w>COLS||y+item.h>ROWS)return false;for(const other of items.values()){if(other===ignore||other.page!==p)continue;if(x<other.x+other.w&&x+item.w>other.x&&y<other.y+other.h&&y+item.h>other.y)return false;}return true;}
 function nearest(item,p,x,y,ignore=item){let best=null,d=Infinity;for(let yy=0;yy<=ROWS-item.h;yy++)for(let xx=0;xx<=COLS-item.w;xx++){const dist=(xx-x)**2+(yy-y)**2;if(dist<d&&fits(item,p,xx,yy,ignore)){d=dist;best={page:p,x:xx,y:yy};}}return best;}
 function vacancy(item,start,x=0,y=0,ignore=item){
  const here=nearest(item,start,x,y,ignore);if(here)return here;
  for(let p=0;p<pages;p++){if(p===start)continue;const pos=nearest(item,p,0,0,ignore);if(pos)return pos;}
  return pages<MAX_PAGES&&fits(item,pages,0,0,ignore)?{page:pages,x:0,y:0}:null;
 }
 function hasDesktopNode(item){
  if(item?.node instanceof HTMLElement)return true;
  console.warn('桌面条目缺少有效的 HTML 节点',item?.id??'(无标识)',item?.node);
  return false;
 }
 function register(item,pos){
  if(!hasDesktopNode(item))return false;
  const {id,node}=item,{page,x,y}=pos;
  node.classList.add('desktop-item');node.dataset.desktopId=id;node.draggable=false;
  if(!widgets.has(id)){node.classList.add('desktop-app');node.title=node.textContent.trim();}
  items.set(id,{...item,page,x,y});pages=Math.max(pages,page+1);
  return true;
 }
 const warnedApps=new WeakSet();
 function warnApp(node,message,id){
  if(warnedApps.has(node))return;
  warnedApps.add(node);console.warn(message,id??node);
 }
 function restore(entries){
  const pending=[],seen=new Map();let changed=false;
  // 先占回旧坐标，再给没有有效坐标的条目找空位。
  for(const item of entries){
   if(!hasDesktopNode(item))continue;
   const existing=items.get(item.id),other=existing||seen.get(item.id);
   if(other){
    if(other.node!==item.node)warnApp(item.node,'重复桌面标识，忽略',item.id);
    else if(existing&&item.node.parentElement!==grids.get(existing.page))changed=true;
    continue;
   }
   seen.set(item.id,item);
   const prior=saved?.items[item.id];
   if(prior&&Number.isInteger(prior.page)&&prior.page>=0&&prior.page<pages&&Number.isInteger(prior.x)&&Number.isInteger(prior.y)&&fits(item,prior.page,prior.x,prior.y)){
    if(register(item,prior))changed=true;
   }else pending.push(item);
  }
  for(const item of pending){
   const init=item.initial,pos=init&&fits(item,init.page,init.x,init.y)?init:vacancy(item,current);
   if(pos){if(register(item,pos))changed=true;}
   else warnApp(item.node,'桌面没有可用空位',item.id);
  }
  return changed;
 }
 function createCalendarWidget(){
 const node=document.createElement('div');node.className='desktop-calendar';
 const open=document.createElement('button');open.type='button';open.className='mini-open';open.onclick=()=>go('app-calendar');
 const title=document.createElement('span'),days=document.createElement('span');title.className='mini-month';days.className='mini-days';days.setAttribute('aria-hidden','true');open.append(title,days);node.append(open);
 const frame=document.querySelector('#app-calendar iframe');let last='';
 function update(){
  const now=new Date();let y=now.getFullYear(),m=now.getMonth()+1;
  const label=frame?.contentDocument?.getElementById('monthLabel')?.getAttribute('aria-label');
  const shown=/^(\d{1,4})年(\d{1,2})月$/.exec(label||'');
  if(shown){y=Number(shown[1]);m=Number(shown[2]);}else{try{const manual=JSON.parse(localStorage.getItem('schedule.calendar.preferences.v1'))?.manualDate;const match=/^(\d{4})-(0[1-9]|1[0-2])-\d{2}$/.exec(manual||'');if(match&&+match[1]>0){y=+match[1];m=+match[2];}}catch{}}
  const today=(y===now.getFullYear()&&m===now.getMonth()+1)?now.getDate():0,key=`${y}/${m}/${today}`;if(key===last)return;last=key;
  title.textContent=`${y}年${m}月`;open.setAttribute('aria-label',`${title.textContent}，打开完整日历`);
  const date=new Date(0);date.setHours(12,0,0,0);date.setFullYear(y,m-1,1);const offset=date.getDay();date.setFullYear(y,m,0);
  const frag=document.createDocumentFragment();function cell(text,cls){const s=document.createElement('span');s.textContent=text;if(cls)s.className=cls;frag.append(s);}
  for(const week of '日一二三四五六')cell(week,'mini-week');for(let i=0;i<offset;i++)cell('');for(let d=1;d<=date.getDate();d++)cell(d,d===today?'mini-today':'');days.replaceChildren(frag);
 }
 let observer=null;function bind(){observer?.disconnect();const label=frame?.contentDocument?.getElementById('monthLabel');if(label){observer=new MutationObserver(update);observer.observe(label,{attributes:true,attributeFilter:['aria-label']});}update();}
 frame?.addEventListener('load',bind);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});window.addEventListener('pageshow',update);setInterval(update,60000);bind();return node;
}
const widgetEntries=[];
for(const def of widgetDefs){
 const card=def.card?widgetUI.createCard(def.id):null;
 const node=def.card?card?.node:def.create?def.create():home.querySelector(def.selector);
 const entry={...def,node,card};
 if(!hasDesktopNode(entry))continue;
 widgets.set(def.id,entry);
 node.classList.add('desktop-item');node.dataset.desktopId=def.id;node.tabIndex=0;
 node.removeAttribute('aria-hidden');node.setAttribute('role','group');node.setAttribute('aria-label',`${def.name}小组件`);
 const control=(className,symbol,label,action)=>{
  const button=document.createElement('button');button.type='button';button.className=`desktop-widget-control ${className}`;
  button.textContent=symbol;button.setAttribute('aria-label',`${label}${def.name}小组件`);button.hidden=true;
  button.addEventListener('click',e=>{e.stopPropagation();action();});node.append(button);return button;
 };
 entry.gear=control('desktop-gear','⚙','编辑',()=>openWidget(def.id));
 entry.remove=control('desktop-remove','×','移除',()=>removeWidget(def.id));
 const prior=saved?.items[def.id];
 // 预设、自定义以及原有时钟/文字尺寸，只要符合网格都按原样恢复。
 const size=prior&&validSize(prior.w,prior.h)?{w:prior.w,h:prior.h}:{w:def.w,h:def.h};
 node.hidden=true;track.append(node);
 if(!removed.has(def.id)&&(!def.optional||prior))widgetEntries.push({...entry,...size});
}
 function drawWidget(id,now=new Date()){
  const widget=widgets.get(id);if(!widget)return;
  const settings=widgetSettings.get(id);
  widget.card?.draw(settings||{},now);widgetUI.applyLook(widget.node,settings?.look);
 }
function refreshCards(){const now=new Date();for(const id of items.keys())drawWidget(id,now);}
function returnHome(id){go('home');items.get(id)?.node.focus();}
function openWidget(id){
 if(!editing||!readable||!items.has(id))return;
 clearGesture(false);go('app-widgets');widgetManager.open(id,true);
}
function removeWidget(id){
 if(!editing||!readable||!widgets.has(id)||!items.has(id))return;
 clearGesture(false);
 const item=items.get(id);items.delete(id);removed.add(id);
 if(!persist()){const message=hint.textContent;items.set(id,item);removed.delete(id);render();hint.textContent=message+' 移除未生效。';return;}
 item.node.hidden=true;track.append(item.node);render();widgetManager.refresh();hint.textContent='小组件已移除，内容已保留';
 const next=[...items.values()].find(i=>i.page===current);(next?.node||done).focus();
}
function saveWidget(id,{w,h},settings){
 const def=widgets.get(id),item=items.get(id);
 if(!readable)return layoutReadError;
 if(!def||!validSize(w,h))return '请选择有效的小组件尺寸。';
 const probe={...def,w,h},start=item?.page??current;
 const pos=vacancy(probe,start,item?.x??0,item?.y??0,item);
 if(!pos)return '没有可用空位，页面已达上限。';
 const oldPages=pages,oldCurrent=current,wasRemoved=removed.has(id),previousSettings=widgetSettings.get(id);
 const content=widgetUI.clean(id,settings);
 if(!register(probe,pos))return '找不到小组件节点，未保存修改。';
 if(Object.keys(content).length)widgetSettings.set(id,content);else widgetSettings.delete(id);
 removed.delete(id);current=pos.page;
 if(!persist()){
  const message=hint.textContent;
  if(item)items.set(id,item);else items.delete(id);
  if(wasRemoved)removed.add(id);
  if(previousSettings)widgetSettings.set(id,previousSettings);else widgetSettings.delete(id);
  pages=oldPages;current=oldCurrent;render();
  return message+' 修改未生效。';
 }
 drawWidget(id);setEdit(false);returnHome(id);
 hint.textContent=`${def.name}小组件已${item?'保存':'添加到桌面'} · 第 ${pos.page+1} 页`;
}
const widgetManager=widgetUI.mount({defs:[...widgets.values()],cols:COLS,rows:ROWS,validSize,getItem:id=>items.get(id),getSettings:id=>widgetSettings.get(id),canSave:()=>readable,save:saveWidget,returnHome});
function appEntries(){
 const entries=[];
 for(const node of [...inbox.children]){
  if(dockIds.has(node.dataset.go)){node.classList.add('desktop-app');dock.append(node);continue;}
  const id=node.dataset.desktopId||node.dataset.go||node.id;
  if(id)entries.push({node,id:id.startsWith('app:')?id:`app:${id}`,w:1,h:1});
  else warnApp(node,'新 APP 需要稳定的桌面标识');
 }
 return entries;
}
function collect(){if(restore(appEntries()))render();}
function render(){
 // 空白页也需要可见网格，供拖动时计算落点。
 pageGrid(current);
 for(const [page,grid] of grids)grid.hidden=page!==current;
 for(const item of items.values()){
  const n=item.node,grid=pageGrid(item.page);
  // 跨页后同步真实父节点，保留原节点的 App 事件。
  if(n.parentElement!==grid)grid.append(n);
  n.hidden=item.page!==current;
  n.style.gridColumn=`${item.x+1} / span ${item.w}`;
  n.style.gridRow=`${item.y+1} / span ${item.h}`;
 }
 nav.replaceChildren();for(let p=0;p<pages;p++){const b=document.createElement('button');b.type='button';b.innerHTML='<span aria-hidden="true"></span>';b.setAttribute('aria-label',`第 ${p+1} 页`);b.setAttribute('aria-current',String(p===current));b.onclick=()=>{current=p;render();if(!editing)persist();};nav.append(b);}if(readable)hint.textContent=editing?'拖到左右边缘停留切页 · 空位自动吸附 · √保存':'长按 APP / 小组件编辑 · 左右滑动切页';
}
function setEdit(value){
 editing=value;home.classList.toggle('desktop-editing',value);
 done.hidden=!value;toolbar.querySelector('.desktop-create').hidden=!value;
 for(const def of widgets.values())def.gear.hidden=def.remove.hidden=!value||!readable||!items.has(def.id);
 render();
}
function newPage(){if(pages>=1000){hint.textContent='页面已达上限';return;}current=pages++;setEdit(true);persist();}
toolbar.querySelector('.desktop-create').onclick=newPage;
done.onclick=()=>{clearGesture(false);if(persist()){setEdit(false);hint.textContent='桌面布局已保存';}};
function clearEdge(){clearTimeout(edgeTimer);edgeTimer=null;stage.querySelectorAll('.desktop-edge').forEach(n=>n.remove());}
function clearGesture(commit){clearTimeout(gesture&&gesture.timer);clearEdge();if(gesture&&gesture.dragging){if(commit&&target)Object.assign(gesture.item,target);gesture.item.node.classList.remove('desktop-drag-source');}if(gesture){try{home.releasePointerCapture(gesture.pointerId);}catch(e){}}ghost?.remove();stage.querySelector('.desktop-target')?.remove();ghost=null;target=null;gesture=null;edgeLock=0;render();}
function startDrag(e){if(!gesture||!gesture.item)return;setEdit(true);gesture.dragging=true;try{home.setPointerCapture(gesture.pointerId);}catch(error){}suppressUntil=Date.now()+500;const rect=gesture.item.node.getBoundingClientRect();gesture.offsetX=Math.min(rect.width,Math.max(0,gesture.x-rect.left));gesture.offsetY=Math.min(rect.height,Math.max(0,gesture.y-rect.top));ghost=gesture.item.node.cloneNode(true);ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));ghost.hidden=false;ghost.classList.add('desktop-ghost');ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';ghost.setAttribute('aria-hidden','true');document.body.append(ghost);gesture.item.node.classList.add('desktop-drag-source');moveDrag(e);}
function moveDrag(e){if(!gesture?.dragging)return;const r=(grids.get(current)||pageGrid(current)).getBoundingClientRect(),item=gesture.item;ghost.style.left=(e.clientX-gesture.offsetX)+'px';ghost.style.top=(e.clientY-gesture.offsetY)+'px';const x=Math.round((e.clientX-gesture.offsetX-r.left)/((r.width+3)/COLS));const y=Math.round((e.clientY-gesture.offsetY-r.top)/((r.height+3)/ROWS));target=nearest(item,current,x,y);
let marker=stage.querySelector('.desktop-target');if(!marker){marker=document.createElement('div');marker.className='desktop-target';stage.append(marker);}marker.hidden=!target;
if(target){Object.assign(marker.style,{left:(target.x*(r.width+3)/COLS)+'px',top:(target.y*(r.height+3)/ROWS)+'px',width:(item.w*(r.width+3)/COLS-3)+'px',height:(item.h*(r.height+3)/ROWS-3)+'px'});}
const edge=e.clientY>=r.top&&e.clientY<=r.bottom?(e.clientX<=r.left+20?-1:e.clientX>=r.right-20?1:0):0;
if(!edge){clearEdge();edgeLock=0;return;}if(edgeLock===edge)return;clearEdge();edgeLock=edge;
const band=document.createElement('div');band.className='desktop-edge '+(edge<0?'left':'right');stage.append(band);
edgeTimer=setTimeout(()=>{if(!gesture?.dragging)return;if(edge<0&&current>0)current--;else if(edge>0){if(current===pages-1){if(pages>=1000)return;pages++;}current++;}render();clearEdge();moveDrag(e);},750);
}
const isWidgetControl=e=>e.target.closest('.desktop-widget-control');
 home.addEventListener('pointerdown',e=>{if(e.button!==0||!e.isPrimary||isWidgetControl(e)||!e.target.closest('.desktop-stage')||gesture)return;const node=e.target.closest('.desktop-item');gesture={pointerId:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,item:node?items.get(node.dataset.desktopId):null,dragging:false,moved:false};if(gesture.item)gesture.timer=setTimeout(()=>startDrag({clientX:gesture.lastX,clientY:gesture.lastY}),editing?180:480);});
home.addEventListener('pointermove',e=>{if(!gesture||e.pointerId!==gesture.pointerId)return;gesture.lastX=e.clientX;gesture.lastY=e.clientY;if(gesture.dragging){e.preventDefault();moveDrag(e);return;}if(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>10){gesture.moved=true;clearTimeout(gesture.timer);if(editing&&gesture.item)startDrag(e);}});
home.addEventListener('pointerup',e=>{if(!gesture||e.pointerId!==gesture.pointerId)return;const g=gesture;if(g.dragging){suppressUntil=Date.now()+500;clearGesture(true);}else{if(g.moved){suppressUntil=Date.now()+500;if(Math.abs(e.clientX-g.x)>45&&Math.abs(e.clientX-g.x)>Math.abs(e.clientY-g.y)*1.3){current=Math.max(0,Math.min(pages-1,current+(e.clientX<g.x?1:-1)));if(!editing)persist();}}clearGesture(false);}});
home.addEventListener('pointercancel',()=>{suppressUntil=Date.now()+500;clearGesture(false);});
home.addEventListener('lostpointercapture',()=>{if(gesture)clearGesture(false);});
home.addEventListener('click',e=>{if(isWidgetControl(e))return;if(e.target.closest('.desktop-item')&&(editing||Date.now()<suppressUntil)){e.preventDefault();e.stopImmediatePropagation();}},true);
 home.addEventListener('contextmenu',e=>{if(e.target.closest('.desktop-stage'))e.preventDefault();});
 home.addEventListener('keydown',e=>{if(isWidgetControl(e))return;const node=e.target.closest('.desktop-item');if(!node)return;if(e.key==='F2'){e.preventDefault();setEdit(true);}if(editing&&(e.key==='Enter'||e.key===' ')){e.preventDefault();done.focus();}});
window.addEventListener('blur',()=>{if(gesture)clearGesture(false);});
restore([...widgetEntries,...appEntries()]);render();refreshCards();widgetManager.refresh();
new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))collect();}).observe(inbox,{childList:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCards();});
window.addEventListener('pageshow',refreshCards);setInterval(refreshCards,60000);
window.snowfallDesktop={getLayout:()=>({version:3,pages,current,editing,items:[...items.values()].map(({id,page,x,y,w,h})=>({id,page,x,y,w,h}))})};
})();
