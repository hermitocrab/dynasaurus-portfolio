import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'dynasaurus',
      source: 'dynasaurus-deploy',
    },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-DynaSaurus-Source': 'dynasaurus-deploy',
      },
    },
  );
}
