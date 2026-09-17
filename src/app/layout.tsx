import React from 'react';
import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { RealtimeDataProvider } from '@/contexts/RealtimeDataContext';
import RequestProgress from '@/components/RequestProgress';
import RequestErrorNotice from '@/components/RequestErrorNotice';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Rangraahi Powerhouse — Kurti Factory Production & Accounts',
  description: 'Complete ERP for kurti manufacturing — job cards, contractor tracking, production stages, and accounting for Indian garment factories.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" translate="no" className="notranslate">
      <head><meta name="google" content="notranslate" />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Frangraahic9573back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></head>
      <body translate="no" className="notranslate">
        <AuthProvider>
          <RequestErrorNotice />
          <RequestProgress />
          <RealtimeDataProvider>
            {children}
          </RealtimeDataProvider>
        </AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--card)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-sans)',
              fontSize: '14px',
            },
          }}
        />
</body>
    </html>
  );
}
