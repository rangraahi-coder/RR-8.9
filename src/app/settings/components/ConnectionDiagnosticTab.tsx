'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { SessionStatus } from '@/contexts/AuthContext';
import Link from 'next/link';

interface TableResult {
  table: string;
  status: 'success' | 'error';
  count: number | null;
  errorCode?: string;
  errorMessage?: string;
}

interface DiagnosticResult {
  // Sanitized auth measurements — no tokens, credentials or user records
  getSessionPresent: 'yes' | 'no' | 'error';
  getSessionError?: string;
  getUserResult: 'success' | 'signed-out' | 'error';
  getUserErrorCode?: string;
  getUserErrorMessage?: string;
  authContextStatus: SessionStatus;
  sessionStatus: 'signed-in' | 'signed-out' | 'failed';
  sessionError?: string;
  tables: TableResult[];
  ranAt: string;
}

const TABLES_TO_CHECK = ['accounts', 'item_styles', 'sales_orders', 'job_cards'] as const;

export default function ConnectionDiagnosticTab() {
  const { verifiedUser, sessionStatus: authContextStatus } = useAuth();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Track the last user id for which we auto-ran diagnostics after sign-in,
  // so we don't run duplicate auto-runs for the same session.
  const autoRanForUserRef = useRef<string | null>(null);
  // Generation counter to discard stale async results from superseded runs.
  const runGenRef = useRef(0);
  // Unmount guard
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => { unmountedRef.current = true; };
  }, []);

  // Clear stale results when the identity changes (different user or signed out).
  useEffect(() => {
    const currentUserId = verifiedUser?.id ?? null;
    if (result !== null) {
      // If we had a result and the user changed (or signed out), clear it.
      const resultWasSignedIn = result.sessionStatus === 'signed-in';
      const nowSignedOut = authContextStatus === 'signed-out';
      if (resultWasSignedIn && nowSignedOut) {
        setResult(null);
        autoRanForUserRef.current = null;
      }
    }
    // Auto-run once after a successfully verified sign-in for a new user id.
    if (
      authContextStatus === 'signed-in' &&
      currentUserId !== null &&
      autoRanForUserRef.current !== currentUserId
    ) {
      autoRanForUserRef.current = currentUserId;
      runDiagnostic();
    }
  }, [authContextStatus, verifiedUser?.id]);

  async function runDiagnostic() {
    if (unmountedRef.current) return;
    setLoading(true);
    setResult(null);

    const gen = ++runGenRef.current;
    const ranAt = new Date().toISOString();

    // ── Step 1: getSession() — presence check (no tokens exposed) ────────
    let getSessionPresent: DiagnosticResult['getSessionPresent'] = 'error';
    let getSessionError: string | undefined;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (unmountedRef.current || runGenRef.current !== gen) return;
      if (error) {
        getSessionPresent = 'error';
        getSessionError = error.message;
      } else {
        getSessionPresent = data.session ? 'yes' : 'no';
      }
    } catch (e: unknown) {
      if (unmountedRef.current || runGenRef.current !== gen) return;
      getSessionPresent = 'error';
      getSessionError = e instanceof Error ? e.message : 'Unknown exception';
    }

    // ── Step 2: getUser() — server-side verification ──────────────────────
    let getUserResult: DiagnosticResult['getUserResult'] = 'error';
    let getUserErrorCode: string | undefined;
    let getUserErrorMessage: string | undefined;
    let sessionStatus: DiagnosticResult['sessionStatus'] = 'failed';
    let sessionError: string | undefined;

    try {
      const { data, error } = await supabase.auth.getUser();
      if (unmountedRef.current || runGenRef.current !== gen) return;
      if (error) {
        const isSessionMissing =
          error.message.includes('Auth session missing') ||error.message.includes('AuthSessionMissingError') ||error.message.includes('session_not_found');
        if (isSessionMissing) {
          getUserResult = 'signed-out';
          sessionStatus = 'signed-out';
        } else {
          getUserResult = 'error';
          getUserErrorCode = (error as any).code ?? 'N/A';
          getUserErrorMessage = error.message;
          sessionStatus = 'failed';
          sessionError = error.message;
        }
      } else if (!data.user) {
        getUserResult = 'signed-out';
        sessionStatus = 'signed-out';
      } else {
        getUserResult = 'success';
        sessionStatus = 'signed-in';
      }
    } catch (e: unknown) {
      if (unmountedRef.current || runGenRef.current !== gen) return;
      const msg = e instanceof Error ? e.message : String(e);
      const isSessionMissing =
        msg.includes('Auth session missing') ||msg.includes('AuthSessionMissingError') ||msg.includes('session_not_found');
      if (isSessionMissing) {
        getUserResult = 'signed-out';
        sessionStatus = 'signed-out';
      } else {
        getUserResult = 'error';
        getUserErrorCode = 'EXCEPTION';
        getUserErrorMessage = msg || 'Unknown exception during getUser()';
        sessionStatus = 'failed';
        sessionError = getUserErrorMessage;
      }
    }

    // ── Step 3: If not signed in, stop here ───────────────────────────────
    if (sessionStatus !== 'signed-in') {
      if (!unmountedRef.current && runGenRef.current === gen) {
        setResult({
          getSessionPresent,
          getSessionError,
          getUserResult,
          getUserErrorCode,
          getUserErrorMessage,
          authContextStatus,
          sessionStatus,
          sessionError,
          tables: [],
          ranAt,
        });
        setLoading(false);
      }
      return;
    }

    // ── Step 4: Query each table independently ────────────────────────────
    const tables: TableResult[] = [];

    for (const table of TABLES_TO_CHECK) {
      if (unmountedRef.current || runGenRef.current !== gen) return;
      try {
        const { count, error } = await supabase
          .from(table)
          .select('id', { count: 'exact' })
          .limit(1);

        if (error) {
          tables.push({
            table,
            status: 'error',
            count: null,
            errorCode: error.code,
            errorMessage: error.message,
          });
        } else {
          tables.push({
            table,
            status: 'success',
            count: count ?? 0,
          });
        }
      } catch (e: unknown) {
        tables.push({
          table,
          status: 'error',
          count: null,
          errorCode: 'EXCEPTION',
          errorMessage: e instanceof Error ? e.message : 'Unknown exception',
        });
      }
    }

    if (!unmountedRef.current && runGenRef.current === gen) {
      setResult({
        getSessionPresent,
        getSessionError,
        getUserResult,
        getUserErrorCode,
        getUserErrorMessage,
        authContextStatus,
        sessionStatus,
        tables,
        ranAt,
      });
      setLoading(false);
    }
  }

  function buildSummaryText(r: DiagnosticResult): string {
    const lines: string[] = [
      'Connection Diagnostic Summary',
      `Timestamp: ${r.ranAt}`,
      '',
      '--- Auth Measurements ---',
      `getSession() session present: ${r.getSessionPresent}`,
    ];
    if (r.getSessionError) lines.push(`getSession() error: ${r.getSessionError}`);
    lines.push(`getUser(): ${r.getUserResult}${r.getUserErrorCode ? ` [${r.getUserErrorCode}]` : ''}${r.getUserErrorMessage ? ` — ${r.getUserErrorMessage}` : ''}`);
    lines.push(`AuthContext sessionStatus: ${r.authContextStatus}`);
    lines.push(`Diagnostic session status: ${r.sessionStatus}`);
    if (r.sessionError) lines.push(`Session error: ${r.sessionError}`);
    if (r.tables.length > 0) {
      lines.push('');
      lines.push('--- Table Checks ---');
      for (const t of r.tables) {
        if (t.status === 'success') {
          const countNote =
            t.count === 0
              ? '0 rows visible (table may be empty or RLS may restrict access)'
              : `${t.count} row(s) visible`;
          lines.push(`  ${t.table}: SUCCESS — ${countNote}`);
        } else {
          lines.push(`  ${t.table}: FAILED — code: ${t.errorCode ?? 'N/A'}, message: ${t.errorMessage ?? 'N/A'}`);
        }
      }
    }
    lines.push('');
    lines.push('Note: No tokens, credentials or user records are included in this summary.');
    return lines.join('\n');
  }

  async function copyResults() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildSummaryText(result));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: do nothing silently
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <h3 className="text-base font-semibold text-slate-800">Connection Diagnostic</h3>
        <p className="text-sm text-slate-500 mt-1">
          Read-only check of the app&apos;s Supabase connection and table access using your current session.
          No data is inserted, updated or deleted.
        </p>
      </div>

      <button
        onClick={runDiagnostic}
        disabled={loading}
        className="btn-primary flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Checking…
          </>
        ) : (
          'Check Connection'
        )}
      </button>

      {result && (
        <div className="space-y-4">
          {/* Auth measurements */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Auth Measurements</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-slate-500">getSession() present:</span>
              <span className={result.getSessionPresent === 'yes' ? 'text-green-700 font-medium' : result.getSessionPresent === 'no' ? 'text-amber-700' : 'text-red-700'}>
                {result.getSessionPresent}
                {result.getSessionError ? ` — ${result.getSessionError}` : ''}
              </span>
              <span className="text-slate-500">getUser():</span>
              <span className={result.getUserResult === 'success' ? 'text-green-700 font-medium' : result.getUserResult === 'signed-out' ? 'text-amber-700' : 'text-red-700'}>
                {result.getUserResult}
                {result.getUserErrorCode ? ` [${result.getUserErrorCode}]` : ''}
                {result.getUserErrorMessage ? ` — ${result.getUserErrorMessage}` : ''}
              </span>
              <span className="text-slate-500">AuthContext status:</span>
              <span className={result.authContextStatus === 'signed-in' ? 'text-green-700 font-medium' : result.authContextStatus === 'checking' ? 'text-blue-700' : result.authContextStatus === 'failed' ? 'text-red-700' : 'text-amber-700'}>
                {result.authContextStatus}
              </span>
            </div>
          </div>

          {/* Session status */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Session</p>
            {result.sessionStatus === 'signed-in' && (
              <p className="text-sm font-medium text-green-700">✓ Signed in — session verified via getUser()</p>
            )}
            {result.sessionStatus === 'signed-out' && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-700">⚠ Signed out — no active session</p>
                <Link
                  href="/login"
                  className="inline-block text-sm text-primary underline hover:no-underline"
                >
                  Go to Login
                </Link>
              </div>
            )}
            {result.sessionStatus === 'failed' && (
              <div>
                <p className="text-sm font-medium text-red-700">✗ Session verification failed</p>
                {result.sessionError && (
                  <p className="text-xs text-red-600 mt-1 font-mono">{result.sessionError}</p>
                )}
              </div>
            )}
          </div>

          {/* Table results */}
          {result.tables.length > 0 && (
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Table</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Rows visible</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {result.tables.map((t) => (
                    <tr key={t.table} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-mono text-slate-700">{t.table}</td>
                      <td className="px-4 py-3">
                        {t.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                            Success
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                            Failed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {t.status === 'success' ? (
                          t.count === 0 ? (
                            <span className="text-amber-600 text-xs">
                              No rows visible to this user; table may be empty or RLS may restrict access.
                            </span>
                          ) : (
                            <span>{t.count}</span>
                          )
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.status === 'error' ? (
                          <span className="font-mono text-xs text-red-600">
                            {t.errorCode ? `[${t.errorCode}] ` : ''}{t.errorMessage}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Copy results */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-slate-400">Run at: {result.ranAt}</p>
            <button
              onClick={copyResults}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              {copied ? '✓ Copied' : 'Copy Results'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
