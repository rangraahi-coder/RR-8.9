BEGIN;
ALTER TABLE public.component_assembly_vouchers ADD COLUMN IF NOT EXISTS request_payload jsonb;
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
 SELECT id INTO STRICT v_style_id FROM item_styles WHERE job_card_no=jc.job_card_no;
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
  SELECT coalesce(sum(i.qty_used),0) INTO consumed FROM component_assembly_items i JOIN component_assembly_vouchers a ON a.id=i.assembly_voucher_id WHERE a.job_card_ref=jc.job_card_no AND lower(trim(i.component))=c.key AND lower(trim(coalesce(i.size,'')))=lower(trim(coalesce(p_header->>'size',''))) AND lower(trim(coalesce(i.colour,'')))=lower(trim(coalesce(p_header->>'colour','')));
  IF used>available-consumed THEN RAISE EXCEPTION 'Insufficient unassembled finished stock for %',c.name;END IF;
 END LOOP;
 SELECT coalesce(max(substring(voucher_no FROM '^CAV-([0-9]+)$')::integer),0)+1 INTO n FROM component_assembly_vouchers;
 INSERT INTO component_assembly_vouchers(id,voucher_no,voucher_date,job_card_ref,job_card_id,style_name,party_name,final_item_name,colour,size,total_sets_assembled,total_components_used,remarks,created_by,updated_by)
 VALUES(p_id,'CAV-'||lpad(n::text,greatest(4,length(n::text)),'0'),(p_header->>'voucherDate')::date,jc.job_card_no,jc.id,jc.style_en,jc.party_name,p_header->>'finalItemName',p_header->>'colour',p_header->>'size',sets,(SELECT sum((i->>'qtyUsed')::integer) FROM jsonb_array_elements(p_items)i),p_header->>'remarks',p_header->>'createdBy',p_header->>'createdBy') RETURNING * INTO v;
 UPDATE component_assembly_vouchers SET request_payload=jsonb_build_object('header',p_header,'items',p_items) WHERE id=p_id;
 INSERT INTO component_assembly_items(assembly_voucher_id,component,size,colour,available_finished_qty,qty_used)
 SELECT p_id,i->>'component',i->>'size',i->>'colour',(i->>'availableFinishedQty')::integer,(i->>'qtyUsed')::integer FROM jsonb_array_elements(p_items)i;
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
NOTIFY pgrst,'reload schema';
COMMIT;
