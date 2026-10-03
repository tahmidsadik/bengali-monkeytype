import type { User } from '../../shared/types';
import { api, ApiFailure } from './api';

/** Signed-in user state, shared across the app. */
export class Auth {
  user = $state<User | null>(null);
  /** true until the first /api/me round trip has finished */
  loading = $state(true);

  async load() {
    try {
      this.user = (await api.me()).user;
    } catch {
      this.user = null;
    } finally {
      this.loading = false;
    }
  }

  async login(username: string, password: string) {
    this.user = (await api.login(username, password)).user;
  }

  async register(username: string, password: string) {
    this.user = (await api.register(username, password)).user;
  }

  async logout() {
    try {
      await api.logout();
    } catch (e) {
      if (!(e instanceof ApiFailure)) throw e;
    }
    this.user = null;
  }
}
