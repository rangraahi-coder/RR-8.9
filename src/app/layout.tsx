import React from 'react';
import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '../styles/tailwind.css';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { RealtimeDataProvider } from '@/contexts/RealtimeDataContext';



export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'KurtiERP — Kurti Factory Production & Accounts',
  description: 'Complete ERP for kurti manufacturing — job cards, contractor tracking, production stages, and accounting for Indian garment factories.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body>
        <AuthProvider>
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