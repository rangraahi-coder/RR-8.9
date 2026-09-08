-- KurtiERP: reviewed update for the EXISTING original Supabase database.
-- No demo data, reset, historic data rewrite, or disabling of RLS.
-- Run this whole file once in the existing project's SQL Editor before deploying.
BEGIN;
DO $preflight$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['item_styles','item_variants','item_detail_lines','item_compositions','job_cards','sales_orders','sales_order_items','production_batches','stitching_entries','qc_entries','qc_sub_components','finishing_stock','finished_goods','dispatch_vouchers','component_assembly_vouchers','component_assembly_items','contractor_receive_vouchers','contractor_receive_items'] LOOP
  IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'Existing original table public.% is missing. This update is not an empty-database installer.',t;END IF;
 END LOOP;
END $preflight$;
DO $bootstrap$
BEGIN
 IF to_regprocedure('public.create_original_item(uuid,jsonb,jsonb)') IS NULL THEN
  IF to_regclass('public.item_manual_save_requests') IS NOT NULL THEN RAISE EXCEPTION 'Item save installation is partial. Review it before applying this update.';END IF;
  EXECUTE $original_item_sql$
-- Local reviewed migration. Apply once before the matching Item Master code.
-- Business model: original style -> colour variant -> detail lines; compositions belong to style.
-- No existing business rows, policies or constraints are changed.

-- Original UI already references this field, but its first export omitted the migration.
ALTER TABLE public.item_variants ADD COLUMN IF NOT EXISTS measurement_sheet_url text;
CREATE TABLE public.item_manual_save_requests (
  user_id uuid NOT NULL, request_id uuid NOT NULL,
  payload jsonb NOT NULL, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_id)
);
ALTER TABLE public.item_manual_save_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.item_manual_save_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.item_manual_save_requests TO authenticated;
GRANT UPDATE (result) ON public.item_manual_save_requests TO authenticated;
CREATE POLICY manual_save_read ON public.item_manual_save_requests FOR SELECT TO authenticated
 USING (user_id = (SELECT auth.uid()));
CREATE POLICY manual_save_insert ON public.item_manual_save_requests FOR INSERT TO authenticated
 WITH CHECK (user_id = (SELECT auth.uid()) AND result IS NULL);
CREATE POLICY manual_save_result ON public.item_manual_save_requests FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.create_original_item(p_request_id uuid, p_style jsonb, p_variants jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE
 uid uuid := auth.uid(); saved_payload jsonb; saved_result jsonb; payload jsonb;
 sid uuid; vid uuid; v jsonb; d jsonb; c jsonb; variant_ids jsonb := '[]'::jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Sign in before saving an item' USING ERRCODE='28000'; END IF;
 IF p_request_id IS NULL OR jsonb_typeof(p_style) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_variants) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Invalid item payload' USING ERRCODE='22023';
 END IF;
 IF jsonb_array_length(p_variants) <> 1 OR p_style ? 'id' THEN
   RAISE EXCEPTION 'New Item requires one new colour variant' USING ERRCODE='22023';
 END IF;
 payload := jsonb_build_object('style',p_style,'variants',p_variants);
 INSERT INTO public.item_manual_save_requests(user_id,request_id,payload)
 VALUES(uid,p_request_id,payload) ON CONFLICT (user_id,request_id) DO NOTHING;
 SELECT r.payload,r.result INTO saved_payload,saved_result FROM public.item_manual_save_requests r
 WHERE user_id=uid AND request_id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Save request is inaccessible' USING ERRCODE='42501'; END IF;
 IF saved_payload IS DISTINCT FROM payload THEN RAISE EXCEPTION 'Request identity already belongs to another payload' USING ERRCODE='22023'; END IF;
 IF saved_result IS NOT NULL THEN RETURN saved_result; END IF;
 IF NULLIF(btrim(p_style->>'job_card_no'),'') IS NULL OR NULLIF(btrim(p_style->>'import_key'),'') IS NULL THEN
   RAISE EXCEPTION 'Item identifier is required' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.item_styles(job_card_no,design_code,style_no,set_type,import_key)
 VALUES(p_style->>'job_card_no',p_style->>'design_code',NULLIF(p_style->>'style_no',''),NULLIF(p_style->>'set_type',''),p_style->>'import_key')
 RETURNING id INTO sid;
 FOR v IN SELECT * FROM jsonb_array_elements(p_variants) LOOP
   IF jsonb_typeof(v) IS DISTINCT FROM 'object' OR v ? 'id'
      OR NULLIF(btrim(v->>'colour'),'') IS NULL OR NULLIF(btrim(v->>'import_key'),'') IS NULL THEN
     RAISE EXCEPTION 'Colour and generated key are required' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.item_variants(style_id,job_card_no,colour,colour_normalized,style_no,set_type,
     variant_status,match_level,import_key,import_source,source_row_start,source_row_end)
   VALUES(sid,p_style->>'job_card_no',upper(btrim(v->>'colour')),lower(btrim(v->>'colour')),
     NULLIF(v->>'style_no',''),NULLIF(v->>'set_type',''),'active','new_record',v->>'import_key','manual',0,0)
   RETURNING id INTO vid;
   variant_ids := variant_ids || jsonb_build_array(vid::text);
   IF jsonb_typeof(v->'_details') IS DISTINCT FROM 'array' THEN
     RAISE EXCEPTION 'Material lines must be an array' USING ERRCODE='22023';
   END IF;
   FOR d IN SELECT * FROM jsonb_array_elements(v->'_details') LOOP
     IF NULLIF(btrim(d->>'material_name'),'') IS NULL THEN
       RAISE EXCEPTION 'Material name is required' USING ERRCODE='22023';
     END IF;
     INSERT INTO public.item_detail_lines(variant_id,category,material_name,material_name_normalized,
       quantity,unit,secondary_quantity,secondary_unit,notes,source_text,source_row,review_status,review_note,import_key)
     VALUES(vid,d->>'category',d->>'material_name',d->>'material_name_normalized',
       NULLIF(d->>'quantity','')::numeric,COALESCE(d->>'unit',''),NULLIF(d->>'secondary_quantity','')::numeric,
       COALESCE(d->>'secondary_unit',''),COALESCE(d->>'notes',''),d->>'source_text',
       (d->>'source_row')::integer,'ok','',d->>'import_key');
   END LOOP;
 END LOOP;
 IF jsonb_typeof(p_style->'_compositions') IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Production sub-units must be an array' USING ERRCODE='22023';
 END IF;
 FOR c IN SELECT * FROM jsonb_array_elements(p_style->'_compositions') LOOP
   IF NULLIF(btrim(c->>'component_name'),'') IS NULL OR (c->>'qty_per_set')::integer < 1 THEN
     RAISE EXCEPTION 'Production sub-unit name and positive whole quantity are required' USING ERRCODE='22023';
   END IF;
   INSERT INTO public.item_compositions(style_id,component_name,component_name_normalized,qty_per_set,unit,sort_order,notes)
   VALUES(sid,c->>'component_name',lower(c->>'component_name'),(c->>'qty_per_set')::integer,
     COALESCE(NULLIF(c->>'unit',''),'Pcs'),(c->>'sort_order')::integer,'');
 END LOOP;
 saved_result := jsonb_build_object('style_id',sid,'variant_ids',variant_ids);
 UPDATE public.item_manual_save_requests SET result=saved_result WHERE user_id=uid AND request_id=p_request_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Save result could not be recorded'; END IF;
 RETURN saved_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_original_item(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_original_item(uuid,jsonb,jsonb) TO authenticated;

-- Read-only guards see all references so hidden rows cannot be mistaken for absence.
-- Private schema is not a PostgREST API schema. No business write bypass is granted.
CREATE SCHEMA erp_item_guard;
REVOKE ALL ON SCHEMA erp_item_guard FROM PUBLIC;
GRANT USAGE ON SCHEMA erp_item_guard TO authenticated;
CREATE FUNCTION erp_item_guard.has_references(p_variant_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE v public.item_variants%ROWTYPE; label text;
BEGIN
 IF auth.uid() IS NULL THEN RETURN true; END IF;
 SELECT * INTO v FROM public.item_variants WHERE id=p_variant_id;
 IF NOT FOUND THEN RETURN true; END IF;
 label:=COALESCE(NULLIF(v.style_no,''),v.job_card_no);
 RETURN EXISTS(SELECT 1 FROM public.job_cards WHERE job_card_no=v.job_card_no)
 OR EXISTS(SELECT 1 FROM public.sales_order_items WHERE item_name ILIKE '%' || label || '%')
 OR EXISTS(SELECT 1 FROM public.production_batches WHERE job_card_no=v.job_card_no OR style_name ILIKE '%' || label || '%')
 OR EXISTS(SELECT 1 FROM public.stitching_entries WHERE job_card_ref=v.job_card_no OR style_name ILIKE '%' || label || '%')
 OR EXISTS(SELECT 1 FROM public.qc_entries WHERE job_card_ref=v.job_card_no OR style_name ILIKE '%' || label || '%');
END;
$$;
CREATE FUNCTION erp_item_guard.has_variants(p_style_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NULL OR EXISTS(SELECT 1 FROM public.item_variants WHERE style_id=p_style_id);
$$;
CREATE FUNCTION erp_item_guard.has_details(p_variant_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NULL OR EXISTS(SELECT 1 FROM public.item_detail_lines WHERE variant_id=p_variant_id);
$$;
CREATE FUNCTION erp_item_guard.has_children(p_style_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NULL
 OR EXISTS(SELECT 1 FROM public.item_variants WHERE style_id=p_style_id)
 OR EXISTS(SELECT 1 FROM public.item_compositions WHERE style_id=p_style_id);
$$;
REVOKE ALL ON FUNCTION erp_item_guard.has_references(uuid),erp_item_guard.has_variants(uuid),erp_item_guard.has_children(uuid),erp_item_guard.has_details(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION erp_item_guard.has_references(uuid),erp_item_guard.has_variants(uuid),erp_item_guard.has_children(uuid),erp_item_guard.has_details(uuid) TO authenticated;

-- Same deletion rules as the original DeleteItemModal, executed atomically.
CREATE FUNCTION public.delete_original_item_variant(p_variant_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v public.item_variants%ROWTYPE; style_label text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before deleting an item' USING ERRCODE='28000'; END IF;
 -- Block concurrent writers to the original text-reference tables during check+delete.
 LOCK TABLE public.job_cards,public.sales_order_items,public.production_batches,
   public.stitching_entries,public.qc_entries IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO v FROM public.item_variants WHERE id=p_variant_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Item is missing or not accessible'; END IF;
 PERFORM id FROM public.item_styles WHERE id=v.style_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Parent item is missing or not accessible'; END IF;
 style_label := COALESCE(NULLIF(v.style_no,''),v.job_card_no);
 IF erp_item_guard.has_references(p_variant_id) THEN
   RAISE EXCEPTION 'Item is referenced in a business document. Deletion is blocked.';
 END IF;
 DELETE FROM public.item_detail_lines WHERE variant_id=v.id;
 IF erp_item_guard.has_details(v.id) THEN RAISE EXCEPTION 'Some material lines could not be deleted; operation rolled back'; END IF;
 DELETE FROM public.item_variants WHERE id=v.id AND style_id=v.style_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Variant deletion was not authorized'; END IF;
 IF NOT erp_item_guard.has_variants(v.style_id) THEN
   DELETE FROM public.item_compositions WHERE style_id=v.style_id;
   IF erp_item_guard.has_children(v.style_id) THEN RAISE EXCEPTION 'Some child records are inaccessible; deletion rolled back'; END IF;
   DELETE FROM public.item_styles WHERE id=v.style_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Parent deletion was not authorized'; END IF;
 END IF;
 RETURN jsonb_build_object('variant_id',v.id);
END;
$$;
REVOKE ALL ON FUNCTION public.delete_original_item_variant(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_original_item_variant(uuid) TO authenticated;

-- Original merge: retain keeper, move variants and compositions, fill blank metadata.
CREATE FUNCTION public.merge_original_item_styles(p_groups jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE g jsonb; duplicate_text text; keeper public.item_styles%ROWTYPE;
 duplicate public.item_styles%ROWTYPE; total integer := 0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before merging items' USING ERRCODE='28000'; END IF;
 IF jsonb_typeof(p_groups) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid merge groups'; END IF;
 -- Serialize structural changes; ordinary authenticated table grants remain required.
 LOCK TABLE public.item_styles,public.item_variants,public.item_compositions IN SHARE ROW EXCLUSIVE MODE;
 FOR g IN SELECT * FROM jsonb_array_elements(p_groups) LOOP
   SELECT * INTO keeper FROM public.item_styles WHERE id=(g->>'keeperId')::uuid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Merge keeper is missing or inaccessible'; END IF;
   FOR duplicate_text IN SELECT jsonb_array_elements_text(g->'duplicateIds') LOOP
     IF duplicate_text::uuid=keeper.id THEN RAISE EXCEPTION 'Keeper cannot be merged into itself'; END IF;
     SELECT * INTO duplicate FROM public.item_styles WHERE id=duplicate_text::uuid FOR UPDATE;
     IF NOT FOUND THEN RAISE EXCEPTION 'Duplicate is missing or inaccessible. Scan again.'; END IF;
     IF NULLIF(lower(btrim(keeper.job_card_no)),'') IS NULL
        OR lower(btrim(keeper.job_card_no)) IS DISTINCT FROM lower(btrim(duplicate.job_card_no)) THEN
       RAISE EXCEPTION 'Only items with the same original style identifier can be merged';
     END IF;
     UPDATE public.item_variants SET style_id=keeper.id,updated_at=now() WHERE style_id=duplicate.id;
     UPDATE public.item_compositions SET style_id=keeper.id,updated_at=now() WHERE style_id=duplicate.id;
     -- If an RLS policy hid a child or denied its update, do not cascade-delete it.
     IF erp_item_guard.has_children(duplicate.id) THEN
       RAISE EXCEPTION 'Some child records could not be moved';
     END IF;
     UPDATE public.item_styles SET
       design_code=COALESCE(NULLIF(design_code,''),duplicate.design_code),
       style_no=COALESCE(NULLIF(style_no,''),duplicate.style_no),
       set_type=COALESCE(NULLIF(set_type,''),duplicate.set_type),
       primary_image_url=COALESCE(NULLIF(primary_image_url,''),duplicate.primary_image_url),updated_at=now()
       WHERE id=keeper.id RETURNING * INTO keeper;
     IF NOT FOUND THEN RAISE EXCEPTION 'Keeper update was not authorized'; END IF;
     DELETE FROM public.item_styles WHERE id=duplicate.id;
     IF NOT FOUND THEN RAISE EXCEPTION 'Duplicate deletion was not authorized'; END IF;
     total := total+1;
   END LOOP;
 END LOOP;
 RETURN jsonb_build_object('merged',total,'removed',total);
END;
$$;
REVOKE ALL ON FUNCTION public.merge_original_item_styles(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_original_item_styles(jsonb) TO authenticated;

CREATE FUNCTION public.edit_original_item_variant(p_variant_id uuid,p_header jsonb,p_lines jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE line jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in before editing an item' USING ERRCODE='28000'; END IF;
 IF NULLIF(btrim(p_header->>'colour'),'') IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION 'Colour and valid detail lines are required' USING ERRCODE='22023';
 END IF;
 UPDATE public.item_variants SET colour=btrim(p_header->>'colour'),colour_normalized=lower(btrim(p_header->>'colour')),
   style_no=NULLIF(btrim(p_header->>'style_no'),''),set_type=NULLIF(btrim(p_header->>'set_type'),''),updated_at=now()
   WHERE id=p_variant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Variant is missing or inaccessible'; END IF;
 FOR line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   UPDATE public.item_detail_lines SET material_name_normalized=line->>'material_name_normalized',
     quantity=NULLIF(line->>'quantity','')::numeric,unit=line->>'unit',
     secondary_quantity=NULLIF(line->>'secondary_quantity','')::numeric,secondary_unit=line->>'secondary_unit',notes=line->>'notes'
     WHERE id=(line->>'id')::uuid AND variant_id=p_variant_id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Detail line does not belong to this variant or is inaccessible'; END IF;
 END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.edit_original_item_variant(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.edit_original_item_variant(uuid,jsonb,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
$original_item_sql$;
 ELSE
  IF to_regprocedure('public.edit_original_item_variant(uuid,jsonb,jsonb)') IS NULL OR to_regprocedure('public.delete_original_item_variant(uuid)') IS NULL OR to_regprocedure('public.merge_original_item_styles(jsonb)') IS NULL THEN
   RAISE EXCEPTION 'Original Item Master functions are partially installed; update stopped without changing data.';
  END IF;
 END IF;
END $bootstrap$;

-- 20260908200000_restore_missing_persistence.sql
-- Add persistence for existing original screens. No seed, reset or stock rewriting.

CREATE TABLE IF NOT EXISTS public.finishing_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_no text UNIQUE NOT NULL, date date NOT NULL,
 job_card_ref text NOT NULL, style_name text NOT NULL,
 qc_entry_ref text, total_qc_passed integer NOT NULL DEFAULT 0 CHECK(total_qc_passed>=0),
 total_finished integer NOT NULL DEFAULT 0 CHECK(total_finished>=0),
 packaging_status text NOT NULL DEFAULT 'unpacked' CHECK(packaging_status IN ('packed','unpacked','partial')),
 quality_sign_off boolean NOT NULL DEFAULT false, quality_sign_off_by text,
 sub_components jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'in_progress',
 remarks text, workflow_payload jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stitching_entries ADD COLUMN IF NOT EXISTS workflow_payload jsonb;
ALTER TABLE public.qc_entries ADD COLUMN IF NOT EXISTS workflow_payload jsonb;
ALTER TABLE public.finishing_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='finishing_entries')THEN
 CREATE POLICY authenticated_factory_access ON public.finishing_entries FOR ALL TO authenticated USING(auth.uid() IS NOT NULL)WITH CHECK(auth.uid() IS NOT NULL);
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.finishing_entries TO authenticated;
-- Enable change delivery for existing workflow tables, without granting table access.
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['accounts','component_assembly_items','component_assembly_vouchers','contractor_issue_items','contractor_issue_vouchers','contractor_receive_items','contractor_receive_vouchers','cutting_entries','cutting_masters','cutting_movement_history','cutting_stock','cutting_sub_components','dispatch_vouchers','dyeing_processing_entries','emb_cutting_entries','emb_issue_vouchers','emb_receive_vouchers','embroidery_accessory_entries','embroidery_fabric_issues','fabric_inventory','finished_goods','finishing_entries','finishing_receive_components','finishing_receive_vouchers','finishing_stock','grey_fabric_purchases','import_audit_log','import_batches','item_compositions','item_detail_lines','item_styles','item_variants','job_card_workflow_statuses','job_cards','printer_fabric_issues','printer_fabric_receipts','production_batches','qc_entries','qc_sub_components','sales_order_items','sales_orders','stitch_audit_trail','stitch_issue_components','stitch_issue_vouchers','stitch_operators','stitch_receive_components','stitch_receive_vouchers','stitching_entries','user_profiles'] LOOP
   IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname=t AND c.relkind IN('r','p')) AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
   END IF;
  END LOOP;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';

-- 20260908210000_atomic_original_forms.sql
CREATE OR REPLACE FUNCTION public.save_original_sales_order(p_id uuid,p_header jsonb,p_lines jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 DECLARE v_id uuid; h public.sales_orders; c public.sales_order_items; line jsonb; result jsonb;
 BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Detail lines must be an array';END IF;
 SELECT * INTO h FROM jsonb_populate_record(NULL::public.sales_orders,p_header);
 IF p_id IS NULL THEN
  v_id=gen_random_uuid();
  INSERT INTO public.sales_orders(id,order_date,vch_no,party_name,party_type,total_qty,total_amount,job_card_no,status,created_by,updated_by)VALUES(v_id,h.order_date,h.vch_no,h.party_name,h.party_type,h.total_qty,h.total_amount,h.job_card_no,h.status,h.created_by,h.updated_by);
 ELSE
  v_id=p_id;
  PERFORM 1 FROM public.sales_orders WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found or access denied';END IF;
  UPDATE public.sales_orders SET order_date=h.order_date,vch_no=h.vch_no,party_name=h.party_name,party_type=h.party_type,total_qty=h.total_qty,total_amount=h.total_amount,job_card_no=h.job_card_no,status=h.status,updated_by=h.updated_by WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Update denied';END IF;
  DELETE FROM public.sales_order_items WHERE sales_order_id=v_id;
  IF EXISTS(SELECT 1 FROM public.sales_order_items WHERE sales_order_id=v_id) THEN RAISE EXCEPTION 'Existing detail lines could not be replaced';END IF;
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.sales_order_items,line);
  INSERT INTO public.sales_order_items(sales_order_id,item_name,param_size,param_colour,qty,unit,price,amount)VALUES(v_id,c.item_name,c.param_size,c.param_colour,c.qty,c.unit,c.price,c.amount);
 END LOOP;
 SELECT to_jsonb(t) INTO result FROM public.sales_orders t WHERE id=v_id;
 RETURN result;
 END $$;
 REVOKE ALL ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) TO authenticated;
 
CREATE OR REPLACE FUNCTION public.save_original_qc_entry(p_id uuid,p_header jsonb,p_lines jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 DECLARE v_id uuid; h public.qc_entries; c public.qc_sub_components; line jsonb; result jsonb;
 BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Detail lines must be an array';END IF;
 SELECT * INTO h FROM jsonb_populate_record(NULL::public.qc_entries,p_header);
 IF h.total_pass<0 OR h.total_fail<0 OR h.total_pass+h.total_fail>h.total_pieces_received OR h.net_passed<>h.total_pass THEN RAISE EXCEPTION 'Invalid QC totals';END IF;
 IF h.total_pass IS DISTINCT FROM (SELECT coalesce(sum((x->>'pass_count')::integer),0)FROM jsonb_array_elements(p_lines)x) OR h.total_fail IS DISTINCT FROM (SELECT coalesce(sum((x->>'fail_count')::integer),0)FROM jsonb_array_elements(p_lines)x) OR h.total_pieces_received IS DISTINCT FROM (SELECT coalesce(sum((x->>'pieces_received')::integer),0)FROM jsonb_array_elements(p_lines)x) THEN RAISE EXCEPTION 'QC header and component totals do not match';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  IF (line->>'pass_count')::integer<0 OR (line->>'fail_count')::integer<0 OR (line->>'pass_count')::integer+(line->>'fail_count')::integer>(line->>'pieces_received')::integer THEN RAISE EXCEPTION 'Invalid QC component quantities';END IF;
 END LOOP;

 IF p_id IS NULL THEN
  v_id=gen_random_uuid();
  INSERT INTO public.qc_entries(id,entry_no,date,job_card_ref,style_name,stitching_entry_ref,total_pieces_received,total_pass,total_fail,net_passed,defect_categories,status,remarks)VALUES(v_id,h.entry_no,h.date,h.job_card_ref,h.style_name,h.stitching_entry_ref,h.total_pieces_received,h.total_pass,h.total_fail,h.net_passed,h.defect_categories,h.status,h.remarks);
 ELSE
  v_id=p_id;
  PERFORM 1 FROM public.qc_entries WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found or access denied';END IF;
  UPDATE public.qc_entries SET entry_no=h.entry_no,date=h.date,job_card_ref=h.job_card_ref,style_name=h.style_name,stitching_entry_ref=h.stitching_entry_ref,total_pieces_received=h.total_pieces_received,total_pass=h.total_pass,total_fail=h.total_fail,net_passed=h.net_passed,defect_categories=h.defect_categories,status=h.status,remarks=h.remarks WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Update denied';END IF;
  DELETE FROM public.qc_sub_components WHERE qc_entry_id=v_id;
  IF EXISTS(SELECT 1 FROM public.qc_sub_components WHERE qc_entry_id=v_id) THEN RAISE EXCEPTION 'Existing detail lines could not be replaced';END IF;
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.qc_sub_components,line);
  INSERT INTO public.qc_sub_components(qc_entry_id,component,pieces_received,pass_count,fail_count,size_breakdown,defect_categories)VALUES(v_id,c.component,c.pieces_received,c.pass_count,c.fail_count,c.size_breakdown,c.defect_categories);
 END LOOP;
 SELECT to_jsonb(t) INTO result FROM public.qc_entries t WHERE id=v_id;
 RETURN result;
 END $$;
 REVOKE ALL ON FUNCTION public.save_original_qc_entry(uuid,jsonb,jsonb) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.save_original_qc_entry(uuid,jsonb,jsonb) TO authenticated;
 
NOTIFY pgrst,'reload schema';

-- 20260908220000_finishing_atomic_save.sql
CREATE OR REPLACE FUNCTION public.save_original_finishing_entry(p_entry jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE e public.finishing_entries;existing public.finishing_entries;n integer;line jsonb;total integer=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 SELECT * INTO e FROM jsonb_populate_record(NULL::public.finishing_entries,p_entry);
 IF e.id IS NULL OR e.date IS NULL OR coalesce(e.job_card_ref,'')='' THEN RAISE EXCEPTION 'Date and job card are required';END IF;
 IF jsonb_typeof(e.sub_components) IS DISTINCT FROM 'array' OR jsonb_array_length(e.sub_components)=0 THEN RAISE EXCEPTION 'At least one component is required';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(e.sub_components) LOOP
  IF coalesce(line->>'component','')='' OR (line->>'finalCount')::integer<0 OR (line->>'finalCount')::integer>(line->>'qcPassCount')::integer THEN RAISE EXCEPTION 'Finished quantities must be between zero and QC passed quantities';END IF;
  total=total+(line->>'finalCount')::integer;
 END LOOP;
 IF total IS DISTINCT FROM e.total_finished THEN RAISE EXCEPTION 'Component total does not match finished quantity';END IF;
 LOCK TABLE public.finishing_entries IN SHARE ROW EXCLUSIVE MODE;
 SELECT * INTO existing FROM finishing_entries WHERE id=e.id;
 IF FOUND THEN
  IF (to_jsonb(existing)-'entry_no'-'created_at'-'workflow_payload') IS DISTINCT FROM (to_jsonb(e)-'entry_no'-'created_at'-'workflow_payload') THEN RAISE EXCEPTION 'Pending save has different details';END IF;
  RETURN to_jsonb(existing);
 END IF;
 SELECT coalesce(max(substring(entry_no FROM '^FIN-([0-9]+)$')::integer),0)+1 INTO n FROM finishing_entries;
 e.entry_no='FIN-'||lpad(n::text,greatest(4,length(n::text)),'0');
 INSERT INTO finishing_entries(id,entry_no,date,job_card_ref,style_name,qc_entry_ref,total_qc_passed,total_finished,packaging_status,quality_sign_off,quality_sign_off_by,sub_components,status,remarks)
 VALUES(e.id,e.entry_no,e.date,e.job_card_ref,e.style_name,e.qc_entry_ref,e.total_qc_passed,e.total_finished,e.packaging_status,e.quality_sign_off,e.quality_sign_off_by,e.sub_components,e.status,e.remarks);
 SELECT * INTO existing FROM finishing_entries WHERE id=e.id;
 RETURN to_jsonb(existing);
END $$;
REVOKE ALL ON FUNCTION public.save_original_finishing_entry(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_original_finishing_entry(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

-- 20260908230000_atomic_dispatch.sql
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
  IF (to_jsonb(prior)-'id'-'dispatch_no'-'created_at'-'updated_at') IS DISTINCT FROM (to_jsonb(v)-'id'-'dispatch_no'-'created_at'-'updated_at') THEN RAISE EXCEPTION 'Pending dispatch has different details';END IF;
  RETURN to_jsonb(prior);
 END IF;
 IF v.finished_goods_id IS NULL THEN RAISE EXCEPTION 'Select an assembled ready item before dispatch';END IF;
 IF v.finished_goods_id IS NOT NULL THEN
  SELECT * INTO STRICT fg FROM finished_goods WHERE id=v.finished_goods_id FOR UPDATE;
  IF coalesce(fg.source,'') NOT IN ('component_assembly','component_conversion') THEN RAISE EXCEPTION 'Only consolidated ready items can be dispatched';END IF;
  IF v.dispatched_pieces>coalesce(fg.available_for_dispatch,0) THEN RAISE EXCEPTION 'Dispatch quantity exceeds available finished goods';END IF;
  IF coalesce(v.job_card_ref,'')<>'' AND v.job_card_ref IS DISTINCT FROM fg.job_card_ref THEN RAISE EXCEPTION 'Finished goods belong to another job card';END IF;
  remaining=fg.available_for_dispatch-v.dispatched_pieces;
  UPDATE finished_goods SET dispatched_pieces=coalesce(fg.dispatched_pieces,0)+v.dispatched_pieces,available_for_dispatch=remaining,status=CASE WHEN remaining=0 THEN 'dispatched' WHEN remaining<fg.total_pieces THEN 'partial' ELSE 'available' END,updated_at=now()WHERE id=v.finished_goods_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Finished goods update denied';END IF;
 END IF;
 SELECT coalesce(max(substring(dispatch_no FROM '^DISP-([0-9]+)$')::integer),0)+1 INTO n FROM dispatch_vouchers;
 INSERT INTO dispatch_vouchers(id,dispatch_no,dispatch_date,party_name,job_card_ref,style_name,finished_goods_id,item_name,colour,size,ordered_pieces,dispatched_pieces,vehicle_no,driver_name,invoice_no,remarks,status,created_by)
 VALUES(p_id,'DISP-'||lpad(n::text,greatest(4,length(n::text)),'0'),v.dispatch_date,v.party_name,v.job_card_ref,v.style_name,v.finished_goods_id,v.item_name,v.colour,v.size,v.ordered_pieces,v.dispatched_pieces,v.vehicle_no,v.driver_name,v.invoice_no,v.remarks,v.status,v.created_by);
 SELECT * INTO prior FROM dispatch_vouchers WHERE id=p_id;
 RETURN to_jsonb(prior);
END $$;
REVOKE ALL ON FUNCTION public.save_original_dispatch(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_original_dispatch(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

-- 20260908233000_atomic_component_assembly.sql
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

-- 20260908234000_finishing_component_stock.sql
ALTER TABLE finishing_stock ADD COLUMN IF NOT EXISTS source_finishing_entry_id uuid REFERENCES finishing_entries(id) ON DELETE RESTRICT;
CREATE OR REPLACE FUNCTION public.post_original_finishing_components()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE q public.qc_entries; line jsonb; sz jsonb; approved integer; previous integer; amount integer; sz_total integer;
BEGIN
 -- Aggregate-only legacy workflow records do not identify components and cannot
 -- manufacture a guessed set. Only the original component form posts stock.
 IF jsonb_array_length(coalesce(NEW.sub_components,'[]'::jsonb))=0 THEN RETURN NEW;END IF;
 SELECT * INTO STRICT q FROM qc_entries WHERE entry_no=NEW.qc_entry_ref AND job_card_ref=NEW.job_card_ref FOR UPDATE;
 FOR line IN SELECT value FROM jsonb_array_elements(NEW.sub_components) LOOP
  amount=(line->>'finalCount')::integer;
  SELECT coalesce(sum(pass_count),0) INTO approved FROM qc_sub_components WHERE qc_entry_id=q.id AND lower(trim(component))=lower(trim(line->>'component'));
  SELECT coalesce(sum((l->>'finalCount')::integer),0) INTO previous FROM finishing_entries e CROSS JOIN LATERAL jsonb_array_elements(e.sub_components) l WHERE e.qc_entry_ref=q.entry_no AND e.job_card_ref=q.job_card_ref AND lower(trim(l->>'component'))=lower(trim(line->>'component'));
  -- Includes NEW, because this is an AFTER INSERT trigger.
  IF amount IS NULL OR amount<0 OR previous>approved THEN RAISE EXCEPTION 'Finished component total exceeds remaining approved QC quantity';END IF;
  IF amount=0 THEN CONTINUE;END IF;
  IF jsonb_array_length(coalesce(line->'sizeBreakdown','[]'::jsonb))>0 THEN
   SELECT sum((s->>'qty')::integer) INTO sz_total FROM jsonb_array_elements(line->'sizeBreakdown')s;
   IF sz_total IS DISTINCT FROM amount THEN RAISE EXCEPTION 'Enter finished size quantities whose total equals Final Count';END IF;
   FOR sz IN SELECT value FROM jsonb_array_elements(line->'sizeBreakdown') LOOP
    IF (sz->>'qty')::numeric<0 OR (sz->>'qty')::numeric<>trunc((sz->>'qty')::numeric) THEN RAISE EXCEPTION 'Invalid finished size quantity';END IF;
    IF (sz->>'qty')::integer=0 THEN CONTINUE;END IF;
    INSERT INTO finishing_stock(job_card_ref,stitch_receive_ref,component,size,colour,stitch_received_qty,finished_qty,pending_qty,source_finishing_entry_id)
    VALUES(NEW.job_card_ref,'FIN:'||NEW.entry_no,line->>'component',sz->>'size',coalesce(line->>'colour',''),(sz->>'qty')::integer,(sz->>'qty')::integer,0,NEW.id);
   END LOOP;
  ELSE
   INSERT INTO finishing_stock(job_card_ref,stitch_receive_ref,component,size,colour,stitch_received_qty,finished_qty,pending_qty,source_finishing_entry_id)
   VALUES(NEW.job_card_ref,'FIN:'||NEW.entry_no,line->>'component','',coalesce(line->>'colour',''),amount,amount,0,NEW.id);
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS post_original_finishing_components ON finishing_entries;
CREATE TRIGGER post_original_finishing_components AFTER INSERT ON finishing_entries FOR EACH ROW EXECUTE FUNCTION public.post_original_finishing_components();
REVOKE ALL ON FUNCTION public.post_original_finishing_components() FROM PUBLIC,anon;
-- Do not permit later stock edits to erase quantities already assembled.
CREATE OR REPLACE FUNCTION public.guard_original_assembled_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE available numeric; consumed numeric;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(OLD.job_card_ref,42));
 SELECT coalesce(sum(finished_qty),0) INTO available FROM finishing_stock WHERE id<>OLD.id AND job_card_ref=OLD.job_card_ref AND lower(trim(component))=lower(trim(OLD.component)) AND lower(trim(coalesce(size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(colour,'')))=lower(trim(coalesce(OLD.colour,'')));
 IF TG_OP='UPDATE' AND NEW.job_card_ref=OLD.job_card_ref AND lower(trim(NEW.component))=lower(trim(OLD.component)) AND lower(trim(coalesce(NEW.size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(NEW.colour,'')))=lower(trim(coalesce(OLD.colour,''))) THEN available=available+NEW.finished_qty;END IF;
 SELECT coalesce(sum(i.qty_used),0) INTO consumed FROM component_assembly_items i JOIN component_assembly_vouchers v ON v.id=i.assembly_voucher_id WHERE v.job_card_ref=OLD.job_card_ref AND lower(trim(i.component))=lower(trim(OLD.component)) AND lower(trim(coalesce(i.size,'')))=lower(trim(coalesce(OLD.size,''))) AND lower(trim(coalesce(i.colour,'')))=lower(trim(coalesce(OLD.colour,'')));
 IF available<consumed THEN RAISE EXCEPTION 'This component stock has already been assembled; reverse the undispatched assembly first';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
DROP TRIGGER IF EXISTS guard_original_assembled_stock ON finishing_stock;
CREATE TRIGGER guard_original_assembled_stock BEFORE UPDATE OR DELETE ON finishing_stock FOR EACH ROW EXECUTE FUNCTION public.guard_original_assembled_stock();
REVOKE ALL ON FUNCTION public.guard_original_assembled_stock() FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';

-- 20260908235000_contractor_component_stock.sql
ALTER TABLE finishing_stock ADD COLUMN IF NOT EXISTS source_contractor_receive_item_id uuid;
CREATE OR REPLACE FUNCTION public.post_original_contractor_components()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE v public.contractor_receive_vouchers;
BEGIN
 IF TG_OP IN ('DELETE','UPDATE') THEN
  DELETE FROM finishing_stock WHERE source_contractor_receive_item_id=OLD.id;
 END IF;
 IF TG_OP IN ('INSERT','UPDATE') THEN
  IF NEW.received_today IS NULL OR NEW.received_today<=0 THEN RAISE EXCEPTION 'Received component quantity must be positive';END IF;
  SELECT * INTO STRICT v FROM contractor_receive_vouchers WHERE id=NEW.receive_voucher_id;
  INSERT INTO finishing_stock(job_card_ref,stitch_receive_ref,component,size,colour,stitch_received_qty,finished_qty,pending_qty,source_contractor_receive_item_id)
  VALUES(v.job_card_ref,'CRV:'||v.voucher_no||':'||NEW.id,NEW.item,coalesce(NEW.size,''),coalesce(NEW.colour,''),NEW.received_today,NEW.received_today,0,NEW.id);
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
DROP TRIGGER IF EXISTS post_original_contractor_components ON contractor_receive_items;
CREATE TRIGGER post_original_contractor_components AFTER INSERT OR UPDATE OR DELETE ON contractor_receive_items FOR EACH ROW EXECUTE FUNCTION public.post_original_contractor_components();
REVOKE ALL ON FUNCTION public.post_original_contractor_components() FROM PUBLIC,anon;
NOTIFY pgrst,'reload schema';

-- 20260908235500_component_to_new_item.sql
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

ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS subtotal numeric, ADD COLUMN IF NOT EXISTS gst_percent numeric NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS gst_amount numeric NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION public.save_original_sales_order(p_id uuid,p_header jsonb,p_lines jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
 DECLARE v_id uuid; h public.sales_orders; c public.sales_order_items; line jsonb; result jsonb; part text; fields text[]; sizes text[]; size_total numeric; calc_qty numeric=0; calc_subtotal numeric=0;
 BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Detail lines must be an array';END IF;
 SELECT * INTO h FROM jsonb_populate_record(NULL::public.sales_orders,p_header);
 IF jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one item is required';END IF;
 h.gst_percent=coalesce(h.gst_percent,0);
 IF h.gst_percent<0 OR h.gst_percent>100 OR h.gst_percent::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid GST percentage';END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.sales_order_items,line);
  IF c.qty IS NULL OR c.qty<=0 OR c.price IS NULL OR c.price<0 OR c.qty::text IN ('NaN','Infinity','-Infinity') OR c.price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid item quantity or rate';END IF;
  IF nullif(trim(c.param_size),'') IS NULL THEN RAISE EXCEPTION 'Size-wise quantities are required';END IF;
  sizes=ARRAY[]::text[];size_total=0;
  FOREACH part IN ARRAY string_to_array(c.param_size,',') LOOP
   fields=string_to_array(trim(part),'/');
   IF array_length(fields,1)<>2 OR trim(fields[1])='' OR trim(fields[2])!~ '^([0-9]+)(\.[0-9]+)?$' THEN RAISE EXCEPTION 'Use Size/Qty for every size';END IF;
   IF lower(trim(fields[1]))=ANY(sizes) OR fields[2]::numeric<=0 THEN RAISE EXCEPTION 'Duplicate size or invalid size quantity';END IF;
   sizes=array_append(sizes,lower(trim(fields[1])));size_total=size_total+fields[2]::numeric;
  END LOOP;
  IF size_total<>c.qty THEN RAISE EXCEPTION 'Size total % must equal item quantity %',size_total,c.qty;END IF;
  calc_qty=calc_qty+c.qty;calc_subtotal=calc_subtotal+round(c.qty*c.price,2);
 END LOOP;
 IF h.total_qty IS DISTINCT FROM calc_qty THEN RAISE EXCEPTION 'Order quantity must equal sum of item quantities';END IF;
 h.subtotal=calc_subtotal;h.gst_amount=round(calc_subtotal*h.gst_percent/100,2);h.total_amount=h.subtotal+h.gst_amount;
 IF p_id IS NULL THEN
  v_id=gen_random_uuid();
  INSERT INTO public.sales_orders(id,order_date,vch_no,party_name,party_type,total_qty,total_amount,subtotal,gst_percent,gst_amount,job_card_no,status,created_by,updated_by)VALUES(v_id,h.order_date,h.vch_no,h.party_name,h.party_type,h.total_qty,h.total_amount,h.subtotal,h.gst_percent,h.gst_amount,h.job_card_no,h.status,h.created_by,h.updated_by);
 ELSE
  v_id=p_id;
  PERFORM 1 FROM public.sales_orders WHERE id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Record not found or access denied';END IF;
  UPDATE public.sales_orders SET order_date=h.order_date,vch_no=h.vch_no,party_name=h.party_name,party_type=h.party_type,total_qty=h.total_qty,total_amount=h.total_amount,subtotal=h.subtotal,gst_percent=h.gst_percent,gst_amount=h.gst_amount,job_card_no=h.job_card_no,status=h.status,updated_by=h.updated_by WHERE id=v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Update denied';END IF;
  DELETE FROM public.sales_order_items WHERE sales_order_id=v_id;
  IF EXISTS(SELECT 1 FROM public.sales_order_items WHERE sales_order_id=v_id) THEN RAISE EXCEPTION 'Existing detail lines could not be replaced';END IF;
 END IF;
 FOR line IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  SELECT * INTO c FROM jsonb_populate_record(NULL::public.sales_order_items,line);
  INSERT INTO public.sales_order_items(sales_order_id,item_name,param_size,param_colour,qty,unit,price,amount)VALUES(v_id,c.item_name,c.param_size,c.param_colour,c.qty,c.unit,c.price,round(c.qty*c.price,2));
 END LOOP;
 SELECT to_jsonb(t) INTO result FROM public.sales_orders t WHERE id=v_id;
 RETURN result;
 END $$;
 REVOKE ALL ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.save_original_sales_order(uuid,jsonb,jsonb) TO authenticated;
 

NOTIFY pgrst,'reload schema';


-- qty_received remains the legacy settlement counter used by generated qty_pending.
-- New receipts retain actual physical meters separately; historical rows are not rewritten.
ALTER TABLE public.printer_fabric_issues ADD COLUMN IF NOT EXISTS qty_actual_received numeric(12,3);
ALTER TABLE public.printer_fabric_receipts
 ADD COLUMN IF NOT EXISTS shrinkage_percent numeric,
 ADD COLUMN IF NOT EXISTS grey_consumed numeric(12,3),
 ADD COLUMN IF NOT EXISTS processing_type text,
 ADD COLUMN IF NOT EXISTS roll_details jsonb,
 ADD COLUMN IF NOT EXISTS request_payload jsonb;
CREATE OR REPLACE FUNCTION public.receive_printer_fabric_with_stock(p_id uuid,p_receipt jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE issue public.printer_fabric_issues; saved public.printer_fabric_receipts; grey public.grey_fabric_purchases;
 qty numeric; pct numeric; loss numeric; consumed numeric; finished text; process text; roll jsonb; roll_total numeric=0;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required';END IF;
 IF p_id IS NULL THEN RAISE EXCEPTION 'Receipt request identity required';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 SELECT * INTO saved FROM public.printer_fabric_receipts WHERE id=p_id;
 IF FOUND THEN
  IF saved.request_payload IS DISTINCT FROM p_receipt THEN RAISE EXCEPTION 'Receipt already saved with different values';END IF;
  RETURN to_jsonb(saved);
 END IF;
 qty=(p_receipt->>'qty_received')::numeric;pct=(p_receipt->>'shrinkage_percent')::numeric;
 finished=trim(p_receipt->>'processed_fabric_name');process=p_receipt->>'processing_type';
 IF qty IS NULL OR qty<=0 OR qty::text IN ('NaN','Infinity','-Infinity') OR qty<>round(qty,3) OR pct IS NULL OR pct<0 OR pct>100 OR pct::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid received quantity or shrinkage percentage';END IF;
 IF nullif(finished,'') IS NULL OR process IS NULL OR process NOT IN ('printing','dyeing') OR nullif(trim(p_receipt->>'receipt_no'),'') IS NULL THEN RAISE EXCEPTION 'Receipt number, finished fabric name and process are required';END IF;
 IF jsonb_typeof(p_receipt->'rolls') IS DISTINCT FROM 'array' OR jsonb_array_length(p_receipt->'rolls')=0 THEN RAISE EXCEPTION 'At least one received roll is required';END IF;
 FOR roll IN SELECT value FROM jsonb_array_elements(p_receipt->'rolls') LOOP
  IF (roll->>'qty') IS NULL OR (roll->>'qty')::numeric<=0 OR (roll->>'qty')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid roll quantity';END IF;
  roll_total=roll_total+(roll->>'qty')::numeric;
 END LOOP;
 IF round(roll_total,3)<>qty THEN RAISE EXCEPTION 'Roll quantities do not equal received quantity';END IF;
 loss=round(qty*pct/100,3);consumed=qty+loss;
 SELECT * INTO issue FROM public.printer_fabric_issues WHERE id=(p_receipt->>'issue_id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Issue not found or access denied';END IF;
 IF issue.printer_account IS DISTINCT FROM p_receipt->>'printer_account' THEN RAISE EXCEPTION 'Selected issue belongs to a different printer';END IF;
 IF consumed>issue.qty_pending THEN RAISE EXCEPTION 'Grey consumption % exceeds pending %',consumed,issue.qty_pending;END IF;
 SELECT * INTO grey FROM public.grey_fabric_purchases WHERE purchase_no=issue.gray_fabric_ref FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Linked grey purchase not found or access denied';END IF;
 IF grey.balance_in_stock<consumed THEN RAISE EXCEPTION 'Insufficient linked grey stock';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('printer-receipt:'||(p_receipt->>'receipt_no'),0));
 IF EXISTS(SELECT 1 FROM public.printer_fabric_receipts WHERE receipt_no=p_receipt->>'receipt_no') THEN RAISE EXCEPTION 'Receipt number already exists. Use a new receipt number.';END IF;
 INSERT INTO public.printer_fabric_receipts(id,receipt_no,date,printer_account,issue_id,gray_fabric_ref,fabric_name,qty_received,processed_fabric_name,processed_qty,shortage,shrinkage,shrinkage_percent,grey_consumed,processing_type,roll_details,request_payload,remarks,created_by)
 VALUES(p_id,trim(p_receipt->>'receipt_no'),(p_receipt->>'date')::date,issue.printer_account,issue.id,issue.gray_fabric_ref,issue.fabric_name,qty,finished,qty,0,loss,pct,consumed,process,p_receipt->'rolls',p_receipt,p_receipt->>'remarks',auth.uid()::text) RETURNING * INTO saved;
 UPDATE public.printer_fabric_issues SET qty_actual_received=coalesce(qty_actual_received,qty_received)+qty,qty_received=qty_received+consumed,status=CASE WHEN qty_received+consumed>=qty_issued THEN 'settled' ELSE 'partial' END,updated_by=auth.uid()::text WHERE id=issue.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Issue update denied';END IF;
 UPDATE public.grey_fabric_purchases SET balance_in_stock=balance_in_stock-consumed WHERE id=grey.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Grey stock update denied';END IF;
 INSERT INTO public.fabric_inventory(fabric_name,finished_fabric_name,unit,stock_qty,category,status,inventory_stage,source_module,source_receipt_id,source_grey_fabric_ref,processor_name,processing_type,received_date,created_by)
 VALUES(finished,finished,'Metre',qty,'OTHER','ready_to_cut','finished','printer_receipt',saved.receipt_no,issue.gray_fabric_ref,issue.printer_account,process,saved.date,auth.uid()::text);
 RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.receive_printer_fabric_with_stock(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.receive_printer_fabric_with_stock(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';

COMMIT;
SELECT 'KurtiERP update applied. Existing business data retained.' AS result;
