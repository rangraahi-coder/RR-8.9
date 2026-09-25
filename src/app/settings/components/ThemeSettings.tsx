'use client';
import {useState,useRef} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {useERPTheme} from '@/contexts/ERPThemeContext';
import {erpErrorMessage} from '@/lib/erpError';
export default function ThemeSettings(){
 const {accessProfile}=useAuth();const {theme,loaded,error,reload,save}=useERPTheme();const [busy,setBusy]=useState(false),[message,setMessage]=useState('');const lock=useRef(false);
 if(!accessProfile?.is_owner)return null;
 return <section className="card-surface border rounded-xl p-5 space-y-4"><div><h2 className="text-lg font-semibold">Theme Settings · Owner only</h2><p className="text-sm text-muted-foreground">Applies to every user, on mobile and desktop. Other open screens refresh within 30 seconds or when focused.</p></div><p>Current theme: <strong>{loaded?(theme==='diwali'?'Royal Diwali':'Normal'):'Loading…'}</strong></p><div className="flex flex-wrap gap-3">{(['normal','diwali'] as const).map(t=><button key={t} type="button" disabled={busy||!loaded||!!error||theme===t} className="btn-secondary min-h-12" aria-pressed={theme===t} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy(true);setMessage('');try{await save(t);setMessage('Theme saved for all users.');}catch(e){setMessage(erpErrorMessage(e));void reload();}finally{lock.current=false;setBusy(false);}}}>{t==='diwali'?'🪔 Royal Diwali':'Normal'}</button>)}</div>{busy&&<p role="status">Saving theme…</p>}{error&&<p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={()=>void reload()}>Reload theme settings</button></p>}{message&&<p role="status">{message}</p>}</section>;
}
