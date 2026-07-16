# StockPilot — Testing Plan

## Test pyramid

- **Unit** — `packages/domain` (engine + indicators + patterns), ported 1:1 from the existing `vitest` suites in `saham-screener`.
- **Integration** — Hono route handlers against a local Postgres/test Supabase instance.
- **E2E** — Playwright (or similar) against Cloudflare Pages preview deploys, covering the representative user flows below.

## Domain engine parity tests (highest priority — see [06-migration-plan.md](06-migration-plan.md) Phase B)

Golden-fixture approach: capture `WatchlistOutput`, `AiEngineOutput`, and `TradeEngineOutput` for a fixed set of tickers + date ranges from the **current, live `saham-screener` app**. Assert the ported `packages/domain` produces identical `finalScore`/`tier`/`recommendation`/`decision`/`grade` (exact match) and identical float sub-scores within rounding tolerance. This is the single most important test in the suite — the engine is StockPilot's core IP, and a silent scoring regression here undermines the entire product's credibility.

## API contract tests

Every endpoint in [04-api-specification.md](04-api-specification.md) gets a schema-validation test: request shape accepted, response shape matches documented contract, documented error cases actually return the documented error envelope.

## RLS policy tests (new concern — legacy has no auth at all)

For every user-owned table (`watchlist`, `trading_journal`, `backtest_runs`, `backtest_rules`, `checklist_templates`, `checklist_results`): create two test users, verify User A cannot `select`/`update`/`delete` User B's rows via the API, even with a valid but wrong-user JWT. For shared tables (`daily_bars`, `watchlist_snapshots`, `ai_score_history`): verify only service-role can write, any authenticated user can read.

## Data migration verification tests

After running the `data/app.db` → Supabase import script: row counts match between sqlite source and Postgres destination for both `daily_bars` and `trading_journal`; spot-check a sample of rows field-by-field (especially the VERN/SGER journal entries already in the legacy DB as of this writing, as a concrete known-good sample).

## Performance / load considerations

- Cloudflare Workers cold start latency on the API.
- Supabase query latency for `daily_bars` range scans (the Stock Detail history chart's main query).
- Cron job duration for the daily `watchlist_snapshots`/`ai_score_history` generation pass over ~1000 tickers — must fit within Worker execution limits or be chunked.

## Manual / exploratory UI test checklist

- Screener: apply each preset (ARA/BPJS/Momentum), confirm filter thresholds match [05-business-rules.md](05-business-rules.md) §1 exactly.
- Stock Detail: AI Engine tab shows recommendation + confidence + explanation list that matches the API response.
- Watchlist: today's snapshot renders; historical date picker shows a prior day's Top 20.
- Journal: create an open entry (no exit fields), later close it via `PATCH` — confirm result% auto-calculates.
- Backtest: submit a run, confirm it moves `queued → running → done` and results render.
- Checklist: complete a checklist for a ticker, confirm it's retrievable from journal linkage.

## Test environment matrix

| Environment | Purpose |
|---|---|
| Local (Wrangler dev + local Postgres) | Day-to-day development |
| CF Pages preview (per-PR) | Integration/E2E test target |
| Production | Post-cutover only, per [06-migration-plan.md](06-migration-plan.md) Phase C |
