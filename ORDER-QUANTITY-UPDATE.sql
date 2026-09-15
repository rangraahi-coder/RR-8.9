BEGIN;
CREATE TABLE IF NOT EXISTS public.erp_order_readiness (
 order_item_id uuid PRIMARY KEY REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
 ready_qty numeric NOT NULL CHECK(ready_qty>=0),
 updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid REFERENCES auth.users(id)
);
ALTER TABLE public.erp_order_readiness ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS order_readiness_read ON public.erp_order_readiness;
CREATE POLICY order_readiness_read ON public.erp_order_readiness FOR SELECT TO authenticated USING(public.erp_can('sales','view'));
REVOKE ALL ON public.erp_order_readiness FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.erp_order_readiness TO authenticated;
CREATE OR REPLACE FUNCTION public.erp_save_order_readiness(p_item uuid,p_qty numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE maximum numeric;
BEGIN
 IF NOT public.erp_can('sales','edit') THEN RAISE EXCEPTION 'Sales edit authority required';END IF;
 SELECT qty INTO STRICT maximum FROM public.sales_order_items WHERE id=p_item FOR UPDATE;
 IF p_qty IS NULL OR p_qty<0 OR p_qty>maximum OR p_qty<>trunc(p_qty) THEN RAISE EXCEPTION 'Enter a whole quantity between zero and the order quantity';END IF;
 INSERT INTO public.erp_order_readiness(order_item_id,ready_qty,updated_by)VALUES(p_item,p_qty,auth.uid())
 ON CONFLICT(order_item_id) DO UPDATE SET ready_qty=excluded.ready_qty,updated_at=now(),updated_by=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.erp_save_order_readiness(uuid,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_save_order_readiness(uuid,numeric) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
