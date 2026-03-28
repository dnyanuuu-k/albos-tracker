import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serverConfig } from '@/lib/server-config';

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok';
  try {
    // Lightweight DB connectivity check.
    await db.$queryRaw`SELECT 1`;
  } catch {
    dbStatus = 'error';
  }

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'healthy' : 'degraded',
    db: dbStatus,
    email: {
      resendConfigured: Boolean(serverConfig.resendApiKey),
    },
    timestamp: new Date().toISOString(),
  });
}

