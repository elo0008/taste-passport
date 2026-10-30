import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runPassportPipeline, PipelineError } from '@/lib/pipeline';
import { rateLimiter } from '@/lib/rate-limit';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const FavoriteSchema = z.object({
  name: z.string().trim().min(1, 'Favorite name cannot be empty').max(100),
  type: z.enum(['artist', 'movie', 'tv_show', 'person', 'podcast', 'brand'], {
    errorMap: () => ({ message: 'Invalid type. Must be artist, movie, tv_show, person, podcast, or brand.' }),
  }),
  entityId: z.string().trim().optional(),
});

const PassportRequestSchema = z.object({
  destination: z.string().trim().min(2, 'Destination must be at least 2 characters').max(60, 'Destination too long'),
  favorites: z.array(FavoriteSchema).min(3, 'Provide at least 3 favorites').max(8, 'Maximum 8 favorites allowed'),
});

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export async function POST(req: NextRequest) {
  const clientIp = getClientIp(req);

  // Quick rate check before initiating work
  const rateCheck = rateLimiter.check(clientIp);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      {
        error: rateCheck.reason,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfterSeconds || 60),
        },
      }
    );
  }
  rateLimiter.record(clientIp);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = PassportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        details: parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
      },
      { status: 400 }
    );
  }

  const { destination, favorites } = parsed.data;

  // Create streaming NDJSON response
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  // Run pipeline asynchronously and stream events
  (async () => {
    try {
      const result = await runPassportPipeline(
        { destination, favorites },
        {
          ip: clientIp,
          onProgress: (event) => {
            const line = JSON.stringify(event) + '\n';
            writer.write(encoder.encode(line)).catch(() => {});
          },
        }
      );

      const finalLine = JSON.stringify({ type: 'result', data: result }) + '\n';
      await writer.write(encoder.encode(finalLine));
    } catch (err: any) {
      const status = err instanceof PipelineError ? err.statusCode : 500;
      const errorLine =
        JSON.stringify({
          type: 'error',
          error: err.message || 'Pipeline processing failed',
          status,
        }) + '\n';
      await writer.write(encoder.encode(errorLine)).catch(() => {});
    } finally {
      await writer.close().catch(() => {});
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Transfer-Encoding': 'chunked',
    },
  });
}

