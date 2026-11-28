/* 聊天保留旧版数据；美化与相遇各自保存。 */
const KEY='little-phone-demo-v1';
const initial=()=>({messages:[{mine:false,text:'今天路过一家旧书店，看到一本夹着车票的书。忽然很想跟你讲。',time:Date.now()}],posts:[{id:'daily',type:'日常',text:'傍晚路过旧书店，门口的风铃响了好久。买了杯热的，坐着看了一会儿人来人往。',likes:0,liked:false,comments:[]},{id:'story',type:'剧情事件',text:'在一本旧书里发现了一张没有目的地的车票，背面写着：「明天六点，来车站。」\n我有点好奇。你觉得我该去看看吗？',likes:0,liked:false,comments:[],choice:null}],notices:[{text:'阿遥发来一条消息',target:'chat',read:false},{text:'阿遥发布了一条日常动态',target:'feed',read:false},{text:'有一件与旧书店有关的事等你回应',target:'feed',read:false}]});
let state;
try {const saved=JSON.parse(localStorage.getItem(KEY));state=saved&&Array.isArray(saved.messages)&&Array.isArray(saved.posts)&&Array.isArray(saved.notices)?saved:initial()}catch{state=initial()}
const $=id=>document.getElementById(id);
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){console.warn('本地保存失败：',e);alert('浏览器没有成功保存数据；关闭页面后可能丢失。')}}
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node}
function go(id){document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id));if(id==='chat'){state.notices.filter(n=>n.target==='chat').forEach(n=>n.read=true);renderNotices();save();$('messages').scrollTop=$('messages').scrollHeight}if(id==='encounter'){$('storyScroll').scrollTop=$('storyScroll').scrollHeight}if(id==='feed'){state.notices.filter(n=>n.target==='feed').forEach(n=>n.read=true);renderNotices();save()}}
document.querySelectorAll('[data-go]').forEach(b=>{b.addEventListener('click',()=>go(b.dataset.go));if(b.getAttribute('role')==='button')b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go(b.dataset.go)}})});
function clock(){const now=new Date();const time=now.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});$('clock').textContent=time;$('bigClock').textContent=time;$('homeDate').textContent=now.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}clock();setInterval(clock,30000);
function renderMessages(){const box=$('messages');box.replaceChildren();state.messages.forEach(m=>{const b=el('div','bubble'+(m.mine?' mine':''),m.text);b.append(el('small','',new Date(m.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})));box.append(b)});box.scrollTop=box.scrollHeight}
function message(text,mine){state.messages.push({text,mine,time:Date.now()});save();if(window.commPersist)window.commPersist();renderMessages()}
const API_CONFIG_KEY='little-phone-api-v1';
let apiConfig={enabled:false,base:'https://api.openai.com/v1',model:'',key:'',remember:false};
try{const c=JSON.parse(localStorage.getItem(API_CONFIG_KEY));if(c)apiConfig={...apiConfig,...c}}catch{}
let chatBusy=false;
function apiStatus(text){$('apiStatus').textContent=text;$('chatStatus').textContent=chatBusy?'正在回复…':apiConfig.enabled?'AI 接口已启用':'演示模式 · 尚未启用接口'}
$('apiBase').value=apiConfig.base;$('apiModel').value=apiConfig.model;$('apiKey').value=apiConfig.key;$('rememberKey').checked=apiConfig.remember;
apiStatus(apiConfig.enabled?'接口已启用；发送消息时才会请求，尚未验证连接。':'尚未启用接口。');
$('apiForm').addEventListener('submit',e=>{e.preventDefault();if(chatBusy||storyBusy){apiStatus('请等待当前回复结束后再更改接口。');return}try{
const base=$('apiBase').value.trim().replace(/\/+$/,'');const url=new URL(base);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('请使用 HTTPS 地址（本机地址可使用 HTTP）。');if(url.username||url.password||url.search||url.hash)throw new Error('地址不能包含账号、密码、查询参数或锚点。');
const model=$('apiModel').value.trim(),key=$('apiKey').value.trim(),remember=$('rememberKey').checked;if(!model||!key)throw new Error('请填写模型名称和 API Key。');
const next={enabled:true,base,model,key,remember};localStorage.setItem(API_CONFIG_KEY,JSON.stringify({...next,key:remember?key:''}));apiConfig=next;apiStatus('已启用。'+(remember?'密钥已明文保存在本机。':'密钥仅在本次页面有效，刷新后需要重新填写。')+' 尚未验证连接。');
}catch(err){apiStatus('未保存：'+err.message)}});
$('disableApi').addEventListener('click',()=>{if(chatBusy||storyBusy){apiStatus('请等待当前回复结束后再关闭接口。');return}try{localStorage.removeItem(API_CONFIG_KEY);apiConfig.enabled=false;apiConfig.key='';apiConfig.remember=false;$('apiKey').value='';$('rememberKey').checked=false;apiStatus('已关闭接口并忘记密钥，恢复演示模式。')}catch{apiStatus('无法清除本机配置，请检查浏览器存储权限。')}});
$('chatForm').addEventListener('submit',async e=>{
e.preventDefault();if(chatBusy)return;const input=$('chatInput');const text=input.value.trim();if(!text)return;
if(apiConfig.enabled&&!apiConfig.key){apiStatus('请重新填写密钥并保存后再聊天。');go('settings');return}
message(text,true);input.value='';
if(!apiConfig.enabled){message('【演示回复】我看到了你的消息。请在设置中连接 AI，启用真实回复。',false);return}
chatBusy=true;const button=$('chatForm').querySelector('button');button.disabled=true;input.disabled=true;apiStatus('正在请求 AI…');
const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),window.snowMcp&&window.snowMcp.active()?150000:60000);
try{
const endpoint=apiConfig.base.endsWith('/chat/completions')?apiConfig.base:apiConfig.base+'/chat/completions';
const history=state.messages.filter(m=>!m.text.startsWith('【演示回复】')).slice(-30).map(m=>({role:m.mine?'user':'assistant',content:m.text}));
let systemPrompt='你在虚构小手机中扮演角色。'+(comm.contacts.find(c=>c.id===activeContact)?.persona||'温和自然的阿遥')+'。不要声称能在网页关闭后行动、看到现实环境或主动推送消息。';
if(activeContact==='kk')systemPrompt+=`
用户问到雪落机美化时，按以下实际输入限制给出可手动复制的内容。未指定目标且无法判断时，问清是桌面、App 图标还是哪一种小组件。标注粘贴位置和保存步骤；不同输入框的片段分开。你只能给建议，不能声称自动修改或保存项目，也不能声称已发布或已替用户应用。
桌面：主题 → 桌面美化 → 全局主题 CSS → 配色与文字，最多 1600 字符，仅允许 --ice-text、--ice-muted、--ice-50、--ice-100、--ice-200、--ice-300、--ice-glass、--ice-border、--ice-dock、--theme-accent，值必须是颜色，不用渐变。标题（30 字）、小字（60 字）、纯色背景和统一图标底色属于独立控件。填好后点「保存桌面美化」。
App：在主题 → App 美化选中 App，仅改桌面图标，不改 App 内部页面。图标形态选「自定义代码」后填写「形态 CSS」，最多 1000 字符，仅允许 border-radius、clip-path；「图标内部 CSS」单独填写，最多 1600 字符，仅允许 color、background、background-color、background-image、border、border-color、border-style、box-shadow，背景可用纯色或渐变。页面专属的完整 CSS 文件不能粘贴到这些框。填好后点「保存当前 App 图标」。
普通小组件：打开组件编辑器，在「自定义风格 → 自定义 CSS」填写，最多 4000 字符，仅允许 background、background-color、background-image、background-size、background-position、background-repeat、color、border、border-color、border-width、border-style、border-radius、box-shadow、text-shadow、font-size、font-weight、font-family、letter-spacing、backdrop-filter、-webkit-backdrop-filter。需要图片时用上传控件，最后在编辑器保存。
大字组件不用 CSS：「大字内容」最多 120 字，只填文字；「文字颜色」用颜色控件（给 #RRGGBB 值）；「背景模式」选透明、纯色或图片，纯色填「背景颜色」，图片由用户上传，最后在编辑器保存。
用于粘贴的 CSS 只给“属性: 值;”，不要添加选择器、:root、大括号、引号、HTML、脚本、url()、var() 或外部链接。使用可识别的 CSS 值，比如六位十六进制色值；说明文字写在代码片段之外。`;
let reply;
if(window.snowMcp&&window.snowMcp.active()){
try{reply=await window.snowMcp.chat({endpoint,key:apiConfig.key,model:apiConfig.model,messages:[{role:'system',content:systemPrompt},...history],signal:controller.signal,onStatus:t=>{$('apiStatus').textContent=t;$('chatStatus').textContent=t}})}
catch(err){if(err.status)throw new Error(err.message+({401:'请检查密钥。',403:'请检查接口权限。',404:'请检查地址和模型名称。',429:'请求过多或额度不足。'}[err.status]||''));throw err}
message(reply.trim(),false);apiStatus('AI 回复成功。');
}else{
const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiConfig.key},body:JSON.stringify({model:apiConfig.model,messages:[{role:'system',content:systemPrompt},...history],stream:false}),signal:controller.signal,credentials:'omit',redirect:'error'});
if(!response.ok)throw new Error('接口返回 HTTP '+response.status+'。'+({401:'请检查密钥。',403:'请检查接口权限。',404:'请检查地址和模型名称。',429:'请求过多或额度不足。'}[response.status]||'请检查服务商状态。'));
const data=await response.json();const reply=data?.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())throw new Error('接口没有返回可显示的文字，请检查模型是否支持 Chat Completions。');
message(reply.trim(),false);apiStatus('AI 回复成功。');
}
}catch(err){const reason=err.name==='AbortError'?'请求超时（60 秒）。':err instanceof TypeError?'网络请求失败，可能是跨域限制、地址错误或网络不可用。':err.message;apiStatus('回复失败：'+reason);alert('AI 回复失败：'+reason+'\n你的消息已保留，未生成模拟回复。')}finally{clearTimeout(timer);chatBusy=false;button.disabled=false;input.disabled=false;apiStatus($('apiStatus').textContent)}
});
function renderPosts(){const box=$('posts');box.replaceChildren();state.posts.forEach(post=>{const card=el('article','card');const top=el('div','card-top');top.append(el('strong','','☁ 阿遥'),el('span','tag',post.type));card.append(top,el('p','',post.text));const like=el('button','action'+(post.liked?' selected':''),`♡ ${post.likes} 喜欢`);like.addEventListener('click',()=>{post.liked=!post.liked;post.likes+=post.liked?1:-1;save();renderPosts()});card.append(like);if(post.type==='剧情事件'){const yes=el('button','action'+(post.choice==='去看看'?' selected':''),'去看看');const no=el('button','action'+(post.choice==='先别去'?' selected':''),'先别去');[yes,no].forEach((btn,i)=>{btn.disabled=!!post.choice;btn.addEventListener('click',()=>{post.choice=i===0?'去看看':'先别去';state.notices.unshift({text:`你选择了「${post.choice}」；这段剧情待续（演示）`,target:'feed',read:false});save();renderPosts();renderNotices()});card.append(btn)});if(post.choice)card.append(el('div','comments',`你的选择：${post.choice} · 剧情待续`))}if(post.comments.length){const comments=el('div','comments');post.comments.forEach(c=>comments.append(el('div','',`你：${c}`)));card.append(comments)}const form=el('form','comment-form');const input=el('input');input.placeholder='写一条评论…';input.maxLength=500;input.required=true;const send=el('button','','评论');send.type='submit';form.append(input,send);form.addEventListener('submit',e=>{e.preventDefault();const text=input.value.trim();if(!text)return;post.comments.push(text);save();renderPosts()});card.append(form);box.append(card)})}
function renderNotices(){const box=$('notices');box.replaceChildren();$('badge').style.display=state.notices.some(n=>!n.read)?'block':'none';state.notices.forEach(n=>{const item=el('div','notice-item'+(!n.read?' unread':''),n.text);item.tabIndex=0;item.setAttribute('role','button');const open=()=>{n.read=true;save();renderNotices();go(n.target)};item.addEventListener('click',open);item.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});box.append(item)});if(!state.notices.length)box.append(el('p','','还没有通知'))}
$('reset').addEventListener('click',()=>{if(chatBusy){alert('请等当前回复结束后再清除。');return}if(!confirm('确定清除本机演示数据吗？此操作不可撤销。'))return;state=initial();save();if(window.commPersist)window.commPersist();renderAll();go('home')});
function renderAll(){renderMessages();renderPosts();renderNotices()}renderAll();
function persist(key,value,statusId){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{$(statusId).textContent='保存失败：浏览器存储空间不足或不允许保存，请先保留重要内容。';return false}}

// 相遇拥有独立的剧情设定与历史，使用设置页同一接口。
const STORY_KEY='little-phone-encounter-v1';
const storyDefault=()=>({config:{title:'旧书店的来信',persona:'阿遥，旧书店的年轻店主。温和、细心，说话自然，似乎知道车票的来历。',world:'初秋的傍晚，一座临海小城。旧书店里藏着一张没有目的地的车票，车站的钟停在六点。故事基调温柔、神秘，围绕探索与相遇展开。',opening:'风铃轻轻一响，你推开旧书店的门。\n\n柜台后的阿遥抬起头，将一本旧书推到你面前。一张泛黄的车票从书页间滑落。\n\n「你终于来了。」他停了一下，像是怕惊动某个秘密，「要听听这张车票的故事吗？」'},messages:[],demoStep:0});
let story=storyDefault(),storyBusy=false;
try{const v=JSON.parse(localStorage.getItem(STORY_KEY));if(v&&v.config&&['title','persona','world','opening'].every(k=>typeof v.config[k]==='string')&&Array.isArray(v.messages))story=v}catch{}
if(!story.messages.length)story.messages=[{mine:false,text:story.config.opening,time:Date.now()}];
function storySave(){return persist(STORY_KEY,story,'storyStatus')}
function storyMode(){return apiConfig.enabled?'AI 剧情 · 与聊天共用接口':'预设试玩 · 自定义行动仅记录，AI 模式可自由续写'}
function renderStory(){
 $('storyTitle').textContent=story.config.title;$('storyMode').textContent=storyMode();
 const box=$('storyMessages');box.replaceChildren();
 story.messages.forEach(m=>{const node=el('article','story-entry'+(m.mine?' mine':''));node.append(el('small','',m.mine?'你的行动':'故事 · '+(m.demo?'预设试玩':'叙事')),el('div','',m.text));box.append(node)});
 const choices=$('storyChoices');choices.replaceChildren();
 if(!apiConfig.enabled){['询问车票的来历','仔细观察四周'].forEach((text,i)=>{const btn=el('button','',text);btn.type='button';btn.disabled=storyBusy;btn.addEventListener('click',()=>advanceStory(text,i));choices.append(btn)})}
 $('storyScroll').scrollTop=$('storyScroll').scrollHeight;
}
function fillStoryConfig(){ $('storyTitleInput').value=story.config.title;$('storyPersona').value=story.config.persona;$('storyWorld').value=story.config.world;$('storyOpening').value=story.config.opening; }
$('storyToggle').addEventListener('click',()=>{const hidden=!$('storySettings').hidden;$('storySettings').hidden=hidden;$('storyToggle').setAttribute('aria-expanded',String(!hidden));if(hidden)renderStory()});
$('storyConfigForm').addEventListener('submit',e=>{e.preventDefault();if(storyBusy){$('storyStatus').textContent='请等当前剧情回复结束。';return}const config={title:$('storyTitleInput').value.trim(),persona:$('storyPersona').value.trim(),world:$('storyWorld').value.trim(),opening:$('storyOpening').value.trim()};if(Object.values(config).some(x=>!x)){alert('请完整填写剧本设定。');return}story.config=config;const ok=storySave();renderStory();if(ok)alert('设定已保存。角色与世界背景用于后续 AI 续写，开场白在重新开始时生效。')});
$('storyRestart').addEventListener('click',()=>{if(storyBusy)return;if(!confirm('将清除当前剧情，按已保存的设定重新开始。确定吗？'))return;story.messages=[{mine:false,text:story.config.opening,time:Date.now()}];story.demoStep=0;if(storySave())$('storyStatus').textContent='已按保存的剧本重新开始。';$('storySettings').hidden=true;$('storyToggle').setAttribute('aria-expanded','false');renderStory()});
const demoScenes=[
 ['阿遥将车票翻到背面，指了指那行褪色的小字。\n\n「它不是去某个地方的票，」他说，「它会带人回到一件没来得及完成的事。」\n\n窗外，远处车站的钟忽然响了一声。','你扫过书架，发现所有旧书的书脊上都有同一个小小印记：一轮月亮。\n\n阿遥注意到你的视线，将柜台上的台灯转向一张旧合照。「照片里的车站，你见过吗？」'],
 ['「上一位拿到车票的人，留下了这封信。」阿遥从抽屉里取出信封，封口一直没有拆开。\n\n信上只有一句话：请陪我去车站。你愿意与他一起出门吗？','你走到窗前，玻璃映出一座陌生站台。回头看去，身后仍是安静的书店。\n\n阿遥拿起外套。「看来它已经选好时间了。」'],
 ['你们走出书店，沿着海边的石板路来到车站。停在六点的钟，第一次向前走了一格。\n\n阿遥把信交到你手中。「接下来的故事，由你决定。」\n\n【预设试玩结束】连接 AI 后，可根据你的行动继续写下去。','书架尽头传来纸张翻动的声音，一本空白的书自己翻开。第一页慢慢浮现出你刚才说过的话。\n\n【预设试玩结束】连接 AI 后，可根据你的行动继续写下去。']
];
async function advanceStory(text,choice){
 if(storyBusy||!text.trim())return;
 if(apiConfig.enabled&&!apiConfig.key){$('storyStatus').textContent='请在设置中重新填写密钥并保存。';go('settings');return}
 if(!apiConfig.enabled&&story.demoStep>=demoScenes.length){$('storyStatus').textContent='本段预设试玩已结束，请连接 AI，或在剧本中重新开始。';return}
 story.messages.push({mine:true,text:text.trim(),time:Date.now()});$('storyInput').value='';storySave();
 if(!apiConfig.enabled){const step=Number(story.demoStep)||0;const scene=demoScenes[step][choice===1?1:0];story.messages.push({mine:false,text:scene,demo:true,time:Date.now()});story.demoStep=step+1;const ok=storySave();renderStory();if(ok)$('storyStatus').textContent='预设试玩 '+story.demoStep+'/3 · 不是 AI 回复；自由输入仅记录，随后播放固定片段。';return}
 storyBusy=true;const button=$('storyForm').querySelector('button');button.disabled=true;$('storyInput').disabled=true;$('storyRestart').disabled=true;renderStory();$('storyMode').textContent='正在续写…';$('storyStatus').textContent='正在根据你的行动续写剧情…';
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
 const endpoint=apiConfig.base.endsWith('/chat/completions')?apiConfig.base:apiConfig.base+'/chat/completions';
 const system='你是中文互动小说的叙事者，扮演场景中的角色，与用户共同推进虚构剧情。角色设定：'+story.config.persona+'\n世界背景：'+story.config.world+'\n以细腻但简洁的叙事回应用户行动，每次约150至350字。不要替用户决定行动、台词和内心。保持角色与世界设定一致，结尾留出用户行动空间。历史中标为预设试玩的文本仅为体验素材。';
 const history=story.messages.slice(-40).map(m=>({role:m.mine?'user':'assistant',content:(m.demo?'【预设试玩】':'')+m.text}));
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+apiConfig.key},body:JSON.stringify({model:apiConfig.model,messages:[{role:'system',content:system},...history],stream:false}),signal:controller.signal,credentials:'omit',redirect:'error'});
 if(!response.ok)throw new Error('HTTP '+response.status+'。'+({401:'请检查密钥。',403:'请检查权限。',404:'请检查地址和模型。',429:'请求过多或额度不足。'}[response.status]||'请检查服务商状态。'));
 const data=await response.json(),reply=data?.choices?.[0]?.message?.content;if(typeof reply!=='string'||!reply.trim())throw new Error('接口没有返回文字。');
 story.messages.push({mine:false,text:reply.trim(),time:Date.now()});if(storySave())$('storyStatus').textContent='剧情已续写并保存在本机。';
 }catch(err){$('storyStatus').textContent='续写失败：'+(err.name==='AbortError'?'请求超时。':err instanceof TypeError?'网络或跨域错误，请检查设置。':err.message)+' 你的行动已保留，可点击重试。';}
 finally{clearTimeout(timer);storyBusy=false;button.disabled=false;$('storyInput').disabled=false;$('storyRestart').disabled=false;renderStory();if(story.messages.at(-1)?.mine){const retry=el('button','','重试续写');retry.type='button';retry.addEventListener('click',()=>retryStory());$('storyChoices').append(retry)}}
}
function retryStory(){if(storyBusy||!story.messages.at(-1)?.mine)return;const last=story.messages.pop();advanceStory(last.text)}
$('storyForm').addEventListener('submit',e=>{e.preventDefault();advanceStory($('storyInput').value)});
$('apiForm').addEventListener('submit',()=>renderStory());$('disableApi').addEventListener('click',()=>renderStory());
fillStoryConfig();renderStory();


// 通讯：独立角色、会话、个人资料；不提供真实通讯或支付。
const COMM_KEY='little-phone-communications-v1';
let comm={contacts:[{id:'ayao',name:'阿遥',persona:'温和自然，喜欢旧书店的年轻店主。',messages:state.messages,unread:!state.notices.filter(n=>n.target==='chat').every(n=>n.read)}],profile:{name:'我',account:'local-user',status:''}};
try{const v=JSON.parse(localStorage.getItem(COMM_KEY));if(v&&Array.isArray(v.contacts)&&v.contacts.length&&v.contacts.every(c=>typeof c.id==='string'&&typeof c.name==='string'&&Array.isArray(c.messages))&&v.profile)comm=v}catch{}
// 按用户要求，迁移时仅保留 kk；后续仍可自行添加角色。
const kkDefault=()=>({id:'kk',name:'kk小助手',avatar:'❄',persona:'你是kk小助手，耐心、自然地帮助用户使用雪落机。',messages:[{mine:false,text:'你好，我是kk小助手 ❄ 欢迎来到雪落机。',time:Date.now()}],unread:false});
if(!comm.kkOnlyMigrated){comm.contacts=comm.contacts.filter(c=>c.id==='kk');comm.kkOnlyMigrated=true}else{comm.contacts=comm.contacts.filter(c=>c.id!=='ayao'&&!['阿遥','阿瑶'].includes(c.name))}
if(!comm.contacts.some(c=>c.id==='kk'))comm.contacts.unshift(kkDefault());
{const kk=comm.contacts.find(c=>c.id==='kk');if(!/^data:image\//.test(kk.avatar||''))kk.avatar='❄';}
let commTab='messages',activeContact='kk';
state.messages=comm.contacts.find(c=>c.id==='kk').messages;
try{localStorage.setItem(COMM_KEY,JSON.stringify(comm));localStorage.setItem(KEY,JSON.stringify(state))}catch{}

function commPersist(){const c=comm.contacts.find(c=>c.id===activeContact);if(c)c.messages=state.messages;try{localStorage.setItem(COMM_KEY,JSON.stringify(comm))}catch{commInfo('保存失败','浏览器无法保存通讯数据，请保留重要内容。')}}
window.commPersist=commPersist;
function commInfo(title,text){$('commDialogTitle').textContent=title;$('commDialogText').textContent=text;if(!$('commDialog').open)$('commDialog').showModal()}
function commCloseMenu(){$('commMenu').hidden=true;$('commPlus').setAttribute('aria-expanded','false')}
function commFace(c){const a=el('span','comm-face'+(c.group?' group-face':''));if(c.group){Array.from({length:9},(_,i)=>(c.members||[])[i]||'').forEach(n=>a.append(el('span','',n.slice(0,1))))}else a.textContent=c.avatar||c.name.slice(0,1);return a}
function commRow(title,subtitle,icon,action){const b=el('button','comm-row');b.type='button';const main=el('span','comm-row-main');main.append(el('strong','',title));if(subtitle)main.append(el('span','comm-preview',subtitle));b.append(el('span','comm-face',icon),main,el('span','comm-chevron','›'));b.onclick=action;return b}
function commOpenChat(c){if(chatBusy){commInfo('正在回复','请等当前回复结束后再切换角色。');return}activeContact=c.id;state.messages=c.messages;c.unread=false;commPersist();renderMessages();$('chat').querySelector('header b').textContent=c.name;$('chatInput').placeholder='给'+c.name+'发消息…';$('chatEditRole').hidden=!!c.group;go('chat');renderComm()}
function commTime(t){if(!t)return '';const d=new Date(t),n=new Date();return d.toDateString()===n.toDateString()?d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):d.toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})}
function renderComm(){
 const box=$('commContent');box.replaceChildren();commCloseMenu();$('commHeading').textContent=commTab==='messages'?'通讯'+(comm.contacts.some(c=>c.unread)?'('+comm.contacts.filter(c=>c.unread).length+')':''):commTab==='contacts'?'通讯录':'我';
 $('commUnread').hidden=!comm.contacts.some(c=>c.unread);document.querySelectorAll('[data-comm-tab]').forEach(b=>{b.classList.toggle('selected',b.dataset.commTab===commTab);b.setAttribute('aria-current',b.dataset.commTab===commTab?'page':'false')});
 $('commSearchBox').hidden=commTab==='me'||!$('commSearchToggle').classList.contains('on');
 const q=$('commSearch').value.trim().toLowerCase();
 if(commTab==='messages'){
 const contacts=comm.contacts.filter(c=>(c.name+' '+(c.messages.at(-1)?.text||'')).toLowerCase().includes(q)).slice().sort((a,b)=>(b.messages.at(-1)?.time||0)-(a.messages.at(-1)?.time||0));
 contacts.forEach(c=>{const last=c.messages.at(-1);const b=el('button','comm-row');const main=el('span','comm-row-main');main.append(el('strong','',c.name),el('span','comm-preview',last?.text||'暂无消息 · 点击开始聊天'));b.append(commFace(c),main,el('time','comm-time',commTime(last?.time)));if(c.unread)b.append(el('i','comm-unread-dot'));b.onclick=()=>commOpenChat(c);box.append(b)});if(!contacts.length)box.append(el('p','comm-empty','没有匹配的会话'));
 }else if(commTab==='contacts'){
 box.append(commRow('新的朋友','添加本机角色','＋',()=>go('addFriend')),commRow('群聊','创建虚构角色群聊','♧',commGroup));
 box.append(el('div','comm-section','我的角色 · '+comm.contacts.length));comm.contacts.filter(c=>c.name.toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN')).forEach(c=>{const b=commRow(c.name,c.group?'本机角色群聊':'本机虚构角色',c.avatar||c.name.slice(0,1),()=>commOpenChat(c));box.append(b)});
 }else{
 const card=el('div','comm-profile');const info=el('div');info.append(el('strong','',comm.profile.name),el('small','','通讯号：'+comm.profile.account));const status=el('button','',comm.profile.status||'＋ 状态');status.onclick=()=>{const v=prompt('设置你的状态（最多30字）',comm.profile.status||'');if(v!==null){comm.profile.status=v.trim().slice(0,30);commPersist();renderComm()}};info.append(status);const qr=el('button','','▦');qr.setAttribute('aria-label','我的名片');qr.onclick=()=>go('addFriend');card.append(el('span','comm-face',comm.profile.name.slice(0,1)),info,qr);box.append(card);
 box.append(commRow('钱包','','▤',()=>walletOpen()),commRow('收藏','','☆',()=>commInfo('收藏','收藏功能尚未实现。')),commRow('朋友圈','','▧',()=>go('feed')),commRow('表情','','(≖֊≖)',()=>commInfo('表情','表情管理尚未实现。你可以在聊天输入框中使用手机键盘的表情。')),commRow('设置','','⚙',()=>go('settings')));
 }
}
let contactAvatarData='';
function contactAvatarShow(){const p=$('contactAvatarPreview');p.replaceChildren();p.hidden=!contactAvatarData;if(contactAvatarData){const i=new Image();i.src=contactAvatarData;i.alt='头像预览';i.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit';p.append(i)}}
// 头像压缩到 256px，存在本机通讯数据里。
$('contactAvatar').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>15*1024*1024)throw Error('图片不能超过 15MB。');const url=URL.createObjectURL(f);try{const img=new Image();img.src=url;await img.decode();const k=Math.min(1,256/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*k));c.height=Math.max(1,Math.round(img.height*k));c.getContext('2d').drawImage(img,0,0,c.width,c.height);contactAvatarData=c.toDataURL('image/webp',0.85);contactAvatarShow()}finally{URL.revokeObjectURL(url)}}catch(err){commInfo('头像读取失败',err.message||'无法读取这张图片。')}finally{e.target.value=''}});
let commEditing=null;
function commEditRole(c){if(!c||c.group)return;commEditing=c.id;$('contactName').value=c.name;$('contactPersona').value=c.persona||'';contactAvatarData=/^data:image\//.test(c.avatar||'')?c.avatar:'';contactAvatarShow();$('commEditorTitle').textContent='编辑角色';go('commEditor')}
function commNewRole(name=''){commEditing=null;$('contactName').value=name;$('contactPersona').value='';contactAvatarData='';contactAvatarShow();$('commEditorTitle').textContent='添加角色';go('commEditor')}
$('commEditorForm').addEventListener('submit',e=>{e.preventDefault();const name=$('contactName').value.trim(),persona=$('contactPersona').value.trim();if(!name||!persona)return;const editingC=commEditing&&comm.contacts.find(x=>x.id===commEditing);if(editingC){editingC.name=name;editingC.persona=persona;if(contactAvatarData)editingC.avatar=contactAvatarData;else if(/^data:image\//.test(editingC.avatar||''))editingC.avatar=editingC.id==='kk'?'❄':'';commEditing=null;contactAvatarData='';commPersist();renderComm();if(activeContact===editingC.id){$('chat').querySelector('header b').textContent=name;$('chatInput').placeholder='给'+name+'发消息…'}go('chat');return}comm.contacts.push(Object.assign({id:'role-'+Date.now(),name,persona,messages:[],unread:false},contactAvatarData?{avatar:contactAvatarData}:{}));contactAvatarData='';commPersist();commTab='contacts';renderComm();go('communications')});
function commGroup(){commTab='contacts';renderComm();go('communications');const box=$('commContent');box.replaceChildren(el('p','comm-note','选择至少两位单聊角色。群聊由同一个 AI 模型模拟，不是真人群聊。'));const form=el('form');comm.contacts.filter(c=>!c.group).forEach(c=>{const label=el('label','comm-select');const check=el('input');check.type='checkbox';check.value=c.id;label.append(check,document.createTextNode(' '+c.name));form.append(label)});const button=el('button','comm-primary','创建群聊');form.append(button);form.onsubmit=e=>{e.preventDefault();const ids=Array.from(form.querySelectorAll('input:checked')).map(i=>i.value);if(ids.length<2){commInfo('还没选好','请至少选择两位角色，可以先添加新角色。');return}const members=comm.contacts.filter(c=>ids.includes(c.id));const name=prompt('群聊名称','新的群聊');if(!name?.trim())return;comm.contacts.push({id:'group-'+Date.now(),name:name.trim().slice(0,30),group:true,members:members.map(c=>c.name),persona:'模拟以下虚构角色的群聊，各自发言时标注名字：\n'+members.map(c=>c.name+'：'+c.persona).join('\n'),messages:[],unread:false});commPersist();commTab='messages';renderComm()};box.append(form)}
$('commPlus').onclick=()=>{const open=$('commMenu').hidden;$('commMenu').hidden=!open;$('commPlus').setAttribute('aria-expanded',String(open))};
document.addEventListener('click',e=>{if(!e.target.closest('#commMenu')&&!e.target.closest('#commPlus'))commCloseMenu()});document.addEventListener('keydown',e=>{if(e.key==='Escape')commCloseMenu()});
document.querySelectorAll('[data-comm-tab]').forEach(b=>b.onclick=()=>{commTab=b.dataset.commTab;$('commSearch').value='';renderComm()});
$('commSearchToggle').onclick=()=>{if(commTab==='me')commTab='messages';$('commSearchToggle').classList.toggle('on');renderComm();if(!$('commSearchBox').hidden)$('commSearch').focus()};$('commSearch').oninput=renderComm;
const commActions={group:commGroup,add:()=>go('addFriend'),scan:()=>commInfo('扫一扫','当前版本尚未接入相机或二维码识别，不会申请相机权限。'),pay:()=>walletOpen('pay')};
document.querySelectorAll('[data-comm-action]').forEach(b=>b.onclick=()=>{commCloseMenu();commActions[b.dataset.commAction]()});
$('addMore').onclick=()=>commInfo('添加朋友','输入名称可创建本机虚构角色。没有真实账号搜索或好友服务器。');
$('friendSearchForm').onsubmit=e=>{e.preventDefault();const name=$('friendSearch').value.trim();if(!name)return;const box=$('friendResult');box.replaceChildren();const found=comm.contacts.filter(c=>c.name.includes(name)||c.id===name);found.forEach(c=>box.append(commRow(c.name,'本机已有角色',c.avatar||c.name.slice(0,1),()=>commOpenChat(c))));box.append(commRow('创建角色「'+name+'」','填写人设后保存到本机','＋',()=>commNewRole(name)))};
$('friendActions').append(commRow('扫一扫','扫描二维码名片 · 暂未接入','▣',commActions.scan),commRow('手机联系人','不读取手机真实通讯录','♙',()=>commInfo('手机联系人','此网页没有读取真实手机通讯录。添加角色请使用上面的搜索框。')),commRow('建群','与本机角色进入同一个群聊','♧',commGroup),commRow('公众号和服务号','功能尚未接入','···',()=>commInfo('公众号和服务号','当前没有公众号或服务号服务。')));
// 装饰性名片图案，显式标注不可扫码，避免伪造有效二维码。
{const ctx=$('commQr').getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,210,210);ctx.fillStyle='#777';for(let y=0;y<25;y++)for(let x=0;x<25;x++)if((x*17+y*13+x*y)%7<3)ctx.fillRect(5+x*8,5+y*8,6,6);for(const [x,y]of [[5,5],[149,5],[5,149]]){ctx.fillRect(x,y,56,56);ctx.clearRect(x+8,y+8,40,40);ctx.fillRect(x+16,y+16,24,24)}ctx.fillStyle='white';ctx.fillRect(77,77,56,56);ctx.fillStyle='#555';ctx.fillRect(85,85,40,40);ctx.fillStyle='white';ctx.font='22px sans-serif';ctx.fillText('通',94,113)}
const originalGo=go;go=function(id){if(id==='communications'){if(document.querySelector('#home.active')){commTab='messages';$('commSearch').value=''}renderComm()}commCloseMenu();originalGo(id)};
$('chat').querySelector('.back').dataset.go='communications';
const originalRenderMessages=renderMessages;renderMessages=function(){originalRenderMessages();if(document.querySelector('#chat.active'))commPersist()};
const selected=comm.contacts.find(c=>c.id===activeContact)||comm.contacts[0];activeContact=selected.id;state.messages=selected.messages;renderMessages();renderComm();

$('chat').querySelector('header b').textContent='kk小助手';$('chatInput').placeholder='给kk小助手发消息…';

$('chatEditRole').onclick=()=>commEditRole(comm.contacts.find(c=>c.id===activeContact));
$('contactAvatarClear').onclick=()=>{contactAvatarData='';contactAvatarShow()};
