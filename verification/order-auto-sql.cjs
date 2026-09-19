const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; GRANT USAGE ON SCHEMA public,auth TO authenticated;
CREATE TABLE auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION erp_can(text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT auth.uid() IS NOT NULL AND ($2='view' OR auth.uid()='00000000-0000-0000-0000-000000000001'::uuid) $$;`);
await db.exec(fs.readFileSync('verification/team-schema-fixture.sql','utf8').split('\n').slice(1).join('\n'));
const sql=fs.readFileSync('ORDER-AUTO-LINK-UPDATE.sql','utf8');await db.exec(sql);await db.exec(sql);
await db.query("SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)");
await db.exec("INSERT INTO sales_orders(id,vch_no,status) VALUES('10000000-0000-0000-0000-000000000001','SO1','pending'),('10000000-0000-0000-0000-000000000002','SO2','cancelled'); SET ROLE authenticated;");
let result=await db.query('SELECT erp_order_linked_report(0,100) AS data');assert.equal(result.rows[0].data.length,1);assert.equal(result.rows[0].data[0].order.vch_no,'SO1');
await assert.rejects(()=>db.query('SELECT erp_order_linked_report(0,101)'),/Invalid report page/);
await db.query("SELECT set_config('request.jwt.claim.sub','',false)");await assert.rejects(()=>db.query('SELECT erp_order_linked_report(0,100)'),/permission/);
await db.exec('RESET ROLE');await db.exec(fs.readFileSync('VOUCHER-LINK-AUDIT.sql','utf8'));
console.log('PASS: read-only voucher audit executes; report SQL applied twice, query executes, cancelled orders excluded, page bounds, unauthenticated access rejected.');
}finally{await db.close();}})().catch(e=>{console.error(e);process.exit(1)});
