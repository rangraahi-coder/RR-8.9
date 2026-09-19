'use client';

export type UserRole = 'full' | 'manufacturing';

export interface UserAccess {
  username: string;
  role: UserRole;
  allowedGroups: string[] | 'all';
}

// Username → access mapping
const USER_ACCESS_MAP: Record<string, UserAccess> = {
  KPL: {
    username: 'KPL',
    role: 'full',
    allowedGroups: 'all',
  },
  Ishu: {
    username: 'Ishu',
    role: 'full',
    allowedGroups: 'all',
  },
  Ashish: {
    username: 'Ashish',
    role: 'manufacturing',
    allowedGroups: ['workflow'],
  },
  Raghav: {
    username: 'Raghav',
    role: 'full',
    allowedGroups: 'all',
  },
  Sheetal: {
    username: 'Sheetal',
    role: 'full',
    allowedGroups: 'all',
  },
};

// Routes allowed for each group
export const GROUP_ROUTES: Record<string, string[]> = {
  main: ['/'],
  production: ['/job-card-management', '/sales-orders', '/item-master', '/production-batch'],
  mfg: ['/mfg-dashboard', '/mfg-orders', '/mfg-master-sets', '/mfg-production', '/mfg-compilation'],
  workflow: [
    '/grey-fabric',
    '/dyeing-printing',
    '/fabric-inventory',
    '/fabric-stock-tracker',
    '/cutting',
    '/production-workflow',
    '/finished-goods',
    '/dispatch',
  ],
  accounts: ['/account-master', '/account-master/import'],
  system: [],
};

export function getUserAccess(username: string): UserAccess | null {
  return USER_ACCESS_MAP[username] ?? null;
}

export function canAccessRoute(username: string, pathname: string): boolean {
  const aliases:Record<string,string>={'/masters/items':'/item-master','/masters/accounts':'/account-master','/masters/operators':'/operator-master','/job-cards':'/job-card-management','/production/dyeing':'/dyeing-printing','/production/cutting':'/cutting','/production/stitching':'/stitching','/production/qc':'/qc-entry','/production/embroidery':'/embroidery-accessory','/production/finishing':'/finishing-entry','/production/finished-goods':'/finished-goods','/production/fabric-inventory':'/fabric-inventory','/production/contractor-finishing':'/contractor-finishing','/procurement/grey-fabric':'/grey-fabric','/accounts/printer-ledger':'/printer-ledger'};
  for(const [alias,target]of Object.entries(aliases))if(pathname===alias||pathname.startsWith(alias+'/')){pathname=target+pathname.slice(alias.length);break;}
  const access = getUserAccess(username);
  if (!access) return false;
  if (access.allowedGroups === 'all') return true;

  // Check if pathname starts with any allowed group route
  for (const group of access.allowedGroups) {
    const routes = GROUP_ROUTES[group] ?? [];
    for (const route of routes) {
      if (pathname === route || pathname.startsWith(route + '/')) {
        return true;
      }
    }
  }
  return false;
}

export function getDefaultRoute(username: string): string {
  const access = getUserAccess(username);
  if (!access) return '/sign-up-login-screen';
  if (access.allowedGroups === 'all') return '/';
  // Manufacturing only → redirect to grey-fabric as first workflow page
  return '/grey-fabric';
}
