'use client';
import {dueDateFromDays,daysUntilDue} from '@/lib/dueDates';
export default function DueDateFields({date,dueDate,onChange}:{date:string;dueDate:string;onChange:(date:string)=>void}){
 return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs font-semibold">Due Days (from PO date)<input type="number" min="0" max="36500" step="1" className="input-field mt-1" value={daysUntilDue(date,dueDate)} onChange={e=>onChange(dueDateFromDays(date,e.target.value))}/></label><label className="text-xs font-semibold">Due Date<input type="date" min={date} className="input-field mt-1" value={dueDate} onChange={e=>onChange(e.target.value)}/></label><p className="text-xs text-muted-foreground sm:col-span-2">Enter either field. Calendar days from PO date; 0 means the same day.</p></div>;
}
