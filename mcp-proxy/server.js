// 雪落机 MCP 中转：只转发到白名单里的 MCP 服务，并加上浏览器需要的跨域头。
const http=require('http'),https=require('https');
const ALLOW=['gwmcp.lkcoffee.com','mcp.amap.com'];
const PORT=process.env.PORT||3000;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Accept,Authorization,Mcp-Session-Id,MCP-Protocol-Version,Last-Event-ID','Access-Control-Expose-Headers':'Mcp-Session-Id,MCP-Protocol-Version','Access-Control-Max-Age':'86400'};
http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,cors);return res.end()}
  const u=new URL(req.url,'http://x');
  if(u.pathname==='/'||u.pathname==='/health'){res.writeHead(200,{...cors,'Content-Type':'text/plain; charset=utf-8'});return res.end('雪落机 MCP 中转 OK')}
  if(u.pathname!=='/mcp'){res.writeHead(404,cors);return res.end()}
  let t;try{t=new URL(u.searchParams.get('target')||'')}catch{res.writeHead(400,cors);return res.end('bad target')}
  if(t.protocol!=='https:'||!ALLOW.includes(t.hostname)){res.writeHead(403,cors);return res.end('target not allowed')}
  const h={};for(const k of ['content-type','accept','authorization','mcp-session-id','mcp-protocol-version','last-event-id'])if(req.headers[k])h[k]=req.headers[k];
  const up=https.request(t,{method:req.method,headers:h},r=>{
    const out={...cors};for(const k of ['content-type','mcp-session-id','mcp-protocol-version','cache-control'])if(r.headers[k])out[k]=r.headers[k];
    res.writeHead(r.statusCode,out);r.pipe(res);
  });
  up.on('error',e=>{if(!res.headersSent)res.writeHead(502,cors);res.end('upstream error')});
  req.pipe(up);
}).listen(PORT,()=>console.log('mcp proxy on',PORT));
