/* 第一版离线演示：所有角色文本均为预设，不调用模型。 */
const KEY='little-phone-demo-v1';
const initial=()=>({messages:[{mine:false,text:'今天路过一家旧书店，看到一本夹着车票的书。忽然很想跟你讲。',time:Date.now()}],posts:[{id:'daily',type:'日常',text:'傍晚路过旧书店，门口的风铃响了好久。买了杯热的，坐着看了一会儿人来人往。',likes:0,liked:false,comments:[]},{id:'story',type:'剧情事件',text:'在一本旧书里发现了一张没有目的地的车票，背面写着：「明天六点，来车站。」\n我有点好奇。你觉得我该去看看吗？',likes:0,liked:false,comments:[],choice:null}],notices:[{text:'阿遥发来一条消息',target:'chat',read:false},{text:'阿遥发布了一条日常动态',target:'feed',read:false},{text:'有一件与旧书店有关的事等你回应',target:'feed',read:false}]});
let state;
try {const saved=JSON.parse(localStorage.getItem(KEY));state=saved&&Array.isArray(saved.messages)&&Array.isArray(saved.posts)&&Array.isArray(saved.notices)?saved:initial()}catch{state=initial()}
const $=id=>document.getElementById(id);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('本地保存失败：',e);alert('浏览器没有成功保存数据；关闭页面后可能丢失。')}}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function go(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));if(id==='chat'){state.notices.filter(n=>n.target==='chat').forEach(n=>n.read=true);renderNotices();save();$('messages').scrollTop=$('messages').scrollHeight}if(id==='feed'){state.notices.filter(n=>n.target==='feed').forEach(n=>n.read=true);renderNotices();save()}}
document.querySelectorAll('[data-go]').forEach(b=>{b.addEventListener('click',()=>go(b.dataset.go));if(b.getAttribute('role')==='button')b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(b.dataset.go)}})});
function clock(){const now=new Date();const time=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('clock').textContent=time;$('bigClock').textContent=time;$('homeDate').textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}clock();setInterval(clock,30000);
function renderMessages(){const box=$('messages');box.replaceChildren();state.messages.forEach(m=>{const b=el('div','bubble'+(m.mine?' mine':''),m.text);b.append(el('small','',new Date(m.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})));box.append(b)});box.scrollTop=box.scrollHeight}
function message(text,mine){state.messages.push({text,mine,time:Date.now()});save();renderMessages()}
const API_CONFIG_KEY='little-phone-api-v1';
let apiConfig={enabled:false,base:'https://api.openai.com/v1',model:'',key:'',remember:false};
try{const c=JSON.parse(localStorage.getItem(API_CONFIG_KEY));if(c)apiConfig={...apiConfig,...c}}catch{}
let chatBusy=false;
function apiStatus(text){$('apiStatus').textContent=text;$('chatStatus').textContent=chatBusy?'正在回复…':apiConfig.enabled?'AI 接口已启用':'演示模式 · 尚未启用接口'}
$('apiBase').value=apiConfig.base;$('apiModel').value=apiConfig.model;$('apiKey').value=apiConfig.key;$('rememberKey').checked=apiConfig.remember;
apiStatus(apiConfig.enabled?'接口已启用；发送消息时才会请求，尚未验证连接。':'尚未启用接口。');
$('apiForm').addEventListener('submit',e=>{e.preventDefault();if(chatBusy){apiStatus('请等待当前回复结束后再更改接口。');return}try{
const base=$('apiBase').value.trim().replace(/\/+$/,'');const url=new URL(base);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('请使用 HTTPS 地址（本机地址可使用 HTTP）。');if(url.username||url.password||url.search||url.hash)throw new Error('地址不能包含账号、密码、查询参数或锚点。');
const model=$('apiModel').value.trim(),key=$('apiKey').value.trim(),remember=$('rememberKey').checked;if(!model||!key)throw new Error('请填写模型名称和 API Key。');
const next={enabled:true,base,model,key,remember};localStorage.setItem(API_CONFIG_KEY,JSON.stringify({...next,key:remember?key:''}));apiConfig=next;apiStatus('已启用。'+(remember?'密钥已明文保存在本机。':'密钥仅在本次页面有效，刷新后需要重新填写。')+' 尚未验证连接。');
}catch(err){apiStatus('未保存：'+err.message)}});
$('disableApi').addEventListener('click',()=>{if(chatBusy){apiStatus('请等待当前回复结束后再关闭接口。');return}try{localStorage.removeItem(API_CONFIG_KEY);apiConfig.enabled=false;apiConfig.key='';apiConfig.remember=false;$('apiKey').value='';$('rememberKey').checked=false;apiStatus('已关闭接口并忘记密钥，恢复演示模式。')}catch{apiStatus('无法清除本机配置，请检查浏览器存储权限。')}});
$('chatForm').addEventListener('submit',async e=>{
e.preventDefault();if(chatBusy)return;const input=$('chatInput');const text=input.value.trim();if(!text)return;
if(apiConfig.enabled&&!apiConfig.key){apiStatus('请重新填写密钥并保存后再聊天。');go('settings');return}
message(text,true);input.value='';
if(!apiConfig.enabled){message('【演示回复】我看到了你的消息。请在设置中连接 AI，启用真实回复。',false);return}
chatBusy=true;const button=$('chatForm').querySelector('button');button.disabled=true;input.disabled=true;apiStatus('正在请求 AI…');
const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);
try{
const endpoint=apiConfig.base.endsWith('/chat/completions')?apiConfig.base:apiConfig.base+'/chat/completions';
const history=state.messages.filter(m=>!m.text.startsWith('【演示回复】')).slice(-30).map(m=>({role:m.mine?'user':'assistant',content:m.text}));
const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiConfig.key},body:JSON.stringify({model:apiConfig.model,messages:[{role:'system',content:'你扮演虚构角色阿遥，温和自然地用中文聊天。你喜欢旧书店。不要声称自己能在网页关闭后行动、看到现实环境或主动推送消息。'},...history],stream:false}),signal:controller.signal,credentials:'omit',redirect:'error'});
if(!response.ok)throw new Error('接口返回 HTTP '+response.status+'。'+({401:'请检查密钥。',403:'请检查接口权限。',404:'请检查地址和模型名称。',429:'请求过多或额度不足。'}[response.status]||'请检查服务商状态。'));
const data=await response.json();const reply=data?.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())throw new Error('接口没有返回可显示的文字，请检查模型是否支持 Chat Completions。');
message(reply.trim(),false);apiStatus('AI 回复成功。');
}catch(err){const reason=err.name==='AbortError'?'请求超时（60 秒）。':err instanceof TypeError?'网络请求失败，可能是跨域限制、地址错误或网络不可用。':err.message;apiStatus('回复失败：'+reason);alert('AI 回复失败：'+reason+'\n你的消息已保留，未生成模拟回复。')}finally{clearTimeout(timer);chatBusy=false;button.disabled=false;input.disabled=false;apiStatus($('apiStatus').textContent)}
});
function renderPosts(){const box=$('posts');box.replaceChildren();state.posts.forEach(post=>{const card=el('article','card');const top=el('div','card-top');top.append(el('strong','','☁ 阿遥'),el('span','tag',post.type));card.append(top,el('p','',post.text));const like=el('button','action'+(post.liked?' selected':''),`♡ ${post.likes} 喜欢`);like.addEventListener('click',()=>{post.liked=!post.liked;post.likes+=post.liked?1:-1;save();renderPosts()});card.append(like);if(post.type==='剧情事件'){const yes=el('button','action'+(post.choice==='去看看'?' selected':''),'去看看');const no=el('button','action'+(post.choice==='先别去'?' selected':''),'先别去');[yes,no].forEach((btn,i)=>{btn.disabled=!!post.choice;btn.addEventListener('click',()=>{post.choice=i===0?'去看看':'先别去';state.notices.unshift({text:`你选择了「${post.choice}」；这段剧情待续（演示）`,target:'feed',read:false});save();renderPosts();renderNotices()});card.append(btn)});if(post.choice)card.append(el('div','comments',`你的选择：${post.choice} · 剧情待续`))}if(post.comments.length){const comments=el('div','comments');post.comments.forEach(c=>comments.append(el('div','',`你：${c}`)));card.append(comments)}const form=el('form','comment-form');const input=el('input');input.placeholder='写一条评论…';input.maxLength=500;input.required=true;const send=el('button','','评论');send.type='submit';form.append(input,send);form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim();if(!text)return;post.comments.push(text);save();renderPosts()});card.append(form);box.append(card)})}
function renderNotices(){const box=$('notices');box.replaceChildren();$('badge').style.display=state.notices.some(n=>!n.read)?'block':'none';state.notices.forEach(n=>{const item=el('div','notice-item'+(!n.read?' unread':''),n.text);item.tabIndex=0;item.setAttribute('role','button');const open=()=>{n.read=true;save();renderNotices();go(n.target)};item.addEventListener('click',open);item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});box.append(item)});if(!state.notices.length)box.append(el('p','','还没有通知'))}
$('reset').addEventListener('click',()=>{if(!confirm('确定清除本机演示数据吗？此操作不可撤销。'))return;state=initial();save();renderAll();go('home')});
function renderAll(){renderMessages();renderPosts();renderNotices()}renderAll();