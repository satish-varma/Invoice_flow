import { NextRequest, NextResponse } from 'next/server';
import {
  getAlertGatewayConfig,
  saveAlertGatewayConfig,
  dispatchAlert,
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
      const targetPhone = managerPhone || (await getAlertGatewayConfig()).managerPhone;

      if (!targetPhone) {
        return NextResponse.json({
          success: false,
          error: 'No manager phone number configured for shift digest broadcast.',
        }, { status: 400 });
      }

      const message = generateAlertMessage('manager_digest', {
        siteName: siteName || 'All Sites',
        presentCount: Number(presentCount) || 0,
        totalRoster: Number(totalRoster) || 0,
        onDutyCount: Number(onDutyCount) || 0,
        absentNames: Array.isArray(absentNames) ? absentNames : [],
      });

      const alertReq: SendAlertRequest = {
        to: targetPhone,
        recipientName: 'Store In-Charge / Ops Manager',
        alertType: 'manager_digest',
        customMessage: message,
      };

      const result = await dispatchAlert(alertReq, undefined, userEmail);
      return NextResponse.json({
        success: result.success,
        provider: result.provider,
        targetPhone,
        error: result.error,
      });
    }

    return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('API Error in /api/attendance/alerts:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
