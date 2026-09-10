'use client';

import Link from 'next/link';
import {useRealtimeData} from '@/contexts/RealtimeDataContext';
import React, { useState } from 'react';
import { Bell, Search, ChevronDown, LogOut, User, Settings, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import type { Language } from '@/types/erp';

export default function TopBar({onSearch}:{onSearch?:(value:string)=>void}) {
  const { lang, setLang, t } = useLanguage();
  const { verifiedUser, sessionStatus, authError, signOut, canAccessRoute } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const {recentEvents}=useRealtimeData();
  const notifications=recentEvents.map(e=>({id:e.id,text:e.label,time:e.timestamp.toLocaleTimeString()}));

  // Derive display name from verified user — never expose tokens or full email
  const userEmail: string = verifiedUser?.email ?? '';
  const userInitial: string = userEmail ? userEmail[0].toUpperCase() : '?';
  // Show only the local part of the email (before @) as display name
  const displayName: string = userEmail ? userEmail.split('@')[0] : 'Not signed in';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // Sign-out errors are non-critical; page will redirect via auth state change
    }
  };

  return (
    <>
      {/* Auth error banner — consumed by TopBar as a UI consumer of authError */}
      {sessionStatus === 'failed' && authError && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center gap-2 text-xs text-red-700">
          <AlertTriangle size={13} className="flex-shrink-0" />
          <span>Session error: {authError}. Please sign in again.</span>
        </div>
      )}

      <header className="h-14 bg-white border-b border-border flex items-center justify-between px-6 flex-shrink-0 z-30">
        {/* Search */}
        <div className="flex items-center gap-2 bg-slate-50 border border-border rounded-lg px-3 py-1.5 w-64">
          <Search size={15} className="text-slate-400 flex-shrink-0" />
          <input
            type="text"
            onChange={e=>onSearch?.(e.target.value)}
            placeholder={t('common.search')}
            className="bg-transparent text-sm text-slate-700 placeholder:text-slate-400 outline-none w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          {/* Language Toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            {(['en', 'hi'] as Language[]).map((l) => (
              <button
                key={`lang-${l}`}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all duration-150 ${
                  lang === l
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {l === 'en' ? 'EN' : 'हि'}
              </button>
            ))}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); }}
              className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Bell size={18} />
              {notifications.length>0 && <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-10 w-72 bg-white rounded-xl shadow-modal border border-border z-50 animate-slide-up">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-slate-800">Notifications</p>
                </div>
                <div className="divide-y divide-border max-h-64 overflow-y-auto">
                  {notifications.length===0 && <p className="px-4 py-3 text-sm text-slate-500">No recent activity</p>}
                  {notifications.map((n) => (
                    <div key={`notif-${n.id}`} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                      <p className="text-sm text-slate-700">{n.text}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{n.time}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User Menu — shows real verified user info */}
          <div className="relative">
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${sessionStatus === 'signed-in' ? 'bg-primary' : 'bg-slate-400'}`}>
                {userInitial}
              </div>
              <span className="text-sm font-medium text-slate-700 hidden sm:block">{displayName}</span>
              <ChevronDown size={14} className="text-slate-400" />
            </button>
            {showUserMenu && (
              <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-modal border border-border z-50 animate-slide-up">
                <div className="p-1">
                  {canAccessRoute('/settings')&&<Link href="/settings" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                    <User size={15} className="text-slate-400" /> Profile
                  </Link>}
                  {canAccessRoute('/settings')&&<Link href="/settings" className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                    <Settings size={15} className="text-slate-400" /> Settings
                  </Link>}
                  <div className="border-t border-border my-1" />
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}