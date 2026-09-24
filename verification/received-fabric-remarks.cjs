const fs=require('fs'),ts=require('typescript'),assert=require('node:assert/strict');
function compile(file,requireFn){const m={exports:{}};new Function('exports','require',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(m.exports,requireFn);return m.exports;}
const {collectStageRemarks}=compile('src/lib/stageRemarks.ts');
const rows=[{voucher_no:'EIV-1',remarks:'Fabric note',fabric_items:[{fabricName:'Cotton',remarks:'Yoke',receivedQty:18}]},{voucher_no:'ERV-1',notes:'Received',cutting_items:[{component:'Kurta',rejectionReason:'Uneven'}]},{stage:'pattern',component_name:'Pant',actor_name:'Sheetal',changed_at:'2026-09-24',remarks:'Approved sample'}];
const remarks=collectStageRemarks(rows);assert.equal(remarks.length,5);assert.equal(remarks[4].actor,'Sheetal');assert.match(remarks[1].path,/Cotton/);assert.equal(collectStageRemarks([{remarks:'  ',id:'secret'}]).length,0);
// Inventory beyond Supabase's usual first-page limit remains selectable, failures surface.
let calls=[],fail=false;
const stocks=Array.from({length:1201},(_,i)=>({id:String(i),fabric_name:'Cotton',stock_qty:i===1200?18:0,unit:'Metre'}));
const db={from(){return {select(){return this},eq(k,v){assert.equal(k,'inventory_stage');assert.equal(v,'finished');return this},order(k){assert.equal(k,'id');return this},async range(a,b){calls.push([a,b]);return fail?{error:Error('Permission failure')}:{data:stocks.slice(a,b+1)}}}}};
const {fabricInventoryService}=compile('src/lib/services/fabricInventoryService.ts',()=>({createClient:()=>db}));
(async()=>{let result=await fabricInventoryService.getForCutting();assert.equal(result.length,1201);assert.equal(result.at(-1).stockQty,18);assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);fail=true;await assert.rejects(fabricInventoryService.getForCutting(),/Permission failure/);console.log('PASS remarks nesting/attribution, inventory pagination and explicit errors');})().catch(e=>{console.error(e);process.exitCode=1});
// Exercise actual UI selection handler: match identity, keep draft, prevent duplicate roll use.
const source=fs.readFileSync('src/app/cutting/components/CuttingContent.tsx','utf8');
const sf=ts.createSourceFile('x.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let select;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='selectReceivedFabric')select=n.initializer.getText(sf);ts.forEachChild(n,visit)}visit(sf);assert.ok(select);
let draft=[{id:'existing',fabricName:'Other fabric',rolls:[{fabricRollId:'other'}]}];
const factory=()=>({component:'Kurta',customComponent:'',fabricName:'',cuttingRate:'',stitchingRate:'',rejections:'',sizes:[],rolls:[]});
const selectJs=ts.transpileModule('const selectReceivedFabric = '+select,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const choose=new Function('fabricItems','fabricLoadError','setSubComponents','makeDefaultSubComponent','makeDefaultRoll','requestAnimationFrame',selectJs+';return selectReceivedFabric;')([{id:'r',fabricName:'Cotton',stockQty:18,unit:'Metre'}],'',fn=>draft=fn(draft),factory,()=>({}),()=>{});
choose({rollId:'r',receiptId:'receipt',voucherNo:'ERV-5'});assert.equal(draft.length,2);assert.equal(draft[1].rolls[0].processReceiptId,'receipt');assert.equal(draft[1].rolls[0].fabricRollId,'r');assert.equal(draft[0].id,'existing');choose({rollId:'r'});assert.equal(draft.length,2);choose({rollId:'missing'});assert.equal(draft.length,2);
console.log('PASS exact received-roll selection, receipt linkage, draft preservation and duplicate prevention');
const journey=fs.readFileSync('src/app/components/ProductionJourney.tsx','utf8');
const jf=ts.createSourceFile('journey.tsx',journey,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let collector;
function find(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='remarkRows')collector=n.getText(jf);ts.forEachChild(n,find)}find(jf);
const tables={emb_issue_vouchers:[{id:'i1',job_card_ref:'JC1',process_type:'embroidery',remarks:'Right'},{id:'i2',job_card_ref:'JC2',process_type:'embroidery',remarks:'Other job'},{id:'i3',job_card_ref:'JC1',process_type:'handwork',remarks:'Other process'}],emb_receive_vouchers:[{id:'r1',issue_voucher_id:'i1',remarks:'Received'},{id:'r2',issue_voucher_id:'i2',remarks:'Other job receipt'},{id:'r3',issue_voucher_id:'i3',remarks:'Handwork receipt'}]};
const getRows=new Function('tables',ts.transpileModule(collector,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText+';return remarkRows;')(tables);
const job={id:'j1',job_card_no:'JC1'},stage={headers:'emb_receive_vouchers',issues:'emb_issue_vouchers',process:'embroidery'};
assert.deepEqual(getRows(job,stage).map(r=>r.id),['i1','r1']);tables.emb_receive_vouchers=[];assert.deepEqual(getRows(job,stage).map(r=>r.id),['i1']);
console.log('PASS dashboard remarks job/process isolation and removal after refresh');
