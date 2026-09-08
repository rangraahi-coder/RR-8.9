const path=require('node:path');
const ts=require('typescript'),vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const files=path.join(__dirname,'../src/lib/services/');
const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
let calls=[],lose=true,mode='ok';const receipts=new Map();
const mock={auth:{getUser:async()=>({data:{user:{id:'u1'}},error:null})},rpc:async(name,p)=>{
 calls.push(p);if(mode==='reject')return {data:null,error:{code:'22023',message:'Invalid value'}};
 let result=receipts.get(p.p_id);
 if(!result){result={voucher_id:crypto.randomUUID(),voucher_no:'CCV-LOCAL',style_id:crypto.randomUUID(),variant_id:crypto.randomUUID(),quantity:2};receipts.set(p.p_id,result)}
 if(lose){lose=false;throw new Error('response lost after commit')};return {data:result,error:null};
}};
function load(file,supabase){const out=ts.transpileModule(fs.readFileSync(files+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const exports={};vm.runInNewContext(out,{exports,require:()=>({supabase}),window:{sessionStorage:storage,dispatchEvent(){}},Event:class Event{},crypto,Error,JSON,Array,Promise,console});return exports;}
(async()=>{
 let service=load('componentConversionService.ts',mock);const s={jobCardRef:'JC',component:'Kurta',quantity:2,itemCode:'NEW'};
 await assert.rejects(()=>service.convertComponentToItem(s),/Recover/);assert.equal(memory.size,1);
 service=load('componentConversionService.ts',mock);const recovered=await service.convertComponentToItem(s);
 assert.equal(calls[0].p_id,calls[1].p_id);assert.equal(receipts.size,1);assert.equal(memory.size,0);console.log('PASS conversion lost-response retry across module reload uses original identity');
 lose=true;await assert.rejects(()=>service.convertComponentToItem(s));let callCount=calls.length;
 await assert.rejects(()=>service.convertComponentToItem({...s,itemCode:'changed'}),/previous conversion/);assert.equal(calls.length,callCount);
 await service.recoverComponentConversion();assert.equal(memory.size,0);console.log('PASS conversion changed draft cannot replace unresolved save; explicit recovery succeeds');
 mode='reject';await assert.rejects(()=>service.convertComponentToItem(s),/Invalid value/);assert.equal(memory.size,0);console.log('PASS conversion confirmed transaction rejection clears pending identity');
})().catch(e=>{console.error(e);process.exitCode=1});
