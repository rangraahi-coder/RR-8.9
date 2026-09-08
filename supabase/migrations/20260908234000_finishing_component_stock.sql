BEGIN;
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
COMMIT;
