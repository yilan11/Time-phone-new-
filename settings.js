/* 雪落机 · 设置 App（按用户手绘稿）：
   设备（头像/姓名/QQ号） · API（文字/图像/语音） · 数据（备份导入与导出） · 其他（报错日志、MCP 工具）。
   文字 API 沿用 app.js 的 #apiForm 与 little-phone-api-v1，聊天、相遇照常使用。 */
(function(){
/* ---------- 报错日志：尽早开始记录 ---------- */
const LOG_KEY='snowfall-errorlog-v1';
function readLog(){try{return JSON.parse(localStorage.getItem(LOG_KEY))||[]}catch{return[]}}
function addLog(kind,text){try{const list=readLog();list.push({t:Date.now(),kind,text:String(text).slice(0,800)});localStorage.setItem(LOG_KEY,JSON.stringify(list.slice(-200)))}catch{}}
window.snowLog=addLog;
window.addEventListener('error',e=>{if(e.message)addLog('错误',e.message+(e.filename?' @ '+e.filename.split('/').pop()+':'+e.lineno:''))});
window.addEventListener('unhandledrejection',e=>addLog('异步错误',e.reason&&e.reason.message||e.reason));
const cErr=console.error.bind(console);console.error=(...a)=>{addLog('控制台',a.map(x=>x&&x.message||String(x)).join(' '));cErr(...a)};
const cWarn=console.warn.bind(console);console.warn=(...a)=>{addLog('警告',a.map(x=>x&&x.message||String(x)).join(' '));cWarn(...a)};
const oAlert=window.alert.bind(window);window.alert=m=>{if(/失败|错误|无法|超时/.test(String(m)))addLog('提示',m);return oAlert(m)};

/* ---------- 供应商 ---------- */
const PROVIDERS={
 text:[['OpenAI','https://api.openai.com/v1'],['DeepSeek','https://api.deepseek.com/v1'],['硅基流动','https://api.siliconflow.cn/v1'],['阿里云百炼','https://dashscope.aliyuncs.com/compatible-mode/v1'],['智谱 GLM','https://open.bigmodel.cn/api/paas/v4'],['月之暗面 Kimi','https://api.moonshot.cn/v1'],['Google Gemini','https://generativelanguage.googleapis.com/v1beta/openai'],['OpenRouter','https://openrouter.ai/api/v1'],['自定义','']],
 image:[['OpenAI','https://api.openai.com/v1'],['硅基流动','https://api.siliconflow.cn/v1'],['智谱 GLM','https://open.bigmodel.cn/api/paas/v4'],['自定义','']],
 voice:[['OpenAI','https://api.openai.com/v1'],['硅基流动','https://api.siliconflow.cn/v1'],['自定义','']]
};
const KIND_NAME={text:'文字 API',image:'图像 API',voice:'语音 API'};
const CFG_KEY={image:'snowfall-image-api-v1',voice:'snowfall-voice-api-v1'};
const PRESET_KEY='snowfall-api-presets-v1',PROVIDER_KEY='snowfall-text-provider-v1';
const $=id=>document.getElementById(id);
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
const jget=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch{return d}};
const jset=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{alert('保存失败：浏览器存储空间不足。');return false}};
const clean=u=>u.trim().replace(/\/+$/,'').replace(/\/chat\/completions$/,'');
function checkUrl(u){const url=new URL(u);if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('请用 https:// 开头的地址。');return u}
async function req(base,key,path,opt={},ms=30000){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms);
 try{const r=await fetch(clean(base)+path,{...opt,headers:{'Authorization':'Bearer '+key,...(opt.body?{'Content-Type':'application/json'}:{})},signal:c.signal,credentials:'omit'});
  if(!r.ok){let m='';try{const j=await r.json();m=j.error&&(j.error.message||j.error)||j.message||''}catch{}throw new Error('HTTP '+r.status+({401:' 密钥不对或已过期',403:' 没有权限',404:' 地址或模型不对',429:' 请求太多或额度不足'}[r.status]||'')+(m?'：'+String(m).slice(0,120):''))}
  return await r.json()}
 catch(e){throw new Error(e.name==='AbortError'?'超时，没有回应。':e instanceof TypeError?'连不上：地址不对、网络不通，或服务商不允许网页直连。':e.message)}
 finally{clearTimeout(t)}
}
async function listModels(base,key){const j=await req(base,key,'/models');const ids=(j.data||j.models||[]).map(m=>m.id||m.name).filter(Boolean).map(s=>s.replace(/^models\//,''));if(!ids.length)throw new Error('服务商没有返回模型列表，请手动填写。');return ids.sort()}

/* ---------- 页面骨架 ---------- */
const ICON={profile:'',text:'✎',image:'▣',voice:'♪',data:'⇅',log:'!',mcp:'⚙'};
function row(id,title,sub,icon){return `<button type="button" class="set-row" data-view="${id}"><span class="set-ico">${icon}</span><span class="set-txt"><b>${title}</b>${sub?`<small id="sub-${id}">${sub}</small>`:''}</span><i>›</i></button>`}
function apiForm(kind){return `<form class="api-form set-api" id="f-${kind}" novalidate>
<label>URL<input name="base" type="url" placeholder="https://.../v1" autocomplete="off"></label>
<label>供应商<select name="provider"></select></label>
<label>key<input name="key" type="password" autocomplete="off" placeholder="服务商给的密钥"></label>
<label>模型<span class="set-model"><input name="model" autocomplete="off" placeholder="填写或拉取"><button type="button" class="set-pull">拉取模型</button></span></label>
<div class="set-models" hidden></div>
${kind==='voice'?'<label>音色（可选）<input name="voice" autocomplete="off" placeholder="例如 alloy"></label>':''}
<button type="submit" class="set-save">保存</button>
<div class="set-two"><button type="button" class="secondary set-preset">设为预设</button><button type="button" class="secondary set-test">测试连接</button></div>
<div class="set-presets"></div>
<p class="hint set-status" role="status" aria-live="polite"></p>
${kind!=='text'?'<button type="button" class="secondary set-off">清除这个接口</button><p class="hint">'+(kind==='image'?'图像 API 用于以后的生图功能，目前先保存配置。':'语音 API 用于以后的朗读功能，目前先保存配置。')+'</p>':''}
</form>`}

function build(){
 const screen=$('settings');if(!screen||screen.dataset.built)return;screen.dataset.built='1';
 const old=screen.querySelector('.settings-body');const header=screen.querySelector('header');
 const title=header.querySelector('b');
 const wrap=el('div','set-wrap');
 wrap.innerHTML=`
<section class="set-view scroll" data-v="main">
 <h3>设备</h3>
 <button type="button" class="set-card" data-view="profile"><span class="set-avatar" id="setAvatar"></span><span class="set-txt"><b id="setName"></b><small id="setQQ"></small></span><i>›</i></button>
 <h3>API</h3><div class="set-group">${row('text','文字 API','','✎')}${row('image','图像 API','','▣')}${row('voice','语音 API','','♪')}</div>
 <h3>数据</h3><div class="set-group">${row('data','备份导入与导出','','⇅')}</div>
 <h3>其他</h3><div class="set-group">${row('log','报错日志','','!')}${row('mcp','MCP 工具','让角色查天气、点瑞幸','⚙')}</div>
 <p class="hint set-ver">雪落机 1.0</p>
</section>
<section class="set-view scroll" data-v="profile" hidden>
 <form class="api-form" id="setProfileForm">
  <div class="set-avatar big" id="setAvatarBig"></div>
  <label>头像<input id="setAvatarFile" type="file" accept="image/*"></label>
  <button type="button" class="secondary" id="setAvatarClear">不用图片头像</button>
  <label>姓名<input id="setNameInput" maxlength="20" required></label>
  <label>QQ号<input id="setQQInput" maxlength="20" inputmode="numeric" placeholder="展示用，不会连接真实 QQ"></label>
  <button type="submit" class="set-save">保存</button>
  <p class="hint" id="setProfileStatus" role="status"></p>
 </form>
</section>
<section class="set-view scroll" data-v="text" hidden><div id="setTextHost"></div></section>
<section class="set-view scroll" data-v="image" hidden>${apiForm('image')}</section>
<section class="set-view scroll" data-v="voice" hidden>${apiForm('voice')}</section>
<section class="set-view scroll" data-v="data" hidden>
 <div class="api-form">
  <p class="hint">备份会把这台手机上雪落机的全部内容（角色、聊天、相遇、主题、小组件、钱包、音乐、MCP 设置等）存成一个文件。换手机、换网址前先导出。</p>
  <label class="remember"><input type="checkbox" id="setIncKeys">备份里包含 API Key / Token（文件请勿发给别人）</label>
  <button type="button" class="set-save" id="setExport">导出备份文件</button>
  <label>导入备份<input type="file" id="setImport" accept=".json,application/json"></label>
  <p class="hint" id="setDataStatus" role="status"></p>
  <div id="setOldReset"></div>
 </div>
</section>
<section class="set-view scroll" data-v="log" hidden>
 <div class="set-two"><button type="button" class="secondary" id="setLogCopy">复制全部</button><button type="button" class="secondary" id="setLogClear">清空日志</button></div>
 <p class="hint" id="setLogStatus"></p><div id="setLogList" class="set-log"></div>
</section>
<section class="set-view scroll" data-v="mcp" hidden><div id="setMcpHost"></div></section>`;
 old.after(wrap);old.hidden=true;old.classList.add('set-old');
 // 文字 API：搬入原表单，加上供应商、拉取模型、预设、测试
 const form=$('apiForm');const host=$('setTextHost');host.append(form);
 const st=$('apiStatus');
 form.classList.add('set-api');
 form.querySelectorAll('label').forEach(l=>{const t=l.firstChild;if(t&&t.nodeType===3){if(t.textContent.includes('接口基础地址'))t.textContent='URL';if(t.textContent.includes('API Key'))t.textContent='key';if(t.textContent.includes('模型名称'))t.textContent='模型'}});
 const baseL=$('apiBase').closest('label');const pv=el('label','','供应商');const sel=el('select');sel.id='apiProvider';pv.append(sel);baseL.after(pv);
 const keyL=$('apiKey').closest('label'),modelL=$('apiModel').closest('label');keyL.after(modelL);
 const mWrap=el('span','set-model');$('apiModel').before(mWrap);mWrap.append($('apiModel'));const pull=el('button','set-pull','拉取模型');pull.type='button';mWrap.append(pull);
 const models=el('div','set-models');models.hidden=true;modelL.after(models);
 const submit=form.querySelector('button[type=submit]');submit.textContent='保存';submit.classList.add('set-save');
 const remember=form.querySelector('.remember');submit.before(remember);
 const off=$('disableApi');off.classList.add('secondary');off.textContent='关闭接口并忘记密钥';
 const two=el('div','set-two');const bp=el('button','secondary set-preset','设为预设'),bt=el('button','secondary set-test','测试连接');bp.type=bt.type='button';two.append(bp,bt);submit.after(two);
 const presets=el('div','set-presets');two.after(presets);two.after(st);presets.after(off);
 const hint=old.querySelector('.hint');if(hint){const h=el('p','hint','用 OpenAI 兼容接口，URL 填到 /v1。聊天和相遇都用这里的设置。消息会发给服务商，可能产生费用；服务商必须允许网页直连。');off.after(h)}
 // 旧的清除按钮放到数据页
 const reset=$('reset');if(reset){const rh=old.querySelector('#reset+.hint');$('setOldReset').append(el('h3','','清除'),reset);if(rh)$('setOldReset').append(rh)}
 // MCP
 const mcp=$('mcpBox');if(mcp){$('setMcpHost').append(mcp);const h2=mcp.querySelector('h2');if(h2)h2.remove()}

 /* 导航 */
 let view='main';
 const backBtn=header.querySelector('.back');
 function show(v){view=v;wrap.querySelectorAll('.set-view').forEach(s=>s.hidden=s.dataset.v!==v);title.textContent=v==='main'?'设置':v==='profile'?'个人资料':v==='data'?'备份导入与导出':v==='log'?'报错日志':v==='mcp'?'MCP 工具':KIND_NAME[v];
  if(v==='main')renderMain();if(v==='log')renderLog();if(v==='profile')fillProfile();if(v==='text')renderPresets('text');
  const sec=wrap.querySelector(`[data-v="${v}"]`);if(sec)sec.scrollTop=0}
 wrap.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b)show(b.dataset.view)});
 backBtn.addEventListener('click',e=>{if(view!=='main'){e.preventDefault();e.stopImmediatePropagation();show('main')}},true);
 document.querySelectorAll('[data-go="settings"]').forEach(b=>b.addEventListener('click',()=>show('main')));

 /* 主页摘要 */
 function apiSummary(kind){if(kind==='text'){const c=jget('little-phone-api-v1',null);return c&&c.enabled?((jget(PROVIDER_KEY,'')||'已启用')+' · '+(c.model||'')):'未连接'}const c=jget(CFG_KEY[kind],null);return c&&c.base?((c.provider||'已保存')+(c.model?' · '+c.model:'')):'未设置'}
 function renderMain(){['text','image','voice'].forEach(k=>{const b=wrap.querySelector(`[data-view="${k}"] .set-txt`);let s=b.querySelector('small');if(!s){s=el('small');b.append(s)}s.textContent=apiSummary(k)});
  const n=readLog().length;const lb=wrap.querySelector('[data-view="log"] .set-txt');let s=lb.querySelector('small');if(!s){s=el('small');lb.append(s)}s.textContent=n?n+' 条记录':'没有记录';
  const p=profile();$('setName').textContent=p.name||'我';$('setQQ').textContent='QQ号：'+(p.account&&p.account!=='local-user'?p.account:'未填写');paintAvatar($('setAvatar'),p)}

 /* ---------- 个人资料（与通讯「我」同步） ---------- */
 function profile(){try{return comm.profile}catch{return {name:'我',account:''}}}
 function paintAvatar(node,p){node.replaceChildren();if(p.avatar&&/^data:image\//.test(p.avatar)){const i=el('img');i.src=p.avatar;i.alt='头像';node.append(i)}else node.textContent=(p.name||'我').slice(0,1)}
 let pendingAvatar;
 function fillProfile(){const p=profile();pendingAvatar=p.avatar||'';$('setNameInput').value=p.name||'';$('setQQInput').value=p.account&&p.account!=='local-user'?p.account:'';paintAvatar($('setAvatarBig'),{...p,avatar:pendingAvatar});$('setProfileStatus').textContent=''}
 $('setAvatarFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const img=new Image();const url=URL.createObjectURL(f);img.onload=()=>{const s=Math.min(1,256/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext('2d').drawImage(img,0,0,c.width,c.height);pendingAvatar=c.toDataURL('image/jpeg',.85);URL.revokeObjectURL(url);paintAvatar($('setAvatarBig'),{name:$('setNameInput').value,avatar:pendingAvatar});$('setProfileStatus').textContent='头像已选好，点「保存」生效。'};img.onerror=()=>{$('setProfileStatus').textContent='这张图片读不出来，换一张试试。'};img.src=url;e.target.value=''});
 $('setAvatarClear').addEventListener('click',()=>{pendingAvatar='';paintAvatar($('setAvatarBig'),{name:$('setNameInput').value});$('setProfileStatus').textContent='已改回文字头像，点「保存」生效。'});
 $('setProfileForm').addEventListener('submit',e=>{e.preventDefault();const name=$('setNameInput').value.trim();if(!name){$('setProfileStatus').textContent='姓名不能为空。';return}
  const qq=$('setQQInput').value.trim();if(qq&&!/^\d{5,12}$/.test(qq)){$('setProfileStatus').textContent='QQ号是 5 到 12 位数字。';return}
  try{comm.profile.name=name;comm.profile.account=qq||'local-user';if(pendingAvatar)comm.profile.avatar=pendingAvatar;else delete comm.profile.avatar;commPersist();if(typeof renderComm==='function')renderComm();$('setProfileStatus').textContent='已保存。';renderMain()}catch(err){$('setProfileStatus').textContent='保存失败：'+err.message}});

 /* ---------- API 表单 ---------- */
 function fillProviders(select,kind,current){select.replaceChildren();PROVIDERS[kind].forEach(([n,u])=>{const o=el('option','',n);o.value=n;o.dataset.url=u;select.append(o)});select.value=current&&PROVIDERS[kind].some(p=>p[0]===current)?current:guess(kind,null)}
 function guess(kind,base){const b=base||'';const hit=PROVIDERS[kind].find(([n,u])=>u&&b.startsWith(u));return hit?hit[0]:'自定义'}
 function hookProvider(select,baseInput,kind){select.addEventListener('change',()=>{const u=select.selectedOptions[0].dataset.url;if(u)baseInput.value=u;if(!u)baseInput.focus()});baseInput.addEventListener('change',()=>{select.value=guess(kind,baseInput.value)})}
 function modelPicker(box,input,ids){box.replaceChildren();box.hidden=false;const head=el('div','set-models-head');head.append(el('small','','共 '+ids.length+' 个，点一下选用'));const f=el('input');f.placeholder='搜索模型';head.append(f);box.append(head);const list=el('div','set-models-list');box.append(list);
  const draw=()=>{list.replaceChildren();ids.filter(i=>i.toLowerCase().includes(f.value.toLowerCase())).slice(0,200).forEach(id=>{const b=el('button','',id);b.type='button';b.onclick=()=>{input.value=id;box.hidden=true};list.append(b)})};f.oninput=draw;draw()}
 // 文字
 const tBase=$('apiBase'),tKey=$('apiKey'),tModel=$('apiModel');
 fillProviders(sel,'text',jget(PROVIDER_KEY,'')||guess('text',tBase.value));hookProvider(sel,tBase,'text');
 form.addEventListener('submit',()=>jset(PROVIDER_KEY,sel.value),true);
 pull.addEventListener('click',async()=>{const base=tBase.value,key=tKey.value.trim();if(!base||!key){st.textContent='先填 URL 和 key。';return}st.textContent='正在拉取模型…';pull.disabled=true;try{const ids=await listModels(base,key);modelPicker(models,tModel,ids);st.textContent='拉取到 '+ids.length+' 个模型。'}catch(e){st.textContent='拉取失败：'+e.message;addLog('文字 API',e.message)}finally{pull.disabled=false}});
 bt.addEventListener('click',async()=>{const base=tBase.value,key=tKey.value.trim(),model=tModel.value.trim();if(!base||!key||!model){st.textContent='URL、key、模型都要填。';return}st.textContent='正在测试…';bt.disabled=true;const t0=Date.now();
  try{checkUrl(clean(base));const j=await req(base,key,'/chat/completions',{method:'POST',body:JSON.stringify({model,messages:[{role:'user',content:'只回复：好'}],max_tokens:16,stream:false})},60000);const r=j.choices&&j.choices[0]&&j.choices[0].message;st.textContent=r?'连接成功（'+((Date.now()-t0)/1000).toFixed(1)+' 秒）。还没保存的话记得点「保存」。':'连上了，但返回格式不对，请检查模型。'}
  catch(e){st.textContent='测试失败：'+e.message;addLog('文字 API',e.message)}finally{bt.disabled=false}});
 bp.addEventListener('click',()=>savePreset('text',{provider:sel.value,base:clean(tBase.value),key:tKey.value.trim(),model:tModel.value.trim()},st));
 // 图像、语音
 ['image','voice'].forEach(kind=>{
  const f=$('f-'+kind),s=f.querySelector('.set-status'),c=jget(CFG_KEY[kind],{});
  f.base.value=c.base||'';f.key.value=c.key||'';f.model.value=c.model||'';if(f.voice)f.voice.value=c.voice||'';
  fillProviders(f.provider,kind,c.provider||guess(kind,c.base));hookProvider(f.provider,f.base,kind);
  const box=f.querySelector('.set-models');
  f.querySelector('.set-pull').addEventListener('click',async e=>{if(!f.base.value||!f.key.value){s.textContent='先填 URL 和 key。';return}s.textContent='正在拉取模型…';e.target.disabled=true;try{const ids=await listModels(f.base.value,f.key.value.trim());modelPicker(box,f.model,ids);s.textContent='拉取到 '+ids.length+' 个模型。'}catch(err){s.textContent='拉取失败：'+err.message;addLog(KIND_NAME[kind],err.message)}finally{e.target.disabled=false}});
  f.addEventListener('submit',e=>{e.preventDefault();try{const base=clean(f.base.value);if(!base)throw new Error('请填写 URL。');checkUrl(base);if(!f.key.value.trim())throw new Error('请填写 key。');
   if(jset(CFG_KEY[kind],{provider:f.provider.value,base,key:f.key.value.trim(),model:f.model.value.trim(),voice:f.voice?f.voice.value.trim():undefined}))s.textContent='已保存在本机。'}catch(err){s.textContent='没保存：'+err.message}});
  f.querySelector('.set-test').addEventListener('click',async e=>{if(!f.base.value||!f.key.value){s.textContent='先填 URL 和 key。';return}s.textContent='正在测试…';e.target.disabled=true;
   try{checkUrl(clean(f.base.value));const ids=await listModels(f.base.value,f.key.value.trim());const m=f.model.value.trim();s.textContent='连接成功，密钥可用'+(m?(ids.includes(m)?'，模型「'+m+'」存在。':'，但列表里没找到模型「'+m+'」，请检查。'):'。')+'（没有真的生成'+(kind==='image'?'图片':'语音')+'，不扣费）'}
   catch(err){s.textContent='测试失败：'+err.message;addLog(KIND_NAME[kind],err.message)}finally{e.target.disabled=false}});
  f.querySelector('.set-preset').addEventListener('click',()=>savePreset(kind,{provider:f.provider.value,base:clean(f.base.value),key:f.key.value.trim(),model:f.model.value.trim(),voice:f.voice?f.voice.value.trim():undefined},s));
  f.querySelector('.set-off').addEventListener('click',()=>{if(!confirm('清除'+KIND_NAME[kind]+'的设置？'))return;localStorage.removeItem(CFG_KEY[kind]);f.reset();fillProviders(f.provider,kind,'');s.textContent='已清除。'});
  renderPresets(kind);
 });
 /* 预设 */
 function savePreset(kind,p,s){if(!p.base||!p.model){s.textContent='URL 和模型填好后才能设为预设。';return}const name=prompt('给这个预设起个名字',(p.provider||'')+' '+p.model);if(!name||!name.trim())return;const all=jget(PRESET_KEY,{});const list=(all[kind]||[]).filter(x=>x.name!==name.trim());list.push({...p,name:name.trim().slice(0,30)});all[kind]=list.slice(-20);if(jset(PRESET_KEY,all)){s.textContent='已存为预设「'+name.trim()+'」。';renderPresets(kind)}}
 function renderPresets(kind){const f=kind==='text'?form:$('f-'+kind);const box=f.querySelector('.set-presets');box.replaceChildren();const list=(jget(PRESET_KEY,{})[kind])||[];if(!list.length)return;box.append(el('small','','我的预设（点名字套用，再点「保存」）'));
  list.forEach(p=>{const r=el('div','set-chip');const b=el('button','',p.name);b.type='button';b.onclick=()=>{if(kind==='text'){tBase.value=p.base;tKey.value=p.key||'';tModel.value=p.model;sel.value=p.provider||guess('text',p.base);st.textContent='已套用「'+p.name+'」，点「保存」生效。'}else{f.base.value=p.base;f.key.value=p.key||'';f.model.value=p.model;if(f.voice)f.voice.value=p.voice||'';f.provider.value=p.provider||guess(kind,p.base);f.querySelector('.set-status').textContent='已套用「'+p.name+'」，点「保存」生效。'}};
   const x=el('button','set-chip-x','×');x.type='button';x.setAttribute('aria-label','删除预设');x.onclick=()=>{if(!confirm('删除预设「'+p.name+'」？'))return;const all=jget(PRESET_KEY,{});all[kind]=(all[kind]||[]).filter(y=>y.name!==p.name);jset(PRESET_KEY,all);renderPresets(kind)};r.append(b,x);box.append(r)})}

 /* ---------- 备份 ---------- */
 const OURS=/^(little-phone|snowfall|snow-|calendar|gomoku|tarot|wallet|music|profiles|notes)/i;
 const SECRET=/api-v1$|mcp-v1$|presets-v1$/;
 function strip(k,v){try{const o=JSON.parse(v);if(k==='little-phone-api-v1'){o.key='';o.remember=false}if(/image-api|voice-api/.test(k))o.key='';if(k===PRESET_KEY)Object.values(o).forEach(l=>l.forEach(p=>p.key=''));if(/mcp-v1$/.test(k))(o.servers||[]).forEach(s=>{s.token='';s.url=s.url.replace(/key=[^&]+/,'key=')});if(/music-v1$/.test(k)&&o.cookie)o.cookie='';return JSON.stringify(o)}catch{return v}}
 $('setExport').addEventListener('click',()=>{const inc=$('setIncKeys').checked;const data={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!OURS.test(k)||k===LOG_KEY)continue;let v=localStorage.getItem(k);if(!inc&&(SECRET.test(k)||/music-v1$/.test(k)))v=strip(k,v);data[k]=v}
  const out={app:'雪落机',version:1,exportedAt:new Date().toISOString(),includesKeys:inc,data};const blob=new Blob([JSON.stringify(out)],{type:'application/json'});const a=el('a');a.href=URL.createObjectURL(blob);const d=new Date();a.download='雪落机备份-'+d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0')+'.json';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
  $('setDataStatus').textContent='已导出 '+Object.keys(data).length+' 项，大小约 '+Math.ceil(blob.size/1024)+' KB。文件在手机的「下载」里。'+(inc?'里面有密钥，别发给别人。':'')});
 $('setImport').addEventListener('change',async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;try{const j=JSON.parse(await f.text());if(!j||j.app!=='雪落机'||!j.data||typeof j.data!=='object')throw new Error('这不是雪落机的备份文件。');
  const keys=Object.keys(j.data).filter(k=>OURS.test(k)&&typeof j.data[k]==='string');if(!keys.length)throw new Error('备份里没有内容。');
  if(!confirm('导入会用备份覆盖这台手机上的 '+keys.length+' 项内容（导出时间 '+(j.exportedAt||'未知').slice(0,10)+'）。确定吗？'))return;
  keys.forEach(k=>{let v=j.data[k];if(!j.includesKeys&&SECRET.test(k)){const cur=localStorage.getItem(k);if(cur){try{const o=JSON.parse(v),c=JSON.parse(cur);if(k==='little-phone-api-v1'&&c.key){o.key=c.key;o.remember=c.remember}v=JSON.stringify(o)}catch{}}}localStorage.setItem(k,v)});
  alert('导入完成，马上刷新。');location.reload()}catch(err){$('setDataStatus').textContent='导入失败：'+(err instanceof SyntaxError?'文件已损坏或不是 JSON。':err.message);addLog('导入',err.message)}});

 /* ---------- 报错日志 ---------- */
 function renderLog(){const box=$('setLogList');box.replaceChildren();const list=readLog().slice().reverse();$('setLogStatus').textContent=list.length?'共 '+list.length+' 条，最新的在上面。最多保留 200 条。':'还没有报错记录。';
  list.forEach(x=>{const d=el('div','set-log-item');d.append(el('small','',new Date(x.t).toLocaleString('zh-CN',{hour12:false})+' · '+x.kind),el('div','',x.text));box.append(d)})}
 $('setLogCopy').addEventListener('click',async()=>{const txt=readLog().map(x=>new Date(x.t).toLocaleString('zh-CN',{hour12:false})+' ['+x.kind+'] '+x.text).join('\n')||'（空）';try{await navigator.clipboard.writeText(txt);$('setLogStatus').textContent='已复制，可以直接粘贴发给我。'}catch{prompt('长按全选复制：',txt)}});
 $('setLogClear').addEventListener('click',()=>{if(!confirm('清空全部报错日志？'))return;localStorage.removeItem(LOG_KEY);renderLog()});

 // 原 apiStatus 失败也记一笔
 new MutationObserver(()=>{const t=st.textContent;if(/失败|未保存/.test(t))addLog('文字 API',t)}).observe(st,{childList:true,characterData:true,subtree:true});
 show('main');
}
if(document.readyState==='complete')build();else window.addEventListener('load',build);
})();
