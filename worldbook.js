/* 雪落机 · 世界书
   全局世界书：所有角色聊天都会用到。局部世界书：只给绑定的角色用。
   条目两种触发：常驻（每次都带上）/ 关键词（最近的对话里出现关键词才带上）。
   可导入 docx / txt（按标题拆分或 AI 整理）、酒馆 JSON；可导出 JSON。数据：snowfall-worldbook-v1。 */
(function(){
const KEY='snowfall-worldbook-v1';
const $=id=>document.getElementById(id);
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
let db={books:[]};
try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&Array.isArray(v.books))db=v}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify(db));return true}catch{alert('世界书保存失败：浏览器存储空间不足。');return false}}
function roles(){try{return (window.comm&&window.comm.contacts||[]).map(c=>({id:c.id,name:c.name,avatar:c.avatar}))}catch{return[]}}
const roleName=id=>(roles().find(r=>r.id===id)||{}).name||'已删除的角色';
const splitKeys=s=>String(s||'').split(/[,，、;；\n]/).map(x=>x.trim()).filter(Boolean).slice(0,30);

/* ---------- 给 AI 用：拼出要注入的世界书文字 ---------- */
function inject(roleId,recentText,limit=8000){
  const books=db.books.filter(b=>b.enabled!==false&&(b.scope==='global'||(roleId&&(b.roles||[]).includes(roleId))));
  if(!books.length)return'';
  const recent=String(recentText||'').toLowerCase();const picked=[];
  books.forEach(b=>(b.entries||[]).forEach(e=>{if(e.enabled===false||!String(e.content||'').trim())return;
    const hit=e.mode==='always'||(e.keys||[]).some(k=>k&&recent.includes(k.toLowerCase()));
    if(hit)picked.push({b,e})}));
  if(!picked.length)return'';
  picked.sort((x,y)=>(x.b.scope==='global'?0:1)-(y.b.scope==='global'?0:1)||(x.e.order||0)-(y.e.order||0));
  let out='\n\n【世界书设定，请严格遵守，不要向用户复述】';
  for(const {e} of picked){const piece='\n· '+(e.title?e.title+'：':'')+String(e.content).trim();if(out.length+piece.length>limit)break;out+=piece}
  return out;
}

/* ---------- 界面 ---------- */
let view='list',tab='global',curBook=null,curEntry=null,draft=null;
function screen(){return $('app-worldbook')}
function build(){
  const sc=screen();if(!sc||sc.dataset.built)return;sc.dataset.built='1';
  sc.innerHTML=`<header><button class="back" id="wbBack" aria-label="返回">‹</button><b id="wbTitle">世界书</b><button class="header-action wb-plus" id="wbPlus" aria-label="新建">＋</button></header><div class="wb-body" id="wbBody"></div><div class="wb-menu" id="wbMenu" hidden></div><input type="file" id="wbFile" accept=".docx,.txt,.md,.json" hidden data-no-picker>`;
  $('wbBack').addEventListener('click',back);
  $('wbPlus').addEventListener('click',e=>{e.stopPropagation();if(view==='book'){editEntry(null);return}toggleMenu()});
  document.addEventListener('click',e=>{if(!e.target.closest('#wbMenu'))$('wbMenu').hidden=true});
  $('wbFile').addEventListener('change',onFile);
  document.querySelectorAll('[data-go="app-worldbook"]').forEach(b=>b.addEventListener('click',()=>{view='list';render()}));
  render();
}
function toggleMenu(){const m=$('wbMenu');m.hidden=!m.hidden;if(m.hidden)return;m.replaceChildren();
  [['📖　新建世界书',()=>newBook()],['📄　导入 docx / txt',()=>pick('.docx,.txt,.md')],['🍺　导入酒馆 JSON',()=>pick('.json')]].forEach(([t,f])=>{const b=el('button','',t);b.onclick=()=>{m.hidden=true;f()};m.append(b)})}
function pick(acc){const f=$('wbFile');f.accept=acc;f.value='';f.click()}
function back(){if(view==='entry'){view='book';render()}else if(view==='book'||view==='import'){view='list';curBook=null;draft=null;render()}else if(typeof go==='function')go('home')}
function title(t){$('wbTitle').textContent=t;$('wbPlus').hidden=!(view==='list'||view==='book')}
function render(){const body=$('wbBody');body.replaceChildren();body.scrollTop=0;
  if(view==='list')renderList(body);else if(view==='book')renderBook(body);else if(view==='entry')renderEntry(body);else if(view==='import')renderImport(body)}

function switchRow(on,onChange,label){const l=el('label','wb-switch');const i=el('input');i.type='checkbox';i.checked=on;i.onchange=()=>onChange(i.checked);i.onclick=e=>e.stopPropagation();l.onclick=e=>e.stopPropagation();l.append(i,el('i'));if(label)l.setAttribute('aria-label',label);return l}

function renderList(body){title('世界书');
  const tabs=el('div','wb-tabs');[['global','全局'],['local','局部']].forEach(([k,t])=>{const b=el('button',tab===k?'on':'',t);b.onclick=()=>{tab=k;render()};tabs.append(b)});body.append(tabs);
  body.append(el('p','wb-tip',tab==='global'?'全局世界书：和所有角色聊天时都会用到，适合写世界观、常识、规则。':'局部世界书：只在和绑定的角色聊天时用到，适合写某个角色的身世、关系、秘密。'));
  const books=db.books.filter(b=>b.scope===tab);
  if(!books.length){const e=el('div','wb-empty');e.append(el('p','','还没有'+(tab==='global'?'全局':'局部')+'世界书'));const b1=el('button','wb-btn','新建一本');b1.onclick=()=>newBook();const b2=el('button','wb-btn ghost','从 docx 导入');b2.onclick=()=>pick('.docx,.txt,.md');e.append(b1,b2);body.append(e);return}
  books.forEach(b=>{const card=el('div','wb-card');card.onclick=()=>{curBook=b;view='book';render()};
    const top=el('div','wb-card-top');top.append(el('b','',b.name),switchRow(b.enabled!==false,v=>{b.enabled=v;save()},'启用'));card.append(top);
    const n=(b.entries||[]).length,on=(b.entries||[]).filter(e=>e.enabled!==false).length;
    card.append(el('small','',n+' 个条目'+(n!==on?' · '+on+' 个启用':'')));
    if(b.scope==='local'){const chips=el('div','wb-chips');(b.roles||[]).forEach(r=>chips.append(el('span','wb-chip',roleName(r))));if(!(b.roles||[]).length)chips.append(el('span','wb-chip warn','还没绑定角色'));card.append(chips)}
    body.append(card)});
}
function newBook(scope){const name=prompt('世界书名字','新的世界书');if(!name||!name.trim())return;const b={id:uid(),name:name.trim().slice(0,40),scope:scope||tab,roles:[],enabled:true,entries:[]};db.books.push(b);save();curBook=b;view='book';render();if(b.scope==='local')setTimeout(()=>bindRoles(),50)}

function renderBook(body){const b=curBook;if(!b){view='list';return render()}title(b.name);
  const bar=el('div','wb-bookbar');
  const scopeBtn=el('button','wb-pill',b.scope==='global'?'全局':'局部');scopeBtn.onclick=()=>{b.scope=b.scope==='global'?'local':'global';tab=b.scope;save();render();if(b.scope==='local'&&!(b.roles||[]).length)bindRoles()};
  bar.append(scopeBtn);
  if(b.scope==='local'){const r=el('button','wb-pill',(b.roles||[]).length?'绑定：'+b.roles.map(roleName).join('、'):'＋ 绑定角色');r.onclick=bindRoles;bar.append(r)}
  const more=el('button','wb-pill','⋯ 更多');more.onclick=()=>bookMenu(b);bar.append(more);body.append(bar);
  const q=el('input','wb-search');q.placeholder='⌕ 搜索条目标题、关键词、内容';body.append(q);
  const list=el('div','wb-list');body.append(list);
  const draw=()=>{list.replaceChildren();const k=q.value.trim().toLowerCase();const es=(b.entries||[]).slice().sort((x,y)=>(x.order||0)-(y.order||0)).filter(e=>!k||(e.title+' '+(e.keys||[]).join(' ')+' '+e.content).toLowerCase().includes(k));
    if(!es.length){list.append(el('p','wb-tip',(b.entries||[]).length?'没有匹配的条目。':'还没有条目，点右上角 ＋ 添加，或从 docx 导入。'))}
    es.forEach(e=>{const row=el('div','wb-entry');row.onclick=()=>editEntry(e);
      const t=el('div','wb-entry-top');t.append(el('span','wb-badge '+(e.mode==='always'?'always':'key'),e.mode==='always'?'常驻':'关键词'),el('b','',e.title||'（无标题）'),switchRow(e.enabled!==false,v=>{e.enabled=v;save()},'启用条目'));row.append(t);
      if(e.mode!=='always')row.append(el('small','wb-keys',(e.keys||[]).length?'🔑 '+e.keys.join('、'):'⚠ 没有关键词，不会被触发'));
      row.append(el('p','',String(e.content||'').slice(0,80)));list.append(row)})};
  q.oninput=draw;draw();
}
function bookMenu(b){const m=$('wbMenu');m.replaceChildren();m.hidden=false;
  [['✎　重命名',()=>{const n=prompt('新名字',b.name);if(n&&n.trim()){b.name=n.trim().slice(0,40);save();render()}}],
   ['📄　往这本里导入 docx',()=>{draft={target:b.id};pick('.docx,.txt,.md')}],
   ['⇩　导出 JSON',()=>exportBook(b)],
   ['⧉　复制一本',()=>{const c=JSON.parse(JSON.stringify(b));c.id=uid();c.name=b.name+' 副本';c.entries.forEach(e=>e.id=uid());db.books.push(c);save();curBook=c;render()}],
   ['🗑　删除这本世界书',()=>{if(!confirm('删除「'+b.name+'」和它的 '+(b.entries||[]).length+' 个条目？'))return;db.books=db.books.filter(x=>x!==b);save();curBook=null;view='list';render()}]
  ].forEach(([t,f])=>{const x=el('button','',t);x.onclick=e=>{e.stopPropagation();m.hidden=true;f()};m.append(x)})}
function bindRoles(){const b=curBook;const rs=roles();const m=$('wbMenu');m.replaceChildren();m.hidden=false;
  m.append(el('small','','选择用这本世界书的角色'));
  if(!rs.length)m.append(el('p','','通讯里还没有角色。'));
  rs.forEach(r=>{const l=el('label','wb-check');const i=el('input');i.type='checkbox';i.checked=(b.roles||[]).includes(r.id);i.onchange=()=>{b.roles=b.roles||[];if(i.checked)b.roles.push(r.id);else b.roles=b.roles.filter(x=>x!==r.id);save()};l.append(i,document.createTextNode(' '+r.name));l.onclick=e=>e.stopPropagation();m.append(l)});
  const ok=el('button','wb-done','完成');ok.onclick=e=>{e.stopPropagation();m.hidden=true;render()};m.append(ok)}

function editEntry(e){curEntry=e||{id:null,title:'',mode:'keyword',keys:[],content:'',enabled:true,order:((curBook.entries||[]).length+1)*10};view='entry';render()}
function renderEntry(body){const e=curEntry;title(e.id?'编辑条目':'新条目');
  const f=el('form','api-form wb-form');
  f.innerHTML=`<label>标题<input name="title" maxlength="40" placeholder="例如：雪城、主角的过去"></label>
  <div class="wb-mode"><button type="button" data-m="keyword">关键词触发</button><button type="button" data-m="always">常驻</button></div>
  <p class="wb-tip" id="wbModeTip"></p>
  <label id="wbKeysL">关键词（用逗号或顿号隔开）<input name="keys" placeholder="雪城，北境，城主"></label>
  <label>内容<textarea name="content" rows="9" maxlength="6000" placeholder="写给 AI 看的设定，越具体越好"></textarea></label>
  <small class="wb-count" id="wbCount"></small>
  <label>排序（数字小的先放）<input name="order" type="number" step="1"></label>
  <label class="remember"><input type="checkbox" name="enabled"> 启用这个条目</label>
  <button type="submit">保存</button>${e.id?'<button type="button" class="secondary" id="wbDel">删除这个条目</button>':''}`;
  body.append(f);
  f.title.value=e.title||'';f.keys.value=(e.keys||[]).join('，');f.content.value=e.content||'';f.order.value=e.order||0;f.enabled.checked=e.enabled!==false;
  let mode=e.mode||'keyword';
  const paint=()=>{f.querySelectorAll('[data-m]').forEach(b=>b.classList.toggle('on',b.dataset.m===mode));$('wbKeysL').hidden=mode==='always';$('wbModeTip').textContent=mode==='always'?'常驻：每次聊天都会带上。太多常驻条目会占用额度，只放最重要的。':'关键词触发：最近几句对话里出现任意一个关键词时才带上，省额度。'};
  f.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;paint()});paint();
  const cnt=()=>{$('wbCount').textContent=f.content.value.length+' / 6000 字'};f.content.oninput=cnt;cnt();
  f.onsubmit=ev=>{ev.preventDefault();const content=f.content.value.trim();if(!content){alert('内容不能为空。');return}const keys=splitKeys(f.keys.value);if(mode==='keyword'&&!keys.length&&!confirm('没有填关键词，这个条目不会被触发。仍然保存吗？'))return;
    Object.assign(e,{title:f.title.value.trim().slice(0,40),mode,keys,content,order:Number(f.order.value)||0,enabled:f.enabled.checked});
    if(!e.id){e.id=uid();curBook.entries=curBook.entries||[];curBook.entries.push(e)}if(save()){view='book';render()}};
  const del=$('wbDel');if(del)del.onclick=()=>{if(!confirm('删除这个条目？'))return;curBook.entries=curBook.entries.filter(x=>x!==e);save();view='book';render()};
}

/* ---------- 导入 ---------- */
async function onFile(ev){const file=ev.target.files[0];ev.target.value='';if(!file)return;const target=draft&&draft.target;
  try{
    if(/\.json$/i.test(file.name)){importJson(JSON.parse(await file.text()),file.name);return}
    const r=await window.snowDocx.readAny(file);
    if(!r.text.trim())throw new Error('文件里没有读到文字。');
    draft={target,fileName:file.name.replace(/\.(docx|txt|md)$/i,''),paragraphs:r.paragraphs,text:r.text,entries:splitByHeadings(r.paragraphs),scope:tab,roles:[],how:'heading'};
    view='import';render();
  }catch(e){alert('导入失败：'+(e instanceof SyntaxError?'JSON 格式不对。':e.message));window.snowLog&&window.snowLog('世界书导入',e.message)}
}
function splitByHeadings(ps){
  let hasHead=ps.some(p=>p.level>0);
  // 没有标题样式时，把「短行 + 冒号结尾 / 【】 / 一、 1. 」当作标题
  const looksHead=p=>p.text.length<=24&&(/^[【\[].+[】\]]$/.test(p.text)||/^([一二三四五六七八九十]+[、.．]|\d+[、.．)]|#{1,6}\s)/.test(p.text)||/[:：]$/.test(p.text));
  const out=[];let cur=null;
  ps.forEach(p=>{if(!cur&&!(hasHead?p.level>0:looksHead(p))&&!(!hasHead&&p.text.match(/^([^:：]{1,16})[:：]\s*(.{8,})$/))){cur={title:'',content:[]};out.push(cur)}const head=hasHead?p.level>0:looksHead(p);
    if(head){cur={title:p.text.replace(/^#{1,6}\s*/,'').replace(/^[【\[]|[】\]]$/g,'').replace(/[:：]$/,'').trim().slice(0,40),content:[]};out.push(cur)}
    else{if(!cur){cur={title:'',content:[]};out.push(cur)}
      // 「名字：内容」同一行的，直接成为一个条目
      const m=!hasHead&&p.text.match(/^([^:：]{1,16})[:：]\s*(.{8,})$/);
      if(m){if(!cur.content.length&&cur.title==='')out.pop();out.push({title:m[1].trim(),content:[m[2].trim()]});cur=null}else cur.content.push(p.text)}});
  return out.filter(e=>e.content.length).map((e,i)=>{const content=e.content.join('\n').slice(0,6000);const t=e.title||content.slice(0,12);return {pick:true,title:t,mode:'keyword',keys:e.title?[e.title]:[],content,order:(i+1)*10}});
}
async function aiSplit(){
  const cfg=window.snowApi&&window.snowApi();if(!cfg||!cfg.enabled||!cfg.key){alert('先在「设置 → 文字 API」连接 AI 并保存。');return}
  const st=$('wbImpStatus');st.textContent='AI 正在整理，长文档可能要一两分钟…';
  const text=draft.text.slice(0,40000);
  const sys='你是世界书整理助手。把用户给的设定文档拆成适合角色扮演 AI 使用的世界书条目。只输出 JSON 数组，不要任何解释或代码块标记。每个元素：{"title":"条目名，10字内","mode":"always 或 keyword","keys":["触发关键词，2到6个，取文中会出现的人名地名专有名词"],"content":"该条目的设定内容，保留原文细节，可适当精简，不编造"}。世界观总述、核心规则用 always，其余人物地点物品事件用 keyword。';
  const endpoint=cfg.base.endsWith('/chat/completions')?cfg.base:cfg.base.replace(/\/+$/,'')+'/chat/completions';
  const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),5*60*1000);
  try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},body:JSON.stringify({model:cfg.model,messages:[{role:'system',content:sys},{role:'user',content:text}],stream:false}),signal:ctl.signal,credentials:'omit'});
    if(!r.ok)throw new Error('接口返回 HTTP '+r.status);
    const j=await r.json();let s=j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content||'';
    s=s.replace(/```(?:json)?/gi,'').replace(/```/g,'');const a=s.indexOf('['),b=s.lastIndexOf(']');if(a<0||b<a)throw new Error('AI 没有按格式返回，可以再试一次或用「按标题拆分」。');
    const arr=JSON.parse(s.slice(a,b+1));if(!Array.isArray(arr)||!arr.length)throw new Error('AI 没拆出条目。');
    draft.entries=arr.filter(x=>x&&x.content).map((x,i)=>({pick:true,title:String(x.title||'').slice(0,40),mode:x.mode==='always'?'always':'keyword',keys:(Array.isArray(x.keys)?x.keys:splitKeys(x.keys)).map(String).slice(0,30),content:String(x.content).slice(0,6000),order:(i+1)*10}));
    draft.how='ai';render();$('wbImpStatus').textContent='AI 拆出 '+draft.entries.length+' 个条目'+(draft.text.length>40000?'（文档太长，只整理了前 4 万字）':'')+'，检查一下再保存。';
  }catch(e){st.textContent='AI 整理失败：'+(e.name==='AbortError'?'超时了。':e instanceof TypeError?'网络或跨域错误。':e.message);window.snowLog&&window.snowLog('世界书 AI 整理',e.message)}
  finally{clearTimeout(t)}
}
function renderImport(body){const d=draft;title('导入预览');
  body.append(el('p','wb-tip','从「'+d.fileName+'」读到 '+d.text.length+' 字。选一种拆分方式，勾掉不要的条目，点进条目可以修改。'));
  const how=el('div','wb-mode');[['heading','按标题拆分（不耗额度）'],['ai','AI 智能整理']].forEach(([k,t])=>{const b=el('button',d.how===k?'on':'',t);b.type='button';b.onclick=()=>{if(k==='heading'){d.entries=splitByHeadings(d.paragraphs);d.how='heading';render()}else aiSplit()};how.append(b)});body.append(how);
  body.append(Object.assign(el('p','wb-tip'),{id:'wbImpStatus'}));
  const list=el('div','wb-list');
  if(!d.entries.length)list.append(el('p','wb-tip','没拆出条目。试试 AI 智能整理。'));
  d.entries.forEach((e,i)=>{const row=el('div','wb-entry'+(e.pick?'':' off'));
    const t=el('div','wb-entry-top');const cb=el('input');cb.type='checkbox';cb.checked=e.pick;cb.onclick=ev=>ev.stopPropagation();cb.onchange=()=>{e.pick=cb.checked;row.classList.toggle('off',!e.pick);cnt()};
    const badge=el('button','wb-badge '+(e.mode==='always'?'always':'key'),e.mode==='always'?'常驻':'关键词');badge.type='button';badge.onclick=ev=>{ev.stopPropagation();e.mode=e.mode==='always'?'keyword':'always';badge.textContent=e.mode==='always'?'常驻':'关键词';badge.className='wb-badge '+(e.mode==='always'?'always':'key')};
    t.append(cb,badge,el('b','',e.title||'（无标题）'));row.append(t);
    const keys=el('input','wb-inline');keys.value=(e.keys||[]).join('，');keys.placeholder='关键词';keys.onclick=ev=>ev.stopPropagation();keys.onchange=()=>{e.keys=splitKeys(keys.value)};row.append(keys);
    const p=el('p','',e.content.slice(0,120)+(e.content.length>120?'…':''));row.append(p);
    row.onclick=()=>{const v=prompt('修改标题',e.title);if(v!==null){e.title=v.trim().slice(0,40);render()}};
    list.append(row)});
  body.append(list);
  const box=el('div','api-form wb-form');
  if(d.target){const b=db.books.find(x=>x.id===d.target);box.append(el('p','wb-tip','条目会加到「'+(b?b.name:'')+'」里。'))}
  else{box.innerHTML=`<label>世界书名字<input id="wbImpName" maxlength="40"></label><div class="wb-mode" id="wbImpScope"><button type="button" data-s="global">全局</button><button type="button" data-s="local">局部（绑定角色）</button></div><div id="wbImpRoles" class="wb-roles"></div>`}
  const ok=el('button','','');ok.type='button';box.append(ok);body.append(box);
  const cnt=()=>{ok.textContent='保存 '+d.entries.filter(e=>e.pick).length+' 个条目'};cnt();
  if(!d.target){$('wbImpName').value=d.name||d.fileName;$('wbImpName').oninput=()=>d.name=$('wbImpName').value;
    const paint=()=>{box.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on',b.dataset.s===d.scope));const rb=$('wbImpRoles');rb.replaceChildren();if(d.scope==='local'){const rs=roles();if(!rs.length)rb.append(el('p','wb-tip','通讯里还没有角色，可以先存为局部，之后再绑定。'));rs.forEach(r=>{const l=el('label','wb-check');const i=el('input');i.type='checkbox';i.checked=d.roles.includes(r.id);i.onchange=()=>{d.roles=i.checked?[...d.roles,r.id]:d.roles.filter(x=>x!==r.id)};l.append(i,document.createTextNode(' '+r.name));rb.append(l)})}};
    box.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>{d.scope=b.dataset.s;paint()});paint()}
  ok.onclick=()=>{const picked=d.entries.filter(e=>e.pick).map(({pick,...e})=>({...e,id:uid(),enabled:true}));if(!picked.length){alert('至少勾选一个条目。');return}
    let b=d.target&&db.books.find(x=>x.id===d.target);
    if(b){const base=(b.entries||[]).reduce((m,e)=>Math.max(m,e.order||0),0);picked.forEach((e,i)=>e.order=base+(i+1)*10);b.entries=(b.entries||[]).concat(picked)}
    else{const name=($('wbImpName').value||d.fileName).trim().slice(0,40);b={id:uid(),name,scope:d.scope,roles:d.scope==='local'?d.roles:[],enabled:true,entries:picked};db.books.push(b)}
    if(save()){tab=b.scope;curBook=b;draft=null;view='book';render()}};
}
function importJson(j,fname){
  // 支持：酒馆世界书 {entries:{...}}、角色卡里的 character_book、本应用导出的格式
  let src=j&&j.app==='雪落机世界书'?j.book:j;
  if(src&&src.data&&src.data.character_book)src=src.data.character_book;
  const raw=src&&src.entries;const list=Array.isArray(raw)?raw:raw&&typeof raw==='object'?Object.values(raw):null;
  if(!list||!list.length)throw new Error('没有找到世界书条目（支持酒馆世界书、角色卡、雪落机导出的 JSON）。');
  const entries=list.map((e,i)=>({id:uid(),title:String(e.title||e.comment||e.name||'').slice(0,40),mode:(e.mode==='always'||e.constant)?'always':'keyword',keys:(e.keys||e.key||[]).map(String).filter(Boolean).slice(0,30),content:String(e.content||'').slice(0,6000),enabled:e.enabled!==false&&!e.disable,order:Number(e.order??e.insertion_order??(i+1)*10)||0})).filter(e=>e.content.trim());
  const b={id:uid(),name:String(src.name||j.name||fname.replace(/\.json$/i,'')).slice(0,40),scope:(src.scope==='local'||j.scope==='local')?'local':tab,roles:[],enabled:true,entries};
  db.books.push(b);save();tab=b.scope;curBook=b;view='book';render();alert('导入了 '+entries.length+' 个条目。'+(b.scope==='local'?'记得绑定角色。':''));
}
function exportBook(b){
  const st={name:b.name,entries:{}};(b.entries||[]).forEach((e,i)=>{st.entries[i]={uid:i,key:e.keys||[],keysecondary:[],comment:e.title,content:e.content,constant:e.mode==='always',selective:true,order:e.order||0,position:0,disable:e.enabled===false}});
  const out={...st,app:'雪落机世界书',scope:b.scope,book:{name:b.name,entries:b.entries}};
  const blob=new Blob([JSON.stringify(out,null,1)],{type:'application/json'});const a=el('a');a.href=URL.createObjectURL(blob);a.download=b.name+'.json';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},2000);
}
window.snowWorld={inject,books:()=>db.books};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();
