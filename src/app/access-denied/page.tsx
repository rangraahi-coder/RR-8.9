'use client';
import {useEffect} from 'react';
import {useAuth} from '@/contexts/AuthContext';
import {safeReturnPath} from '@/lib/accessRecovery';
export default function Page(){
 const {signOut,loading,accessLoading,accessError,sessionStatus,canAccessRoute}=useAuth();
 useEffect(()=>{if(loading||accessLoading)return;const path=safeReturnPath(new URLSearchParams(window.location.search).get('next'));if(accessError||sessionStatus==='failed'){window.location.replace('/reconnect?next='+encodeURIComponent(path));return;}if(sessionStatus==='signed-in'&&canAccessRoute(path))window.location.replace(path);},[loading,accessLoading,accessError,sessionStatus,canAccessRoute]);
 return <main className="p-8"><h1 className="text-xl font-semibold">{loading||accessLoading?'Checking access…':'Access unavailable'}</h1>{!loading&&!accessLoading&&<><p className="my-4">Your account does not currently have access to this page. Ask your administrator to check your module permissions.</p><button className="btn-secondary mr-3" onClick={()=>window.location.replace('/reconnect?next='+encodeURIComponent(safeReturnPath(new URLSearchParams(window.location.search).get('next'))))}>Check again</button><button className="btn-secondary" onClick={()=>signOut()}>Sign out</button></>}</main>;
}
