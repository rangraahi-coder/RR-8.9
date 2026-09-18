const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync('src/app/cutting/components/CuttingContent.tsx','utf8');
const handler=src.slice(src.indexOf('  const handleSubmit ='),src.indexOf('  const handleJobCardChange'));
const js=ts.transpileModule(handler+'\nglobalThis.submit=handleSubmit;', {compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText;
let saving=false,error=null,calls=0,resolve;
const ctx={supabase:{rpc:async()=>({data:null,error:null})},saveInFlight:{current:false},setSaving:v=>saving=v,setSaveError:v=>error=v,subComponents:[],form:{date:'2026-09-18',jobCardRef:'JC-1'},hasValidationErrors:false,selectedEmbItems:[],editingEntry:null,entries:[],totalPiecesCutDerived:0,totalRejectionsDerived:0,netPiecesDerived:0,erpErrorMessage:e=>e.message,cuttingService:{create:async()=>{calls++;throw new Error('Voucher permission required');}},setEntries:()=>{},setShowModal:()=>{},resetForm:()=>{},setSuccessMsg:()=>{},setTimeout:()=>{}};
vm.createContext(ctx);vm.runInContext(js,ctx);
(async()=>{
 await ctx.submit({preventDefault(){}});
 assert.equal(saving,false);assert.equal(ctx.saveInFlight.current,false);assert.match(error,/Cutting Create/);
 ctx.cuttingService.create=()=>{calls++;return new Promise(r=>resolve=r)};
 const pending=ctx.submit({preventDefault(){}});assert.equal(saving,true);
 await ctx.submit({preventDefault(){}});await Promise.resolve();assert.equal(calls,2,'duplicate submit ignored');
 resolve({id:'test',entryNo:'CUT-1'});await pending;
 assert.equal(saving,false);assert.equal(ctx.saveInFlight.current,false);assert.equal(error,null);
 console.log('PASS: permission rejection clears saving; retry succeeds; duplicate submit blocked.');
})().catch(e=>{console.error(e);process.exit(1)});
