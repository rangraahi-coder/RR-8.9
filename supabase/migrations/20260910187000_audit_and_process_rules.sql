BEGIN;
CREATE TABLE IF NOT EXISTS public.erp_activity_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now(),performed_by text NOT NULL,actor_id uuid,action text NOT NULL,table_name text NOT NULL,record_id text);
ALTER TABLE erp_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_audit_read ON erp_activity_log;
CREATE POLICY erp_audit_read ON erp_activity_log FOR SELECT TO authenticated USING(public.erp_can('audit','view'));
GRANT SELECT ON erp_activity_log TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON erp_activity_log FROM authenticated,anon;
CREATE OR REPLACE FUNCTION public.erp_record_activity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rowdata jsonb; actor text;
BEGIN
 rowdata=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 SELECT email INTO actor FROM auth.users WHERE id=auth.uid();
 INSERT INTO public.erp_activity_log(performed_by,actor_id,action,table_name,record_id)VALUES(coalesce(actor,'Database maintenance'),auth.uid(),TG_OP,TG_TABLE_NAME,coalesce(rowdata->>'id',rowdata->>'user_id'));
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_record_activity() FROM PUBLIC,anon,authenticated;
DO $$ DECLARE t record; a text; command text; predicate text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'erp_activity_log' LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS erp_activity_capture ON public.%I',t.tablename);
  EXECUTE format('CREATE TRIGGER erp_activity_capture AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.erp_record_activity()',t.tablename);
 END LOOP;
 FOREACH a IN ARRAY ARRAY['view','create','edit','delete'] LOOP
  command=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
  FOREACH predicate IN ARRAY ARRAY['emb_issue_vouchers','emb_receive_vouchers'] LOOP
   EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I','erp_process_'||a,predicate);
   IF predicate='emb_issue_vouchers' THEN
    command=CASE a WHEN 'view' THEN 'SELECT' WHEN 'create' THEN 'INSERT' WHEN 'edit' THEN 'UPDATE' ELSE 'DELETE' END;
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s', 'erp_process_'||a,predicate,command,
     CASE WHEN a='create' THEN format('WITH CHECK(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a)
     WHEN a='edit' THEN format('USING(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)) WITH CHECK(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a,a)
     ELSE format('USING(public.erp_can(CASE WHEN process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))',a) END);
   ELSE
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR %s TO authenticated %s','erp_process_'||a,predicate,command,
     CASE WHEN a='create' THEN format('WITH CHECK(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a)
     WHEN a='edit' THEN format('USING(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L))) WITH CHECK(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a,a)
     ELSE format('USING(EXISTS(SELECT 1 FROM emb_issue_vouchers v WHERE v.id=issue_voucher_id AND public.erp_can(CASE WHEN v.process_type=''handwork'' THEN ''handwork'' ELSE ''embroidery'' END,%L)))',a) END);
   END IF;
  END LOOP;
 END LOOP;
END $$;
COMMIT;
