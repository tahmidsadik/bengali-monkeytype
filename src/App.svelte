<script lang="ts">
  import { untrack } from 'svelte';
  import type { SavedResult } from '../shared/types';
  import { Engine } from './lib/engine.svelte';
  import { Auth } from './lib/auth.svelte';
  import { api, type SaveState } from './lib/api';
  import ConfigBar from './lib/ConfigBar.svelte';
  import TypingArea from './lib/TypingArea.svelte';
  import Result from './lib/Result.svelte';
  import KeyboardHint from './lib/KeyboardHint.svelte';
  import AuthDialog from './lib/AuthDialog.svelte';
  import History from './lib/History.svelte';

  const engine = new Engine();
  const auth = new Auth();

  let view = $state<'test' | 'history' | 'detail'>('test');
  let detail = $state<SavedResult | null>(null);
  let dialog = $state(false);
  let focused = $state(true);
  let showKeyboard = $state(false);
  let hideMouse = $state(false);
  let save = $state<SaveState>('off');

  $effect(() => {
    auth.load();
  });

  // store each finished test for the signed-in user
  $effect(() => {
    const result = engine.result;
    if (!result) {
      save = 'off';
      return;
    }
    const user = untrack(() => auth.user);
    if (!user) {
      save = 'off';
      return;
    }
    save = 'saving';
    api
      .saveResult($state.snapshot(result))
      .then(() => {
        if (engine.result === result) save = 'saved';
      })
      .catch(() => {
        if (engine.result === result) save = 'error';
      });
  });

  function restart() {
    engine.reset();
    view = 'test';
    focused = true;
  }

  function openHistory() {
    if (engine.status === 'running') engine.reset();
    view = 'history';
  }

  function onKeydown(e: KeyboardEvent) {
    if (dialog) return; // the dialog handles its own keys
    if (e.key === 'Tab') {
      e.preventDefault();
      restart();
      return;
    }
    if (view === 'detail') {
      if (e.key === 'Escape') view = 'history';
      return;
    }
    if (view === 'history') {
      if (e.key === 'Escape') view = 'test';
      return;
    }
    if (engine.status === 'finished') {
      if (e.key === 'Enter') {
        e.preventDefault();
        restart();
      }
      return;
    }
    if (e.key === 'Escape') {
      restart();
      return;
    }
    // keys that would otherwise scroll / open quick-find
    if (e.key === ' ' || e.key === '/' || e.key === "'") e.preventDefault();

    const consumed = engine.handleKey(e);
    if (consumed) {
      e.preventDefault();
      focused = true;
      hideMouse = true;
    }
  }

  async function logout() {
    await auth.logout();
    if (view !== 'test') view = 'test';
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onblur={() => (focused = false)}
  onfocus={() => (focused = true)}
  onmousemove={() => (hideMouse = false)}
  onclick={() => (focused = true)}
/>

<svelte:body class:hide-mouse={hideMouse && view === 'test' && !dialog} />

<div class="app">
  <header class:dim={engine.status === 'running'}>
    <button class="logo" onclick={restart} title="বাংলাtype">
      <span class="brand">বাংলা</span><span class="brand-sub">type</span>
    </button>
    <nav>
      {#if auth.user}
        <button class="nav" class:active={view !== 'test'} onclick={openHistory} title="ইতিহাস">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 3v18h18" />
            <path d="M7 15l4-5 4 3 5-7" />
          </svg>
          ইতিহাস
        </button>
        <span class="user">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          {auth.user.username}
        </span>
        <button class="nav" onclick={logout} title="লগআউট">লগআউট</button>
      {:else if !auth.loading}
        <button class="nav" onclick={() => (dialog = true)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
          লগইন
        </button>
      {/if}
    </nav>
  </header>

  <main>
    {#if view === 'history'}
      <History
        onopen={(r) => {
          detail = r;
          view = 'detail';
        }}
        onback={() => (view = 'test')}
      />
    {:else if view === 'detail' && detail}
      <Result result={detail} date={detail.createdAt} onback={() => (view = 'history')} />
    {:else if engine.status === 'finished' && engine.result}
      <Result result={engine.result} onrestart={restart} {save} />
      {#if !auth.user && !auth.loading}
        <p class="nudge">
          <button class="link" onclick={() => (dialog = true)}>লগইন</button> করলে ফলাফল সংরক্ষিত হবে
        </p>
      {/if}
    {:else}
      <ConfigBar {engine} bind:showKeyboard />
      <div class="test">
        <TypingArea {engine} focused={focused && !dialog} />
      </div>
      {#if showKeyboard}
        <KeyboardHint {engine} />
      {/if}
    {/if}
  </main>

  <footer class:dim={engine.status === 'running'}>
    <span><kbd>tab</kbd> – restart</span>
    <span><kbd>ctrl</kbd> + <kbd>⌫</kbd> – delete word</span>
    <span>লেআউট: প্রভাত</span>
  </footer>
</div>

{#if dialog}
  <AuthDialog {auth} onclose={() => (dialog = false)} />
{/if}

<style>
  .app {
    min-height: 100vh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    max-width: 1000px;
    margin: 0 auto;
    padding: 2rem 2rem 1.5rem;
    box-sizing: border-box;
    gap: 2rem;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: opacity 0.2s;
  }
  header.dim nav {
    opacity: 0;
    pointer-events: none;
  }
  nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: opacity 0.2s;
  }
  .logo {
    font-size: 2rem;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 0.15rem;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .brand {
    color: var(--text);
    font-weight: 600;
  }
  .brand-sub {
    color: var(--sub);
    font-family: var(--font-mono);
    font-size: 1.5rem;
  }
  .nav {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: 0;
    color: var(--sub);
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.3rem 0.5rem;
    border-radius: 0.3rem;
    cursor: pointer;
    transition: color 0.12s;
  }
  .nav:hover,
  .nav.active {
    color: var(--text);
  }
  .nav.active {
    color: var(--main);
  }
  .user {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: var(--sub);
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }
  main {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    justify-content: center;
  }
  .test {
    cursor: default;
  }
  .nudge {
    text-align: center;
    color: var(--sub);
    font-size: 0.9rem;
    margin: -1.5rem 0 0;
  }
  .link {
    background: none;
    border: 0;
    padding: 0;
    color: var(--main);
    cursor: pointer;
    font: inherit;
  }
  .link:hover {
    text-decoration: underline;
  }
  footer {
    display: flex;
    justify-content: center;
    gap: 2rem;
    color: var(--sub);
    font-size: 0.85rem;
    transition: opacity 0.2s;
  }
  footer.dim {
    opacity: 0;
  }
  kbd {
    background: var(--sub);
    color: var(--bg);
    border-radius: 0.2rem;
    padding: 0.05rem 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
</style>
