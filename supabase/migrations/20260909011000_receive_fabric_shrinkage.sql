BEGIN;
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
