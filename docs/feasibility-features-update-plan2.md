# Analisis Kelayakan: `features_update_plan2.md` terhadap Kode EzySaham

> Dokumen ini menilai proposal redesign UX di `features_update_plan2.md` (pergeseran dari "screener banyak indikator" menjadi "decision engine": Data Freshness Badge, Trading Plan, Position Calculator, Signal Engine, Risk Score, Trigger Checklist, ARA Hunter, Market Regime, Trade Journal) terhadap kode aktual di repo ini. Analisis-only — tidak ada perubahan kode yang menyertai dokumen ini.

## Batasan Arsitektur yang Mempengaruhi Semua Fitur

Empat fakta ini adalah "langit-langit" realistis untuk hampir semua item di proposal:

1. **Tidak ada LLM sama sekali.** Semua teks "AI" (executive summary, buy/avoid reasons, philosophy banner) adalah template string deterministik berbasis skor (`src/domain/analysis/aiStockEngine.ts`, `src/domain/analysis/stockAnalysisEngine.ts`) — bukan panggilan ke GPT/Claude. `package.json` tidak punya dependency LLM apa pun.
2. **Data adalah EOD/scrape tidak resmi, bukan real-time.** Daftar saham dari `pasardana.id` (endpoint tidak resmi, `src/data/external/pasardana.ts`, ISR cache 5 menit) dan OHLCV historis dari Yahoo Finance (endpoint tidak resmi, `src/data/external/yahooFinance.ts`, ISR cache 30 menit, hanya bar harian). Tidak ada websocket, cron job, vendor data berbayar, atau feed intraday.
3. **Tidak ada database.** Supabase (`src/lib/supabase/*`) hanya dipasang untuk Google Auth, dan tombol auth-nya (`AuthButton`) saat ini di-comment-out di `src/presentation/components/layout/AppHeader.tsx` — login pun belum aktif. Semua "state" (watchlist, cache) hidup di `localStorage`/`sessionStorage` browser (`src/data/cache/analysisCache.ts`, `useWatchlist.ts`). `zustand` dan `dexie` terpasang di `package.json` tapi belum dipakai sama sekali di `src`.
4. **Tidak ada data broker/foreign-flow.** Payload `pasardana.id` hanya berisi field price/volume/valuation (Last, Volume, Value, Frequency, PER, PBR, ROE) — tidak ada kolom broker summation atau net foreign buy/sell.

**Implikasi**: fitur yang butuh data intraday, feed real-time, database, atau data broker level dikategorikan "blocked" — bukan soal effort coding, tapi keputusan produk/infra (pilih vendor data, bangun skema DB, aktifkan auth).

## A. Sudah Ada di Kode — Cukup Diaktifkan/Disurfacekan

| Item proposal | Status kode | Lokasi |
|---|---|---|
| Trading Plan (Entry/TP1/TP2/SL/R:R) — #2, #4, #20 | Sudah ada, hanya field AVGD yang belum ada | `buildTradingPlan()` di `stockAnalysisEngine.ts`; `computeTradingPlanScore()` di `src/domain/screener/presets.ts`; UI: `ScenarioCard` di `StockAnalysisPage.tsx` |
| Data Freshness (fresh/aging/stale) — #1, #9, #10 | Logic sudah ada & sudah dipakai untuk gating preset, belum jadi badge yang terlihat user | `src/domain/analysis/dataFreshness.ts`, dipakai di `dayTradingPreset` & `smartMoneyHunterPreset` |
| Distance to Resistance — #17 | Sudah ada | `calcResistanceSpaceScore()` & `computeAraProbability()` di `presets.ts` |
| Candlestick chart + EMA20/50/200 + volume — #21 | Sudah default, bukan line chart kosong seperti di screenshot proposal | `src/presentation/features/analysis/OHLCVChart.tsx` (custom `CandleShape` SVG di atas Recharts) |
| Breakout Hunter — #8 (P1) | Implementasi lengkap tapi tab-nya di-comment-out dari daftar filter yang tampil | `breakoutPreset` + `BreakoutBadge` di `presets.ts`; tab hidden di `ScreenerPage.tsx` (`FILTER_ITEMS`) |
| Smart Money Hunter — #9 (P1) | Sudah jadi tab aktif, tapi murni proxy heuristik OHLCV (RVOL, posisi candle), bukan data broker asli | `calcSmartMoneyScore()` di `presets.ts` |
| Trigger/Reason data mentah — #8, #12 | Data `reasons[]`/`failed[]` per saham sudah dihitung tiap preset, tapi tidak pernah dirender sebagai chip/checklist | `PresetEvaluation` type di `presets.ts`; belum dipakai di `ResultsTable.tsx` |
| Signal 4-state (bukan cuma skor) — #6 | Sudah ada verdict eksplisit (`SANGAT_BELI/BELI/TAHAN/HINDARI`), tapi murni threshold dari skor komposit, belum digerbang oleh kondisi trigger | `AiVerdict` di `src/domain/models/News.ts`, dibentuk di `computeAiStockAdvisor()` |

## B. Effort Rendah — Data/Komputasi Sudah Ada, Tinggal UI atau Fungsi Kecil

- **Data Freshness Badge**: render tier dari `dataFreshness.ts`. Catatan: label harus jujur — "EOD (fresh)/(aging)/STALE", bukan "LIVE", karena tidak ada feed tick real-time.
- **Reason Chips** (#12) & **Trigger checklist "X/6 terpenuhi"** (#8): reshape `reasons[]`/`failed[]` yang sudah dihitung jadi komponen chip/checklist.
- **AVGD di Trading Plan** (#4): tambah satu price level ke `buildTradingPlan()`/`computeTradingPlanScore()`.
- **Re-enable tab Breakout Hunter**: uncomment baris di `FILTER_ITEMS`.
- **Rename "Smart Money" → "Early Accumulation Signal"** (#14, ide dari proposal sendiri): copy-only, karena skornya bukan data broker asli.
- **Risk Score mandiri 0–100 + LOW/MED/HIGH** (#5): `calcDistributionRisk()` sudah ada, tinggal dibungkus jadi skor berlabel yang tampil sejajar skor lain.

## C. Effort Sedang — Logic Baru, Data yang Ada Sudah Cukup

- **Position/Capital Calculator** (#19 P0, #20): modul fungsi murni baru (modal, risk%, entry, SL → jumlah lot), pakai konstanta `LOT_SIZE = 100` yang sudah ada. Input user bisa disimpan di `localStorage` (pola sama seperti `useWatchlist.ts`), tidak perlu DB untuk MVP.
- **Signal Engine dipisah dari Score** (#6): refactor supaya "Setup Score" (kualitas) dan "Decision" (BUY/WAIT/AVOID) berasal dari kondisi trigger eksplisit, bukan satu threshold skor komposit — ini langsung menjawab masalah "Technical 84 tapi bukan berarti BUY" yang diangkat proposal.
- **Distance to ARA** (#16): perlu tabel lookup band auto-reject-atas IDX (15/20/25/35% menurut tier harga, aturan publik) — hanya butuh harga close terakhir yang sudah tersedia. Beda dari "ARA probability" heuristik yang sudah ada.
- **Market Regime IHSG** (#11 P1): histori IHSG EOD sudah difetch (`MarketRepository`/`IhsgChart`), tinggal fungsi klasifikasi (misal posisi vs MA20/50) — tidak butuh data baru, tapi menyambungkannya ke rekomendasi tiap preset menyentuh banyak file skoring.
- **Restrukturisasi "Decision→Why→Trade Plan→Score→Detail accordion"** (#23, #3): reorganisasi UI di `StockAnalysisPage.tsx` yang sudah besar — tidak ada blocker backend.

## D. Effort Tinggi / Terblokir Arsitektur

- **Multi-timeframe M1/M5/M15/H1/D1** (#22 P1): **BLOCKED.** Tidak ada sumber data intraday sama sekali; semua fetch OHLCV harian saja. `presets.ts` sudah punya komentar eksplisit bahwa referensi "H1/H4" di Day Trading preset "disimulasikan dari data daily EOD". Butuh vendor data intraday (kemungkinan berbayar) — keputusan sourcing, bukan sekadar coding.
- **Badge "LIVE" yang benar-benar real-time**: BLOCKED dengan alasan sama — daftar saham dari `pasardana.id` adalah scrape ter-cache 5 menit, bukan tick-by-tick.
- **Smart Money/broker-flow asli** (net foreign buy/sell, "bandarmology") (#14): BLOCKED — tidak ada sumber data level-broker di kode ini.
- **Trade Journal** (#25 P2): Sudah didesain lengkap di `docs/prd-login-google-watchlist-jurnal.md` dan `docs/stockpilot/03-database-schema.md`, tapi **nol kode ada**, dan tombol Google-login pun sedang di-comment-out. Butuh: mengaktifkan kembali auth, membuat tabel Supabase + RLS (belum ada satu pun tabel), dan CRUD UI. **Item terbesar di seluruh proposal** — proyek multi-hari sendiri, bukan quick add.

## Kesimpulan

Sekitar **60% dari proposal** adalah layer keterbacaan (UI) di atas komputasi yang *sudah* dilakukan aplikasi (skor, reasons, trading plan, distance to resistance, data freshness) — kelayakan tinggi, effort rendah-sedang. Logika backend yang genuinely baru (position calculator, risk score mandiri, market regime, band ARA) berdiri sendiri dan tidak butuh data/infra baru — effort sedang, feasible. Tiga item yang benar-benar terblokir (timeframe intraday, data broker asli, trade journal ter-persist) semuanya butuh keputusan infra (vendor data berbayar, atau membangun database + auth) sebelum bisa dikerjakan sebagai coding task.

### Rekomendasi urutan jika akan dieksekusi

1. **Quick wins (kategori A + B)** — semuanya surfacing dari data yang sudah dihitung; bisa dikerjakan dalam satu sesi per item.
2. **Effort sedang (kategori C)** — logic baru tapi self-contained, tidak menyentuh infra.
3. **Butuh keputusan dulu (kategori D)** — jangan mulai coding sebelum memutuskan: (a) apakah mau beli data intraday, dan (b) apakah mau mengaktifkan auth + membangun skema DB untuk trade journal.
