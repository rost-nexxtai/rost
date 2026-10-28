import { useState } from 'react';
import { MOMENTS } from './data';
import { Home } from './Home';
import { Moments } from './Moments';
import { News } from './News';
import { Onboarding } from './Onboarding';
import { LEVEL_LABEL, loadProfile, riskFor, saveProfile, type Level, type Profile } from './profile';

type Tab = 'home' | 'moments' | 'news';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'moments', label: 'Momente' },
  { id: 'news', label: 'Știri' },
];

export function App() {
  const [profile, setProfileState] = useState<Profile | undefined>(loadProfile);
  const [tab, setTab] = useState<Tab>('home');
  const [openMoment, setOpenMoment] = useState<string>();
  const [levelUp, setLevelUp] = useState(false);

  const setProfile = (p: Profile | undefined) => {
    saveProfile(p);
    setProfileState(p);
  };

  if (!profile) return <Onboarding onDone={setProfile} />;

  /** Finishing every moment recommended for your level moves you up one level. */
  function complete(id: string) {
    if (!profile || profile.doneMoments.includes(id)) return;
    const doneMoments = [...profile.doneMoments, id];
    const levelDone = MOMENTS.filter((m) => m.level === profile.level).every((m) => doneMoments.includes(m.id));
    const level = (levelDone && profile.level < 2 ? profile.level + 1 : profile.level) as Level;
    setLevelUp(level > profile.level);
    setProfile({ ...profile, doneMoments, level, risk: riskFor(profile.age, level) });
  }

  return (
    <main className="shell">
      <header className="row">
        <div className="wordmark">
          rost<span>.</span>
        </div>
        <span className="row tight">
          <span className="badge">{LEVEL_LABEL[profile.level]}</span>
          <span className="badge badge-grey">Risc {profile.risk}</span>
        </span>
      </header>

      {levelUp && (
        <button className="card card-dark reset" onClick={() => setLevelUp(false)}>
          <span className="eyebrow">Felicitări</span>
          <strong>Ai avansat la {LEVEL_LABEL[profile.level]}. Ai momente noi recomandate.</strong>
        </button>
      )}

      {tab === 'home' && (
        <Home
          profile={profile}
          onLearn={(id) => {
            setOpenMoment(id);
            setTab('moments');
          }}
        />
      )}
      {tab === 'moments' && <Moments profile={profile} openId={openMoment} onOpen={setOpenMoment} onComplete={complete} />}
      {tab === 'news' && <News profile={profile} />}

      <button className="link center" onClick={() => setProfile(undefined)}>
        Refă testul de început
      </button>

      <nav className="nav" aria-label="Secțiuni">
        {TABS.map((t) => (
          <button
            key={t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              setOpenMoment(undefined);
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </main>
  );
}
