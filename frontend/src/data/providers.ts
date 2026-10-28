// Words for the backend's ranked providers (GET /api/providers). The backend owns the order and the
// numbers; this only turns them into the lines an asset page and Acasă show.
import type { AssetProvidersResponse, Clients, RankedBroker, RankedOffer } from '@/contract';
import { pct } from '@/lib/format';
import { copy, type Lang } from '@/i18n/lang';
import type { RankedProvider } from './types';

const LOCALE: Record<Lang, string> = { ro: 'ro-RO', en: 'en-GB' };

const T = copy(
  {
    perYear: (rate: string) => `${rate} pe an, după impozit`,
    perOrder: (cost: string) => `${cost} la un ordin de 1.000 lei`,
    brokerRO: 'Broker din România',
    brokerEU: (regulator: string) => `Broker din UE · ${regulator}`,
    taxRO: 'Reține impozitul pentru tine: 3% pe câștig dacă ții titlul un an, 6% sub un an',
    taxEU: 'Impozit 16% pe câștig, îl declari tu în Declarația unică',
    upTo: (rate: string) => `până la ${rate} pe an, după impozit`,
    costsFrom: (cost: string) => `costuri de la ${cost} la un ordin de 1.000 lei`,
    clients: (n: string, estimate: boolean) => `${estimate ? 'cam ' : ''}${n} clienți în România`,
  },
  {
    perYear: (rate) => `${rate} a year, after tax`,
    perOrder: (cost) => `${cost} on a 1,000 lei order`,
    brokerRO: 'Romanian broker',
    brokerEU: (regulator) => `EU broker · ${regulator}`,
    taxRO: 'Withholds the tax for you: 3% on gains if you hold a year, 6% if less',
    taxEU: 'Tax of 16% on gains, which you declare yourself in the Declarația unică',
    upTo: (rate) => `up to ${rate} a year, after tax`,
    costsFrom: (cost) => `costs from ${cost} on a 1,000 lei order`,
    clients: (n, estimate) => `${estimate ? 'about ' : ''}${n} clients in Romania`,
  },
);

/** "2026-10" → "oct. 2026" / "Oct 2026". */
export function checkedMonth(yyyyMm: string | undefined, lang: Lang): string | undefined {
  const m = yyyyMm?.match(/^(\d{4})-(\d{2})$/);
  if (!m) return undefined;
  return new Intl.DateTimeFormat(LOCALE[lang], { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(+m[1], +m[2] - 1, 1));
}

/** Lei with two decimals, for broker fees: "5,73 lei". */
export const lei2 = (n: number, lang: Lang) =>
  `${new Intl.NumberFormat(LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' }).format(n)} lei`;

/** "5,1 mil. clienți în România" / "about 400,000 clients in Romania". */
function clientsLine(c: Clients | undefined, lang: Lang): string | undefined {
  if (!c) return undefined;
  const n = new Intl.NumberFormat(LOCALE[lang], { notation: c.count >= 1_000_000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(c.count);
  return T[lang].clients(n, Boolean(c.estimate));
}

function savingsRow(o: RankedOffer, lang: Lang): RankedProvider {
  return {
    id: o.id,
    rank: o.rank,
    name: o.provider,
    product: o.product,
    headline: T[lang].perYear(pct(o.netRatePct, 2, lang)),
    netRatePct: o.netRatePct,
    accessRank: o.accessRank,
    conditions: o.conditions,
    url: o.url,
    checked: checkedMonth(o.checkedAt, lang),
    source: o.source,
    clientsLine: clientsLine(o.clients, lang),
  };
}

function brokerRow(b: RankedBroker, lang: Lang): RankedProvider {
  const t = T[lang];
  return {
    id: b.id,
    rank: b.rank,
    name: b.name,
    product: b.country === 'RO' ? t.brokerRO : t.brokerEU(b.regulator),
    headline: t.perOrder(lei2(b.costLei, lang)),
    costLei: b.costLei,
    conditions: b.conditions,
    taxNote: b.withholdsTax ? t.taxRO : t.taxEU,
    url: b.url,
    checked: checkedMonth(b.checkedAt, lang),
    source: b.source,
    clientsLine: clientsLine(b.clients, lang),
  };
}

/** The rows of an asset page, in the backend's order. */
export function providerRows(res: AssetProvidersResponse, lang: Lang): RankedProvider[] {
  return res.providerKind === 'savings' ? res.offers.map((o) => savingsRow(o, lang)) : res.brokers.map((b) => brokerRow(b, lang));
}

/** The one line an Acasă card shows about its providers: the best rate, or the cheapest order. */
export function providersHeadline(res: AssetProvidersResponse | undefined, lang: Lang): string {
  const t = T[lang];
  if (!res) return '';
  // the lists are ordered by how well known a provider is, so look for the best number
  if (res.providerKind === 'savings') {
    return res.offers.length ? t.upTo(pct(Math.max(...res.offers.map((o) => o.netRatePct)), 2, lang)) : '';
  }
  return res.brokers.length ? t.costsFrom(lei2(Math.min(...res.brokers.map((b) => b.costLei)), lang)) : '';
}
