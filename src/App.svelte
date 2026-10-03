<script lang="ts">
  import { Engine } from './lib/engine.svelte';
  import ConfigBar from './lib/ConfigBar.svelte';
  import TypingArea from './lib/TypingArea.svelte';
  import Result from './lib/Result.svelte';
  import KeyboardHint from './lib/KeyboardHint.svelte';

  const engine = new Engine();
  let focused = $state(true);
  let showKeyboard = $state(false);
  let hideMouse = $state(false);
  let mouseTimer: ReturnType<typeof setTimeout> | undefined;

  function restart() {
    engine.reset();
    focused = true;
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      restart();
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

  function onMouseMove() {
    hideMouse = false;
    clearTimeout(mouseTimer);
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  onblur={() => (focused = false)}
  onfocus={() => (focused = true)}
  onmousemove={onMouseMove}
  onclick={() => (focused = true)}
/>

<svelte:body class:hide-mouse={hideMouse} />

<div class="app">
  <header>
    <div class="logo">
      <span class="brand">বাংলা</span><span class="brand-sub">type</span>
    </div>
  </header>

  <main>
    {#if engine.status === 'finished' && engine.result}
      <Result result={engine.result} onrestart={restart} />
    {:else}
      <ConfigBar {engine} bind:showKeyboard />
      <div class="test">
        <TypingArea {engine} {focused} />
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
  }
  .logo {
    font-size: 2rem;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 0.15rem;
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
  main {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
    justify-content: center;
  }
  .test {
    cursor: default;
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
