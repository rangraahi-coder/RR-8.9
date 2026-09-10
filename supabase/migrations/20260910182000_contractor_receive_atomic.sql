BEGIN;
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
COMMIT;
