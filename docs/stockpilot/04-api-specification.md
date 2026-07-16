# StockPilot — API Specification (HonoJS)

## Conventions

- Base URL: `/api` (Cloudflare Worker).
- Auth: `Authorization: Bearer <supabase-jwt>` on every user-owned-data route; public routes (stocks/history/ai-engine/watchlist-snapshots) still require *authenticated* (any logged-in user), per the RLS policy in [03-database-schema.md](03-database-schema.md).
- Error envelope (all endpoints): `{ "ok": false, "error": { "code": string, "message": string } }`. Success: `{ "ok": true, "data": ... }` — a change from the legacy shape (`{ ok, entries }` / `{ ok, entry }` in `server/tradeJournalRoutes.js`), standardized here to one envelope for every route.
- Pagination: `?page=&pageSize=` on list endpoints, response includes `{ data: [...], page, pageSize, total }`.

## Auth

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/signup` | Supabase-delegated; creates `profiles` row via trigger |
| POST | `/auth/login` | Returns session/JWT |
| POST | `/auth/logout` | Clears session |
| GET | `/auth/session` | Current user + profile |

## Stocks

| Method | Path | Legacy analog | Notes |
|---|---|---|---|
| GET | `/stocks` | `StockRepository.getStocks()` → `/api/stocks` (PasarDana proxy) | Full ~1000-ticker summary list |
| GET | `/stocks/:ticker` | `StockRepository.getStockById()` | Single stock summary |
| GET | `/stocks/:ticker/history?range=` | `HistoryRepository.fetchStockHistory()` → `server/historyRoutes.js` | OHLCV bars, served from `daily_bars` cache |

## AI / Trade Engine

| Method | Path | Response shape | Legacy analog |
|---|---|---|---|
| GET | `/stocks/:ticker/watchlist?asOfDate=` | `WatchlistOutput` (`src/domain/models/Watchlist.ts`) | `computeWatchlistOutput` (was in-browser only) |
| GET | `/stocks/:ticker/ai-engine` | `AiEngineOutput` (`src/domain/models/AiEngine.ts`) | `computeAiEngineOutput` (was in-browser only) |
| GET | `/stocks/:ticker/trade-engine` | `TradeEngineOutput` (`src/domain/models/TradeEngine.ts`) | `computeTradeEngineOutput` (was in-browser only) |

## Watchlist

| Method | Path | Notes |
|---|---|---|
| GET | `/watchlist` | User's personal tracked tickers |
| POST | `/watchlist` | Add ticker + note |
| PATCH | `/watchlist/:id` | Update note/priority/active |
| DELETE | `/watchlist/:id` | Remove |
| GET | `/watchlist/snapshots/latest` | Today's After-Market AI Top 20/10/5 |
| GET | `/watchlist/snapshots?date=` | Historical snapshot for a given date |
| POST | `/watchlist/snapshots/generate` | Admin/Cron-triggered only (service role) — runs `computeWatchlistOutput` over all tickers, persists |

## Trading Journal

| Method | Path | Legacy analog | Notes |
|---|---|---|---|
| GET | `/journal` | `GET /api/journal` (`server/tradeJournalRoutes.js`) | Direct port |
| POST | `/journal` | `POST /api/journal` | Direct port — same field set as `TradeJournalEntry` |
| PATCH | `/journal/:id` | **none in legacy** | New — supports closing an open position (set `exit_date`/`exit_price`/`exit_reason`/`result_pct`) without re-submitting the whole row |

## Backtest

| Method | Path | Notes |
|---|---|---|
| POST | `/backtest/run` | Enqueues a job (`backtest_runs.status = 'queued'`), returns run id immediately — async, not synchronous (Workers CPU-time limit) |
| GET | `/backtest/:id` | Run status + summary + `backtest_rules` breakdown once done |
| GET | `/backtest` | List user's runs |

## Checklist

| Method | Path | Notes |
|---|---|---|
| GET | `/checklist/templates` | Own + shared-default templates |
| POST | `/checklist/templates` | Create custom template |
| POST | `/checklist/results` | Submit a completed checklist (optionally linked to a `trade_journal_id`) |
| GET | `/checklist/results?ticker=` | History for a ticker |

## Rate limits / caching

- `/stocks`, `/stocks/:ticker/history` — backed by `daily_bars` cache; a fresh external fetch (PasarDana/Yahoo) only happens from the Cron job, not per-request, so these routes never rate-limit against the upstream provider under normal use.
- `/backtest/run` — rate-limited per user (e.g. N concurrent queued runs) since each run is a real compute job.
