import http from 'node:http';
import {readFile, mkdir} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {api, initialize, nightly} from './src/api.mjs';
await mkdir('data',{recursive:true});
const db=new DatabaseSync(process.env.CIVICTRACK_DB||'data/civictrack.sqlite');
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS civic_state (id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 0, body TEXT NOT NULL)');
const repo={init:async body=>db.prepare('INSERT OR IGNORE INTO civic_state (id,body) VALUES (1,?)').run(body),read:async()=>db.prepare('SELECT version,body FROM civic_state WHERE id=1').get(),cas:async(version,body)=>db.prepare('UPDATE civic_state SET version=version+1,body=? WHERE id=1 AND version=?').run(body,version).changes===1};
await initialize(repo);await nightly(repo);
// Recalculate at the first check after midnight IST, even with no browser open.
const timer=setInterval(()=>nightly(repo).catch(console.error),30000);timer.unref();
const files={'/':['index.html','text/html; charset=utf-8'],'/app.js':['app.js','text/javascript; charset=utf-8'],'/style.css':['style.css','text/css; charset=utf-8'],'/favicon.svg':['favicon.svg','image/svg+xml']};
const server=http.createServer(async(req,res)=>{
 try{const url=new URL(req.url,`http://${req.headers.host}`);if(url.pathname.startsWith('/api/')){
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1100000){res.writeHead(413,{'content-type':'application/json'});res.end('{"error":"Upload is too large."}');return;}chunks.push(chunk);}
  const request=new Request(url,{method:req.method,headers:req.headers,...(req.method!=='GET'&&req.method!=='HEAD'?{body:Buffer.concat(chunks)}:{})});const response=await api(request,repo);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
 }const entry=files[url.pathname];if(!entry){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'content-type':entry[1],'x-content-type-options':'nosniff','referrer-policy':'same-origin'});res.end(await readFile(new URL(`./public/${entry[0]}`,import.meta.url)));}catch(e){console.error(e);res.writeHead(500);res.end('Server error');}
});
server.listen(Number(process.env.PORT||3000),'127.0.0.1',()=>console.log(`CivicTrack ready at http://localhost:${process.env.PORT||3000}`));
process.on('SIGINT',()=>server.close(()=>{db.close();process.exit(0);}));
