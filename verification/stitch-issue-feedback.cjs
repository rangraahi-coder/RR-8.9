const fs=require('fs'),ts=require('typescript'),assert=require('assert/strict'),vm=require('vm');
const source=fs.readFileSync('src/app/stitching/components/StitchIssueModal.tsx','utf8');
const ast=ts.createSourceFile('s.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let fn;function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='handleSubmit')fn=n.getText(ast);ts.forEachChild(n,visit)}visit(ast);
const js=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
let error='',busy=false,saved=0,calls=0,committed='',server=async()=>{throw Error('Permission denied by database')};
const row={tempId:'r',component:'Kurta',issuedQty:37,size:'M',unit:'Pcs',stitchingRate:0,cuttingComponentId:'cut',sizeBreakdown:[]};
const ctx={saveInFlight:{current:false},committedId:'',voucherDate:'2026-09-24',selectedJobCardNo:'JC1',operatorId:'op',sourcesReady:true,balancesReady:true,
showError:v=>error=v,setError:v=>error=v,components:[row],getRemainingQty:()=>37,getAlreadyIssuedQty:()=>0,setFieldErrors:()=>{},
setSaving:v=>busy=v,jobCards:[{id:'job',jobCardNo:'JC1'}],voucherNo:'SIV-X',operatorName:'Op',totalPieces:37,remarks:'',editVoucher:null,username:'Tester',
stitchingVoucherService:{createIssueVoucher:async()=>{calls++;return server()}},setCommittedId:v=>committed=v,onSaved:()=>saved++,erpErrorMessage:e=>e.message};
vm.createContext(ctx);vm.runInContext(js,ctx);
(async()=>{
const e={preventDefault(){}};
await ctx.handleSubmit(e);assert.match(error,/missing or zero/);assert.equal(calls,0);
row.stitchingRate=5;await ctx.handleSubmit(e);assert.equal(error,'Permission denied by database');assert.equal(busy,false);assert.equal(ctx.saveInFlight.current,false);
let finish;server=()=>new Promise(r=>finish=r);const first=ctx.handleSubmit(e);await ctx.handleSubmit(e);assert.equal(calls,2);finish({id:'saved'});await first;assert.equal(saved,1);assert.equal(committed,'saved');
server=async()=>{throw Object.assign(Error('saved but reload failed'),{committedId:'saved2'})};await ctx.handleSubmit(e);assert.equal(committed,'saved2');assert.equal(busy,false);
assert.ok(source.indexOf('ref={feedbackRef}')>source.indexOf('placeholder="Optional notes..."'));
assert.match(source,/onInvalidCapture/);assert.match(source,/After this entry/);
console.log('PASS missing rate, exact-stock quantity, caught DB error, duplicate in-flight click, committed readback error, bottom feedback and native invalid capture');
})().catch(e=>{console.error(e);process.exit(1)});
