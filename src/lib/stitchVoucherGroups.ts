import type { StitchIssueVoucher, StitchReceiveVoucher } from '@/lib/services/stitchingVoucherService';
type Voucher = StitchIssueVoucher | StitchReceiveVoucher;
export function groupStitchVouchers<T extends Voucher>(vouchers: T[], issues: StitchIssueVoucher[]) {
    const byIssue = new Map(issues.map(v => [v.id, v]));
    const items = new Map<string, { name: string; rows: T[]; jobs: Map<string, { name: string; rows: T[] }> }>();
    for (const v of vouchers) {
      const source = 'issueVoucherId' in v ? byIssue.get(v.issueVoucherId) : v;
      const name = (source?.styleName || v.styleName || '').trim();
      const jobName = source?.jobCardRef || v.jobCardRef || 'Job card not recorded';
      const sourceJobId = source && 'jobCardId' in source ? source.jobCardId : undefined;
      const jobKey = sourceJobId ? `id:${sourceJobId}` : jobName !== 'Job card not recorded' ? `ref:${jobName}` : `voucher:${v.id}`;
      const itemKey = name ? `item:${name.toLocaleLowerCase()}` : `unknown:${jobKey}`;
      if (!items.has(itemKey)) items.set(itemKey, { name: name || 'Item not recorded', rows: [], jobs: new Map() });
      const item = items.get(itemKey)!;
      item.rows.push(v);
      if (!item.jobs.has(jobKey)) item.jobs.set(jobKey, { name: jobName, rows: [] });
      item.jobs.get(jobKey)!.rows.push(v);
    }
    return [...items];
}
