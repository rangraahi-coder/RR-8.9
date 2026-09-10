-- KurtiERP combined update, 10 September 2026.
-- Replace ONLY the email below with the EXISTING Rangraahi Supabase login email.
-- The exact email is required; display names are not used to guess account ownership.
SELECT set_config('erp.owner_email', 'Rangraahi@gmail.com', false);
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=lower(trim(current_setting('erp.owner_email')))) THEN
  RAISE EXCEPTION 'Replace the Owner email at the top with the existing Rangraahi login email. No update has been applied.';
 END IF;
END $$;

-- 20260910180000_user_authority.sql
CREATE TABLE IF NOT EXISTS public.erp_user_access (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '', active boolean NOT NULL DEFAULT false,
 is_admin boolean NOT NULL DEFAULT false, is_owner boolean NOT NULL DEFAULT false,
 permissions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(permissions)='object'),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(NOT is_owner OR (is_admin AND active))
);
CREATE UNIQUE INDEX IF NOT EXISTS erp_single_owner ON erp_user_access(is_owner) WHERE is_owner;
ALTER TABLE erp_user_access ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.erp_can(p_module text,p_action text DEFAULT 'view') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.erp_user_access u WHERE u.user_id=auth.uid() AND u.active AND (u.is_owner OR u.is_admin OR coalesce(u.permissions->p_module,'[]'::jsonb) ? p_action))
$$;
REVOKE ALL ON FUNCTION public.erp_can(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_can(text,text) TO authenticated;
DROP POLICY IF EXISTS erp_access_read ON erp_user_access;
CREATE POLICY erp_access_read ON erp_user_access FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.erp_can('users','view'));
GRANT SELECT ON erp_user_access TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON erp_user_access FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.erp_list_users() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.erp_can('users','view') THEN RAISE EXCEPTION 'Administrator required';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',a.id,'email',a.email,'display_name',coalesce(u.display_name,''),'active',coalesce(u.active,false),'is_admin',coalesce(u.is_admin,false),'is_owner',coalesce(u.is_owner,false),'permissions',coalesce(u.permissions,'{}'::jsonb)) ORDER BY a.email),'[]'::jsonb) FROM auth.users a LEFT JOIN public.erp_user_access u ON u.user_id=a.id);
END $$;
CREATE OR REPLACE FUNCTION public.erp_set_user_access(p_user_id uuid,p_name text,p_active boolean,p_admin boolean,p_permissions jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE entry record;
BEGIN
 LOCK TABLE public.erp_user_access IN SHARE ROW EXCLUSIVE MODE;
 IF NOT public.erp_can('users','edit') THEN RAISE EXCEPTION 'Administrator required';END IF;
 IF EXISTS(SELECT 1 FROM public.erp_user_access WHERE user_id=p_user_id AND is_owner) THEN RAISE EXCEPTION 'Owner access cannot be changed';END IF;
 IF p_user_id=auth.uid() AND (NOT p_active OR NOT p_admin) THEN RAISE EXCEPTION 'An administrator cannot remove their own access';END IF;
 IF jsonb_typeof(p_permissions) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid permission object';END IF;
 FOR entry IN SELECT * FROM jsonb_each(p_permissions) LOOP
  IF NOT entry.key=ANY(ARRAY['items','accounts','operators','sales','jobs','grey','dyeing','fabric','cutting','embroidery','handwork','stitching','qc','contractor','finishing','ready','dispatch','ledger','audit']) OR jsonb_typeof(entry.value)<>'array' THEN RAISE EXCEPTION 'Invalid module permissions';END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(entry.value) a WHERE a<>ALL(ARRAY['view','create','edit','delete'])) OR (jsonb_array_length(entry.value)>0 AND NOT entry.value ? 'view') THEN RAISE EXCEPTION 'Invalid permission action';END IF;
 END LOOP;
 INSERT INTO public.erp_user_access(user_id,display_name,active,is_admin,permissions)VALUES(p_user_id,trim(p_name),p_active,p_admin,p_permissions)
 ON CONFLICT(user_id)DO UPDATE SET display_name=excluded.display_name,active=excluded.active,is_admin=excluded.is_admin,permissions=excluded.permissions,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.erp_list_users(),public.erp_set_user_access(uuid,text,boolean,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_list_users(),public.erp_set_user_access(uuid,text,boolean,boolean,jsonb) TO authenticated;
-- Run only in Supabase SQL Editor, using the existing Rangraahi login email.
CREATE OR REPLACE FUNCTION public.erp_bootstrap_owner(p_email text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE uid uuid;
BEGIN
 LOCK TABLE public.erp_user_access IN SHARE ROW EXCLUSIVE MODE;
 SELECT id INTO STRICT uid FROM auth.users WHERE lower(email)=lower(trim(p_email));
 IF EXISTS(SELECT 1 FROM public.erp_user_access WHERE is_owner AND user_id<>uid) THEN RAISE EXCEPTION 'Owner already configured';END IF;
 INSERT INTO public.erp_user_access(user_id,display_name,active,is_admin,is_owner)VALUES(uid,'Rangraahi',true,true,true)
 ON CONFLICT(user_id)DO UPDATE SET active=true,is_admin=true,is_owner=true,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.erp_bootstrap_owner(text) FROM PUBLIC,anon,authenticated;

-- 20260910181000_assembly_sources.sql
ALTER TABLE job_cards ADD COLUMN IF NOT EXISTS item_style_id uuid REFERENCES item_styles(id);
ALTER TABLE component_assembly_items ADD COLUMN IF NOT EXISTS source_job_card_ref text;
UPDATE component_assembly_items i SET source_job_card_ref=v.job_card_ref FROM component_assembly_vouchers v WHERE v.id=i.assembly_voucher_id AND i.source_job_card_ref IS NULL;
CREATE OR REPLACE FUNCTION public.erp_assembly_style(p_job_ref text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE jc public.job_cards; ids uuid[];
BEGIN
 SELECT * INTO STRICT jc FROM job_cards WHERE job_card_no=p_job_ref;
 IF jc.item_style_id IS NOT NULL THEN RETURN jc.item_style_id;END IF;
 SELECT array_agg(id) INTO ids FROM item_styles WHERE linked_job_card_id=jc.id;
 IF coalesce(array_length(ids,1),0)=0 THEN SELECT array_agg(id) INTO ids FROM item_styles WHERE job_card_no=jc.job_card_no;END IF;
 IF coalesce(array_length(ids,1),0)=0 THEN
  SELECT array_agg(id) INTO ids FROM item_styles WHERE lower(trim(style_no))=lower(trim(jc.style_en)) OR lower(trim(design_code))=lower(trim(nullif(to_jsonb(jc)->>'design_code','')));
 END IF;
 IF coalesce(array_length(ids,1),0)<>1 THEN RAISE EXCEPTION 'Select the Item Master style for this Job Card before assembling. Available components have not been removed.';END IF;
 RETURN ids[1];
END $$;
CREATE OR REPLACE FUNCTION public.erp_assembly_composition(p_job_ref text) RETURNS TABLE(component text,"qtyPerSet" integer) LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 SELECT min(component_name),sum(qty_per_set)::integer FROM item_compositions WHERE style_id=public.erp_assembly_style(p_job_ref) GROUP BY lower(trim(component_name))
$$;
CREATE OR REPLACE FUNCTION public.erp_pending_components(p_job_ref text DEFAULT NULL)
RETURNS TABLE(id text,"jobCardRef" text,"component" text,"size" text,"colour" text,"finishedQty" bigint,"pendingQty" bigint,"styleName" text)
LANGUAGE sql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 WITH stocks AS (SELECT job_card_ref,lower(trim(component)) c,lower(trim(coalesce(size,''))) s,lower(trim(coalesce(colour,''))) col,min(component) component,min(coalesce(size,'')) size,min(coalesce(colour,'')) colour,sum(finished_qty)::bigint qty FROM finishing_stock WHERE finished_qty>0 AND (p_job_ref IS NULL OR job_card_ref=p_job_ref) GROUP BY 1,2,3,4),
 used AS (SELECT coalesce(i.source_job_card_ref,v.job_card_ref) ref,lower(trim(i.component)) c,lower(trim(coalesce(i.size,''))) s,lower(trim(coalesce(i.colour,''))) col,sum(i.qty_used)::bigint qty FROM component_assembly_items i JOIN component_assembly_vouchers v ON v.id=i.assembly_voucher_id GROUP BY 1,2,3,4)
 SELECT md5(jsonb_build_array(f.job_card_ref,f.c,f.s,f.col)::text),f.job_card_ref,f.component,f.size,f.colour,f.qty,f.qty-coalesce(u.qty,0),j.style_en FROM stocks f LEFT JOIN used u ON (u.ref,u.c,u.s,u.col)=(f.job_card_ref,f.c,f.s,f.col) LEFT JOIN job_cards j ON j.job_card_no=f.job_card_ref WHERE f.qty>coalesce(u.qty,0)
$$;
REVOKE ALL ON FUNCTION public.erp_assembly_style(text),public.erp_assembly_composition(text),public.erp_pending_components(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_assembly_style(text),public.erp_assembly_composition(text),public.erp_pending_components(text) TO authenticated;
-- Materialize only receipt lines that have never posted their component stock.
INSERT INTO finishing_stock(job_card_ref,stitch_receive_ref,component,size,colour,stitch_received_qty,finished_qty,pending_qty,source_contractor_receive_item_id)
SELECT v.job_card_ref,'CRV:'||v.voucher_no||':'||i.id,i.item,coalesce(i.size,''),coalesce(i.colour,''),i.received_today,i.received_today,0,i.id FROM contractor_receive_items i JOIN contractor_receive_vouchers v ON v.id=i.receive_voucher_id
WHERE i.received_today>0 AND NOT EXISTS(SELECT 1 FROM finishing_stock f WHERE f.source_contractor_receive_item_id=i.id OR f.stitch_receive_ref='CRV:'||v.voucher_no||':'||i.id);
CREATE OR REPLACE FUNCTION public.save_original_component_assembly(p_id uuid,p_header jsonb,p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v_style_id uuid; jc public.job_cards; v public.component_assembly_vouchers; c record; x jsonb; required integer; used numeric; sets numeric; candidate numeric; available numeric; consumed numeric; n integer; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)=0 OR coalesce(trim(p_header->>'finalItemName'),'')='' THEN RAISE EXCEPTION 'Job card, final item and component quantities are required';END IF;
 -- Shared lock order for all assembly writes prevents competing reservations.
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE finishing_stock IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO v FROM component_assembly_vouchers WHERE id=p_id;
 IF FOUND THEN
  IF v.request_payload IS DISTINCT FROM jsonb_build_object('header',p_header,'items',p_items) THEN RAISE EXCEPTION 'Assembly request already saved with different details';END IF;
  SELECT to_jsonb(v)||jsonb_build_object('component_assembly_items',coalesce(jsonb_agg(i),'[]'::jsonb)) INTO result FROM component_assembly_items i WHERE assembly_voucher_id=v.id;
  RETURN result;
 END IF;
 SELECT * INTO STRICT jc FROM job_cards WHERE job_card_no=p_header->>'jobCardRef';
 v_style_id=public.erp_assembly_style(jc.job_card_no);
 SELECT count(*) INTO required FROM item_compositions ic WHERE ic.style_id=v_style_id;
 IF required=0 THEN RAISE EXCEPTION 'Define Item Master sub-components before assembly';END IF;
 IF EXISTS(SELECT 1 FROM item_compositions ic WHERE ic.style_id=v_style_id AND (qty_per_set IS NULL OR qty_per_set<=0)) THEN RAISE EXCEPTION 'Invalid Item Master qty per set';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  used=(x->>'qtyUsed')::numeric;
  IF used IS NULL OR used<=0 OR used<>trunc(used) THEN RAISE EXCEPTION 'Component quantity must be a positive whole number';END IF;
  IF lower(trim(coalesce(x->>'size','')))<>lower(trim(coalesce(p_header->>'size',''))) OR lower(trim(coalesce(x->>'colour','')))<>lower(trim(coalesce(p_header->>'colour',''))) THEN RAISE EXCEPTION 'Assemble one size and colour per voucher';END IF;
  IF NOT EXISTS(SELECT 1 FROM item_compositions ic WHERE ic.style_id=v_style_id AND lower(trim(component_name))=lower(trim(x->>'component'))) THEN RAISE EXCEPTION 'Component is not in Item Master composition';END IF;
 END LOOP;
 FOR c IN SELECT lower(trim(component_name)) key,min(component_name) name,sum(qty_per_set) ratio FROM item_compositions ic WHERE ic.style_id=v_style_id GROUP BY lower(trim(component_name)) LOOP
  SELECT coalesce(sum((i->>'qtyUsed')::numeric),0) INTO used FROM jsonb_array_elements(p_items) i WHERE lower(trim(i->>'component'))=c.key;
  candidate=used/c.ratio;
  IF candidate<=0 OR candidate<>trunc(candidate) OR (sets IS NOT NULL AND candidate<>sets) THEN RAISE EXCEPTION 'Incomplete set: supply every component in its qty-per-set ratio';END IF;
  sets=candidate;
  SELECT coalesce(sum(finished_qty),0) INTO available FROM finishing_stock WHERE job_card_ref=jc.job_card_no AND lower(trim(component))=c.key AND lower(trim(coalesce(size,'')))=lower(trim(coalesce(p_header->>'size',''))) AND lower(trim(coalesce(colour,'')))=lower(trim(coalesce(p_header->>'colour','')));
  SELECT coalesce(sum(i.qty_used),0) INTO consumed FROM component_assembly_items i JOIN component_assembly_vouchers a ON a.id=i.assembly_voucher_id WHERE coalesce(i.source_job_card_ref,a.job_card_ref)=jc.job_card_no AND lower(trim(i.component))=c.key AND lower(trim(coalesce(i.size,'')))=lower(trim(coalesce(p_header->>'size',''))) AND lower(trim(coalesce(i.colour,'')))=lower(trim(coalesce(p_header->>'colour','')));
  IF used>available-consumed THEN RAISE EXCEPTION 'Insufficient unassembled finished stock for %',c.name;END IF;
 END LOOP;
 SELECT coalesce(max(substring(voucher_no FROM '^CAV-([0-9]+)$')::integer),0)+1 INTO n FROM component_assembly_vouchers;
 INSERT INTO component_assembly_vouchers(id,voucher_no,voucher_date,job_card_ref,job_card_id,style_name,party_name,final_item_name,colour,size,total_sets_assembled,total_components_used,remarks,created_by,updated_by)
 VALUES(p_id,'CAV-'||lpad(n::text,greatest(4,length(n::text)),'0'),(p_header->>'voucherDate')::date,jc.job_card_no,jc.id,jc.style_en,jc.party_name,p_header->>'finalItemName',p_header->>'colour',p_header->>'size',sets,(SELECT sum((i->>'qtyUsed')::integer) FROM jsonb_array_elements(p_items)i),p_header->>'remarks',p_header->>'createdBy',p_header->>'createdBy') RETURNING * INTO v;
 UPDATE component_assembly_vouchers SET request_payload=jsonb_build_object('header',p_header,'items',p_items) WHERE id=p_id;
 INSERT INTO component_assembly_items(assembly_voucher_id,component,size,colour,available_finished_qty,qty_used,source_job_card_ref)
 SELECT p_id,i->>'component',i->>'size',i->>'colour',(i->>'availableFinishedQty')::integer,(i->>'qtyUsed')::integer,jc.job_card_no FROM jsonb_array_elements(p_items)i;
 INSERT INTO finished_goods(job_card_ref,style_name,party_name,item,colour,size,total_pieces,available_for_dispatch,dispatched_pieces,source,source_voucher_no,source_voucher_id,date_added,status,created_by)
 VALUES(jc.job_card_no,jc.style_en,jc.party_name,v.final_item_name,v.colour,v.size,sets,sets,0,'component_assembly',v.voucher_no,p_id,v.voucher_date,'available',p_header->>'createdBy');
 SELECT to_jsonb(v)||jsonb_build_object('component_assembly_items',coalesce(jsonb_agg(i),'[]'::jsonb)) INTO result FROM component_assembly_items i WHERE assembly_voucher_id=p_id;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.delete_original_component_assembly(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE dispatch_vouchers IN SHARE ROW EXCLUSIVE MODE;
 PERFORM 1 FROM finished_goods WHERE source_voucher_id=p_id AND source IN ('component_assembly','component_conversion') FOR UPDATE;
 IF EXISTS(SELECT 1 FROM finished_goods f WHERE f.source_voucher_id=p_id AND (coalesce(f.dispatched_pieces,0)>0 OR EXISTS(SELECT 1 FROM dispatch_vouchers d WHERE d.finished_goods_id=f.id))) THEN RAISE EXCEPTION 'Cannot delete an assembly with dispatch history';END IF;
 DELETE FROM finished_goods WHERE source_voucher_id=p_id AND source IN ('component_assembly','component_conversion');
 DELETE FROM component_assembly_items WHERE assembly_voucher_id=p_id;
 DELETE FROM component_assembly_vouchers WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Assembly missing or delete denied';END IF;
END $$;
REVOKE ALL ON FUNCTION public.save_original_component_assembly(uuid,jsonb,jsonb), public.delete_original_component_assembly(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_original_component_assembly(uuid,jsonb,jsonb), public.delete_original_component_assembly(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.convert_original_component_to_item(p_id uuid,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE jc public.job_cards; prior public.component_assembly_vouchers; available bigint; quantity numeric; n integer; new_item jsonb; sid uuid; vid uuid; code text; name text; target_colour text; rows jsonb; selected_component jsonb; ratio numeric; used numeric; source_ref text; composition jsonb; total_used bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 quantity=(p_request->>'quantity')::numeric;
 code=nullif(trim(p_request->>'itemCode'),'');name=nullif(trim(p_request->>'itemName'),'');target_colour=nullif(trim(p_request->>'targetColour'),'');
 IF p_id IS NULL OR quantity IS NULL OR quantity<=0 OR quantity<>trunc(quantity) OR code IS NULL OR name IS NULL OR target_colour IS NULL OR nullif(p_request->>'date','') IS NULL THEN RAISE EXCEPTION 'New item name, unique code, colour, date and positive whole quantity are required';END IF;
 rows=p_request->'components';
 IF rows IS NULL THEN rows=jsonb_build_array(jsonb_build_object('jobCardRef',p_request->>'jobCardRef','component',p_request->>'component','size',p_request->>'size','colour',p_request->>'sourceColour','qtyPerItem',1));END IF;
 IF jsonb_typeof(rows)<>'array' OR jsonb_array_length(rows)=0 THEN RAISE EXCEPTION 'Select at least one available sub-component';END IF;
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE finishing_stock IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO prior FROM component_assembly_vouchers WHERE id=p_id;
 IF FOUND THEN
  IF prior.assembly_kind<>'component_conversion' OR prior.request_payload IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Conversion request already saved with different details';END IF;
  RETURN jsonb_build_object('voucher_id',prior.id,'voucher_no',prior.voucher_no,'style_id',prior.new_item_style_id,'variant_id',prior.new_item_variant_id,'quantity',prior.total_sets_assembled);
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(rows) x GROUP BY x->>'jobCardRef',lower(trim(x->>'component')),lower(trim(coalesce(x->>'size',''))),lower(trim(coalesce(x->>'colour',''))) HAVING count(*)>1) THEN RAISE EXCEPTION 'Select each source component once';END IF;
 total_used=0;
 FOR selected_component IN SELECT value FROM jsonb_array_elements(rows) LOOP
  ratio=(selected_component->>'qtyPerItem')::numeric;
  IF ratio IS NULL OR ratio<=0 OR ratio<>trunc(ratio) THEN RAISE EXCEPTION 'Quantity per ready item must be a positive whole number';END IF;
  used=ratio*quantity;
  SELECT "pendingQty" INTO available FROM public.erp_pending_components(selected_component->>'jobCardRef') f WHERE lower(trim(f.component))=lower(trim(selected_component->>'component')) AND lower(trim(f.size))=lower(trim(coalesce(selected_component->>'size',''))) AND lower(trim(f.colour))=lower(trim(coalesce(selected_component->>'colour','')));
  IF available IS NULL OR used>available THEN RAISE EXCEPTION 'Conversion exceeds remaining unassembled component stock';END IF;
  total_used=total_used+used;
 END LOOP;
 SELECT * INTO STRICT jc FROM job_cards WHERE job_card_no=rows->0->>'jobCardRef';
 SELECT jsonb_agg(jsonb_build_object('component_name',c.component,'qty_per_set',c.ratio,'unit','Pcs','sort_order',0)) INTO composition FROM (SELECT min(x->>'component') component,sum((x->>'qtyPerItem')::integer) ratio FROM jsonb_array_elements(rows)x GROUP BY lower(trim(x->>'component'))) c;
 LOCK TABLE item_styles IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM item_styles WHERE lower(trim(job_card_no))=lower(code) OR lower(trim(style_no))=lower(code)) THEN RAISE EXCEPTION 'New item code already exists; use a different code';END IF;
 new_item=public.create_original_item(p_id,jsonb_build_object('job_card_no',code,'design_code',code,'style_no',code,'set_type',CASE WHEN total_used/quantity<=3 THEN (total_used/quantity)::integer::text||'PC' ELSE 'CUSTOM' END,'import_key','conversion-style:'||p_id,'_compositions',composition),jsonb_build_array(jsonb_build_object('colour',target_colour,'style_no',code,'set_type',CASE WHEN total_used/quantity<=3 THEN (total_used/quantity)::integer::text||'PC' ELSE 'CUSTOM' END,'import_key','conversion-variant:'||p_id,'_details','[]'::jsonb)));

 sid=(new_item->>'style_id')::uuid;vid=(new_item->'variant_ids'->>0)::uuid;
 UPDATE item_styles SET item_name=name WHERE id=sid;
 IF NOT FOUND THEN RAISE EXCEPTION 'New item name update denied';END IF;
 SELECT coalesce(max(substring(voucher_no FROM '^CCV-([0-9]+)$')::integer),0)+1 INTO n FROM component_assembly_vouchers;
 INSERT INTO component_assembly_vouchers(id,voucher_no,voucher_date,job_card_ref,job_card_id,style_name,party_name,final_item_name,colour,size,total_sets_assembled,total_components_used,remarks,created_by,updated_by,request_payload,assembly_kind,new_item_style_id,new_item_variant_id)
 VALUES(p_id,'CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),(p_request->>'date')::date,jc.job_card_no,jc.id,code,jc.party_name,name,target_colour,p_request->>'size',quantity,total_used,p_request->>'remarks',p_request->>'createdBy',p_request->>'createdBy',p_request,'component_conversion',sid,vid);
 INSERT INTO component_assembly_items(assembly_voucher_id,component,size,colour,available_finished_qty,qty_used,source_job_card_ref)
 SELECT p_id,x->>'component',coalesce(x->>'size',''),coalesce(x->>'colour',''),(SELECT f."pendingQty" FROM public.erp_pending_components(x->>'jobCardRef') f WHERE lower(trim(f.component))=lower(trim(x->>'component')) AND lower(trim(f.size))=lower(trim(coalesce(x->>'size',''))) AND lower(trim(f.colour))=lower(trim(coalesce(x->>'colour','')))),(x->>'qtyPerItem')::integer*quantity,x->>'jobCardRef' FROM jsonb_array_elements(rows)x;
 INSERT INTO finished_goods(job_card_ref,style_name,party_name,item,colour,size,total_pieces,available_for_dispatch,dispatched_pieces,source,source_voucher_no,source_voucher_id,date_added,status,created_by,item_style_id,item_variant_id)
 VALUES(jc.job_card_no,code,jc.party_name,name,target_colour,p_request->>'size',quantity,quantity,0,'component_conversion','CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),p_id,(p_request->>'date')::date,'available',p_request->>'createdBy',sid,vid);
 RETURN jsonb_build_object('voucher_id',p_id,'voucher_no','CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),'style_id',sid,'variant_id',vid,'quantity',quantity);
END $$;
REVOKE ALL ON FUNCTION public.convert_original_component_to_item(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_original_component_to_item(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_original_assembled_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE available numeric; consumed numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(OLD.job_card_ref,42));
 SELECT coalesce(sum(finished_qty),0) INTO available FROM finishing_stock WHERE id<>OLD.id AND job_card_ref=OLD.job_card_ref AND lower(trim(component))=lower(trim(OLD.component)) AND lower(trim(coalesce(size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(colour,'')))=lower(trim(coalesce(OLD.colour,'')));
 IF TG_OP='UPDATE' AND NEW.job_card_ref=OLD.job_card_ref AND lower(trim(NEW.component))=lower(trim(OLD.component)) AND lower(trim(coalesce(NEW.size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(NEW.colour,'')))=lower(trim(coalesce(OLD.colour,''))) THEN available=available+NEW.finished_qty;END IF;
 SELECT coalesce(sum(i.qty_used),0) INTO consumed FROM component_assembly_items i JOIN component_assembly_vouchers v ON v.id=i.assembly_voucher_id WHERE coalesce(i.source_job_card_ref,v.job_card_ref)=OLD.job_card_ref AND lower(trim(i.component))=lower(trim(OLD.component)) AND lower(trim(coalesce(i.size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(i.colour,'')))=lower(trim(coalesce(OLD.colour,'')));
 IF available<consumed THEN RAISE EXCEPTION 'This component stock has already been assembled; reverse the undispatched assembly first';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;

NOTIFY pgrst,'reload schema';

-- 20260910182000_contractor_receive_atomic.sql
ALTER TABLE contractor_receive_vouchers ADD COLUMN IF NOT EXISTS request_payload jsonb;
CREATE OR REPLACE FUNCTION public.erp_save_contractor_receive(p_id uuid,p_header jsonb,p_items jsonb,p_edit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.contractor_receive_vouchers; source public.contractor_issue_items; parent public.contractor_issue_vouchers; line jsonb; oldline record; quantity numeric; total integer=0; result jsonb; target uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF p_id IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items)=0 THEN RAISE EXCEPTION 'Receive at least one sub-component';END IF;
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE finishing_stock IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE contractor_receive_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE contractor_issue_items IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO v FROM contractor_receive_vouchers WHERE id=p_id OR (NOT p_edit AND voucher_no=p_header->>'voucherNo');
 IF FOUND AND NOT p_edit THEN
  IF v.request_payload IS DISTINCT FROM jsonb_build_object('header',p_header,'items',p_items) THEN RAISE EXCEPTION 'This receive voucher number already exists with different details';END IF;
  SELECT to_jsonb(v)||jsonb_build_object('contractor_receive_items',coalesce(jsonb_agg(i),'[]'::jsonb)) INTO result FROM contractor_receive_items i WHERE receive_voucher_id=v.id;RETURN result;
 END IF;
 IF p_edit THEN
  IF v.id IS NULL THEN RAISE EXCEPTION 'Receive voucher not found';END IF;
  FOR oldline IN SELECT * FROM contractor_receive_items WHERE receive_voucher_id=p_id LOOP
   UPDATE contractor_issue_items SET received_qty=received_qty-oldline.received_today,balance_qty=issued_qty-(received_qty-oldline.received_today),updated_at=now() WHERE id=oldline.issue_item_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Issue balance update denied';END IF;
  END LOOP;
  DELETE FROM contractor_receive_items WHERE receive_voucher_id=p_id;
  UPDATE contractor_receive_vouchers SET voucher_date=(p_header->>'voucherDate')::date,contractor_name=p_header->>'contractorName',job_card_ref=p_header->>'jobCardRef',remarks=p_header->>'remarks',updated_by=auth.uid()::text,updated_at=now() WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receive update denied';END IF;
 ELSE
  INSERT INTO contractor_receive_vouchers(id,voucher_no,voucher_date,contractor_name,job_card_ref,total_received,remarks,created_by,updated_by)
  VALUES(p_id,p_header->>'voucherNo',(p_header->>'voucherDate')::date,p_header->>'contractorName',p_header->>'jobCardRef',0,p_header->>'remarks',auth.uid()::text,auth.uid()::text);
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items)i GROUP BY i->>'issueItemId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate source component';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  quantity=(line->>'receivedToday')::numeric;
  IF quantity IS NULL OR quantity<=0 OR quantity<>trunc(quantity) THEN RAISE EXCEPTION 'Receive quantity must be a positive whole number';END IF;
  SELECT * INTO STRICT source FROM contractor_issue_items WHERE id=(line->>'issueItemId')::uuid FOR UPDATE;
  SELECT * INTO STRICT parent FROM contractor_issue_vouchers WHERE id=source.issue_voucher_id;
  IF parent.job_card_ref IS DISTINCT FROM p_header->>'jobCardRef' OR parent.contractor_name IS DISTINCT FROM p_header->>'contractorName' THEN RAISE EXCEPTION 'Source belongs to a different contractor or Job Card';END IF;
  IF quantity>source.issued_qty-coalesce(source.received_qty,0) THEN RAISE EXCEPTION 'Receive exceeds pending quantity';END IF;
  INSERT INTO contractor_receive_items(receive_voucher_id,issue_item_id,item,colour,size,issued_qty,already_received,balance_before,received_today)
  VALUES(p_id,source.id,source.item,source.colour,source.size,source.issued_qty,coalesce(source.received_qty,0),source.issued_qty-coalesce(source.received_qty,0),quantity);
  UPDATE contractor_issue_items SET received_qty=coalesce(received_qty,0)+quantity,balance_qty=issued_qty-(coalesce(received_qty,0)+quantity),updated_at=now() WHERE id=source.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue balance update denied';END IF;
  total=total+quantity;
 END LOOP;
 UPDATE contractor_receive_vouchers SET total_received=total,request_payload=jsonb_build_object('header',p_header,'items',p_items) WHERE id=p_id RETURNING * INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receive update denied';END IF;
 SELECT to_jsonb(v)||jsonb_build_object('contractor_receive_items',coalesce(jsonb_agg(i),'[]'::jsonb)) INTO result FROM contractor_receive_items i WHERE receive_voucher_id=p_id;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.erp_delete_contractor_receive(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE line record;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE finishing_stock IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE contractor_receive_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE contractor_issue_items IN SHARE ROW EXCLUSIVE MODE;
 FOR line IN SELECT * FROM contractor_receive_items WHERE receive_voucher_id=p_id LOOP
  UPDATE contractor_issue_items SET received_qty=received_qty-line.received_today,balance_qty=issued_qty-(received_qty-line.received_today),updated_at=now() WHERE id=line.issue_item_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Issue balance update denied';END IF;
 END LOOP;
 DELETE FROM contractor_receive_items WHERE receive_voucher_id=p_id;
 DELETE FROM contractor_receive_vouchers WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receive voucher missing or access denied';END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_save_contractor_receive(uuid,jsonb,jsonb,boolean),public.erp_delete_contractor_receive(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_save_contractor_receive(uuid,jsonb,jsonb,boolean),public.erp_delete_contractor_receive(uuid) TO authenticated;

-- 20260910183000_dispatch_ready_only.sql
ALTER TABLE dispatch_vouchers ADD COLUMN IF NOT EXISTS reference_po text;
ALTER TABLE dispatch_vouchers ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE dispatch_vouchers ADD COLUMN IF NOT EXISTS cancelled_by uuid;
ALTER TABLE dispatch_vouchers ADD COLUMN IF NOT EXISTS cancel_reason text;
CREATE OR REPLACE FUNCTION public.save_original_dispatch(p_id uuid,p_voucher jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.dispatch_vouchers; prior public.dispatch_vouchers; fg public.finished_goods; n integer;remaining integer;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 SELECT * INTO v FROM jsonb_populate_record(NULL::public.dispatch_vouchers,p_voucher);
 IF p_id IS NULL OR v.dispatched_pieces IS NULL OR v.dispatched_pieces<=0 OR coalesce(v.party_name,'')='' OR v.dispatch_date IS NULL THEN RAISE EXCEPTION 'Party, date and a positive dispatch quantity are required';END IF;
 LOCK TABLE public.dispatch_vouchers IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO prior FROM dispatch_vouchers WHERE id=p_id;
 IF FOUND THEN
  IF (to_jsonb(prior)-'id'-'dispatch_no'-'created_at'-'updated_at'-'cancelled_at'-'cancelled_by'-'cancel_reason') IS DISTINCT FROM (to_jsonb(v)-'id'-'dispatch_no'-'created_at'-'updated_at'-'cancelled_at'-'cancelled_by'-'cancel_reason') THEN RAISE EXCEPTION 'Pending dispatch has different details';END IF;
  RETURN to_jsonb(prior);
 END IF;
 IF v.status IS DISTINCT FROM 'dispatched' THEN RAISE EXCEPTION 'Invalid dispatch status';END IF;
 IF v.finished_goods_id IS NULL THEN RAISE EXCEPTION 'Select an assembled ready item before dispatch';END IF;
 IF v.finished_goods_id IS NOT NULL THEN
  SELECT * INTO STRICT fg FROM finished_goods WHERE id=v.finished_goods_id FOR UPDATE;
  IF coalesce(fg.source,'') NOT IN ('component_assembly','component_conversion') THEN RAISE EXCEPTION 'Only consolidated ready items can be dispatched';END IF;
  IF v.dispatched_pieces>coalesce(fg.available_for_dispatch,0) THEN RAISE EXCEPTION 'Dispatch quantity exceeds available finished goods';END IF;
  IF coalesce(v.job_card_ref,'')<>'' AND v.job_card_ref IS DISTINCT FROM fg.job_card_ref THEN RAISE EXCEPTION 'Finished goods belong to another job card';END IF;
  IF v.item_name IS DISTINCT FROM fg.item OR coalesce(v.colour,'') IS DISTINCT FROM coalesce(fg.colour,'') OR coalesce(v.size,'') IS DISTINCT FROM coalesce(fg.size,'') THEN RAISE EXCEPTION 'Ready item details have changed. Select the item again.';END IF;
  remaining=fg.available_for_dispatch-v.dispatched_pieces;
  UPDATE finished_goods SET dispatched_pieces=coalesce(fg.dispatched_pieces,0)+v.dispatched_pieces,available_for_dispatch=remaining,status=CASE WHEN remaining=0 THEN 'dispatched' WHEN remaining<fg.total_pieces THEN 'partial' ELSE 'available' END,updated_at=now()WHERE id=v.finished_goods_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finished goods update denied';END IF;
 END IF;
 SELECT coalesce(max(substring(dispatch_no FROM '^DISP-([0-9]+)$')::integer),0)+1 INTO n FROM dispatch_vouchers;
 INSERT INTO dispatch_vouchers(id,dispatch_no,dispatch_date,party_name,job_card_ref,style_name,finished_goods_id,item_name,colour,size,ordered_pieces,dispatched_pieces,vehicle_no,driver_name,invoice_no,remarks,status,created_by,reference_po)
 VALUES(p_id,'DISP-'||lpad(n::text,greatest(4,length(n::text)),'0'),v.dispatch_date,v.party_name,v.job_card_ref,v.style_name,v.finished_goods_id,v.item_name,v.colour,v.size,v.ordered_pieces,v.dispatched_pieces,v.vehicle_no,v.driver_name,v.invoice_no,v.remarks,v.status,v.created_by,v.reference_po);
 SELECT * INTO prior FROM dispatch_vouchers WHERE id=p_id;
 RETURN to_jsonb(prior);
END $$;
REVOKE ALL ON FUNCTION public.save_original_dispatch(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_original_dispatch(uuid,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.erp_cancel_dispatch(p_id uuid,p_reason text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.dispatch_vouchers;
BEGIN
 IF NOT public.erp_can('dispatch','delete') THEN RAISE EXCEPTION 'Dispatch cancellation permission required';END IF;
 IF nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Enter a cancellation reason';END IF;
 LOCK TABLE dispatch_vouchers IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO STRICT v FROM dispatch_vouchers WHERE id=p_id FOR UPDATE;
 IF v.status='cancelled' THEN RETURN;END IF;
 PERFORM 1 FROM finished_goods WHERE id=v.finished_goods_id FOR UPDATE;
 UPDATE finished_goods SET dispatched_pieces=dispatched_pieces-v.dispatched_pieces,available_for_dispatch=available_for_dispatch+v.dispatched_pieces,status=CASE WHEN dispatched_pieces-v.dispatched_pieces=0 THEN 'available' ELSE 'partial' END,updated_at=now() WHERE id=v.finished_goods_id AND dispatched_pieces>=v.dispatched_pieces;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cannot restore ready stock. Review its balance.';END IF;
 UPDATE dispatch_vouchers SET status='cancelled',cancel_reason=trim(p_reason),cancelled_by=auth.uid(),cancelled_at=now(),updated_at=now() WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cancellation denied';END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_cancel_dispatch(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_cancel_dispatch(uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';

-- 20260910184000_assembly_item_link.sql
CREATE OR REPLACE FUNCTION public.erp_link_assembly_item(p_job_ref text,p_style_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT (public.erp_can('contractor','create') OR public.erp_can('jobs','edit')) THEN RAISE EXCEPTION 'Item-link permission required';END IF;
 LOCK TABLE public.component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.component_assembly_vouchers WHERE job_card_ref=p_job_ref AND assembly_kind='set_assembly') THEN RAISE EXCEPTION 'An assembled item link cannot be changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.item_styles WHERE id=p_style_id) THEN RAISE EXCEPTION 'Select an existing Item Master style';END IF;
 UPDATE public.job_cards SET item_style_id=p_style_id WHERE job_card_no=p_job_ref;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found';END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_link_assembly_item(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_link_assembly_item(text,uuid) TO authenticated;

-- 20260910185000_module_rls.sql
CREATE OR REPLACE FUNCTION public.erp_table_allowed(p_table text,p_action text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE modules jsonb; m text;
BEGIN
 IF public.erp_can('users','view') THEN RETURN true;END IF;
 IF p_action='view' THEN modules=('{"item_styles": ["items", "jobs", "sales", "cutting", "embroidery", "handwork", "contractor", "finishing"], "item_variants": ["items", "jobs", "sales", "cutting", "embroidery", "handwork", "contractor", "finishing"], "item_detail_lines": ["items", "jobs", "sales", "cutting", "embroidery", "handwork", "contractor", "finishing"], "item_compositions": ["items", "jobs", "sales", "cutting", "embroidery", "handwork", "contractor", "finishing"], "item_manual_save_requests": ["items"], "import_batches": ["items"], "import_audit_log": ["items"], "accounts": ["accounts", "sales", "grey", "dyeing", "stitching", "contractor", "dispatch", "ledger"], "stitch_operators": ["operators", "stitching"], "sales_orders": ["sales"], "sales_order_items": ["sales"], "job_cards": ["jobs", "sales", "cutting", "embroidery", "handwork", "stitching", "qc", "contractor", "finishing", "ready", "dispatch"], "job_card_workflow_statuses": ["jobs"], "production_batches": ["jobs"], "grey_fabric_purchases": ["grey"], "printer_fabric_issues": ["dyeing", "grey", "fabric", "ledger"], "printer_fabric_receipts": ["dyeing", "grey", "fabric", "ledger"], "dyeing_processing_entries": ["dyeing", "grey", "fabric", "ledger"], "fabric_inventory": ["fabric", "cutting", "embroidery", "handwork", "dyeing", "grey"], "cutting_entries": ["cutting", "stitching", "embroidery", "handwork"], "cutting_masters": ["cutting", "stitching", "embroidery", "handwork"], "cutting_movement_history": ["cutting", "stitching", "embroidery", "handwork"], "cutting_stock": ["cutting", "stitching", "embroidery", "handwork"], "cutting_sub_components": ["cutting", "stitching", "embroidery", "handwork"], "emb_issue_vouchers": ["embroidery", "handwork"], "emb_receive_vouchers": ["embroidery", "handwork"], "emb_cutting_entries": ["embroidery", "handwork"], "embroidery_accessory_entries": ["embroidery", "handwork"], "embroidery_fabric_issues": ["embroidery", "handwork"], "stitch_issue_vouchers": ["stitching", "operators", "qc", "contractor", "finishing"], "stitch_issue_components": ["stitching", "operators", "qc", "contractor", "finishing"], "stitch_receive_vouchers": ["stitching", "operators", "qc", "contractor", "finishing"], "stitch_receive_components": ["stitching", "operators", "qc", "contractor", "finishing"], "stitching_entries": ["stitching", "operators", "qc", "contractor", "finishing"], "qc_entries": ["qc", "finishing"], "qc_sub_components": ["qc", "finishing"], "contractor_issue_vouchers": ["contractor"], "contractor_issue_items": ["contractor"], "contractor_receive_vouchers": ["contractor"], "contractor_receive_items": ["contractor"], "component_assembly_vouchers": ["contractor", "contractor", "finishing"], "component_assembly_items": ["contractor", "contractor", "finishing"], "finishing_stock": ["finishing", "contractor", "finishing"], "finishing_entries": ["finishing"], "finishing_receive_vouchers": ["finishing"], "finishing_receive_components": ["finishing"], "finished_goods": ["ready", "contractor", "dispatch"], "stitch_audit_trail": ["audit"], "dispatch_vouchers": ["dispatch"]}'::jsonb)->p_table;
 ELSE modules=('{"item_styles": ["items", "contractor"], "item_variants": ["items", "contractor"], "item_detail_lines": ["items", "contractor"], "item_compositions": ["items", "contractor"], "item_manual_save_requests": ["items", "contractor"], "import_batches": ["items"], "import_audit_log": ["items"], "accounts": ["accounts"], "stitch_operators": ["operators"], "sales_orders": ["sales"], "sales_order_items": ["sales"], "job_cards": ["jobs"], "job_card_workflow_statuses": ["jobs"], "production_batches": ["jobs"], "grey_fabric_purchases": ["grey"], "printer_fabric_issues": ["dyeing", "grey"], "printer_fabric_receipts": ["dyeing", "grey"], "dyeing_processing_entries": ["dyeing", "grey"], "fabric_inventory": ["fabric", "grey", "dyeing", "cutting", "embroidery", "handwork"], "cutting_entries": ["cutting"], "cutting_masters": ["cutting"], "cutting_movement_history": ["cutting", "stitching", "embroidery", "handwork"], "cutting_stock": ["cutting", "stitching", "embroidery", "handwork"], "cutting_sub_components": ["cutting"], "emb_issue_vouchers": ["embroidery", "handwork"], "emb_receive_vouchers": ["embroidery", "handwork"], "emb_cutting_entries": ["embroidery", "handwork"], "embroidery_accessory_entries": ["embroidery", "handwork"], "embroidery_fabric_issues": ["embroidery", "handwork"], "stitch_issue_vouchers": ["stitching"], "stitch_issue_components": ["stitching"], "stitch_receive_vouchers": ["stitching"], "stitch_receive_components": ["stitching"], "stitching_entries": ["stitching"], "qc_entries": ["qc"], "qc_sub_components": ["qc"], "contractor_issue_vouchers": ["contractor"], "contractor_issue_items": ["contractor"], "contractor_receive_vouchers": ["contractor"], "contractor_receive_items": ["contractor"], "component_assembly_vouchers": ["contractor"], "component_assembly_items": ["contractor"], "finishing_stock": ["finishing", "contractor"], "finishing_entries": ["finishing"], "finishing_receive_vouchers": ["finishing"], "finishing_receive_components": ["finishing"], "finished_goods": ["ready", "contractor", "dispatch"], "stitch_audit_trail": ["audit"], "dispatch_vouchers": ["dispatch"]}'::jsonb)->p_table;END IF;

 FOR m IN SELECT jsonb_array_elements_text(coalesce(modules,'[]'::jsonb)) LOOP
  IF public.erp_can(m,p_action) THEN RETURN true;END IF;
 END LOOP;
 RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.erp_table_allowed(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_table_allowed(text,text) TO authenticated;
DO $$ DECLARE t record; existing boolean;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'erp_%' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  SELECT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t.tablename AND permissive='PERMISSIVE') INTO existing;
  IF NOT existing THEN EXECUTE format('CREATE POLICY erp_existing_base ON public.%I AS PERMISSIVE FOR ALL TO authenticated USING(auth.uid() IS NOT NULL) WITH CHECK(auth.uid() IS NOT NULL)',t.tablename);END IF;
  EXECUTE format('DROP POLICY IF EXISTS erp_module_select ON public.%I',t.tablename);
  EXECUTE format('DROP POLICY IF EXISTS erp_module_insert ON public.%I',t.tablename);
  EXECUTE format('DROP POLICY IF EXISTS erp_module_update ON public.%I',t.tablename);
  EXECUTE format('DROP POLICY IF EXISTS erp_module_delete ON public.%I',t.tablename);
  EXECUTE format('CREATE POLICY erp_module_select ON public.%I AS RESTRICTIVE FOR SELECT TO authenticated USING(public.erp_table_allowed(%L,''view''))',t.tablename,t.tablename);
  EXECUTE format('CREATE POLICY erp_module_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(public.erp_table_allowed(%L,''create''))',t.tablename,t.tablename);
  EXECUTE format('CREATE POLICY erp_module_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING(public.erp_table_allowed(%L,''edit'')) WITH CHECK(public.erp_table_allowed(%L,''edit''))',t.tablename,t.tablename,t.tablename);
  EXECUTE format('CREATE POLICY erp_module_delete ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING(public.erp_table_allowed(%L,''delete''))',t.tablename,t.tablename);
 END LOOP;
END $$;
-- Shared embroidery tables still enforce the process department per row.
DROP POLICY IF EXISTS erp_process_issue ON emb_issue_vouchers;
CREATE POLICY erp_process_issue ON emb_issue_vouchers AS RESTRICTIVE FOR ALL TO authenticated USING(public.erp_can(CASE WHEN process_type='handwork' THEN 'handwork' ELSE 'embroidery' END,'view')) WITH CHECK(public.erp_can(CASE WHEN process_type='handwork' THEN 'handwork' ELSE 'embroidery' END,'view'));
DROP POLICY IF EXISTS erp_process_receive ON emb_receive_vouchers;
CREATE POLICY erp_process_receive ON emb_receive_vouchers AS RESTRICTIVE FOR ALL TO authenticated USING(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id)) WITH CHECK(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id));

-- 20260910186000_transaction_authority.sql
-- Guard each transaction at its public boundary; internal stock writes stay atomic.
DO $$ DECLARE row record; definition text; guard text;
BEGIN
 FOR row IN SELECT * FROM (VALUES
 ('save_original_dispatch','dispatch', 'create'),
 ('erp_cancel_dispatch','dispatch','delete'),
 ('save_original_component_assembly','contractor','create'),
 ('convert_original_component_to_item','contractor','create'),
 ('delete_original_component_assembly','contractor','delete'),
 ('erp_save_contractor_receive','contractor','receive'),
 ('erp_delete_contractor_receive','contractor','delete'),
 ('save_original_sales_order','sales','upsert'),
 ('save_original_qc_entry','qc','upsert'),
 ('save_original_finishing_entry','finishing','finishing'),
 ('receive_printer_fabric_with_stock','dyeing','receipt'),
 ('create_original_item','items','newitem'),
 ('edit_original_item_variant','items','edit'),
 ('delete_original_item_variant','items','delete'),
 ('merge_original_item_styles','items','edit')
 ) AS x(name,module,action) LOOP
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=row.name;
  IF definition IS NULL THEN RAISE EXCEPTION 'Required transaction % is missing',row.name;END IF;
  guard=CASE row.action
   WHEN 'receive' THEN 'public.erp_can(''contractor'',CASE WHEN p_edit THEN ''edit'' ELSE ''create'' END)'
   WHEN 'upsert' THEN format('public.erp_can(%L,CASE WHEN p_id IS NULL THEN ''create'' ELSE ''edit'' END)',row.module)
   WHEN 'finishing' THEN 'public.erp_can(''finishing'',CASE WHEN EXISTS(SELECT 1 FROM finishing_entries WHERE id=(p_entry->>''id'')::uuid) THEN ''edit'' ELSE ''create'' END)'
   WHEN 'receipt' THEN '(public.erp_can(''dyeing'',''create'') OR public.erp_can(''grey'',''create''))'
   WHEN 'newitem' THEN '(public.erp_can(''items'',''create'') OR public.erp_can(''contractor'',''create''))'
   ELSE format('public.erp_can(%L,%L)',row.module,row.action) END;
  -- Do not stack guards when the migration is rerun.
  IF position('-- ERP module boundary' in definition)=0 THEN
   definition=regexp_replace(definition,'\mBEGIN\M','BEGIN -- ERP module boundary'||chr(10)||' IF NOT ('||guard||') THEN RAISE EXCEPTION ''Module action is not permitted'';END IF;');
  END IF;
  definition=replace(definition,'SECURITY INVOKER','SECURITY DEFINER');
  IF position('SECURITY DEFINER' in definition)=0 THEN definition=replace(definition,'LANGUAGE plpgsql','LANGUAGE plpgsql SECURITY DEFINER');END IF;
  EXECUTE definition;
 END LOOP;
END $$;
-- No direct API writes to consolidated stock or dispatch history. Use guarded transactions.
REVOKE INSERT,UPDATE,DELETE ON finished_goods,dispatch_vouchers,component_assembly_vouchers,component_assembly_items,contractor_receive_vouchers,contractor_receive_items FROM authenticated,anon;

-- 20260910187000_audit_and_process_rules.sql
CREATE TABLE IF NOT EXISTS public.erp_activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),performed_by text NOT NULL,actor_id uuid,action text NOT NULL,table_name text NOT NULL,record_id text);
ALTER TABLE erp_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_audit_read ON erp_activity_log;
CREATE POLICY erp_audit_read ON erp_activity_log FOR SELECT TO authenticated USING(public.erp_can('audit','view'));
GRANT SELECT ON erp_activity_log TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON erp_activity_log FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.erp_record_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rowdata jsonb; actor text;
BEGIN
 rowdata=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 SELECT email INTO actor FROM auth.users WHERE id=auth.uid();
 INSERT INTO public.erp_activity_log(performed_by,actor_id,action,table_name,record_id)VALUES(coalesce(actor,'Database maintenance'),auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(rowdata->>'id',rowdata->>'user_id'));
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_record_activity() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record; a text; command text; predicate text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'erp_activity_log' LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS erp_activity_capture ON public.%I',t.tablename);
  EXECUTE format('CREATE TRIGGER erp_activity_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.erp_record_activity()',t.tablename);
 END LOOP;
 FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
  command=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
  FOREACH predicate IN ARRAY ARRAY['emb_issue_vouchers','emb_receive_vouchers'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','erp_process_'||a,predicate);
   IF predicate='emb_issue_vouchers' THEN
    command=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s', 'erp_process_'||a,predicate,command,
     CASE WHEN a='create' THEN format('WITH CHECK(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a)
     WHEN a='edit' THEN format('USING(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)) WITH CHECK(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a,a)
     ELSE format('USING(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a) END);
   ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s','erp_process_'||a,predicate,command,
     CASE WHEN a='create' THEN format('WITH CHECK(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a)
     WHEN a='edit' THEN format('USING(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))) WITH CHECK(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a,a)
     ELSE format('USING(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a) END);
   END IF;
  END LOOP;
 END LOOP;
END $$;

SELECT public.erp_bootstrap_owner(current_setting('erp.owner_email'));
NOTIFY pgrst,'reload schema';
COMMIT;
