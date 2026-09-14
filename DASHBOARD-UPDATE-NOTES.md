# Complete dashboard update — 14 September 2026

This ZIP supersedes the earlier dashboard-only ZIP. Apply it on top of the Combined Update already installed.

## Installation
1. Open DASHBOARD-SETTINGS.sql and copy the entire contents into a new Supabase SQL Editor query. Run it once. No email replacement is needed. It adds one shared dashboard setting; do not rerun COMBINED-UPDATE.sql.
2. Merge the ZIP's src folder into your existing project's src folder, replacing matching files. Do not delete your existing src folder. The ZIP is a patch, not an entire project.
3. Commit and push in GitHub Desktop. Summary: Add metro dashboard with process stations and shared inactivity settings
4. Wait for Vercel Ready, then open Settings → Dashboard status colours. Default is 3 days; Owner/Admin can change it to 1–30 days for everyone.

## Included
- Main totals, expandable department totals and source-record detail panels.
- Job Card metro stations: Cutting, Embroidery, Handwork, Stitching, QC, Contractor Finishing, Assembly and Dispatch. Visibility follows module authority.
- Embroidery/Handwork receipts are matched to their own issue voucher. Their green status means all currently issued work is received, not that all future/unissued work on the Job Card is complete. New issues reopen the stage.
- Fabric, accessories and components remain separate by unit. Process stations display completed issue-line counts instead of adding metres and pieces. Unit mismatches are flagged for review and never marked green.
- Other manufacturing stages check each planned component; one component's surplus cannot cover another's shortage.
- Shared inactivity threshold uses the database, not browser-local storage. Only active Owner/Admin accounts can change it. Active users can read it. Settings refresh on the normal dashboard refresh cycle.
- Green complete, orange partial, red incomplete after the configured period, white unstarted. Completed work never becomes red from age alone.
- Missing shared settings show a warning and pause red inactivity alerts instead of silently using a different threshold.
- Item links, Job Card links, clickable source totals and stage detail panels retained from the previous dashboard patch.

## Data interpretation
- No entries means not started; optional stages are not automatically labelled N/A because there is no confirmed item-level routing flag in this patch.
- Unknown component plans show ?. Completion for non-process production stages is per component, aggregated across colours/sizes.
- Latest voucher updated/created timestamp is used, with business date fallback. Page refresh is not an activity.
- Mixed-component conversions are excluded from the original item's assembly completion target; their stock remains in Ready Items totals. Original-item dispatch uses matching style.
- Assembly and dispatch stock-write flows are unchanged. Their live acceptance checks remain to be performed with existing vouchers.

## Validation
Production build, TypeScript, component progress tests, process isolation/linkage/unit tests and database permission/settings tests passed locally. Live data and authenticated browser visual acceptance were not tested here.
