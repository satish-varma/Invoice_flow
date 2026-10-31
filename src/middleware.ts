import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

function checkPermByRoute(
  route: string,
  checkPerm: (key: string) => boolean,
  site?: string
): boolean {
  const effectiveSite = site === 'dsm' || site === 'ntt_data' ? site : 'newrelic';
  if (route === '/newrelic') return effectiveSite === 'newrelic' && checkPerm('newrelic_dc');
  if (route.startsWith('/delivery-challan')) return checkPerm('general_dc');
  if (route.includes('tuckshop')) return checkPerm('tuckshop');
  if (route.includes('attendance')) return checkPerm('attendance');
  if (route.includes('stock-request')) return checkPerm('stock_request');
  if (route.startsWith('/invoices') || route === '/') return checkPerm('billing');
  if (route.startsWith('/payslip') || route.startsWith('/offer-letter')) return checkPerm('hr_docs');
  return true;
}

function findFirstAccessibleRoute(
  checkPerm: (key: string) => boolean,
  site?: string
): string {
  const effectiveSite = site === 'dsm' || site === 'ntt_data' ? site : 'newrelic';
  if (checkPerm('tuckshop')) return '/newrelic/tuckshop';
  if (checkPerm('attendance')) return '/newrelic/attendance';
  if (checkPerm('stock_request')) return '/newrelic/stock-request';
  if (effectiveSite === 'newrelic' && checkPerm('newrelic_dc')) return '/newrelic';
  if (checkPerm('general_dc')) return '/delivery-challan';
  if (checkPerm('billing')) return '/invoices';
  if (checkPerm('hr_docs')) return '/payslip';
  return '/newrelic/tuckshop';
}

export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname, search } = req.nextUrl;

    // Public download endpoint for generated PDFs (has unique expiring token)
    if (pathname.startsWith('/api/download-pdf')) {
      return NextResponse.next();
    }

    // Cron, Webhook, and backend API authorization bypass - endpoints validate their own security/tokens
    if (
      pathname.startsWith('/api/attendance/cron') ||
      pathname.startsWith('/api/attendance/webhook') ||
      pathname.startsWith('/api/tracker/cron')
    ) {
      return NextResponse.next();
    }

    if (!token) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    if (token.status === 'suspended') {
      return NextResponse.redirect(new URL('/login?error=suspended', req.url));
    }

    if (
      (token.expiresAt && new Date(token.expiresAt as string).getTime() <= Date.now()) ||
      (token as any).isExpired
    ) {
      return NextResponse.redirect(new URL('/login?error=expired', req.url));
    }

    if ((token as any).isRevoked) {
      return NextResponse.redirect(new URL('/login?error=revoked', req.url));
    }

    const role = (token.role as string) || 'user';

    // Admins have access to everything, always.
    if (role === 'admin' || role === 'superadmin') {
      return NextResponse.next();
    }

    const rawSite = token.assignedSite as string | undefined;
    const assignedSite = rawSite === 'dsm' || rawSite === 'ntt_data' ? rawSite : 'newrelic';
    const isNewRelicSite = assignedSite === 'newrelic';
    const allowedTabs = (token.allowedTabs as string[]) || [];
    const assignedApps = (token.assignedApps as string[]) || [];
    const defaultLandingPage =
      (token.defaultLandingPage as string) ||
      (!isNewRelicSite ? '/newrelic/tuckshop' : '/newrelic');

    // Strict security boundaries for Guest users: block admin and corporate invoices
    if (role === 'guest') {
      if (pathname.startsWith('/admin') || pathname === '/' || pathname.startsWith('/invoices')) {
        const fallback =
          defaultLandingPage &&
          !defaultLandingPage.startsWith('/invoices') &&
          !defaultLandingPage.startsWith('/admin') &&
          defaultLandingPage !== '/'
            ? defaultLandingPage
            : '/delivery-challan';
        return NextResponse.redirect(new URL(fallback, req.url));
      }
    }

    // Protect /admin routes from non-admins
    if (pathname.startsWith('/admin')) {
      const fallback = defaultLandingPage.startsWith('/admin')
        ? '/newrelic/tuckshop'
        : defaultLandingPage;
      return NextResponse.redirect(new URL(fallback, req.url));
    }

    // Site Isolation: NewRelic cafeteria DC Hub (/newrelic) is strictly forbidden for non-NewRelic sites
    if (pathname === '/newrelic' && !isNewRelicSite) {
      return NextResponse.redirect(new URL('/newrelic/tuckshop', req.url));
    }

    // Helper to evaluate permission with backwards compatibility
    const checkPerm = (key: string): boolean => {
      // NewRelic DC is strictly blocked for non-NewRelic sites (DSM / NTT Data)
      if (key === 'newrelic_dc' && !isNewRelicSite) {
        return false;
      }

      if (allowedTabs.length > 0) {
        return allowedTabs.includes(key);
      }
      // Backwards-compatible fallback with legacy assignedApps
      if (key === 'general_dc') return assignedApps.includes('/delivery-challans');
      if (key === 'newrelic_dc') return assignedApps.includes('/newrelic');
      if (key === 'tuckshop') return assignedApps.includes('/newrelic') || assignedApps.includes('/tuckshop');
      if (key === 'attendance') return assignedApps.includes('/newrelic');
      if (key === 'stock_request') return assignedApps.includes('/newrelic');
      if (key === 'billing' || key === 'masters') {
        return assignedApps.includes('/invoices') || assignedApps.includes('/quotations');
      }
      if (key === 'hr_docs') {
        return assignedApps.includes('/payslip') || assignedApps.includes('/offer-letter');
      }
      if (key === 'settings') return assignedApps.includes('/settings');
      return role === 'guest';
    };

    // Map URL path to required permission key
    let requiredPerm: string | null = null;

    if (pathname === '/newrelic') {
      requiredPerm = 'newrelic_dc';
    } else if (pathname === '/newrelic/tuckshop' || pathname === '/tuckshop') {
      requiredPerm = 'tuckshop';
    } else if (pathname === '/newrelic/attendance' || pathname === '/attendance') {
      if (search.includes('tab=payroll')) {
        requiredPerm = 'payroll';
      } else {
        requiredPerm = 'attendance';
      }
    } else if (pathname === '/newrelic/stock-request' || pathname === '/stock-request') {
      requiredPerm = 'stock_request';
    } else if (pathname === '/newrelic/stock-requests-admin') {
      requiredPerm = 'stock_admin';
    } else if (pathname === '/newrelic/reconcile') {
      requiredPerm = 'tuckshop_reconcile';
    } else if (pathname === '/newrelic/pricing') {
      requiredPerm = 'pricing';
    } else if (pathname === '/newrelic/catalog') {
      requiredPerm = 'catalog';
    } else if (pathname === '/newrelic/employees') {
      requiredPerm = 'employees';
    } else if (pathname === '/newrelic/analytics') {
      requiredPerm = 'analytics';
    } else if (pathname.startsWith('/delivery-challan')) {
      // General DC (Other companies like HungerBox)
      requiredPerm = 'general_dc';
    } else if (pathname === '/' || pathname.startsWith('/invoices')) {
      requiredPerm = 'billing';
    } else if (pathname.startsWith('/products') || pathname.startsWith('/clients')) {
      requiredPerm = 'masters';
    } else if (pathname.startsWith('/quotation')) {
      requiredPerm = 'billing';
    } else if (
      pathname.startsWith('/payslip') ||
      pathname.startsWith('/offer-letter') ||
      pathname.startsWith('/declarations')
    ) {
      requiredPerm = 'hr_docs';
    } else if (pathname.startsWith('/settings')) {
      requiredPerm = 'settings';
    }

    if (requiredPerm) {
      const isAllowed = checkPerm(requiredPerm);
      if (!isAllowed) {
        let fallback = defaultLandingPage;
        if (fallback === pathname || !checkPermByRoute(fallback, checkPerm, assignedSite)) {
          fallback = findFirstAccessibleRoute(checkPerm, assignedSite);
        }

        // Prevent infinite redirects
        if (pathname !== fallback && !pathname.startsWith(fallback)) {
          return NextResponse.redirect(new URL(fallback, req.url));
        } else {
          return NextResponse.redirect(new URL('/login', req.url));
        }
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const { pathname } = req.nextUrl;
        if (
          pathname.startsWith('/login') ||
          pathname.startsWith('/api/auth') ||
          pathname.startsWith('/api/download-pdf') ||
          pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp|pdf|woff2?|css|js)$/i)
        ) {
          return true;
        }
        if (
          pathname.startsWith('/api/attendance/cron') ||
          pathname.startsWith('/api/attendance/webhook') ||
          pathname.startsWith('/api/tracker/cron')
        ) {
          return true;
        }
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!login|api/auth|api/download-pdf|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-.*\\.js|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|pdf|woff2?|css|js)).*)',
  ],
};
