/**
 * mtype API: username/password accounts and typing-test history in D1.
 *
 * Routes (all under /api, JSON in and out):
 *   POST   /api/register          { username, password }
 *   POST   /api/login             { username, password }
 *   POST   /api/logout
 *   GET    /api/me                → { user } or { user: null }
 *   GET    /api/results?limit=&before=   newest first
 *   POST   /api/results           ResultData → SavedResult
 *   DELETE /api/results/:id
 *   GET    /api/stats
 */
import type { ApiError, ConfigStats, Mode, ResultData, SavedResult, Snapshot, Stats, User } from '../shared/types';
import { TIME_OPTIONS, WORD_OPTIONS } from '../shared/types';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const COOKIE = 'mtype_session';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;
const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

// ---------------------------------------------------------------------------
// helpers

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

function error(status: number, message: string): Response {
  const body: ApiError = { error: message };
  return json(body, status);
}

async function readJson<T>(request: Request): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'expected application/json');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'invalid JSON');
  }
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of u8) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

async function sha256(s: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

/** `pbkdf2$<iterations>$<salt>$<hash>` */
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64url(salt)}$${b64url(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$');
  if (scheme !== 'pbkdf2') return false;
  const computed = await pbkdf2(password, fromB64url(salt), Number(iter));
  return timingSafeEqual(computed, fromB64url(hash));
}

function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function sessionCookie(token: string, maxAge: number): string {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Reject cross-site mutations even though SameSite=Lax already blocks most. */
function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return; // non-browser client; the cookie alone would not be sent cross-site anyway
  const url = new URL(request.url);
  if (new URL(origin).host !== url.host) throw new HttpError(403, 'cross-origin request rejected');
}

// ---------------------------------------------------------------------------
// auth

interface UserRow {
  id: number;
  username: string;
  pass_hash: string;
}

async function currentUser(request: Request, env: Env): Promise<User | null> {
  const token = parseCookies(request.headers.get('cookie'))[COOKIE];
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256(token), Date.now())
    .first<User>();
  return row ?? null;
}

async function requireUser(request: Request, env: Env): Promise<User> {
  const user = await currentUser(request, env);
  if (!user) throw new HttpError(401, 'not signed in');
  return user;
}

async function createSession(env: Env, userId: number): Promise<string> {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const now = Date.now();
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * 86_400_000)
    .run();
  return token;
}

function validateCredentials(body: unknown): { username: string; password: string } {
  const b = body as { username?: unknown; password?: unknown };
  const username = typeof b.username === 'string' ? b.username.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!USERNAME_RE.test(username)) {
    throw new HttpError(400, 'username must be 3–20 characters: a–z, 0–9, underscore');
  }
  if (password.length < 8 || password.length > 128) throw new HttpError(400, 'password must be 8–128 characters');
  return { username, password };
}

async function register(request: Request, env: Env): Promise<Response> {
  assertSameOrigin(request);
  const { username, password } = validateCredentials(await readJson(request));
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
  if (exists) throw new HttpError(409, 'username is taken');
  const res = await env.DB.prepare('INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)')
    .bind(username, await hashPassword(password), Date.now())
    .run();
  const id = Number(res.meta.last_row_id);
  const token = await createSession(env, id);
  const user: User = { id, username };
  return json({ user }, 201, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86_400) });
}

async function login(request: Request, env: Env): Promise<Response> {
  assertSameOrigin(request);
  const { username, password } = validateCredentials(await readJson(request));
  const row = await env.DB.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?')
    .bind(username)
    .first<UserRow>();
  const ok = row ? await verifyPassword(password, row.pass_hash) : false;
  if (!row || !ok) throw new HttpError(401, 'wrong username or password');
  const token = await createSession(env, row.id);
  const user: User = { id: row.id, username: row.username };
  return json({ user }, 200, { 'set-cookie': sessionCookie(token, SESSION_DAYS * 86_400) });
}

async function logout(request: Request, env: Env): Promise<Response> {
  assertSameOrigin(request);
  const token = parseCookies(request.headers.get('cookie'))[COOKIE];
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie('', 0) });
}

// ---------------------------------------------------------------------------
// results

interface ResultRow {
  id: number;
  created_at: number;
  mode: Mode;
  amount: number;
  wpm: number;
  raw: number;
  accuracy: number;
  consistency: number;
  seconds: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  snapshots: string;
}

function rowToResult(r: ResultRow): SavedResult {
  let snapshots: Snapshot[] = [];
  try {
    snapshots = JSON.parse(r.snapshots) as Snapshot[];
  } catch {
    /* corrupt row: show it without a chart */
  }
  return {
    id: r.id,
    createdAt: r.created_at,
    mode: r.mode,
    amount: r.amount,
    wpm: r.wpm,
    raw: r.raw,
    accuracy: r.accuracy,
    consistency: r.consistency,
    seconds: r.seconds,
    correct: r.correct,
    incorrect: r.incorrect,
    extra: r.extra,
    missed: r.missed,
    snapshots,
  };
}

function num(v: unknown, name: string, min = 0, max = 1e6): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) {
    throw new HttpError(400, `invalid ${name}`);
  }
  return v;
}

function validateResult(body: unknown): ResultData {
  const b = body as Record<string, unknown>;
  const mode = b.mode;
  if (mode !== 'time' && mode !== 'words') throw new HttpError(400, 'invalid mode');
  const amount = num(b.amount, 'amount');
  const allowed: readonly number[] = mode === 'time' ? TIME_OPTIONS : WORD_OPTIONS;
  if (!allowed.includes(amount)) throw new HttpError(400, 'invalid amount');
  if (!Array.isArray(b.snapshots) || b.snapshots.length > 400) throw new HttpError(400, 'invalid snapshots');
  const snapshots: Snapshot[] = b.snapshots.map((s: Record<string, unknown>) => ({
    second: num(s.second, 'snapshot.second'),
    wpm: num(s.wpm, 'snapshot.wpm'),
    raw: num(s.raw, 'snapshot.raw'),
    errors: num(s.errors, 'snapshot.errors'),
  }));
  return {
    mode,
    amount,
    wpm: num(b.wpm, 'wpm'),
    raw: num(b.raw, 'raw'),
    accuracy: num(b.accuracy, 'accuracy', 0, 100),
    consistency: num(b.consistency, 'consistency', 0, 100),
    seconds: num(b.seconds, 'seconds'),
    correct: num(b.correct, 'correct'),
    incorrect: num(b.incorrect, 'incorrect'),
    extra: num(b.extra, 'extra'),
    missed: num(b.missed, 'missed'),
    snapshots,
  };
}

async function saveResult(request: Request, env: Env): Promise<Response> {
  assertSameOrigin(request);
  const user = await requireUser(request, env);
  const r = validateResult(await readJson(request));
  const createdAt = Date.now();
  const res = await env.DB.prepare(
    `INSERT INTO results (user_id, created_at, mode, amount, wpm, raw, accuracy, consistency, seconds,
       correct, incorrect, extra, missed, snapshots)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      user.id,
      createdAt,
      r.mode,
      r.amount,
      r.wpm,
      r.raw,
      r.accuracy,
      r.consistency,
      r.seconds,
      r.correct,
      r.incorrect,
      r.extra,
      r.missed,
      JSON.stringify(r.snapshots),
    )
    .run();
  const saved: SavedResult = { ...r, id: Number(res.meta.last_row_id), createdAt };
  return json(saved, 201);
}

async function listResults(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
  const before = Number(url.searchParams.get('before') ?? Number.MAX_SAFE_INTEGER) || Number.MAX_SAFE_INTEGER;
  const { results } = await env.DB.prepare(
    `SELECT * FROM results WHERE user_id = ? AND created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?`,
  )
    .bind(user.id, before, limit)
    .all<ResultRow>();
  return json({ results: results.map(rowToResult) });
}

async function deleteResult(request: Request, env: Env, id: number): Promise<Response> {
  assertSameOrigin(request);
  const user = await requireUser(request, env);
  const res = await env.DB.prepare('DELETE FROM results WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  if (!res.meta.changes) throw new HttpError(404, 'not found');
  return json({ ok: true });
}

async function stats(request: Request, env: Env): Promise<Response> {
  const user = await requireUser(request, env);
  const { results } = await env.DB.prepare(
    `SELECT mode, amount, COUNT(*) AS count, MAX(wpm) AS bestWpm, AVG(wpm) AS avgWpm, AVG(accuracy) AS avgAccuracy
     FROM results WHERE user_id = ? GROUP BY mode, amount ORDER BY mode, amount`,
  )
    .bind(user.id)
    .all<ConfigStats>();
  const body: Stats = { total: results.reduce((a, c) => a + c.count, 0), configs: results };
  return json(body);
}

// ---------------------------------------------------------------------------
// router

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const m = request.method;

  if (path === '/api/register' && m === 'POST') return register(request, env);
  if (path === '/api/login' && m === 'POST') return login(request, env);
  if (path === '/api/logout' && m === 'POST') return logout(request, env);
  if (path === '/api/me' && m === 'GET') return json({ user: await currentUser(request, env) });
  if (path === '/api/results' && m === 'GET') return listResults(request, env);
  if (path === '/api/results' && m === 'POST') return saveResult(request, env);
  if (path === '/api/stats' && m === 'GET') return stats(request, env);
  const del = path.match(/^\/api\/results\/(\d+)$/);
  if (del && m === 'DELETE') return deleteResult(request, env, Number(del[1]));

  if (path.startsWith('/api')) throw new HttpError(404, 'no such route');
  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    // opportunistic cleanup of expired sessions, roughly once per 100 requests
    if (Math.random() < 0.01) {
      ctx.waitUntil(env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run());
    }
    try {
      return await route(request, env);
    } catch (e) {
      if (e instanceof HttpError) return error(e.status, e.message);
      console.error(e);
      return error(500, 'internal error');
    }
  },
} satisfies ExportedHandler<Env>;
