# StockPilot — Migration Plan

## Cutover strategy: Strangler Fig

Not big-bang (too risky — a silently wrong AI score is worse than a slow migration), not indefinite parallel-run (this is a single-user app today, no external consumers to break, so there's no need to sustain double maintenance beyond a short verification window).

**Phase A — Build & import.** Stand up the StockPilot skeleton (monorepo, Supabase schema, Hono API shell). Port the domain engine package unmodified. Import all historical data from `data/app.db` into Supabase (see Data Migration below).

**Phase B — Score-parity verification (gate).** Run both engines — legacy (`domain/engine/*` in `saham-screener`) and ported (`packages/domain` in StockPilot) — against the *same* imported `daily_bars` for a sample of tickers. Diff `WatchlistOutput`/`AiEngineOutput`/`TradeEngineOutput`. Must match exactly on scores/tiers/decisions (rounding-tolerant on floats). **Do not proceed to Phase C until this passes** — this is the single highest-value verification step in the whole rewrite, since the engine is the product's core IP and a silent scoring regression would be far worse than a slow migration.

**Phase C — Cutover.** Point real usage at StockPilot. Keep `saham-screener` read-only/dormant for a defined grace window (e.g. 2 weeks) as a rollback safety net — do not delete anything yet.

**Phase D — Decommission.** After the grace window with no rollback need, archive or remove the `saham-screener` repo/folder.

## Code migration inventory

### Directly portable (copy + adjust imports only)

- `src/domain/engine/*` — `watchlistEngine.ts`, `aiEngine.ts`, `tradeEngine.ts`, `scores.ts`, `rules.ts`, `probability.ts`, `explanation.ts`, `watchlistMomentum.ts`, `watchlistStructure.ts`, `watchlistRisk.ts`, `riskScore.ts`, `falseBreakoutScore.ts`, `riskReward.ts`, `openingStrength.ts`, `tradeDecision.ts`, `utils.ts`
- `src/domain/indicators.ts`
- `src/domain/patterns/candlestick.ts`
- `src/domain/models/*.ts` (Watchlist, AiEngine, TradeEngine, TradeJournal, History, Stock type shapes)
- Their co-located `.test.ts` files — vitest ports directly, no rewrite needed.

All of the above have **zero Supabase/Hono/React imports today** and must stay that way in `packages/domain` — this framework-independence is what makes the port low-risk.

### Must be rebuilt (not ported)

- All Express routing (`server.ts`, `server/historyRoutes.js`, `server/tradeJournalRoutes.js`) and the parallel Vercel functions (`api/stocks.js`, `api/stocks/[code]/history.js`) → Hono handlers, per [04-api-specification.md](04-api-specification.md).
- better-sqlite3 queries (`server/db.js`) → Supabase client calls / SQL migrations, per [03-database-schema.md](03-database-schema.md).
- No-auth → Supabase Auth + RLS on every table.
- `src/presentation/*` React components → new Shadcn/Tailwind/Framer-Motion component tree, informed by (not copy-pasted from) `docs/screener-redesign-spec.md`.
- Zustand-backed hooks (`useAiScreener.ts`, `useWatchlistScreener.ts`, `useStockHistory.ts`) → Tanstack Query hooks.

### Explicitly not ported (retired)

- `src/utils/scoringEngine.ts` + `src/utils/technicalIndicators.ts` (legacy summary-% heuristic — see [05-business-rules.md](05-business-rules.md) §6).
- Electron packaging (already deleted from `saham-screener` in this same pass).
- `@google/genai` / Gemini scaffolding (already deleted).

## Data migration — `data/app.db` → Supabase

One-off, idempotent script (better-sqlite3 read → `@supabase/supabase-js` service-role write), run manually once (not a recurring ETL):

- **`daily_bars`** (`ticker, date, open, high, low, close, volume, source, fetched_at`) → bulk insert into Postgres `daily_bars`, folding in the legacy `history_fetch_log` table's `last_fetched_at`/`last_status`/`bar_count`/`last_error` columns (per ADR-003 — see [10-glossary-decisions.md](10-glossary-decisions.md)).
- **`trade_journal`** → bulk insert into `trading_journal`, column-for-column (see [03-database-schema.md](03-database-schema.md)), plus a backfilled `user_id` set to the single operator's newly-created Supabase Auth account — the legacy app has no concept of multiple users, so this is a one-time, documented manual assignment, not a general-purpose migration pattern.
- Script is idempotent (upsert on natural key: `(ticker,date)` for bars, legacy `id` preserved as a migration-reference column for journal rows) so it can be safely re-run if interrupted.
- No production data-loss tolerance issue here (single-user hobby app) — but verify row counts match before Phase B sign-off (see [08-testing-plan.md](08-testing-plan.md)).

## Rollback plan

Keep `data/app.db` and the legacy repo state completely untouched through Phase C's grace window. If a scoring or data issue is discovered post-cutover, traffic can point back at `saham-screener` immediately since nothing about it was modified or deleted (aside from the Electron/AI-Studio cleanup already done, which is unrelated to core functionality).

## Risk register

| Risk | Mitigation |
|---|---|
| Score-parity mismatch between legacy and ported engine | Phase B gate — must pass before cutover |
| Supabase RLS misconfiguration exposing one user's data to another | Dedicated RLS isolation tests (see [08-testing-plan.md](08-testing-plan.md)) before any real second user is onboarded |
| Cloudflare Workers CPU-time limit hit during backtest computation | Backtest runs as an async/queued job (ADR-005), never a synchronous Worker request |
| Silent data loss during `data/app.db` import | Row-count + spot-check checksum verification (see [08-testing-plan.md](08-testing-plan.md)) |
