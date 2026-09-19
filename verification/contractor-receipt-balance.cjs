const fs=require('fs'),ts=require('typescript'),vm=require('vm'),assert=require('node:assert/strict');
const records=[{id:'issue48',stitch_receive_voucher_id:'receipt48',contractor_issue_items:[{item:'Pant',size:'S',colour:'',issued_qty:48}]}];
let fail=false;
const client={from(table){assert.equal(table,'contractor_issue_vouchers');return {select(){return this},async eq(column,id){assert.equal(column,'stitch_receive_voucher_id');return {data:records.filter(r=>r[column]===id),error:fail?{message:'network unavailable'}:null}}}}};
const out={};

vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/services/contractorFinishingService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports:out,require:()=>({createClient:()=>client}),console});
(async()=>{
const service=out.contractorFinishingService;
assert.equal((await service.getIssuedQtyByStitchReceipt('receipt48'))['pant||s'],48);
assert.equal((await service.getIssuedQtyByStitchReceipt('receipt49'))['pant||s']||0,0);
records.push({id:'issue20',stitch_receive_voucher_id:'receipt49',contractor_issue_items:[{item:'Pant',size:'S',colour:'',issued_qty:20}]});
assert.equal(49-(await service.getIssuedQtyByStitchReceipt('receipt49'))['pant||s'],29);
assert.equal((await service.getIssuedQtyByStitchReceipt('receipt49','issue20'))['pant||s']||0,0);
fail=true;await assert.rejects(()=>service.getIssuedQtyByStitchReceipt('receipt49'),/network unavailable/);
console.log('PASS: same component/size in 48 and 49 receipts stay separate; partial issue; edit exclusion; failed query rejects.');
})().catch(e=>{console.error(e);process.exit(1)});
