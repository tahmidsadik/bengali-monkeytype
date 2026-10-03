/**
 * Probhat (প্রভাত) fixed Bengali keyboard layout.
 *
 * Source of truth: m17n-db `MIM/bn-probhat.mim`, which is what Linux (ibus / xkb
 * `in(ben_probhat)`) ships. Keys are looked up by `KeyboardEvent.key`, so the
 * shift state is already resolved and the user's own Latin layout (QWERTY,
 * Dvorak, …) is respected.
 *
 * ZWJ (`` ` ``) and ZWNJ (`\`) are intentionally not emitted – the word list
 * never contains them and they would be invisible, confusing input.
 */
import { canonicalize } from './bengali';

const MAP: Record<string, string> = {
  // digits row
  '1': '১', '2': '২', '3': '৩', '4': '৪', '5': '৫',
  '6': '৬', '7': '৭', '8': '৮', '9': '৯', '0': '০',
  '!': '!', '@': '@', '#': '#', '$': '৳', '%': '%',
  '^': '^', '&': 'ঞ', '*': 'ৎ', '(': '(', ')': ')',
  '-': '-', '_': '_', '=': '=', '+': '+', '~': '~',

  // top row
  q: 'দ', Q: 'ধ',
  w: 'ূ', W: 'ঊ',
  e: 'ী', E: 'ঈ',
  r: 'র', R: 'ড়',
  t: 'ট', T: 'ঠ',
  y: 'এ', Y: 'ঐ',
  u: 'ু', U: 'উ',
  i: 'ি', I: 'ই',
  o: 'ও', O: 'ঔ',
  p: 'প', P: 'ফ',
  '[': 'ে', '{': 'ৈ',
  ']': 'ো', '}': 'ৌ',
  '|': '॥',

  // home row
  a: 'া', A: 'অ',
  s: 'স', S: 'ষ',
  d: 'ড', D: 'ঢ',
  f: 'ত', F: 'থ',
  g: 'গ', G: 'ঘ',
  h: 'হ', H: 'ঃ',
  j: 'জ', J: 'ঝ',
  k: 'ক', K: 'খ',
  l: 'ল', L: 'ং',
  ';': ';', ':': ':',
  "'": "'", '"': '"',

  // bottom row
  z: 'য়', Z: 'য',
  x: 'শ', X: 'ঢ়',
  c: 'চ', C: 'ছ',
  v: 'আ', V: 'ঋ',
  b: 'ব', B: 'ভ',
  n: 'ন', N: 'ণ',
  m: 'ম', M: 'ঙ',
  ',': ',', '<': 'ৃ',
  '.': '।', '>': 'ঁ',
  '/': '্', '?': '?',
};

// Source files may store ড়/ঢ়/য় decomposed; make every value the single
// precomposed code point the rest of the app expects.
for (const k of Object.keys(MAP)) MAP[k] = canonicalize(MAP[k]);

const BENGALI_BLOCK = /^[\u0980-\u09FF]$/;

/**
 * Translate a `KeyboardEvent.key` into the Bengali character it produces
 * under Probhat. Returns `undefined` for keys that produce nothing
 * (modifiers, navigation keys, ZWJ/ZWNJ, …).
 *
 * If the OS keyboard is already a Bengali layout the key arrives as a
 * Bengali code point and is passed through untouched.
 */
export function probhat(key: string): string | undefined {
  if (key.length === 1 && BENGALI_BLOCK.test(key)) return key;
  if (key === ' ') return ' ';
  return MAP[key];
}

/** Reverse lookup used by the on-screen layout reference. */
export const PROBHAT_ROWS: Array<Array<[string, string]>> = [
  ['`~', '1!', '2@', '3#', '4$', '5%', '6^', '7&', '8*', '9(', '0)', '-_', '=+'],
  ['qQ', 'wW', 'eE', 'rR', 'tT', 'yY', 'uU', 'iI', 'oO', 'pP', '[{', ']}', '\\|'],
  ['aA', 'sS', 'dD', 'fF', 'gG', 'hH', 'jJ', 'kK', 'lL', ';:', "'\""],
  ['zZ', 'xX', 'cC', 'vV', 'bB', 'nN', 'mM', ',<', '.>', '/?'],
].map((row) => row.map((pair) => [pair[0], pair[1]] as [string, string]));

export function probhatLabel(key: string): string {
  return MAP[key] ?? '';
}
