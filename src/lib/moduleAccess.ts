export const MODULES = [
 ['items','Item Master','/item-master'],['accounts','Account Master','/account-master'],['operators','Operator Master','/operator-master'],
 ['sales','Sales Orders','/sales-orders'],['jobs','Job Cards','/job-card-management'],['grey','Grey Fabric','/grey-fabric'],
 ['dyeing','Dyeing / Printing','/dyeing-printing'],['fabric','Fabric Inventory','/fabric-inventory'],['cutting','Cutting','/cutting'],
 ['embroidery','Embroidery','/embroidery-accessory'],['handwork','Handwork','/handwork'],['stitching','Stitching','/stitching'],
 ['qc','QC','/qc-entry'],['contractor','Contractor Finishing / Assembly','/contractor-finishing'],['finishing','Finishing','/finishing-entry'],
 ['ready','Ready Items','/finished-goods'],['dispatch','Dispatch','/dispatch'],['ledger','Printer Ledger','/printer-ledger'],['audit','Audit Trail','/audit'],
] as const;
export type Action = 'view'|'create'|'edit'|'delete';
export type AccessProfile = {user_id:string; display_name:string; active:boolean; is_admin:boolean; is_owner?:boolean; permissions:Record<string,Action[]>};
const aliases:Record<string,string>={'/masters/items':'/item-master','/masters/accounts':'/account-master','/masters/operators':'/operator-master','/job-cards':'/job-card-management','/production/dyeing':'/dyeing-printing','/production/cutting':'/cutting','/production/stitching':'/stitching','/production/qc':'/qc-entry','/production/embroidery':'/embroidery-accessory','/production/finishing':'/finishing-entry','/production/finished-goods':'/finished-goods','/production/fabric-inventory':'/fabric-inventory','/production/contractor-finishing':'/contractor-finishing','/procurement/grey-fabric':'/grey-fabric','/accounts/printer-ledger':'/printer-ledger','/fabric-stock-tracker':'/fabric-inventory','/production-batch':'/job-card-management'};
export function moduleForRoute(path:string){path=path.split('?')[0];for(const [alias,target]of Object.entries(aliases))if(path===alias||path.startsWith(alias+'/')){path=target+path.slice(alias.length);break;}return MODULES.find(([, ,route])=>path===route||path.startsWith(route+'/'))?.[0];}
export function hasPermission(profile:AccessProfile|null,module:string,action:Action='view'){return !!profile?.active&&(profile.is_admin||!!profile.permissions[module]?.includes(action));}
export function routeAllowed(profile:AccessProfile|null,path:string){if(!profile?.active)return false;if(path==='/')return true;if(profile.is_admin)return true;const module=moduleForRoute(path);return !!module&&hasPermission(profile,module);}
