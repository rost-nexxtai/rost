import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MoneyEditor } from '@/components/MoneyEditor';
import { Icon } from '@/components/ui/Icon';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import type { CategoryShares } from '@/contract';
import { getMe, getProfile } from '@/data';
import type { MyMoney } from '@/data/mock/money';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    back: 'Profil',
    title: 'Banii tăi',
    intro: 'Cifrele pe care Rost le folosește despre tine. Ce nu ne spui presupunem, și scriem „presupus” lângă. Le poți schimba oricând: salariul, jobul, cât cheltui.',
  },
  {
    back: 'Profile',
    title: 'Your money',
    intro: "The numbers Rost uses about you. What you don't tell us we assume, and mark as \"assumed\". Change them any time: your salary, your job, what you spend.",
  },
);

/** Shares as whole percents, whatever scale the backend stored them in. */
function percents(s: CategoryShares): CategoryShares {
  const total = s.services + s.nonFood + s.food || 1;
  const services = Math.round((s.services / total) * 100);
  const food = Math.round((s.food / total) * 100);
  return { services, food, nonFood: 100 - services - food };
}

export default async function Bani() {
  const [profile, me, lang] = await Promise.all([getProfile(), getMe(), getLang()]);
  if (!profile) redirect('/quiz');
  const t = T[lang];
  const user = me && me !== 'down' ? me.user : undefined;
  const known = (line: 'fuelLei' | 'electricityLei' | 'savedLei') => (profile.money.known?.includes(line) ? profile.money[line] : undefined);

  const initial: MyMoney = {
    situation: user?.situations[0] ?? profile.situation,
    grossMonthly: user?.grossMonthly,
    payday: user?.payday,
    hireDate: user?.hireDate,
    expensesLei: user?.monthlyExpenses ?? profile.money.expensesLei,
    savedLei: known('savedLei'),
    fuelLei: known('fuelLei'),
    electricityLei: known('electricityLei'),
    shares: user?.spending?.shares && percents(user.spending.shares),
  };
  const inflation =
    me && me !== 'down'
      ? { pct: me.inflation.personalPct ?? me.inflation.headlinePct, personal: me.inflation.personalPct !== null }
      : { pct: profile.money.inflationPct, personal: !!profile.money.inflationPersonal };

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <Link href="/profil" className="link-back">
        <Icon name="back" size={18} /> {t.back}
      </Link>
      <h1>{t.title}</h1>
      <p className="muted">{t.intro}</p>
      <MoneyEditor initial={initial} inflation={inflation} />
      <TabBar />
    </main>
  );
}
