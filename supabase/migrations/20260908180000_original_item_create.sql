-- Local reviewed migration. Apply once before the matching Item Master code.
-- Business model: original style -> colour variant -> detail lines; compositions belong to style.
-- No existing business rows, policies or constraints are changed.
BEGIN;
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
COMMIT;
