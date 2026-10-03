<script lang="ts">
  import { tick, onDestroy } from 'svelte';
  import { graphemes, graphemeState, bnNumber } from './bengali';
  import type { Engine } from './engine.svelte';

  let { engine, focused }: { engine: Engine; focused: boolean } = $props();

  type Word = Engine['words'][number];

  let wordsEl: HTMLDivElement | undefined = $state();
  let caretEl: HTMLDivElement | undefined = $state();
  let caretH = $state(0);
  let scrollY = $state(0);
  let lineH = $state(0);
  let blink = $state(true);
  let flash = $state(false);
  let blinkTimer: ReturnType<typeof setTimeout> | undefined;
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  // --- smooth caret -------------------------------------------------------
  // The caret glides toward its target with exponential smoothing driven by
  // requestAnimationFrame and written straight to the DOM, so it never fights
  // a CSS transition and stays fluid even when keystrokes arrive mid-animation.
  const TAU = 40; // ms; smaller = snappier
  let targetX = 0;
  let targetY = 0;
  let posX = 0;
  let posY = 0;
  let raf = 0;
  let lastT = 0;
  let snapNext = true; // first placement (and resets) jump instead of gliding

  function render() {
    if (caretEl) caretEl.style.transform = `translate3d(${posX}px, ${posY}px, 0)`;
  }

  function step(t: number) {
    const dt = lastT ? Math.min(t - lastT, 64) : 16;
    lastT = t;
    const k = 1 - Math.exp(-dt / TAU);
    posX += (targetX - posX) * k;
    posY += (targetY - posY) * k;
    if (Math.abs(targetX - posX) < 0.15 && Math.abs(targetY - posY) < 0.15) {
      posX = targetX;
      posY = targetY;
      render();
      raf = 0;
      lastT = 0;
      return;
    }
    render();
    raf = requestAnimationFrame(step);
  }

  function moveCaret(x: number, y: number) {
    targetX = x;
    targetY = y;
    if (snapNext) {
      snapNext = false;
      posX = x;
      posY = y;
      render();
      return;
    }
    if (!raf) {
      lastT = 0;
      raf = requestAnimationFrame(step);
    }
  }

  // --- word helpers -------------------------------------------------------
  function wordCorrect(w: Word) {
    if (w.typed.length !== w.targetCps.length) return false;
    for (let i = 0; i < w.typed.length; i++) if (w.typed[i] !== w.targetCps[i]) return false;
    return true;
  }

  function extras(w: Word) {
    if (w.typed.length <= w.targetCps.length) return [];
    const base = w.targetCps.length;
    return graphemes(w.typed.slice(base).join('')).map((g) => ({ ...g, start: g.start + base }));
  }

  /**
   * What to draw for a grapheme: the target text normally, but what the user
   * actually typed when it is wrong, so the mistake is visible rather than
   * only tinted red.
   */
  function display(g: { text: string; start: number; end: number }, w: Word, state: string) {
    if (state !== 'incorrect') return g.text;
    const upto = Math.min(w.typed.length, g.end);
    return w.typed.slice(g.start, upto).join('');
  }

  // --- layout -------------------------------------------------------------
  function layout() {
    if (!wordsEl) return;
    const active = wordsEl.querySelector<HTMLElement>('.word.active');
    if (!active) return;
    const first = wordsEl.querySelector<HTMLElement>('.word');
    if (first) lineH = first.offsetHeight;

    // keep the active line as the 2nd visible line
    const line = Math.round(active.offsetTop / lineH);
    scrollY = Math.max(0, line - 1) * lineH;

    const typedLen = engine.words[engine.current].typed.length;
    const spans = Array.from(active.querySelectorAll<HTMLElement>('.g'));
    let target: HTMLElement | undefined;
    let right = false;
    for (const s of spans) {
      const start = Number(s.dataset.start);
      if (start < typedLen) {
        target = s;
        right = true;
      } else break;
    }
    if (!target) {
      target = spans[0];
      right = false;
    }
    if (!target) return;
    const h = Math.round(lineH * 0.62);
    caretH = h;
    moveCaret(
      active.offsetLeft + target.offsetLeft + (right ? target.offsetWidth : 0),
      active.offsetTop + (lineH - h) / 2,
    );
  }

  $effect(() => {
    // depend on keystrokes + current word so the caret follows input
    void engine.keystrokes;
    void engine.current;
    if (engine.status === 'idle' && engine.current === 0 && engine.words[0]?.typed.length === 0) {
      snapNext = true; // fresh test: jump to the start instead of gliding back
    }
    blink = false;
    clearTimeout(blinkTimer);
    blinkTimer = setTimeout(() => (blink = true), 1000);
    tick().then(layout);
  });

  $effect(() => {
    if (engine.errors === 0) return;
    flash = true;
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (flash = false), 160);
  });

  $effect(() => {
    const ro = new ResizeObserver(() => {
      snapNext = true;
      layout();
    });
    if (wordsEl) ro.observe(wordsEl);
    if (document.fonts) document.fonts.ready.then(() => {
      snapNext = true;
      layout();
    });
    return () => ro.disconnect();
  });

  onDestroy(() => {
    if (raf) cancelAnimationFrame(raf);
    clearTimeout(blinkTimer);
    clearTimeout(flashTimer);
  });
</script>

<div class="typing" class:unfocused={!focused}>
  <div class="live" class:visible={engine.status === 'running'}>
    {#if engine.mode === 'time'}
      {bnNumber(engine.clock)}
    {:else}
      {bnNumber(engine.current)}/{bnNumber(engine.amount)}
    {/if}
  </div>

  <div class="window" style:height={lineH ? `${lineH * 3}px` : undefined}>
    <div class="words" bind:this={wordsEl} style:transform={`translateY(-${scrollY}px)`}>
      <div
        class="caret"
        class:blink={blink && focused}
        class:flash
        bind:this={caretEl}
        style:height={caretH ? `${caretH}px` : undefined}
      ></div>
      {#each engine.words as word, i (i)}
        <div
          class="word"
          class:active={i === engine.current}
          class:error={word.committed && !wordCorrect(word)}
        >
          {#each word.graphemes as g (g.start)}
            {@const state = graphemeState(g, word.targetCps, word.typed)}
            <span class="g {state}" data-start={g.start}>{display(g, word, state)}</span>
          {/each}
          {#each extras(word) as g (g.start)}
            <span class="g extra" data-start={g.start}>{g.text}</span>
          {/each}
        </div>
      {/each}
    </div>
  </div>

  {#if !focused}
    <div class="focus-hint">ফোকাস করতে এখানে ক্লিক করুন বা যেকোনো কী চাপুন</div>
  {/if}
</div>

<style>
  .typing {
    position: relative;
    width: 100%;
  }
  .live {
    font-family: var(--font-mono);
    color: var(--main);
    font-size: 1.5rem;
    height: 2rem;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .live.visible {
    opacity: 1;
  }
  .window {
    overflow: hidden;
    position: relative;
    height: calc(var(--word-line-h) * 3);
    transition: filter 0.2s, opacity 0.2s;
  }
  .unfocused .window {
    filter: blur(5px);
    opacity: 0.5;
  }
  .words {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-content: flex-start;
    transition: transform 0.2s ease-out;
    will-change: transform;
  }
  .word {
    position: relative;
    font-size: var(--word-size);
    line-height: var(--word-line-h);
    height: var(--word-line-h);
    margin: 0 0.3em;
    color: var(--sub);
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    box-sizing: border-box;
  }
  .word.error {
    border-bottom-color: var(--error);
  }
  .g {
    display: inline-block;
    transition: color 0.08s;
  }
  .g.correct {
    color: var(--text);
  }
  .g.partial {
    color: var(--text);
    opacity: 0.6;
  }
  .g.incorrect {
    color: var(--error);
    animation: shake 0.12s ease-out;
  }
  .g.extra {
    color: var(--error-extra);
    animation: shake 0.12s ease-out;
  }
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    35% {
      transform: translateX(-0.06em);
    }
    70% {
      transform: translateX(0.06em);
    }
    100% {
      transform: translateX(0);
    }
  }
  .caret {
    position: absolute;
    top: 0;
    left: 0;
    width: 0.12em;
    font-size: var(--word-size);
    border-radius: 2px;
    background: var(--caret);
    will-change: transform;
    z-index: 1;
    transition: background-color 0.1s, opacity 0.15s;
  }
  .caret.flash {
    background: var(--error);
  }
  .caret.blink {
    animation: blink 1s infinite;
  }
  .unfocused .caret {
    opacity: 0;
  }
  @keyframes blink {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
  }
  .focus-hint {
    position: absolute;
    inset: 2rem 0 0 0;
    display: grid;
    place-items: center;
    color: var(--text);
    font-size: 1.1rem;
    pointer-events: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .g.incorrect,
    .g.extra {
      animation: none;
    }
  }
</style>
