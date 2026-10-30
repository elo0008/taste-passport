import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { QlooClient } from '@/lib/qloo';
import { resolveFavoritesBatch, FavoriteType } from '@/lib/resolve-service';

export const dynamic = 'force-dynamic';

const ResolveItemSchema = z.object({
  name: z.string().trim().min(1, 'Favorite name cannot be empty').max(100),
  type: z.enum(['artist', 'movie', 'tv_show', 'person', 'podcast', 'brand'], {
    errorMap: () => ({ message: 'Invalid type' }),
  }),
});

const ResolveRequestSchema = z.object({
  favorites: z.array(ResolveItemSchema).min(1).max(8),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = ResolveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  try {
    const client = new QlooClient();
    const results = await resolveFavoritesBatch(
      client,
      parsed.data.favorites as Array<{ name: string; type: FavoriteType }>
    );

    return NextResponse.json({
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err.message || 'Resolution failed',
      },
      { status: 500 }
    );
  }
}

