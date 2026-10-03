<script lang="ts">
  import { bnNumber } from './bengali';
  import { TIME_OPTIONS, WORD_OPTIONS, type Engine } from './engine.svelte';

  let {
    engine,
    showKeyboard = $bindable(false),
  }: { engine: Engine; showKeyboard?: boolean } = $props();

  const options = $derived(engine.mode === 'time' ? TIME_OPTIONS : WORD_OPTIONS);

  function setMode(mode: 'time' | 'words') {
    if (mode === engine.mode) return;
    engine.setMode(mode, mode === 'time' ? 30 : 25);
  }
</script>

<div class="config" class:hidden={engine.status === 'running'}>
  <div class="group">
    <button class:active={engine.mode === 'time'} onclick={() => setMode('time')}>সময়</button>
    <button class:active={engine.mode === 'words'} onclick={() => setMode('words')}>শব্দ</button>
  </div>
  <div class="sep"></div>
  <div class="group">
    {#each options as n (n)}
      <button class:active={engine.amount === n} onclick={() => engine.setMode(engine.mode, n)}>
        {bnNumber(n)}
      </button>
    {/each}
  </div>
  <div class="sep"></div>
  <div class="group">
    <button class:active={showKeyboard} onclick={() => (showKeyboard = !showKeyboard)} title="প্রভাত লেআউট">
      ⌨ প্রভাত
    </button>
  </div>
</div>

<style>
  .config {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--sub-alt);
    border-radius: 0.5rem;
    padding: 0.35rem 0.75rem;
    transition: opacity 0.2s;
    width: fit-content;
    margin: 0 auto;
  }
  .config.hidden {
    opacity: 0;
    pointer-events: none;
  }
  .group {
    display: flex;
    gap: 0.25rem;
  }
  .sep {
    width: 0.25rem;
    height: 1.5rem;
    background: var(--bg);
    border-radius: 0.25rem;
    margin: 0 0.5rem;
  }
  button {
    background: none;
    border: 0;
    color: var(--sub);
    font: inherit;
    font-size: 0.9rem;
    padding: 0.3rem 0.5rem;
    cursor: pointer;
    border-radius: 0.3rem;
    transition: color 0.12s;
  }
  button:hover {
    color: var(--text);
  }
  button.active {
    color: var(--main);
  }
</style>
