<script lang="ts">
  import type { Auth } from './auth.svelte';
  import { ApiFailure } from './api';

  let { auth, onclose }: { auth: Auth; onclose: () => void } = $props();

  let mode = $state<'login' | 'register'>('login');
  let username = $state('');
  let password = $state('');
  let confirm = $state('');
  let error = $state('');
  let busy = $state(false);
  let userEl: HTMLInputElement | undefined = $state();

  $effect(() => {
    userEl?.focus();
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (mode === 'register' && password !== confirm) {
      error = 'পাসওয়ার্ড দুটি মেলেনি';
      return;
    }
    busy = true;
    try {
      if (mode === 'login') await auth.login(username, password);
      else await auth.register(username, password);
      onclose();
    } catch (err) {
      error = err instanceof ApiFailure ? err.message : 'কিছু একটা ভুল হয়েছে';
    } finally {
      busy = false;
    }
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onclose();
    e.stopPropagation();
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="backdrop" onkeydown={onkeydown} onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
  <form class="form" onsubmit={submit}>
    <div class="tabs">
      <button type="button" class:active={mode === 'login'} onclick={() => (mode = 'login')}>লগইন</button>
      <button type="button" class:active={mode === 'register'} onclick={() => (mode = 'register')}>
        রেজিস্টার
      </button>
    </div>
    <h2 id="auth-title">{mode === 'login' ? 'ফিরে এসো' : 'নতুন অ্যাকাউন্ট'}</h2>

    <label>
      <span>ইউজারনেম</span>
      <input
        bind:this={userEl}
        bind:value={username}
        type="text"
        autocomplete="username"
        autocapitalize="off"
        spellcheck="false"
        pattern={'[A-Za-z0-9_]{3,20}'}
        title="৩–২০ অক্ষর: a–z, 0–9, _"
        required
      />
    </label>
    <label>
      <span>পাসওয়ার্ড</span>
      <input
        bind:value={password}
        type="password"
        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        minlength="8"
        required
      />
    </label>
    {#if mode === 'register'}
      <label>
        <span>পাসওয়ার্ড আবার</span>
        <input bind:value={confirm} type="password" autocomplete="new-password" minlength="8" required />
      </label>
      <p class="hint">ইউজারনেম ৩–২০ অক্ষর (a–z, 0–9, _), পাসওয়ার্ড কমপক্ষে ৮ অক্ষর।</p>
    {/if}

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <div class="actions">
      <button type="button" class="ghost" onclick={onclose}>বাতিল</button>
      <button type="submit" class="primary" disabled={busy}>
        {busy ? '…' : mode === 'login' ? 'লগইন' : 'অ্যাকাউন্ট খুলুন'}
      </button>
    </div>
  </form>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: grid;
    place-items: center;
    z-index: 10;
    animation: fade 0.15s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .dialog {
    background: var(--sub-alt);
    border-radius: 0.75rem;
    padding: 1.5rem;
    width: min(22rem, calc(100vw - 2rem));
    animation: pop 0.18s ease-out;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  @keyframes pop {
    from {
      transform: translateY(8px) scale(0.98);
      opacity: 0;
    }
  }
  .tabs {
    display: flex;
    gap: 0.25rem;
    background: var(--bg);
    border-radius: 0.5rem;
    padding: 0.2rem;
  }
  .tabs button {
    flex: 1;
    background: none;
    border: 0;
    color: var(--sub);
    padding: 0.4rem;
    border-radius: 0.35rem;
    cursor: pointer;
    font-size: 0.95rem;
  }
  .tabs button.active {
    background: var(--sub-alt);
    color: var(--main);
  }
  h2 {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 500;
    color: var(--text);
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    color: var(--sub);
    font-size: 0.9rem;
  }
  input {
    background: var(--bg);
    border: 2px solid transparent;
    color: var(--text);
    border-radius: 0.4rem;
    padding: 0.5rem 0.6rem;
    font-size: 1rem;
    font-family: var(--font-mono);
    outline: none;
    transition: border-color 0.12s;
  }
  input:focus {
    border-color: var(--main);
  }
  .hint {
    margin: 0;
    color: var(--sub);
    font-size: 0.8rem;
  }
  .error {
    margin: 0;
    color: var(--error);
    font-size: 0.9rem;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.3rem;
  }
  .actions button {
    border: 0;
    border-radius: 0.4rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.95rem;
    transition: background 0.12s, color 0.12s;
  }
  .ghost {
    background: none;
    color: var(--sub);
  }
  .ghost:hover {
    color: var(--text);
  }
  .primary {
    background: var(--main);
    color: var(--bg);
    font-weight: 500;
  }
  .primary:hover {
    background: var(--text);
  }
  .primary:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
