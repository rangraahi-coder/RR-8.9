BEGIN;
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
COMMIT;
