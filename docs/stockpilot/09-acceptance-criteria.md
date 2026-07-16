# StockPilot — Acceptance Criteria

Per-feature sign-off checklists — business-facing pass/fail statements a reviewer can verify without reading code. See [08-testing-plan.md](08-testing-plan.md) for the engineering method used to verify these.

## Auth
- [ ] User can sign up, log in, log out; session persists across page reload.
- [ ] A `profiles` row is created automatically on signup.
- [ ] User A's session token cannot read or write User B's `watchlist`/`trading_journal`/`backtest_runs`/`checklist_*` rows (verified via RLS test, not just UI hiding).

## Screener
- [ ] ARA/BPJS/Momentum presets filter exactly per the thresholds in [05-business-rules.md](05-business-rules.md) §1 — no silent threshold drift.
- [ ] Filter/sort results match the `domain/engine` output exactly (parity-tested).
- [ ] No reference to any retired `scoringEngine.ts` field (`swingScore`, `scalpingScore`, legacy `recommendation`/`strategy`/`dcf`/`consensus`) anywhere in the UI.

## Stock Detail / AI Engine / Trade Engine
- [ ] Recommendation, confidence, and both probability sets render and exactly match the `/ai-engine` API contract.
- [ ] Trade Engine grade/decision/gates render and match `/trade-engine`.
- [ ] Explanation list is present and non-empty for every stock with sufficient bar data.

## Watchlist
- [ ] Daily `watchlist_snapshots` generated on schedule with zero missed trading days over a 2-week observation window.
- [ ] Tier thresholds (ELITE≥90/VERY_GOOD≥80/WORTH_WATCHING≥70) match [05-business-rules.md](05-business-rules.md) §2 exactly.
- [ ] Historical snapshots are browsable by date.

## Trading Journal
- [ ] User can create an open position entry (ticker, entry date/price, SL, TP) without exit data.
- [ ] User can later close it via `PATCH /journal/:id`, supplying exit date/price/reason; `result_pct` auto-computes.
- [ ] Watchlist score/tier at entry is auto-computed from bars truncated to the entry date (matches the behavior already validated in the legacy `TradeJournalTab.tsx`).
- [ ] All rows migrated from `data/app.db` are present and field-correct (see Migration below).

## Backtest
- [ ] A submitted run reaches `done` status and produces a `summary` (win rate, avg return, max drawdown, profit factor, expectancy, sample size).
- [ ] Methodology is consistent with `docs/momentum-score-backtest-report.md` where the same rules are used.

## Checklist
- [ ] Default system templates are available to every user without creation.
- [ ] User can create a custom template and submit results, optionally linked to a journal entry.

## Migration completeness
- [ ] 100% of legacy `trade_journal` rows present in `trading_journal` with correct values (row-count + spot-check, per [08-testing-plan.md](08-testing-plan.md)).
- [ ] 100% of legacy `daily_bars` rows present in the new `daily_bars` table.
- [ ] Phase B score-parity check (per [06-migration-plan.md](06-migration-plan.md)) passed and recorded before cutover.

## Non-functional
- [ ] Mobile-responsive (per `DESIGN.md` mobile-first principle).
- [ ] Dark mode supported.
- [ ] Basic accessibility pass (keyboard nav, contrast) per `DESIGN.md` §17.
- [ ] Screener + Stock Detail pages load within the budget defined in [02-architecture.md](02-architecture.md).
