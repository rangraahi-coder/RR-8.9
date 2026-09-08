const path=require('node:path');
const ts=require('typescript'),vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const files=path.join(__dirname,'../src/lib/supabase/services/');
const memory=new Map();const storage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
let calls=[],lose=true,mode='ok';const receipts=new Map();
const mock={auth:{getUser:async()=>({data:{user:{id:'u1'}},error:null})},rpc:async(name,p)=>{
 calls.push(p);if(mode==='reject')return {data:null,error:{code:'22023',message:'Invalid value'}};
 let result=receipts.get(p.p_request_id);
 if(!result){result={style_id:crypto.randomUUID(),variant_ids:[crypto.randomUUID()]};receipts.set(p.p_request_id,result)}
 if(lose){lose=false;throw new Error('response lost after commit')};return {data:result,error:null};
}};
function load(file,supabase){const out=ts.transpileModule(fs.readFileSync(files+file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;const exports={};vm.runInNewContext(out,{exports,require:()=>({supabase}),window:{sessionStorage:storage},crypto,Error,JSON,Array,Promise,console});return exports;}
(async()=>{
 let service=load('originalItemSave.ts',mock);const s={job_card_no:'T',import_key:'k'},v=[];
 await assert.rejects(()=>service.saveOriginalItem(s,v),/Recover/);assert.equal(memory.size,1);
 service=load('originalItemSave.ts',mock);const recovered=await service.saveOriginalItem(s,v);
 assert.equal(calls[0].p_request_id,calls[1].p_request_id);assert.equal(receipts.size,1);assert.equal(memory.size,0);console.log('PASS lost-response retry across module reload uses original identity');
 lose=true;await assert.rejects(()=>service.saveOriginalItem(s,v));let callCount=calls.length;
 await assert.rejects(()=>service.saveOriginalItem({...s,job_card_no:'changed'},v),/previous save/);assert.equal(calls.length,callCount);
 await service.recoverPendingItemSave();assert.equal(memory.size,0);console.log('PASS changed draft cannot replace unresolved save; explicit recovery succeeds');
 mode='reject';await assert.rejects(()=>service.saveOriginalItem(s,v),/Invalid value/);assert.equal(memory.size,0);console.log('PASS confirmed transaction rejection clears pending identity');
})().catch(e=>{console.error(e);process.exitCode=1});
