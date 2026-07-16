# StockPilot — Roadmap, Development Tasks, Sprint Planning

## Phasing overview

| Phase | Sprints | Goal | Exit criteria |
|---|---|---|---|
| Foundations | 0 | Scaffold everything | CI green, empty app deploys to CF Pages/Workers |
| Core port | 1-2 | Domain engine + data layer live | Score-parity tests pass against legacy fixtures |
| Core UX | 3-4 | Auth, Screener, Stock Detail | A user can sign up and browse real scored stocks |
| Persistence gaps | 5-6 | Watchlist snapshots, Journal | Daily AI ranking persists; journal open→close flow works |
| New features | 7-8 | Backtest, Checklist | Both net-new features usable end-to-end |
| Cutover | 9-10 | Polish, parity re-check, cutover | Legacy decommissioned per [06-migration-plan.md](06-migration-plan.md) |

## Sprint 0 — Foundations
- Monorepo scaffold (`apps/web`, `apps/api`, `packages/domain`, `packages/shared-types`)
- Cloudflare Pages + Workers project wiring, `wrangler.toml`
- Supabase project creation, Auth enabled, initial empty migration
- CI skeleton (typecheck, lint, test on push)
- Shadcn UI + Tailwind base theme installed

## Sprint 1 — Domain Engine Port
- Copy `src/domain/engine/*`, `indicators.ts`, `patterns/candlestick.ts`, `models/*` into `packages/domain`, adjust imports only
- Port existing `.test.ts` suites, confirm green
- Build score-parity fixture tests: capture `WatchlistOutput`/`AiEngineOutput`/`TradeEngineOutput` for a fixed ticker+date sample from legacy, assert new package matches

## Sprint 2 — Data Layer
- Write Supabase SQL migrations for all tables in [03-database-schema.md](03-database-schema.md)
- Write and dry-run the `data/app.db` → Supabase import script ([06-migration-plan.md](06-migration-plan.md))
- Hono `/api/stocks`, `/api/stocks/:ticker`, `/api/stocks/:ticker/history` (PasarDana/Yahoo proxies, backed by `daily_bars`)

## Sprint 3 — Auth + Core Screener
- Supabase Auth wiring (signup/login/logout/session), `profiles` trigger
- RLS policies live and tested for every table
- Screener page rebuilt on Tanstack Query against the new API; ARA/BPJS/Momentum presets implemented per [05-business-rules.md](05-business-rules.md) §1
- Confirm `scoringEngine.ts` fields are gone from the UI entirely (no `swingScore`/`scalpingScore`/legacy `recommendation` anywhere)

## Sprint 4 — Stock Detail + Engines
- `/api/stocks/:ticker/watchlist`, `/ai-engine`, `/trade-engine` endpoints
- Stock Detail page wired to all three, replacing `AiEngineTab.tsx`/`TradeEngineCard.tsx`/`AfterCloseScoreTab.tsx`

## Sprint 5 — After-Market Watchlist Persistence
- Cron Worker: EOD `daily_bars` refresh → generate `watchlist_snapshots` + `ai_score_history` for all tickers
- Watchlist page: today's Top 20/10/5 + historical snapshot browsing (closes the "computed live, never stored" gap)

## Sprint 6 — Trading Journal
- Port `tradeJournalRoutes.js` contract (`GET`/`POST /journal`) 1:1
- **New**: `PATCH /journal/:id` — close/update an open position (legacy has insert-only, no update path)
- Auto watchlist-score-at-entry behavior (truncate bars to entry date) ported from the current `TradeJournalTab.tsx` implementation

## Sprint 7 — Backtest
- `backtest_runs`/`backtest_rules` tables, async job execution (queue consumer, not inline Worker request)
- Results page; methodology informed by `scripts/backtest-momentum-score.ts` and `docs/momentum-score-backtest-report.md`

## Sprint 8 — Checklist
- `checklist_templates`/`checklist_results`, default system templates seeded
- Checklist page, optional link from a Journal entry

## Sprint 9 — Polish & Parity Re-check
- Re-run Phase B score-parity verification against latest legacy state
- UX polish per `docs/screener-redesign-spec.md` (progressive disclosure, "5 questions" framing) and `DESIGN.md` (mobile-first, dark mode, accessibility)
- Performance pass (CF cold starts, Supabase query latency)

## Sprint 10 — Cutover
- Execute Phase C/D of [06-migration-plan.md](06-migration-plan.md): cut traffic, grace window, decommission

## Definition of Done (every sprint)

- All new code has unit tests; domain-engine changes have parity tests.
- Deployed to a Cloudflare Pages/Workers preview environment.
- Relevant checklist items in [09-acceptance-criteria.md](09-acceptance-criteria.md) satisfied.

## Dependency notes

Sprint 5 depends on Sprints 1+2 (needs the ported engine and the data layer). Sprint 6's `PATCH` flow depends on Sprint 2's schema. Sprint 9's parity re-check depends on everything before it being feature-complete.
