# StockPilot — Glossary & Architecture Decision Records

## Glossary

| Term | Meaning |
|---|---|
| EOD | End of Day — the only data cadence StockPilot uses (no realtime/tick/orderbook) |
| RVOL | Relative Volume — today's volume vs. its recent average |
| Smart Money (proxy) | Estimated accumulation/distribution inferred from RVOL + close-position + Higher Low patterns; **not** real broker/foreign-flow data, which this codebase has never had access to |
| ARA | Auto Reject Atas — IDX's daily upper price-limit; the "ARA Screener" looks for stocks approaching/hitting it with strong volume |
| BPJS-style screen | Informal trader shorthand (from the source PRD) for a breakout-on-volume filter preset, named after a specific historical trade example, not a literal reference to the insurance agency |
| ELITE / VERY_GOOD / WORTH_WATCHING / NO_TRADE | Watchlist Engine tier names, score ≥90/≥80/≥70/<70 respectively |
| BUY / WATCHLIST / WAIT / AVOID | AI Engine recommendation labels |
| A+ / A / B / C / D / NO_TRADE | Trade Engine setup grades |
| Strangler Fig | Migration pattern: build the new system alongside the old, incrementally verify parity, cut over, then remove the old — chosen over big-bang or indefinite parallel-run (see ADR-001) |

## ADR-001: Strangler Fig cutover strategy

**Context:** Full rewrite on an entirely different stack (Express/sqlite → Hono/Supabase). Single current user, no external consumers.
**Decision:** Build StockPilot standalone, import historical data, verify score parity against legacy, brief side-by-side verification window, then cut over and decommission legacy.
**Consequences:** Slower than big-bang, but the AI scoring engine is the product's core value — a silent regression there is worse than a few extra weeks of migration work. Indefinite parallel-run was rejected as unnecessary double-maintenance for a single-user app.

## ADR-002: Retire `scoringEngine.ts`, unify on `domain/engine/*`

**Context:** Two scoring systems exist in `saham-screener` today — `scoringEngine.ts` (summary-% based, drives the main Screener tab) and `domain/engine/*` (OHLCV-based, drives the AI/Watchlist tabs) — and they disagree on real tickers.
**Decision:** StockPilot ports only `domain/engine/*`. `scoringEngine.ts` is documented (§6 of [05-business-rules.md](05-business-rules.md)) for historical record but not carried forward.
**Consequences:** Removes a real, confirmed UX inconsistency (two different "recommendation" values shown on different tabs for the same stock). Some screener behaviors the legacy Screener tab relied on (sort by `swingScore`, filter by `dcf.status`) must be re-derived from the OHLCV-based engine's output instead.

## ADR-003: Fold `history_fetch_log` into `daily_bars`

**Context:** Legacy sqlite has a separate `history_fetch_log` table purely to track per-ticker fetch freshness (`last_fetched_at`, `last_status`, `bar_count`, `last_error`).
**Decision:** Fold these columns directly onto the `daily_bars` row instead of keeping a second table.
**Consequences:** Simplifies "is this ticker's data fresh" to one row lookup instead of a join; loses per-fetch history (only the latest fetch's metadata is kept), which is acceptable since the legacy table was never used for historical fetch analysis either.

## ADR-004: Keep the domain layer framework-free

**Context:** `src/domain/engine/*` and `src/domain/indicators.ts` have zero Supabase/Hono/React imports today.
**Decision:** `packages/domain` in StockPilot preserves this property strictly — no framework imports allowed in this package, enforced by lint rule or CI check.
**Consequences:** Keeps the engine portable (could run in a Worker, a Node script, a test, or even a future mobile app) and testable in isolation; any code needing Supabase/React must live in `apps/api` or `apps/web`, calling into `packages/domain` as a pure function library.

## ADR-005: Backtest runs as async/queued jobs, not synchronous requests

**Context:** Cloudflare Workers have CPU-time limits per request; a multi-year backtest over hundreds of tickers cannot complete within a single synchronous request.
**Decision:** `POST /backtest/run` enqueues a job and returns immediately; a separate queue consumer (Cloudflare Queues or equivalent) performs the actual computation and updates `backtest_runs.status`.
**Consequences:** Requires a small amount of job-orchestration infrastructure that doesn't exist in the legacy app (which only ever ran ad hoc backtest scripts locally), but is necessary to make backtesting a first-class, user-facing, always-available feature rather than a developer-only script.
