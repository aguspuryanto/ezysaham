# Design Brief: AI Trading Journal

## Problem

Every screener preset in EzySaham (ARA, BPJS, Momentum, Breakout Hunter) makes a confident claim — "this stock is a good setup" — the moment it appears in the results table. But the user has no way to answer the one question that actually matters after using the tool for a while: **has the AI actually been right?** Not "does this stock look good today" but "over the last 3 months, when the AI said BUY_WATCH, what actually happened?"

Right now that answer lives only in the user's memory, or a spreadsheet they'd have to build and update by hand — checking each pick's entry/SL/TP against the next few days' prices, one ticker at a time. That friction means it never gets done, so the screener's real track record stays invisible, including to the person who most needs to trust or distrust it.

## Solution

A journal that the user builds deliberately, one pick at a time: from any screener result, an explicit **"+ Tambah ke Jurnal"** action snapshots that ticker's entry/SL/TP plan (derived the same way the Analysis page would show it) at today's price, tagged with which preset surfaced it. From that moment the journal owns the ticker — quietly checking each new trading day's OHLC against that plan until it resolves (SL hit, TP hit, ARA, or times out into Sideways), no further action needed from the user.

Over time, a second screen — the Jurnal dashboard — turns that accumulation of resolved picks into the accountability the raw screener can't provide: hit rates, average RR, how much of each big move was actually captured vs. left on the table, and a heatmap showing that "ARA Hunter" swings for the fences at 39% while "Breakout Hunter" grinds out consistent singles at 76%. The user stops trusting the screener on faith and starts trusting it — or specific parts of it — on evidence.

## Experience Principles

1. **Evidence over vibes** — every number the dashboard shows must trace back to an actual OHLC bar, not a vibe or a rounded estimate. If a metric can't be computed cleanly from available data (e.g. exact tick-size-rounded ARA price), the brief says so rather than faking precision.
2. **Curate, don't flood** — the journal holds what the user chose to track, not every row the screener ever produced. A journal of 15 deliberate entries the user can reason about beats an auto-logged 500-row firehose.
3. **Honest about "I don't know yet"** — an open position is visibly *open*, not silently missing and not prematurely graded. The dashboard's stats are computed only from resolved entries, and the UI says how many are still pending.

## Aesthetic Direction

- **Philosophy**: Extend the existing product exactly as-is — quiet, data-dense, monochrome-first shadcn/Tailwind v4 (oklch zinc scale) with emerald=positive, rose=negative/risk, amber=caution/watch as the only saturated accents. No new visual language; the Journal should look like a native second surface of the same app, not a bolted-on module.
- **Tone**: Clinical and calm — this is an accountability instrument, not a hype dashboard. Avoid celebratory styling on wins; a 🚀 ARA badge is informational, not confetti.
- **Reference points**: The existing `ResultsTable`/`StockCard` (ticker avatar + mono numerics + status pill), `PhilosophyBanner`'s restrained disclaimer tone.
- **Anti-references**: Consumer trading-app gamification (streaks, badges, sound effects), dense finance-terminal green/red-on-black themes that break from the app's current light/zinc-dark theme.

## Existing Patterns

- **Typography/colors/radius**: shadcn `@theme inline` tokens in `globals.css` — oklch zinc scale, `--radius` family (`radius-sm` → `radius-4xl`), emerald/rose/amber used ad hoc via Tailwind utility classes (no semantic "success/danger" color tokens defined yet — journal should follow the same ad hoc convention already used in `ResultsTable.tsx`).
- **Components already available**: `Card`, `Badge`, `Button`, `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` (Radix-based, `src/presentation/components/ui/tabs.tsx`), `Alert`, `Collapsible`, `Separator`.
- **Screener-specific patterns to reuse**: `TickerAvatar` + `ChangeBadge` + status-pill convention from `ResultsTable.tsx`; `FilterInfoCard`/`WatchlistCard` sidebar-card layout from `ScreenerSidebar.tsx`; `PresetTabs` chip-row pattern (though the Screener/Jurnal split itself should use the shadcn `Tabs` primitive, not `PresetTabs`, since these are sibling views, not filter chips).
- **Charts**: `recharts` is already an installed dependency and unused elsewhere in `src/` — this is the first feature that needs it (heatmap table + hit-rate bars).
- **State**: no global store is wired up despite `zustand` and `dexie` being installed dependencies — everything today is local `useState` (`ScreenerPage.tsx`) or a small custom hook (`useWatchlist.ts`, plain `localStorage`). The journal should follow that existing convention (a `useJournal` hook) rather than introducing `zustand`/`dexie` — see Data & Persistence below for why `dexie` (IndexedDB, client-only) doesn't fit this feature's durability requirement.

## Data & Persistence

This is the part of the brief that most departs from "just a UI feature," so it's spelled out in full.

### Storage: Vercel Blob (per user decision)

The app deploys to Vercel, so there is no writable local filesystem across invocations — plain JSON-on-disk would silently lose data. The journal persists as **one JSON document in Vercel Blob** (`journal/entries.json`), read-modify-written on every mutation (add entry, nightly-equivalent grading update, delete).

- **New dependency required**: `@vercel/blob` (not currently in `package.json`).
- **Race condition, accepted risk**: Blob has no transactions. A naive read → mutate → overwrite has a lost-update window if two writes overlap. Given this is a single-user tool with infrequent, manual "add to journal" clicks (not concurrent multi-user writes), last-write-wins is an acceptable v1 risk — but implement the write path as a small `readJournal() → mutate → writeJournal()` helper in one place (e.g. `src/data/repositories/JournalRepository.ts`) so a compare-and-swap guard (check `uploadedAt`/etag before overwrite, retry once on mismatch) can be added later without touching call sites.
- **Access pattern**: all reads/writes happen server-side (a Next.js Route Handler under `src/app/api/journal/`), never directly from the client — the client calls `GET/POST/PATCH /api/journal`.

### What gets snapshotted, and when

- Trigger: **manual "+ Tambah ke Jurnal"** button on a screener result row (table and grid views) and on the ticker Analysis page — not automatic on every scan.
- At the moment of adding, compute (or reuse, if already computed this session) `StockAnalysis.tradingPlan` for that ticker via the existing `stockAnalysisEngine.ts`, using whatever bars are already in memory from the scan, or fetching them on demand via `getStockHistory` if the user added from the "Semua" (unfiltered) view where bars weren't fetched. Store the `recommendedBias` scenario's `entry`/`tp1`/`sl` (v1 uses `tp1` as *the* TP; `tp2` is out of scope, see below) plus `riskRewardRatio`.
- Also store: ticker, entry date, which preset/filter surfaced it (`'ara' | 'bpjs' | 'momentum' | 'breakout' | null` — `null`/`'all'` if added from the unfiltered view), and — only for `breakout` — the `composite` score at add-time, for the Setup Score vs Outcome table.

```ts
interface JournalEntry {
  id: string;                 // uuid
  ticker: string;
  addedAt: string;            // ISO date, trading day the entry was created
  presetId: ScreenerPresetId | null;
  entry: number;
  sl: number;
  tp: number;                 // tp1 from TradingPlanAnalysis
  riskRewardPlanned: number;  // TradeScenario.riskRewardRatio at add-time
  setupScore: number | null;  // BreakoutScores.composite, breakout preset only
  status: 'open' | 'tp_hit' | 'sl_hit' | 'ara' | 'sideways';
  resolvedAt: string | null;  // ISO date the entry closed, null while open
  daysTracked: number;        // trading days elapsed since addedAt
  metrics: JournalMetrics | null; // populated once resolved (or partially, see below)
}
```

### Grading mechanic: lazy, on read — no cron

There's no job scheduler in this app today, and adding Vercel Cron is more infrastructure than this feature needs at this scale. Instead: **every time the Jurnal tab is opened** (or the user taps a "Refresh Outcomes" button), the client asks `GET /api/journal`, which — for every entry still `status: 'open'` — fetches that ticker's OHLC bars since `addedAt` (existing `getStockHistory`) and walks forward day by day:

1. If any day's `low <= sl` → close as `sl_hit` on that day.
2. Else if any day's `high >= tp` → close as `tp_hit` on that day (recording that day's `high` for Maximum Potential/TP Efficiency even though the entry is now closed).
3. Else if any day's close lands at/near the computed ARA ceiling for that ticker's price tier (see below) → close as `ara`.
4. Else if `daysTracked` reaches the cap (**default 10 trading days** — a constant, tune later) with none of the above → close as `sideways`, using the last available close as the exit reference for metrics.
5. Otherwise stays `open`.

This also means a resolved entry is graded using the full path of bars from entry to resolution, not just entry-vs-next-day, which matters for Maximum Potential (the true `High` over the whole tracked window, not just day 1).

### ARA (auto rejection atas) detection

No auto-rejection band logic exists anywhere in the codebase today — it has to be built. Model it on IDX's current price-tier bands applied to the previous close:

| Previous close | ARA band |
| --- | --- |
| Rp 50 – Rp 200 | 35% |
| Rp 200 – Rp 5,000 | 25% |
| > Rp 5,000 | 20% |

> ⚠️ These bands change periodically by IDX rule revisions and this brief's numbers should be verified against the current official rule before shipping — treat them as a placeholder constant (`ARA_BANDS` in one file) that's easy to correct, not as verified fact.

Simplifications for v1 (flag, don't hide):
- Skip IDX's price-tier tick-size rounding of the exact ARA price — treat the computed ceiling as-is.
- Detect "hit ARA" as `close >= araPrice * 0.995` (tolerance for the skipped tick rounding) — a day that closes right at the ceiling with no giveback.
- IPO/relisting first-days-wider-band exception: out of scope, not modeled.

## Metrics Specification (per resolved entry)

All computed from the entry's stored `entry/sl/tp` plus the OHLC path fetched during grading:

| # | Metric | Formula | Notes |
|---|---|---|---|
| 1 | Entry Accuracy | `valid = low_day1 <= entry` | Did the plan ever offer a real fill |
| 2 | Stop Loss | `hit = any(low <= sl)` | Which day, if hit |
| 3 | Take Profit | `hit = any(high >= tp)` | Which day, if hit |
| 4 | Maximum Potential | `(max(high) - entry) / entry` | Over the full tracked window, even past resolution day |
| 5 | Missed Opportunity | `(araPrice - tp) / tp` | Only meaningful when status is `ara` |
| 6 | Capture Ratio | `(high_at_resolution - entry) / (peakReference - entry)` | `peakReference` = `araPrice` if status is `ara`, else `max(high)` over the window |
| 7 | Actual Risk/Reward | `(tp - entry) / (entry - sl)` | Planned RR, already stored as `riskRewardPlanned`; kept here for the dashboard's avg RR stat |
| 8 | TP Efficiency | `(high_on_tp_day - tp) / tp` | Only when `tp_hit`; smaller = better-tuned TP |
| 9 | ARA Distance | `(araPrice - tp) / tp` | Computed for every entry (not just ones that hit ARA) as a "how far was TP from the ceiling" calibration signal |
| 10 | Setup Score vs Outcome | bucket `setupScore` (10-pt buckets) against `status` | **Breakout Hunter only in v1** — other presets have no numeric score to calibrate against; they still get metrics 1–9 |

## Dashboard & Heatmap (Jurnal tab, second section)

Below the entry list, once ≥1 resolved entry exists:

- **Summary stat row**: Total Rekomendasi, TP Hit %, SL Hit %, Avg Profit, Avg Loss, Avg RR (planned), ARA Hit (count), Avg Max Return, Capture Ratio (avg), Win Rate (`tp_hit + ara` / resolved), Expectancy (`winRate * avgProfit - lossRate * avgLoss`). Sharpe: **out of scope v1** (needs a return series with a consistent time basis this dataset doesn't cleanly provide yet).
- **Heatmap table**, one row per `presetId` that has ≥1 resolved entry: Win Rate, Avg Profit, ARA % — rendered as a small table with `recharts`-driven inline bars (not a full 2D color-grid heatmap; a sparse 4-preset dataset doesn't need one) so it reads as data first, decoration second.
- All aggregates computed only from `status !== 'open'` entries; the UI states how many entries are still open and excluded (e.g. "12 dari 15 sudah selesai").

## Component Inventory

| Component | Status | Notes |
| --- | --- | --- |
| `Tabs` (Screener / Jurnal) | Exists (`ui/tabs.tsx`), New usage | Top-level split replacing the current single-page layout's implicit "always screener" assumption |
| `JournalEntryRow` | New | List/table row: ticker, preset badge, entry/SL/TP, status pill, days tracked |
| `AddToJournalButton` | New | Icon button alongside `WatchlistStar` in `ResultsTable.tsx` rows/cards, and on the Analysis page's trading plan card |
| `JournalStatCard` / stat row | New | Reuses `Card` primitive |
| `PresetHeatmapTable` | New | Uses `recharts` for inline bar cells |
| `StatusPill` (open/tp_hit/sl_hit/ara/sideways) | New | Same visual convention as `STATUS_STYLES` in `ResultsTable.tsx` (emerald/rose/amber/zinc) |
| `TickerAvatar`, `ChangeBadge` | Exists (`ResultsTable.tsx`) | Reused as-is in journal rows |
| `JournalRepository` (server) | New | Vercel Blob read/write helper, not a UI component but the load-bearing new module |

## Key Interactions

- **Adding**: click "+ Tambah ke Jurnal" on a result row → optimistic pill appears ("Ditambahkan ✓") → server computes/stores the trading plan snapshot → on failure, the button reverts and shows an inline error (no silent failure, since this is a deliberate user action).
- **Viewing**: opening the Jurnal tab triggers the lazy grading pass before rendering (brief loading state, same `Loader2` spinner convention as `ScreenerPage`), then renders the entry list newest-first, open entries pinned above resolved ones.
- **Resolving**: no user action needed — status flips automatically once the grading pass detects SL/TP/ARA/cap. A resolved row shows its final metrics inline (expand/collapse via existing `Collapsible` primitive to avoid overwhelming the row with 9 numbers by default).
- **Deleting**: a resolved (or mistaken) entry can be removed — soft, single confirmation, no undo needed since it's a personal record.

## Responsive Behavior

Follows the screener's existing pattern exactly: table view collapses to stacked cards under `md`, the Screener/Jurnal `Tabs` bar stays visible and full-width on mobile (same treatment as `PresetTabs`/`BottomNav` already do for preset switching). The heatmap table becomes horizontally scrollable within its own container below `sm` rather than reflowing into cards (it's inherently tabular).

## Accessibility Requirements

Matches the app's existing baseline: visible focus rings (already present via Tailwind `focus-visible` utilities on interactive elements), `aria-label`/`aria-pressed` on icon-only buttons (follow the `WatchlistStar` pattern exactly for `AddToJournalButton`), status conveyed by icon + text label + color (never color alone) for the status pills, minimum body-text contrast consistent with the existing zinc-on-white/zinc-on-black scale.

## Out of Scope

- Automatic per-scan journaling (explicitly rejected in favor of manual add).
- Sharpe ratio and any statistic requiring a time-normalized return series.
- Exact IDX tick-size rounding of the ARA ceiling price, and IPO/relisting first-day wider ARA bands.
- Vercel Cron / scheduled background grading — v1 grades lazily on tab open or manual refresh only.
- Editing a journal entry's stored plan after creation (only delete, no edit).
- Multi-device/multi-user sync semantics beyond "last write wins" on the single Blob document — no auth, no per-user journals.
- Retroactive backtesting (journaling picks the AI *would have* made on past dates) — the journal only tracks forward from the moment a user adds an entry.
- `tp2` from `TradingPlanAnalysis` — v1 grades against `tp1` only.
