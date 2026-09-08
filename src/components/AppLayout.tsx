'use client';
import React,{useEffect,useState} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import Sidebar from '@/components/erp/Sidebar';
import TopBar from '@/components/erp/TopBar';
import {useAuth} from '@/contexts/AuthContext';
import {LanguageProvider,useLanguage} from '@/contexts/LanguageContext';
interface Props {render:(lang:'en'|'hi',searchQuery?:string)=>React.ReactNode;pageTitle:string;pageTitleHi:string;}
function Content({render,pageTitle,pageTitleHi}:Props){
 const {lang}=useLanguage(); const [collapsed,setCollapsed]=useState(false); const [search,setSearch]=useState('');
 const {loading,sessionStatus,authError,canAccessRoute,getDefaultRoute}=useAuth();
 const router=useRouter(); const pathname=usePathname();
 useEffect(()=>{if(!loading&&sessionStatus==='signed-out')router.replace('/login?redirect='+encodeURIComponent(pathname));
 else if(!loading&&sessionStatus==='signed-in'&&!canAccessRoute(pathname))router.replace(getDefaultRoute());},[loading,sessionStatus,pathname,router,canAccessRoute,getDefaultRoute]);
 if(sessionStatus==='failed')return <div className="min-h-screen flex items-center justify-center bg-background"><div className="card p-6"><p role="alert">{authError || 'Session verification failed.'}</p><button className="btn-primary mt-4" onClick={()=>window.location.reload()}>Retry</button></div></div>;
 if(loading||sessionStatus!=='signed-in')return <div className="min-h-screen flex items-center justify-center bg-background">Loading…</div>;
 if(!canAccessRoute(pathname))return <div className="p-6">Redirecting…</div>;
 return <div className="flex h-screen overflow-hidden bg-background"><Sidebar collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)}/><div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed?'ml-16':'ml-64'}`}><TopBar onSearch={setSearch}/><main className="flex-1 overflow-y-auto scrollbar-thin"><div className="px-6 py-6 xl:px-8 2xl:px-10 max-w-screen-2xl mx-auto"><div className="mb-5 text-sm text-muted-foreground">KurtiERP <span className="mx-2">›</span> {lang==='hi'?pageTitleHi:pageTitle}</div>{render(lang,search)}</div></main></div></div>;
}
export default function AppLayout(props:Props){return <LanguageProvider><Content {...props}/></LanguageProvider>;}
