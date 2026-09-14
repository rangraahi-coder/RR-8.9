-- Apply once before deploying the complete dashboard update. Safe to rerun.
BEGIN;
CREATE TABLE IF NOT EXISTS public.erp_dashboard_settings (
 id integer PRIMARY KEY CHECK (id = 1),
 inactivity_days integer NOT NULL DEFAULT 3 CHECK (inactivity_days BETWEEN 1 AND 30),
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES auth.users(id)
);
INSERT INTO public.erp_dashboard_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
ALTER TABLE public.erp_dashboard_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dashboard_settings_read ON public.erp_dashboard_settings;
CREATE POLICY dashboard_settings_read ON public.erp_dashboard_settings FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.erp_user_access WHERE user_id=auth.uid() AND active));
REVOKE ALL ON public.erp_dashboard_settings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.erp_dashboard_settings TO authenticated;
CREATE OR REPLACE FUNCTION public.erp_save_dashboard_settings(p_days integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.erp_can('users','edit') THEN RAISE EXCEPTION 'Administrator required'; END IF;
 IF p_days IS NULL OR p_days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Choose 1 to 30 days'; END IF;
 UPDATE public.erp_dashboard_settings SET inactivity_days=p_days,updated_at=now(),updated_by=auth.uid() WHERE id=1;
END $$;
REVOKE ALL ON FUNCTION public.erp_save_dashboard_settings(integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_save_dashboard_settings(integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
