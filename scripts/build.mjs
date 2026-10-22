import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
const domain=await readFile('src/domain.mjs','utf8');
const api=(await readFile('src/api.mjs','utf8')).replace(/^import .*?from '\.\/domain\.mjs';\r?\n/,'');
const assets={};
for(const [route,file,mime] of [['/','index.html','text/html; charset=utf-8'],['/style.css','style.css','text/css; charset=utf-8'],['/app.js','app.js','text/javascript; charset=utf-8'],['/favicon.svg','favicon.svg','image/svg+xml']])assets[route]={body:await readFile('public/'+file,'utf8'),mime};
const worker=`${domain}\n${api}\nconst ASSETS=${JSON.stringify(assets)};
function repository(env){if(!env.DB)throw new Error('D1 DB binding is missing.');return {
 init:async body=>env.DB.prepare('INSERT OR IGNORE INTO civic_state (id,body) VALUES (1,?)').bind(body).run(),
 read:async()=>env.DB.prepare('SELECT version,body FROM civic_state WHERE id=1').first(),
 cas:async(version,body)=>(await env.DB.prepare('UPDATE civic_state SET version=version+1,body=? WHERE id=1 AND version=?').bind(body,version).run()).meta.changes===1};}
export default {
 async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/')){try{const repo=repository(env);if(!await repo.read())await initialize(repo);return api(request,repo);}catch(e){console.error(e);return json({error:'Database unavailable. Please try again.'},503);}}const asset=ASSETS[url.pathname];return asset?new Response(asset.body,{headers:{'content-type':asset.mime,'x-content-type-options':'nosniff','referrer-policy':'same-origin'}}):new Response('Not found',{status:404});},
 async scheduled(event,env,ctx){const repo=repository(env);if(!await repo.read())await initialize(repo);ctx.waitUntil(nightly(repo));}
};`;
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',worker);await cp('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built Worker ESM with embedded assets. Local development: npm start.');
