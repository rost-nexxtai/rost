import type { Broker } from '../types';

/** FIXTURE: example brokers with illustrative fees. Not real providers; no referral links yet. */
export const BROKERS: Broker[] = [
  { id: 'broker-a', name: 'Broker A (RO)', country: 'RO', commissionPct: 0.5, minCommissionLei: 5, spreadPct: 0, isPartner: true, example: true },
  { id: 'broker-b', name: 'Broker B (UE)', country: 'EU', commissionPct: 0, minCommissionLei: 1, spreadPct: 0.25, isPartner: false, example: true },
  { id: 'broker-c', name: 'Broker C (UE)', country: 'EU', commissionPct: 0.1, minCommissionLei: 2, spreadPct: 0.5, isPartner: false, example: true },
];
