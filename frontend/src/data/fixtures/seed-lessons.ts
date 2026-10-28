// FOR TESTS ONLY. The app gets its lessons from the backend (GET /api/library); tests read the same
// lessons straight from the backend's seed file, so there is still one source of lesson content.
import seed from '../../../../backend/internal/content/seed/moments.json';
import type { LibraryMoment } from '../types';

/** The seeded lessons in Romanian, as GET /api/library serves them (without the English block). */
export const SEED_LESSONS: LibraryMoment[] = (seed as unknown as (LibraryMoment & { en?: unknown })[]).map(({ en: _en, ...m }) => m);
