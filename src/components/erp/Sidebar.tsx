'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, ShoppingBag, FileText, Package, Truck,
  Settings, ClipboardList, ChevronDown, ChevronRight,
  Users, Scissors, Palette, Box, Star, Zap, CheckCircle,
  BookOpen, Printer, ShieldCheck, Layers, BarChart2,
  Menu, X, Factory
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';

interface NavItem {
  key: string;
  labelKey: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  key: string;
  labelKey: string;
  icon: React.ReactNode;
  items?: NavItem[];
  href?: string;
  badge?: number;
}

const navGroups: NavGroup[] = [
  {key:'users',labelKey:'nav.users',href:'/users',icon:<Users size={18}/>},
  {
    key: 'dashboard', labelKey: 'nav.dashboard', href: '/',
    icon: <LayoutDashboard size={18} />,
  },
  {
    key: 'masters', labelKey: 'nav.masters', icon: <BookOpen size={18} />,
    items: [
      { key: 'items', labelKey: 'nav.items', href: '/item-master', icon: <Layers size={16} /> },
      { key: 'accounts', labelKey: 'nav.accounts', href: '/account-master', icon: <Users size={16} /> },
      { key: 'operators', labelKey: 'nav.operators', href: '/operator-master', icon: <Users size={16} /> },
    ],
  },
  {
    key: 'sales', labelKey: 'nav.sales', icon: <ShoppingBag size={18} />,
    items: [
      { key: 'orders', labelKey: 'nav.orders', href: '/sales-orders', icon: <FileText size={16} /> },
      { key: 'jobcards', labelKey: 'nav.jobcards', href: '/job-card-management', icon: <ClipboardList size={16} /> },
    ],
  },
  {
    key: 'procurement', labelKey: 'nav.procurement', icon: <Package size={18} />,
    items: [
      {key:'stocktracker',labelKey:'nav.stocktracker',href:'/fabric-stock-tracker',icon:<Package size={16}/>},
      { key: 'greyfabric', labelKey: 'nav.greyfabric', href: '/grey-fabric', icon: <Box size={16} /> },
    ],
  },
  {
    key: 'production', labelKey: 'nav.production', icon: <Factory size={18} />,
    items: [
      { key: 'dyeing', labelKey: 'nav.dyeing', href: '/dyeing-printing', icon: <Palette size={16} /> },
      { key: 'fabric', labelKey: 'nav.fabric', href: '/fabric-inventory', icon: <Layers size={16} /> },
      { key: 'cutting', labelKey: 'nav.cutting', href: '/cutting', icon: <Scissors size={16} /> },
      { key: 'embroidery', labelKey: 'nav.embroidery', href: '/embroidery-accessory', icon: <Star size={16} /> },
      { key: 'handwork', labelKey: 'nav.handwork', href: '/handwork', icon: <Star size={16} /> },
      { key: 'stitching', labelKey: 'nav.stitching', href: '/stitching', icon: <Zap size={16} /> },
      { key: 'qc', labelKey: 'nav.qc', href: '/qc-entry', icon: <CheckCircle size={16} /> },
      { key: 'contractorfinishing', labelKey: 'nav.contractorfinishing', href: '/contractor-finishing', icon: <Users size={16} /> },
      { key: 'finishing', labelKey: 'nav.finishing', href: '/finishing-entry', icon: <Box size={16} /> },
      { key: 'finishedgoods', labelKey: 'nav.finishedgoods', href: '/finished-goods', icon: <Package size={16} /> },
    ],
  },
  {
    key: 'dispatch', labelKey: 'nav.dispatch', href: '/dispatch',
    icon: <Truck size={18} />,
  },
  {
    key: 'accounts_group', labelKey: 'nav.accounts_group', icon: <BarChart2 size={18} />,
    items: [
      { key: 'printerledger', labelKey: 'nav.printerledger', href: '/printer-ledger', icon: <Printer size={16} /> },
    ],
  },
  {
    key: 'settings', labelKey: 'nav.settings', href: '/settings',
    icon: <Settings size={18} />,
  },
  {
    key: 'audit', labelKey: 'nav.audit', href: '/audit',
    icon: <ShieldCheck size={18} />,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const {verifiedUser,canAccessRoute}=useAuth();
  const { t } = useLanguage();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    sales: true,
    production: false,
    masters: false,
    procurement: false,
    accounts_group: false,
  });

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isGroupActive = (group: NavGroup): boolean => {
    if (group.href) return isActive(group.href);
    return group.items?.some((item) => isActive(item.href)) ?? false;
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col sidebar-bg border-r border-sidebar z-40 transition-all duration-300 ease-in-out ${collapsed ? 'w-16' : 'w-64'}`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-sidebar px-4 flex-shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <AppLogo size={32} />
            <span className="font-bold text-white text-base tracking-tight">KurtiERP</span>
          </div>
        )}
        {collapsed && <AppLogo size={28} />}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-sidebar hover:text-white hover:sidebar-item-hover transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <Menu size={18} /> : <X size={18} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        {navGroups.filter(group => group.href ? canAccessRoute(group.href) : group.items?.some(item=>canAccessRoute(item.href))).map((group) => {
          const groupActive = isGroupActive(group);

          if (group.href && !group.items) {
            // Direct link item
            return (
              <Link
                key={`nav-${group.key}`}
                href={group.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all duration-150 group relative ${
                  isActive(group.href)
                    ? 'sidebar-item-active text-pink-300 font-semibold' :'text-sidebar hover:sidebar-item-hover hover:text-white'
                }`}
                title={collapsed ? t(group.labelKey) : undefined}
              >
                <span className={`flex-shrink-0 ${isActive(group.href) ? 'text-pink-400' : 'text-sidebar group-hover:text-white'}`}>
                  {group.icon}
                </span>
                {!collapsed && (
                  <span className="text-sm truncate">{t(group.labelKey)}</span>
                )}
                {!collapsed && group.badge && group.badge > 0 && (
                  <span className="ml-auto bg-primary text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                    {group.badge}
                  </span>
                )}
                {collapsed && group.badge && group.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
                )}
              </Link>
            );
          }

          // Collapsible group
          return (
            <div key={`group-${group.key}`} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group ${
                  groupActive && collapsed
                    ? 'sidebar-item-active text-pink-300' :'text-sidebar hover:sidebar-item-hover hover:text-white'
                }`}
                title={collapsed ? t(group.labelKey) : undefined}
              >
                <span className={`flex-shrink-0 ${groupActive ? 'text-pink-400' : 'text-sidebar group-hover:text-white'}`}>
                  {group.icon}
                </span>
                {!collapsed && (
                  <>
                    <span className={`text-sm truncate flex-1 text-left ${groupActive ? 'text-white font-semibold' : ''}`}>
                      {t(group.labelKey)}
                    </span>
                    <span className="text-slate-500">
                      {openGroups[group.key] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </>
                )}
              </button>

              {!collapsed && openGroups[group.key] && group.items && (
                <div className="ml-4 mt-0.5 border-l border-slate-700 pl-2 space-y-0.5 animate-fade-in">
                  {group.items.filter(item=>canAccessRoute(item.href)).map((item) => (
                    <Link
                      key={`nav-item-${item.key}`}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                        isActive(item.href)
                          ? 'bg-primary text-white font-semibold' :'text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      <span className="truncate">{t(item.labelKey)}</span>
                      {item.badge && item.badge > 0 && (
                        <span className="ml-auto bg-pink-500/20 text-pink-300 text-xs font-bold px-1.5 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="p-4 border-t border-sidebar flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {verifiedUser?.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{verifiedUser?.email?.split("@")[0] ?? "User"}</p>
              <p className="text-slate-400 text-xs truncate">KurtiERP</p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}