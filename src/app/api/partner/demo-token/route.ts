import { NextResponse } from 'next/server';
import demoUsers from '../../../../../data/seed/demo-users.json';
import { signPartnerToken } from '@/lib/partner-token';

/**
 * Stage demo only. A real bank signs this token on its own servers with its own secret,
 * from category shares it computes from its customer's card spending.
 */
export async function GET() {
  if (process.env.ALLOW_DEMO_TOKEN !== 'true') return NextResponse.json({ error: 'disabled' }, { status: 403 });
  const maria = demoUsers.users[0];
  const token = await signPartnerToken({
    partnerId: 'demo-bank',
    ageBand: '18-24',
    event: 'inflation_published',
    shares: maria.spending.shares,
    monthly: maria.spending.monthly,
    grossMonthly: maria.grossMonthly,
    monthlyExpenses: maria.monthlyExpenses,
  });
  return NextResponse.json({ token, url: `/embed?token=${encodeURIComponent(token)}` });
}
