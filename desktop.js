/* 桌面布局独立保存；保留原节点和 APP 事件，不接触业务数据。 */
(()=>{
'use strict';
const KEY='snowfall-desktop-layout-v4',LEGACY_KEY='snowfall-desktop-layout-v3',COLS=4,ROWS=6,MAX_PAGES=1000;
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
 {id:'quote',category:'记录与装饰',selector:'.widget',name:'文字',icon:'❞',description:'显示「美化」里设置的桌面文案',w:4,h:1,initial:{page:0,x:0,y:2}},
  {id:'bigtext',category:'记录与装饰',card:true,name:'大字',icon:'字',description:'角线框着一块色块，文字从上往下竖排',w:2,h:2,optional:true},
  {id:'panel',category:'记录与装饰',card:true,name:'蓝色面板',icon:'◈',description:'用自选头像、文字和底色装饰桌面',w:2,h:2,optional:true}
];
const home=document.getElementById('home'),inbox=home.querySelector('.app-grid');
const definitions=new Map(widgetDefs.map(def=>[def.id,def]));
 const items=new Map(),removedWidgets=new Map();
 let pages=1,current=0,editing=false,gesture=null,ghost=null,target=null,edgeTimer=null,edgeLock=0,suppressUntil=0,readable=true;
 function isRecord(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
 function defaultWidgets(){
  return Object.fromEntries(widgetDefs.filter(def=>def.initial).map(def=>[
   `widget:${def.id}`,{typeId:def.id,...def.initial,w:def.w,h:def.h,settings:{},removed:false}
  ]));
 }
 function migrateV3(layout){
  if(layout.removedWidgets!==undefined&&(!Array.isArray(layout.removedWidgets)||layout.removedWidgets.some(id=>!definitions.has(id))))throw Error('invalid removed widgets');
  if(layout.widgetSettings!==undefined&&!isRecord(layout.widgetSettings))throw Error('invalid widget settings');
  const widgets={};
  for(const def of widgetDefs){
   const placed=layout.items[def.id],settings=layout.widgetSettings?.[def.id];
   const removed=Boolean(layout.removedWidgets?.includes(def.id)||(!placed&&!def.initial&&settings));
   if(!placed&&!def.initial&&!removed)continue;
   const position=placed||def.initial||{page:0,x:0,y:0};
   const {page,x,y}=position;
   const {w,h}=validSize(position.w,position.h)?position:def;
   widgets[`widget:${def.id}`]={typeId:def.id,page,x,y,w,h,settings:widgetUI.clean(def.id,settings),removed};
  }
  const apps=Object.fromEntries(Object.entries(layout.items).filter(([id])=>id.startsWith('app:')));
  return {version:4,pages:layout.pages,current:layout.current,items:apps,widgets};
 }
 let saved=null,needsMigration=false;
 try{
  const raw=localStorage.getItem(KEY)??localStorage.getItem(LEGACY_KEY);
  if(raw!==null){
   const layout=JSON.parse(raw);
   if(!isRecord(layout)||![3,4].includes(layout.version)||!Number.isInteger(layout.pages)||layout.pages<1||layout.pages>MAX_PAGES||!isRecord(layout.items))throw Error('invalid layout');
   saved=layout.version===3?migrateV3(layout):layout;
   if(!isRecord(saved.widgets))throw Error('invalid widget instances');
   for(const [id,widget] of Object.entries(saved.widgets)){
    if(!id.startsWith('widget:')||!isRecord(widget)||!definitions.has(widget.typeId)||!validSize(widget.w,widget.h)||typeof widget.removed!=='boolean')throw Error('invalid widget instance');
   }
   needsMigration=layout.version===3;
   pages=saved.pages;current=Math.max(0,Math.min(pages-1,Number.isInteger(saved.current)?saved.current:0));
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
   const apps={},widgets={};
   function write({id,typeId,page,x,y,w,h,settings},removed=false){
    const position={page,x,y,w,h};
    if(typeId)widgets[id]={typeId,...position,settings,removed};else apps[id]=position;
   }
   for(const item of items.values())write(item);
   for(const item of removedWidgets.values())write(item,true);
   // 位置与内容一次写入；不动旧键及其他 App 的数据。
   localStorage.setItem(KEY,JSON.stringify({version:4,pages,current,items:apps,widgets}));
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
  if(!item.typeId){node.classList.add('desktop-app');node.title=node.textContent.trim();}
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
   const prior=item.typeId?saved?.widgets[item.id]:saved?.items[item.id];
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
  return {node,draw:update};
 }
 // 原始节点继续给时钟与主题脚本使用；实例用去掉固定 ID 的副本。
 const sourceNodes=new Map();
 const sourceBin=document.createElement('div');sourceBin.hidden=true;home.append(sourceBin);
 for(const def of widgetDefs.filter(d=>d.selector)){
  const source=home.querySelector(def.selector);if(!source)continue;
  sourceNodes.set(def.id,source);sourceBin.append(source);
 }
 function createFromSource(typeId){
  const source=sourceNodes.get(typeId);if(!source)return null;
  const node=source.cloneNode(true),originals=[...source.querySelectorAll('[id]')];
  const fields=[...node.querySelectorAll('[id]')];
  for(const field of fields){field.dataset.widgetField=field.id;field.removeAttribute('id');}
  return {node,draw(){fields.forEach((field,i)=>{
   const value=originals[i].textContent;if(field.textContent!==value)field.textContent=value;
  });}};
 }
 function makeWidget(id,record){
  const {typeId}=record,def=definitions.get(typeId);
  const card=def.card?widgetUI.createCard(typeId):def.create?def.create():createFromSource(typeId);
  if(!card)return null;
  const {node}=card,entry={...record,id,node,card};
  node.tabIndex=0;node.removeAttribute('aria-hidden');node.setAttribute('role','group');node.setAttribute('aria-label',`${def.name}小组件`);
  const control=(className,symbol,label,action)=>{
   const button=document.createElement('button');button.type='button';button.className=`desktop-widget-control ${className}`;
   button.textContent=symbol;button.setAttribute('aria-label',`${label}${def.name}小组件`);button.hidden=true;
   button.addEventListener('click',e=>{e.stopPropagation();action();});node.append(button);return button;
  };
  entry.gear=control('desktop-gear','⚙','编辑',()=>openWidget(id));
  entry.remove=control('desktop-remove','×','移除',()=>removeWidget(id));
  return entry;
 }
 const widgetEntries=[];
 for(const [id,record] of Object.entries(saved?.widgets??defaultWidgets())){
  const clean={...record,settings:widgetUI.clean(record.typeId,record.settings)};
  const entry=!clean.removed&&makeWidget(id,clean);
  if(entry)widgetEntries.push(entry);else removedWidgets.set(id,{...clean,id});
 }
 function drawWidget({card,node,settings},now=new Date()){
  if(!card)return;
  card.draw(settings,now);widgetUI.applyLook(node,settings?.look);
 }
 function refreshCards(){const now=new Date();for(const item of items.values())drawWidget(item,now);}
 function returnHome(id,message){
  const item=items.get(id);
  if(item&&current!==item.page){current=item.page;render();}
  go('home');item?.node.focus();if(message)hint.textContent=message;
 }
 function openWidget(id){
  const item=items.get(id);
  if(!editing||!readable||!item?.typeId)return;
  clearGesture(false);go('app-widgets');widgetManager.open(item.typeId,id,true);
 }
 function refreshManagers(){widgetManager.refresh();themeWidgets?.refresh();}
 function removeWidget(id,fromDesktop=true){
  const item=items.get(id);if(!readable)return layoutReadError;
  if(!item?.typeId||(fromDesktop&&!editing))return '这个小组件已移除。';
  if(fromDesktop)clearGesture(false);
  const {typeId,page,x,y,w,h,settings}=item;
  items.delete(id);removedWidgets.set(id,{id,typeId,page,x,y,w,h,settings});
  if(!persist()){
   const message=hint.textContent+' 移除未生效。';items.set(id,item);removedWidgets.delete(id);hint.textContent=message;return message;
  }
  item.node.remove();render();refreshManagers();hint.textContent='小组件已移除，内容已保留';
  if(fromDesktop){const next=[...items.values()].find(i=>i.page===current);(next?.node||done).focus();}
 }
 let nextId=0;
 function allocateId(){
  let id;do{id=`widget:${Date.now().toString(36)}-${++nextId}`;}while(items.has(id)||removedWidgets.has(id));return id;
 }
 function saveWidget(typeId,{w,h},settings,{instanceId,restore=false,stay=false}={}){
  if(!readable)return {error:layoutReadError};
  if(!definitions.has(typeId)||!validSize(w,h))return {error:'请选择有效的小组件尺寸。'};
  const item=instanceId?(restore?removedWidgets:items).get(instanceId):null;
  if(instanceId&&item?.typeId!==typeId)return {error:'找不到这一个小组件，请返回列表重试。'};
  const id=instanceId||allocateId(),probe={typeId,w,h,removed:false,settings:widgetUI.clean(typeId,settings)};
  const start=Number.isInteger(item?.page)&&item.page>=0&&item.page<pages?item.page:current;
  const pos=vacancy(probe,start,item?.x??0,item?.y??0,item);
  if(!pos)return {error:'没有可用空位，页面已达上限。'};
  const oldPages=pages,oldCurrent=current;
  const entry=item&&!restore?{...item,...probe}:makeWidget(id,probe);
  if(!entry||!register(entry,pos))return {error:'找不到小组件节点，未保存修改。'};
  if(restore)removedWidgets.delete(id);
  if(!stay)current=pos.page;
  if(!persist()){
   const error=hint.textContent+' 修改未生效。';
   if(item&&!restore)items.set(id,item);else items.delete(id);
   if(restore)removedWidgets.set(id,item);
   pages=oldPages;current=oldCurrent;hint.textContent=error;return {error};
  }
  drawWidget(items.get(id));setEdit(false);refreshManagers();
  return {id,page:pos.page};
 }
 // 记住桌面格子的真实大小；编辑页打开时桌面被隐藏，量不到就用上次的。
 var lastCell=null;
 function measureCell(){const grid=[...home.querySelectorAll('.desktop-grid')].find(g=>g.getBoundingClientRect().width>40);const r=grid?.getBoundingClientRect();if(r&&r.height>40)lastCell={w:(r.width-3*(COLS-1))/COLS,h:(r.height-3*(ROWS-1))/ROWS,gap:3};return lastCell||{w:90,h:100,gap:3};}
 measureCell();addEventListener('resize',measureCell);
 const widgetOptions={defs:widgetDefs,cols:COLS,rows:ROWS,validSize,
  list:typeId=>[...items.values(),...removedWidgets.values()].filter(item=>item.typeId===typeId),
  getItem:id=>items.get(id)??removedWidgets.get(id),isRemoved:id=>removedWidgets.has(id),canSave:()=>readable,
  createInstance:(typeId,size,settings,stay)=>saveWidget(typeId,size,settings,{stay}),
  updateInstance:(typeId,instanceId,size,settings,stay)=>saveWidget(typeId,size,settings,{instanceId,stay}),
  restoreInstance:(typeId,instanceId,size,settings,stay)=>saveWidget(typeId,size,settings,{instanceId,restore:true,stay}),
  removeInstance:id=>removeWidget(id,false),returnHome,
  // 编辑页的实时预览：和桌面上用同一套小组件，只是不放进桌面。
  makePreview:typeId=>{const def=definitions.get(typeId);if(!def)return null;try{return def.card?widgetUI.createCard(typeId):def.create?def.create():createFromSource(typeId);}catch{return null;}},
  cellSize:measureCell};
 const widgetManager=widgetUI.mount(widgetOptions);
 const themeWidgets=document.getElementById('themeWidgetCatalog')?widgetUI.mount({...widgetOptions,view:'beauty',prefix:'themeWidget'}):null;
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
function render(){requestAnimationFrame(()=>{if(typeof measureCell==='function')measureCell();});
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
 for(const item of items.values())if(item.typeId)item.gear.hidden=item.remove.hidden=!value||!readable;
 render();
}
function newPage(){if(pages>=1000){hint.textContent='页面已达上限';return;}current=pages++;setEdit(true);persist();}
toolbar.querySelector('.desktop-create').onclick=newPage;
done.onclick=()=>{clearGesture(false);if(persist()){setEdit(false);widgetManager.refresh();themeWidgets?.showList();hint.textContent='桌面布局已保存';}};
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
restore([...widgetEntries,...appEntries()]);render();refreshCards();refreshManagers();
 if(needsMigration)persist();
 new MutationObserver(records=>{if(records.some(record=>record.addedNodes.length))collect();}).observe(inbox,{childList:true});
 new MutationObserver(refreshCards).observe(sourceBin,{childList:true,characterData:true,subtree:true});
 document.querySelector('#app-calendar iframe')?.addEventListener('load',refreshCards);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshCards();});
 window.addEventListener('pageshow',refreshCards);setInterval(refreshCards,30000);
 window.snowfallDesktop={getLayout:()=>({version:4,pages,current,editing,items:[...items.values()].map(({id,typeId,page,x,y,w,h})=>({id,typeId,page,x,y,w,h}))})};
})();
