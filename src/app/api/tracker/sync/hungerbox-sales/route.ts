import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createAuditLog, getSettings } from '@/lib/tracker/turso';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || (session.user as any).role === 'guest') {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get('orgId') || 'default';
  const settings = await getSettings(orgId);

  let workerUrl = (settings.hungerboxWorkerUrl || process.env.HUNGERBOX_WORKER_URL || '').trim();
  const apiKey = (settings.hungerboxWorkerApiKey || process.env.WORKER_API_KEY || '').trim();

  if (!workerUrl || !apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'HungerBox Worker URL and API Key not configured. Please set them in Tracker Settings.',
      },
      { status: 400 }
    );
  }

  if (workerUrl.endsWith('/')) {
    workerUrl = workerUrl.slice(0, -1);
  }

  try {
    const payload = {
      id: 'hungerbox',
      organizationId: orgId,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Sync] Triggering HungerBox Worker at ${workerUrl}`);

    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    const contentType = response.headers.get('content-type');
    let result: any;
    if (contentType && contentType.includes('application/json')) {
      result = await response.json();
    } else {
      const text = await response.text();
      return NextResponse.json(
        {
          success: false,
          error: `Worker returned non-JSON response (Status: ${response.status})`,
          details: text.substring(0, 500),
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      throw new Error(`Worker Error (Status: ${response.status}): ${result?.error || result?.message || response.statusText}`);
    }

    const headerList = await headers();
    const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || 'unknown';

    await createAuditLog({
      userId: (session.user as any).id,
      userEmail: session.user.email,
      action: 'Triggered HungerBox Sales Sync',
      details: JSON.stringify({
        workerUrl: workerUrl.substring(0, 30) + '...',
        workerResponse: result,
      }),
      orgId,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      message: 'HungerBox Sales Sync triggered successfully',
      workerStatus: result,
    });
  } catch (error: any) {
    console.error('[API] HungerBox Sync trigger failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to trigger worker',
      },
      { status: 500 }
    );
  }
}
