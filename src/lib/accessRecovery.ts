export function safeReturnPath(value:string|null){
 if(!value||!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/';
 const path=value.split(/[?#]/)[0];
 if(['/reconnect','/access-denied','/login'].includes(path))return '/';
 return value;
}
export function accessDecision(error:unknown,allowed:boolean){return error?'retry':allowed?'allow':'deny';}
