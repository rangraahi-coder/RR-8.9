BEGIN;
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
COMMIT;
