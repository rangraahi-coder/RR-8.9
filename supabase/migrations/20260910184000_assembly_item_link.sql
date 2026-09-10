BEGIN;
CREATE OR REPLACE FUNCTION public.erp_link_assembly_item(p_job_ref text,p_style_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT (public.erp_can('contractor','create') OR public.erp_can('jobs','edit')) THEN RAISE EXCEPTION 'Item-link permission required';END IF;
 LOCK TABLE public.component_assembly_vouchers IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.component_assembly_vouchers WHERE job_card_ref=p_job_ref AND assembly_kind='set_assembly') THEN RAISE EXCEPTION 'An assembled item link cannot be changed';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.item_styles WHERE id=p_style_id) THEN RAISE EXCEPTION 'Select an existing Item Master style';END IF;
 UPDATE public.job_cards SET item_style_id=p_style_id WHERE job_card_no=p_job_ref;
 IF NOT FOUND THEN RAISE EXCEPTION 'Job Card not found';END IF;
END $$;
REVOKE ALL ON FUNCTION public.erp_link_assembly_item(text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.erp_link_assembly_item(text,uuid) TO authenticated;
COMMIT;
