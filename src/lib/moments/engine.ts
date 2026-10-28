import type { AppEvent, MomentRun, User } from '../store/types';
import type { MomentDefinition } from './types';

export const WEEKLY_CAP_DAYS = 7;

export type SkipReason =
  | 'not_triggered'
  | 'situation'
  | 'missing_data'
  | 'already_done'
  | 'already_open'
  | 'weekly_cap';

export interface Decision {
  open: string[];
  skipped: { momentId: string; reason: SkipReason }[];
}

function missingRequirement(def: MomentDefinition, user: User): boolean {
  return (def.conditions.requires ?? []).some((field) => {
    const v = user[field];
    return v === undefined || v === null;
  });
}

/**
 * Pure decision: which moments does this event open for this user?
 * Rules: trigger matches, conditions hold, not already done (unless the event is a repeat trigger),
 * not already open, and at most one new moment per week unless the user asked for it.
 */
export function decide(
  defs: MomentDefinition[],
  user: User,
  event: Pick<AppEvent, 'type' | 'payload' | 'source'>,
  runs: MomentRun[],
  nowIso: string,
  opts: { ignoreWeeklyCap?: boolean } = {},
): Decision {
  const decision: Decision = { open: [], skipped: [] };
  const userInitiated = event.type === 'catch_up' || event.source === 'user';
  const capStart = Date.parse(nowIso) - WEEKLY_CAP_DAYS * 86_400_000;
  const recent = runs.filter((r) => r.state !== 'dismissed' && Date.parse(r.createdAt) >= capStart);

  for (const def of defs) {
    const triggered =
      event.type === 'catch_up'
        ? event.payload.momentId === def.id
        : def.triggers.includes(event.type) || (def.repeatOn ?? []).includes(event.type);
    if (!triggered) continue;

    const situations = def.conditions.situations;
    if (situations && !situations.some((s) => user.situations.includes(s))) {
      decision.skipped.push({ momentId: def.id, reason: 'situation' });
      continue;
    }
    if (missingRequirement(def, user)) {
      decision.skipped.push({ momentId: def.id, reason: 'missing_data' });
      continue;
    }
    const mine = runs.filter((r) => r.momentId === def.id);
    if (mine.some((r) => r.state === 'pending' || r.state === 'started')) {
      decision.skipped.push({ momentId: def.id, reason: 'already_open' });
      continue;
    }
    const done = mine.some((r) => r.state === 'completed');
    if (done && !userInitiated && !(def.repeatOn ?? []).includes(event.type)) {
      decision.skipped.push({ momentId: def.id, reason: 'already_done' });
      continue;
    }
    if (!userInitiated && !opts.ignoreWeeklyCap && (recent.length > 0 || decision.open.length > 0)) {
      decision.skipped.push({ momentId: def.id, reason: 'weekly_cap' });
      continue;
    }
    decision.open.push(def.id);
  }
  return decision;
}

/** Fills {{placeholders}} from a flat map of values. Unknown keys become empty strings. */
export function fill(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k: string) => {
    const v = vars[k];
    return v === undefined ? '' : String(v);
  });
}
