# StockPilot — Product Requirements Document

## Executive Summary

StockPilot is an AI-assisted Decision Support System for Indonesian Stock Exchange (IDX) retail traders. It is **not** a price-prediction engine. It scans the market after close, ranks stocks by a transparent, rule-based probability of a trading setup succeeding, and walks a beginner through a checklist-driven entry/exit process — reducing FOMO and emotional overtrading. Every score and recommendation is explainable and backtestable.

## Problem Statement

After roughly a year of live IDX trading, the recurring loss patterns were: FOMO-buying stocks already extended, entering late, trading without a watchlist, watching too many charts at once, and having no consistent SOP. The recurring wins came from: disciplined screener-driven picks (ARA/BPJS-style filters), momentum-confirmed entries, and disciplined cut-loss. The current `saham-screener` app already encodes much of this — but its main Screener tab is driven by a cruder heuristic (`scoringEngine.ts`) that disagrees with its own, more rigorous OHLCV-based engine (`domain/engine/*`) shown on a separate tab, confusing rather than guiding the user. StockPilot consolidates around one consistent, rigorous scoring system and adds the persistence, auth, and structured workflow (checklist, journal, backtest) the legacy app never had.

## Goals

- Help a beginner find a potential stock in under 10 minutes a day.
- Reduce FOMO and overtrading via an explicit anti-FOMO/checklist gate before every entry.
- Make every recommendation explainable (positive signals, negative signals, risk factors, confidence) and backtestable against historical data.
- Persist history (daily rankings, AI scores, trades, checklist results) so performance can be measured and scoring can be improved over time.

## Non-Goals

- **Not** a future-price prediction system. No claims like "this stock will hit X."
- **Not** using real-time tick data, order book, or broker summary feeds in v1 — only End-of-Day (EOD) data, consistent with `aistock.md`'s original constraint ("Tidak ada data realtime. Tidak ada broker summary. Tidak ada orderbook. Tidak ada tick.").
- **Not** an auto-trading system — v1-v4 never place orders; v5's "Auto Trading Signal" is explicitly a notification, not an auto-buy (per the source PRD).

## Target Users / Personas

- **Beginner investor** — can't read a chart yet, doesn't understand PER/PBV/EPS, just wants to know "which stock is good?"
- **Scalping trader** — target 2-5% profit, holds ~1 day.
- **Swing trader** — target 5-15% profit, holds 2-10 days.

## Core Features (v1/v2) and their legacy analog

| StockPilot feature | Legacy analog in saham-screener |
|---|---|
| Dashboard (IHSG, gainers/losers, breadth, sector, sentiment) | Not built yet — new |
| Screener (ARA / BPJS / Momentum presets) | Partially exists as ad hoc filters in `ScreenerPage.tsx`; ARA/BPJS thresholds are not yet coded as named presets — net-new filter logic, same threshold values as the source PRD (see [05-business-rules.md](05-business-rules.md)) |
| Stock Detail page | `StockDetailPage.tsx` — rebuilt on `domain/engine/*` output only, dropping `scoringEngine.ts` fields |
| Trading Checklist | No equivalent — net-new, backed by `checklist_templates`/`checklist_results` |
| After-Market AI Watchlist (persisted daily Top 20/10/5) | `WatchlistAiTab.tsx` / `watchlistEngine.ts` — computed live in-browser today, **never stored**; StockPilot persists it (`watchlist_snapshots`) |
| AI Scoring Engine / Decision Engine (BUY/WATCHLIST/WAIT/AVOID) | `AiEngineTab.tsx` / `aiEngine.ts` — ported near-unchanged |
| Trading Journal | `TradeJournalTab.tsx` / `server/tradeJournalRoutes.js` (sqlite) — ported to Supabase, adds a proper close/update flow (legacy has insert-only) |
| Backtest Engine | Ad hoc `scripts/backtest-momentum-score.ts` — becomes a first-class, persisted, user-triggerable feature |
| User Profile / Auth | None — net-new (Supabase Auth) |

## What we are retiring, and why

- **`src/utils/scoringEngine.ts`** — computes `swingScore`/`scalpingScore`/`recommendation` from only summary return-percentage fields (OneDay/OneWeek/OneMonth/PER/PBV/ROE), not real OHLCV bars. It drives today's main Screener tab in parallel with, and inconsistent with, the far more rigorous `domain/engine/*` (which only powers the separate AI/Watchlist tabs). StockPilot unifies on one engine.
- **Electron desktop packaging** — StockPilot targets Cloudflare Pages/Workers only; no desktop app.
- **Dual Express + Vercel-serverless routing** — collapses into a single HonoJS API on Cloudflare Workers.
- **Google AI Studio scaffold** (`@google/genai`, `GEMINI_API_KEY`) — unused leftover, dropped.

## Success Metrics

- Screener + Stock Detail page load in under the CF Pages/Workers cold-start-adjusted budget defined in [02-architecture.md](02-architecture.md).
- Daily After-Market AI snapshot generated reliably (Worker Cron) with zero missed trading days.
- Backtest job turnaround time acceptable for interactive use (see [02-architecture.md](02-architecture.md) async job design).
- Journal entry completion rate — user actually logs trades (this was already validated as a real, used feature in the legacy app).

## Constraints & Assumptions

- EOD data only; no realtime/orderbook/broker-summary feeds exist or are assumed (per `aistock.md`).
- Cloudflare Workers CPU-time limits constrain synchronous computation — backtests must be async jobs, not inline requests (see [02-architecture.md](02-architecture.md), ADR-005 in [10-glossary-decisions.md](10-glossary-decisions.md)).
- Supabase RLS must isolate every user's journal/watchlist/backtest data — a new concern, since the legacy app has no auth at all.

## Out of Scope for v1

- Real-time data, broker/order-book integration, mobile app (all listed as v3+/future in the source roadmap — see [07-roadmap.md](07-roadmap.md)).
- Machine-learning-fitted probability model (the source PRD's "Self Learning" concept, `aistock.md` lines 585-604) — v1/v2 use the rule-based heuristic already implemented; ML-fitted probabilities are a v2+ backlog item tied to `docs/momentum-score-backtest-report.md`'s "Momentum Score v2.0" recommendation.
