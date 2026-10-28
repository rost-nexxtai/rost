import { NextResponse } from 'next/server';
import { computeMetrics } from '@/lib/metrics';
import { getStore } from '@/lib/store';

export async function GET() {
  return NextResponse.json(await computeMetrics(await getStore()));
}
