import {createBrowserClient} from '@supabase/ssr';
import {erpFetch} from '@/lib/erpFetch';

export function createClient(){
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {global:{fetch:erpFetch}}
  );
}

// Lazy singleton — only created when first accessed (avoids SSR module-level crash)
let _supabase: ReturnType<typeof createClient> | null = null;
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_supabase) _supabase = createClient();
    return (_supabase as any)[prop];
  }
});
