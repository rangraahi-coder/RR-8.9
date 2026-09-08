BEGIN;
ALTER TABLE item_styles ADD COLUMN IF NOT EXISTS item_name text;
ALTER TABLE component_assembly_vouchers ADD COLUMN IF NOT EXISTS assembly_kind text NOT NULL DEFAULT 'set_assembly';
ALTER TABLE component_assembly_vouchers ADD COLUMN IF NOT EXISTS new_item_style_id uuid REFERENCES item_styles(id) ON DELETE RESTRICT;
ALTER TABLE component_assembly_vouchers ADD COLUMN IF NOT EXISTS new_item_variant_id uuid REFERENCES item_variants(id) ON DELETE RESTRICT;
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS item_style_id uuid REFERENCES item_styles(id) ON DELETE RESTRICT;
ALTER TABLE finished_goods ADD COLUMN IF NOT EXISTS item_variant_id uuid REFERENCES item_variants(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.convert_original_component_to_item(p_id uuid,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE jc public.job_cards; prior public.component_assembly_vouchers; available integer; consumed integer; quantity numeric; n integer; new_item jsonb; sid uuid; vid uuid; code text; name text; target_colour text; result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 quantity=(p_request->>'quantity')::numeric;
 code=nullif(trim(p_request->>'itemCode'),'');name=nullif(trim(p_request->>'itemName'),'');target_colour=nullif(trim(p_request->>'targetColour'),'');
 IF p_id IS NULL OR quantity IS NULL OR quantity<=0 OR quantity<>trunc(quantity) OR code IS NULL OR name IS NULL OR target_colour IS NULL OR nullif(trim(p_request->>'component'),'') IS NULL OR nullif(p_request->>'date','') IS NULL THEN RAISE EXCEPTION 'New item name, unique code, colour, date and positive whole quantity are required';END IF;
 IF coalesce(trim(p_request->>'sourceColour'),'')<>'' AND lower(trim(p_request->>'sourceColour'))<>lower(target_colour) THEN RAISE EXCEPTION 'Existing component colour must be preserved';END IF;
 LOCK TABLE component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 LOCK TABLE finishing_stock IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO prior FROM component_assembly_vouchers WHERE id=p_id;
 IF FOUND THEN
  IF prior.assembly_kind<>'component_conversion' OR prior.request_payload IS DISTINCT FROM p_request THEN RAISE EXCEPTION 'Conversion request already saved with different details';END IF;
  RETURN jsonb_build_object('voucher_id',prior.id,'voucher_no',prior.voucher_no,'style_id',prior.new_item_style_id,'variant_id',prior.new_item_variant_id,'quantity',prior.total_sets_assembled);
 END IF;
 SELECT * INTO STRICT jc FROM job_cards WHERE job_card_no=p_request->>'jobCardRef';
 SELECT coalesce(sum(finished_qty),0) INTO available FROM finishing_stock WHERE job_card_ref=jc.job_card_no AND lower(trim(component))=lower(trim(p_request->>'component')) AND lower(trim(coalesce(size,'')))=lower(trim(coalesce(p_request->>'size',''))) AND lower(trim(coalesce(colour,'')))=lower(trim(coalesce(p_request->>'sourceColour','')));
 SELECT coalesce(sum(i.qty_used),0) INTO consumed FROM component_assembly_items i JOIN component_assembly_vouchers v ON v.id=i.assembly_voucher_id WHERE v.job_card_ref=jc.job_card_no AND lower(trim(i.component))=lower(trim(p_request->>'component')) AND lower(trim(coalesce(i.size,'')))=lower(trim(coalesce(p_request->>'size',''))) AND lower(trim(coalesce(i.colour,'')))=lower(trim(coalesce(p_request->>'sourceColour','')));
 IF quantity>available-consumed THEN RAISE EXCEPTION 'Conversion exceeds remaining unassembled component stock';END IF;
 LOCK TABLE item_styles IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM item_styles WHERE lower(trim(job_card_no))=lower(code) OR lower(trim(style_no))=lower(code)) THEN RAISE EXCEPTION 'New item code already exists; use a different code';END IF;
 new_item=public.create_original_item(p_id,jsonb_build_object('job_card_no',code,'design_code',code,'style_no',code,'set_type','1PC','import_key','conversion-style:'||p_id,'_compositions',jsonb_build_array(jsonb_build_object('component_name',p_request->>'component','qty_per_set',1,'unit','Pcs','sort_order',0))),jsonb_build_array(jsonb_build_object('colour',target_colour,'style_no',code,'set_type','1PC','import_key','conversion-variant:'||p_id,'_details','[]'::jsonb)));
 sid=(new_item->>'style_id')::uuid;vid=(new_item->'variant_ids'->>0)::uuid;
 UPDATE item_styles SET item_name=name WHERE id=sid;
 IF NOT FOUND THEN RAISE EXCEPTION 'New item name update denied';END IF;
 SELECT coalesce(max(substring(voucher_no FROM '^CCV-([0-9]+)$')::integer),0)+1 INTO n FROM component_assembly_vouchers;
 INSERT INTO component_assembly_vouchers(id,voucher_no,voucher_date,job_card_ref,job_card_id,style_name,party_name,final_item_name,colour,size,total_sets_assembled,total_components_used,remarks,created_by,updated_by,request_payload,assembly_kind,new_item_style_id,new_item_variant_id)
 VALUES(p_id,'CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),(p_request->>'date')::date,jc.job_card_no,jc.id,code,jc.party_name,name,target_colour,p_request->>'size',quantity,quantity,p_request->>'remarks',p_request->>'createdBy',p_request->>'createdBy',p_request,'component_conversion',sid,vid);
 INSERT INTO component_assembly_items(assembly_voucher_id,component,size,colour,available_finished_qty,qty_used)
 VALUES(p_id,p_request->>'component',p_request->>'size',p_request->>'sourceColour',available-consumed,quantity);
 INSERT INTO finished_goods(job_card_ref,style_name,party_name,item,colour,size,total_pieces,available_for_dispatch,dispatched_pieces,source,source_voucher_no,source_voucher_id,date_added,status,created_by,item_style_id,item_variant_id)
 VALUES(jc.job_card_no,code,jc.party_name,name,target_colour,p_request->>'size',quantity,quantity,0,'component_conversion','CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),p_id,(p_request->>'date')::date,'available',p_request->>'createdBy',sid,vid);
 RETURN jsonb_build_object('voucher_id',p_id,'voucher_no','CCV-'||lpad(n::text,greatest(4,length(n::text)),'0'),'style_id',sid,'variant_id',vid,'quantity',quantity);
END $$;
REVOKE ALL ON FUNCTION public.convert_original_component_to_item(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_original_component_to_item(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
