export function componentApprovalStatus(expected: string[], rows: { key: string; status: string }[]) {
 const values=new Map(rows.map(row=>[row.key,row.status]));
 const approved=expected.filter(key=>values.get(key)==='approved').length;
 return { done:expected.length>0&&approved===expected.length, partial:approved>0&&approved<expected.length, active:expected.some(key=>values.has(key)&&values.get(key)!=='not_ordered') };
}
