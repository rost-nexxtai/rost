import type { Lang } from '@/i18n/lang';
import type { Asset, AssetId, Broker, NewsItem, SavingsProvider } from '../types';
import { ASSETS } from './assets';
import { BROKERS } from './brokers';
import { NEWS } from './news';
import { SAVINGS } from './providers';

/**
 * English text for the asset, news and provider fixtures. Only words live here; numbers, ids and
 * links stay in the Romanian source files, so the two languages can't drift apart on figures.
 */

const MARKET_TAX = '3% of the gain if you hold over a year, 6% under a year, withheld by a Romanian broker. Through a foreign broker: 16%, declared in your annual tax return.';

const ASSETS_EN: Record<AssetId, Pick<Asset, 'name' | 'oneLine' | 'access' | 'tax' | 'whatItIs'> & { note?: string; sourceLabel?: string }> = {
  cont_economii: {
    name: 'Savings account',
    oneLine: 'Money to hand, with a little interest.',
    access: 'Any time, no penalties',
    tax: '10% tax on interest, withheld by the bank',
    whatItIs:
      'A bank account you can take money out of any time. The interest is low and can change, but it is the right place for your emergency fund. Deposits are guaranteed by the FGDB up to €100,000 per person, per bank.',
  },
  depozit: {
    name: 'Term deposit',
    oneLine: "Fixed interest, if you don't touch the money for a while.",
    access: 'At the end of the term. Break it early and you usually lose the interest',
    tax: '10% tax on interest, withheld by the bank',
    whatItIs: 'You lock a sum away for 1, 3, 6, 12 months or more and get fixed interest. Guaranteed by the FGDB up to €100,000 per person, per bank.',
  },
  titluri_stat: {
    name: 'Government bonds (Tezaur, Fidelis)',
    oneLine: 'You lend to the state and get tax-free interest.',
    access: "Tezaur: until maturity. Fidelis: can be sold on the stock exchange, at the day's price",
    tax: 'No tax on the interest',
    whatItIs: 'The Romanian state borrows from people like you, every month. Tezaur is bought from the Treasury, the Post Office or online; Fidelis through banks and brokers, during the subscription period.',
  },
  etf: {
    name: 'Index ETFs',
    oneLine: 'Hundreds of companies in a single purchase.',
    access: "Sell any time on the stock exchange, at the day's price. The price may be lower than you paid",
    tax: MARKET_TAX,
    whatItIs: 'A fund that tracks an index, for example the ~1,400 largest companies in developed countries (MSCI World). You buy it through a broker, like a share.',
    sourceLabel: 'MSCI World, yearly returns 1970–2025',
  },
  actiuni: {
    name: 'Shares',
    oneLine: 'Pieces of companies: they can grow a lot or go to zero.',
    access: "Sell any time on the stock exchange, at the day's price",
    tax: MARKET_TAX,
    whatItIs: 'A share is a piece of a single company. You gain if the company grows and pays dividends; you lose if it does badly. Several companies spread the risk.',
    note: 'The chart shows a whole market. A single company can go to zero; the BET index lost 70% in 2008.',
    sourceLabel: 'MSCI World, yearly returns 1970–2025',
  },
  aur: {
    name: 'Gold and commodities',
    oneLine: 'Protection in a crisis, no interest and some hard years.',
    access: 'Through gold ETFs, on the stock exchange; physical gold is harder and costlier to sell',
    tax: MARKET_TAX,
    whatItIs: 'Gold pays no interest. Its price often rises when markets get scared and falls in calm years. Commodities (oil, metals) move even more sharply.',
    sourceLabel: 'Gold (GLD), yearly returns 2005–2025',
  },
};

const NEWS_EN: Record<string, Pick<NewsItem, 'date' | 'title' | 'facts'> & { sources: string[]; alternative?: string }> = {
  motorina: {
    date: '28 Oct 2026',
    title: 'Oil stays expensive, and the diesel excise cut ends on 31 October',
    facts: [
      'Brent: $114.22 a barrel on 27 October.',
      'Petrol costs 10.10 lei/L, diesel 10.90 lei/L. A year ago: 7.46 and 7.66 lei/L.',
      'Without the excise cut, diesel could rise by about 0.85 lei/L.',
      'Oil rose with the war in Iran, which began on 28 February 2026.',
    ],
    sources: ["Ziarul Profit: today's prices", 'Ziarul Profit: compared with 2025', 'Wikipedia: economic impact of the war'],
  },
  electricitate: {
    date: '7 Oct 2026',
    title: 'Electricity bills could rise 20–22% this winter and spring',
    facts: ['The estimate comes from the state secretary at the Ministry of Energy.', 'Gas for households has a regulated price, so no rises are expected there.'],
    sources: ['Capital: bills in winter 2026–2027'],
  },
  bnr: {
    date: '8 Oct 2026',
    title: 'The National Bank holds its rate at 6.50% and expects inflation to rise again',
    facts: [
      'The 8 October decision: the eighth meeting in a row without a change.',
      'The reasons: fuel, energy, a severe drought, the Middle East conflict, a weaker leu.',
      "Erste/BCR doesn't expect a rate cut before May 2027.",
    ],
    sources: ['Bankingnews: BNR holds the key rate at 6.50%'],
    alternative: '1-year Tezaur',
  },
};

/** Provider product names in English. */
function productEn(ro: string): string {
  return ro
    .replace('Cont de economii', 'Savings account')
    .replace(/Depozit la (\d+) (de )?luni/, '$1-month deposit')
    .replace(/, (\d+) an$/, ', $1 year')
    .replace(/, (\d+) ani/, ', $1 years');
}

export function assetsFor(lang: Lang): Asset[] {
  if (lang === 'ro') return ASSETS;
  return ASSETS.map((a) => {
    const en = ASSETS_EN[a.id];
    const simulation =
      a.simulation.kind === 'range'
        ? { ...a.simulation, note: a.simulation.note && en.note, source: { ...a.simulation.source, label: en.sourceLabel ?? a.simulation.source.label } }
        : a.simulation;
    return { ...a, name: en.name, oneLine: en.oneLine, access: en.access, tax: en.tax, whatItIs: en.whatItIs, simulation };
  });
}

export function newsFor(lang: Lang): NewsItem[] {
  if (lang === 'ro') return NEWS;
  return NEWS.map((n) => {
    const en = NEWS_EN[n.id];
    const impact = n.impact.kind === 'savings' && en.alternative ? { ...n.impact, alternative: { ...n.impact.alternative, label: en.alternative } } : n.impact;
    return { ...n, date: en.date, title: en.title, facts: en.facts, sources: n.sources.map((s, i) => ({ ...s, label: en.sources[i] ?? s.label })), impact };
  });
}

export function savingsFor(lang: Lang): SavingsProvider[] {
  if (lang === 'ro') return SAVINGS;
  return SAVINGS.map((p) => ({ ...p, name: p.name === 'Statul român' ? 'Romanian state' : p.name.replace('Banca ', 'Bank '), product: productEn(p.product) }));
}

export function brokersFor(lang: Lang): Broker[] {
  if (lang === 'ro') return BROKERS;
  return BROKERS.map((b) => ({ ...b, name: b.name.replace('(UE)', '(EU)') }));
}
