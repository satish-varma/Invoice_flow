import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  submitFloatRequest,
  approveFloatRequest,
  rejectFloatRequest,
  getSiteFloat,
} from '@/services/tuckshopFloatService';
import { dispatchPettyCashRequestAlert } from '@/services/alertGatewayService';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const userEmail = session.user.email || 'counter-staff';
  const userName = session.user.name || userEmail.split('@')[0];
  const userRole = (session.user as any).role || 'user';
  const isAdmin = userRole === 'admin' || userRole === 'superadmin';

  try {
    const body = await request.json();
    const { action } = body;

    // 1. Submit Float Top-Up Request & Dispatch WhatsApp Alert to Admin
    if (action === 'request') {
      const {
        scopeKey,
        amount,
        reason,
        preferredMode,
        currentBalance,
        counterName,
        location,
      } = body;

      if (!scopeKey || !amount || Number(amount) <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid scope key or request amount' },
          { status: 400 }
        );
      }

      // Submit request in Firestore
      const newRequest = await submitFloatRequest(scopeKey, {
        amount: Number(amount),
        reason: reason || 'Morning supplies replenishment',
        preferredMode: preferredMode || 'upi',
        currentBalance: currentBalance !== undefined ? Number(currentBalance) : 0,
        requestedBy: `${userName} (${userEmail})`,
        requestedByEmail: userEmail,
      });

      // Dispatch WhatsApp Alert to Admin
      let whatsappResult = { totalSent: 0, totalFailed: 0, results: [] as any[] };
      try {
        whatsappResult = await dispatchPettyCashRequestAlert({
          requestId: newRequest.id,
          siteName: counterName || newRequest.counterName,
          location: location || newRequest.location || 'Counter Hub',
          requestedBy: userName,
          amount: newRequest.amount,
          reason: newRequest.reason || 'Supplies purchase',
          currentBalance: currentBalance !== undefined ? Number(currentBalance) : 0,
          preferredMode: preferredMode || 'upi',
        });
      } catch (waErr: any) {
        console.warn('[FloatAPI] WhatsApp dispatch warning:', waErr.message);
      }

      return NextResponse.json({
        success: true,
        request: newRequest,
        whatsappSent: whatsappResult.totalSent > 0,
        message: `Request for ₹${newRequest.amount.toLocaleString('en-IN')} submitted and WhatsApp notification sent to Admin!`,
      });
    }

    // 2. Approve Float Request (Admin Only)
    if (action === 'approve') {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only admins can approve float requests' },
          { status: 403 }
        );
      }

      const { requestId, mode, transactionRef, note } = body;
      if (!requestId) {
        return NextResponse.json({ success: false, error: 'Missing requestId' }, { status: 400 });
      }

      await approveFloatRequest(requestId, {
        mode: mode || 'upi',
        transactionRef,
        note: note || `Approved by ${userName}`,
        approvedBy: userEmail,
      });

      return NextResponse.json({
        success: true,
        message: 'Float request approved and credited to counter successfully!',
      });
    }

    // 3. Reject Float Request (Admin Only)
    if (action === 'reject') {
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Only admins can reject float requests' },
          { status: 403 }
        );
      }

      const { requestId, reason } = body;
      if (!requestId) {
        return NextResponse.json({ success: false, error: 'Missing requestId' }, { status: 400 });
      }

      await rejectFloatRequest(requestId, {
        reason: reason || 'Declined by Admin',
        reviewedBy: userEmail,
      });

      return NextResponse.json({
        success: true,
        message: 'Float request declined.',
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[API] /api/tuckshop/float error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
