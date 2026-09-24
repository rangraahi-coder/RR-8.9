-- Apply to the existing KurtiERP Supabase project before deploying updated code.
-- No demo rows, reset or historical receipt recalculation.
BEGIN;
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
SELECT 'GST, size validation and Fabric Receive shrinkage update applied' AS result;
