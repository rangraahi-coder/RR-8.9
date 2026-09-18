const {PGlite}=require('@electric-sql/pglite');const fs=require('fs'),assert=require('assert/strict');
(async()=>{const db=new PGlite();const q=(s,p)=>db.query(s,p);const owner='10000000-0000-0000-0000-000000000001',babu='10000000-0000-0000-0000-000000000002',lalu='10000000-0000-0000-0000-000000000003',viewer='10000000-0000-0000-0000-000000000004';
async function as(id,sql,p){await db.exec('BEGIN');try{await q("select set_config('request.jwt.claim.sub',$1,true)",[id]);await db.exec('SET LOCAL ROLE authenticated');const r=await q(sql,p);await db.exec('COMMIT');return r;}catch(e){await db.exec('ROLLBACK');throw e;}}
try{
for(const file of ['verification/team-schema-fixture.sql','TEAM-ACCESS-UPDATE.sql','ERROR-REASONS-UPDATE.sql'])await db.exec(fs.readFileSync(file,'utf8'));
for(const [id,email] of [[owner,'owner@example.test'],[babu,'babulal@staff.rangraahi.invalid'],[lalu,'lalu@staff.rangraahi.invalid'],[viewer,'viewer@example.test']])await q('insert into auth.users(id,email) values($1,$2)',[id,email]);
await q("insert into erp_user_access(user_id,display_name,active,is_owner,is_admin,permissions) values($1,'Owner',true,true,true,'{}'),($2,'View only',true,false,false,'{\"cutting\":[\"view\"]}')",[owner,viewer]);
for(const [id,name]of [[babu,'babulal'],[lalu,'lalu']])await as(owner,'select erp_apply_team_profile($1,$2)',[id,name]);
const before=(await q('select user_id,permissions from erp_user_access order by user_id')).rows;
await db.exec(fs.readFileSync('VOUCHER-DETAILS-UPDATE.sql','utf8'));
await db.exec(fs.readFileSync('VOUCHER-DETAILS-UPDATE.sql','utf8'));
for(const id of [babu,lalu]){
 assert.equal((await as(id,"select erp_can('items','view') ok")).rows[0].ok,true);
 assert.equal((await as(id,"select erp_can('items','edit') ok")).rows[0].ok,false);
 await as(owner,'select erp_apply_team_profile($1,$2)',[id,id===babu?'babulal':'lalu']);
 assert.equal((await as(id,"select erp_can('items','view') ok")).rows[0].ok,true);
}
for(const previous of before){const after=(await q('select permissions from erp_user_access where user_id=$1',[previous.user_id])).rows[0].permissions;delete after.items;const old={...previous.permissions};delete old.items;assert.deepEqual(after,old);}
console.log('PASS rerunnable migration; only requested item-view access added; future profiles retain it.');
await assert.rejects(()=>as(viewer,'select erp_save_team_voucher($1,$2,$3,$4)',['cutting',null,{entry_no:'denied'},[{component:'Kurta',total_pieces:1}]]),/View only cannot create Cutting/);
assert.match((await as('10000000-0000-0000-0000-000000000009',"select erp_voucher_access_reason('cutting','create') reason")).rows[0].reason,/no ERP access profile/);
await q('update erp_user_access set active=false where user_id=$1',[viewer]);assert.match((await as(viewer,"select erp_voucher_access_reason('cutting','create') reason")).rows[0].reason,/inactive/);await q('update erp_user_access set active=true where user_id=$1',[viewer]);
const saved=(await as(lalu,'select erp_save_team_voucher($1,$2,$3,$4) data',['cutting',null,{entry_no:'Allowed',roll_details:[],emb_receive_items:[]},[{component:'Kurta',total_pieces:10,net_pieces:10}]] )).rows[0].data;
assert(saved.id);console.log('PASS approved Cutting creation; denied create, missing profile and inactive account have distinct reasons.');
for(const t of ['fabric_inventory','sales_orders','sales_order_items'])await db.exec(`CREATE TRIGGER verify_audit AFTER INSERT OR UPDATE OR DELETE ON ${t} FOR EACH ROW EXECUTE FUNCTION erp_record_activity()`);
const fabric=(await q("insert into fabric_inventory(fabric_name,finished_fabric_name,source_module,stock_qty,unit,category,voucher_no,voucher_date) values('TOP','TOP','manual',100,'Metre','OTHER','FV-1','2026-09-18') returning id")).rows[0].id;
await as(owner,'select erp_edit_manual_fabric($1,$2,$3)',[fabric,{fabric_name:'TOP2',voucher_no:'FV-2',voucher_date:'2026-09-18',roll_no:'R2',fabric_width:'44 inch',remarks:'Checked',stock_qty:90},null]);
const detail=(await as(owner,'select erp_voucher_detail($1,$2) data',['fabric_inventory',fabric])).rows[0].data;
assert.equal(detail.record.roll_no,'R2');assert.equal(detail.record.fabric_width,'44 inch');assert.equal(Number(detail.record.stock_qty),90);
await assert.rejects(()=>as(owner,'select erp_edit_manual_fabric($1,$2,$3)',[fabric,{remarks:'stale'},null]),/changed after/);
await assert.rejects(()=>as('10000000-0000-0000-0000-000000000009','select erp_voucher_detail($1,$2)',['fabric_inventory',fabric]),/permission/);
await q("insert into erp_voucher_links(source_table,source_id,target_table,target_id) values('fabric_inventory',$1,'cutting_entries',$2)",[fabric,saved.id]);
await assert.rejects(()=>as(owner,'select erp_edit_manual_fabric($1,$2,$3)',[fabric,{stock_qty:10},detail.record.updated_at]),/Cannot edit/);
console.log('PASS full fabric edits persist; stale writes, unauthorised reads and settled edits blocked.');
const so=(await q("insert into sales_orders(vch_no) values('SO-1') returning id")).rows[0].id;const other=(await q("insert into sales_orders(vch_no) values('SO-other') returning id")).rows[0].id;
for(let i=0;i<55;i++)await as(owner,'update sales_orders set vch_no=$1 where id=$2',['SO-'+i,so]);
await as(owner,"update sales_orders set vch_no='unrelated' where id=$1",[other]);
const line=(await as(owner,"insert into sales_order_items(sales_order_id,qty) values($1,1) returning id",[so])).rows[0].id;
await as(owner,'delete from sales_order_items where id=$1',[line]);
const h=(await as(owner,'select erp_entry_history($1,$2) data',['sales_orders',so])).rows[0].data;
assert.equal(h.length,50);assert(h.every(e=>e.record_id!==other));assert(h.some(e=>e.action==='DELETE'&&e.table_name==='sales_order_items'));assert(h.some(e=>e.performed_by==='Owner'));
const last=h.at(-1);const older=(await as(owner,'select erp_entry_history($1,$2,$3,$4) data',['sales_orders',so,last.created_at,last.id])).rows[0].data;assert(older.length>0);assert(!older.some(e=>h.some(x=>x.id===e.id)));
console.log('PASS entry-only paginated history includes every edit and deleted child lines, excluding unrelated entries.');
}catch(e){console.error(e.message,e.stack,e.query?.slice(-1200));process.exitCode=1;}finally{await db.close();}})();
