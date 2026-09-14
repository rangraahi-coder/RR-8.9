'use client';
import {useAuth} from '@/contexts/AuthContext';
export default function Page(){const {signOut}=useAuth();return <main className="p-8"><h1 className="text-xl font-semibold">Access unavailable</h1><p className="my-4">Ask your administrator to activate your account and assign module access.</p><button className="btn-secondary" onClick={()=>signOut()}>Sign out</button></main>;}
