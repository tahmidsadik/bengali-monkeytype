/** Types shared between the Svelte app and the Worker API. */

export type Mode = 'time' | 'words';

export interface Snapshot {
  second: number;
  wpm: number;
  raw: number;
  errors: number;
}

/** A finished test as produced by the engine and stored in D1. */
export interface ResultData {
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

export interface SavedResult extends ResultData {
  id: number;
  /** unix ms */
  createdAt: number;
}

export interface User {
  id: number;
  username: string;
}

export interface ConfigStats {
  mode: Mode;
  amount: number;
  count: number;
  bestWpm: number;
  avgWpm: number;
  avgAccuracy: number;
}

export interface Stats {
  total: number;
  configs: ConfigStats[];
}

export interface ApiError {
  error: string;
}

export const TIME_OPTIONS = [15, 30, 60, 120] as const;
export const WORD_OPTIONS = [10, 25, 50, 100] as const;
