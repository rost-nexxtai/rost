'use client';

import { useState } from 'react';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';

const T = copy(
  {
    concept: 'Concept · bancă fictivă',
    account: 'Cont curent',
    balance: '4.180 lei',
    salary: 'Salariul a intrat azi',
    salaryIn: '+3.510 lei',
    tabs: ['Conturi', 'Carduri', 'Învață'],
    newMoment: 'Moment nou · 3 min',
    title: 'Salariul tău, pe înțeles',
    hook: 'Ghicește unde s-au dus cei 6.000 lei brut, apoi vezi-i rând cu rând.',
    start: 'Începe',
    next: 'Inflația ta, luna asta',
    nextHook: '8,48% pentru tine, față de 6,61% național',
    actionHere: 'Acțiunea se face aici',
    rule: 'Mută 400 lei în Economii',
    ruleSub: 'La fiecare salariu · fondul de urgență e plin în 19 luni',
    ruleOn: 'Regula e activă. Rost nu mută niciodată bani: o face banca ta.',
    neutral: 'Comparațiile din Învață sunt ordonate după o formulă publică. [PARTNER BANK] nu le poate schimba.',
    nav: ['Acasă', 'Plăți', 'Învață', 'Mai mult'],
  },
  {
    concept: 'Concept · fictional bank',
    account: 'Current account',
    balance: '4,180 lei',
    salary: 'Salary received today',
    salaryIn: '+3,510 lei',
    tabs: ['Accounts', 'Cards', 'Learn'],
    newMoment: 'New moment · 3 min',
    title: 'Your salary, explained',
    hook: 'Guess where your 6,000 lei gross went, then see it line by line.',
    start: 'Start',
    next: 'Your inflation this month',
    nextHook: '8.48% for you, against 6.61% nationally',
    actionHere: 'The action happens here',
    rule: 'Move 400 lei to Savings',
    ruleSub: 'Every payday · emergency fund full in 19 months',
    ruleOn: 'The rule is on. Rost never moves money: your bank does.',
    neutral: 'Comparisons in Learn are ranked by a public formula. [PARTNER BANK] cannot change them.',
    nav: ['Home', 'Payments', 'Learn', 'More'],
  },
);

const BANK = { primary: '#0B4F75', ground: '#EEF3F6', ink: '#0F1C24', line: '#D5E0E7', muted: '#5B6B76' };

/**
 * A static picture of the licence: Rost moments inside a partner bank's own app, for the pitch video.
 * Nothing here is wired to the backend. The bank is fictional and the screen says so.
 */
export function BankMock() {
  const t = T[useLang().lang];
  const [on, setOn] = useState(false);
  const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  return (
    <main style={{ minHeight: '100dvh', background: BANK.ground, color: BANK.ink, fontFamily: font, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '18px 18px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <strong style={{ color: BANK.primary, fontSize: 18, letterSpacing: 0.3 }}>[PARTNER BANK]</strong>
        <span style={{ fontSize: 11, color: BANK.muted, border: `1px solid ${BANK.line}`, borderRadius: 99, padding: '3px 8px' }}>{t.concept}</span>
      </div>

      <div style={{ flex: 1, padding: '14px 16px 96px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <section style={{ background: BANK.primary, color: '#fff', borderRadius: 18, padding: '16px 18px' }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>{t.account}</div>
          <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: -0.5, margin: '2px 0 6px' }}>{t.balance}</div>
          <div style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ opacity: 0.85 }}>{t.salary}</span>
            <strong>{t.salaryIn}</strong>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#fff', borderRadius: 12, padding: 4, border: `1px solid ${BANK.line}` }}>
          {t.tabs.map((tab, i) => (
            <span key={tab} style={{ textAlign: 'center', padding: '9px 0', borderRadius: 9, fontSize: 14, fontWeight: 600, background: i === 2 ? BANK.primary : 'transparent', color: i === 2 ? '#fff' : BANK.muted }}>
              {tab}
            </span>
          ))}
        </div>

        {/* Rost's own look inside the bank's frame: the licensed part */}
        <section style={{ background: 'var(--ink, #16181D)', color: '#fff', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
            <span style={{ color: 'var(--accent, #E8553A)' }}>{t.newMoment}</span>
            <span style={{ fontFamily: 'var(--display)', textTransform: 'none', letterSpacing: 0, fontSize: 14 }}>
              rost<span style={{ color: 'var(--accent, #E8553A)' }}>.</span>
            </span>
          </div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.5 }}>{t.title}</div>
          <div style={{ fontSize: 14, opacity: 0.8 }}>{t.hook}</div>
          <span style={{ alignSelf: 'flex-start', marginTop: 4, background: '#fff', color: '#16181D', borderRadius: 99, padding: '9px 18px', fontWeight: 700, fontSize: 14 }}>{t.start} →</span>
        </section>

        <section style={{ background: '#fff', border: `1px solid ${BANK.line}`, borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{t.next}</div>
            <div style={{ fontSize: 13, color: BANK.muted }}>{t.nextHook}</div>
          </div>
          <span style={{ fontFamily: 'var(--display)', fontWeight: 700 }}>
            rost<span style={{ color: 'var(--accent, #E8553A)' }}>.</span>
          </span>
        </section>

        <section style={{ background: '#fff', border: `1px solid ${BANK.line}`, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: BANK.primary }}>{t.actionHere}</span>
          <button
            type="button"
            onClick={() => setOn((v) => !v)}
            aria-pressed={on}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
          >
            <span>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 16 }}>{t.rule}</span>
              <span style={{ display: 'block', fontSize: 13, color: BANK.muted }}>{t.ruleSub}</span>
            </span>
            <span style={{ width: 52, height: 30, borderRadius: 99, background: on ? BANK.primary : BANK.line, position: 'relative', flex: 'none', transition: 'background 200ms' }}>
              <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: 99, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.25)', transition: 'left 220ms cubic-bezier(.3,.7,.4,1)' }} />
            </span>
          </button>
          {on && <span style={{ fontSize: 13, color: BANK.primary, fontWeight: 600 }}>{t.ruleOn}</span>}
        </section>

        <p style={{ fontSize: 12, color: BANK.muted, margin: '2px 4px 0' }}>{t.neutral}</p>
      </div>

      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: `1px solid ${BANK.line}`, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', padding: '10px 0 18px' }}>
        {t.nav.map((n, i) => (
          <span key={n} style={{ textAlign: 'center', fontSize: 12, fontWeight: i === 2 ? 700 : 500, color: i === 2 ? BANK.primary : BANK.muted }}>
            {n}
          </span>
        ))}
      </nav>
    </main>
  );
}
