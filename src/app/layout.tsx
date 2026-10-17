
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { FirebaseProvider } from '@/firebase';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeBackdropProvider } from '@/contexts/ThemeBackdropContext';

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
      </head>
      <body className="font-body antialiased">
        <FirebaseProvider>
          <AuthProvider>
            <ThemeBackdropProvider>
              {children}
            </ThemeBackdropProvider>
          </AuthProvider>
        </FirebaseProvider>
        <Toaster />
      </body>
    </html>
  );
}
