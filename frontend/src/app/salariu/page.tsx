import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PayslipReveal } from '@/components/moments/PayslipReveal';
import { SalaryEditor } from '@/components/SalaryEditor';
import { ApiDown } from '@/components/ui/ApiDown';
import { Icon } from '@/components/ui/Icon';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getProfile, getSalary } from '@/data';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    back: 'Profil',
    title: 'Salariul tău',
    intro: 'Unde merg banii din salariul brut, pe regulile de anul ăsta. Dacă ți se schimbă salariul, schimbă-l aici și totul se recalculează.',
    none: 'Nu știm încă salariul tău. Adaugă-l și îți arătăm cât merge la pensie, la sănătate, la impozit și cât îți rămâne.',
    lastRaise: (date: string) => `Ultima mărire: ${date}`,
    down: 'Nu putem încărca salariul acum. Încearcă din nou peste puțin.',
    noSession: 'Fă testul de la început ca să-ți putem salva salariul.',
    quiz: 'Fă testul',
  },
  {
    back: 'Profile',
    title: 'Your salary',
    intro: "Where your gross salary goes, on this year's rules. If your salary changes, change it here and everything is worked out again.",
    none: "We don't know your salary yet. Add it and we'll show you how much goes to your pension, health, tax, and what you keep.",
    lastRaise: (date) => `Last raise: ${date}`,
    down: "We can't load your salary right now. Try again in a moment.",
    noSession: 'Take the starting quiz so we can save your salary.',
    quiz: 'Take the quiz',
  },
);

export default async function Salariu() {
  const [profile, salary, lang] = await Promise.all([getProfile(), getSalary(), getLang()]);
  if (!profile) redirect('/quiz');
  const t = T[lang];
  const date = (iso: string) => new Intl.DateTimeFormat(lang === 'ro' ? 'ro-RO' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso));

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <Link href="/profil" className="link-back">
        <Icon name="back" size={18} /> {t.back}
      </Link>
      <h1>{t.title}</h1>
      {salary === 'down' ? (
        <ApiDown what={t.down} />
      ) : !salary ? (
        <>
          <p className="muted">{t.noSession}</p>
          <Link href="/quiz?retake=1" className="btn btn-primary">
            {t.quiz}
          </Link>
        </>
      ) : (
        <>
          <p className="muted">{salary.payslip ? t.intro : t.none}</p>
          {salary.payslip && <PayslipReveal p={salary.payslip} />}
          {salary.lastRaiseDate && <p className="small muted">{t.lastRaise(date(salary.lastRaiseDate))}</p>}
          <SalaryEditor current={salary.gross} now={salary.payslip} />
        </>
      )}
      <TabBar />
    </main>
  );
}
