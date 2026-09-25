'use client';
import {createContext,useContext,useEffect,useState,useCallback,ReactNode,useRef} from 'react';
import {createClient} from '@/lib/supabase/client';
import {useAuth} from '@/contexts/AuthContext';
import {erpErrorMessage} from '@/lib/erpError';
type Theme='normal'|'diwali';
const Context=createContext({theme:'normal' as Theme,revision:0,loaded:false,error:'',reload:async()=>{},save:async(_theme:Theme)=>{}});
export function ERPThemeProvider({children}:{children:ReactNode}){
 const {verifiedUser}=useAuth();const [state,setState]=useState({theme:'normal' as Theme,revision:0,loaded:false,error:''});const generation=useRef(0);
 const reload=useCallback(async()=>{if(!verifiedUser)return;const n=++generation.current;try{const {data,error}=await createClient().rpc('erp_get_theme').abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(!data||!['normal','diwali'].includes(data.theme))throw new Error('Theme settings unavailable');if(n===generation.current)setState({theme:data.theme,revision:data.revision,loaded:true,error:''});}catch(e){if(n===generation.current)setState(s=>({...s,error:erpErrorMessage(e)}));}},[verifiedUser]);
 useEffect(()=>{void reload();const timer=setInterval(()=>void reload(),30000);const focus=()=>void reload();window.addEventListener('focus',focus);return()=>{generation.current++;clearInterval(timer);window.removeEventListener('focus',focus);};},[reload]);
 async function save(theme:Theme){const {data,error}=await createClient().rpc('erp_set_theme',{p_theme:theme,p_revision:state.revision}).abortSignal(AbortSignal.timeout(15000));if(error)throw error;if(!data)throw new Error('Theme save was not confirmed');generation.current++;setState({theme:data.theme,revision:data.revision,loaded:true,error:''});}
 return <Context.Provider value={{...state,reload,save}}>{children}</Context.Provider>;
}
export const useERPTheme=()=>useContext(Context);
