'use client';
import {useEffect,useState,useCallback} from 'react';
import AppLayout from '@/components/AppLayout';
import {useAuth} from '@/contexts/AuthContext';
import {supabase} from '@/lib/supabase/client';
import {MODULES,type Action,type AccessProfile} from '@/lib/moduleAccess';
function Users(){
 const {session,refreshAccess,accessProfile}=useAuth();
 const [users,setUsers]=useState<(AccessProfile&{email?:string;is_owner?:boolean})[]>([]),[selected,setSelected]=useState('');
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[admin,setAdmin]=useState(false),[active,setActive]=useState(true);
 const [permissions,setPermissions]=useState<Record<string,Action[]>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const load=useCallback(async()=>{const {data,error}=await supabase.rpc('erp_list_users');if(error)throw error;setUsers(data||[]);},[]);
 useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
 const owner=users.find(u=>u.user_id===selected)?.is_owner;
 function choose(id:string){setSelected(id);const u=users.find(u=>u.user_id===id);setName(u?.display_name||'');setEmail(u?.email||'');setPassword('');setAdmin(u?.is_admin||false);setActive(u?.active??true);setPermissions(u?.permissions||{});setMessage('');setError('');}
 function toggle(module:string,action:Action){setPermissions(previous=>{const actions=new Set(previous[module]||[]);if(actions.has(action)){actions.delete(action);if(action==='view')actions.clear();}else{actions.add(action);actions.add('view');}return {...previous,[module]:[...actions]};});}
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');setMessage('');try{
  const response=await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({userId:selected||undefined,name,email,password,admin,active,permissions})});const data=await response.json();if(!response.ok)throw new Error(data.error||'Save failed');setPassword('');setMessage(selected?'Permissions saved.':'User created.');await load();await refreshAccess();
 }catch(e){setError(e instanceof Error?e.message:String(e));await load().catch(()=>{});}finally{setBusy(false);}}
 return <div className="space-y-5"><h1 className="text-xl font-semibold">Users & Module Access</h1><select className="input-field" value={selected} onChange={e=>choose(e.target.value)}><option value="">+ Create user</option>{users.map(u=><option key={u.user_id} value={u.user_id}>{u.display_name||u.email} {u.is_owner?'— Owner':!u.active?'— Inactive':''}</option>)}</select>
 <form onSubmit={save} className="card-surface p-5 space-y-4"><fieldset disabled={busy||!!owner} className="space-y-4">
 {owner&&<p className="text-primary font-semibold">Owner — unrestricted access to every module and action. This account cannot be restricted or deactivated here.</p>}
 <div className="grid sm:grid-cols-2 gap-4"><label>Name<input required className="input-field w-full" value={name} onChange={e=>setName(e.target.value)}/></label><label>Email<input required type="email" disabled={!!selected} className="input-field w-full" value={email} onChange={e=>setEmail(e.target.value)}/></label></div>
 {!selected&&<label className="block">Password<input required minLength={12} type="password" autoComplete="new-password" className="input-field w-full" value={password} onChange={e=>setPassword(e.target.value)}/></label>}
 <div className="flex gap-5"><label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Active</label><label><input type="checkbox" checked={admin} onChange={e=>setAdmin(e.target.checked)}/> Administrator (all modules)</label></div>
 {!admin&&<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left p-2">Module</th>{['View','Create','Edit','Delete / Cancel'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead><tbody>{MODULES.map(([key,title])=><tr className="border-t border-border" key={key}><td className="p-2">{title}</td>{(['view','create','edit','delete'] as Action[]).map(a=><td key={a} className="p-2 text-center"><input aria-label={`${title}: ${a}`} type="checkbox" checked={permissions[key]?.includes(a)||false} onChange={()=>toggle(key,a)}/></td>)}</tr>)}</tbody></table></div>}
 <p className="text-sm text-muted-foreground">Unchecked modules are hidden from navigation and dashboard. Access is also checked at the database.</p>
 <button disabled={busy||!!owner} className="btn-primary">{busy?'Saving…':selected?'Save permissions':'Create user'}</button>
 </fieldset>{error&&<p role="alert" className="text-red-600">{error}</p>}{message&&<p role="status" className="text-green-700">{message}</p>}</form></div>;
}
export default function Page(){return <AppLayout pageTitle="Users & Access" pageTitleHi="यूज़र और अधिकार" render={()=><Users/>}/>;}
