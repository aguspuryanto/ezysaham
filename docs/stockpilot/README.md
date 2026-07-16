# StockPilot Documentation Suite

This folder is the complete planning documentation for **StockPilot** — a full rewrite of the `saham-screener` app on a new stack (React 19 + Tanstack Query + React Router + Shadcn UI + Framer Motion, HonoJS, Supabase Postgres + Auth, Cloudflare Pages + Workers). **No code has been generated yet** — this is the blueprint.

## Read this first

1. StockPilot is a **Decision Support System**, not a price-prediction AI — it ranks stocks by rule-based, backtestable probability of a trading setup succeeding, never by claiming future prices.
2. It **replaces** `saham-screener` entirely (Strangler Fig cutover — see [06-migration-plan.md](06-migration-plan.md)), it does not run alongside it long-term.
3. The current app's `src/domain/engine/*` (Watchlist/AI/Trade engines) and `src/domain/indicators.ts` are pure, framework-free TypeScript — they port almost unchanged and are the most valuable asset in this rewrite. See [05-business-rules.md](05-business-rules.md) for the exact transcribed formulas.
4. `src/utils/scoringEngine.ts` — a second, materially different scoring heuristic that currently drives the main Screener tab — is being **retired**, not ported. It disagreed with the engine above on almost every stock.
5. Four features have **no persistence today** and are net-new in StockPilot: After-Market AI daily snapshots, backtest results, checklist templates, and multi-user auth (the legacy app has none of these).

## Doc index

| File | Purpose | Status |
|---|---|---|
| [01-prd.md](01-prd.md) | Product Requirements Document | Draft |
| [02-architecture.md](02-architecture.md) | System architecture, frontend pages, backend services, folder structure | Draft |
| [03-database-schema.md](03-database-schema.md) | Supabase Postgres schema, ERD, RLS | Draft |
| [04-api-specification.md](04-api-specification.md) | Hono API contract | Draft |
| [05-business-rules.md](05-business-rules.md) | Screener rules, trading formulas, AI scoring formulas (transcribed from code) | Draft |
| [06-migration-plan.md](06-migration-plan.md) | Cutover strategy, code/data migration | Draft |
| [07-roadmap.md](07-roadmap.md) | Roadmap, sprint plan, dev tasks | Draft |
| [08-testing-plan.md](08-testing-plan.md) | Test strategy incl. engine parity tests | Draft |
| [09-acceptance-criteria.md](09-acceptance-criteria.md) | Per-feature sign-off criteria | Draft |
| [10-glossary-decisions.md](10-glossary-decisions.md) | Glossary + Architecture Decision Records | Draft |

## Retained legacy prior art (still valid, not superseded)

- [`aistock.md`](../../aistock.md) — the original design spec that led to the current `domain/engine/*` system. Primary source for [05-business-rules.md](05-business-rules.md).
- [`docs/screener-redesign-spec.md`](../screener-redesign-spec.md) — UX redesign rationale, still informs StockPilot's frontend.
- [`docs/momentum-score-backtest-report.md`](../momentum-score-backtest-report.md) — real backtest results and a "Momentum Score v2.0" recommendation, feeds the v2 backlog.
- [`DESIGN.md`](../../DESIGN.md) — the Screener redesign brief (Apple/TradingView-inspired UX principles).

## Terminology

- **StockPilot** — the product being planned in this suite.
- **saham-screener** — the legacy codebase being replaced (this repo, as it exists today).

## Changelog

| Date | Summary |
|---|---|
| 2026-07-15 | Initial documentation suite created; Electron packaging and unused Google AI Studio scaffold removed from `saham-screener` as part of the same pass. |
