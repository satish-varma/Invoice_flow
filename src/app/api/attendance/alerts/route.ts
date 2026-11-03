import { NextRequest, NextResponse } from 'next/server';
import {
  getAlertGatewayConfig,
  saveAlertGatewayConfig,
  dispatchAlert,
  dispatchAlertToAdmins,
  dispatchDcAlert,
  dispatchBillingCycleDigest,
  getRecentAlertLogs,
  generateAlertMessage,
} from '@/services/alertGatewayService';
import { AlertGatewayConfig, SendAlertRequest } from '@/types/alertGateway';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const config = await getAlertGatewayConfig();
    const logs = await getRecentAlertLogs(20);

    // Mask sensitive secrets for UI display
    const maskedConfig: AlertGatewayConfig = {
      ...config,
      ultramsg: config.ultramsg
        ? {
            ...config.ultramsg,
            token: config.ultramsg.token ? '••••••••' + config.ultramsg.token.slice(-4) : '',
          }
        : undefined,
      meta: config.meta
        ? {
            ...config.meta,
            accessToken: config.meta.accessToken ? '••••••••' + config.meta.accessToken.slice(-4) : '',
          }
        : undefined,
      twilio: config.twilio
        ? {
            ...config.twilio,
            authToken: config.twilio.authToken ? '••••••••' + config.twilio.authToken.slice(-4) : '',
          }
        : undefined,
      fast2sms: config.fast2sms
        ? {
            ...config.fast2sms,
            apiKey: config.fast2sms.apiKey ? '••••••••' + config.fast2sms.apiKey.slice(-4) : '',
          }
        : undefined,
      msg91: config.msg91
        ? {
            ...config.msg91,
            authKey: config.msg91.authKey ? '••••••••' + config.msg91.authKey.slice(-4) : '',
          }
        : undefined,
    };

    return NextResponse.json({
      success: true,
      config: maskedConfig,
      rawConfig: config,
      recentLogs: logs,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'save_config') {
      const { config, userEmail } = body;
      if (!config) {
        return NextResponse.json({ success: false, error: 'Config payload required' }, { status: 400 });
      }

      // If user kept masked value '••••', preserve existing secret
      const existing = await getAlertGatewayConfig();
      const mergedConfig: AlertGatewayConfig = {
        ...config,
        ultramsg: {
          instanceId: config.ultramsg?.instanceId || '',
          token: config.ultramsg?.token?.startsWith('••••')
            ? existing.ultramsg?.token || ''
            : config.ultramsg?.token || '',
        },
        meta: {
          ...config.meta,
          accessToken: config.meta?.accessToken?.startsWith('••••')
            ? existing.meta?.accessToken || ''
            : config.meta?.accessToken || '',
        },
        twilio: {
          ...config.twilio,
          authToken: config.twilio?.authToken?.startsWith('••••')
            ? existing.twilio?.authToken || ''
            : config.twilio?.authToken || '',
        },
        fast2sms: {
          ...config.fast2sms,
          apiKey: config.fast2sms?.apiKey?.startsWith('••••')
            ? existing.fast2sms?.apiKey || ''
            : config.fast2sms?.apiKey || '',
        },
        msg91: {
          ...config.msg91,
          authKey: config.msg91?.authKey?.startsWith('••••')
            ? existing.msg91?.authKey || ''
            : config.msg91?.authKey || '',
        },
      };

      await saveAlertGatewayConfig(mergedConfig, userEmail);
      return NextResponse.json({ success: true, message: 'Alert Gateway settings saved successfully' });
    }

    if (action === 'test_ping') {
      const { testPhone, userEmail } = body;
      if (!testPhone) {
        return NextResponse.json({ success: false, error: 'Recipient test phone required' }, { status: 400 });
      }

      const alertReq: SendAlertRequest = {
        to: testPhone,
        recipientName: 'Administrator',
        alertType: 'test_ping',
      };

      const result = await dispatchAlert(alertReq, undefined, userEmail);
      return NextResponse.json({
        success: result.success,
        provider: result.provider,
        error: result.error,
      });
    }

    if (action === 'send_single') {
      const { recipientPhone, recipientName, alertType, metadata, customMessage, userEmail } = body;
      if (!recipientPhone) {
        return NextResponse.json({ success: false, error: 'recipientPhone is required' }, { status: 400 });
      }

      const alertReq: SendAlertRequest = {
        to: recipientPhone,
        recipientName,
        alertType: alertType || 'custom',
        customMessage,
        metadata,
      };

      const result = await dispatchAlert(alertReq, undefined, userEmail);
      return NextResponse.json({
        success: result.success,
        provider: result.provider,
        error: result.error,
      });
    }

    if (action === 'send_manager_digest') {
      const { managerPhone, siteName, presentCount, totalRoster, onDutyCount, absentNames, userEmail } = body;
      const config = await getAlertGatewayConfig();

      const message = generateAlertMessage('manager_digest', {
        siteName: siteName || 'All Sites',
        presentCount: Number(presentCount) || 0,
        totalRoster: Number(totalRoster) || 0,
        onDutyCount: Number(onDutyCount) || 0,
        absentNames: Array.isArray(absentNames) ? absentNames : [],
      });

      // If specific phone was requested, prioritize it, otherwise dispatch to all top 5 managers
      if (managerPhone && managerPhone !== '917709632898') {
        const alertReq: SendAlertRequest = {
          to: managerPhone,
          recipientName: 'Store In-Charge / Ops Manager',
          alertType: 'manager_digest',
          customMessage: message,
        };
        const result = await dispatchAlert(alertReq, config, userEmail);
        return NextResponse.json({
          success: result.success,
          provider: result.provider,
          targetPhone: managerPhone,
          error: result.error,
        });
      }

      const dispatchSummary = await dispatchAlertToAdmins(
        {
          alertType: 'manager_digest',
          customMessage: message,
        },
        config,
        userEmail
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        totalFailed: dispatchSummary.totalFailed,
        dispatchedTo: dispatchSummary.results,
      });
    }

    if (action === 'trigger_late_alert') {
      const {
        employeeName,
        employeePhone,
        designation,
        role,
        siteName,
        checkInTime,
        lateMinutes,
        cutoff,
        userEmail,
        siteId,
      } = body;
      const config = await getAlertGatewayConfig();

      if (config.enableAutoLateAlert === false) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Automated late alerts are disabled in gateway settings.',
        });
      }

      const message = generateAlertMessage('admin_late_notice' as any, {
        employeeName: employeeName || 'Staff Member',
        employeePhone,
        role: designation || role,
        siteName: siteName || 'InvoiceFlow Hub',
        checkInTime: checkInTime || 'Just now',
        lateMinutes: Number(lateMinutes) || 0,
        cutoff: cutoff || '06:30 AM',
      });

      const dispatchSummary = await dispatchAlertToAdmins(
        {
          alertType: 'late_alert',
          customMessage: message,
          siteId,
        },
        config,
        userEmail || 'system:auto-late-alert'
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        dispatchedTo: dispatchSummary.results,
      });
    }

    if (action === 'trigger_absent_alert') {
      const { siteName, cutoff, absentNames, userEmail, siteId } = body;
      const config = await getAlertGatewayConfig();

      if (config.enableAutoAbsentAlert === false) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Automated absent alerts are disabled in gateway settings.',
        });
      }

      const message = generateAlertMessage('admin_absent_alert' as any, {
        siteName: siteName || 'All Sites',
        cutoff: cutoff || '06:30 AM',
        absentNames: Array.isArray(absentNames) ? absentNames : [],
      });

      const dispatchSummary = await dispatchAlertToAdmins(
        {
          alertType: 'group_absent_alert',
          customMessage: message,
          siteId,
        },
        config,
        userEmail || 'system:auto-absent-alert'
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        dispatchedTo: dispatchSummary.results,
      });
    }

    if (action === 'trigger_missed_checkout_alert') {
      const { siteName, missedStaffNames, userEmail, siteId } = body;
      const config = await getAlertGatewayConfig();

      const message = generateAlertMessage('admin_missed_checkout' as any, {
        siteName: siteName || 'All Sites',
        absentNames: Array.isArray(missedStaffNames) ? missedStaffNames : [],
      });

      const dispatchSummary = await dispatchAlertToAdmins(
        {
          alertType: 'checkout_reminder',
          customMessage: message,
          siteId,
        },
        config,
        userEmail || 'system:auto-checkout-alert'
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        dispatchedTo: dispatchSummary.results,
      });
    }

    if (action === 'trigger_dc_alert') {
      const {
        dcNumber,
        location,
        lineItemsCount,
        totalQty,
        totalValue,
        createdBy,
        date,
        userEmail,
      } = body;
      const config = await getAlertGatewayConfig();

      if (config.enableAutoDcAlert === false) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Automated DC creation alerts are disabled in gateway settings.',
        });
      }

      const dispatchSummary = await dispatchDcAlert(
        {
          dcNumber: dcNumber || 'DC-NEW',
          location: location || 'bangalore',
          lineItemsCount: Number(lineItemsCount) || 0,
          totalQty: Number(totalQty) || 0,
          totalValue: Number(totalValue) || 0,
          createdBy: createdBy || userEmail || 'manager@thegutguru.in',
          date,
        },
        config,
        userEmail || 'system:dc-notice'
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        totalFailed: dispatchSummary.totalFailed,
        dispatchedTo: dispatchSummary.results,
      });
    }

    if (action === 'trigger_billing_cycle') {
      const { cycleLabel, startDate, endDate, userEmail } = body;
      const config = await getAlertGatewayConfig();
      if (config.enableBiWeeklyBillingDigest === false) {
        return NextResponse.json({
          success: true,
          skipped: true,
          message: 'Bi-weekly billing cycle digests are disabled in gateway settings.',
        });
      }

      // Default to current 15-day window if not provided
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth(); // 0-based
      const day = now.getDate();

      let calcCycleLabel = cycleLabel;
      let startStr = startDate;
      let endStr = endDate;

      if (!startStr || !endStr) {
        if (day <= 15) {
          calcCycleLabel = calcCycleLabel || `1st - 15th ${now.toLocaleString('default', { month: 'short' })} ${year}`;
          startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
          endStr = `${year}-${String(month + 1).padStart(2, '0')}-15`;
        } else {
          const lastDay = new Date(year, month + 1, 0).getDate();
          calcCycleLabel = calcCycleLabel || `16th - ${lastDay}th ${now.toLocaleString('default', { month: 'short' })} ${year}`;
          startStr = `${year}-${String(month + 1).padStart(2, '0')}-16`;
          endStr = `${year}-${String(month + 1).padStart(2, '0')}-${lastDay}`;
        }
      }

      // Query challans
      const { db } = await import('@/lib/firebase');
      const { collection, getDocs, query, where } = await import('firebase/firestore');
      const snap = await getDocs(
        query(
          collection(db, 'newrelic_challans'),
          where('dcDate', '>=', startStr),
          where('dcDate', '<=', endStr)
        )
      );

      const dcs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((d) => !d.isDeleted);

      let totalVolume = 0;
      let totalUnits = 0;
      const missingSignedDcs: Array<{ dcNumber: string; date: string; value: number }> = [];

      for (const d of dcs) {
        const lineItems = Array.isArray(d.lineItems) ? d.lineItems : [];
        const dcUnits = lineItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
        const dcValue = d.totalAmount || lineItems.reduce((acc: number, it: any) => acc + ((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)), 0);
        totalVolume += dcValue;
        totalUnits += dcUnits;

        const hasSignedCopy = Array.isArray(d.signedCopyUrls) && d.signedCopyUrls.length > 0;
        if (!hasSignedCopy) {
          missingSignedDcs.push({
            dcNumber: d.dcNumber || 'DC-UNKNOWN',
            date: d.dcDate || '',
            value: dcValue,
          });
        }
      }

      const dispatchSummary = await dispatchBillingCycleDigest(
        {
          cycleLabel: calcCycleLabel,
          startDate: startStr,
          endDate: endStr,
          totalDcs: dcs.length,
          totalVolume,
          totalUnits,
          missingSignedCount: missingSignedDcs.length,
          missingSignedDcs,
        },
        config,
        userEmail || 'system:billing-digest'
      );

      return NextResponse.json({
        success: dispatchSummary.totalSent > 0,
        provider: config.activeProvider,
        totalSent: dispatchSummary.totalSent,
        dispatchedTo: dispatchSummary.results,
        summary: {
          period: `${startStr} to ${endStr}`,
          totalDcs: dcs.length,
          totalVolume,
          missingSignedCount: missingSignedDcs.length,
        },
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('API Error in /api/attendance/alerts:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
