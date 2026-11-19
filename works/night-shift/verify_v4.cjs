// Night Shift V4 slice 1 · rules checks for the K17 freight line. Run: node verify_v4.cjs  (prints a table; exit 0 = pass)
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'dist','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1],cut=script.indexOf('/* ===== V4 slice 1');assert(cut>0,'overlay marker');
const mk=src=>{const ctx=vm.createContext({});vm.runInContext(src+';globalThis.API={initial,actions,play,walk,apply,firstLoaded,discoveries,verbs,rooms,X:typeof k17report==="function"?{k17report,V4}:null};',ctx);return ctx.API};
const G=mk(script),V2=mk(script.slice(0,cut));const X=G.X;
const J=o=>JSON.parse(JSON.stringify(o));
const truth=seed=>seed&2?'D':seed&32?'Q':'L';
function run(seed,steps,decide){const s=G.initial(seed),trail=[];const go=k=>{assert(G.apply(s,k),'seed '+seed+' step '+k+' not allowed at t='+s.t+' ['+G.actions(s)+']');trail.push(k)};
 for(const k of steps)go(k);if(decide)for(const k of decide(s))go(k);let n=0;while(!s.clocked){go('pass');assert(++n<60)}return{s,trail}}
const pre=['ledger','pass','pass','pass','bell'];
const POL={
 crate:[...pre,'crate'],stub:[...pre,'stub'],wait:[...pre,'k17wait'],hold:[...pre,'k17hold'],'hold+crate':[...pre,'k17hold','crate'],
 'hold,lift':[...pre,'k17hold','pass','k17lift'],none:['ledger']};
const informed=s=>(s.k.know&&(s.k.know.gone||s.k.know.queue))?['stub']:['crate'];
const naive=s=>(s.k.know&&s.k.know.gone)?['stub']:['crate'];
const SEEDS=[...Array(1024).keys()];let checks=0;const tab={};const add=(p,t,r)=>{const k=p+'|'+t;(tab[k]=tab[k]||new Set()).add(r)};
const res=s=>s.k.done+(s.k.late?' late':'');
for(const seed of SEEDS){const t=truth(seed),fog=Boolean(seed&64);
 for(const [p,steps] of Object.entries(POL)){const{s}=run(seed,steps);add(p,t,res(s));checks++;
  // 守恒:货一定走;重复 = 多出来的装货笔数;钱只按规则扣
  assert(s.k.closed&&s.k.gone&&s.k.done>=1&&s.charges===s.k.done&&s.settled&&s.pending.length===0&&s.k.q.length===0,'close '+seed+p);
  assert.equal(s.k.fee,X.V4.DUPFEE*(s.k.done-1));assert(s.k.demur===0||(s.k.late&&s.k.demur===X.V4.DEMUR));assert.equal(s.cash,10-s.k.fee-s.k.demur,'cash '+seed+p);
  if(p==='crate')assert.equal(res(s),t==='L'?'1':'2');
  if(p==='stub')assert.equal(res(s),t==='L'?'1 late':'1');
  if(p==='wait'){assert.equal(res(s),'1','等五点对账:恰好一笔、不误船');assert.equal(s.holds,1,'代价是秤台后面多压一节车')}else assert.equal(s.holds,0);
  if(p==='hold')assert.equal(res(s),t==='D'?'1':'1 late');
  if(p==='hold+crate'){assert.equal(s.k.done,1,'隔离后再重发也不会重复 '+seed)}
  if(p==='hold,lift')assert.equal(res(s),t==='L'?'1':'2','擦掉「停」却不做决定 = 回到没回话');
  if(p==='none'){assert.equal(res(s),t==='L'?'1':'2');assert(s.k.auto&&!s.k.basis&&X.k17report(s).open)}
 }
 // 花钱买观察 → 按报告行动:所有世界(含雾夜)都恰好一笔、不误船,代价是 2 枚钱和 2 分钟
 {const{s}=run(seed,[...pre,'k17runner','pass'],informed);add('runner→act',t,res(s));assert.equal(res(s),'1','runner '+seed);assert.equal(s.cash,10-X.V4.RUNNER);assert.equal(s.k.basis.src,'runner');assert(s.k.basis.age>=1,'报告是旧的');checks++}
 // 亲眼去看
 {const a=run(seed,[...pre,'@quay','window','@box'],naive),b=run(seed,[...pre,'@quay','window','@box'],informed),c=run(seed,[...pre,'@records','journal','@box'],informed);
  if(fog){for(const r of [a,c]){assert.equal(r.s.k.know,null,'雾夜看不到 '+seed);assert(!r.s.seen.witness)}add('look,naive(fog)',t,res(a.s));assert.equal(a.s.k.basis.src,'none')}
  else{add('look,ignore the queue',t,res(a.s));add('look,read the queue',t,res(b.s));assert.equal(res(b.s),'1');assert.equal(res(c.s),'1');assert.equal(res(a.s),t==='Q'?'2':'1','看见还在秤台就重发:排队中的那张也会到 '+seed)}
  checks+=3}
 // 确定性:同种子同轨迹 → 同状态;纯逻辑重放 = 现场状态
 {const a=run(seed,POL.crate),b=G.initial(seed);a.trail.forEach(k=>assert(G.apply(b,k)));assert.deepEqual(J(b),J(a.s));checks++}
}
// 过程 ≠ 结果:同一个做法,在不同的夜晚有好有坏
const set=k=>[...tab[k]].sort().join(' / ');
assert.equal(set('hold|L'),'1 late');const dem=p=>new Set(SEEDS.filter(x=>truth(x)==='L').map(x=>run(x,POL[p]).s.k.demur));
assert.deepEqual([...dem('hold')].sort(),[0,3],'谨慎的做法有时白等、有时赔三枚');assert.deepEqual([...dem('crate')],[0]);
assert(SEEDS.some(x=>truth(x)==='L'&&run(x,POL.crate).s.k.done===1)&&SEEDS.some(x=>truth(x)!=='L'&&run(x,POL.crate).s.k.done===2),'鲁莽的做法有时碰巧对');
// 旧世界等价:第 5、6 位为 0 的种子上,V2 自己的动作路径给出与 V2 原引擎相同的结果(钱按 K17 费用校正)
let legacy=0;for(const seed of SEEDS.filter(x=>!(x&96))){for(const steps of [['ledger','driver','driver','pass','pass','bell','crate','driver'],['ledger','driver','driver','pass','pass','bell','@quay','window','@box',(seed&2)?'stub':'crate','@records','vault','@box','original'],['ledger','tube','hold','driver','pass','pass','bell','stub','@quay','forkgossip','promise','tag','@kitchen','tea']]){
 const a=G.initial(seed),b=V2.initial(seed);for(const k of steps){assert.equal(G.apply(a,k),V2.apply(b,k),k)}while(!a.clocked)G.apply(a,'pass');while(!b.clocked)V2.apply(b,'pass');
 if((seed&2)||steps.includes('crate')||steps[9]==='crate'){for(const f of ['charges','claims','reserved','holds','route','lift','price','orders','key'])assert.deepEqual(J(a[f]),J(b[f]),f+' seed '+seed);assert.deepEqual(J(a.depart),J(b.depart));assert.equal(a.cash+a.k.fee+a.k.demur,b.cash)}legacy++}}
// 模糊测试:随机走,动作集合封闭,文字完整
let fuzz=0,acts=0;for(let seed=0;seed<600;seed++){const s=G.initial(seed*2654435761>>>0);let r=seed+1,n=0;const rnd=()=>{r=Math.imul(r^(r>>>15),0x2c1b3c6d)>>>0;r^=r<<13;r>>>=0;return r/4294967296};
 while(!s.clocked){const a=G.actions(s).concat(s.open?Object.keys(G.rooms).filter(p=>p!==s.place).map(p=>'@'+p):[]);assert(a.length>0);for(const bad of ['k17lift','k17hold','k17wait','k17runner','crate','dawn','@moon','__proto__'])if(!a.includes(bad)){const before=JSON.stringify(s);assert.equal(G.apply(s,bad),false);assert.equal(JSON.stringify(s),before,'被拒的动作不改状态')}
  const k=a[Math.floor(rnd()*a.length)];assert(G.apply(s,k),k);acts++;assert(++n<200);assert(Array.isArray(s.last)&&s.last.length===2&&s.last.every(x=>typeof x==='string'&&x.length>3),'文字 '+k)}
 assert(s.k.closed&&s.k.done>=1&&s.charges===s.k.done&&Number.isInteger(s.cash)&&s.pending.length===0,'end '+JSON.stringify({seed:s.seed,closed:s.k.closed,done:s.k.done,charges:s.charges,cash:s.cash,pending:s.pending.length,q:s.k.q.length,t:s.t}));const rep=X.k17report(s);assert(rep.basis[0].length>10&&rep.basis[1].length>5);G.discoveries(s).forEach(d=>assert(d.length===4));for(const k of G.actions(s))assert.fail('clocked but '+k);fuzz++}
// V2 缺陷回归:出价结算。V2 原引擎在这里把钱匣算成 NaN、文字里出现 undefined
for(const [seed,bid,want] of [[0,'bid7',10+(5-7)*3],[0,'bid5',10],[8,'bid7',10],[8,'bid5',10]]){const mkrun=E=>{const s=E.initial(seed);E.apply(s,'ledger');E.apply(s,'@quay');while(s.t<16)E.apply(s,'pass');assert(E.apply(s,bid));E.apply(s,'pass');E.apply(s,'pass');return s};
 const a=mkrun(G),line=a.log.find(l=>/bulletin finally/.test(l[1][0]))[1];assert.equal(a.cash,want,'bid '+seed+bid);assert(!/undefined|NaN/.test(line[0]+line[1])&&line[0].includes('Your bid was '+bid.slice(3)));if(bid==='bid7'&&seed===0)assert(Number.isNaN(mkrun(V2).cash),'V2 原引擎确实是 NaN(若此断言失败,说明 V2 已自行修复,可删掉覆盖层里的补丁)')}
for(const id of ['k17hold','k17lift','k17wait','k17runner'])assert(G.verbs[id].split('|').length===2);
console.log('K17 结果表(装货笔数;late = 误了水果船)。真相:D 雨前已走 · Q 单子还在排队、会自己到 · L 单子真丢了');
const order=['crate','stub','wait','hold','hold+crate','hold,lift','none','look,ignore the queue','look,read the queue','look,naive(fog)','runner→act'];
for(const p of order)console.log('  '+p.padEnd(24)+['D','Q','L'].map(t=>(t+': '+(tab[p+'|'+t]?set(p+'|'+t):'—')).padEnd(16)).join(''));
console.log(`${checks} policy runs over ${SEEDS.length} seeds; ${legacy} legacy-equivalence runs vs the V2 engine; ${fuzz} random shifts (${acts} actions). All invariants hold.`);
