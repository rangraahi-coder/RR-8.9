'use client';
import Link from 'next/link';
import AppLayout from '@/components/AppLayout';
import {useAuth} from '@/contexts/AuthContext';

export default function ProfilePage(){
 const {verifiedUser,accessProfile}=useAuth();
 const name=accessProfile?.display_name||verifiedUser?.email?.split('@')?.[0]||'';
 return <AppLayout pageTitle="My profile" pageTitleHi="मेरी प्रोफाइल" render={lang=><section className="card-surface p-5 max-w-lg space-y-4">
  <h1 className="text-xl font-semibold">{lang==='hi'?'मेरी प्रोफाइल':'My profile'}</h1>
  <div><p className="text-sm text-muted-foreground">{lang==='hi'?'नाम':'Name'}</p><p className="font-medium">{name}</p></div>
  <div className="border-t pt-4"><h2 className="font-medium">{lang==='hi'?'पासवर्ड':'Password'}</h2>
   <p className="text-sm text-muted-foreground mt-1 mb-3">{lang==='hi'?'अपना पासवर्ड यहाँ से बदलें।':'Manage your own password here.'}</p>
   <Link href="/change-password" className="btn-primary inline-flex">{lang==='hi'?'पासवर्ड बदलें':'Change password'}</Link>
  </div>
 </section>}/>;
}
