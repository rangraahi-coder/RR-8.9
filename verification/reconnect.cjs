const ts=require('typescript'),fs=require('fs'),assert=require('node:assert/strict');
function mod(file,requireFn=require){const m={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText)(requireFn,m,m.exports);return m.exports;}
const recovery=mod('src/lib/accessRecovery.ts'),access=mod('src/lib/moduleAccess.ts');
for(const p of ['https://evil.example','//evil.example','/\\evil.example','/reconnect','/access-denied',null])assert.equal(recovery.safeReturnPath(p),'/');assert.equal(recovery.safeReturnPath('/cutting?job=1'),'/cutting?job=1');
let state={};const response=(kind,url)=>({kind,url:url?.toString(),cookies:{set(){},getAll(){return[];}}});
const {middleware}=mod('src/middleware.ts',name=>name==='@/lib/accessRecovery'?recovery:name==='@/lib/moduleAccess'?access:name==='next/server'?{NextResponse:{next:()=>response('next'),redirect:url=>response('redirect',url)}}:name==='@supabase/ssr'?{createServerClient:()=>({auth:{getUser:async()=>{if(state.throwAuth)throw Error('Offline');return state.auth;}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>state.profile})})})})}:require(name));
const request=()=>({url:'https://erp.example/cutting?job=1',nextUrl:new URL('https://erp.example/cutting?job=1'),cookies:{getAll:()=>[],set(){}}});
(async()=>{const valid={data:{user:{id:'one'}},error:null};
state={auth:valid,profile:{data:null,error:{message:'Failed to fetch'}}};assert.match((await middleware(request())).url,/\/reconnect\?/);
state={auth:valid,profile:{data:{active:false,is_admin:true,permissions:{}},error:null}};assert.match((await middleware(request())).url,/\/access-denied\?/);
state={auth:valid,profile:{data:{active:true,is_admin:true,permissions:{}},error:null}};assert.equal((await middleware(request())).kind,'next');
state={auth:valid,profile:{data:{active:true,is_admin:false,permissions:{cutting:['view']}},error:null}};assert.equal((await middleware(request())).kind,'next');
state={auth:{data:{user:null},error:{name:'AuthRetryableFetchError',status:503}}};assert.match((await middleware(request())).url,/\/reconnect\?/);
state={throwAuth:true};assert.match((await middleware(request())).url,/\/reconnect\?/);
state={auth:{data:{user:null},error:{name:'AuthSessionMissingError'}}};assert.match((await middleware(request())).url,/\/login\?/);
console.log('PASS: transient auth/access errors recover; owner and permitted worker allowed; inactive user denied; missing session signs in; external redirects rejected');})().catch(e=>{console.error(e);process.exit(1)});
