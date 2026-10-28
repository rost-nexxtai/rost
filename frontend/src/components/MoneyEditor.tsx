'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Slider } from '@/components/ui/Slider';
import { saveMyMoney } from '@/data/actions';
import { quizFor } from '@/data/fixtures/quiz';
import { DEFAULT_EXPENSES_LEI, type MyMoney } from '@/data/mock/money';
import { NATIONAL_INFLATION_PCT } from '@/data/mock/scoring';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    situation: 'Ce faci acum',
    work: 'Salariul',
    gross: 'Salariul brut pe lună',
    grossNote: 'Dacă ți-a crescut, pune-l pe cel nou: îți redeschidem lecția despre salariu cu cifrele noi.',
    noSalary: 'Fără salariu acum. Când ai din nou unul, alege „Am un job” și pune-l aici.',
    payday: 'Ziua de salariu',
    paydayNote: 'În ziua asta îți aducem lecția potrivită.',
    hireDate: 'Data angajării',
    hireNote: 'Ca să te anunțăm din timp până când îți alegi fondul de Pilon II.',
    month: 'Luna',
    spend: 'Cheltui pe lună',
    spendNote: (d: string) => `Dacă nu ne spui, calculăm cu ${d}, o medie, și scriem asta lângă cifre.`,
    saved: 'Ai pus deoparte',
    fuel: 'Carburant pe lună',
    power: 'Curent pe lună',
    mix: 'Pe ce se duc banii',
    mixNote: 'Din asta iese inflația ta: prețurile nu cresc la fel pentru toți.',
    services: 'Chirie, facturi, abonamente, ieșiri',
    food: 'Mâncare',
    other: (pct: number) => `Restul, ${pct}%: haine, electronice, alte lucruri`,
    setMix: 'Spune-ne cum cheltui',
    yours: 'al tău',
    assumed: 'presupus',
    save: 'Salvează',
    saving: 'Se salvează…',
    savedOk: 'Salvat. Lecțiile, simulările și știrile folosesc acum cifrele tale.',
    savedLocal: 'Salvat doar pe acest dispozitiv: serverul nu răspunde, așa că momentele declanșate de salariu nu pornesc încă.',
    inflation: (pct: string, personal: boolean, national: string) =>
      personal ? `Inflația ta: ${pct} (națională: ${national}).` : `Folosim inflația națională, ${pct}, până ne spui pe ce cheltui.`,
    invalid: 'Verifică sumele: doar cifre, fără minus.',
    lei: 'lei',
  },
  {
    situation: 'What you do now',
    work: 'Salary',
    gross: 'Gross monthly salary',
    grossNote: 'If it went up, put in the new one: we reopen the salary lesson with the new numbers.',
    noSalary: 'No salary right now. When you have one again, pick "I have a job" and put it here.',
    payday: 'Payday',
    paydayNote: 'On this day we bring you the lesson that fits.',
    hireDate: 'Hire date',
    hireNote: 'So we can tell you in time before you need to pick a Pillar II fund.',
    month: 'Month',
    spend: 'You spend a month',
    spendNote: (d) => `If you don't say, we use ${d}, an average, and say so next to the numbers.`,
    saved: 'You have put aside',
    fuel: 'Fuel a month',
    power: 'Electricity a month',
    mix: 'Where the money goes',
    mixNote: "This gives your own inflation: prices don't rise the same for everyone.",
    services: 'Rent, bills, subscriptions, going out',
    food: 'Food',
    other: (pct) => `The rest, ${pct}%: clothes, electronics, other things`,
    setMix: 'Tell us how you spend',
    yours: 'yours',
    assumed: 'assumed',
    save: 'Save',
    saving: 'Saving…',
    savedOk: 'Saved. Lessons, simulations and news now use your numbers.',
    savedLocal: "Saved on this device only: the server isn't answering, so salary-triggered moments can't start yet.",
    inflation: (pct, personal, national) => (personal ? `Your inflation: ${pct} (national: ${national}).` : `We use the national inflation, ${pct}, until you tell us how you spend.`),
    invalid: 'Check the amounts: numbers only, no minus.',
    lei: 'lei',
  },
);

type Num = number | undefined;

/** Profil → "Banii tăi": every number the app uses about you, each marked as yours or assumed. */
export function MoneyEditor({ initial, inflation }: { initial: MyMoney; inflation: { pct: number; personal: boolean } }) {
  const router = useRouter();
  const { lang, f } = useLang();
  const t = T[lang];
  const [m, setM] = useState<MyMoney>(initial);
  const [status, setStatus] = useState<{ ok: boolean; inflation?: { pct: number; personal: boolean } }>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof MyMoney>(k: K, v: MyMoney[K]) => {
    setM((x) => ({ ...x, [k]: v }));
    setStatus(undefined);
  };
  const employed = m.situation === 'employed';
  const amounts = [m.grossMonthly, m.expensesLei, m.savedLei, m.fuelLei, m.electricityLei];
  const valid = amounts.every((a) => a === undefined || (Number.isFinite(a) && a >= 0));
  const shown = status?.inflation ?? inflation;

  async function save() {
    setBusy(true);
    const out = await saveMyMoney(m, initial.grossMonthly);
    setStatus({ ok: out.synced, inflation: out.inflationPct !== undefined ? { pct: out.inflationPct, personal: !!out.personal } : undefined });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <section className="card stack" style={{ gap: 10 }}>
        <span className="eyebrow">{t.situation}</span>
        <div className="tiles">
          {quizFor(lang).profile.situation.map((o) => (
            <button key={o.value} type="button" className="tile" style={{ minHeight: 48, padding: 10 }} aria-pressed={m.situation === o.value} onClick={() => set('situation', o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <span className="eyebrow">{t.work}</span>
        {employed ? (
          <>
            <Field label={t.gross} value={m.grossMonthly} onChange={(v) => set('grossMonthly', v)} yours={t.yours} assumed={t.assumed} unit={t.lei} note={t.grossNote} />
            <label className="stack" style={{ gap: 6 }}>
              <Head label={t.payday} known={m.payday !== undefined} yours={t.yours} assumed={t.assumed} />
              <input className="input" inputMode="numeric" value={m.payday ?? ''} placeholder="10" onChange={(e) => set('payday', day(e.target.value))} />
              <span className="note">{t.paydayNote}</span>
            </label>
            <label className="stack" style={{ gap: 6 }}>
              <Head label={t.hireDate} known={!!m.hireDate} yours={t.yours} assumed={t.assumed} />
              <input className="input" type="month" aria-label={t.month} value={m.hireDate?.slice(0, 7) ?? ''} onChange={(e) => set('hireDate', e.target.value ? `${e.target.value}-01` : undefined)} />
              <span className="note">{t.hireNote}</span>
            </label>
          </>
        ) : (
          <p className="small">{t.noSalary}</p>
        )}
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <Field label={t.spend} value={m.expensesLei} onChange={(v) => set('expensesLei', v)} yours={t.yours} assumed={t.assumed} unit={t.lei} placeholder={String(DEFAULT_EXPENSES_LEI)} note={t.spendNote(f.lei(DEFAULT_EXPENSES_LEI))} />
        <Field label={t.saved} value={m.savedLei} onChange={(v) => set('savedLei', v)} yours={t.yours} assumed={t.assumed} unit={t.lei} />
        <Field label={t.fuel} value={m.fuelLei} onChange={(v) => set('fuelLei', v)} yours={t.yours} assumed={t.assumed} unit={t.lei} />
        <Field label={t.power} value={m.electricityLei} onChange={(v) => set('electricityLei', v)} yours={t.yours} assumed={t.assumed} unit={t.lei} />
      </section>

      <section className="card stack" style={{ gap: 12 }}>
        <Head label={t.mix} known={!!m.shares} yours={t.yours} assumed={t.assumed} />
        <p className="note" style={{ margin: 0 }}>{t.mixNote}</p>
        {m.shares ? (
          <>
            <Slider label={t.services} min={0} max={100} step={5} value={m.shares.services} onChange={(v) => set('shares', mix(v, m.shares!.food))} format={(v) => `${v}%`} />
            <Slider label={t.food} min={0} max={100} step={5} value={m.shares.food} onChange={(v) => set('shares', mix(m.shares!.services, v, 'food'))} format={(v) => `${v}%`} />
            <span className="small muted">{t.other(m.shares.nonFood)}</span>
          </>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => set('shares', { services: 45, food: 30, nonFood: 25 })}>
            {t.setMix}
          </button>
        )}
        <p className="small" style={{ margin: 0 }} aria-live="polite">
          {t.inflation(f.pct(shown.pct, 2), shown.personal, f.pct(NATIONAL_INFLATION_PCT, 2))}
        </p>
      </section>

      {!valid && <p className="small" style={{ color: 'var(--danger)', margin: 0 }}>{t.invalid}</p>}
      {status && (
        <p className="card card-tint small" role="status" style={{ margin: 0 }}>
          {status.ok ? t.savedOk : t.savedLocal}
        </p>
      )}
      <button type="button" className="btn btn-primary btn-block" disabled={!valid || busy} onClick={save}>
        {busy ? t.saving : t.save}
      </button>
    </div>
  );
}

/** Services and food from the sliders; the rest is everything else. The slider moved last wins if they go over 100. */
function mix(services: number, food: number, moved: 'services' | 'food' = 'services') {
  if (services + food > 100) moved === 'food' ? (services = 100 - food) : (food = 100 - services);
  return { services, food, nonFood: 100 - services - food };
}

function day(v: string): Num {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : undefined;
}

function Head({ label, known, yours, assumed }: { label: string; known: boolean; yours: string; assumed: string }) {
  return (
    <span className="row">
      <span className="small" style={{ fontWeight: 600 }}>
        {label}
      </span>
      <span className={`tag ${known ? 'tag-done' : 'tag-example'}`}>{known ? yours : assumed}</span>
    </span>
  );
}

function Field(props: { label: string; value: Num; onChange: (v: Num) => void; yours: string; assumed: string; unit: string; placeholder?: string; note?: string }) {
  const { label, value, onChange, unit, placeholder, note } = props;
  return (
    <label className="stack" style={{ gap: 6 }}>
      <Head label={label} known={value !== undefined} yours={props.yours} assumed={props.assumed} />
      <span className="row" style={{ gap: 8 }}>
        <input
          className="input"
          inputMode="numeric"
          value={value ?? ''}
          placeholder={placeholder}
          onChange={(e) => {
            const raw = e.target.value.replace(/[.\s]/g, '');
            onChange(raw === '' ? undefined : Number(raw));
          }}
        />
        <span className="small muted">{unit}</span>
      </span>
      {note && <span className="note">{note}</span>}
    </label>
  );
}
