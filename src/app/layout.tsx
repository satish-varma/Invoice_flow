
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseProvider } from '@/firebase';
import { AuthProvider } from '@/contexts/AuthContext';
import { FinancialAuthProvider } from '@/contexts/FinancialAuthContext';
import { ThemeBackdropProvider } from '@/contexts/ThemeBackdropContext';
import { MobileAnimatedBackground } from '@/components/ui/mobile-animated-background';
import { GlobalMotionFxOverlay } from '@/components/effects/GlobalMotionFxOverlay';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'The Gut Guru Tracker',
  description: 'Operations, Attendance & Delivery Challan Management Platform.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: "The Gut Guru Tracker",
    statusBarStyle: "default",
  },
  icons: {
    apple: [
      { url: '/icon-192x192.png' },
      { url: '/icon-512x512.png', sizes: '512x512' }
    ]
  }
};

export const viewport: Viewport = {
  themeColor: '#3949ab',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

import { SimulationBanner } from '@/components/SimulationBanner';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (typeof window !== 'undefined' && window.localStorage) {
                  for (var i = window.localStorage.length - 1; i >= 0; i--) {
                    var k = window.localStorage.key(i);
                    if (k && (k.indexOf('firestore_') === 0 || k.indexOf('firestore_mutations') !== -1)) {
                      window.localStorage.removeItem(k);
                    }
                  }
                  if (window.Storage) {
                    var origSetItem = window.Storage.prototype.setItem;
                    window.Storage.prototype.setItem = function(key, val) {
                      try {
                        return origSetItem.call(this, key, val);
                      } catch (err) {
                        if (typeof key === 'string' && (key.indexOf('firestore_') === 0 || key.indexOf('firestore_mutations') !== -1)) {
                          try {
                            for (var j = window.localStorage.length - 1; j >= 0; j--) {
                              var rk = window.localStorage.key(j);
                              if (rk && (rk.indexOf('firestore_mutations') !== -1 || rk.indexOf('firestore_targets') !== -1)) {
                                window.localStorage.removeItem(rk);
                              }
                            }
                            return origSetItem.call(this, key, val);
                          } catch (err2) {
                            console.warn('[SafeStorage] Suppressed QuotaExceededError for key:', key);
                            return;
                          }
                        }
                        throw err;
                      }
                    };
                  }
                }
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                  ${
                    process.env.NODE_ENV === 'development'
                      ? `
                    navigator.serviceWorker.getRegistrations().then(function(registrations) {
                      for (var i = 0; i < registrations.length; i++) {
                        registrations[i].unregister();
                      }
                    });
                  `
                      : `
                    if (window.location.protocol === 'https:' || window.location.hostname === 'localhost') {
                      window.addEventListener('load', function() {
                        navigator.serviceWorker.register('/sw.js').catch(function() {});
                      });
                    }
                  `
                  }
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="font-body antialiased bg-transparent min-h-screen">
        <FirebaseProvider>
          <AuthProvider>
            <FinancialAuthProvider>
              <ThemeBackdropProvider>
                <MobileAnimatedBackground />
                <GlobalMotionFxOverlay />
                <SimulationBanner />
                <div className="relative z-10 min-h-screen">
                  {children}
                </div>
              </ThemeBackdropProvider>
            </FinancialAuthProvider>
          </AuthProvider>
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
