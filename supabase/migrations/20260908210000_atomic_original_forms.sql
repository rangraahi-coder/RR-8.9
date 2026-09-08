BEGIN;
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
COMMIT;