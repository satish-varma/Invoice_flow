
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
                // ── Suppress Third-Party Extension / Content Script Noise ──
                (function() {
                  if (typeof window === 'undefined') return;

                  function isExtensionNoise(errOrMsg, filename) {
                    if (!errOrMsg && !filename) return false;
                    var str = '';
                    if (typeof errOrMsg === 'string') {
                      str = errOrMsg;
                    } else if (errOrMsg && errOrMsg.message) {
                      str = errOrMsg.message + ' ' + (errOrMsg.stack || '');
                    } else if (errOrMsg) {
                      str = String(errOrMsg);
                    }
                    var fileStr = filename ? String(filename) : '';

                    return (
                      str.indexOf('Could not establish connection') !== -1 ||
                      str.indexOf('Receiving end does not exist') !== -1 ||
                      str.indexOf('useCache') !== -1 ||
                      str.indexOf('runtime.lastError') !== -1 ||
                      str.indexOf('content.js') !== -1 ||
                      fileStr.indexOf('content.js') !== -1 ||
                      fileStr.indexOf('chrome-extension://') !== -1 ||
                      fileStr.indexOf('moz-extension://') !== -1
                    );
                  }

                  // Suppress unhandled promise rejections from content.js (e.g. useCache TypeError)
                  window.addEventListener('unhandledrejection', function(event) {
                    if (isExtensionNoise(event.reason)) {
                      event.preventDefault();
                      event.stopImmediatePropagation();
                      return true;
                    }
                  }, true);

                  // Suppress unhandled errors from injected extension scripts
                  window.addEventListener('error', function(event) {
                    if (isExtensionNoise(event.error || event.message, event.filename)) {
                      event.preventDefault();
                      event.stopImmediatePropagation();
                      return true;
                    }
                  }, true);

                  // Filter console.error from extension connection polling loops
                  if (window.console && window.console.error) {
                    var origConsoleError = window.console.error;
                    window.console.error = function() {
                      var args = Array.prototype.slice.call(arguments);
                      var fullText = args.map(function(a) {
                        return (a && a.stack) ? a.stack : (typeof a === 'object' ? JSON.stringify(a) : String(a));
                      }).join(' ');

                      if (isExtensionNoise(fullText)) {
                        return;
                      }
                      return origConsoleError.apply(window.console, arguments);
                    };
                  }

                  // Filter console.warn from extension connection polling loops
                  if (window.console && window.console.warn) {
                    var origConsoleWarn = window.console.warn;
                    window.console.warn = function() {
                      var args = Array.prototype.slice.call(arguments);
                      var fullText = args.map(function(a) { return String(a); }).join(' ');
                      if (isExtensionNoise(fullText)) {
                        return;
                      }
                      return origConsoleWarn.apply(window.console, arguments);
                    };
                  }
                })();

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
                        fetch('/sw.js', { method: 'HEAD' })
                          .then(function(res) {
                            if (res.ok) {
                              navigator.serviceWorker.register('/sw.js').catch(function() {});
                            }
                          })
                          .catch(function() {});
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
