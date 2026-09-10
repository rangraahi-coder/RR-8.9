# KurtiERP combined update

Based on RR-8.9 commit 7941273b6c569ba632a5ba70eea6605519922b9a. This package replaces the earlier Dashboard-only patch. No live database changes or deployment were made while preparing it.

## Install once, in this order

1. Open `COMBINED-UPDATE.sql`. Replace `REPLACE_WITH_EXISTING_RANGRAAHI_LOGIN_EMAIL` at the top with the email you currently use to log into Rangraahi's ERP account. Do not enter a password. Run the entire file in the existing Supabase project's SQL Editor. It applies in one transaction and assigns that exact existing user as Owner. If the email does not exist, the update stops. Do not run the old DATABASE-UPDATE.sql or LATEST-UPDATE.sql for this release.
2. In Vercel environment variables, add `SUPABASE_SERVICE_ROLE_KEY` for the server. Obtain this from the same Supabase project's API settings. Keep it server-only: never prefix it with NEXT_PUBLIC, put it in source code, or send it in chat. It is required for the Owner to create new login users. Keep the currently working NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY unchanged.
3. Merge the `RR-8.9` folder contents into your existing GitHub checkout, replacing matching files. Preserve its .git directory and your existing local environment files. Commit and Push using GitHub Desktop. Wait for Vercel Ready, then open https://rr-8-9.vercel.app/login and hard refresh.
4. Sign in with the same Rangraahi email/password. Open Users & Access. The Owner has every module and action, and cannot be restricted or deactivated by other users. Other existing login accounts start without ERP authority until the Owner activates them and assigns permissions.
5. Create users with their own email/password, or select existing users. Assign View/Create/Edit/Delete-Cancel per module. View is required for other actions. A module's source lookups are available where needed by that department's vouchers, but its separate navigation/dashboard is hidden unless assigned. Backend permission changes apply to subsequent database requests immediately; the browser reloads its permission list on focus or within 30 seconds.
6. Run POST-UPDATE-CHECKS.sql. Review any historical receipt header/line mismatch before re-entering a receipt: the patch never invents missing lines or quantities. Check the dashboard and use its error details if your live database still returns a schema/query error.

## Included changes

- Rangraahi Owner: unrestricted module/action authority, protected against demotion/deactivation through user administration.
- User administration, department-specific navigation, server route guards, database policies and guarded transaction permissions. No demo users are created.
- Workflow navigation removed; Fabric Stock Tracker moved to Procurement. Existing workflow URL redirects to Job Cards.
- Sub-unit terminology replaced by Sub-component in visible Item Master/metric labels. Main pieces, produced sub-components, ready sets and dispatched ready items have separate totals.
- Dashboard shows only assigned modules, real loading/error states, a refresh action, overdue/blocked Job Cards and a Job Card progress table. No failed query is presented as a successful zero. Stock tables are paged for totals beyond the API row limit.
- Item Assembling shows only the selected Job Card/item's relevant, received, available sub-components. Item Master resolution uses explicit linkage first. If ambiguous/missing, the voucher offers an explicit Item Master selection; it never silently chooses the first match. Stock loading errors and composition errors are distinguished.
- New Item from Pending Sub-components shows all received, unassembled source components. Multiple sources can form exactly one new final item per voucher, with a quantity-per-item ratio and ready quantity. Another final item requires another voucher. Source Job Card, component, size/colour and consumption remain recorded on each line.
- Contractor receive create/edit/delete are atomic. A failed component write cannot still deduct the issue balance. Historical receipt lines missing stock are posted once using their source receipt-line identity. Components already used in assembly remain protected from source deletion.
- Dispatch accepts only consolidated ready stock from assembly/conversion. Reference PO is optional. Ready item selection is required; direct sub-component dispatch is rejected by the database. Partial dispatch and retries cannot overdraw/double-deduct. Cancellation requires permission and a reason, restores stock once and preserves history. Saved-voucher corrections use cancellation and a new voucher.
- Audit Trail includes database-recorded actor, action, source table and record ID alongside existing stitching audit history.

## Validation and limits

TypeScript and production build checks were run locally. Combined database regression tests cover migration reruns, Owner protection, denied privilege escalation, receive atomicity/retry/over-receipt, multi-source assembly balances, selected-item assembly, transaction rollback, optional-PO ready-only dispatch, partial dispatch, duplicate protection, cancellation and inactive/unassigned access. See COMBINED-VERIFICATION.txt.

These are local tests using isolated test records, not live manufacturing data. Live schema compatibility, the real Owner account assignment, user creation with your server key and final browser operations need checking after deployment. No credentials are included in this package. Existing approval workflows are not invented; the permission matrix controls operations that the modules actually support.

Developer verification: install dependencies, then run `npm run type-check`, `npm run build`, and `npm --prefix verification run test:combined` (install verification dependencies first).
