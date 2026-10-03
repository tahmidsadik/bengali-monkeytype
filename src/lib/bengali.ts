/**
 * Bengali text utilities.
 *
 * Bengali words are sequences of Unicode code points (consonants, vowel signs,
 * hasanta, …) that the font shapes into grapheme clusters. Under Probhat one
 * keystroke == one code point, so correctness is tracked at code-point level
 * while rendering happens at grapheme level.
 */

const NUKTA_DECOMPOSED: Array<[RegExp, string]> = [
  [/ড়/g, 'ড়'], // ড + ় → ড়
  [/ঢ়/g, 'ঢ়'], // ঢ + ় → ঢ়
  [/য়/g, 'য়'], // য + ় → য়
];

/**
 * Bring a string into the exact code-point form Probhat produces:
 * NFC, but with the three nukta letters kept precomposed (NFC would
 * decompose them because they are composition exclusions). Also strips
 * ZWJ/ZWNJ.
 */
export function canonicalize(s: string): string {
  let out = s.normalize('NFC').replace(/[‌‍]/g, '');
  for (const [re, rep] of NUKTA_DECOMPOSED) out = out.replace(re, rep);
  return out;
}

export function codePoints(s: string): string[] {
  return Array.from(s);
}

export interface Grapheme {
  text: string;
  /** code-point index range [start, end) within the word */
  start: number;
  end: number;
}

const segmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter('bn', { granularity: 'grapheme' })
    : null;

export function graphemes(word: string): Grapheme[] {
  const out: Grapheme[] = [];
  let idx = 0;
  if (segmenter) {
    for (const seg of segmenter.segment(word)) {
      const len = codePoints(seg.segment).length;
      out.push({ text: seg.segment, start: idx, end: idx + len });
      idx += len;
    }
  } else {
    for (const cp of codePoints(word)) {
      out.push({ text: cp, start: idx, end: idx + 1 });
      idx += 1;
    }
  }
  return out;
}

export type GraphemeState = 'pending' | 'partial' | 'correct' | 'incorrect';

/**
 * Compare a typed code-point array against a grapheme of the target word.
 */
export function graphemeState(g: Grapheme, target: string[], typed: string[]): GraphemeState {
  if (typed.length <= g.start) return 'pending';
  const upto = Math.min(typed.length, g.end);
  for (let i = g.start; i < upto; i++) {
    if (typed[i] !== target[i]) return 'incorrect';
  }
  return typed.length >= g.end ? 'correct' : 'partial';
}

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

/** Format a number with Bengali digits. */
export function bnNumber(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}
