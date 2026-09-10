BEGIN;
-- Guard each transaction at its public boundary; internal stock writes stay atomic.
DO $$ DECLARE row record; definition text; guard text;
BEGIN
 FOR row IN SELECT * FROM (VALUES
 ('save_original_dispatch','dispatch', 'create'),
 ('erp_cancel_dispatch','dispatch','delete'),
 ('save_original_component_assembly','contractor','create'),
 ('convert_original_component_to_item','contractor','create'),
 ('delete_original_component_assembly','contractor','delete'),
 ('erp_save_contractor_receive','contractor','receive'),
 ('erp_delete_contractor_receive','contractor','delete'),
 ('save_original_sales_order','sales','upsert'),
 ('save_original_qc_entry','qc','upsert'),
 ('save_original_finishing_entry','finishing','finishing'),
 ('receive_printer_fabric_with_stock','dyeing','receipt'),
 ('create_original_item','items','newitem'),
 ('edit_original_item_variant','items','edit'),
 ('delete_original_item_variant','items','delete'),
 ('merge_original_item_styles','items','edit')
 ) AS x(name,module,action) LOOP
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=row.name;
  IF definition IS NULL THEN RAISE EXCEPTION 'Required transaction % is missing',row.name;END IF;
  guard=CASE row.action
   WHEN 'receive' THEN 'public.erp_can(''contractor'',CASE WHEN p_edit THEN ''edit'' ELSE ''create'' END)'
   WHEN 'upsert' THEN format('public.erp_can(%L,CASE WHEN p_id IS NULL THEN ''create'' ELSE ''edit'' END)',row.module)
   WHEN 'finishing' THEN 'public.erp_can(''finishing'',CASE WHEN EXISTS(SELECT 1 FROM finishing_entries WHERE id=(p_entry->>''id'')::uuid) THEN ''edit'' ELSE ''create'' END)'
   WHEN 'receipt' THEN '(public.erp_can(''dyeing'',''create'') OR public.erp_can(''grey'',''create''))'
   WHEN 'newitem' THEN '(public.erp_can(''items'',''create'') OR public.erp_can(''contractor'',''create''))'
   ELSE format('public.erp_can(%L,%L)',row.module,row.action) END;
  -- Do not stack guards when the migration is rerun.
  IF position('-- ERP module boundary' in definition)=0 THEN
   definition=regexp_replace(definition,'\mBEGIN\M','BEGIN -- ERP module boundary'||chr(10)||' IF NOT ('||guard||') THEN RAISE EXCEPTION ''Module action is not permitted'';END IF;');
  END IF;
  definition=replace(definition,'SECURITY INVOKER','SECURITY DEFINER');
  IF position('SECURITY DEFINER' in definition)=0 THEN definition=replace(definition,'LANGUAGE plpgsql','LANGUAGE plpgsql SECURITY DEFINER');END IF;
  EXECUTE definition;
 END LOOP;
END $$;
-- No direct API writes to consolidated stock or dispatch history. Use guarded transactions.
REVOKE INSERT,UPDATE,DELETE ON finished_goods,dispatch_vouchers,component_assembly_vouchers,component_assembly_items,contractor_receive_vouchers,contractor_receive_items FROM authenticated,anon;
COMMIT;
