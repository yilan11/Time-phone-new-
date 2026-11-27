/* 主题控制中心：桌面与 App 外观独立保存；小组件由 desktop.js 管理。 */
(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const home=byId('home'),theme=byId('beauty'),select=byId('themeAppSelect');
 if(!home||!theme||!select)return;
 const key='little-phone-beauty-v1',maxTheme=1600000;
 const defaults={title:'把日子过成喜欢的样子',subtitle:'留一点空白，等故事发生。',bg:'wallpaper',solid:'#dfe8f4',icon:'#eeeeee',size:'16',wallpaper:'',css:''};
 const shapePresets={default:[],round:[['border-radius','50%']],square:[['border-radius','0']],diamond:[['clip-path','polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)']],hexagon:[['clip-path','polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)']]};
 const globalProps=new Set('--ice-text --ice-muted --ice-50 --ice-100 --ice-200 --ice-300 --ice-glass --ice-border --ice-dock --theme-accent'.split(' '));
 const iconProps=new Set('color background background-color background-image border border-color border-style box-shadow'.split(' '));
 const shapeProps=new Set(['border-radius','clip-path']);
 const colorFns='rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix';
 const colorFunctions=new Set(colorFns.split(' '));
 const iconFunctions=new Set((colorFns+' linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient').split(' '));
 const shapeFunctions=new Set('polygon circle ellipse inset round'.split(' '));
 const ledgers=new WeakMap(),entries=new Map();
 const inbox=home.querySelector('.app-grid');
 const imageKinds={wall:{max:650000,mime:'image/jpeg',quality:[.86,.76,.65],sizes:[1280,960,720]},icon:{max:115000,mime:'image/webp',quality:[.9,.8,.68],sizes:[256,192,144]}};
 const isRecord=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const color=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
 const dataImage=(v,kind)=>typeof v==='string'&&v.length<=kind.max&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(v);
 const asText=(v,max)=>typeof v==='string'?v.slice(0,max):'';
 const own=(obj,name)=>Object.prototype.hasOwnProperty.call(obj,name);

 function rules(source,props,functions,max,forColor=false){
  if(source.length>max)throw Error(`最多填写 ${max} 个字符。`);
  const css=source.replace(/\/\*[\s\S]*?\*\//g,'');
  if(!/^[\w\s:#.,%();+\/-]*$/.test(css)||css.includes('/*'))throw Error('只填写 CSS 属性和值，不要加入大括号、链接或脚本。');
  const result=[];
  for(const part of css.split(';')){
   if(!part.trim())continue;
   const i=part.indexOf(':'),prop=part.slice(0,i).trim().toLowerCase(),value=part.slice(i+1).trim();
   if(i<0||!value)throw Error('请使用“属性: 值;”格式。');
   if(!props.has(prop))throw Error(`这里不支持「${prop}」。`);
   if([...value.matchAll(/([\w-]+)\s*\(/g)].some(m=>!functions.has(m[1].toLowerCase()))||!CSS.supports(forColor?'color':prop,value)||/^(inherit|initial|revert(?:-layer)?|unset)$/i.test(value))throw Error(`「${prop}」的值不受支持。`);
   result.push([prop,value]);
  }
  return result;
 }
 const desktopRules=s=>rules(s,globalProps,colorFunctions,1600,true);
 const iconRules=s=>rules(s,iconProps,iconFunctions,1600);
 const shapeRules=s=>rules(s,shapeProps,shapeFunctions,1000);
 function cleanRules(value,parse){try{if(typeof value==='string'){parse(value);return value;}}catch{}return '';}
 function cleanIcon(value){
  if(!isRecord(value))return {};
  const result={},shape=value.shape;
  if(dataImage(value.image,imageKinds.icon))result.image=value.image;
  const css=cleanRules(value.css,iconRules);
  if(css)result.css=css;
  if(typeof shape==='string'&&shape!=='default'&&(own(shapePresets,shape)||shape==='custom'))result.shape=shape;
  const shapeCSS=shape==='custom'&&cleanRules(value.shapeCSS,shapeRules);
  if(shapeCSS)result.shapeCSS=shapeCSS;
  if(shape==='custom'&&!shapeCSS)delete result.shape;
  return result;
 }
 function readTheme(){
  let raw;
  try{raw=JSON.parse(localStorage.getItem(key));}catch{}
  if(!isRecord(raw))raw={};
  const wallpaper=dataImage(raw.wallpaper,imageKinds.wall)?raw.wallpaper:'';
  const bg=color(raw.bg)||raw.bg==='custom'&&wallpaper?raw.bg:'wallpaper';
  const apps=Object.create(null);
  if(isRecord(raw.apps))for(const [id,appearance] of Object.entries(raw.apps)){
   if(!validAppId(id))continue;
   const next=cleanIcon(appearance);
   if(Object.keys(next).length)apps[id]=next;
  }
  return {title:asText(raw.title,30).trim()||defaults.title,subtitle:typeof raw.subtitle==='string'?asText(raw.subtitle,60):defaults.subtitle,bg,solid:color(bg)?bg:color(raw.solid)?raw.solid:defaults.solid,icon:color(raw.icon)?raw.icon:defaults.icon,size:['14','16','18'].includes(raw.size)?raw.size:defaults.size,wallpaper,css:cleanRules(raw.css,desktopRules),apps};
 }
 let saved=readTheme();
 function save(next,status,message){
  const serialized=JSON.stringify(next);
  if(serialized.length>maxTheme){status.textContent='主题图片占用空间太多，请先移除一些不用的图片。本次未保存。';return false;}
  try{localStorage.setItem(key,serialized);}catch{status.textContent='保存失败：浏览器存储空间不足或不允许保存，原设置未更改。';return false;}
  saved=next;status.textContent=message;return true;
 }
 function applyDesktop(){
  byId('homeTitle').textContent=saved.title;byId('homeSubtitle').textContent=saved.subtitle;
  home.dataset.homeBackground=color(saved.bg)?'solid':saved.bg;
  home.style.removeProperty('--home-bg');home.style.removeProperty('--home-wallpaper');
  if(color(saved.bg))home.style.setProperty('--home-bg',saved.bg);
  if(saved.bg==='custom')home.style.setProperty('--home-wallpaper',`url("${saved.wallpaper}")`);
  const palette=desktopRules(saved.css);
  for(const node of [home,theme]){
   for(const prop of globalProps)node.style.removeProperty(prop);
   for(const [prop,value] of palette)node.style.setProperty(prop,value);
   node.style.setProperty('--icon-bg',saved.icon);
  }
  home.toggleAttribute('data-theme-dock',palette.some(([prop])=>prop==='--ice-dock'));
  document.documentElement.style.setProperty('--reading-size',saved.size+'px');
 }
 function validAppId(id){return typeof id==='string'&&/^[a-z0-9_-]{1,64}$/i.test(id)&&!['__proto__','constructor','prototype'].includes(id);}
 function applyIcon(surface,appearance){
  for(const prop of ledgers.get(surface)||[])surface.style.removeProperty(prop);
  const {image,css,shape,shapeCSS}=appearance;
  const icon=css?iconRules(css):[],outline=shape==='custom'?shapeRules(shapeCSS):shapePresets[shape]||[];
  const declarations=[...icon,...outline];
  let picture=surface.querySelector(':scope > .theme-icon-image');
  if(image){
   if(!picture){picture=document.createElement('img');picture.className='theme-icon-image';picture.alt='';picture.draggable=false;surface.append(picture);}
   if(picture.getAttribute('src')!==image)picture.src=image;
  }else picture?.remove();
  surface.toggleAttribute('data-theme-image',Boolean(image));
  surface.toggleAttribute('data-theme-ink',icon.some(([prop])=>prop==='color'));
  surface.toggleAttribute('data-theme-clipped',outline.some(([prop])=>prop==='clip-path'));
  for(const [prop,value] of declarations)surface.style.setProperty(prop,value);
  ledgers.set(surface,new Set(declarations.map(([prop])=>prop)));
 }
 function collectApps(){
  for(const button of home.querySelectorAll('.app-grid > button, .desktop-app:not(.desktop-ghost)')){
   const id=(button.dataset.desktopId||button.dataset.go||button.id).replace(/^app:/,'');
   const surface=button.querySelector(':scope > span:first-child');
   if(!validAppId(id)||!surface||entries.has(id))continue;
   const directText=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
   const label=directText||button.getAttribute('aria-label')||button.title||id;
   const sample=surface.cloneNode(true);
   sample.removeAttribute('id');sample.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
   entries.set(id,{surface,sample,label});
   select.add(new Option(label,id));
   applyIcon(surface,saved.apps[id]||{});
  }
 }

 async function compress(file,kind){
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>12*1024*1024)throw Error('请选择不超过 12 MB 的 PNG、JPEG 或 WebP 图片。');
  const head=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const png=[137,80,78,71,13,10,26,10].every((byte,i)=>head[i]===byte);
  const jpeg=head[0]===255&&head[1]===216&&head[2]===255;
  const webp=String.fromCharCode(...head.slice(0,4))==='RIFF'&&String.fromCharCode(...head.slice(8,12))==='WEBP';
  if(!({ 'image/png':png,'image/jpeg':jpeg,'image/webp':webp })[file.type])throw Error('文件内容与图片格式不符。');
  const img=new Image(),url=URL.createObjectURL(file);
  try{
   img.src=url;
   try{await img.decode();}catch{throw Error('无法读取这张图片。');}
   const w=img.naturalWidth,h=img.naturalHeight;
   if(!w||!h||w*h>48000000||Math.max(w,h)>12000)throw Error('图片尺寸过大，请缩小后再选。');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   if(!ctx)throw Error('当前浏览器不能处理这张图片。');
   for(let i=0;i<kind.sizes.length;i++){
    const scale=Math.min(1,kind.sizes[i]/Math.max(w,h));
    canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    if(kind===imageKinds.wall){ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL(kind.mime,kind.quality[i]);
    if(dataImage(result,kind))return result;
   }
   throw Error('压缩后仍然太大，请换一张较小的图片。');
  }finally{URL.revokeObjectURL(url);}
 }
 function imageField(file,remove,status,kind,onUpdate){
  let src='',pending=false,version=0;
  function reset(value=''){
   version++;pending=false;src=value;file.value='';remove.disabled=!src;status.textContent=src?'已选择图片':'未设置图片';onUpdate();
  }
  remove.addEventListener('click',()=>reset());
  file.addEventListener('change',async()=>{
   const selected=file.files[0];if(!selected)return;
   const ticket=++version;pending=true;remove.disabled=false;status.textContent='正在处理图片…';onUpdate();
   try{const image=await compress(selected,kind);if(ticket!==version)return;src=image;status.textContent='图片已准备好，保存后生效。';}
   catch(err){if(ticket===version)status.textContent=`${err.message||'无法读取图片。'} 原设置未更改。`;}
   finally{if(ticket===version){pending=false;file.value='';remove.disabled=!src;onUpdate();}}
  });
  return {reset,get src(){return src;},get pending(){return pending;}};
 }
 function validateField(field,parse,status){
  const value=field.value.trim();
  try{parse(value);field.removeAttribute('aria-invalid');return value;}
  catch(err){const details=field.closest('details');if(details)details.open=true;status.textContent=err.message;field.setAttribute('aria-invalid','true');field.focus();return null;}
 }

 const desktopForm=byId('beautyForm'),mode=byId('beautyBackgroundMode'),deskStatus=byId('beautyStatus');
 const wallPreview=byId('beautyWallpaperPreview'),desktopSave=desktopForm.querySelector('[type=submit]');
 const wall=imageField(byId('beautyWallpaperFile'),byId('beautyWallpaperRemove'),byId('beautyWallpaperStatus'),imageKinds.wall,updateWall);
 function updateWall(){
  byId('beautyWallpaperControls').hidden=mode.value!=='custom';byId('beautyColorControls').hidden=mode.value!=='solid';
  wallPreview.hidden=!wall.src;
  if(wall.src)wallPreview.src=wall.src;else wallPreview.removeAttribute('src');
  desktopSave.disabled=wall.pending;
 }
 function fillDesktop(){
  byId('beautyTitle').value=saved.title;byId('beautySubtitle').value=saved.subtitle;
  byId('beautyBg').value=saved.solid;byId('beautyIcon').value=saved.icon;byId('beautySize').value=saved.size;
  byId('beautyGlobalCSS').value=saved.css;byId('beautyGlobalCSS').removeAttribute('aria-invalid');
  mode.value=color(saved.bg)?'solid':saved.bg;
  wall.reset(saved.wallpaper);
 }
 mode.addEventListener('change',updateWall);
 desktopForm.addEventListener('submit',e=>{
  e.preventDefault();if(wall.pending)return;
  const title=byId('beautyTitle').value.trim();
  if(!title){deskStatus.textContent='请填写桌面标题。';byId('beautyTitle').focus();return;}
  if(mode.value==='custom'&&!wall.src){deskStatus.textContent='请先选择壁纸，或切换背景方式。';byId('beautyWallpaperFile').focus();return;}
  const css=validateField(byId('beautyGlobalCSS'),desktopRules,deskStatus);if(css===null)return;
  const solid=byId('beautyBg').value;
  const next={...saved,title,subtitle:byId('beautySubtitle').value.trim(),bg:mode.value==='solid'?solid:mode.value,solid,wallpaper:wall.src,icon:byId('beautyIcon').value,size:byId('beautySize').value,css};
  if(save(next,deskStatus,'桌面美化已保存，返回桌面即可查看。'))applyDesktop();
 });
 byId('beautyDefault').addEventListener('click',()=>{if(save({...saved,...defaults},deskStatus,'已恢复默认桌面外观，单独设置的 App 图标和小组件不受影响。')){applyDesktop();fillDesktop();}});

 const appForm=byId('themeAppForm'),appStatus=byId('themeIconStatus'),appSave=appForm.querySelector('[type=submit]');
 const shapeField=byId('themeIconShape'),shapeCSSField=byId('themeShapeCSS'),iconCSSField=byId('themeIconCSS');
 const preview=byId('themeIconPreview');
 let previewSurface;
 const photo=imageField(byId('themeIconFile'),byId('themeIconRemove'),byId('themeIconFileStatus'),imageKinds.icon,updateIcon);
 function updateIcon(){
  byId('themeShapeControls').hidden=shapeField.value!=='custom';
  appSave.disabled=photo.pending||!entries.has(select.value);
  if(previewSurface)applyIcon(previewSurface,cleanIcon({image:photo.src,shape:shapeField.value,css:iconCSSField.value,shapeCSS:shapeCSSField.value}));
 }
 function fillApp(clearStatus=true){
  const entry=entries.get(select.value),appearance=saved.apps[select.value]||{};
  if(clearStatus)appStatus.textContent=entry?'':'没有可美化的 App 图标。';
  shapeField.value=appearance.shape||'default';shapeCSSField.value=appearance.shapeCSS||'';iconCSSField.value=appearance.css||'';
  for(const field of [shapeCSSField,iconCSSField])field.removeAttribute('aria-invalid');
  preview.replaceChildren();previewSurface=undefined;
  if(entry){
   const example=document.createElement('div');example.className='theme-icon-example';previewSurface=entry.sample.cloneNode(true);
   previewSurface.setAttribute('aria-hidden','true');example.append(previewSurface,document.createTextNode(entry.label));preview.append(example);
  }
  photo.reset(appearance.image);
 }
 select.addEventListener('change',()=>fillApp());
 shapeField.addEventListener('change',updateIcon);
 for(const field of [shapeCSSField,iconCSSField])field.addEventListener('input',()=>{field.removeAttribute('aria-invalid');updateIcon();});
 function saveApp(id,appearance,message){
  const apps={...saved.apps};
  if(Object.keys(appearance).length)apps[id]=appearance;else delete apps[id];
  if(!save({...saved,apps},appStatus,message))return;
  applyIcon(entries.get(id).surface,appearance);fillApp(false);
 }
 appForm.addEventListener('submit',e=>{
  e.preventDefault();const id=select.value;if(!entries.has(id)||photo.pending)return;
  const css=validateField(iconCSSField,iconRules,appStatus);if(css===null)return;
  const shape=shapeField.value;
  const shapeCSS=shape==='custom'?validateField(shapeCSSField,s=>{if(!shapeRules(s).length)throw Error('请填写形态 CSS，或选择一个预设形态。');},appStatus):'';
  if(shapeCSS===null)return;
  saveApp(id,cleanIcon({css,shape,shapeCSS,image:photo.src}),`「${entries.get(id).label}」图标已保存。`);
 });
  byId('themeIconDefault').addEventListener('click',()=>{if(entries.has(select.value))saveApp(select.value,{},'已恢复当前 App 的默认图标。');});

  const batchForm=byId('themeBatchForm'),batchList=byId('themeBatchList'),batchShape=byId('themeBatchShape');
  const batchAll=byId('themeBatchAll'),batchClear=byId('themeBatchClear'),batchCount=byId('themeBatchCount');
  const batchStatus=byId('themeBatchStatus'),batchSave=batchForm.querySelector('[type=submit]'),batchChecks=new Map();
  for(const option of shapeField.options){
   if(own(shapePresets,option.value))batchShape.add(option.cloneNode(true));
  }
  function selectedBatchApps(){return [...batchChecks].filter(([,check])=>check.checked).map(([id])=>id);}
  function updateBatch(clearStatus=false){
   const count=selectedBatchApps().length;
   batchCount.textContent=`已选 ${count} 个`;
   batchAll.disabled=count===batchChecks.size;batchClear.disabled=!count;
   batchSave.disabled=!count||!own(shapePresets,batchShape.value);
   if(clearStatus)batchStatus.textContent='';
  }
  function fillBatch(){
   for(const [id,entry] of entries){
    if(batchChecks.has(id))continue;
    const label=document.createElement('label'),check=document.createElement('input');
    check.type='checkbox';check.value=id;
    label.append(check,document.createTextNode(entry.label));batchList.append(label);batchChecks.set(id,check);
   }
   updateBatch();
  }
  batchList.addEventListener('change',()=>updateBatch(true));
  batchShape.addEventListener('change',()=>updateBatch(true));
  for(const button of [batchAll,batchClear])button.addEventListener('click',()=>{
   for(const check of batchChecks.values())check.checked=button===batchAll;
   updateBatch(true);
  });
  batchForm.addEventListener('submit',e=>{
   e.preventDefault();
   const ids=selectedBatchApps(),shape=batchShape.value;
   if(!ids.length||!own(shapePresets,shape))return;
   const apps={...saved.apps};
   for(const id of ids){
    const appearance={...apps[id]};
    delete appearance.shapeCSS;
    if(shape==='default')delete appearance.shape;else appearance.shape=shape;
    if(Object.keys(appearance).length)apps[id]=appearance;else delete apps[id];
   }
   const label=batchShape.selectedOptions[0].textContent;
   if(!save({...saved,apps},batchStatus,`已将 ${ids.length} 个 App 的图标形状设为「${label}」。`))return;
   for(const id of ids)applyIcon(entries.get(id).surface,apps[id]||{});
   if(ids.includes(select.value)){
    // 只同步轮廓，不清空单个 App 尚未保存的图片或配色草稿。
    shapeField.value=shape;shapeCSSField.value='';shapeCSSField.removeAttribute('aria-invalid');
    appStatus.textContent='';updateIcon();
   }
  });

   for(const button of theme.querySelectorAll('[data-copy-theme-prompt]')){
    const card=button.closest('.theme-template');
    const prompt=card.querySelector('.theme-prompt'),details=prompt.closest('details');
    const status=card.querySelector('.theme-copy-status');
    button.addEventListener('click',async()=>{
     status.textContent='';
     try{
      if(navigator.clipboard?.writeText){
       await navigator.clipboard.writeText(prompt.value);
       status.textContent='已复制提示词。';return;
      }
     }catch{}
     const wasOpen=details.open;
     details.open=true;prompt.focus();prompt.select();
     let copied=false;
     try{copied=document.execCommand('copy');}catch{}
     if(copied){
      details.open=wasOpen;button.focus();status.textContent='已复制提示词。';
     }else{
      status.textContent='无法自动复制，请长按提示词，或用键盘手动复制。';
     }
    });
   }

   const tabs=[...theme.querySelectorAll('.theme-nav button')];
 const back=theme.querySelector('header .back'),widgetPane=byId('themeWidgets'),widgetEditor=byId('themeWidgetEditor');
 tabs.forEach(tab=>tab.addEventListener('click',()=>{
  const active=tab.getAttribute('aria-controls');
  for(const button of tabs){const selected=tab===button;button.setAttribute('aria-pressed',String(selected));byId(button.getAttribute('aria-controls')).hidden=!selected;}
  back.setAttribute('aria-label',active===widgetPane.id?widgetEditor.dataset.backLabel||'返回桌面':'返回桌面');
 }));
 back.setAttribute('aria-label','返回桌面');
 applyDesktop();fillDesktop();collectApps();fillApp();fillBatch();
 // 有些 App 会异步注册到原列表；只给新增按钮应用外观，不替换节点。
 if(inbox)new MutationObserver(()=>{
  const before=entries.size;collectApps();
  if(entries.size===before)return;
  if(!before)fillApp();
  fillBatch();
 }).observe(inbox,{childList:true});
 if(!byId('themeWidgetCatalog').childElementCount)byId('themeWidgetStatus').textContent='小组件编辑器未能加载，请刷新页面重试。';
})();
