import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {MODULES} from '@/lib/moduleAccess';
export async function POST(request:NextRequest){
 try{
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return NextResponse.json({error:'Sign in required'},{status:401});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL!,anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const caller=createClient(url,anon,{global:{headers:{Authorization:bearer}},auth:{persistSession:false}});
  const {data:{user},error}=await caller.auth.getUser(bearer.slice(7));
  if(error||!user)return NextResponse.json({error:'Sign in required'},{status:401});
  const {data:profile,error:profileError}=await caller.from('erp_user_access').select('active,is_admin').eq('user_id',user.id).single();
  if(profileError||!profile?.active||!profile.is_admin)return NextResponse.json({error:'Administrator access required'},{status:403});
  const body=await request.json();
  const permissions=body.permissions||{};
  if(Object.entries(permissions).some(([module,actions])=>!MODULES.some(([key])=>key===module)||!Array.isArray(actions)||actions.some(a=>!['view','create','edit','delete'].includes(a))||(actions.length>0&&!actions.includes('view'))))return NextResponse.json({error:'Invalid permissions'},{status:400});
  if(body.userId){
   const {error}=await caller.rpc('erp_set_user_access',{p_user_id:body.userId,p_name:String(body.name||''),p_active:body.active===true,p_admin:body.admin===true,p_permissions:permissions});
   return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({ok:true});
  }
  if(typeof body.email!=='string'||typeof body.password!=='string'||body.password.length<12)return NextResponse.json({error:'Email and a password of at least 12 characters are required'},{status:400});
  const secret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!secret)return NextResponse.json({error:'User creation is not configured on the server. Add SUPABASE_SERVICE_ROLE_KEY in Vercel.'},{status:503});
  const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error:createError}=await admin.auth.admin.createUser({email:body.email.trim(),password:body.password,email_confirm:true,user_metadata:{full_name:String(body.name||'')}});
  if(createError||!data.user)return NextResponse.json({error:createError?.message||'User could not be created'},{status:400});
  const {error:accessError}=await caller.rpc('erp_set_user_access',{p_user_id:data.user.id,p_name:String(body.name||''),p_active:body.active===true,p_admin:body.admin===true,p_permissions:permissions});
  if(accessError)return NextResponse.json({error:'Login created without ERP access. Select this user and save permissions again.',userId:data.user.id},{status:409});
  return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'Unable to complete user request. Please retry.'},{status:500});}
}
