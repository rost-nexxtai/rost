import type { SavingsProvider } from '../types';

/**
 * FIXTURE until backend ships GET /api/assets/:id.
 * Banks: the same example offers as backend/internal/reference/data/seed/offers.json (placeholder names, example rates).
 * State bonds: the real October 2026 issue (Goldring, MFP), tax-free.
 */
export const SAVINGS: SavingsProvider[] = [
  { id: 'bank-d-savings', assetId: 'cont_economii', name: 'Banca D', product: 'Cont de economii', kind: 'deposit', grossRatePct: 3.8, termMonths: 0, accessRank: 1, isPartner: false, example: true, offerId: 'bank-d-savings' },
  { id: 'bank-b-savings', assetId: 'cont_economii', name: 'Banca B', product: 'Cont de economii', kind: 'deposit', grossRatePct: 3.5, termMonths: 0, accessRank: 1, isPartner: true, example: true, offerId: 'bank-b-savings' },
  { id: 'bank-a-12m', assetId: 'depozit', name: 'Banca A', product: 'Depozit la 12 luni', kind: 'deposit', grossRatePct: 5.25, termMonths: 12, accessRank: 2, isPartner: false, example: true, offerId: 'bank-a-12m' },
  { id: 'bank-b-12m', assetId: 'depozit', name: 'Banca B', product: 'Depozit la 12 luni', kind: 'deposit', grossRatePct: 4.8, termMonths: 12, accessRank: 2, isPartner: true, example: true, offerId: 'bank-b-12m' },
  { id: 'bank-c-12m', assetId: 'depozit', name: 'Banca C', product: 'Depozit la 12 luni', kind: 'deposit', grossRatePct: 4.4, termMonths: 12, accessRank: 2, isPartner: true, example: true, offerId: 'bank-c-12m' },
  { id: 'bank-a-36m', assetId: 'depozit', name: 'Banca A', product: 'Depozit la 36 de luni', kind: 'deposit', grossRatePct: 5.0, termMonths: 36, accessRank: 2, isPartner: false, example: true, offerId: 'bank-a-36m' },
  { id: 'tezaur-1y', assetId: 'titluri_stat', name: 'Statul român', product: 'Tezaur, 1 an', kind: 'state_bond', grossRatePct: 6.5, termMonths: 12, accessRank: 3, isPartner: false, example: false, offerId: 'tezaur-1y' },
  { id: 'tezaur-3y', assetId: 'titluri_stat', name: 'Statul român', product: 'Tezaur, 3 ani', kind: 'state_bond', grossRatePct: 7.0, termMonths: 36, accessRank: 3, isPartner: false, example: false },
  { id: 'tezaur-5y', assetId: 'titluri_stat', name: 'Statul român', product: 'Tezaur, 5 ani', kind: 'state_bond', grossRatePct: 7.5, termMonths: 60, accessRank: 3, isPartner: false, example: false },
  { id: 'fidelis-2y-lei', assetId: 'titluri_stat', name: 'Statul român', product: 'Fidelis, 2 ani (lei)', kind: 'state_bond', grossRatePct: 6.6, termMonths: 24, accessRank: 3, isPartner: false, example: false, offerId: 'fidelis-2y-lei' },
  { id: 'fidelis-5y-lei', assetId: 'titluri_stat', name: 'Statul român', product: 'Fidelis, 5 ani (lei)', kind: 'state_bond', grossRatePct: 7.75, termMonths: 60, accessRank: 3, isPartner: false, example: false },
];
