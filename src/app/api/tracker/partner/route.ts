import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getPartnerCurrentUser,
  fetchCashAndCarryPayments,
  fetchPaymentAdviceDetails,
  fetchCompanyPaidInvoices,
  fetchCompanyPaidCounts,
  fetchCommissionInvoices,
  fetchCommissionInvoiceDetails,
  fetchZohoStatementDownloads,
  generateZohoStatement,
  fetchDashboardFilters,
  syncPartnerAdvicesToTurso,
} from '@/services/hungerboxPartnerService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'summary';

  try {
    switch (action) {
      case 'summary': {
        const [userProfile, cpCounts, cncPayments] = await Promise.all([
          getPartnerCurrentUser().catch(() => null),
          fetchCompanyPaidCounts().catch(() => null),
          fetchCashAndCarryPayments({ page: 1, limit: 10 }).catch(() => ({ paymentAdviceDetails: [] })),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            userProfile,
            companyPaidCounts: cpCounts,
            recentSettlements: cncPayments.paymentAdviceDetails || [],
          },
        });
      }

      case 'cash-and-carry': {
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '25', 10);
        const state = (searchParams.get('state') as 'all' | 'pinned') || 'all';

        const data = await fetchCashAndCarryPayments({ page, limit, state });
        return NextResponse.json({ success: true, data });
      }

      case 'advice-details': {
        const settlementId = searchParams.get('settlementId');
        if (!settlementId) {
          return NextResponse.json({ success: false, error: 'Missing settlementId' }, { status: 400 });
        }
        const data = await fetchPaymentAdviceDetails(settlementId);
        return NextResponse.json({ success: true, data });
      }

      case 'company-paid': {
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const [data, counts] = await Promise.all([
          fetchCompanyPaidInvoices({ page, limit }),
          fetchCompanyPaidCounts().catch(() => null),
        ]);

        return NextResponse.json({
          success: true,
          data: {
            invoices: data.invoiceSummary || [],
            currencySymbol: data.currencySymbol || '₹',
            counts,
          },
        });
      }

      case 'commission-invoices': {
        const paymentType = (searchParams.get('paymentType') as 'companyPaid' | 'cashNCarry') || 'companyPaid';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '25', 10);

        const data = await fetchCommissionInvoices({ paymentType, page, limit });
        return NextResponse.json({ success: true, data });
      }

      case 'commission-details': {
        const invoiceId = searchParams.get('invoiceId');
        const paymentType = (searchParams.get('paymentType') as 'companyPaid' | 'cashNCarry') || 'companyPaid';
        if (!invoiceId) {
          return NextResponse.json({ success: false, error: 'Missing invoiceId' }, { status: 400 });
        }

        const data = await fetchCommissionInvoiceDetails({ invoiceId, paymentType });
        return NextResponse.json({ success: true, data });
      }

      case 'zoho-downloads': {
        const paymentType = (searchParams.get('paymentType') as 'companyPaid' | 'cashNCarry') || 'companyPaid';
        const data = await fetchZohoStatementDownloads({ paymentType });
        return NextResponse.json({ success: true, data });
      }

      case 'filters': {
        const data = await fetchDashboardFilters();
        return NextResponse.json({ success: true, data });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`[Partner API Error - ${action}]:`, error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const action = body.action;

    switch (action) {
      case 'generate-statement': {
        const { fromDate, toDate, paymentType = 'companyPaid', format = 'pdf' } = body;
        if (!fromDate || !toDate) {
          return NextResponse.json(
            { success: false, error: 'fromDate and toDate are required' },
            { status: 400 }
          );
        }

        const data = await generateZohoStatement({ fromDate, toDate, paymentType, format });
        return NextResponse.json({ success: true, data });
      }

      case 'sync-to-turso': {
        const orgId = body.orgId || 'default';
        const syncResult = await syncPartnerAdvicesToTurso(orgId);
        return NextResponse.json(syncResult);
      }

      default:
        return NextResponse.json({ success: false, error: `Invalid action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error('[Partner API POST Error]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Server error' }, { status: 500 });
  }
}
