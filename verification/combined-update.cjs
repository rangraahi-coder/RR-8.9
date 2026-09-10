const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {randomUUID}=require('crypto');
const root=path.resolve(__dirname,'..');
(async()=>{const db=new PGlite();try{
await db.exec(fs.readFileSync(path.join(__dirname,'combined-fixture.sql'),'utf8'));
const base=['20260908180000_original_item_create.sql','20260908200000_restore_missing_persistence.sql','20260908210000_atomic_original_forms.sql','20260908220000_finishing_atomic_save.sql','20260908233000_atomic_component_assembly.sql','20260908234000_finishing_component_stock.sql','20260908235000_contractor_component_stock.sql','20260908235500_component_to_new_item.sql','20260909010000_sales_gst_sizes.sql','20260909011000_receive_fabric_shrinkage.sql'];
for(const file of base){try{await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));}catch(e){throw new Error(file+': '+e.message);}}
for(const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.startsWith('20260910')).sort()){try{await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));}catch(e){throw new Error(file+': '+e.message);}}
for(const file of fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.startsWith('20260910')).sort())await db.exec(fs.readFileSync(path.join(root,'supabase/migrations',file),'utf8'));
console.log('PASS: all combined migrations install and can be rerun');
const owner=randomUUID(),worker=randomUUID(),other=randomUUID();
await db.query('INSERT INTO auth.users(id,email) VALUES($1,$2),($3,$4),($5,$6)',[owner,'owner@example.test',worker,'worker@example.test',other,'other@example.test']);
const combined=fs.readFileSync(path.join(root,'COMBINED-UPDATE.sql'),'utf8');
await assert.rejects(()=>db.exec(combined),/Replace the Owner email/);await db.exec('ROLLBACK');
await db.exec(combined.replace('REPLACE_WITH_EXISTING_RANGRAAHI_LOGIN_EMAIL','owner@example.test'));
console.log('PASS: exact packaged SQL validates the Owner email and links the existing account atomically');
await db.query('SELECT erp_bootstrap_owner($1)',['owner@example.test']);
const act=async id=>{await db.exec('RESET ROLE;SET ROLE authenticated');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[id]);};
const call=async(fn,args)=>{const params=args.map((_,i)=>'$'+(i+1)).join(',');return (await db.query(`SELECT ${fn}(${params}) result`,args.map(x=>typeof x==='object'?JSON.stringify(x):x))).rows[0]?.result;};
await act(owner);assert.equal(await call('erp_can',['unknown','delete']),true);
await call('erp_set_user_access',[worker,'Worker',true,false,{contractor:['view','create'],dispatch:['view','create','delete']}]);
await assert.rejects(()=>call('erp_set_user_access',[owner,'Owner',false,false,{}]),/Owner/);
await act(worker);assert.equal(await call('erp_can',['contractor','create']),true);assert.equal(await call('erp_can',['sales','view']),false);await assert.rejects(()=>call('erp_set_user_access',[other,'Other',true,true,{}]),/Administrator/);await assert.rejects(()=>call('erp_bootstrap_owner',['worker@example.test']),/permission denied/);
console.log('PASS: Owner unrestricted/protected; worker cannot escalate authority');
await act(owner);
const jc1=randomUUID(),jc2=randomUUID(),style=randomUUID();await db.query("INSERT INTO job_cards(id,job_card_no,style_en,party_name) VALUES($1,'JC-A','SET-A','Party'),($2,'JC-B','SET-B','Party')",[jc1,jc2]);await db.query("INSERT INTO item_styles(id,job_card_no,linked_job_card_id)VALUES($1,'STYLE-A',$2)",[style,jc1]);await db.query("INSERT INTO item_compositions(style_id,component_name,qty_per_set)VALUES($1,'Kurta',1),($1,'Pant',1)",[style]);
// Post source receipts through the real transaction and trigger.
const issue1=randomUUID(),issue2=randomUUID(),line1=randomUUID(),line2=randomUUID();
await db.query("INSERT INTO contractor_issue_vouchers(id,voucher_no,job_card_ref,contractor_name)VALUES($1,'CI-A','JC-A','Contractor'),($2,'CI-B','JC-B','Contractor')",[issue1,issue2]);await db.query("INSERT INTO contractor_issue_items(id,issue_voucher_id,item,size,colour,issued_qty,received_qty,balance_qty)VALUES($1,$2,'Kurta','M','Red',12,0,12),($3,$4,'Pant','M','Blue',10,0,10)",[line1,issue1,line2,issue2]);
await act(worker);
const receive=async(id,no,jc,line,quantity)=>call('erp_save_contractor_receive',[id,{voucherNo:no,voucherDate:'2026-09-10',contractorName:'Contractor',jobCardRef:jc},[{issueItemId:line,receivedToday:quantity}],false]);
const rec1=randomUUID();await receive(rec1,'CR-A','JC-A',line1,12);await receive(rec1,'CR-A','JC-A',line1,12);await receive(randomUUID(),'CR-B','JC-B',line2,10);
await assert.rejects(()=>receive(randomUUID(),'OVER','JC-A',line1,1),/exceeds pending/);
const pending=(await db.query('SELECT * FROM erp_pending_components(NULL)')).rows;assert.equal(pending.length,2);assert.equal(pending.find(r=>r.component==='Kurta').pendingQty,12);console.log('PASS: receive posts available components, retry is idempotent, over-receive blocked');
const request={components:[{jobCardRef:'JC-A',component:'Kurta',size:'M',colour:'Red',qtyPerItem:1},{jobCardRef:'JC-B',component:'Pant',size:'M',colour:'Blue',qtyPerItem:1}],itemName:'Mixed Set',itemCode:'NEW-MIX',quantity:10,date:'2026-09-10',size:'M',targetColour:'Red / Blue',createdBy:'Worker'};
const conversion=randomUUID();const result=await call('convert_original_component_to_item',[conversion,request]);assert.equal(result.quantity,10);assert.deepEqual(await call('convert_original_component_to_item',[conversion,request]),result);
const remaining=(await db.query('SELECT * FROM erp_pending_components(NULL)')).rows;assert.equal(remaining.length,1);assert.equal(remaining[0].pendingQty,2);assert.equal(remaining[0].component,'Kurta');
await assert.rejects(()=>call('convert_original_component_to_item',[randomUUID(),{...request,itemCode:'TOO-MANY',quantity:1}]),/exceeds remaining/);
const fg=(await db.query('SELECT * FROM finished_goods WHERE source_voucher_id=$1',[conversion])).rows[0];assert.equal(fg.total_pieces,10);console.log('PASS: two source items assemble into one new item; exact remaining stock and retry checks');
await assert.rejects(()=>db.query('UPDATE finished_goods SET available_for_dispatch=1000 WHERE id=$1',[fg.id]),/permission denied/);
const dispatch=randomUUID(),v={dispatch_date:'2026-09-10',party_name:'Party',finished_goods_id:fg.id,job_card_ref:fg.job_card_ref,item_name:fg.item,colour:fg.colour,size:fg.size,dispatched_pieces:6,status:'dispatched',reference_po:null};
await call('save_original_dispatch',[dispatch,v]);await call('save_original_dispatch',[dispatch,v]);assert.equal((await db.query('SELECT available_for_dispatch n FROM finished_goods WHERE id=$1',[fg.id])).rows[0].n,4);
await assert.rejects(()=>call('save_original_dispatch',[randomUUID(),v]),/exceeds available/);
await assert.rejects(()=>call('save_original_dispatch',[randomUUID(),{...v,finished_goods_id:null,dispatched_pieces:1}]),/assembled ready/);
await call('erp_cancel_dispatch',[dispatch,'Wrong vehicle']);await call('erp_cancel_dispatch',[dispatch,'Wrong vehicle']);assert.equal((await db.query('SELECT available_for_dispatch n FROM finished_goods WHERE id=$1',[fg.id])).rows[0].n,10);
console.log('PASS: optional PO, ready-only dispatch, partial stock, duplicate protection and cancellation restoration');
// Source reservations must protect both Job Cards, including the non-header source.
await act(owner);await assert.rejects(()=>call('erp_delete_contractor_receive',[rec1]),/already been assembled/);
const otherReceipt=(await db.query("SELECT id FROM contractor_receive_vouchers WHERE voucher_no='CR-B'")).rows[0].id;
await assert.rejects(()=>call('erp_delete_contractor_receive',[otherReceipt]),/already been assembled/);
assert.equal((await db.query('SELECT received_qty FROM contractor_issue_items WHERE id=$1',[line2])).rows[0].received_qty,10);
// Ordinary assembly resolves explicit Item Master linkage, and cannot borrow another item's stock.
assert.equal(await call('erp_assembly_style',['JC-A']),style);
const ordinary={jobCardRef:'JC-A',voucherDate:'2026-09-10',finalItemName:'SET-A',size:'M',colour:'Red'};
const ordinaryLines=[{component:'Kurta',size:'M',colour:'Red',qtyUsed:1,availableFinishedQty:2},{component:'Pant',size:'M',colour:'Red',qtyUsed:1,availableFinishedQty:0}];
await assert.rejects(()=>call('save_original_component_assembly',[randomUUID(),ordinary,ordinaryLines]),/Insufficient/);
await db.query("INSERT INTO finishing_stock(job_card_ref,component,size,colour,finished_qty)VALUES('JC-A','Pant','M','Red',2)");
const ordinaryId=randomUUID();const assembled=await call('save_original_component_assembly',[ordinaryId,ordinary,ordinaryLines]);assert.equal(assembled.total_sets_assembled,1);assert.equal((await db.query('SELECT count(*) n FROM finished_goods WHERE source_voucher_id=$1',[ordinaryId])).rows[0].n,1);
console.log('PASS: normal assembly uses the selected item only; both source receipts remain protected');
// Failed final-stock posting must roll back component reservation and new Item Master creation.
await db.exec("RESET ROLE;ALTER TABLE finished_goods ADD CONSTRAINT test_reject_name CHECK(item<>'ROLLBACK');SET ROLE authenticated");
const rollback={...request,itemName:'ROLLBACK',itemCode:'ROLLBACK-CODE',quantity:1,components:[request.components[0]]};
await assert.rejects(()=>call('convert_original_component_to_item',[randomUUID(),rollback]),/test_reject_name/);
assert.equal((await db.query("SELECT count(*) n FROM item_styles WHERE style_no='ROLLBACK-CODE'")).rows[0].n,0);
console.log('PASS: failed ready-stock save rolls back new item and component consumption');
await act(other);assert.equal((await db.query('SELECT * FROM finished_goods')).rows.length,0);await assert.rejects(()=>call('save_original_dispatch',[randomUUID(),v]),/not permitted/);console.log('PASS: unassigned user cannot read ready stock or invoke dispatch');
await act(owner);await call('erp_set_user_access',[worker,'Worker',false,false,{}]);await act(worker);assert.equal(await call('erp_can',['dispatch','view']),false);console.log('PASS: deactivation revokes existing-session authority');
}finally{await db.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
