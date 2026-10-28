import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('.', import.meta.url).pathname;
const BANNED = [
  'recomandat pentru tine',
  'Back to today',
  'Compare where to keep',
  'Continue as Maria',
  'Open the account',
  'Fund it',
  'Catch up',
  'Did you do it',
  'Yes, done',
  'Not yet',
  'Nothing yet',
  'Reset demo',
  'Lock my guess',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : [];
  });
}

describe('UI copy', () => {
  it('has no English leftovers and never says "recommended for you"', () => {
    const hits = sourceFiles(ROOT).flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      return BANNED.filter((b) => text.includes(b)).map((b) => `${f.slice(ROOT.length)}: "${b}"`);
    });
    expect(hits).toEqual([]);
  });
});
