BEGIN;
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
COMMIT;
