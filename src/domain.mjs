export const CATEGORIES = ['Roads & potholes', 'Streetlights', 'Waste & sanitation', 'Water & drainage', 'Parks & public spaces'];
export const PEOPLE = [
  {id:'maya',name:'Maya Rao',role:'citizen',initials:'MR'},
  {id:'arjun',name:'Arjun Mehta',role:'citizen',initials:'AM'},
  {id:'sana',name:'Sana Khan',role:'citizen',initials:'SK'},
  {id:'staff',name:'Ward officer',role:'staff',initials:'WO'}
];
export const WARDS = [
  {id:1,name:'Lakeview',short:'LV',lat:12.96,lng:77.57,color:'#4c8d79'},
  {id:2,name:'Greenfield',short:'GF',lat:12.96,lng:77.58,color:'#599780'},
  {id:3,name:'Riverside',short:'RS',lat:12.96,lng:77.59,color:'#8cb49a'},
  {id:4,name:'Old Town',short:'OT',lat:12.95,lng:77.57,color:'#c8c295'},
  {id:5,name:'Central',short:'CT',lat:12.95,lng:77.58,color:'#75a58e'},
  {id:6,name:'Eastwood',short:'EW',lat:12.95,lng:77.59,color:'#a9bd99'},
  {id:7,name:'Southgate',short:'SG',lat:12.94,lng:77.57,color:'#d4b88b'},
  {id:8,name:'Hillcrest',short:'HC',lat:12.94,lng:77.58,color:'#99b397'}
];
export const dayKey = (date=new Date()) => new Date(+date+19800000).toISOString().slice(0,10);
export const distance = (a,b) => { const r=Math.PI/180; const x=(b.lat-a.lat)*r,y=(b.lng-a.lng)*r; const h=Math.sin(x/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(y/2)**2;return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)); };
export async function hash(value) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value))))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function append(s,complaint,action,actor,at=new Date().toISOString(),detail='') {
  const previous=s.events.at(-1)?.hash||'0'.repeat(64);
  const event={sequence:s.events.length+1,complaint,action,actor,at,detail,previous};
  s.events.push({...event,hash:await hash(event)});
}
export async function audit(s) {let previous='0'.repeat(64);for(let i=0;i<s.events.length;i++){const {hash:digest,...e}=s.events[i];if(e.sequence!==i+1||e.previous!==previous||await hash(e)!==digest)return {valid:false,checked:i,brokenAt:i+1};previous=digest;}return {valid:true,checked:s.events.length,head:previous};}
export function scores(s,date=new Date()) {return WARDS.map(w=>{
  const list=s.complaints.filter(c=>c.ward===w.id),closed=list.filter(c=>c.status==='Closed'),fixed=list.filter(c=>c.status==='Awaiting verification'||c.status==='Closed'),timely=closed.filter(c=>+new Date(c.closedAt)-+new Date(c.createdAt)<=7*86400000);
  const score=list.length?Math.round(60*closed.length/list.length+25*timely.length/list.length+15*closed.length/Math.max(1,fixed.length)):0;
  const avgDays=closed.length?closed.reduce((a,c)=>a+(+new Date(c.closedAt)-+new Date(c.createdAt))/86400000,0)/closed.length:null;
  return {...w,score,total:list.length,closed:closed.length,pending:list.length-closed.length,rate:list.length?Math.round(closed.length/list.length*100):0,avgDays:avgDays===null?null:+avgDays.toFixed(1)};
});}
export function snapshot(s,now=new Date(),force=false){const day=dayKey(now);if(!force&&s.lastScoreDay===day)return false;const entry={day,at:now.toISOString(),scores:scores(s,now).map(w=>({ward:w.id,score:w.score}))};s.snapshots=s.snapshots.filter(x=>x.day!==day);s.snapshots.push(entry);s.lastScoreDay=day;return true;}
export async function seed(now=new Date()) {
 const s={complaints:[],events:[],snapshots:[],lastScoreDay:null};
 const titles=['Deep pothole near the bus stop','Streetlight out on Market Road','Garbage piling up near the park','Blocked drain on Station Road','Damaged benches at neighborhood park','Uneven pavement by the school','Flickering light at the crossing','Uncollected waste on Temple Lane'];
 for(const w of WARDS)for(let j=0;j<12;j++){
  const id=`CT-${String(w.id*100+j+1).padStart(4,'0')}`,age=3+j*2;
  const status=j<(10-Math.floor(w.id/2))?'Closed':j===10?'Awaiting verification':j===11?'Reported':'In progress';
  const createdAt=new Date(+now-age*86400000).toISOString();const fixedAt=new Date(+now-(age-2)*86400000).toISOString();const closedAt=status==='Closed'?new Date(+now-(age-3)*86400000).toISOString():null;
  const c={id,title:titles[(j+w.id)%titles.length],description:'A resident reported this issue near a busy neighborhood route. Please inspect the location and make the area safe for pedestrians.',category:CATEGORIES[[0,1,2,3,4,0,1,2][(j+w.id)%titles.length]],ward:w.id,lat:w.lat+(j%3-1)*.0004,lng:w.lng+(j%2)*.0003,reporter:'resident',createdAt,status,photo:null,simulated:true,round:1,votes:status==='Closed'?[{actor:'arjun',confirmed:true},{actor:'sana',confirmed:true}]:[],fixNote:status==='Closed'||status==='Awaiting verification'?'Repair completed and area cleared. Ready for a neighborhood check.':'',fixPhoto:null,fixedAt:status==='Closed'||status==='Awaiting verification'?fixedAt:null,closedAt};
  s.complaints.push(c);await append(s,id,'Reported','resident',createdAt,'Simulated seed report');
  if(status!=='Reported')await append(s,id,'In progress','staff',new Date(+new Date(createdAt)+86400000).toISOString());
  if(c.fixedAt)await append(s,id,'Awaiting verification','staff',fixedAt,'Simulated repair');
  if(status==='Closed'){await append(s,id,'Fix confirmed','arjun',closedAt);await append(s,id,'Fix confirmed','sana',closedAt);await append(s,id,'Closed','system',closedAt,'Two distinct nearby citizens confirmed the fix');}
 }
 const current=scores(s);for(let d=29;d>=1;d--){const date=new Date(+now-d*86400000);s.snapshots.push({day:dayKey(date),at:date.toISOString(),simulated:true,scores:current.map(w=>({ward:w.id,score:Math.max(0,w.score-Math.round(d*.35)+Math.round(Math.sin(d+w.id)*3))}))});}
 snapshot(s,now);return s;
}
export class AppError extends Error {constructor(message,status=400){super(message);this.status=status;}}
function check(ok,message,status=400){if(!ok)throw new AppError(message,status);}
export function location(body){check(Number.isFinite(body.lat)&&Number.isFinite(body.lng)&&Math.abs(body.lat)<=90&&Math.abs(body.lng)<=180,'A valid GPS location is required.');return {lat:body.lat,lng:body.lng};}
export function wardFor(point){const ward=WARDS.find(w=>Math.abs(point.lat-w.lat)<=.005&&Math.abs(point.lng-w.lng)<=.005);check(ward,'Location is outside fictional Navanagar. Use a demo location to explore.');return ward;}
function text(value,min,max,label){check(typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max,`${label} must contain ${min}–${max} characters.`);return value.trim();}
function photo(value){check(typeof value==='string'&&/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<950000,'Upload a JPG, PNG or WebP photo smaller than 700 KB after compression.');return value;}
export async function mutate(s,action,body,actor,now=new Date()){
 check(actor,'Choose a demo identity to continue.',401);const at=now.toISOString();
 if(action==='report'){
  check(actor.role==='citizen','Switch to a citizen identity to report an issue.',403);const point=location(body),ward=wardFor(point);check(CATEGORIES.includes(body.category),'Choose a valid category.');
  const c={id:`CT-${crypto.randomUUID().slice(0,8).toUpperCase()}`,title:text(body.title,5,100,'Title'),description:text(body.description,15,2000,'Description'),category:body.category,ward:ward.id,...point,reporter:actor.id,createdAt:at,status:'Reported',photo:photo(body.photo),round:1,votes:[],fixNote:'',fixPhoto:null,fixedAt:null,closedAt:null,simulated:false};s.complaints.unshift(c);await append(s,c.id,'Reported',actor.id,at);return c;
 }
 if(action==='recalculate'){check(actor.role==='staff','Only the demo ward officer can run scoring.',403);snapshot(s,now,true);await append(s,null,'Scores recalculated',actor.id,at);return {ok:true};}
 const c=s.complaints.find(c=>c.id===body.id);check(c,'Complaint not found.',404);
 if(action==='status'){
  check(actor.role==='staff','Only the demo ward officer can update repair status.',403);
  check((c.status==='Reported'&&body.status==='In progress')||(c.status==='In progress'&&body.status==='Awaiting verification'),'Invalid transition. A complaint closes only after citizen verification.');
  if(body.status==='Awaiting verification'){c.fixNote=text(body.note,10,2000,'Repair note');c.fixPhoto=photo(body.photo);c.fixedAt=at;c.votes=[];}
  c.status=body.status;await append(s,c.id,c.status,actor.id,at,c.fixNote);return c;
 }
 if(action==='verify'){
  check(actor.role==='citizen','Only citizens can verify repairs.',403);check(c.status==='Awaiting verification','This complaint is not awaiting verification.');check(actor.id!==c.reporter,'You cannot verify your own report.',403);check(!c.votes.some(v=>v.actor===actor.id),'You have already voted on this repair.',409);
  check(distance(location(body),c)<=500,'You must be within 500 meters of the complaint to verify.',403);check(typeof body.confirmed==='boolean','Choose whether the issue is fixed.');
  c.votes.push({actor:actor.id,confirmed:body.confirmed,at,round:c.round});await append(s,c.id,body.confirmed?'Fix confirmed':'Fix rejected',actor.id,at,`Repair round ${c.round}; within 500 m`);
  if(!body.confirmed){c.status='In progress';c.round++;c.votes=[];c.fixedAt=null;await append(s,c.id,'Reopened','system',at,'Citizen reports the issue is still present');}
  else if(c.votes.filter(v=>v.confirmed).length>=2){c.status='Closed';c.closedAt=at;await append(s,c.id,'Closed','system',at,'Two distinct nearby citizens confirmed the fix');}
  return c;
 }
 throw new AppError('Unknown action.',404);
}

