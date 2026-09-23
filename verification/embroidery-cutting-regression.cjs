const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
let tables, failure;
function client() { return {from(table) {
  let predicates=[];
  const query={select(){return query},eq(k,v){predicates.push(r=>r[k]===v);return query},in(k,v){predicates.push(r=>v.includes(r[k]));return query},gt(k,v){predicates.push(r=>r[k]>v);return query},then(resolve,reject){return Promise.resolve({data:(tables[table]||[]).filter(r=>predicates.every(p=>p(r))),error:failure===table?new Error('Denied'):null}).then(resolve,reject)}};
  return query;
}};}
const exportsObject={};
const code=ts.transpileModule(fs.readFileSync('src/lib/services/cuttingService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
vm.runInNewContext(code,{exports:exportsObject,require(name){if(name.includes('supabase/client'))return {createClient:client};return {}},console});
const service=exportsObject.cuttingService;
const job='JC-2026-878515';
(async()=>{
 tables={emb_issue_vouchers:[{id:'i',job_card_ref:job,cutting_items:[{component:'Kurta',pieces:482,unit:'Pcs'}]}],emb_receive_vouchers:[
 {id:'r3',issue_voucher_id:'i',job_card_ref:job,cutting_items:[{component:'Kurta',receivedPieces:480,unit:'Pcs'}]},
 {id:'r2',issue_voucher_id:'i',job_card_ref:job,voucher_no:'ERV-0002',fabric_items:[{fabricName:'Rust',rollId:'roll',receivedQty:18,unit:'Metre'}]},
 {id:'other',job_card_ref:'different-job',cutting_items:[{component:'Kurta',receivedPieces:999}]}],cutting_entries:[{job_card_ref:job,emb_receive_items:[{component:'Kurta',piecesUsed:480,unit:'Pcs'}]}],cutting_stock:[]};
 let result=await service.getEmbCuttingSummaryByJobCard(job);
 assert.equal(result.length,1);assert.equal(result[0].embReceived,480);assert.equal(result[0].issuedToCutting,480);assert.equal(result[0].pendingForCutting,0);
 let refs=await service.getEmbFabricReferences(job);assert.equal(refs.length,1);assert.equal(refs[0].receivedQty,18);assert.equal(refs[0].unit,'Metre');
 tables.cutting_entries[0].emb_receive_items[0].piecesUsed=300;
 result=await service.getEmbCuttingSummaryByJobCard(job);assert.equal(result[0].pendingForCutting,180);
 tables.cutting_entries=[];result=await service.getEmbCuttingSummaryByJobCard(job);assert.equal(result[0].pendingForCutting,480);
 tables.emb_receive_vouchers=tables.emb_receive_vouchers.filter(r=>r.id!=='r3');result=await service.getEmbCuttingSummaryByJobCard(job);assert.equal(result.length,0);
 tables.emb_receive_vouchers=tables.emb_receive_vouchers.filter(r=>r.id!=='r2');refs=await service.getEmbFabricReferences(job);assert.equal(refs.length,0);
 failure='emb_receive_vouchers';await assert.rejects(service.getEmbCuttingSummaryByJobCard(job));await assert.rejects(service.getEmbFabricReferences(job));
 console.log('PASS: 480 counted once; consumed 480 leaves zero; 18 metres separate; edit/delete recalculate; unrelated job excluded; query failures surfaced.');
})().catch(e=>{console.error(e);process.exit(1)});
// Exercise the form's actual pricing function (also used on create and edit payloads).
const modal=fs.readFileSync('src/app/embroidery-accessory/components/ReceiveVoucherModal.tsx','utf8');
const parsed=ts.createSourceFile('modal.tsx',modal,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let priceFunction;
function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='withFabricPrice')priceFunction=node.getText(parsed);ts.forEachChild(node,visit)}visit(parsed);
const priceContext={};vm.createContext(priceContext);vm.runInContext(ts.transpileModule(priceFunction,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText,priceContext);
const priced=priceContext.withFabricPrice;
assert.equal(priced({receivedQty:18,embroideryRate:50}).embroideryCharge,900);
assert.equal(priced({receivedQty:17.5,embroideryRate:50,embroideryCharge:900}).embroideryCharge,875);
assert.equal(priced({receivedQty:18,embroideryCharge:125}).embroideryCharge,125);
assert.equal(priced({receivedQty:0,embroideryRate:50}).embroideryCharge,0);
assert(modal.includes('fabricItems.map(withFabricPrice)'));assert(modal.includes('const allFabricItems = fabricItems.map(withFabricPrice)'));
console.log('PASS: fabric rate/amount, decimal quantities, edited quantity recalculation, fixed-price retention, zero quantity; create/edit pricing paths.');
