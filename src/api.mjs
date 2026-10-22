import {seed, snapshot, scores, audit, mutate, PEOPLE, WARDS, CATEGORIES, AppError} from './domain.mjs';
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
export async function transact(repo,fn){for(let i=0;i<6;i++){const row=await repo.read();const s=JSON.parse(row.body);const result=await fn(s);if(await repo.cas(row.version,JSON.stringify(s)))return result;}throw new AppError('Another update arrived. Please try again.',409);}
export async function initialize(repo){await repo.init(JSON.stringify(await seed()));}
export async function nightly(repo){return transact(repo,s=>snapshot(s));}
export async function api(request,repo){
 try{
  const path=new URL(request.url).pathname;
  if(request.method==='POST'&&request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('Cross-origin writes are not allowed.',403);
  const id=request.headers.get('cookie')?.match(/(?:^|; )civic_persona=([^;]+)/)?.[1];const actor=PEOPLE.find(p=>p.id===id)||null;
  if(path==='/api/session'&&request.method==='POST'){
   const body=await request.json();const person=PEOPLE.find(p=>p.id===body.id);if(body.id!==null&&!person)throw new AppError('Unknown demo identity.');
   const res=json({actor:person||null});res.headers.set('set-cookie',`civic_persona=${person?.id||''}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${new URL(request.url).protocol==='https:'?'; Secure':''}`);return res;
  }
  if(request.method==='GET'&&path==='/api/state'){
   await nightly(repo);const s=JSON.parse((await repo.read()).body);
   const latest=s.snapshots.at(-1);const current=scores(s).map(w=>({...w,liveScore:w.score,score:latest.scores.find(x=>x.ward===w.id)?.score??0}));
   return json({actor,people:PEOPLE,wards:current,categories:CATEGORIES,complaints:s.complaints,snapshots:s.snapshots,lastScoreAt:latest.at,demo:true});
  }
  if(path==='/api/audit'&&request.method==='GET'){const s=JSON.parse((await repo.read()).body);return json({...await audit(s),events:s.events});}
  if(request.method==='POST'&&['/api/report','/api/status','/api/verify','/api/recalculate'].includes(path)){
   if(Number(request.headers.get('content-length')||0)>1100000)throw new AppError('Upload is too large.',413);
   const raw=await request.text();if(raw.length>1100000)throw new AppError('Upload is too large.',413);const body=JSON.parse(raw);
   const result=await transact(repo,s=>mutate(s,path.slice(5),body,actor));return json(result,200);
  }
  throw new AppError('Endpoint not found.',404);
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid JSON request.'},400);if(!(e instanceof AppError))console.error(e);return json({error:e instanceof AppError?e.message:'Server error. Please try again.'},e.status||500);}
}
