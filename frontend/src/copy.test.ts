import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assetsFor, newsFor, savingsFor } from './data/fixtures/en';
import { LIBRARY, libraryFor } from './data/fixtures/moments';
import { QUIZ, QUIZ_EN } from './data/fixtures/quiz';

const ROOT = new URL('.', import.meta.url).pathname;
const DIACRITICS = /[ăâîșțĂÂÎȘȚ]/;

function sourceFiles(dir: string, ext = /\.(ts|tsx)$/): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p, ext);
    return ext.test(e.name) && !e.name.endsWith('.test.ts') ? [p] : [];
  });
}

/** Line ranges covered by `copy(` … `)` blocks, found by counting brackets. */
function copyBlocks(text: string): [number, number][] {
  const out: [number, number][] = [];
  const start = /copy(<[^>]*>)?\(/g;
  for (let m = start.exec(text); m; m = start.exec(text)) {
    const from = m.index;
    let depth = 0;
    let i = from + m[0].length - 1;
    for (; i < text.length; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')' && --depth === 0) break;
    }
    const line = (at: number) => text.slice(0, at).split('\n').length;
    out.push([line(from), line(i)]);
    start.lastIndex = i;
  }
  return out;
}

describe('UI copy', () => {
  it('never says "recommended for you", in either language', () => {
    const hits = sourceFiles(ROOT).filter((f) => /recomandat pentru tine|recommended for you/i.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('keeps every Romanian string in components and pages inside a copy() block, next to its English', () => {
    const files = [...sourceFiles(join(ROOT, 'app'), /\.tsx$/), ...sourceFiles(join(ROOT, 'components'), /\.tsx$/)];
    const stray = files.flatMap((f) => {
      const text = readFileSync(f, 'utf8');
      const blocks = copyBlocks(text);
      return text.split('\n').flatMap((l, n) => {
        const line = n + 1;
        // A language's own name stays in that language (the RO | EN switch).
        const comment = /^\s*(\/\/|\*|\/\*\*)/.test(l) || l.includes('NATIVE_NAME');
        const inCopy = blocks.some(([a, b]) => line >= a && line <= b);
        return DIACRITICS.test(l) && !comment && !inCopy ? [`${f.slice(ROOT.length)}:${line}: ${l.trim()}`] : [];
      });
    });
    expect(stray).toEqual([]);
  });
});

describe('English content mirrors Romanian', () => {
  it('lessons: same lessons, screens, answers and numbers', () => {
    const shape = (lang: 'ro' | 'en') =>
      libraryFor(lang).map((m) => ({
        id: m.id,
        level: m.level,
        minutes: m.minutes,
        takeaways: m.takeaways.length,
        steps: m.steps.map((s) => {
          switch (s.type) {
            case 'choice':
              return [s.type, s.options.length, s.correct];
            case 'predict':
              return [s.type, s.answerValue, s.min, s.max, s.step, s.start];
            case 'sort':
              return [s.type, s.items.map((i) => i.bucket)];
            case 'explore':
              return [s.type, s.widget];
            case 'asset_range':
              return [s.type, s.assetId];
            case 'finish':
              return [s.type, s.cta.href];
            default:
              return [s.type];
          }
        }),
      }));
    expect(shape('en')).toEqual(shape('ro'));
    expect(libraryFor('ro')).toBe(LIBRARY);
  });

  it('quiz: same questions, options and right answers', () => {
    expect(QUIZ_EN.knowledge.map((q) => [q.id, q.options.length, q.correct])).toEqual(QUIZ.knowledge.map((q) => [q.id, q.options.length, q.correct]));
    for (const key of ['ageBand', 'situation', 'bufferMonths'] as const) {
      expect(QUIZ_EN.profile[key].map((o) => o.value)).toEqual(QUIZ.profile[key].map((o) => o.value));
    }
  });

  it('assets, news and providers: English text, Romanian numbers', () => {
    const strip = <T extends object>(xs: T[], keys: string[]) => xs.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => keys.includes(k))));
    expect(strip(assetsFor('en'), ['id', 'risk', 'lessonLevel', 'momentId'])).toEqual(strip(assetsFor('ro'), ['id', 'risk', 'lessonLevel', 'momentId']));
    expect(strip(savingsFor('en'), ['id', 'grossRatePct', 'termMonths', 'offerId'])).toEqual(strip(savingsFor('ro'), ['id', 'grossRatePct', 'termMonths', 'offerId']));
    expect(newsFor('en').map((n) => [n.id, n.sources.length, n.facts.length > 0])).toEqual(newsFor('ro').map((n) => [n.id, n.sources.length, true]));
    for (const text of [...assetsFor('en').map((a) => a.whatItIs), ...newsFor('en').map((n) => n.title), ...savingsFor('en').map((p) => p.product)]) {
      expect(text).not.toMatch(DIACRITICS);
    }
  });
});
