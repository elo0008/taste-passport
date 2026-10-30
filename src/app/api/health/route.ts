import { NextRequest, NextResponse } from 'next/server';
import { QlooClient } from '@/lib/qloo';
import { testGeminiHealth } from '@/lib/gemini';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const hasQlooKey = Boolean(process.env.QLOO_API_KEY && process.env.QLOO_API_KEY.length > 5);
  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);

  const healthToken = process.env.HEALTH_TOKEN;
  const providedToken =
    request.headers.get('x-health-token') || request.headers.get('health-token');

  // Deep check only when authorized with HEALTH_TOKEN
  if (healthToken && providedToken === healthToken) {
    let qlooOk = false;
    let geminiOk = false;

    try {
      const qloo = new QlooClient();
      const tags = await qloo.tags({ query: 'restaurant', take: 1 });
      qlooOk = Array.isArray(tags);
    } catch {
      qlooOk = false;
    }

    try {
      geminiOk = await testGeminiHealth();
    } catch {
      geminiOk = false;
    }

    return NextResponse.json({
      qloo: qlooOk,
      gemini: geminiOk,
      deep: true,
    });
  }

  // Fast configuration presence check (avoids quota abuse)
  return NextResponse.json({
    qloo: hasQlooKey,
    gemini: hasGeminiKey,
  });
}
