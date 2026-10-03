import { canonicalize, codePoints, graphemes, type Grapheme } from './bengali';
import { probhat } from './probhat';
import { randomWords } from './words';

export type Mode = 'time' | 'words';
export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;

export interface Word {
  target: string;
  targetCps: string[];
  graphemes: Grapheme[];
  typed: string[];
  /** set once the user moved past the word with space */
  committed: boolean;
}

export interface Snapshot {
  second: number;
  wpm: number;
  raw: number;
  errors: number;
}

export interface Result {
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  seconds: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  snapshots: Snapshot[];
  mode: Mode;
  amount: number;
}

export type Status = 'idle' | 'running' | 'finished';

const TIME_BATCH = 60;

function makeWord(target: string): Word {
  const t = canonicalize(target);
  return { target: t, targetCps: codePoints(t), graphemes: graphemes(t), typed: [], committed: false };
}

function isWordCorrect(w: Word): boolean {
  if (w.typed.length !== w.targetCps.length) return false;
  for (let i = 0; i < w.typed.length; i++) if (w.typed[i] !== w.targetCps[i]) return false;
  return true;
}

/** Monkeytype's consistency curve: coefficient of variation → 0..100 */
function kogasa(cov: number): number {
  return 100 * (1 - Math.tanh(cov + Math.pow(cov, 3) / 3 + Math.pow(cov, 5) / 5));
}

export class Engine {
  mode = $state<Mode>('time');
  amount = $state<number>(30);

  words = $state<Word[]>([]);
  current = $state(0);
  status = $state<Status>('idle');
  /** seconds elapsed (for words mode) or remaining (time mode), display only */
  clock = $state(0);
  result = $state<Result | null>(null);
  /** incremented on every keystroke so the UI can react (caret, blink) */
  keystrokes = $state(0);
  /** incremented on every wrong keystroke so the UI can flash feedback */
  errors = $state(0);

  // raw counters (not reactive)
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private totalKeys = 0;
  private wrongKeys = 0;
  private snapshots: Snapshot[] = [];
  private errorsThisSecond = 0;
  private lastSnapshotSecond = 0;
  private generation = 0;

  constructor() {
    this.reset();
  }

  setMode(mode: Mode, amount: number) {
    this.mode = mode;
    this.amount = amount;
    this.reset();
  }

  reset() {
    this.stopTimer();
    this.generation++;
    const count = this.mode === 'time' ? TIME_BATCH : this.amount;
    this.words = randomWords(count).map(makeWord);
    this.current = 0;
    this.status = 'idle';
    this.clock = this.mode === 'time' ? this.amount : 0;
    this.result = null;
    this.totalKeys = 0;
    this.wrongKeys = 0;
    this.snapshots = [];
    this.errorsThisSecond = 0;
    this.lastSnapshotSecond = 0;
    this.errors = 0;
    this.keystrokes++;
  }

  /** Returns true when the event was consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (this.status === 'finished') return false;
    if (e.metaKey || (e.ctrlKey && e.key !== 'Backspace') || (e.altKey && e.key !== 'Backspace')) return false;

    if (e.key === 'Backspace') {
      if (this.status !== 'running') return false;
      this.backspace(e.ctrlKey || e.altKey);
      this.keystrokes++;
      return true;
    }

    const ch = probhat(e.key);
    if (ch === undefined) return false;

    if (this.status === 'idle') this.start();

    if (ch === ' ') {
      this.space();
    } else {
      this.type(ch);
    }
    this.keystrokes++;
    return true;
  }

  private start() {
    this.status = 'running';
    this.startedAt = performance.now();
    this.timer = setInterval(() => this.tick(), 100);
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private elapsed(): number {
    return (performance.now() - this.startedAt) / 1000;
  }

  private tick() {
    const el = this.elapsed();
    const sec = Math.floor(el);
    if (sec > this.lastSnapshotSecond) {
      this.lastSnapshotSecond = sec;
      this.takeSnapshot(sec, el);
    }
    if (this.mode === 'time') {
      const remaining = Math.max(0, Math.ceil(this.amount - el));
      if (remaining !== this.clock) this.clock = remaining;
      if (el >= this.amount) this.finish();
    } else {
      if (sec !== this.clock) this.clock = sec;
    }
  }

  private takeSnapshot(second: number, el: number) {
    const minutes = el / 60;
    const { correctChars, rawChars } = this.charCounts();
    this.snapshots.push({
      second,
      wpm: Math.round(correctChars / 5 / minutes),
      raw: Math.round(rawChars / 5 / minutes),
      errors: this.errorsThisSecond,
    });
    this.errorsThisSecond = 0;
  }

  private type(ch: string) {
    const w = this.words[this.current];
    if (w.typed.length >= w.targetCps.length + 20) return; // cap extras
    const idx = w.typed.length;
    const correct = idx < w.targetCps.length && w.targetCps[idx] === ch;
    this.totalKeys++;
    if (!correct) {
      this.wrongKeys++;
      this.errorsThisSecond++;
      this.errors++;
    }
    w.typed.push(ch);

    if (this.mode === 'words' && this.current === this.words.length - 1 && isWordCorrect(w)) {
      this.finish();
    }
  }

  private space() {
    const w = this.words[this.current];
    if (w.typed.length === 0) return; // ignore leading space
    this.totalKeys++;
    if (!isWordCorrect(w)) {
      this.wrongKeys++;
      this.errorsThisSecond++;
      this.errors++;
    }
    w.committed = true;

    if (this.current === this.words.length - 1) {
      if (this.mode === 'words') {
        this.finish();
        return;
      }
    }
    this.current++;
    if (this.mode === 'time' && this.words.length - this.current < 30) {
      const more = randomWords(TIME_BATCH, this.words[this.words.length - 1].target).map(makeWord);
      this.words.push(...more);
    }
  }

  private backspace(wholeWord: boolean) {
    const w = this.words[this.current];
    if (w.typed.length === 0) {
      // allow going back only to an incorrect previous word
      if (this.current > 0) {
        const prev = this.words[this.current - 1];
        if (!isWordCorrect(prev)) {
          prev.committed = false;
          this.current--;
          if (wholeWord) this.words[this.current].typed = [];
        }
      }
      return;
    }
    if (wholeWord) w.typed = [];
    else w.typed.pop();
  }

  private charCounts() {
    let correctChars = 0;
    let rawChars = 0;
    for (let i = 0; i <= this.current && i < this.words.length; i++) {
      const w = this.words[i];
      if (w.typed.length === 0) continue;
      rawChars += w.typed.length;
      if (w.committed) {
        rawChars += 1;
        if (isWordCorrect(w)) correctChars += w.targetCps.length + 1;
      } else {
        // in-progress word: count correct prefix
        let n = 0;
        for (let j = 0; j < w.typed.length && j < w.targetCps.length; j++) {
          if (w.typed[j] === w.targetCps[j]) n++;
          else break;
        }
        correctChars += n;
      }
    }
    return { correctChars, rawChars };
  }

  private finish() {
    if (this.status === 'finished') return;
    this.stopTimer();
    const seconds = this.mode === 'time' ? Math.min(this.elapsed(), this.amount) : this.elapsed();
    if (this.lastSnapshotSecond < Math.ceil(seconds) || this.snapshots.length === 0) {
      this.takeSnapshot(Math.ceil(seconds), seconds);
    }
    const minutes = seconds / 60;
    const { correctChars, rawChars } = this.charCounts();

    let correct = 0,
      incorrect = 0,
      extra = 0,
      missed = 0;
    for (let i = 0; i <= this.current && i < this.words.length; i++) {
      const w = this.words[i];
      if (w.typed.length === 0 && !w.committed) continue;
      const n = Math.min(w.typed.length, w.targetCps.length);
      for (let j = 0; j < n; j++) {
        if (w.typed[j] === w.targetCps[j]) correct++;
        else incorrect++;
      }
      if (w.typed.length > w.targetCps.length) extra += w.typed.length - w.targetCps.length;
      if (w.committed && w.typed.length < w.targetCps.length) missed += w.targetCps.length - w.typed.length;
      if (w.committed) correct++; // the space
    }

    const wpms = this.snapshots.map((s) => s.raw);
    const mean = wpms.reduce((a, b) => a + b, 0) / Math.max(1, wpms.length);
    const sd = Math.sqrt(wpms.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, wpms.length));
    const consistency = mean > 0 ? kogasa(sd / mean) : 0;

    this.result = {
      wpm: correctChars / 5 / minutes,
      raw: rawChars / 5 / minutes,
      accuracy: this.totalKeys ? ((this.totalKeys - this.wrongKeys) / this.totalKeys) * 100 : 0,
      consistency,
      seconds,
      correct,
      incorrect,
      extra,
      missed,
      snapshots: this.snapshots,
      mode: this.mode,
      amount: this.amount,
    };
    this.status = 'finished';
  }
}
