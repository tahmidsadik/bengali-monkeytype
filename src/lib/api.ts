import type { ApiError, ResultData, SavedResult, Stats, User } from '../../shared/types';

/** Whether/how the latest finished test was stored. */
export type SaveState = 'off' | 'saving' | 'saved' | 'error';

export class ApiFailure extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiFailure(0, 'network error');
  }
  if (!res.ok) {
    let message = res.statusText || 'request failed';
    try {
      message = ((await res.json()) as ApiError).error ?? message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiFailure(res.status, message);
  }
  return (await res.json()) as T;
}

export const api = {
  me: () => call<{ user: User | null }>('GET', '/api/me'),
  register: (username: string, password: string) =>
    call<{ user: User }>('POST', '/api/register', { username, password }),
  login: (username: string, password: string) => call<{ user: User }>('POST', '/api/login', { username, password }),
  logout: () => call<{ ok: true }>('POST', '/api/logout'),
  saveResult: (r: ResultData) => call<SavedResult>('POST', '/api/results', r),
  results: (limit = 50, before?: number) =>
    call<{ results: SavedResult[] }>(
      'GET',
      `/api/results?limit=${limit}${before !== undefined ? `&before=${before}` : ''}`,
    ),
  deleteResult: (id: number) => call<{ ok: true }>('DELETE', `/api/results/${id}`),
  stats: () => call<Stats>('GET', '/api/stats'),
};
