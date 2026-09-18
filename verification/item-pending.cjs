const {PGlite}=require('@electric-sql/pglite'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const db=new PGlite();try{await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text,allowed_mime_types text[]); INSERT INTO storage.buckets VALUES('item-images',ARRAY['image/png']); CREATE TABLE item_variants(id uuid,measurement_sheet_url text); INSERT INTO item_variants VALUES(null,'original.xlsx'); CREATE TABLE sales_orders(id uuid PRIMARY KEY,vch_no text,party_name text,status text,total_qty numeric,created_at timestamptz DEFAULT now()); CREATE TABLE job_cards(id uuid PRIMARY KEY,sales_order_id uuid,total_pieces numeric); CREATE FUNCTION erp_can(text,text) RETURNS boolean LANGUAGE sql AS $$SELECT current_setting('test.allowed',true)='yes'$$; SET test.allowed='yes';`);
const sql=fs.readFileSync('ITEM-AND-PENDING-FIX.sql','utf8');await db.exec(sql);await db.exec(sql);
const id=i=>`00000000-0000-0000-0000-${String(i).padStart(12,'0')}`;
for(let i=1;i<=8;i++){await db.query("INSERT INTO sales_orders(id,vch_no,status,total_qty) VALUES($1,$2,'pending',100)",[id(i),'SO'+i]);if(i<=4)await db.query('INSERT INTO job_cards VALUES($1,$1,100)',[id(i)]);}
assert.equal((await db.query('SELECT * FROM erp_pending_job_orders()')).rows.length,4);
await db.query('INSERT INTO job_cards VALUES($1,$2,40)',[id(9),id(5)]);
assert.equal(Number((await db.query("SELECT remaining_qty FROM erp_pending_job_orders() WHERE vch_no='SO5'")).rows[0].remaining_qty),60);
await assert.rejects(()=>db.query('INSERT INTO job_cards VALUES($1,$2,61)',[id(10),id(5)]),/Only 60/);
assert.equal((await db.query('SELECT measurement_sheet_url FROM item_variants')).rows[0].measurement_sheet_url,'original.xlsx');
const m=(await db.query('SELECT allowed_mime_types FROM storage.buckets')).rows[0].allowed_mime_types;assert(m.includes('image/png'));assert(m.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
await db.exec("SET test.allowed='no'");await assert.rejects(()=>db.query('SELECT * FROM erp_pending_job_orders()'),/permission/);
console.log('PASS 8 orders/4 allocated = 4 pending; partial 100-40=60; excess blocked; permission enforced; attachment preserved; Excel MIME allowed; rerun safe');}finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
