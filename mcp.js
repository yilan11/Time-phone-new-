/* 雪落机 MCP：让聊天里的 AI 调用外部工具（天气、瑞幸等）。
   只在当前浏览器保存配置（snowfall-mcp-v1）。使用 Streamable HTTP 协议。 */
(function(){
const KEY='snowfall-mcp-v1';
const DEFAULT_PROXY='';
let cfg={servers:[],proxy:DEFAULT_PROXY};
try{const v=JSON.parse(localStorage.getItem(KEY));if(v&&Array.isArray(v.servers))cfg={...cfg,...v}}catch{}
const sessions={};      // id -> {sid, ready, tools}
function save(){try{localStorage.setItem(KEY,JSON.stringify(cfg))}catch{alert('MCP 设置保存失败：浏览器存储不足。')}}
const $=id=>document.getElementById(id);
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
const uid=()=>Math.random().toString(36).slice(2,8);
const RISKY=/create|cancel|order|pay|delete|remove|send|post|publish|submit|buy/i;

function target(s){
  if(s.proxy){const p=(cfg.proxy||'').trim().replace(/\/+$/,'');if(!p)throw new Error('「'+s.name+'」需要中转地址，请先在 MCP 设置里填写。');return p+'/mcp?target='+encodeURIComponent(s.url)}
  return s.url;
}
async function rpc(s,method,params,isNote){
  const st=sessions[s.id]||(sessions[s.id]={});
  const headers={'Content-Type':'application/json','Accept':'application/json, text/event-stream'};
  if(s.token)headers.Authorization='Bearer '+s.token;
  if(st.sid)headers['Mcp-Session-Id']=st.sid;
  if(st.ver)headers['MCP-Protocol-Version']=st.ver;
  const id=isNote?undefined:Date.now()+Math.floor(Math.random()*1000);
  const body={jsonrpc:'2.0',method};if(params)body.params=params;if(!isNote)body.id=id;
  const res=await fetch(target(s),{method:'POST',headers,body:JSON.stringify(body),credentials:'omit'});
  const sid=res.headers.get('Mcp-Session-Id');if(sid)st.sid=sid;
  if(isNote)return null;
  if(!res.ok){let t='';try{t=(await res.text()).slice(0,160)}catch{}
    if(res.status===401||res.status===403)throw new Error('没有权限（'+res.status+'），请检查 Key / Token 是否正确或过期。');
    throw new Error('HTTP '+res.status+' '+t)}
  const type=res.headers.get('content-type')||'';const text=await res.text();
  let msg=null;
  if(type.includes('event-stream')){for(const line of text.split(/\r?\n/)){if(!line.startsWith('data:'))continue;try{const j=JSON.parse(line.slice(5).trim());if(j.id===id||(j.result||j.error)){msg=j;if(j.id===id)break}}catch{}}}
  else{try{msg=JSON.parse(text)}catch{throw new Error('服务返回的不是 JSON。')}}
  if(!msg)throw new Error('服务没有返回结果。');
  if(msg.error)throw new Error(msg.error.message||'调用失败');
  return msg.result;
}
async function ensure(s){
  const st=sessions[s.id]||(sessions[s.id]={});
  if(st.ready)return st;
  const r=await rpc(s,'initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'xueluoji',version:'1.0'}});
  st.ver=r&&r.protocolVersion||'2025-03-26';
  try{await rpc(s,'notifications/initialized',null,true)}catch{}
  const list=await rpc(s,'tools/list',{});
  st.tools=(list&&list.tools)||[];st.ready=true;return st;
}
function reset(s){delete sessions[s.id]}
const fname=(s,t)=>(s.slug+'__'+t).replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,64);

async function collectTools(onStatus){
  const tools=[],map={};
  for(const s of cfg.servers.filter(x=>x.enabled)){
    try{const st=await ensure(s);for(const t of st.tools){const n=fname(s,t.name);map[n]={s,t};tools.push({type:'function',function:{name:n,description:('['+s.name+'] '+(t.description||t.name)).slice(0,1000),parameters:t.inputSchema&&t.inputSchema.type?t.inputSchema:{type:'object',properties:{}}}})}}
    catch(e){onStatus&&onStatus('「'+s.name+'」连接失败：'+e.message);reset(s)}
  }
  return {tools,map};
}
async function callTool(entry,args){
  const {s,t}=entry;
  if(RISKY.test(t.name)&&!confirm('「'+s.name+'」想执行：'+t.name+'\n\n'+JSON.stringify(args,null,1).slice(0,600)+'\n\n这可能会下单、扣款或改动真实数据。确定执行吗？'))return '用户拒绝执行该操作。';
  let r;
  try{await ensure(s);r=await rpc(s,'tools/call',{name:t.name,arguments:args||{}})}
  catch(e){reset(s);try{await ensure(s);r=await rpc(s,'tools/call',{name:t.name,arguments:args||{}})}catch(e2){return '工具调用失败：'+e2.message}}
  const parts=(r&&r.content||[]).map(c=>c.type==='text'?c.text:'['+c.type+']');
  const out=(parts.join('\n')||JSON.stringify(r&&r.structuredContent||r||{}));
  return (r&&r.isError?'工具报错：':'')+out.slice(0,6000);
}

/* 带工具的对话：最多 6 轮工具调用；模型不支持工具时自动退回普通对话。 */
async function chat({endpoint,key,model,messages,signal,onStatus}){
  const {tools,map}=await collectTools(onStatus);
  const post=async(body)=>{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+key},body:JSON.stringify(body),signal,credentials:'omit',redirect:'error'});return r};
  const msgs=messages.slice();
  if(tools.length)msgs[0]={...msgs[0],content:msgs[0].content+'\n你可以调用工具获取真实信息（例如天气、地点、门店、菜单）。需要时先调用工具，再用角色口吻回答。下单、取消订单等会产生真实后果的操作，必须先把商品、门店和价格告诉用户并得到明确同意后才能调用。'};
  for(let round=0;round<7;round++){
    const body={model,messages:msgs,stream:false};if(tools.length&&round<6)body.tools=tools;
    let res=await post(body);
    if(!res.ok&&body.tools&&res.status===400){onStatus&&onStatus('这个模型不支持工具调用，已改为普通回复。');delete body.tools;res=await post(body)}
    if(!res.ok)throw Object.assign(new Error('接口返回 HTTP '+res.status+'。'),{status:res.status});
    const data=await res.json();const m=data&&data.choices&&data.choices[0]&&data.choices[0].message;
    if(!m)throw new Error('接口没有返回消息。');
    const calls=m.tool_calls||[];
    if(!calls.length||!body.tools){const t=m.content;if(typeof t!=='string'||!t.trim())throw new Error('接口没有返回可显示的文字。');return t}
    msgs.push({role:'assistant',content:m.content||'',tool_calls:calls});
    for(const c of calls){
      const entry=map[c.function&&c.function.name];let args={};try{args=JSON.parse(c.function.arguments||'{}')}catch{}
      onStatus&&onStatus(entry?'正在使用「'+entry.s.name+'」：'+entry.t.name+'…':'未知工具');
      const out=entry?await callTool(entry,args):'没有这个工具。';
      msgs.push({role:'tool',tool_call_id:c.id,content:out});
    }
  }
  throw new Error('工具调用次数过多，已停止。');
}

/* ---------- 设置界面 ---------- */
const PRESETS={
  amap:{name:'高德地图（天气·地点）',slug:'amap',note:'在 lbs.amap.com 控制台创建应用，添加「Web服务」类型的 Key，粘贴到下面。',ask:'高德 Web服务 Key',build:k=>({url:'https://mcp.amap.com/mcp?key='+encodeURIComponent(k),token:'',proxy:false})},
  luckin:{name:'瑞幸咖啡',slug:'luckin',note:'打开 open.lkcoffee.com/mcp 登录，复制 Token（约一个月有效）。瑞幸不允许网页直连，需要中转地址。',ask:'瑞幸 Token',build:k=>({url:'https://gwmcp.lkcoffee.com/order/user/mcp',token:k.replace(/^Bearer\s+/i,''),proxy:true})}
};
function status(t){const n=$('mcpStatus');if(n)n.textContent=t}
function render(){
  const box=$('mcpList');if(!box)return;box.replaceChildren();
  if(!cfg.servers.length)box.append(el('p','hint','还没有添加工具。'));
  cfg.servers.forEach(s=>{
    const row=el('div','mcp-row');
    const top=el('div','mcp-row-top');const name=el('b','',s.name);
    const sw=el('label','mcp-switch');const cb=el('input');cb.type='checkbox';cb.checked=!!s.enabled;cb.addEventListener('change',()=>{s.enabled=cb.checked;save();status(s.name+(s.enabled?' 已启用':' 已停用'))});sw.append(cb,document.createTextNode('启用'));
    top.append(name,sw);
    const info=el('small','',(s.proxy?'经中转 · ':'')+s.url.replace(/key=[^&]+/,'key=••••'));
    const acts=el('div','mcp-acts');
    const test=el('button','secondary','测试');test.type='button';
    test.addEventListener('click',async()=>{status('正在连接「'+s.name+'」…');reset(s);try{const st=await ensure(s);status('「'+s.name+'」连接成功，有 '+st.tools.length+' 个工具：'+st.tools.map(t=>t.name).slice(0,12).join('、'))}catch(e){status('「'+s.name+'」连接失败：'+(e instanceof TypeError?'网络或跨域被拦（瑞幸要填中转地址）。':e.message))}});
    const del=el('button','secondary','删除');del.type='button';del.addEventListener('click',()=>{if(!confirm('删除「'+s.name+'」？'))return;cfg.servers=cfg.servers.filter(x=>x!==s);reset(s);save();render()});
    acts.append(test,del);row.append(top,info,acts);box.append(row);
  });
  $('mcpProxy').value=cfg.proxy||'';
}
function addPreset(k){
  const p=PRESETS[k];const v=prompt(p.note+'\n\n'+p.ask+'：');if(!v||!v.trim())return;
  const s={id:uid(),name:p.name,slug:p.slug,enabled:true,...p.build(v.trim())};
  cfg.servers=cfg.servers.filter(x=>x.slug!==p.slug);cfg.servers.push(s);save();render();status('已添加「'+p.name+'」，点「测试」检查连接。');
}
function mount(){
  const anchor=$('apiStatus');if(!anchor||$('mcpBox'))return;
  const box=el('div','mcp-box');box.id='mcpBox';
  box.innerHTML='<h2>MCP 工具</h2><p class="hint">让聊天里的角色查天气、找门店、点瑞幸。需要模型支持工具调用（function calling）。配置只存在本机。</p>'+
  '<div class="mcp-quick"><button type="button" id="mcpAddAmap">＋ 高德天气</button><button type="button" id="mcpAddLuckin">＋ 瑞幸咖啡</button></div>'+
  '<div id="mcpList"></div>'+
  '<form id="mcpForm" class="api-form"><details><summary>添加其他 MCP 服务</summary>'+
  '<label>名称<input id="mcpName" maxlength="30" required></label><label>地址（Streamable HTTP）<input id="mcpUrl" type="url" required placeholder="https://..."></label>'+
  '<label>Token（可选）<input id="mcpToken" type="password" autocomplete="off"></label><label class="remember"><input id="mcpUseProxy" type="checkbox">通过中转（服务不允许网页直连时勾选）</label><button type="submit">添加</button></details></form>'+
  '<form id="mcpProxyForm" class="api-form"><label>中转地址（瑞幸等需要）<input id="mcpProxy" type="url" placeholder="https://你的中转服务"></label><button type="submit" class="secondary">保存中转地址</button></form>'+
  '<p id="mcpStatus" class="hint" role="status" aria-live="polite"></p>';
  anchor.after(box);
  $('mcpAddAmap').addEventListener('click',()=>addPreset('amap'));
  $('mcpAddLuckin').addEventListener('click',()=>addPreset('luckin'));
  $('mcpForm').addEventListener('submit',e=>{e.preventDefault();try{const u=new URL($('mcpUrl').value.trim());if(u.protocol!=='https:')throw new Error('请用 https 地址');const name=$('mcpName').value.trim();cfg.servers.push({id:uid(),name,slug:'m'+uid(),enabled:true,url:u.href,token:$('mcpToken').value.trim(),proxy:$('mcpUseProxy').checked});save();e.target.reset();render();status('已添加「'+name+'」。')}catch(err){status('没添加：'+err.message)}});
  $('mcpProxyForm').addEventListener('submit',e=>{e.preventDefault();const v=$('mcpProxy').value.trim().replace(/\/+$/,'');if(v){try{if(new URL(v).protocol!=='https:')throw 0}catch{status('中转地址要以 https:// 开头。');return}}cfg.proxy=v;save();Object.keys(sessions).forEach(k=>delete sessions[k]);status(v?'中转地址已保存。':'已清空中转地址。')});
  render();
}
window.snowMcp={active:()=>cfg.servers.some(s=>s.enabled),chat,config:()=>cfg};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
