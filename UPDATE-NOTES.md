# KurtiERP — September 8 updates

## Install on your existing project
1. Supabase: open your EXISTING project SQL Editor. Paste LATEST-UPDATE.sql and Run once. Stop if an error appears. Do not run the older full DATABASE-UPDATE.sql for this incremental update.
2. Extract KurtiERP-Updated.zip. Copy the contents of RR-8.9-main into your existing cloned GitHub repository folder, replacing matching files. Keep package.json at the repository root; do not create a nested project folder. On Mac, Command+Shift+. shows the included .gitignore when copying.
3. GitHub Desktop: review changes, commit with summary `Add GST, size validation, receipt shrinkage and Handwork`, then Push origin.
4. Wait for Vercel to show Ready. Keep the working Supabase environment variables unchanged. Refresh the site.

## What changed
- Sales Order: editable order-level GST percentage, subtotal, GST amount and inclusive grand total, saved and shown on edit/view. GST defaults to zero; select the appropriate rate yourself. No automatic tax-rate selection or CGST/SGST/IGST split was introduced.
- Size quantities: every item needs Size/Qty allocation; the sum must equal that item's quantity, and all item quantities must equal the order total. Missing/malformed/duplicate sizes or mismatches stop the save on both client and RPC. Existing orders are not rewritten, but editing an older order now requires its size breakup.
- Job Cards: directly after Sales Orders. The current ERP sidebar already had that order; the original alternate sidebar is now consistent.
- Fabric Entry → Fabric Receive (the existing tab): choose Printing/Dyeing, enter received rolls and shrinkage %. Grey consumed = received meters + received meters × shrinkage% /100. Example: 500 issued, 100 received, 5% shrinkage =105 grey consumed, 395 printer balance, 100 finished inventory. Roll quantities and remarks are retained on the receipt.
- A partial receipt no longer labels the entire remaining printer balance as shortage. Remaining stock stays pending. Shrinkage meters and percentage appear in Printer Ledger, alongside grey consumed.
- The new Fabric Receive path posts the receipt, issued balance, grey balance and finished inventory in one database transaction, with stock caps and repeat-request protection. Recover Pending Receipt retries an unconfirmed save from the same browser tab. Do not clear browser storage while a receipt is unconfirmed.
- Handwork: separate Production menu/page, issue and receive lists, HWI/HWR numbering, and separate dashboard counts. Uses the existing process_type=handwork voucher records, Job Card/component links and shared cutting/fabric stock, retaining the original Embroidery-style workflow. Existing Handwork vouchers appear in Handwork instead of Embroidery; no business rows are moved or duplicated. Receiving components does not consolidate them into final ready sets.
- Live refresh added to printer ledger and the selected printer's pending list. Existing UI styling and other module workflows retained.

## Validation and limits
- Production build succeeded with the shipped lockfile dependencies; standalone TypeScript and configured ESLint pass. Build used local placeholder public environment values, not production credentials.
- PostgreSQL-compatible local transaction tests: migration rerun, GST calculation, size mismatch rollback, shrinkage/stock conservation, duplicate receipt retry, incorrect-printer rejection, inventory-failure rollback, final settlement, signed-out rejection.
- Client tests: actual Sales Order edit form renders saved GST, size checks and Handwork issue12/receive10/pending2/receive2 using isolated service fixtures.
- These are local checks. Live Supabase policies, deployed schema, and signed-in browser saves remain to be verified on your project after applying SQL. No test/demo entries were added to your database.
- Handwork deliberately reuses the existing Embroidery service. Its legacy multi-request stock updates, edits and deletions were not redesigned into database transactions in this update; concurrency/failure behavior there is inherited, not certified atomic by these tests.
- Historical printing balances and receipts are not recalculated. For compatibility with the existing generated qty_pending column, printer_fabric_issues.qty_received remains the settlement counter (grey consumed for new receipts). Physical received meters are preserved in qty_actual_received and shown separately by the app. Do not interpret the raw settlement field as physical meters in custom reports.
- Older legacy tables/policies are preserved. This update does not widen user permissions or disable authentication/RLS.

## First live checks
Use real intended entries only: save and reopen a Sales Order with its correct GST and sizes; confirm a mismatch is rejected. Receive an actual printer/dyer batch and compare grey consumption, pending ledger and finished stock. Open Handwork and verify its Job Card/component issue and partial receive. Report any exact error before retrying an uncertain save.
