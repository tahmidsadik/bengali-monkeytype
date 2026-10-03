<script lang="ts">
  import { bnNumber } from './bengali';
  import type { ResultData } from '../../shared/types';
  import type { SaveState } from './api';

  let {
    result,
    onrestart,
    onback,
    save = 'off',
    date,
  }: {
    result: ResultData;
    /** shown as the restart button (live result) */
    onrestart?: () => void;
    /** shown as a back button (history detail) */
    onback?: () => void;
    save?: SaveState;
    /** unix ms, shown for history entries */
    date?: number;
  } = $props();

  const dateFmt = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });

  const W = 900;
  const H = 240;
  const PAD = { l: 44, r: 44, t: 12, b: 28 };

  const snaps = $derived(result.snapshots);
  const maxY = $derived(Math.max(10, ...snaps.map((s) => Math.max(s.wpm, s.raw))) * 1.1);
  const maxX = $derived(Math.max(1, snaps.length ? snaps[snaps.length - 1].second : 1));
  const maxErr = $derived(Math.max(1, ...snaps.map((s) => s.errors)));

  const x = (sec: number) => PAD.l + ((sec - 1) / Math.max(1, maxX - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);

  function path(key: 'wpm' | 'raw') {
    if (snaps.length === 1) {
      const s = snaps[0];
      return `M${PAD.l},${y(s[key])} L${W - PAD.r},${y(s[key])}`;
    }
    return snaps.map((s, i) => `${i ? 'L' : 'M'}${x(s.second)},${y(s[key])}`).join(' ');
  }

  const yTicks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxY * f)));
  const chars = $derived(`${result.correct}/${result.incorrect}/${result.extra}/${result.missed}`);
</script>

<div class="result">
  <div class="top">
    <div class="big">
      <div class="label">wpm</div>
      <div class="value">{bnNumber(Math.round(result.wpm))}</div>
      <div class="label">acc</div>
      <div class="value">{bnNumber(Math.round(result.accuracy))}%</div>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label="wpm over time">
      {#each yTicks as t (t)}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} class="grid" />
        <text x={PAD.l - 8} y={y(t) + 4} class="tick" text-anchor="end">{t}</text>
      {/each}
      <path d={path('raw')} class="raw" />
      <path d={path('wpm')} class="wpm" />
      {#each snaps as s (s.second)}
        {#if s.errors > 0}
          <g class="err" transform={`translate(${x(s.second)}, ${y((s.errors / maxErr) * maxY * 0.5)})`}>
            <line x1="-4" y1="-4" x2="4" y2="4" />
            <line x1="-4" y1="4" x2="4" y2="-4" />
          </g>
        {/if}
      {/each}
      {#each snaps as s, i (s.second)}
        {#if snaps.length <= 30 || i % Math.ceil(snaps.length / 30) === 0}
          <text x={x(s.second)} y={H - 8} class="tick" text-anchor="middle">{s.second}</text>
        {/if}
      {/each}
    </svg>
  </div>

  <div class="details">
    <div class="stat">
      <div class="label">test type</div>
      <div class="small">
        {result.mode} {result.amount}<br />বাংলা · প্রভাত
        {#if date}<br />{dateFmt.format(date)}{/if}
      </div>
    </div>
    <div class="stat">
      <div class="label">raw</div>
      <div class="mid">{bnNumber(Math.round(result.raw))}</div>
    </div>
    <div class="stat">
      <div class="label">characters</div>
      <div class="mid" title="correct / incorrect / extra / missed">{bnNumber(chars)}</div>
    </div>
    <div class="stat">
      <div class="label">consistency</div>
      <div class="mid">{bnNumber(Math.round(result.consistency))}%</div>
    </div>
    <div class="stat">
      <div class="label">time</div>
      <div class="mid">{bnNumber(Math.round(result.seconds))}s</div>
    </div>
  </div>

  <div class="bottom">
    {#if onrestart}
      <button class="restart" onclick={onrestart} title="restart (tab / enter)">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>
    {/if}
    {#if onback}
      <button class="restart" onclick={onback} title="back (esc)">← ইতিহাসে ফিরুন</button>
    {/if}
    {#if save === 'saving'}
      <span class="save">সংরক্ষণ হচ্ছে…</span>
    {:else if save === 'saved'}
      <span class="save ok">✓ সংরক্ষিত</span>
    {:else if save === 'error'}
      <span class="save bad">সংরক্ষণ করা যায়নি</span>
    {/if}
  </div>
</div>

<style>
  .result {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    animation: fade 0.25s ease-out;
  }
  @keyframes fade {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }
  .top {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1.5rem;
    align-items: center;
  }
  .big .label {
    color: var(--sub);
    font-size: 1.5rem;
    line-height: 1.2;
  }
  .big .value {
    color: var(--main);
    font-family: var(--font-mono);
    font-size: 3.6rem;
    line-height: 1.1;
    margin-bottom: 0.5rem;
  }
  .chart {
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .grid {
    stroke: var(--sub-alt);
    stroke-width: 1;
  }
  .tick {
    fill: var(--sub);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .wpm {
    fill: none;
    stroke: var(--main);
    stroke-width: 2.5;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .raw {
    fill: none;
    stroke: var(--sub);
    stroke-width: 2;
    stroke-linejoin: round;
  }
  .err line {
    stroke: var(--error);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .details {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 1rem;
  }
  .stat .label {
    color: var(--sub);
    font-size: 0.95rem;
  }
  .stat .mid {
    color: var(--main);
    font-family: var(--font-mono);
    font-size: 1.8rem;
    line-height: 1.2;
  }
  .stat .small {
    color: var(--main);
    font-size: 0.95rem;
    line-height: 1.3;
    font-family: var(--font-mono);
  }
  .bottom {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .save {
    color: var(--sub);
    font-size: 0.85rem;
    animation: fade 0.2s ease-out;
  }
  .save.ok {
    color: var(--main);
  }
  .save.bad {
    color: var(--error);
  }
  .restart {
    font-family: inherit;
    font-size: 0.95rem;
    background: none;
    border: 0;
    color: var(--sub);
    padding: 0.5rem 1.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: color 0.12s, background 0.12s;
  }
  .restart:hover {
    color: var(--bg);
    background: var(--text);
  }
  @media (max-width: 700px) {
    .top {
      grid-template-columns: 1fr;
    }
    .details {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
