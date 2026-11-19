const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'dist','index.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const dom={innerHTML:'',addEventListener(){}};
const ctx=vm.createContext({document:{documentElement:{},querySelector:()=>dom},localStorage:{getItem:()=>null},crypto:require('node:crypto').webcrypto,assert});
vm.runInContext(script,ctx);
vm.runInContext(`
function run(seed,steps){let x=initial(seed);for(const k of steps)assert(apply(x,k),k);while(!x.clocked)assert(play(x,'pass'));return x}
for(let i=0;i<32;i++){
 const base=['ledger','driver','driver','pass','pass','bell'];
 const fast=run(i,[...base,'crate','driver']);
 const checked=run(i,[...base,'@quay','window','@box',firstLoaded(initial(i))?'stub':'crate','@records','vault','@box','original']);
 assert.equal(fast.charges,1+Number(Boolean(i&2)));assert.equal(checked.charges,1);assert.equal(Number(fast.depart[2].wrong),i%2);assert.equal(checked.depart[2].wrong,false);
 assert.equal(fast.pending.length+checked.pending.length,0);assert.equal(play(checked,'ledger'),false)
}
let claims=['ledger','@quay','forkgossip','promise'];
assert.equal(run(31,[...claims,'promise']).claims,2);assert.equal(run(31,[...claims,'tag']).claims,1);
for(let locked of [false,true]){
 let x=initial(31);assert(play(x,'ledger'));assert(walk(x,'records'));while(x.t<20)assert(play(x,'pass'));
 assert(play(x,locked?'bookcredit':'pencil'));assert(play(x,locked?'bookcredit':'pencil'));assert.equal(x.reserved,locked?1:2)
}
console.log('64 full shifts; delayed routing, settlement, reservations, capacity and terminal guards verified.')
`,ctx)
