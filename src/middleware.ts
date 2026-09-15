import {accessDecision} from '@/lib/accessRecovery';
import {routeAllowed} from '@/lib/moduleAccess';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/sign-up-login-screen', '/auth/callback', '/reconnect'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  // Check Supabase session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: {name: string; value: string; options: CookieOptions}[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const recover=()=>{const url=new URL('/reconnect',request.url);url.searchParams.set('next',pathname+request.nextUrl.search);const redirect=NextResponse.redirect(url);response.cookies.getAll().forEach(cookie=>redirect.cookies.set(cookie));return redirect;};
  try {
  const { data: { user }, error } = await supabase.auth.getUser();
  if(error && !['AuthSessionMissingError'].includes(error.name) && error.status!==401 && error.status!==403)return recover();

  if (error || !user) {
    // Not authenticated — redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    return redirect;
  }

  if(pathname!=='/access-denied'){
    const {data:profile,error:accessError}=await supabase.from('erp_user_access').select('*').eq('user_id',user.id).maybeSingle();
    const decision=accessDecision(accessError,routeAllowed(profile,pathname));
    if(decision==='retry')return recover();
    if(decision==='deny'){
      const url=new URL('/access-denied',request.url);url.searchParams.set('next',pathname+request.nextUrl.search);const denied=NextResponse.redirect(url);
      response.cookies.getAll().forEach(cookie=>denied.cookies.set(cookie));return denied;
    }
  }
  return response;
  } catch { return recover(); }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|assets|api).*)',
  ],
};
