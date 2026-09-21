import type {CuttingEntry, RollDetail} from '@/app/cutting/data/cuttingData';
export function componentRolls(entry:CuttingEntry, component:string):RollDetail[]{
 return (entry.rollDetails||[]).filter(r=>r.component===component||(!r.component&&entry.subComponentDetails.length===1));
}
export function needsRollAssignment(entry:CuttingEntry):boolean{
 return entry.subComponentDetails.length>1&&(entry.rollDetails||[]).some(r=>!r.component||!entry.subComponentDetails.some(s=>s.component===r.component));
}
