const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO authenticated;
CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION erp_can(text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL AND ($2='view' OR auth.uid()='00000000-0000-0000-0000-000000000001'::uuid) $$;`);
await db.exec(fs.readFileSync('verification/team-schema-fixture.sql','utf8').split('\n').slice(1).join('\n'));
const sql=fs.readFileSync('DASHBOARD-LIVE-UPDATE.sql','utf8');await db.exec(sql);await db.exec(sql);
const a='10000000-0000-0000-0000-000000000001',b='10000000-0000-0000-0000-000000000002',cut='20000000-0000-0000-0000-000000000001',receipt='30000000-0000-0000-0000-000000000001';
await db.query("INSERT INTO job_cards(id,job_card_no,total_pieces) VALUES($1,'JC-A',400),($2,'JC-B',400)",[a,b]);
await db.query("INSERT INTO cutting_entries(id,job_card_ref,status) VALUES($1,'JC-A','active')",[cut]);
await db.query("INSERT INTO cutting_sub_components(cutting_entry_id,component,total_pieces,rejections,net_pieces) VALUES($1,'Pant',500,8,492),($1,'Kurta',500,0,500)",[cut]);
await db.query("INSERT INTO printer_fabric_receipts(id,receipt_no,processed_qty) VALUES($1,'REC-1',100)",[receipt]);
await db.query("INSERT INTO fabric_inventory(job_card_id,source_receipt_id,unit) VALUES($1,'REC-1','Metre')",[a]);
async function actor(n){await db.exec('RESET ROLE');await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",['00000000-0000-0000-0000-'+String(n).padStart(12,'0')]);await db.exec('SET ROLE authenticated');}
await actor(1);
const read=async()=> (await db.query('SELECT erp_job_reporting($1::uuid[]) AS data',[[a,b]])).rows[0].data;
let rows=await read();let first=rows.find(r=>r.job_id===a);assert.deepEqual(first.cutting,{pant:492,kurta:500});assert.deepEqual(rows.find(r=>r.job_id===b).cutting,{});assert.equal(first.fabric[0].received_qty,100);assert.deepEqual(first.approvals,[]);
await db.query("SELECT erp_save_job_approval($1,'pattern','approved','Checked sample',0)",[a]);
await assert.rejects(()=>db.query("SELECT erp_save_job_approval($1,'pattern','pending','Stale',0)",[a]),/another session/);
assert.equal((await db.query('SELECT erp_job_approval_audit($1) AS data',[a])).rows[0].data.length,1);
await actor(2);await assert.rejects(()=>db.query("SELECT erp_save_job_approval($1,'pp','approved','',0)",[a]),/permission/);await assert.rejects(()=>db.query('SELECT * FROM erp_job_approvals'),/permission denied/);
await db.exec('RESET ROLE');await db.query("UPDATE cutting_entries SET status='cancelled' WHERE id=$1",[cut]);await db.query("INSERT INTO fabric_inventory(job_card_id,source_receipt_id,unit) VALUES($1,'REC-1','Metre')",[b]);await actor(1);
rows=await read();first=rows.find(r=>r.job_id===a);assert.deepEqual(first.cutting,{});assert.equal(first.fabric[0].received_qty,null);assert.equal(first.approvals[0].status,'approved');
console.log('PASS: idempotent migration, cutting vs order, cross-job isolation, cancelled cuts, receipt linking, shared receipt ambiguity, independent approvals, audit, stale-write protection, read-only permissions');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
