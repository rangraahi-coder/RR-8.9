type ApiError = {message?:string;code?:string;hint?:string;details?:string};
export function erpErrorMessage(error:unknown):string{
 const e=(error&&typeof error==='object'?error:{message:typeof error==='string'?error:''}) as ApiError;
 const message=e.message||'';
 if(e.code==='23503')return 'This entry is linked to another record and cannot be changed/deleted. '+message;
 if(e.code==='23505')return 'An entry with this unique value already exists. '+message;
 if(e.code==='23502')return 'A required field is missing. '+message;
 if(e.code==='42501'||/row.level security|permission denied/i.test(message))return 'Your account does not have permission for this operation. Ask the Owner to check access.';
 if(/failed to fetch|networkerror|load failed/i.test(message))return 'Connection failed. Check your connection and verify whether the entry was saved before retrying.';
 if(!message)return 'The server did not provide an error reason. Verify the entry before retrying.';
 return [message,e.code==='P0001'?e.hint:undefined].filter(Boolean).join(' ');
}
