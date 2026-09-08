'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Bell, Globe, LogOut, X, ClipboardList, ShoppingCart, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useRealtimeData, RealtimeEvent } from '@/contexts/RealtimeDataContext';

interface TopbarProps {
  lang: 'en' | 'hi';
  onLangToggle: () => void;
  pageTitle: string;
  pageTitleHi: string;
  onSearch?: (value: string) => void;
}

function formatEventTime(ts: Date): string {
  const diff = Math.floor((Date.now() - ts.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function eventIcon(event: RealtimeEvent) {
  if (event.table === 'job_cards') return <ClipboardList size={13} className="text-primary flex-shrink-0" />;
  if (event.table === 'sales_orders') return <ShoppingCart size={13} className="text-emerald-600 flex-shrink-0" />;
  return <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />;
}

function eventBadge(eventType: string): string {
  if (eventType === 'INSERT') return 'bg-emerald-100 text-emerald-700';
  if (eventType === 'DELETE') return 'bg-red-100 text-red-700';
  return 'bg-blue-100 text-blue-700';
}

function eventLabel(eventType: string, lang: 'en' | 'hi'): string {
  if (lang === 'hi') {
    if (eventType === 'INSERT') return 'जोड़ा';
    if (eventType === 'DELETE') return 'हटाया';
    return 'बदला';
  }
  if (eventType === 'INSERT') return 'Added';
  if (eventType === 'DELETE') return 'Deleted';
  return 'Updated';
}

export default function Topbar({ lang, onLangToggle, pageTitle, pageTitleHi, onSearch }: TopbarProps) {
  const [searchVal, setSearchVal] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const { signOut, username } = useAuth();
  const router = useRouter();
  const notifRef = useRef<HTMLDivElement>(null);

  const { recentEvents, blockedJobCards } = useRealtimeData();

  const unreadCount = recentEvents.length - seenCount;
  const hasAlert = unreadCount > 0 || blockedJobCards > 0;

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);

  const handleBellClick = () => {
    setShowNotifications((v) => !v);
    if (!showNotifications) {
      // Mark all as seen when opening
      setSeenCount(recentEvents.length);
    }
  };

  const handleLogout = async () => {
    try {
      document.cookie = 'erp_local_auth=; path=/; max-age=0';
      await signOut();
      toast.success('लॉगआउट हो गए / Logged out');
      router.push('/sign-up-login-screen');
    } catch {
      document.cookie = 'erp_local_auth=; path=/; max-age=0';
      router.push('/sign-up-login-screen');
    }
  };

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-30">
      {/* Page Title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-700 text-foreground truncate font-display tracking-tight">
          {lang === 'hi' ? pageTitleHi : pageTitle}
        </h1>
      </div>

      {/* Search */}
      <div className="relative hidden md:flex items-center">
        <Search size={14} className="absolute left-3 text-muted-foreground" />
        <input
          type="text"
          value={searchVal}
          onChange={(e) => {
            setSearchVal(e.target.value);
            onSearch?.(e.target.value);
          }}
          placeholder={lang === 'hi' ? 'जॉब कार्ड, पार्टी खोजें...' : 'Search job cards, parties...'}
          className="input-field pl-8 w-64 h-9 text-xs"
        />
      </div>

      {/* Lang Toggle */}
      <button
        onClick={onLangToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted hover:bg-border text-sm font-600 text-muted-foreground transition-all duration-150 font-body"
        title={lang === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
      >
        <Globe size={14} />
        <span>{lang === 'hi' ? 'EN' : 'हि'}</span>
      </button>

      {/* Alerts Bell with live notifications */}
      <div className="relative" ref={notifRef}>
        <button
          onClick={handleBellClick}
          className="relative p-2 rounded-xl hover:bg-muted text-muted-foreground transition-all duration-150"
          title={lang === 'hi' ? 'सूचनाएं' : 'Notifications'}
        >
          <Bell size={16} />
          {hasAlert && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger rounded-full" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-danger text-white text-[9px] font-700 rounded-full flex items-center justify-center px-0.5">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notification Dropdown */}
        {showNotifications && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-700 text-foreground">
                {lang === 'hi' ? 'सूचनाएं' : 'Notifications'}
              </span>
              <button
                onClick={() => setShowNotifications(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
              >
                <X size={13} />
              </button>
            </div>

            {/* Blocked jobs alert */}
            {blockedJobCards > 0 && (
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-red-50 border-b border-red-100">
                <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                <span className="text-xs text-red-700 font-600">
                  {blockedJobCards} {lang === 'hi' ? 'जॉब कार्ड रुके हुए हैं' : 'job cards are blocked'}
                </span>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
              {recentEvents.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    {lang === 'hi' ? 'कोई हालिया गतिविधि नहीं' : 'No recent activity'}
                  </p>
                </div>
              ) : (
                recentEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-2.5 px-4 py-2.5 hover:bg-muted/40 transition-colors">
                    {eventIcon(event)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-600 text-foreground truncate">{event.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatEventTime(event.timestamp)}
                      </p>
                    </div>
                    <span className={`text-[9px] font-700 px-1.5 py-0.5 rounded-full flex-shrink-0 ${eventBadge(event.eventType)}`}>
                      {eventLabel(event.eventType, lang)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User + Logout */}
      <div className="flex items-center gap-2">
        {username && (
          <span className="hidden sm:block text-xs font-600 text-muted-foreground bg-muted px-2.5 py-1 rounded-xl font-body">
            {username}
          </span>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 p-2 rounded-xl hover:bg-danger/10 text-muted-foreground hover:text-danger transition-all duration-150"
          title={lang === 'hi' ? 'लॉगआउट' : 'Logout'}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}