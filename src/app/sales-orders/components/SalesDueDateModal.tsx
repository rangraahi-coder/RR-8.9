'use client';
import {useRef,useState} from 'react';
import {SalesOrder} from '../data/salesOrdersData';
import DueDateFields from '@/components/DueDateFields';
import {isoDate,daysUntilDue} from '@/lib/dueDates';
import {createClient} from '@/lib/supabase/client';
export default function SalesDueDateModal({order,onClose,onSaved}:{order:SalesOrder;onClose:()=>void;onSaved:()=>void}){
 const [due,setDue]=useState(order.dueDate||''),[saving,setSaving]=useState(false),[error,setError]=useState('');const locked=useRef(false);
 async function save(){if(locked.current)return;if(daysUntilDue(order.date,due)===''){setError('Enter a valid Due Date on or after PO date.');return;}locked.current=true;setSaving(true);setError('');try{const {data,error}=await createClient().rpc('erp_set_sales_due',{p_id:order.id,p_due_date:due,p_revision:order.dueRevision||0});if(error)throw error;if(data?.due_date!==due)throw Error('Database did not confirm the due date.');onSaved();}catch(e){setError((e as Error).message);}finally{locked.current=false;setSaving(false);}}
 return <div className="fixed inset-0 z-50 bg-black/40 p-3 flex items-center justify-center"><section role="dialog" aria-modal="true" aria-label="Edit due date" className="bg-card p-5 rounded-xl w-full max-w-lg"><h2 className="font-semibold mb-3">Edit Due Date · {order.vchNo}</h2><p className="text-sm mb-3">PO date: {order.date}. Updates the linked Job Cards and dashboard deadline.</p><DueDateFields date={isoDate(order.date)} dueDate={due} onChange={setDue}/>{error&&<p role="alert" className="text-red-600 mt-3">{error}</p>}<div className="flex justify-end gap-2 mt-4"><button className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button className="btn-primary" disabled={saving} onClick={()=>void save()}>{saving?'Saving…':'Save Due Date'}</button></div></section></div>;
}
