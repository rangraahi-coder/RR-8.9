'use client';
import { getUserAccess, canAccessRoute as legacyCanAccessRoute, getDefaultRoute as legacyDefaultRoute } from '@/lib/userAccess';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

// Session verification status — surfaced to consumers
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out' | 'failed';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

/** AuthSessionMissingError means no session exists — treat as signed-out, not a failure */
function isSessionMissingError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Auth session missing') ||
    msg.includes('AuthSessionMissingError') ||
    msg.includes('session_not_found')
  );
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // verifiedUser: result of getUser() — server-validated, not just session cache
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  // sessionStatus: explicit checking / signed-in / signed-out / failed — never ambiguous
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('checking');

  // Generation counter: incremented each time a new verification is scheduled.
  // A verification result is only applied if its generation matches the current counter.
  // This discards genuinely superseded results without cancelling initialization unconditionally.
  const verifyGenRef = useRef(0);

  // Unmount flag: set true on cleanup so no async result writes state after unmount.
  const unmountedRef = useRef(false);

  // signingInRef: true while signIn() is actively handling its own verification.
  // onAuthStateChange will skip scheduling scheduleVerification() during this window
  // to prevent a concurrent getUser() race that could overwrite signIn()'s result.
  const signingInRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    console.log('[AuthDiag] Starting initial session check');

    // ── scheduleVerification ──────────────────────────────────────────────
    // Runs getUser() OUTSIDE the onAuthStateChange callback (via setTimeout 0)
    // so the callback itself stays synchronous.
    // Accepts the session snapshot that triggered verification and the
    // generation number at the time of scheduling.
    // Only applies the result if the generation still matches (not superseded).
    async function scheduleVerification(sessionSnapshot: any, gen: number) {
      // Yield to the event loop so the synchronous callback completes first.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      if (unmountedRef.current) return;
      if (verifyGenRef.current !== gen) {
        console.log('[AuthDiag] scheduleVerification gen', gen, 'superseded by', verifyGenRef.current, '— discarded');
        return;
      }

      if (!sessionSnapshot?.user) {
        // No session to verify — already handled synchronously in the callback.
        return;
      }

      console.log('[AuthDiag] scheduleVerification gen', gen, '— calling getUser()');
      try {
        const { data: { user: verified }, error: userError } = await supabase.auth.getUser();

        if (unmountedRef.current) return;
        if (verifyGenRef.current !== gen) {
          console.log('[AuthDiag] getUser gen', gen, 'superseded — discarded');
          return;
        }

        if (userError) {
          if (isSessionMissingError(userError)) {
            console.log('[AuthDiag] getUser → session missing (token expired)');
            setVerifiedUser(null);
            setSessionStatus('signed-out');
            setAuthError(null);
            setSession(null);
            setUser(null);
          } else {
            // Verification network/server failure — do NOT clear the session.
            // Report 'failed' so the UI can show an error without signing the user out.
            console.log('[AuthDiag] getUser → error (not session-missing):', userError.message);
            setAuthError(userError.message);
            setVerifiedUser(null);
            setSessionStatus('failed');
          }
        } else if (verified) {
          console.log('[AuthDiag] getUser → verified ✓');
          setVerifiedUser(verified);
          setSessionStatus('signed-in');
          setAuthError(null);
        } else {
          console.log('[AuthDiag] getUser → no user returned');
          setVerifiedUser(null);
          setSessionStatus('signed-out');
          setAuthError(null);
        }
      } catch (err: unknown) {
        if (unmountedRef.current) return;
        if (verifyGenRef.current !== gen) return;
        if (isSessionMissingError(err)) {
          console.log('[AuthDiag] getUser → exception (session missing)');
          setVerifiedUser(null);
          setSessionStatus('signed-out');
          setAuthError(null);
          setSession(null);
          setUser(null);
        } else {
          console.log('[AuthDiag] getUser → unexpected exception');
          setAuthError(err instanceof Error ? err.message : 'User verification failed');
          setVerifiedUser(null);
          setSessionStatus('failed');
        }
      } finally {
        if (!unmountedRef.current && verifyGenRef.current === gen) {
          setLoading(false);
        }
      }
    }

    // ── onAuthStateChange ─────────────────────────────────────────────────
    // SYNCHRONOUS — must not await any Supabase auth call inside this callback.
    // Verification is scheduled outside via scheduleVerification().
    // Register BEFORE getSession() so we never miss an event.
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log('[AuthDiag] onAuthStateChange event:', event, '| session present:', newSession ? 'yes' : 'no');

      if (unmountedRef.current) return;

      // Increment generation — any in-flight verification from a prior event is now superseded.
      const gen = ++verifyGenRef.current;

      // Synchronously update session/user from the event payload.
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        // If signIn() is actively handling its own verification, skip scheduling
        // a concurrent getUser() here — signIn() will set the final state itself.
        if (signingInRef.current) {
          console.log('[AuthDiag] onAuthStateChange → session present but signIn() is handling verification — skipping scheduleVerification gen', gen);
          return;
        }
        // Optimistically mark as checking while we schedule server verification.
        // verifiedUser is NOT set here — only set after getUser() succeeds.
        setSessionStatus('checking');
        setAuthError(null);
        console.log('[AuthDiag] onAuthStateChange → session present, scheduling verification gen', gen);
        scheduleVerification(newSession, gen);
      } else {
        // No session in this event.
        if (event === 'SIGNED_OUT') {
          setVerifiedUser(null);
          setSessionStatus('signed-out');
          setAuthError(null);
          setLoading(false);
          console.log('[AuthDiag] onAuthStateChange → SIGNED_OUT');
        } else if (event === 'INITIAL_SESSION') {
          setVerifiedUser(null);setSessionStatus('signed-out');setAuthError(null);setLoading(false);
        } else {
          setVerifiedUser(null);
          setSessionStatus('signed-out');
          setAuthError(null);
          setLoading(false);
          console.log('[AuthDiag] onAuthStateChange → no session, event:', event);
        }
      }
    });

    // ── Initial session check ─────────────────────────────────────────────
    // Runs in parallel with the onAuthStateChange subscription.
    // If onAuthStateChange fires first (increments verifyGenRef), the
    // scheduleVerification call below will be superseded and discarded.
    const initialGen = ++verifyGenRef.current;

    supabase.auth.getSession().then(async ({ data: { session: initialSession }, error }) => {
      if (unmountedRef.current) return;

      if (error) {
        if (isSessionMissingError(error)) {
          console.log('[AuthDiag] getSession → signed-out (session missing)');
          if (verifyGenRef.current === initialGen) {
            setSession(null);
            setUser(null);
            setVerifiedUser(null);
            setSessionStatus('signed-out');
            setAuthError(null);
            setLoading(false);
          }
        } else {
          console.log('[AuthDiag] getSession → error:', error.message);
          if (verifyGenRef.current === initialGen) {
            setAuthError(error.message);
            setSession(null);
            setUser(null);
            setVerifiedUser(null);
            setSessionStatus('failed');
            setLoading(false);
          }
        }
        return;
      }

      if (!initialSession?.user) {
        console.log('[AuthDiag] getSession → no session (signed-out)');
        if (verifyGenRef.current === initialGen) {
          setSession(null);
          setUser(null);
          setVerifiedUser(null);
          setSessionStatus('signed-out');
          setAuthError(null);
          setLoading(false);
        }
        return;
      }

      // Session exists — set optimistic state, then verify server-side.
      if (verifyGenRef.current === initialGen) {
        setSession(initialSession);
        setUser(initialSession.user);
        setSessionStatus('checking');
      }

      console.log('[AuthDiag] getSession → session present, scheduling initial verification gen', initialGen);
      await scheduleVerification(initialSession, initialGen);

    }).catch((err: unknown) => {
      if (unmountedRef.current) return;
      if (verifyGenRef.current !== initialGen) return;
      if (isSessionMissingError(err)) {
        console.log('[AuthDiag] getSession → catch (session missing)');
        setSession(null);
        setUser(null);
        setVerifiedUser(null);
        setSessionStatus('signed-out');
        setAuthError(null);
      } else {
        console.log('[AuthDiag] getSession → catch error:', err instanceof Error ? err.message : String(err));
        setAuthError(err instanceof Error ? err.message : 'Session check failed');
        setSession(null);
        setUser(null);
        setVerifiedUser(null);
        setSessionStatus('failed');
      }
      setLoading(false);
    });

    return () => {
      unmountedRef.current = true;
      subscription.unsubscribe();
    };
  }, []);

  // Email/Password Sign Up
  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: (metadata as any)?.fullName || '',
          avatar_url: (metadata as any)?.avatarUrl || ''
        },
        emailRedirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/callback`
      }
    });
    if (error) throw error;
    return data;
  };

  // Email/Password Sign In — wired to supabase.auth.signInWithPassword
  // Uses the shared singleton client so onAuthStateChange fires on the same instance.
  const signIn = async (email: string, password: string) => {
    console.log('[AuthDiag] signIn called');

    // Signal to onAuthStateChange that we are handling verification ourselves.
    signingInRef.current = true;

    try {
      // ── A: signInWithPassword ─────────────────────────────────────────────
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.log('[AuthDiag] A: signInWithPassword error:', error.message, '| code:', (error as any).code ?? 'N/A');
        throw error;
      }

      const sessionFromSignIn = data.session;
      console.log('[AuthDiag] A: signInWithPassword → session returned:', sessionFromSignIn ? 'yes' : 'no');

      if (!sessionFromSignIn) {
        const noSessionErr = new Error('Sign-in succeeded but no session was returned');
        console.log('[AuthDiag] A=yes but session object missing in response');
        throw noSessionErr;
      }

      // ── B: getSession() immediately after signInWithPassword ─────────────
      let bSessionPresent = 'no';
      try {
        const { data: sessionCheck, error: sessionCheckErr } = await supabase.auth.getSession();
        if (sessionCheckErr) {
          bSessionPresent = `error: ${sessionCheckErr.message}`;
        } else {
          bSessionPresent = sessionCheck.session ? 'yes' : 'no';
        }
      } catch (e: unknown) {
        bSessionPresent = `exception: ${e instanceof Error ? e.message : String(e)}`;
      }
      console.log('[AuthDiag] B: same-client getSession() after signIn:', bSessionPresent);

      if (bSessionPresent !== 'yes') {
        // Session was returned by signInWithPassword (A=yes) but getSession() cannot
        // read it back (B=no). This indicates a storage write-read problem.
        // The session token was issued but cannot be persisted/retrieved in this browser.
        // Do NOT silently fall back to fake authentication.
        console.warn('[AuthDiag] A=yes but B=no — storage write-read failure. Session cannot be persisted in this browser environment. Reporting as sign-in failure.');
        throw new Error('Session could not be persisted after sign-in. Please check browser cookie/storage settings.');
      }

      // ── C: getUser() on same client ───────────────────────────────────────
      let cResult = 'pending';
      let verifiedUserFromGetUser: any = null;
      try {
        const { data: { user: verified }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          cResult = `error: ${userError.message} [${(userError as any).code ?? 'N/A'}]`;
          console.log('[AuthDiag] C: getUser() error:', cResult);
          // getUser failed after B=yes — transient server error, do not clear session
          // Still update state from the session we have
        } else if (verified) {
          cResult = 'success';
          verifiedUserFromGetUser = verified;
          console.log('[AuthDiag] C: getUser() success');
        } else {
          cResult = 'no user returned';
          console.log('[AuthDiag] C: getUser() returned no user');
        }
      } catch (e: unknown) {
        cResult = `exception: ${e instanceof Error ? e.message : String(e)}`;
        console.log('[AuthDiag] C: getUser() exception:', cResult);
      }

      // ── Supersede any pending onAuthStateChange verification ─────────────
      // Increment the generation counter NOW, after our own getUser() has completed.
      // Any scheduleVerification() that was queued by the SIGNED_IN event from
      // signInWithPassword will see its gen is stale and discard itself.
      const gen = ++verifyGenRef.current;
      console.log('[AuthDiag] signIn → superseding pending verifications with gen', gen);

      if (!verifiedUserFromGetUser) {
        setSession(sessionFromSignIn); setUser(sessionFromSignIn.user);
        setVerifiedUser(null); setSessionStatus('failed');
        setAuthError('Unable to verify your session. Please retry.'); setLoading(false);
        throw new Error('Unable to verify your session. Please retry.');
      }
      setSession(sessionFromSignIn); setUser(sessionFromSignIn.user);
      setVerifiedUser(verifiedUserFromGetUser); setSessionStatus('signed-in');
      setAuthError(null); setLoading(false);

      console.log('[AuthDiag] signIn → state set to signed-in, gen', gen);
      console.log('[AuthDiag] D: session after navigation — UNVERIFIED (browser check unavailable)');

      return data;
    } finally {
      // Always clear the signing-in flag so onAuthStateChange resumes normal
      // verification for future events (e.g. token refresh, sign-out).
      signingInRef.current = false;
    }
  };

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // Immediately clear state — onAuthStateChange will also fire
    setUser(null);
    setSession(null);
    setVerifiedUser(null);
    setSessionStatus('signed-out');
    setAuthError(null);
  };

  // Get Current User (verified server-side)
  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  // Check if Email is Verified
  const isEmailVerified = () => {
    return !!user?.email_confirmed_at;
  };

  // Get User Profile from Database
  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const legacyNames: Record<string,string> = {'kapil@kurtierp.com':'KPL','ishu@kurtierp.com':'Ishu','ashish@kurtierp.com':'Ashish','raghav@kurtierp.com':'Raghav','sheetal@kurtierp.com':'Sheetal'};
  const username = verifiedUser ? (legacyNames[verifiedUser.email ?? ''] ?? verifiedUser.email?.split('@')[0] ?? 'User') : null;
  const userAccess = username ? getUserAccess(username) : null;
  const value = {
    username, userAccess,
    isAuthenticated: () => sessionStatus === 'signed-in',
    isLocalAuth: () => false,
    canAccessRoute: (path: string) => sessionStatus === 'signed-in' && (!userAccess || legacyCanAccessRoute(username!, path)),
    getDefaultRoute: () => userAccess ? legacyDefaultRoute(username!) : '/',

    user,
    session,
    loading,
    authError,
    // Verified user from getUser() — server-validated
    verifiedUser,
    // Explicit session status: 'checking' | 'signed-in' | 'signed-out' | 'failed'
    sessionStatus,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
