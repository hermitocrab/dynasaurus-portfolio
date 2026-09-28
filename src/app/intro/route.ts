import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export const dynamic = 'force-static';

export async function GET() {
  const html = await readFile(
    path.join(process.cwd(), 'public', 'intro.html'),
    'utf-8'
  );
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
