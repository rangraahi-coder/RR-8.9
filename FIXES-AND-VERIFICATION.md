# Fixes and verification — KurtiERP restoration

Prepared 8 September 2026. Original first export is the business-workflow baseline. Current dark-sidebar/pink-white interface is the visual shell. This is a full source project, not a Rocket paste prompt.

## Implemented changes

| Area | What changed / resulting behaviour |
|---|---|
| Original Item Master | Restored original New Item controls: image, optional measurement sheet, colour, style/set type, production sub-units, materials, manufacturing work and accessories. Removed the generic required Import Key from the active create form. Original parser/manual import preserved. |
| Item save | Style, variant, details and composition use the reviewed atomic Original Item RPC. Lost-response recovery retains the request identity across reloads. Original edit/delete/merge rules remain, with child/reference guards. |
| Auth | Shared browser client, verified Supabase user, proper signed-out state, login/callback and standard cookie handling. Removed old local-login bypass. Current user's identity replaces decorative sample identity. Cookie types corrected against the shipped SSR dependency. |
| UI integration | Current sidebar/topbar/palette wraps the original active pages. Original and current route aliases work. Fake sidebar counters removed. Notifications use real events. |
| Live data refresh | Per-subscriber channels, cleanup, debouncing, focus/reconnect refresh and 30-second visible-tab fallback. Existing tables are added to the Realtime publication if present. A local save also signals refresh. |
| Dashboard/data hooks | Fixed mismatched QC, stitching, fabric and finishing metric columns; failed loads surface errors instead of silently reporting successful empty data. Job-card summaries carry actual size ratios and dates. |
| Job cards | A partial update no longer overwrites unrelated values with defaults. |
| QC | Passed stock is the pass count; failed stock is not subtracted twice. Whole-number/nonnegative checks and pass+fail conservation added. Header/children save in one transaction. |
| Sales orders | Header/lines save together; failed child edits roll back. Original creator retained. Item/account choices refresh from real tables. |
| Finishing | Original component form persists in finishing_entries. Finished quantities validated against actual approved QC totals; accepted components post to finishing_stock. Editable finished-size quantities must add up to Final Count. No direct ready-set creation at this stage. |
| Contractor receive | New receive-item trigger posts component stock. Receiving a component no longer creates a final ready item. Source stock reductions that would erase consumed components are blocked. |
| Component assembly | Item Master composition and qty-per-set ratios are required. Incomplete combinations cannot become ready sets. Stock check, reservation, voucher and Finished Goods creation are transactional. CAV numbering allocated in DB. Matching size/colour handled per voucher. |
| Surplus components | Fill complete sets consumes only the required quantities. 12 Kurta / 10 Pant / 10 Dupatta at 1:1:1 makes 10 sets and leaves 2 Kurta. Remaining components retain their source Job Card. |
| New item from component | Added explicit conversion action in Component Assembly. New name/code creates a separate Item Master style/variant and 1PC composition; selected stock becomes new ready pieces. CCV voucher and master/stock IDs retain lineage. Real size/colour remain traceable. No automatic conversion. |
| Conversion recovery | Persisted, user-scoped request identity; recover after lost response. Replays do not create duplicate masters or deduct stock twice. Changed pending payload rejected. |
| Ready stock and Dispatch | Only assembled sets or explicitly converted standalone items are selectable as ready stock. Dispatch save and stock deduction commit together. Over-dispatch and mismatched Job Card rejected. Dispatch history blocks assembly/conversion deletion. |
| Counts | Ready sets and converted standalone items are shown separately. 10 sets + 2 single items is not labelled 12 sets. |
| Audit / compile fixes | Same-user edits can show on AuditBadge; invalid timestamps render safely. Corrected several malformed types/props in original imports, fabric inventory and embroidery. |
| Deployment | Next.js build/type bypasses disabled, functional lint gate added, lockfile provided, local font assets, Node 22.x and Vercel configuration. Secrets/build outputs excluded. |

## Verified locally

- Production `next build` passed using a clean install of the shipped package-lock.json. No TypeScript or lint-error bypasses enabled.
- Standalone `tsc --noEmit` and configured `eslint src` checked separately. Lint checks functional hook/Next/unreachable-code rules; it is not a blanket style audit.
- **71 local checks passed.** The included PGlite/TypeScript test suite covers original item transactions, hidden-reference guards, rollback, client recovery, QC conservation, finishing-to-stock, complete-set assembly, surplus stock, conversion, and dispatch.
- Combined DATABASE-UPDATE.sql tested for first installation of the missing Item RPC and repeat application on an isolated representative schema.
- Actual New Item component rendered to static markup to check original controls and route wiring.
- Tests use local fixtures. No test rows were inserted into your Supabase instance.

The exact passing-check log and changed-file list are in `verification/RESULTS.txt` and `CHANGED-FILES.txt`.

## Important limits / remaining production checks

1. Live Supabase access was not available. Actual project schema, RLS policies, signed-in browser reads/writes, storage uploads and realtime delivery remain to be checked on the deployed app. Database functions use the authenticated caller's privileges; existing policies are not disabled or replaced with service-role access.
2. Browser preview was blocked by this environment. Pixel-level parity, mobile layout and browser-driven end-to-end voucher saves are unverified; static render, type checks and build are the available UI evidence.
3. This is a targeted restoration, not proof that every original module is defect-free. Some original embroidery/stitching/contractor issue/receive operations still use multiple client queries. Full transaction-level failure/concurrency handling for every legacy path has not been completed or production-tested. The atomic guarantees above apply to the named RPC operations; triggers do not turn an entire legacy multi-request edit into a transaction.
4. Historical data is not rewritten or automatically migrated into new stock. Existing premature finished-goods sources remain stored but are excluded from new ready-stock selection. Review historical mismatches separately before relying on opening balances.
5. Aggregate-only legacy Production Workflow records have no component-level breakdown. They persist, but are not converted into guessed assembly stock. Use the component-level Finishing Entry workflow for component stock posting.
6. Assembly currently handles one consistent size/colour per voucher. Missing Item Master composition or ambiguous Job Card-to-style linkage blocks assembly. No guessed 3PC defaults are silently applied. Different-size components in one set need an explicit compatibility model before enabling that case.
7. Conversion is 1 component → 1 standalone 1PC item. It does not invent selling price, costing, images, tax classification or an alternate multi-component set. Those optional item details remain editable through the existing master workflow. Deleting an undispatched conversion releases stock but retains the new master catalog item.
8. Original inactive manufacturing prototype routes remain inactive redirects. Their unreachable sample datasets were omitted; no second manufacturing workflow was introduced. Original placeholder purchase/ledger screens were not invented.
9. Settings exposes the working diagnostics page. It does not fabricate unimplemented company/configuration settings. Legacy auth route restrictions are retained; fine-grained access still depends on your actual Supabase policies.
10. Historical destructive/reset/demo SQL is deliberately not in the deployable migration folder. Use only the combined DATABASE-UPDATE.sql for this existing project; do not blindly replay all historical migrations or use it as an empty-database installer.

## Files to use

- `KurtiERP-Complete-Restored.zip`: extract the project folder; deploy it to Vercel.
- `DATABASE-UPDATE.sql`: run in the existing Supabase project's SQL Editor before deploying.
- `START-HERE.md` / project README: configuration and deployment steps.

No live deployment or production database mutation has been performed in this session.
