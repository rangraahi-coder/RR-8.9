const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const output={};let rpcError=null,readsFail=true;
const db={rpc:async()=>({data:rpcError?null:{id:'saved-id'},error:rpcError}),from(){const q={select(){return q},eq(){return q},single:async()=>readsFail?{data:null,error:{message:'Read unavailable'}}:{data:{id:'saved-id',stitch_issue_components:[]},error:null}};return q}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/services/stitchingVoucherService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:output,console:{error(){}},require:()=>({createClient:()=>db})});
(async()=>{
const svc=output.stitchingVoucherService;
for(const save of [()=>svc.createIssueVoucher({},[]),()=>svc.updateIssueVoucher('saved-id',{},[])]){
 await assert.rejects(save,e=>e.committedId==='saved-id'&&/Voucher saved/.test(e.message));
 readsFail=false;assert.equal((await save()).id,'saved-id');readsFail=true;
 rpcError={message:'Stock changed'};await assert.rejects(save,e=>e.message==='Stock changed'&&!e.committedId);rpcError=null;
}
console.log('PASS create/edit distinguish rejected write from confirmed commit followed by failed readback');
})().catch(e=>{console.error(e);process.exit(1)});
