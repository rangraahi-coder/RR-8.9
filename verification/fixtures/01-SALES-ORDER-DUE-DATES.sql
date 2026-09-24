BEGIN;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS due_date date, ADD COLUMN IF NOT EXISTS due_days integer, ADD COLUMN IF NOT EXISTS due_revision bigint NOT NULL DEFAULT 0;
-- Preserve the installed settlement guard, adding only a field-limited scheduling exception.
DO $patch$
DECLARE d text;
BEGIN
 d=pg_get_functiondef('public.erp_lock_settled_voucher()'::regprocedure);
 IF position('sales_due_schedule_v1' in d)=0 THEN
  d=regexp_replace(d,'\mBEGIN\M', $insert$BEGIN
 -- sales_due_schedule_v1: identities, quantities, prices and voucher lines remain protected.
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='sales_orders'
 AND auth.uid() IS NOT NULL AND public.erp_can('sales','edit')
 AND to_jsonb(OLD)-ARRAY['due_date','due_days','due_revision','updated_at','updated_by']=to_jsonb(NEW)-ARRAY['due_date','due_days','due_revision','updated_at','updated_by'] THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' AND TG_TABLE_NAME='job_cards' AND current_user NOT IN ('authenticated','anon')
 AND to_jsonb(OLD)-ARRAY['due_date']=to_jsonb(NEW)-ARRAY['due_date']
 AND EXISTS(SELECT 1 FROM public.sales_orders s WHERE s.due_date IS NOT NULL
 AND (s.id::text=to_jsonb(NEW)->>'sales_order_id' OR (nullif(to_jsonb(NEW)->>'sales_order_id','') IS NULL AND s.job_card_no=to_jsonb(NEW)->>'job_card_no' AND (SELECT count(*) FROM public.sales_orders x WHERE x.job_card_no=s.job_card_no)=1))
 AND (to_jsonb(NEW)->>'due_date' IN (s.due_date::text,to_char(s.due_date,'DD/MM/YYYY')))) THEN RETURN NEW;END IF;
$insert$,'i');
  IF position('sales_due_schedule_v1' in d)=0 THEN RAISE EXCEPTION 'Installed guard could not be extended safely';END IF;
  EXECUTE d;
 END IF;
END $patch$;
CREATE OR REPLACE FUNCTION public.erp_validate_sales_due() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.due_date IS NOT NULL AND NEW.due_date IS NULL THEN RAISE EXCEPTION 'A recorded due date cannot be cleared; enter the revised date';END IF;
 IF NEW.due_date IS NULL THEN
  IF NEW.due_days IS NOT NULL THEN RAISE EXCEPTION 'Due date is required when due days are supplied';END IF;
 ELSE
  IF NEW.order_date IS NULL OR NEW.due_date<NEW.order_date::date THEN RAISE EXCEPTION 'Due date cannot be before PO date';END IF;
  NEW.due_days=NEW.due_date-NEW.order_date::date;
 END IF;
 IF TG_OP='INSERT' THEN NEW.due_revision=0;
 ELSIF NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.order_date IS DISTINCT FROM OLD.order_date THEN NEW.due_revision=OLD.due_revision+1;
 ELSE NEW.due_revision=OLD.due_revision;END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS erp_validate_sales_due ON public.sales_orders;
CREATE TRIGGER erp_validate_sales_due BEFORE INSERT OR UPDATE ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.erp_validate_sales_due();
CREATE OR REPLACE FUNCTION public.erp_sync_sales_due() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.due_date IS NOT NULL THEN
  -- Job Card due_date is the existing DD/MM/YYYY text field.
  UPDATE public.job_cards j SET due_date=to_char(NEW.due_date,'DD/MM/YYYY')
  WHERE (j.sales_order_id=NEW.id OR (j.sales_order_id IS NULL AND j.job_card_no=NEW.job_card_no AND (SELECT count(*) FROM public.sales_orders s WHERE s.job_card_no=NEW.job_card_no)=1))
  AND j.due_date IS DISTINCT FROM to_char(NEW.due_date,'DD/MM/YYYY');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS erp_sync_sales_due ON public.sales_orders;
CREATE TRIGGER erp_sync_sales_due AFTER INSERT OR UPDATE OF due_date,order_date ON public.sales_orders FOR EACH ROW EXECUTE FUNCTION public.erp_sync_sales_due();
CREATE OR REPLACE FUNCTION public.erp_inherit_sales_due() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE d date;
BEGIN
 IF NEW.sales_order_id IS NOT NULL THEN SELECT due_date INTO d FROM public.sales_orders WHERE id=NEW.sales_order_id;
 ELSE SELECT min(due_date) INTO d FROM public.sales_orders WHERE job_card_no=NEW.job_card_no HAVING count(*)=1;END IF;
 IF d IS NOT NULL THEN NEW.due_date=to_char(d,'DD/MM/YYYY');END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS aaa_inherit_sales_due ON public.job_cards;
CREATE TRIGGER aaa_inherit_sales_due BEFORE INSERT OR UPDATE ON public.job_cards FOR EACH ROW EXECUTE FUNCTION public.erp_inherit_sales_due();
CREATE OR REPLACE FUNCTION public.erp_set_sales_due(p_id uuid,p_due_date date,p_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL OR NOT public.erp_can('sales','edit') THEN RAISE EXCEPTION 'Sales Order edit permission required';END IF;
 IF p_due_date IS NULL THEN RAISE EXCEPTION 'Due date required';END IF;
 PERFORM pg_advisory_xact_lock(9182751);
 UPDATE public.sales_orders SET due_date=p_due_date,updated_at=now() WHERE id=p_id AND due_revision=p_revision RETURNING to_jsonb(sales_orders.*) INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Order changed, is missing, or access was denied. Refresh and try again.';END IF;
 RETURN result;
END $$;
-- Extend the installed atomic save instead of replacing its validation/permission logic.
DO $patch$
DECLARE d text;
BEGIN
 d=pg_get_functiondef('public.save_original_sales_order(uuid,jsonb,jsonb)'::regprocedure);
 IF position('due_date' in d)=0 THEN
  IF position('id,order_date,vch_no' in d)=0 OR position('v_id,h.order_date,h.vch_no' in d)=0 OR position('order_date=h.order_date,vch_no=' in d)=0 THEN
   RAISE EXCEPTION 'Sales Order save definition differs; migration rolled back for review';
  END IF;
  d=replace(d,'id,order_date,vch_no','id,order_date,due_date,vch_no');
  d=replace(d,'v_id,h.order_date,h.vch_no','v_id,h.order_date,h.due_date,h.vch_no');
  d=replace(d,'order_date=h.order_date,vch_no=','order_date=h.order_date,due_date=h.due_date,vch_no=');
  EXECUTE d;
 END IF;
END $patch$;
CREATE OR REPLACE FUNCTION public.erp_save_sales_order_with_due(p_id uuid,p_header jsonb,p_lines jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE result jsonb; saved_id uuid; d date; revision bigint;
BEGIN
 d=nullif(p_header->>'due_date','')::date;
 IF d IS NULL OR d<(p_header->>'order_date')::date THEN RAISE EXCEPTION 'Enter a due date on or after PO date';END IF;
 PERFORM pg_advisory_xact_lock(9182751);
 IF p_id IS NOT NULL THEN
  SELECT due_revision INTO revision FROM public.sales_orders WHERE id=p_id FOR UPDATE;
  IF revision IS DISTINCT FROM (p_header->>'due_revision')::bigint THEN RAISE EXCEPTION 'Order due date changed. Refresh before editing.';END IF;
 END IF;
 result=public.save_original_sales_order(p_id,p_header,p_lines);
 saved_id=(result->>'id')::uuid;
 IF saved_id IS NULL THEN RAISE EXCEPTION 'Sales Order save was not confirmed';END IF;
 IF nullif(result->>'due_date','')::date IS DISTINCT FROM d THEN RAISE EXCEPTION 'Sales Order due date save failed';END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.erp_validate_sales_due(),public.erp_sync_sales_due(),public.erp_inherit_sales_due() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.erp_set_sales_due(uuid,date,bigint),public.erp_save_sales_order_with_due(uuid,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_set_sales_due(uuid,date,bigint),public.erp_save_sales_order_with_due(uuid,jsonb,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
