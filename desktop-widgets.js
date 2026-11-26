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

 function createSizeForm(def,selected,{cols,rows,validSize},onSave,onBack){
  const form=text('form','widget-form widget-size-form'),title=text('h2','',`${def.name}尺寸`),top=text('div','widget-editor-top');
  title.tabIndex=-1;top.append(title,text('p','','左右滑动浏览尺寸预设，点选后保存；也可以填写自定义尺寸。'));
  const field=text('fieldset','widget-size-field'),legend=text('legend','','尺寸（列 × 行）'),choices=text('div','widget-size-choices');
  const help=text('p','widget-size-note',`列数 1–${cols}，行数 1–${rows}，均为整数。`);
  const feedback=text('p','widget-size-feedback');feedback.id='widgetSizeFeedback';feedback.setAttribute('role','status');
  help.id='widgetSizeHelp';field.setAttribute('aria-describedby',help.id);
  function message(value='',invalid=false){feedback.textContent=value;feedback.classList.toggle('is-error',invalid);}
  function confirm(size){onSave(size);message(`尺寸已保存为 ${sizeLabel(size)}，可返回编辑组件。`);}
  function radio(value,checked){const input=text('input');input.type='radio';input.name='widget-size';input.value=value;input.checked=checked;return input;}
  const presets=[];
  for(const [w,h] of sizes){
   if(!validSize(w,h))continue;
   const size={w,h},label=text('label','widget-size-option'),input=radio(sizeLabel(size),same(size,selected));
   const tile=text('span','widget-size-tile'),shape=text('span','widget-size-shape'),caption=text('span','widget-size-caption');
   tile.setAttribute('aria-hidden','true');shape.style.setProperty('--widget-cols',w);shape.style.setProperty('--widget-rows',h);tile.append(shape);
   caption.append(input,text('span','',sizeLabel(size)));label.append(tile,caption);choices.append(label);presets.push({input,size,label});
  }
  const custom=text('div','widget-size-custom'),choice=text('label','widget-size-custom-choice');
  const customRadio=radio('custom',!isPreset(selected)),axes=text('div','widget-size-axes');
  choice.append(customRadio,text('span','','自定义'));
  function clearFeedback(){message();for(const axis of axes.querySelectorAll('input'))axis.removeAttribute('aria-invalid');}
  function integerField(caption,value){
   const label=text('label','widget-size-axis'),input=text('input');
   // 文本框配数字键盘：不让 number 输入框接受指数或小数。
   input.type='text';input.inputMode='numeric';input.pattern='[0-9]+';input.autocomplete='off';input.placeholder='—';input.value=value;
   input.setAttribute('aria-describedby',`${help.id} ${feedback.id}`);
   function reject(){
    customRadio.checked=true;input.value='';clearFeedback();input.setAttribute('aria-invalid','true');message(`${caption}只能填写整数。`,true);
   }
   input.addEventListener('beforeinput',e=>{if(e.cancelable&&e.data&&!/^\d+$/.test(e.data)){e.preventDefault();reject();}});
   input.addEventListener('input',()=>{
    customRadio.checked=true;clearFeedback();if(!/^\d*$/.test(input.value))reject();
   });
   label.append(text('span','',caption),input);axes.append(label);return input;
  }
  const width=integerField('列数',customRadio.checked?selected.w:''),height=integerField('行数',customRadio.checked?selected.h:'');
  axes.insertBefore(text('span','widget-size-times','×'),height.parentElement).setAttribute('aria-hidden','true');
  custom.append(choice,axes);field.append(legend,choices,custom,help);
  field.addEventListener('change',e=>{if(e.target.type==='radio')clearFeedback();});
  const actions=text('div','widget-editor-actions'),submit=text('button','widget-primary','保存');submit.type='submit';
  actions.append(submit,button('返回编辑组件',onBack));
  form.noValidate=true;form.append(top,field,feedback,actions,text('p','widget-size-note widget-size-foot','未保存的尺寸改动不会带回编辑页。'));
  form.addEventListener('submit',e=>{
   e.preventDefault();clearFeedback();
   if(!customRadio.checked){const preset=presets.find(({input})=>input.checked);if(preset)confirm(preset.size);return;}
   function read(input,caption,max){
    const value=Number(input.value);
    if(/^\d+$/.test(input.value)&&Number.isInteger(value)&&value>=1&&value<=max)return value;
    input.setAttribute('aria-invalid','true');message(`${caption}请输入 1–${max} 的整数。`,true);input.focus();return null;
   }
   const w=read(width,'列数',cols);if(w===null)return;
   const h=read(height,'行数',rows);if(h===null)return;
   if(validSize(w,h))confirm({w,h});
  });
  return {form,title,revealSelected(){
   const active=presets.find(({input})=>input.checked);
   if(active)choices.scrollLeft=active.label.offsetLeft-choices.offsetLeft;
  }};
 }
 function localDate(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value?date:null;
 }
 const looks=new Map([['default','原样式'],['glass','液态玻璃背景'],['white','纯白背景'],['paper','便签背景'],['custom','自定义风格']]);
 const maxBG=200000,maxCSS=4000;
 const bgValid=value=>photoValid(value)&&value.length<=maxBG;
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
 function clean(id,value){
  if(!value||typeof value!=='object')return {};
  const result={};
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
  function createCard(id){
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
 function mount({defs,cols,rows,validSize,getItem,getSettings,canSave,save,returnHome}){
  const catalog=document.getElementById('widgetCatalog'),editor=document.getElementById('widgetEditor'),tip=document.getElementById('widgetIntro');
  const status=document.getElementById('widgetStatus'),back=document.querySelector('#app-widgets header .back'),cards=new Map();
  const scroll=editor.closest('.scroll');
  let ticket=0,stepBack=null;
  function refresh(){
   for(const [id,{badge,action}] of cards){
    const item=getItem(id);badge.textContent=item?`${sizeLabel(item)} · 第 ${item.page+1} 页`:'未添加';
    action.textContent=item?'编辑':'选尺寸';action.disabled=!canSave(id);
    action.setAttribute('aria-label',`${item?'编辑':'选择尺寸并添加'}${defs.find(d=>d.id===id).name}小组件`);
   }
  }
  function showList(focusId){
   ticket++;stepBack=null;back.setAttribute('aria-label','返回桌面');
   editor.hidden=true;editor.replaceChildren();catalog.hidden=false;tip.hidden=false;status.textContent='';refresh();
   if(focusId)cards.get(focusId)?.action.focus();
  }
  function showStep(form,focus,onBack,backLabel){
   stepBack=onBack;back.setAttribute('aria-label',backLabel);
   status.textContent='';tip.hidden=true;catalog.hidden=true;
   editor.replaceChildren(form);editor.hidden=false;scroll.scrollTop=0;focus.focus();
  }
  back.addEventListener('click',e=>{
   if(!stepBack)return;
   e.stopImmediatePropagation();stepBack();
  },true);
  function open(id,direct=false){
   const def=defs.find(d=>d.id===id);if(!def||!canSave(id))return;
   const seq=++ticket,item=getItem(id),draft={...getSettings(id)};
   const {w,h}=item||def;
   let selected=validSize(w,h)?{w,h}:{w:1,h:1};
   const form=text('form','widget-form widget-content-form'),title=text('h2','',`${def.icon} ${def.name}`),top=text('div','widget-editor-top');
   title.tabIndex=-1;top.append(title,text('p','',def.description));form.append(top);
   const sizeArea=text('div','widget-content-size'),sizeSummary=text('strong'),sizeNote=text('p','widget-size-note','当前页放不下时，会找其他有空位的页面。');
   const changeSize=button('调整尺寸',()=>showSizes(true));
   sizeArea.append(sizeSummary,changeSize,sizeNote);form.append(sizeArea);
   const leaveLabel=direct?'返回桌面':'返回小组件列表';
   function leave(){showList(direct?null:id);if(direct)returnHome(id);}
   function showContent(focus=title){
    sizeSummary.textContent=`当前尺寸：${sizeLabel(selected)}（列 × 行）`;
    showStep(form,focus,leave,leaveLabel);
   }
   function showSizes(fromContent=false){
    const backToContent=()=>showContent(fromContent?changeSize:title);
    const sizeForm=createSizeForm(def,selected,{cols,rows,validSize},size=>{selected=size;},backToContent);
    showStep(sizeForm.form,sizeForm.title,backToContent,'返回编辑组件');
    sizeForm.revealSelected();
   }
   const labelField=(caption,input,parent=form)=>{const label=text('label','widget-form-field');label.append(text('span','',caption),input);parent.append(label);};
   const actions=text('div','widget-editor-actions'),submit=text('button','widget-primary',item?'保存修改':'添加到桌面');submit.type='submit';
   const cancel=button(leaveLabel,leave);
   const error=text('p','widget-form-error');error.setAttribute('role','status');
   const lookField=text('fieldset','widget-look'),kind=text('select'),custom=text('div','widget-look-custom');
   let readingPhoto=false,readingBackground=false;
   function updateSubmit(){submit.disabled=readingPhoto||(kind.value==='custom'&&readingBackground);}
   if(id==='memo'){
    const content=text('textarea');content.maxLength=500;content.rows=4;content.value=draft.text||'';content.placeholder='记一件想随时看到的小事…';
    content.addEventListener('input',()=>{draft.text=content.value;});labelField('便签内容（最多 500 字）',content);
   }else if(id==='photo'){
    const input=text('input'),photo=text('img','widget-photo-preview');photo.alt='照片预览';photo.src=draft.src||photoDefault;
    input.type='file';input.accept='image/*';let change=0;
const reset=button('使用默认小猫',()=>{change++;input.value='';delete draft.src;photo.src=photoDefault;readingPhoto=false;updateSubmit();error.textContent='';});
     input.addEventListener('change',async()=>{
      const file=input.files[0];if(!file)return;
      const turn=++change;readingPhoto=true;updateSubmit();error.textContent='正在读取照片…';
      try{const src=await importPhoto(file);if(seq!==ticket||turn!==change)return;draft.src=src;photo.src=src;error.textContent='';}
      catch(err){if(seq===ticket&&turn===change)error.textContent=`${err.message||'无法读取照片'} 原照片未更改。`;}
      finally{if(seq===ticket&&turn===change){readingPhoto=false;updateSubmit();input.value='';}}
     });
    labelField('选择设备里的照片（仅保存在本机）',input);form.append(photo,reset);
   }else if(id==='countdown'){
    const name=text('input'),date=text('input');name.type='text';name.maxLength=28;name.placeholder='例如：出发去旅行';name.value=draft.title||'';
    date.type='date';date.required=true;date.min='0001-01-01';date.max='9999-12-31';date.value=draft.date||'';
    name.addEventListener('input',()=>{draft.title=name.value;});date.addEventListener('input',()=>{draft.date=date.value;});labelField('事件名称',name);labelField('目标日期',date);
   }
   lookField.append(text('legend','','小组件外观'));
   for(const [value,label] of looks){const option=text('option','',label);option.value=value;kind.append(option);}
   kind.value=draft.look?.kind||'default';labelField('外观风格',kind,lookField);
   const preview=text('div','widget-style-preview'),previewLabel=text('small');
   preview.append(text('span','',def.name),previewLabel);
   const bgInput=text('input'),cssInput=text('textarea');
   const bgStatus=text('p','widget-size-note'),cssStatus=text('p','widget-form-error');
   bgStatus.setAttribute('role','status');cssStatus.setAttribute('role','status');
   cssStatus.id='widgetLookCSSStatus';cssInput.setAttribute('aria-describedby',cssStatus.id);
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
    const look=candidate();custom.hidden=look?.kind!=='custom';
    previewLabel.textContent=looks.get(kind.value);
    cssStatus.textContent='';cssInput.removeAttribute('aria-invalid');
    try{if(look?.css)parseLookCSS(look.css);}
    catch(err){cssStatus.textContent=err.message;cssInput.setAttribute('aria-invalid','true');delete look.css;}
    applyLook(preview,look);updateSubmit();
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
   lookField.append(custom,preview);updatePreview();
   actions.append(cancel,submit);form.append(lookField,error,actions);
   form.addEventListener('submit',e=>{
    e.preventDefault();if(seq!==ticket||submit.disabled||!form.isConnected)return;
    if(id==='countdown'&&!localDate(draft.date)){error.textContent='请输入有效的目标日期。';return;}
    const look=candidate();
    try{if(look?.css)parseLookCSS(look.css);}
    catch(err){cssStatus.textContent=err.message;cssInput.setAttribute('aria-invalid','true');cssInput.focus();return;}
    const problem=save(id,selected,clean(id,{...draft,look}));if(problem){error.textContent=problem;return;}
    showList();
   });
   if(item)showContent();else showSizes();
  }
  for(const def of defs){
   const card=text('article','widget-choice'),info=text('div','widget-choice-info'),label=text('h2','',def.name),badge=text('small','widget-choice-badge'),action=button('',()=>open(def.id));
   info.append(label,text('p','',def.description),badge);card.append(text('span','widget-choice-icon',def.icon),info,action);catalog.append(card);cards.set(def.id,{badge,action});
  }
  refresh();return {open,refresh,showList};
 }
  return {clean,createCard,applyLook,mount};
})();
