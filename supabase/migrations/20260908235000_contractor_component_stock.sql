BEGIN;
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
COMMIT;
