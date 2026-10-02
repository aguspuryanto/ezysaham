# TradingView Technical Analysis (getTA) — kajian, tanpa koding

## Context
User ingin tahu apakah `Mathieu2301/TradingView-API` bisa dipakai untuk "Get TradingView's technical analysis" (rating Buy/Sell TradingView) di ezysaham. Diminta riset saja, belum koding.

## Temuan
- **Ya, bisa.** Fitur ini tercantum di README: "Get TradingView's technical analysis". Fungsinya `getTA(id)` di `src/miscRequests.js`.
- **Cara kerja:** `getTA` tidak memakai websocket dan tidak perlu login. Fungsi ini hanya mengirim satu POST ke endpoint publik (tapi tidak resmi) `https://scanner.tradingview.com/global/scan` dengan:
  - `symbols.tickers: ['IDX:BBCA']`, format `EXCHANGE:SYMBOL` (untuk IDX: `IDX:<kode>`)
  - `columns`: `Recommend.All`, `Recommend.MA`, `Recommend.Other` untuk timeframe `1, 5, 15, 60, 240, 1D, 1W, 1M` (contoh kolom: `Recommend.All|60`)
- **Output:** `{ '1': {All, MA, Other}, '5': {...}, …, '1D': {...}, '1W': {...}, '1M': {...} }`.
  - Nilai mentah TradingView berkisar −1..+1. Library mengalikannya ×2 (`Math.round(val*1000)/500`), jadi rentangnya menjadi −2..+2.
  - Arti tiap kunci: **All** = rating ringkasan, **MA** = moving averages, **Other** = oscillators.
- **Ambang label (nilai mentah −1..1):**

  | Nilai | Label |
  |---|---|
  | ≥ 0.5 | Strong Buy |
  | 0.1 … 0.5 | Buy |
  | −0.1 … 0.1 | Neutral |
  | −0.5 … −0.1 | Sell |
  | ≤ −0.5 | Strong Sell |

- **Paket:** `@mathieuc/tradingview` v3.5.2, lisensi ISC, Node ≥ 14. Dependensinya `axios`, `ws`, `jszip`. Repo aktif dan tidak di-archive (~5.4k stars).

## Risiko / catatan
1. **Tidak resmi.** Ini reverse-engineering. Endpoint bisa berubah atau diblokir sewaktu-waktu, dan bisa bertentangan dengan ToS TradingView. Perlakukan sebagai data tambahan "best effort", sama seperti Yahoo saat ini (`src/data/external/yahooFinance.ts`).
2. **Harus di server.** Panggil dari Next API route, bukan dari browser, karena CORS dan rate limit.
3. **Library tidak wajib.** Untuk `getTA` saja, cukup satu `fetch` POST ke endpoint scanner. Dependensi `ws`, `axios`, dan `jszip` tidak perlu dan bisa memberatkan bundle server.
4. **Data delay.** Data IDX di TradingView tanpa login biasanya tertunda.
5. **Konsistensi.** Rating TradingView dihitung dari puluhan indikator mereka sendiri. Hasilnya bisa berbeda dengan engine kita (`tradingModesReview.ts`, `stockAnalysisEngine`). Tampilkan sebagai **"Rating TradingView (pihak ketiga)"** yang terpisah, jangan dicampur ke keputusan BUY/WAIT kita.

## Rekomendasi integrasi (jika nanti mau dikoding)
- `src/data/external/tradingViewTA.ts`: `fetchTradingViewTA(code)` melakukan POST ke scanner dengan ticker `IDX:${code}`. Fungsi ini mengubah hasil ke model domain (nilai mentah −1..1 + label). Kalau gagal, kembalikan `{ ok:false }`, jangan throw. Polanya sama dengan `src/data/external/yahooIntraday.ts`.
- `src/domain/models/TradingViewTA.ts`: tipe `{ timeframe, all, ma, oscillators, label }[]`.
- `src/app/api/stocks/[code]/tradingview-ta/route.ts`: cache 60–300 detik. Polanya sama dengan route `intraday`.
- `StockRepository.getStockTradingViewTA()` + panel kecil di ScreenerDetailPage, mis. tab Teknikal di `components/TabPanels.tsx` atau di dekat `TechnicalSummary`. Isinya gauge/badge per timeframe (15m, 1H, 4H, 1D, 1W) dengan disclaimer "data pihak ketiga, tidak resmi".

## Verifikasi (saat implementasi)
- `curl -X POST https://scanner.tradingview.com/global/scan` dengan `{"symbols":{"tickers":["IDX:BBCA"]},"columns":["Recommend.All","Recommend.MA","Recommend.Other"]}` untuk memastikan ticker IDX mengembalikan data.
- `GET /api/stocks/BBCA/tradingview-ta` mengembalikan JSON yang benar. Ticker yang tidak ada mengembalikan `ok:false`.
- Lakukan `npx tsc --noEmit` dan eslint pada file baru, lalu cek panel di `/screener/BBCA`.
