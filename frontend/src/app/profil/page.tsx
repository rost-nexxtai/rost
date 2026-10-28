import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetButton } from '@/components/ClientActions';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getProfile } from '@/data';
import { CORE_MOMENTS } from '@/data/mock/scoring';
import { copy } from '@/i18n/lang';
import { getLang } from '@/i18n/server';
import { TERMS } from '@/i18n/terms';

export const dynamic = 'force-dynamic';

const T = copy(
  {
    title: 'Profilul tău',
    level: 'Nivel',
    core: (done: number, of: number) => `${done} din ${of} lecții de bază`,
    finish: (next: number) => `Termină-le ca să treci la L${next}.`,
    advanced: 'Ai ajuns la nivelul avansat.',
    quiz: (reason: string) => `Testul de la început: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`,
    risk: 'Profil de risc',
    riskNote: 'Pornește de la nivel și vârstă. Dacă ai nevoie de bani în mai puțin de un an, sau nu ai încă un fond de urgență de 3 luni, îl ținem mai prudent.',
    retake: 'Refă testul',
    demo: 'Demo',
    demoNote: 'Unelte pentru prezentare: evenimente simulate și cifrele instanței.',
    metrics: 'Metrici',
  },
  {
    title: 'Your profile',
    level: 'Level',
    core: (done, of) => `${done} of ${of} core lessons`,
    finish: (next) => `Finish them to move up to L${next}.`,
    advanced: "You've reached the advanced level.",
    quiz: (reason) => `Starting quiz: ${reason.charAt(0).toLowerCase()}${reason.slice(1)}.`,
    risk: 'Risk profile',
    riskNote: "It starts from your level and age. If you need the money within a year, or don't have a 3-month emergency fund yet, we keep it more cautious.",
    retake: 'Retake the quiz',
    demo: 'Demo',
    demoNote: 'Tools for the presentation: simulated events and this instance’s numbers.',
    metrics: 'Metrics',
  },
);

export default async function Profil() {
  const [profile, lang] = await Promise.all([getProfile(), getLang()]);
  if (!profile) redirect('/quiz');
  const t = T[lang];
  const terms = TERMS[lang];

  const core = CORE_MOMENTS[profile.level];
  const coreDone = core.filter((id) => profile.completedMomentIds.includes(id)).length;

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>{t.title}</h1>

      <Card>
        <div className="row">
          <div className="stack" style={{ gap: 2 }}>
            <span className="eyebrow">{t.level}</span>
            <strong style={{ fontSize: 18 }}>{terms.level[profile.level]}</strong>
          </div>
          <LevelBadge level={profile.level} />
        </div>
        {profile.level < 2 ? (
          <>
            <ProgressBar value={coreDone} max={core.length} label={t.core(coreDone, core.length)} />
            <p className="small muted">
              {t.core(coreDone, core.length)}. {t.finish(profile.level + 1)}
            </p>
          </>
        ) : (
          <p className="small muted">{t.advanced}</p>
        )}
        <p className="small muted">{t.quiz(terms.placement[profile.quizLevel])}</p>
      </Card>

      <Card>
        <span className="eyebrow">{t.risk}</span>
        <strong style={{ fontSize: 18, textTransform: 'capitalize' }}>{terms.risk[profile.riskProfile]}</strong>
        <p className="small muted">{terms.riskLine[profile.riskProfile]}.</p>
        <p className="note">{t.riskNote}</p>
      </Card>

      <div className="stack">
        <Link href="/quiz?retake=1" className="btn btn-secondary btn-block">
          {t.retake}
        </Link>
        <ResetButton />
      </div>

      <Card tone="tint">
        <span className="eyebrow">{t.demo}</span>
        <p className="small">{t.demoNote}</p>
        <Link href="/simulator" className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Simulator</span>
          <Icon name="chevron" size={18} />
        </Link>
        <Link href="/metrics" className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>{t.metrics}</span>
          <Icon name="chevron" size={18} />
        </Link>
      </Card>
      <TabBar />
    </main>
  );
}
