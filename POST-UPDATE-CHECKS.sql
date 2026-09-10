-- Read-only checks. Run after COMBINED-UPDATE.sql, in Supabase SQL Editor.
-- The first query should show Rangraahi's existing email, with all flags true.
SELECT a.email,u.display_name,u.is_owner,u.is_admin,u.active FROM erp_user_access u JOIN auth.users a ON a.id=u.user_id WHERE u.is_owner;
-- Any rows here need review: a historical receive header differs from its saved component lines.
-- This update does not invent missing component quantities from a header total.
SELECT v.id,v.voucher_no,v.total_received,coalesce(sum(i.received_today),0) AS saved_component_quantity
FROM contractor_receive_vouchers v LEFT JOIN contractor_receive_items i ON i.receive_voucher_id=v.id
GROUP BY v.id,v.voucher_no,v.total_received HAVING v.total_received IS DISTINCT FROM coalesce(sum(i.received_today),0);
-- Any rows here need review: no negative balances should be created by the updated transactions.
SELECT id,item,total_pieces,available_for_dispatch,dispatched_pieces FROM finished_goods
WHERE available_for_dispatch<0 OR dispatched_pieces<0 OR available_for_dispatch+dispatched_pieces<>total_pieces;
-- Real availability across all source items.
SELECT * FROM erp_pending_components(NULL);
