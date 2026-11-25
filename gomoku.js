/* 本地双人五子棋；独立存储，不依赖模型接口。 */
(()=>{'use strict';
const root=document.getElementById('app-gomoku');if(!root)return;
const board=root.querySelector('.gm-board'),status=root.querySelector('.gm-status'),undo=root.querySelector('.gm-undo');
const KEY='snowfall-gomoku-v1',N=15;let moves=[],cells=[],winner=0;
function win(grid,r,c,p){return [[1,0],[0,1],[1,1],[1,-1]].some(([dr,dc])=>{let count=1;for(const sign of [-1,1]){let y=r+dr*sign,x=c+dc*sign;while(y>=0&&y<N&&x>=0&&x<N&&grid[y*N+x]===p){count++;y+=dr*sign;x+=dc*sign}}return count>=5})}
function save(){try{localStorage.setItem(KEY,JSON.stringify(moves))}catch{root.querySelector('.gm-save').textContent='浏览器未能保存，本局仅在当前页面保留。'}}
function render(){const grid=Array(N*N).fill(0);winner=0;moves.forEach((m,i)=>{const p=i%2+1;grid[m]=p;if(win(grid,Math.floor(m/N),m%N,p))winner=p});cells.forEach((b,i)=>{const p=grid[i];b.className='gm-cell'+(p===1?' gm-black':p===2?' gm-white':'')+(moves.length&&moves[moves.length-1]===i?' gm-last':'');b.disabled=!!p||!!winner;b.setAttribute('aria-label',`${Math.floor(i/N)+1}行${i%N+1}列，${p===1?'黑棋':p===2?'白棋':'空位'}`)});status.textContent=winner?`${winner===1?'黑棋':'白棋'}获胜！`:moves.length===N*N?'棋盘已满，本局和棋':`轮到${moves.length%2?'白棋':'黑棋'} · 第 ${moves.length+1} 手`;undo.disabled=!moves.length}
try{const saved=JSON.parse(localStorage.getItem(KEY));if(Array.isArray(saved)&&saved.length<=N*N){const grid=Array(N*N).fill(0);for(const m of saved){if(!Number.isInteger(m)||m<0||m>=N*N||grid[m])break;const p=moves.length%2+1;grid[m]=p;moves.push(m);if(win(grid,Math.floor(m/N),m%N,p))break}}}catch{}
for(let i=0;i<N*N;i++){const b=document.createElement('button');b.type='button';b.className='gm-cell';b.addEventListener('click',()=>{if(winner||moves.includes(i))return;moves.push(i);render();save()});board.append(b);cells.push(b)}
undo.addEventListener('click',()=>{moves.pop();render();save()});root.querySelector('.gm-restart').addEventListener('click',()=>{if(moves.length&&!confirm('要结束当前棋局并重新开始吗？'))return;moves=[];render();save()});render();
})();
