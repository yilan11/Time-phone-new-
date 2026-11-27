/* 桌面小组件内容与选型界面；布局交由 desktop.js 保存。 */
window.snowfallWidgetUI=(()=>{
 'use strict';
 // 尺寸预设：宽（列）× 高（行）。其他网格内的尺寸使用自定义输入。

 const sizes=[[2,2],[1,2],[1,4],[2,4],[3,5]];
 const photoDefault='snowfall-assets/cat-front.png';
 const photoValid=value=>typeof value==='string'&&value.length<=500000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
 const text=(tag,className,value)=>{const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined)n.textContent=value;return n;};
 const button=(label,fn)=>{const b=text('button','',label);b.type='button';b.addEventListener('click',fn);return b;};
 const same=(a,b)=>a.w===b.w&&a.h===b.h;
 const sizeLabel=i=>`${i.w}×${i.h}`;
 const isPreset=({w,h})=>sizes.some(([x,y])=>x===w&&y===h);

 function localDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?date:null;
 }
 const looks=new Map([['default','原样式'],['glass','液态玻璃背景'],['white','纯白背景'],['paper','便签背景'],['custom','自定义风格']]);
 const maxBG=200000,maxCSS=4000;
 const bgValid=value=>photoValid(value)&&value.length<=maxBG;
 const bigTextLimit=120,bigTextColor='#3b4a52',bigTextPanel='#b9dce4',bigTextSample='把今天写成一行诗';
 const validColor=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value);
 const visualProps=new Set(('background background-color background-image background-size background-position background-repeat '+
  'color border border-color border-width border-style border-radius box-shadow text-shadow font-size font-weight font-family letter-spacing '+
  'backdrop-filter -webkit-backdrop-filter').split(' '));
 const visualFunctions=new Set(('rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix '+
  'linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient '+
  'calc min max clamp blur brightness contrast drop-shadow grayscale hue-rotate invert opacity saturate sepia').split(' '));
 function parseLookCSS(source){
  if(source.length>maxCSS)throw Error(`CSS 最多 ${maxCSS} 字。`);
  const css=source.replace(/\/\*[\s\S]*?\*\//g,'');
  if(/[{}@\\"']|\/\*/.test(css))throw Error('只填写 CSS 属性和值，不要加选择器、大括号、引号或链接。');
  const rules=[];
  for(const part of css.split(';')){
   if(!part.trim())continue;
   const i=part.indexOf(':'),prop=part.slice(0,i).trim().toLowerCase(),val=part.slice(i+1).trim();
   if(i<0)throw Error('请使用“属性: 值;”的格式。');
   if(!visualProps.has(prop))throw Error(`不支持「${prop}」；这里仅能修改小组件的外观。`);
   const functions=[...val.matchAll(/([\w-]+)\s*\(/g)];
   if(functions.some(match=>!visualFunctions.has(match[1].toLowerCase()))||!CSS.supports(prop,val))throw Error(`「${prop}」的值不受支持，请检查写法。`);
   rules.push([prop,val]);
  }
  return rules;
 }
 // 只接收项目自带头像或本地压缩的头像，不接收任意链接。
 const panelAvatar='snowfall-assets/widget-panel-avatar.png',panelColor='#b9dce4',panelTextLimit=120;
 const panelAvatarValid=value=>typeof value==='string'&&value.length<=100000&&photoValid(value);
 function clean(id,value){
  if(id==='panel'){
   const {text:message,avatarSrc,panelColor:color}=value??{};
   return {
    text:typeof message==='string'?message.slice(0,panelTextLimit).replace(/[\uD800-\uDBFF]$/u,''):'',
    avatarSrc:panelAvatarValid(avatarSrc)?avatarSrc:panelAvatar,
    panelColor:validColor(color)?color:panelColor
   };
  }
  if(!value||typeof value!=='object')return {};
  const result={};
  if(id==='bigtext'){
   result.text=typeof value.text==='string'?value.text.slice(0,bigTextLimit).replace(/[\uD800-\uDBFF]$/u,''):'';
   result.textColor=validColor(value.textColor)?value.textColor:bigTextColor;
   // 旧版的“纯色背景”颜色沿用为色块颜色。
   result.panelColor=validColor(value.panelColor)?value.panelColor:value.backgroundMode==='solid'&&validColor(value.backgroundColor)?value.backgroundColor:bigTextPanel;
   return result;
  }
  if(id==='memo')result.text=typeof value.text==='string'?value.text.slice(0,500):'';
  if(id==='photo'&&photoValid(value.src))result.src=value.src;
  if(id==='countdown')Object.assign(result,{title:typeof value.title==='string'?value.title.slice(0,28):'',date:localDate(value.date)?value.date:''});
  const look=value.look;
  if(look&&looks.has(look.kind)&&look.kind!=='default'){
   result.look={kind:look.kind};
   if(look.kind==='custom'){
    if(bgValid(look.bg))result.look.bg=look.bg;
    if(typeof look.css==='string'&&look.css){try{parseLookCSS(look.css);result.look.css=look.css;}catch{}}
   }
  }
  return result;
 }
 const appliedLooks=new WeakMap();
  function applyLook(node,look){
   const old=appliedLooks.get(node);
   if(old?.look===look)return;
   for(const prop of old?.props||[])node.style.removeProperty(prop);
   delete node.dataset.widgetFontSize;delete node.dataset.widgetFontWeight;delete node.dataset.widgetFontFamily;
   if(!look){delete node.dataset.widgetLook;appliedLooks.delete(node);return;}
   node.dataset.widgetLook=look.kind;
   const props=new Set();
   function set(prop,value){node.style.setProperty(prop,value);props.add(prop);}
   if(look.kind==='custom'){
    if(look.css)for(const [prop,val] of parseLookCSS(look.css))set(prop,val);
    if(bgValid(look.bg))set('background-image',`url("${look.bg}")`);
    if(props.has('font-size'))node.dataset.widgetFontSize='';
    if(props.has('font-weight'))node.dataset.widgetFontWeight='';
    if(props.has('font-family'))node.dataset.widgetFontFamily='';
   }
   appliedLooks.set(node,{look,props});
  }
  // 大字：没有背景，左上/右下角线贴着组件边界，文字在色块里从上往下竖排。
  function createBigTextCard(){
   const node=text('div','snow-widget-card snow-bigtext'),block=text('div','snow-bigtext-block'),content=text('strong','snow-widget-bigtext-content');
   for(const className of ['snow-bigtext-corner is-top','snow-bigtext-corner is-bottom']){
    const corner=text('span',className);corner.setAttribute('aria-hidden','true');node.append(corner);
   }
   block.append(content);node.append(block);
   return {node,draw(settings){
    const value=clean('bigtext',settings),message=value.text;
    if(content.textContent!==message){
     content.textContent=message;
     const length=message.length+4*(message.split('\n').length-1);
     content.dataset.density=length>40?'long':length>12?'medium':'short';
    }
    node.style.setProperty('--bigtext-ink',value.textColor);
    node.style.setProperty('--bigtext-panel',value.panelColor);
   }};
  }
   function createPanelCard(){
    const node=text('div','snow-widget-card snow-panel'),content=text('div','snow-panel-content');
    const avatar=text('img','snow-panel-avatar'),message=text('p','snow-panel-text');
    avatar.alt='面板头像';avatar.draggable=false;
    content.append(avatar,message);node.append(content);
    for(const className of ['snow-panel-corner is-top','snow-panel-corner is-bottom','snow-panel-dot']){
     const decoration=text('span',className);decoration.setAttribute('aria-hidden','true');node.append(decoration);
    }
    function linear(channel){return channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4;}
    return {node,draw(settings){
     const value=clean('panel',settings);
     if(avatar.getAttribute('src')!==value.avatarSrc)avatar.src=value.avatarSrc;
     if(message.textContent!==value.text)message.textContent=value.text;
     message.hidden=!value.text.trim();
     if(node.style.getPropertyValue('--panel-color')!==value.panelColor){
      const [r,g,b]=[1,3,5].map(i=>linear(parseInt(value.panelColor.slice(i,i+2),16)/255));
      const light=.2126*r+.7152*g+.0722*b;
      node.style.setProperty('--panel-color',value.panelColor);
      node.style.setProperty('--panel-ink',light<.179?'#fff':light<.47?'#171f24':'#3b4a52');
      node.style.setProperty('--panel-line',light<.179?'#eee':light<.47?'#3b4a52':'#6b6b6b');
     }
    }};
   }
   function createCard(id){
    if(id==='bigtext')return createBigTextCard();
    if(id==='panel')return createPanelCard();
   const node=text('div',`snow-widget-card snow-${id}`),kicker=text('span','snow-widget-kicker'),main=text('strong','snow-widget-main'),sub=text('span','snow-widget-sub');
  let image,bar;
  if(id==='photo'){image=text('img','snow-widget-image');image.draggable=false;node.append(image,kicker);}
  else{node.append(kicker,main,sub);if(id==='year'){bar=text('progress','snow-widget-progress');bar.max=100;bar.setAttribute('aria-label','本年度已过去的比例');node.append(bar);}}
  return {node,draw(settings,now){
   if(id==='memo'){
    kicker.textContent='随手记';main.textContent=settings.text?.trim()?settings.text:'还没有写便签';sub.textContent=settings.text?.trim()?'':'长按后点齿轮编辑';
   }else if(id==='photo'){
    const custom=photoValid(settings.src),src=custom?settings.src:photoDefault;
    if(image.getAttribute('src')!==src)image.src=src;
    image.alt=custom?'自选照片':'雪落机小猫';kicker.textContent=custom?'':'小猫相片';node.classList.toggle('snow-photo-custom',custom);
   }else if(id==='countdown'){
    const date=localDate(settings.date),today=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
    const days=date?Math.round((date-today)/86400000):null;
    kicker.textContent=settings.title?.trim()||'倒计时';
    main.textContent=days===null?'—':days===0?'今天':`${Math.abs(days)} 天`;
    sub.textContent=days===null?'还未设定日期':days===0?settings.date:`${days>0?'距离':'已过'} · ${settings.date}`;
   }else if(id==='year'){
    const y=now.getFullYear(),first=Date.UTC(y,0,1),last=Date.UTC(y+1,0,1),today=Date.UTC(y,now.getMonth(),now.getDate());
    const pct=(today-first)/(last-first)*100;
    kicker.textContent=`${y} 年度进度`;main.textContent=`${Math.floor(pct)}%`;sub.textContent=`今年还剩 ${(last-today)/86400000-1} 天（不含今天）`;bar.value=pct;
   }
  }};
 }
 async function importPhoto(file,isValid=photoValid){
  if(!file||!/^image\/(png|jpeg|webp|gif|bmp|avif|heic|heif)$/i.test(file.type))throw Error('请选择设备支持的图片文件，例如 JPG、PNG 或 WebP。');
  if(file.size>20*1024*1024)throw Error('照片太大，请选择 20 MB 以内的图片。');
  const url=URL.createObjectURL(file),img=new Image();
  try{
   img.src=url;await img.decode();
   if(!img.naturalWidth||!img.naturalHeight)throw Error('图片无法读取。');
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   for(const [limit,quality] of [[840,.86],[640,.78],[480,.72]]){
    const scale=Math.min(1,limit/Math.max(img.naturalWidth,img.naturalHeight));
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    ctx.fillStyle='#ebf2f9';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data=canvas.toDataURL('image/jpeg',quality);if(isValid(data))return data;
   }
   throw Error('照片压缩失败。');
  }finally{URL.revokeObjectURL(url);}
 }
 function mountBigText(draft,form,labelField,redraw){
  Object.assign(draft,clean('bigtext',draft));
  const content=text('textarea'),ink=text('input'),fill=text('input'),fields=text('fieldset','widget-look widget-bigtext-look');
  content.maxLength=bigTextLimit;content.rows=3;content.value=draft.text||'';content.placeholder=`例如：${bigTextSample}`;
  ink.type=fill.type='color';ink.value=draft.textColor;fill.value=draft.panelColor;
  function update(){draft.text=content.value;draft.textColor=ink.value;draft.panelColor=fill.value;redraw();}
  for(const input of [content,ink,fill])input.addEventListener('input',update);
  labelField(`文字内容（最多 ${bigTextLimit} 字，回车换列）`,content);
  fields.append(text('legend','','颜色'));
  labelField('色块颜色',fill,fields);labelField('文字颜色',ink,fields);
  form.append(fields);
 }
 function mountPanel(draft,form,labelField,isCurrent,setBusy,redraw){
  Object.assign(draft,clean('panel',draft));
  const fields=text('fieldset','widget-look widget-panel-fields');
  const message=text('textarea'),color=text('input'),image=text('input');
  const status=text('p','widget-size-note');
  status.setAttribute('role','status');
  message.maxLength=panelTextLimit;message.rows=3;message.value=draft.text;message.placeholder='输入想显示在面板上的文字…';
  color.type='color';color.value=draft.panelColor;
  image.type='file';image.accept='image/*';
  let turn=0;
  const reset=button('恢复默认头像',()=>{
   turn++;image.value='';draft.avatarSrc=panelAvatar;setBusy(false);
   status.textContent='正在使用默认头像';redraw();image.focus();reset.disabled=true;
  });
  const hasCustomAvatar=()=>draft.avatarSrc!==panelAvatar;
  status.textContent=hasCustomAvatar()?'已设置自选头像':'正在使用默认头像';
  reset.disabled=!hasCustomAvatar();
  image.addEventListener('change',async()=>{
   const file=image.files[0];if(!file)return;
   const reading=++turn;setBusy(true);reset.disabled=false;status.textContent='正在读取头像…';
   try{
    const src=await importPhoto(file,panelAvatarValid);if(!isCurrent()||reading!==turn)return;
    draft.avatarSrc=src;status.textContent='已设置自选头像';redraw();
   }catch(err){
    if(isCurrent()&&reading===turn)status.textContent=`${err.message||'无法读取头像。'} 原头像未更改。`;
   }finally{
    if(isCurrent()&&reading===turn){image.value='';reset.disabled=!hasCustomAvatar();setBusy(false);}
   }
  });
  function update(){draft.text=message.value;draft.panelColor=color.value;redraw();}
  message.addEventListener('input',update);color.addEventListener('input',update);color.addEventListener('change',update);
  fields.append(text('legend','','面板设置'));
  labelField(`面板文字（最多 ${panelTextLimit} 字）`,message,fields);
  labelField('面板颜色',color,fields);
  labelField('选择头像（仅保存在本机）',image,fields);
  fields.append(status,reset);form.append(fields);update();
 }
 function mount({defs,cols,rows,validSize,list,getItem,isRemoved,canSave,createInstance,updateInstance,restoreInstance,removeInstance,returnHome,makePreview=()=>null,cellSize=()=>({w:80,h:80,gap:3}),view='app-widgets',prefix='widget'}){
  const field=name=>document.getElementById(prefix+name);
  const catalog=field('Catalog'),editor=field('Editor'),tip=field('Intro');
  const status=field('Status'),back=document.querySelector(`#${view} header .back`),cards=new Map();
  const scroll=editor.closest('.scroll');
  let ticket=0,stepBack=null;
  const stay=view==='beauty';
  function details(item){
   const content=item.settings?.text||item.settings?.title||item.settings?.date;
   return [isRemoved(item.id)?'已移除':`第 ${item.page+1} 页 · 第 ${item.y+1} 行、第 ${item.x+1} 列`,sizeLabel(item),content?.trim().slice(0,32)].filter(Boolean).join(' · ');
  }
  function refresh(){
   for(const [id,{badge,action,instances,def}] of cards){
    const entries=list(id),active=entries.filter(item=>!isRemoved(item.id)).length;
    badge.textContent=`桌面 ${active} 个`+(entries.length>active?` · 已移除 ${entries.length-active} 个`:'');
    action.disabled=!canSave();instances.replaceChildren();
    for(const [i,item] of entries.entries()){
     const row=text('li','widget-instance'),label=text('small','',`#${i+1} · ${details(item)}`);
     const edit=button(isRemoved(item.id)?'恢复…':'编辑',()=>open(id,item.id));
     edit.disabled=!canSave();edit.setAttribute('aria-label',`${edit.textContent}${def.name}小组件 #${i+1}`);
     row.append(label,edit);instances.append(row);
    }
    instances.hidden=!entries.length;
   }
  }
  function showList(focusId){
   ticket++;stepBack=null;back.setAttribute('aria-label','返回桌面');delete editor.dataset.backLabel;
   editor.hidden=true;editor.replaceChildren();catalog.hidden=false;tip.hidden=false;status.textContent='';refresh();
   if(focusId)cards.get(focusId)?.action.focus();
  }
  function showStep(form,focus,onBack,backLabel){
   stepBack=onBack;editor.dataset.backLabel=backLabel;back.setAttribute('aria-label',backLabel);
   status.textContent='';tip.hidden=true;catalog.hidden=true;
   editor.replaceChildren(form);editor.hidden=false;scroll.scrollTop=0;focus.focus();
  }
  back.addEventListener('click',e=>{
   if(!stepBack||scroll.hidden)return;
   e.stopImmediatePropagation();stepBack();
  },true);
  // 实时预览：按桌面格子的真实比例画出小组件，再整体缩小放进编辑页。
  function liveStage(id,maxW=280,maxH=240){
   const stage=text('div','widget-live'),box=text('div','widget-live-box'),card=makePreview(id);
   stage.append(box);
   if(card){card.node.classList.add('desktop-item');card.node.setAttribute('aria-hidden','true');card.node.inert=true;box.append(card.node);}
   else box.append(text('span','widget-live-empty','暂无预览'));
   return {stage,card,show(size,settings,look){
    const cell=cellSize(),W=size.w*cell.w+(size.w-1)*cell.gap,H=size.h*cell.h+(size.h-1)*cell.gap;
    const room=Math.min(maxW,stage.clientWidth?stage.clientWidth-16:maxW),scale=Math.min(1.4,Math.max(40,room)/W,maxH/H);
    box.style.width=`${Math.round(W*scale)}px`;box.style.height=`${Math.round(H*scale)}px`;
    if(!card)return;
    Object.assign(card.node.style,{width:`${W}px`,height:`${H}px`,transform:`scale(${scale})`});
    try{card.draw?.(settings,new Date());applyLook(card.node,look);}catch{}
   }};
  }
  // 尺寸直接在编辑页里点选，不再单独跳一页。
  function sizePicker(selected,onPick){
   const field=text('fieldset','widget-size-field widget-size-inline'),choices=text('div','widget-size-choices');
   field.append(text('legend','','尺寸（列 × 行）'),choices);
   const group=`${prefix}Size${ticket}`,options=[];
   function pick(size,input){for(const o of options)o.classList.toggle('is-on',o.querySelector('input')===input);onPick(size);}
   function chip(label,size){
    const option=text('label','widget-size-option'),input=text('input'),shape=text('span','widget-size-shape');
    input.type='radio';input.name=group;
    if(size){shape.style.setProperty('--widget-cols',size.w);shape.style.setProperty('--widget-rows',size.h);}
    option.append(text('span','widget-size-tile'),text('span','widget-size-caption'));
    option.firstChild.append(size?shape:text('span','widget-size-plus','＋'));
    option.lastChild.append(input,text('span','',label));choices.append(option);options.push(option);return input;
   }
   for(const [w,h] of sizes){
    if(!validSize(w,h))continue;
    const size={w,h},input=chip(sizeLabel(size),size);
    input.checked=same(size,selected);input.addEventListener('change',()=>{axes.hidden=true;pick(size,input);});
   }
   const customInput=chip('自定义',null),axes=text('div','widget-size-axes');
   const num=(caption,value,max)=>{
    const label=text('label','widget-size-axis'),input=text('input');
    input.type='text';input.inputMode='numeric';input.autocomplete='off';input.value=value;input.placeholder=`1–${max}`;
    input.addEventListener('input',()=>{
     input.value=input.value.replace(/\D/g,'').slice(0,2);
     const w=Number(cw.value),h=Number(ch.value);
     if(validSize(w,h)){note.textContent='';pick({w,h},customInput);}else note.textContent=`列数 1–${cols}，行数 1–${rows}。`;
    });
    label.append(text('span','',caption),input);return input;
   };
   const cw=num('列数',selected.w,cols),ch=num('行数',selected.h,rows),note=text('p','widget-form-error');
   axes.append(cw.parentElement,text('span','widget-size-times','×'),ch.parentElement);
   customInput.checked=!isPreset(selected);axes.hidden=!customInput.checked;
   customInput.addEventListener('change',()=>{axes.hidden=false;cw.focus();const w=Number(cw.value),h=Number(ch.value);if(validSize(w,h))pick({w,h},customInput);});
   for(const o of options)o.classList.toggle('is-on',o.querySelector('input').checked);
   field.append(axes,note,text('p','widget-size-note','当前页放不下时，会找其他有空位的页面。'));
   return field;
  }
  function open(id,instanceId=null,direct=false){
   const def=defs.find(d=>d.id===id);if(!def||!canSave())return;
   const item=instanceId?getItem(instanceId):null;
   if(instanceId&&item?.typeId!==id)return;
   const removed=item&&isRemoved(instanceId),seq=++ticket,draft={...item?.settings};
   const {w,h}=item||def;
   let selected=validSize(w,h)?{w,h}:{w:1,h:1};
   // 编辑页是总界面：上面是实时预览，下面依次是尺寸、内容、外观，最后添加到桌面。
   const form=text('form','widget-form widget-content-form'),title=text('h2','',def.name),top=text('div','widget-editor-top');
   title.tabIndex=-1;top.append(title,text('p','',item?details(item):def.description));
   const live=liveStage(id),liveNote=text('p','widget-size-note widget-live-note');
   live.stage.append(liveNote);form.append(live.stage,top);
   let currentLook=()=>draft.look,frame=0;
   function redraw(){
    if(frame)return;
    frame=requestAnimationFrame(()=>{
     frame=0;if(seq!==ticket)return;
     const settings=clean(id,{...draft});
     if(id==='bigtext'&&!settings.text.trim())settings.text=bigTextSample;
     live.show(selected,settings,currentLook());
     liveNote.textContent=`实时预览 · ${sizeLabel(selected)}（列 × 行）`;
    });
   }
   form.addEventListener('input',redraw);form.addEventListener('change',redraw);
   const sizeArea=sizePicker(selected,size=>{selected=size;redraw();});form.append(sizeArea);
   const leaveLabel=direct?'返回桌面':'返回小组件列表';
   function leave(){showList(direct?null:id);if(direct)returnHome(instanceId);}
   function showContent(focus=title){showStep(form,focus,leave,leaveLabel);redraw();}
   const labelField=(caption,input,parent=form)=>{const label=text('label','widget-form-field');label.append(text('span','',caption),input);parent.append(label);};
   const actions=text('div','widget-editor-actions');
   const submit=text('button','widget-primary',removed?'恢复到桌面':item?'保存修改':'添加到桌面');submit.type='submit';
   const add=item?text('button','','添加到桌面'):null;if(add)add.type='submit';
   const cancel=button(leaveLabel,leave);
   const error=text('p','widget-form-error');error.setAttribute('role','status');
   let readingContentImage=false,readingBackground=false,customLookActive=false;
   function updateSubmit(){submit.disabled=readingContentImage||(customLookActive&&readingBackground);if(add)add.disabled=submit.disabled;}
   function setContentImageBusy(busy){readingContentImage=busy;updateSubmit();}
   if(id==='bigtext'){
mountBigText(draft,form,labelField,redraw);
    }else if(id==='panel'){
     mountPanel(draft,form,labelField,()=>seq===ticket,setContentImageBusy,redraw);
    }else if(id==='memo'){
    const content=text('textarea');content.maxLength=500;content.rows=4;content.value=draft.text||'';content.placeholder='记一件想随时看到的小事…';
    content.addEventListener('input',()=>{draft.text=content.value;});labelField('便签内容（最多 500 字）',content);
   }else if(id==='photo'){
    const input=text('input');
    input.type='file';input.accept='image/*';let change=0;
const reset=button('使用默认小猫',()=>{change++;input.value='';delete draft.src;setContentImageBusy(false);error.textContent='';redraw();});
     input.addEventListener('change',async()=>{
      const file=input.files[0];if(!file)return;
      const turn=++change;setContentImageBusy(true);error.textContent='正在读取照片…';
      try{const src=await importPhoto(file);if(seq!==ticket||turn!==change)return;draft.src=src;error.textContent='';redraw();}
      catch(err){if(seq===ticket&&turn===change)error.textContent=`${err.message||'无法读取照片'} 原照片未更改。`;}
      finally{if(seq===ticket&&turn===change){setContentImageBusy(false);input.value='';}}
     });
    labelField('选择设备里的照片（仅保存在本机）',input);form.append(reset);
   }else if(id==='countdown'){
    const name=text('input'),date=text('input');name.type='text';name.maxLength=28;name.placeholder='例如：出发去旅行';name.value=draft.title||'';
    date.type='date';date.required=true;date.min='0001-01-01';date.max='9999-12-31';date.value=draft.date||'';
    name.addEventListener('input',()=>{draft.title=name.value;});date.addEventListener('input',()=>{draft.date=date.value;});labelField('事件名称',name);labelField('目标日期',date);
   }
   let readLook=()=>undefined;
   if(id!=='bigtext'){
    const lookBox=text('details','widget-more'),lookField=text('fieldset','widget-look'),kind=text('select'),custom=text('div','widget-look-custom');
    lookBox.append(text('summary','','外观（背景、自定义 CSS）'),lookField);lookBox.open=!!draft.look;
   for(const [value,label] of looks){const option=text('option','',label);option.value=value;kind.append(option);}
   kind.value=draft.look?.kind||'default';labelField('外观风格',kind,lookField);
   const bgInput=text('input'),cssInput=text('textarea');
   const bgStatus=text('p','widget-size-note'),cssStatus=text('p','widget-form-error');
   bgStatus.setAttribute('role','status');cssStatus.setAttribute('role','status');
   cssStatus.id=prefix+'LookCSSStatus';cssInput.setAttribute('aria-describedby',cssStatus.id);
   bgInput.type='file';bgInput.accept='image/*';
   cssInput.rows=3;cssInput.maxLength=maxCSS;cssInput.spellcheck=false;
   cssInput.placeholder='例如：color: #334155; border-radius: 12px;';
   cssInput.value=draft.look?.css||'';
   let background=draft.look?.bg,bgTurn=0;
   function candidate(){
    if(kind.value==='default')return undefined;
    if(kind.value!=='custom')return {kind:kind.value};
    return {kind:'custom',bg:background,css:cssInput.value.trim()};
   }
   function updatePreview(){
    const look=candidate();customLookActive=look?.kind==='custom';custom.hidden=!customLookActive;
    cssStatus.textContent='';cssInput.removeAttribute('aria-invalid');
    try{if(look?.css)parseLookCSS(look.css);}
    catch(err){cssStatus.textContent=err.message;cssInput.setAttribute('aria-invalid','true');delete look.css;}
    currentLook=()=>look;redraw();updateSubmit();
   }
   const removeBG=button('移除背景图片',()=>{
    bgTurn++;background=undefined;bgInput.value='';readingBackground=false;
    bgStatus.textContent='未设置背景图片';removeBG.disabled=true;updatePreview();
   });
   removeBG.disabled=!background;
   bgStatus.textContent=background?'已设置背景图片':'未设置背景图片';
   bgInput.addEventListener('change',async()=>{
    const file=bgInput.files[0];if(!file)return;
    const turn=++bgTurn;readingBackground=true;updateSubmit();removeBG.disabled=false;
    bgStatus.textContent='正在读取背景图片…';
    try{
     const src=await importPhoto(file,bgValid);if(seq!==ticket||turn!==bgTurn)return;
     background=src;bgStatus.textContent='已设置背景图片';updatePreview();
    }catch(err){
     if(seq===ticket&&turn===bgTurn)bgStatus.textContent=`${err.message||'无法读取背景图片。'} ${background?'原背景未更改。':'未设置背景图片。'}`;
    }finally{
     if(seq===ticket&&turn===bgTurn){readingBackground=false;bgInput.value='';removeBG.disabled=!background;updateSubmit();}
    }
   });
   labelField('选择背景图片（仅保存在本机）',bgInput,custom);custom.append(bgStatus,removeBG);
   labelField('自定义 CSS（只填写属性和值）',cssInput,custom);custom.append(cssStatus);
   kind.addEventListener('change',updatePreview);cssInput.addEventListener('input',updatePreview);
   lookField.append(custom);form.append(lookBox);updatePreview();
   readLook=()=>{
    const look=candidate();
    try{if(look?.css)parseLookCSS(look.css);}
    catch(err){cssStatus.textContent=err.message;cssInput.setAttribute('aria-invalid','true');cssInput.focus();return false;}
    return look;
   };
   }
   actions.append(submit);if(add)actions.append(add);actions.append(cancel);
   if(item&&!removed&&!direct)actions.append(button('移除这个小组件',()=>{
    const problem=removeInstance(instanceId);if(problem){error.textContent=problem;return;}
    showList(id);status.textContent=`${def.name}小组件已移除，内容仍可恢复。`;
   }));
   form.append(error,actions);
   form.addEventListener('submit',e=>{
    e.preventDefault();if(seq!==ticket||submit.disabled||!form.isConnected)return;
    if(id==='countdown'&&!localDate(draft.date)){error.textContent='请输入有效的目标日期。';return;}
    const look=readLook();if(look===false)return;
    const settings=clean(id,{...draft,look}),creating=!item||e.submitter===add;
    const result=creating?createInstance(id,selected,settings,stay):removed?restoreInstance(id,instanceId,selected,settings,stay):updateInstance(id,instanceId,selected,settings,stay);
    if(result.error){error.textContent=result.error;return;}
    showList(stay?id:null);
    const message=`${def.name}小组件已${creating?'添加到桌面':removed?'恢复':'保存'} · 第 ${result.page+1} 页`;
    if(stay)status.textContent=message;else returnHome(result.id,message);
   });
   showContent();
  }
  for(const def of defs){
   const group=text('section','widget-type'),card=text('article','widget-choice'),info=text('div','widget-choice-info');
   const label=text('h2','',def.name),badge=text('small','widget-choice-badge'),action=button('添加',e=>{e.stopPropagation();open(def.id);});
   action.setAttribute('aria-label',`添加${def.name}小组件`);
   const thumb=liveStage(def.id,76,76);thumb.stage.classList.add('widget-choice-thumb');
   card.addEventListener('click',()=>{if(!action.disabled)open(def.id);});
   const instances=text('ul','widget-instances');instances.setAttribute('aria-label',`${def.name}小组件列表`);
   info.append(label,text('p','',def.description),badge);card.append(thumb.stage,info,action);
   requestAnimationFrame(()=>thumb.show({w:def.w,h:def.h},def.id==='bigtext'?{text:bigTextSample}:{},undefined));
    group.append(card);
    if(stay&&def.id==='photo'){
     const preview=text('figure','widget-photo-example'),image=text('img');
     image.src='snowfall-assets/widget-photo-poem-preview.jpg';
     image.alt='把今天写成一行诗：暖白纸面上的手写笔触和对角括线';
     image.width=960;image.height=1124;image.loading='lazy';image.decoding='async';
     preview.append(image,text('figcaption','widget-size-note','图片小组件示例 · 不会替换桌面照片'));
     group.append(preview);
    }
    group.append(instances);catalog.append(group);cards.set(def.id,{badge,action,instances,def});
  }
  refresh();return {open,refresh,showList};
 }
  return {clean,createCard,applyLook,mount};
})();
