import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DemoLogin } from '@/components/ClientActions';
import { currentUserId } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const uid = await currentUserId();
  if (uid && (await (await getStore()).getUser(uid))) redirect('/today');

  return (
    <main className="shell">
      <div className="wordmark">
        rost<span>.</span>
      </div>
      <section className="card card-dark">
        <span className="eyebrow">Your money, on time</span>
        <h1>What your money life, and the news, mean for you.</h1>
        <p className="muted">
          A 3-minute moment when something happens: your payslip, this month&apos;s inflation, a what-if. Your numbers, then one
          action.
        </p>
        <Link href="/onboarding" className="btn btn-light">
          Start
        </Link>
      </section>
      <DemoLogin />
      <p className="note">Education, not financial advice. Rost never moves your money.</p>
    </main>
  );
}
