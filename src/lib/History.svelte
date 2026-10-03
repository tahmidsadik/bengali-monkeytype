<script lang="ts">
  import type { SavedResult, Stats } from '../../shared/types';
  import { api, ApiFailure } from './api';
  import { bnNumber } from './bengali';

  let { onopen, onback }: { onopen: (r: SavedResult) => void; onback: () => void } = $props();

  const PAGE = 50;
  let results = $state<SavedResult[]>([]);
  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let more = $state(false);
  let error = $state('');
  let armed = $state<number | null>(null); // result id awaiting a second click to delete

  const dateFmt = new Intl.DateTimeFormat('bn-BD', { dateStyle: 'medium', timeStyle: 'short' });

  async function load() {
    loading = true;
    error = '';
    try {
      const [s, r] = await Promise.all([api.stats(), api.results(PAGE)]);
      stats = s;
      results = r.results;
      more = r.results.length === PAGE;
    } catch (e) {
      error = e instanceof ApiFailure ? e.message : 'লোড করা যায়নি';
    } finally {
      loading = false;
    }
  }

  async function loadMore() {
    const last = results[results.length - 1];
    if (!last) return;
    try {
      const r = await api.results(PAGE, last.createdAt);
      results = [...results, ...r.results];
      more = r.results.length === PAGE;
    } catch (e) {
      error = e instanceof ApiFailure ? e.message : 'লোড করা যায়নি';
    }
  }

  async function remove(r: SavedResult) {
    if (armed !== r.id) {
      armed = r.id;
      setTimeout(() => armed === r.id && (armed = null), 2500);
      return;
    }
    armed = null;
    try {
      await api.deleteResult(r.id);
      results = results.filter((x) => x.id !== r.id);
      stats = await api.stats();
    } catch (e) {
      error = e instanceof ApiFailure ? e.message : 'মুছে ফেলা যায়নি';
    }
  }

  $effect(() => {
    load();
  });

  // --- trend chart over the loaded results (oldest → newest) ------------
  const W = 900;
  const H = 180;
  const PAD = { l: 44, r: 16, t: 12, b: 20 };
  const trend = $derived([...results].reverse());
  const maxY = $derived(Math.max(10, ...trend.map((r) => r.wpm)) * 1.1);
  const x = (i: number) => PAD.l + (trend.length > 1 ? (i / (trend.length - 1)) * (W - PAD.l - PAD.r) : 0);
  const y = (v: number) => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);
  const linePath = $derived(trend.map((r, i) => `${i ? 'L' : 'M'}${x(i)},${y(r.wpm)}`).join(' '));
  const yTicks = $derived([0, 0.5, 1].map((f) => Math.round(maxY * f)));
  const best = $derived(stats ? Math.max(0, ...stats.configs.map((c) => c.bestWpm)) : 0);
</script>

<div class="history">
  <div class="head">
    <h2>ইতিহাস</h2>
    <button class="back" onclick={onback}>← টাইপিং-এ ফিরুন <kbd>esc</kbd></button>
  </div>

  {#if loading}
    <p class="muted">লোড হচ্ছে…</p>
  {:else if error}
    <p class="error">{error}</p>
  {:else if results.length === 0}
    <p class="muted">এখনও কোনো টেস্ট সংরক্ষিত হয়নি। একটি টেস্ট শেষ করলে তা এখানে দেখা যাবে।</p>
  {:else}
    <div class="summary">
      <div class="stat">
        <div class="label">মোট টেস্ট</div>
        <div class="value">{bnNumber(stats?.total ?? 0)}</div>
      </div>
      <div class="stat">
        <div class="label">সেরা wpm</div>
        <div class="value">{bnNumber(Math.round(best))}</div>
      </div>
      {#each stats?.configs ?? [] as c (c.mode + c.amount)}
        <div class="stat small">
          <div class="label">{c.mode === 'time' ? 'সময়' : 'শব্দ'} {bnNumber(c.amount)}</div>
          <div class="value">{bnNumber(Math.round(c.bestWpm))}</div>
          <div class="sub">গড় {bnNumber(Math.round(c.avgWpm))} · {bnNumber(c.count)} বার</div>
        </div>
      {/each}
    </div>

    {#if trend.length > 1}
      <svg viewBox={`0 0 ${W} ${H}`} class="chart" role="img" aria-label="wpm trend">
        {#each yTicks as t (t)}
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} class="grid" />
          <text x={PAD.l - 8} y={y(t) + 4} class="tick" text-anchor="end">{t}</text>
        {/each}
        <path d={linePath} class="wpm" />
        {#each trend as r, i (r.id)}
          <circle cx={x(i)} cy={y(r.wpm)} r="3" class="dot" />
        {/each}
      </svg>
    {/if}

    <table>
      <thead>
        <tr>
          <th>কখন</th>
          <th>ধরন</th>
          <th class="num">wpm</th>
          <th class="num">raw</th>
          <th class="num">acc</th>
          <th class="num">con</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each results as r (r.id)}
          <tr onclick={() => onopen(r)}>
            <td class="muted">{dateFmt.format(r.createdAt)}</td>
            <td class="muted">{r.mode === 'time' ? 'সময়' : 'শব্দ'} {bnNumber(r.amount)}</td>
            <td class="num main">{bnNumber(Math.round(r.wpm))}</td>
            <td class="num">{bnNumber(Math.round(r.raw))}</td>
            <td class="num">{bnNumber(Math.round(r.accuracy))}%</td>
            <td class="num">{bnNumber(Math.round(r.consistency))}%</td>
            <td class="act">
              <button
                class="del"
                class:armed={armed === r.id}
                onclick={(e) => {
                  e.stopPropagation();
                  remove(r);
                }}
                title="মুছুন"
              >
                {armed === r.id ? 'নিশ্চিত?' : '✕'}
              </button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if more}
      <button class="more" onclick={loadMore}>আরও দেখান</button>
    {/if}
  {/if}
</div>

<style>
  .history {
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
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  h2 {
    margin: 0;
    font-weight: 500;
    font-size: 1.6rem;
  }
  .back {
    background: none;
    border: 0;
    color: var(--sub);
    cursor: pointer;
    font-size: 0.9rem;
    font-family: inherit;
  }
  .back:hover {
    color: var(--text);
  }
  kbd {
    background: var(--sub);
    color: var(--bg);
    border-radius: 0.2rem;
    padding: 0.05rem 0.35rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
  }
  .muted {
    color: var(--sub);
  }
  .error {
    color: var(--error);
  }
  .summary {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr));
    gap: 1rem;
  }
  .stat .label {
    color: var(--sub);
    font-size: 0.9rem;
  }
  .stat .value {
    color: var(--main);
    font-family: var(--font-mono);
    font-size: 2rem;
    line-height: 1.2;
  }
  .stat.small .value {
    font-size: 1.5rem;
  }
  .stat .sub {
    color: var(--sub);
    font-size: 0.8rem;
  }
  .chart {
    width: 100%;
    height: auto;
    overflow: visible;
  }
  .grid {
    stroke: var(--sub-alt);
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
  }
  .dot {
    fill: var(--main);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95rem;
  }
  th {
    text-align: left;
    color: var(--sub);
    font-weight: 400;
    font-size: 0.85rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 2px solid var(--sub-alt);
  }
  td {
    padding: 0.5rem 0.6rem;
    border-bottom: 1px solid var(--sub-alt);
    font-family: var(--font-mono);
  }
  td.muted {
    font-family: var(--font-bn);
  }
  tbody tr {
    cursor: pointer;
    transition: background 0.1s;
  }
  tbody tr:hover {
    background: var(--sub-alt);
  }
  .num {
    text-align: right;
  }
  .main {
    color: var(--main);
  }
  .act {
    width: 4rem;
    text-align: right;
  }
  .del {
    background: none;
    border: 0;
    color: var(--sub);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.8rem;
    opacity: 0;
    transition: opacity 0.1s, color 0.1s;
  }
  tr:hover .del,
  .del.armed {
    opacity: 1;
  }
  .del:hover,
  .del.armed {
    color: var(--error);
  }
  .more {
    align-self: center;
    background: none;
    border: 0;
    color: var(--sub);
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    padding: 0.5rem 1rem;
  }
  .more:hover {
    color: var(--text);
  }
</style>
