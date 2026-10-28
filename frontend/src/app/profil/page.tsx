import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ResetButton } from '@/components/ClientActions';
import { LEVEL_NAME, RISK_LINE } from '@/components/quiz/QuizResult';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { LevelBadge } from '@/components/ui/LevelBadge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TabBar } from '@/components/ui/TabBar';
import { TopBar } from '@/components/ui/TopBar';
import { getProfile } from '@/data';
import { CORE_MOMENTS } from '@/data/mock/scoring';

export const dynamic = 'force-dynamic';

export default async function Profil() {
  const profile = await getProfile();
  if (!profile) redirect('/quiz');

  const core = CORE_MOMENTS[profile.level];
  const coreDone = core.filter((id) => profile.completedMomentIds.includes(id)).length;

  return (
    <main className="shell">
      <TopBar profile={profile} />
      <h1>Profilul tău</h1>

      <Card>
        <div className="row">
          <div className="stack" style={{ gap: 2 }}>
            <span className="eyebrow">Nivel</span>
            <strong style={{ fontSize: 18 }}>{LEVEL_NAME[profile.level]}</strong>
          </div>
          <LevelBadge level={profile.level} />
        </div>
        {profile.level < 2 ? (
          <>
            <ProgressBar value={coreDone} max={core.length} label={`${coreDone} din ${core.length} lecții de bază`} />
            <p className="small muted">
              {coreDone} din {core.length} lecții de bază. Termină-le ca să treci la L{profile.level + 1}.
            </p>
          </>
        ) : (
          <p className="small muted">Ai ajuns la nivelul avansat.</p>
        )}
        <p className="small muted">Testul: {profile.quizScore} din 6 răspunsuri corecte.</p>
      </Card>

      <Card>
        <span className="eyebrow">Profil de risc</span>
        <strong style={{ fontSize: 18, textTransform: 'capitalize' }}>{profile.riskProfile}</strong>
        <p className="small muted">{RISK_LINE[profile.riskProfile]}.</p>
        <p className="note">
          Pornește de la nivel și vârstă. Dacă ai nevoie de bani în mai puțin de un an, sau nu ai încă un fond de urgență de 3 luni,
          îl ținem mai prudent.
        </p>
      </Card>

      <div className="stack">
        <Link href="/quiz" className="btn btn-secondary btn-block">
          Refă testul
        </Link>
        <ResetButton />
      </div>

      <Card tone="tint">
        <span className="eyebrow">Demo</span>
        <p className="small">Unelte pentru prezentare: evenimente simulate și cifrele instanței.</p>
        <Link href="/simulator" className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Simulator</span>
          <Icon name="chevron" size={18} />
        </Link>
        <Link href="/metrics" className="list-row" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span>Metrici</span>
          <Icon name="chevron" size={18} />
        </Link>
      </Card>
      <TabBar />
    </main>
  );
}
