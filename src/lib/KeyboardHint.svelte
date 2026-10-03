<script lang="ts">
  import { PROBHAT_ROWS, probhatLabel } from './probhat';
  import type { Engine } from './engine.svelte';

  let { engine }: { engine: Engine } = $props();

  // reverse map: Bengali char → physical key (unshifted / shifted)
  const reverse = new Map<string, { key: string; shift: boolean }>();
  for (const row of PROBHAT_ROWS) {
    for (const [lo, hi] of row) {
      const a = probhatLabel(lo);
      const b = probhatLabel(hi);
      if (a && !reverse.has(a)) reverse.set(a, { key: lo, shift: false });
      if (b && !reverse.has(b)) reverse.set(b, { key: lo, shift: true });
    }
  }

  const next = $derived.by(() => {
    if (engine.status === 'finished') return null;
    const w = engine.words[engine.current];
    if (!w) return null;
    const idx = w.typed.length;
    if (idx >= w.targetCps.length) return { key: ' ', shift: false };
    return reverse.get(w.targetCps[idx]) ?? null;
  });
</script>

<div class="kb">
  {#each PROBHAT_ROWS as row, r (r)}
    <div class="row" style:padding-left={`${r * 1.2}rem`}>
      {#each row as [lo, hi] (lo)}
        <div class="key" class:hl={next?.key === lo}>
          <span class="hi" class:hl={next?.key === lo && next.shift}>{probhatLabel(hi)}</span>
          <span class="lo" class:hl={next?.key === lo && !next.shift}>{probhatLabel(lo)}</span>
          <span class="latin">{lo}</span>
        </div>
      {/each}
    </div>
  {/each}
  <div class="row">
    <div class="key shift" class:hl={next?.shift}>shift</div>
    <div class="key space" class:hl={next?.key === ' '}></div>
    <div class="key shift" class:hl={next?.shift}>shift</div>
  </div>
</div>

<style>
  .kb {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    align-items: flex-start;
    margin: 0 auto;
    width: fit-content;
    animation: fade 0.2s ease-out;
    user-select: none;
  }
  @keyframes fade {
    from {
      opacity: 0;
    }
  }
  .row {
    display: flex;
    gap: 0.3rem;
  }
  .key {
    position: relative;
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 0.35rem;
    background: var(--sub-alt);
    color: var(--sub);
    display: grid;
    grid-template-rows: 1fr 1fr;
    align-items: center;
    justify-items: center;
    font-size: 0.95rem;
    line-height: 1;
    transition: background 0.1s, color 0.1s;
  }
  .key.hl {
    background: var(--main);
    color: var(--bg);
  }
  .key .hi {
    font-size: 0.75rem;
    opacity: 0.55;
  }
  .key .lo {
    font-size: 1.05rem;
  }
  .key .hi.hl,
  .key .lo.hl {
    opacity: 1;
    font-weight: 600;
  }
  .key .latin {
    position: absolute;
    right: 0.2rem;
    bottom: 0.1rem;
    font-size: 0.55rem;
    font-family: var(--font-mono);
    opacity: 0.45;
  }
  .key.shift {
    width: 6.4rem;
    display: grid;
    grid-template-rows: 1fr;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .key.space {
    width: 17rem;
    grid-template-rows: 1fr;
  }
</style>
