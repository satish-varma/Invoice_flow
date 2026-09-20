import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    const role = token.role as string;
    
    // Admins have access to everything, always.
    if (role === 'admin') {
      return NextResponse.next();
    }

    // Protect /admin routes from non-admins
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/newrelic', req.url));
    }

    const assignedApps = (token.assignedApps as string[]) || [];

    // Map the requested path to its parent "app module" ID (which matches the checkboxes in admin)
    let requiredAppModule: string | null = null;

    if (pathname === '/' || pathname.startsWith('/invoices')) {
      requiredAppModule = '/invoices';
    } else if (pathname.startsWith('/quotation')) {
      // Handles both /quotation and /quotations
      requiredAppModule = '/quotations';
    } else if (pathname.startsWith('/delivery-challan')) {
      // Handles both /delivery-challan and /delivery-challans
      requiredAppModule = '/delivery-challans';
    } else if (pathname.startsWith('/newrelic')) {
      requiredAppModule = '/newrelic';
    } else if (pathname.startsWith('/declarations')) {
      requiredAppModule = '/declarations';
    } else if (pathname.startsWith('/payslip')) {
      requiredAppModule = '/payslip';
    } else if (pathname.startsWith('/offer-letter')) {
      requiredAppModule = '/offer-letter';
    } else if (pathname.startsWith('/settings')) {
      requiredAppModule = '/settings';
    }

    if (requiredAppModule) {
      if (!assignedApps.includes(requiredAppModule)) {
        // Find a safe fallback route
        let fallback = '/newrelic';
        if (assignedApps.length > 0) {
          fallback = assignedApps[0];
          // Since '/invoices' in our array actually means they can access '/', we could route to '/'
          if (fallback === '/invoices') fallback = '/';
          if (fallback === '/quotations') fallback = '/quotation';
          if (fallback === '/delivery-challans') fallback = '/delivery-challan';
        } else {
          // If they have literally no apps, just send them to login or an unauthorized page
          // But since we can't easily clear their session here, redirect to a static error string or /login
          return NextResponse.redirect(new URL('/login', req.url));
        }
        
        // Prevent infinite redirect loops if the fallback is the same as the current path
        if (pathname !== fallback && !pathname.startsWith(fallback)) {
          return NextResponse.redirect(new URL(fallback, req.url));
        } else {
           // If they are stuck, force them out
           return NextResponse.redirect(new URL('/login', req.url));
        }
      }
    }

    // Default: allow access
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)',
  ],
};
