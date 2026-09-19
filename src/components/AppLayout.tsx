'use client';
import MobileNavigation from '@/components/MobileNavigation';
import React,{useEffect,useState} from 'react';
import {useRouter,usePathname} from 'next/navigation';
import Sidebar from '@/components/erp/Sidebar';
import TopBar from '@/components/erp/TopBar';
import {useAuth} from '@/contexts/AuthContext';
import {LanguageProvider,useLanguage} from '@/contexts/LanguageContext';
interface Props {render:(lang:'en'|'hi',searchQuery?:string)=>React.ReactNode;pageTitle:string;pageTitleHi:string;}
function Content({render,pageTitle,pageTitleHi}:Props){
 const {lang}=useLanguage(); const [collapsed,setCollapsed]=useState(false); const [search,setSearch]=useState('');
 const {verifiedUser,loading,sessionStatus,authError,canAccessRoute,getDefaultRoute,accessLoading,accessError,refreshAccess}=useAuth();
 const router=useRouter(); const pathname=usePathname();
 useEffect(()=>{if(!loading&&sessionStatus==='signed-out')router.replace('/login?redirect='+encodeURIComponent(pathname));
 else if(!loading&&!accessLoading&&!accessError&&sessionStatus==='signed-in'&&!canAccessRoute(pathname))router.replace(getDefaultRoute());},[loading,accessLoading,sessionStatus,pathname,router,canAccessRoute,getDefaultRoute,accessError]);
 useEffect(()=>{if(sessionStatus==='signed-in'&&!accessLoading&&!accessError&&canAccessRoute(pathname)){try{sessionStorage.removeItem('erp-reconnect');}catch{}}},[sessionStatus,accessLoading,accessError,canAccessRoute,pathname]);
 useEffect(()=>{if(sessionStatus==='failed'||accessError)router.replace('/reconnect?next='+encodeURIComponent(pathname));},[sessionStatus,accessError,router,pathname]);
 useEffect(()=>{if(verifiedUser?.user_metadata?.must_change_password)router.replace('/change-password');},[verifiedUser,router]);
 if(sessionStatus==='failed')return <div className="min-h-screen flex items-center justify-center bg-background"><div className="card p-6"><p role="alert">{authError || 'Session verification failed.'}</p><button className="btn-primary mt-4" onClick={()=>window.location.reload()}>Retry</button></div></div>;
 if(accessError)return <div className="p-8"><p role="alert">{accessError}</p><button onClick={refreshAccess}>Retry</button></div>;
 if(verifiedUser?.user_metadata?.must_change_password)return <div>Opening password change…</div>;
 if(loading||accessLoading||sessionStatus!=='signed-in')return <div className="min-h-screen flex items-center justify-center bg-background">Loading…</div>;
 if(!canAccessRoute(pathname))return <div className="p-6">Redirecting…</div>;
 return <div className="flex h-[100dvh] overflow-hidden bg-background"><div className="hidden md:block"><Sidebar collapsed={collapsed} onToggle={()=>setCollapsed(v=>!v)}/></div><div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${collapsed?'md:ml-16':'md:ml-64'}`}><TopBar onSearch={setSearch}/><main className="erp-workspace flex-1 overflow-y-auto scrollbar-thin pb-24 md:pb-0"><div className="px-3 py-4 md:px-6 md:py-6 xl:px-8 2xl:px-10 max-w-screen-2xl mx-auto"><div className="mb-5 text-sm text-muted-foreground">Rangraahi Powerhouse <span className="mx-2">›</span> {lang==='hi'?pageTitleHi:pageTitle}</div>{render(lang,search)}</div></main><MobileNavigation/></div></div>;
}
export default function AppLayout(props:Props){return <LanguageProvider><Content {...props}/></LanguageProvider>;}
