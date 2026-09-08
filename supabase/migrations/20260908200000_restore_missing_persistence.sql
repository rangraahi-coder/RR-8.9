-- Add persistence for existing original screens. No seed, reset or stock rewriting.
BEGIN;
CREATE TABLE IF NOT EXISTS public.finishing_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 entry_no text UNIQUE NOT NULL, date date NOT NULL,
 job_card_ref text NOT NULL, style_name text NOT NULL,
 qc_entry_ref text, total_qc_passed integer NOT NULL DEFAULT 0 CHECK(total_qc_passed>=0),
 total_finished integer NOT NULL DEFAULT 0 CHECK(total_finished>=0),
 packaging_status text NOT NULL DEFAULT 'unpacked' CHECK(packaging_status IN ('packed','unpacked','partial')),
 quality_sign_off boolean NOT NULL DEFAULT false, quality_sign_off_by text,
 sub_components jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'in_progress',
 remarks text, workflow_payload jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stitching_entries ADD COLUMN IF NOT EXISTS workflow_payload jsonb;
ALTER TABLE public.qc_entries ADD COLUMN IF NOT EXISTS workflow_payload jsonb;
ALTER TABLE public.finishing_entries ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='finishing_entries')THEN
 CREATE POLICY authenticated_factory_access ON public.finishing_entries FOR ALL TO authenticated USING(auth.uid() IS NOT NULL)WITH CHECK(auth.uid() IS NOT NULL);
 END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.finishing_entries TO authenticated;
-- Enable change delivery for existing workflow tables, without granting table access.
DO $$ DECLARE t text; BEGIN
 IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  FOREACH t IN ARRAY ARRAY['accounts','component_assembly_items','component_assembly_vouchers','contractor_issue_items','contractor_issue_vouchers','contractor_receive_items','contractor_receive_vouchers','cutting_entries','cutting_masters','cutting_movement_history','cutting_stock','cutting_sub_components','dispatch_vouchers','dyeing_processing_entries','emb_cutting_entries','emb_issue_vouchers','emb_receive_vouchers','embroidery_accessory_entries','embroidery_fabric_issues','fabric_inventory','finished_goods','finishing_entries','finishing_receive_components','finishing_receive_vouchers','finishing_stock','grey_fabric_purchases','import_audit_log','import_batches','item_compositions','item_detail_lines','item_styles','item_variants','job_card_workflow_statuses','job_cards','printer_fabric_issues','printer_fabric_receipts','production_batches','qc_entries','qc_sub_components','sales_order_items','sales_orders','stitch_audit_trail','stitch_issue_components','stitch_issue_vouchers','stitch_operators','stitch_receive_components','stitch_receive_vouchers','stitching_entries','user_profiles'] LOOP
   IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relname=t AND c.relkind IN('r','p')) AND NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
   END IF;
  END LOOP;
 END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
