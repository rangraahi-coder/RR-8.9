'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ClipboardList, ShoppingCart, BookOpen, Package, Truck, Settings, ChevronLeft, ChevronRight, Bell, AlertTriangle, Factory, FileText, Scissors, Droplets, CheckCircle2, Shirt, Contact, Sparkles, Users, Wrench, BookMarked } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { useRealtimeData } from '@/contexts/RealtimeDataContext';

interface NavItem {
  id: string;
  labelEn: string;
  labelHi: string;
  icon: React.ReactNode;
  href: string;
  badgeVariant?: 'danger' | 'warning' | 'info';
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-dashboard', labelEn: 'Dashboard', labelHi: 'डैशबोर्ड', icon: <LayoutDashboard size={18} />, href: '/', group: 'main' },
  { id: 'nav-item-master', labelEn: 'Item Master', labelHi: 'आइटम मास्टर', icon: <Package size={18} />, href: '/item-master', group: 'main' },
  { id: 'nav-account-master', labelEn: 'Account Master', labelHi: 'खाता मास्टर', icon: <Contact size={18} />, href: '/account-master', group: 'main' },
  { id: 'nav-jobcards', labelEn: 'Job Cards', labelHi: 'जॉब कार्ड', icon: <ClipboardList size={18} />, href: '/job-card-management', badgeVariant: 'danger', group: 'production' },
  { id: 'nav-salesorders', labelEn: 'Sales Orders', labelHi: 'सेल्स ऑर्डर', icon: <FileText size={18} />, href: '/sales-orders', badgeVariant: 'info', group: 'production' },
  { id: 'nav-grey-fabric', labelEn: 'Grey Fabric', labelHi: 'ग्रे फैब्रिक', icon: <Package size={18} />, href: '/grey-fabric', group: 'workflow' },
  { id: 'nav-dyeing-printing', labelEn: 'Dyeing / Processing', labelHi: 'रंगाई / प्रोसेसिंग', icon: <Droplets size={18} />, href: '/dyeing-printing', group: 'workflow' },
  { id: 'nav-printer-ledger', labelEn: 'Printer Ledger', labelHi: 'प्रिंटर लेजर', icon: <BookMarked size={18} />, href: '/printer-ledger', group: 'workflow' },
  { id: 'nav-fabric-inventory', labelEn: 'Fabric Entry', labelHi: 'फैब्रिक एंट्री', icon: <Package size={18} />, href: '/fabric-inventory', group: 'workflow' },
  { id: 'nav-cutting', labelEn: 'Cutting', labelHi: 'कटाई', icon: <Scissors size={18} />, href: '/cutting', group: 'workflow' },
  { id: 'nav-embroidery-accessory', labelEn: 'Embroidery & Accessory', labelHi: 'कढ़ाई और एक्सेसरी', icon: <Sparkles size={18} />, href: '/embroidery-accessory', group: 'workflow' },
  { id: 'nav-stitching', labelEn: 'Stitching', labelHi: 'सिलाई', icon: <Shirt size={18} />, href: '/stitching', group: 'workflow' },
  { id: 'nav-contractor-finishing', labelEn: 'Contractor Finishing', labelHi: 'कॉन्ट्रैक्टर फिनिशिंग', icon: <Wrench size={18} />, href: '/contractor-finishing', group: 'workflow' },
  { id: 'nav-operator-master', labelEn: 'Operator Master', labelHi: 'ऑपरेटर मास्टर', icon: <Users size={18} />, href: '/operator-master', group: 'workflow' },
  { id: 'nav-finished-goods', labelEn: 'Finished Goods', labelHi: 'तैयार माल', icon: <CheckCircle2 size={18} />, href: '/finished-goods', group: 'workflow' },
  { id: 'nav-dispatch', labelEn: 'Dispatch', labelHi: 'डिस्पैच', icon: <Truck size={18} />, href: '/dispatch', group: 'workflow' },
  { id: 'nav-purchases', labelEn: 'Purchases', labelHi: 'खरीद', icon: <ShoppingCart size={18} />, href: '#', group: 'accounts' },
  { id: 'nav-ledger', labelEn: 'Ledger', labelHi: 'खाता बही', icon: <BookOpen size={18} />, href: '#', group: 'accounts' },
  { id: 'nav-settings', labelEn: 'Settings', labelHi: 'सेटिंग', icon: <Settings size={18} />, href: '#', group: 'system' },
];

const GROUP_LABELS: Record<string, { en: string; hi: string }> = {
  main: { en: 'Overview', hi: 'अवलोकन' },
  production: { en: 'Production', hi: 'उत्पादन' },
  workflow: { en: 'Manufacturing Workflow', hi: 'मैन्युफैक्चरिंग वर्कफ्लो' },
  accounts: { en: 'Accounts', hi: 'हिसाब' },
  system: { en: 'System', hi: 'सिस्टम' },
};

interface SidebarProps {
  lang?: 'en' | 'hi';
}

export default function Sidebar({ lang = 'hi' }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { username, canAccessRoute } = useAuth();
  const { blockedJobCards, totalSalesOrders } = useRealtimeData();

  // Map nav item id → live badge count
  const liveBadges: Record<string, number | undefined> = {
    'nav-jobcards': blockedJobCards > 0 ? blockedJobCards : undefined,
    'nav-salesorders': totalSalesOrders > 0 ? totalSalesOrders : undefined,
  };

  const groups = ['main', 'production', 'workflow', 'accounts', 'system'];

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!username) return false;
    if (item.href === '#') {
      const groupRouteMap: Record<string, string> = {
        main: '/',
        production: '/job-card-management',
        workflow: '/grey-fabric',
        accounts: '/account-master',
        system: '/',
      };
      const rep = groupRouteMap[item.group] ?? '/';
      return canAccessRoute(rep);
    }
    return canAccessRoute(item.href);
  });

  const badgeColors: Record<string, string> = {
    danger: 'bg-danger text-white',
    warning: 'bg-warning text-white',
    info: 'bg-info text-white',
  };

  return (
    <aside
      className={`sidebar-transition flex flex-col bg-white border-r border-border h-screen sticky top-0 overflow-hidden ${
        collapsed ? 'w-16 min-w-[64px]' : 'w-60 min-w-[240px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-hidden">
          <AppLogo size={32} src="/assets/images/ChatGPT_Image_Aug_4__2026__04_54_51_PM-1785842705489.png" />
          {!collapsed && (
            <div className="overflow-hidden">
              <img
                src="/assets/images/ChatGPT_Image_Aug_4__2026__04_54_51_PM-1785842705489.png"
                alt="Rangraahi Creation Logo"
                className="h-8 w-auto object-contain"
              />
              <span className="text-xs text-muted-foreground font-500 block font-body">
                {lang === 'hi' ? 'फैक्ट्री प्रबंधन' : 'Factory Management'}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-all duration-150 flex-shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-hide">
        {groups.map((group) => {
          const items = visibleNavItems.filter((i) => i.group === group);
          if (items.length === 0) return null;
          return (
            <div key={`group-${group}`} className="mb-5">
              {!collapsed && (
                <p className="section-label px-4 mb-2">
                  {lang === 'hi' ? GROUP_LABELS[group].hi : GROUP_LABELS[group].en}
                </p>
              )}
              {items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const badgeCount = liveBadges[item.id];
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={collapsed ? (lang === 'hi' ? item.labelHi : item.labelEn) : undefined}
                    className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl text-sm font-500 transition-all duration-150 group relative font-body ${
                      isActive
                        ? 'bg-primary/10 text-primary font-600' :'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <span className={`flex-shrink-0 ${isActive ? 'text-primary' : ''}`}>{item.icon}</span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">
                          {lang === 'hi' ? item.labelHi : item.labelEn}
                        </span>
                        {badgeCount !== undefined && (
                          <span
                            className={`text-xs font-700 px-1.5 py-0.5 rounded-full ${
                              badgeColors[item.badgeVariant || 'info']
                            }`}
                          >
                            {badgeCount}
                          </span>
                        )}
                      </>
                    )}
                    {collapsed && badgeCount !== undefined && (
                      <span
                        className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                          item.badgeVariant === 'danger' ? 'bg-danger' : 'bg-warning'
                        }`}
                      />
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Alerts section */}
      {!collapsed && blockedJobCards > 0 && (
        <Link href="/job-card-management" className="mx-3 mb-3 p-3 bg-danger-bg rounded-xl block hover:bg-danger/10 transition-colors duration-150">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-danger" />
            <span className="text-xs font-700 text-danger font-body">
              {lang === 'hi' ? `${blockedJobCards} जॉब कार्ड रुके हैं` : `${blockedJobCards} Job Card${blockedJobCards !== 1 ? 's' : ''} Blocked`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-body">
            {lang === 'hi' ? 'तुरंत ध्यान दें / Needs immediate attention' : 'Needs immediate attention'}
          </p>
        </Link>
      )}

      {/* User */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
            <Factory size={14} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-600 text-foreground truncate font-display">Kapil Mundhra</p>
              <p className="text-xs text-muted-foreground truncate font-body">
                {lang === 'hi' ? 'मालिक / Owner' : 'Owner / मालिक'}
              </p>
            </div>
          )}
          {!collapsed && (
            <button className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-all duration-150">
              <Bell size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}