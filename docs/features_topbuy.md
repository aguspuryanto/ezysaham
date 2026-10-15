# Top BUY — Penyaringan Saham dari Data Aktual

Tanggal data: **14 Oktober 2026** · Dijalankan: 15 Oktober 2026

Tujuan: memilih saham BUY yang tidak sekadar naik tinggi dalam satu hari, hanya dengan data aktual (tanpa angka karangan).

> Hasil penyaringan algoritmik, bukan rekomendasi investasi.

## Sumber Data

| Data | Sumber | Kode di aplikasi |
|---|---|---|
| Daftar saham, % 1D/1W, nilai transaksi, PER, PBV, ROE, free float, `LastDate` | Pasardana `StockSearchResult/GetAll` | [pasardana.ts](../src/data/external/pasardana.ts) → `mapToStockSummary` |
| OHLCV harian (6 bulan) | Yahoo Finance `v8/finance/chart/{KODE}.JK?interval=1d` | [yahooFinance.ts](../src/data/external/yahooFinance.ts) → `fetchYahooDailyBars` |
| Fundamental | Yahoo Finance | [yahooFundamentals.ts](../src/data/external/yahooFundamentals.ts) → `fetchYahooFundamentals` |
| Verdict BUY / WAIT / AVOID | Decision Engine v3 | [signalFromDecision.ts](../src/domain/analysis/signalFromDecision.ts) → `buildSignalFromDecision` |

## Tahap 1 — Kriteria Awal (data Pasardana)

| Kriteria | Field Pasardana | Sisa saham |
|---|---|---|
| Semua emiten (`Code` ada, `Last > 0`) | — | 978 |
| Data bertanggal 14 Oktober 2026 | `LastDate` | 963 |
| Perubahan harian & mingguan positif | `OneDay > 0`, `OneWeek > 0` | 105 |
| Nilai transaksi harian ≥ Rp1 miliar | `Value ≥ 1e9` | 63 |
| PER positif, maks 30x | `0 < Per ≤ 30` | 36 |
| PBV positif, maks 3x | `0 < Pbr ≤ 3` | 29 |
| ROE positif & free float ≥ 10% | `Roe > 0`, `FreeFloatPct ≥ 10` | **25** |

Ke-25 kandidat: SICO, MAPI, CBDK, NRCA, MEDC, PEVE, ACES, AALI, PRDA, MYOR, ELSA, PWON, SMRA, GPRA, BTPS, BBCA, ABMM, BSDE, CTRA, AMRT, ASII, CPIN, INTP, ULTJ, TOWR.

Validasi silang: untuk ke-25 saham, close dan % 1D pada bar Yahoo 14 Oktober 2026 sama persis dengan `Last` dan `OneDay` dari Pasardana.

## Tahap 2 — Decision Engine v3

Setiap kandidat dinilai dengan `buildSignalFromDecision` (fungsi yang sama dengan halaman `/signal`), dengan input:

- `bars`: OHLCV Yahoo 6 bulan, dipotong sampai 14 Oktober 2026 (123 bar).
- `summary`: hasil `mapToStockSummary`, dengan `lastClose`, `prevClose` dan `percentChange1D` disinkronkan dari 2 bar terakhir (sama seperti `syncSummary` di [SignalRepository.ts](../src/data/repositories/SignalRepository.ts)).
- `fundamentals`: `fetchYahooFundamentals` (tersedia untuk semua 25 saham).
- `vwap`: `null` (tanggal lampau, tidak ada sesi intraday).

Hasil: **1 BUY, 13 WAIT, 11 AVOID.** Daftar 10 Top BUY tidak bisa dibuat tanpa mengarang data.

### BUY

| Kode | Harga | 1D | 1W | Nilai transaksi | PER | PBV | ROE | FF | Skor SARA | Area entry | TP1 / TP2 | SL | R:R |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **PWON** | 288 | +3,60% | +6,67% | Rp26,84 M | 6,26 | 0,52 | 7,48% | 30,89% | 71 | 284–292 | 326 / 440 | 274 | 1:2,6 |

Semua aturan trading terpenuhi (100%). Risiko yang dicatat mesin: ada tanda spekulasi (hot money sedang) dan fundamental lemah, sehingga ambil untung bertahap.

### WAIT (watchlist, belum BUY)

Diurutkan berdasarkan persentase aturan trading yang terpenuhi, lalu Skor SARA.

| Kode | Harga | 1D | Aturan terpenuhi | Skor SARA | Aturan gagal | Pemicu BUY (dari mesin) |
|---|---|---|---|---|---|---|
| MEDC | 1545 | +6,55% | 90% | 71 | Setup entry | Turun ke 1.440–1.475 lalu muncul candle hijau |
| AALI | 8650 | +5,49% | 80% | 67 | Setup entry, R:R | Turun ke 8.175–8.450, atau breakout 8.725 dengan transaksi ramai |
| PEVE | 374 | +5,65% | 70% | 70 | Momentum, setup, R:R | Turun ke 338–360 (overextended 9,7% di atas EMA20) |
| MAPI | 1565 | +8,68% | 70% | 67 | Setup, MACD, R:R | Turun ke 1.485–1.525, atau breakout 1.570 |
| INTP | 5250 | +0,96% | 70% | 57 | Trend, setup, R:R | Bertahan di atas 5.100, atau breakout 5.350 |
| BTPS | 1020 | +3,03% | 70% | 56 | Trend, setup, R:R | Bertahan di atas 975, atau breakout 1.030 |
| ABMM | 2750 | +1,85% | 70% | 54 | Trend, setup, R:R | Bertahan di atas 2.690 |
| CTRA | 585 | +1,74% | 60% | 58 | Trend, momentum, setup, R:R | Bertahan di atas 560, atau breakout 590 |
| ULTJ | 2100 | +0,48% | 60% | 58 | Momentum, setup, MACD, R:R | Candle hijau di area 1.995–2.110 |
| TOWR | 454 | +0,44% | 60% | 58 | Trend, momentum, setup, R:R | Bertahan di atas 432, atau breakout 466 |
| CBDK | 3780 | +7,39% | 60% | 55 | Trend, momentum, setup, R:R | Bertahan di atas 3.550, atau breakout 3.770 |
| ELSA | 680 | +3,82% | 60% | 55 | Trend, momentum, setup, R:R | Bertahan di atas 660, atau breakout 685 |
| NRCA | 555 | +6,73% | 50% | 44 | Trend, momentum, setup, MACD, R:R | Bertahan di atas 540 |

### AVOID

| Kode | 1D | Skor SARA | Alasan utama |
|---|---|---|---|
| SICO | +12,17% | 48 | Mengejar harga (naik 12,2% dalam 1 hari), ATR 5,5%, spekulasi; risk gate gagal |
| PRDA | +4,42% | 65 | RSI 86,5 (overbought); risk gate gagal |
| ACES | +5,56% | 48 | Trend & momentum gagal |
| MYOR | +4,36% | 42 | Trend & momentum gagal |
| GPRA | +3,09% | 51 | Trend & momentum gagal, spread lebar (1 tick = 1,0%) |
| SMRA | +3,13% | 38 | Trend & momentum gagal, fundamental lemah |
| BBCA | +2,94% | 46 | Trend, momentum & MACD gagal |
| BSDE | +1,83% | 27 | Trend & momentum gagal, fundamental lemah |
| AMRT | +1,60% | 43 | Trend, momentum & MACD gagal |
| ASII | +1,26% | 37 | Trend & momentum gagal, fundamental lemah |
| CPIN | +1,01% | 39 | Trend & momentum gagal |

## Keterbatasan

- VWAP intraday tidak dipakai (tanggal lampau), sama seperti perilaku halaman `/signal` untuk tanggal lampau.
- Fundamental Yahoo diambil pada 15 Oktober 2026, bukan snapshot per 14 Oktober.
- Kriteria tahap 1 memakai data Pasardana (cache 5 menit pada `/api/stocks`); `OneWeek` dihitung oleh Pasardana, bukan oleh aplikasi.
- Pasardana dibatasi `pageLength=1000`; saat ini 978 emiten, jadi semua masih terambil.

## Cara Menjalankan Ulang

Skrip TypeScript yang memanggil fungsi aplikasi secara langsung, dijalankan dengan `tsx` dari root proyek:

```ts
// topbuy.ts — jalankan: ./node_modules/.bin/tsx --tsconfig tsconfig.json topbuy.ts
import { mapToStockSummary, PASARDANA_LIST_URL } from './src/data/external/pasardana';
import { fetchYahooDailyBars } from './src/data/external/yahooFinance';
import { fetchYahooFundamentals } from './src/data/external/yahooFundamentals';
import { buildSignalFromDecision } from './src/domain/analysis/signalFromDecision';

const D = '2026-10-14';
const withTimeout = <V>(p: Promise<V>, ms: number, fallback: V) =>
  Promise.race([p, new Promise<V>((r) => setTimeout(() => r(fallback), ms))]);

(async () => {
  const list: any[] = await (await fetch(PASARDANA_LIST_URL)).json();

  // Tahap 1 — kriteria awal
  const candidates = list.filter((x) =>
    x.Code && x.Last > 0 &&
    (x.LastDate || '').startsWith(D) &&
    x.OneDay > 0 && x.OneWeek > 0 &&
    x.Value >= 1e9 &&
    x.Per > 0 && x.Per <= 30 &&
    x.Pbr > 0 && x.Pbr <= 3 &&
    x.Roe > 0 && x.FreeFloatPct >= 10);

  // Tahap 2 — Decision Engine v3
  for (const item of candidates) {
    const h = await withTimeout(fetchYahooDailyBars(item.Code, '6mo'), 20000, { ok: false, bars: [] } as any);
    const bars = h.bars.filter((b: any) => b.date.slice(0, 10) <= D);
    if (bars.length < 2) continue;
    const last = bars[bars.length - 1], prev = bars[bars.length - 2];
    const summary = { ...mapToStockSummary(item), lastClose: last.close, prevClose: prev.close,
      percentChange1D: ((last.close - prev.close) / prev.close) * 100 };
    const fundamentals = await withTimeout(fetchYahooFundamentals(item.Code), 20000, null);
    const sig = buildSignalFromDecision({ summary, bars, fundamentals, vwap: null, date: D });
    console.log(item.Code, sig.action, sig.saraScore, Math.round(sig.confidence), sig.decision.trigger);
  }
  process.exit(0);
})();
```

Catatan: jalankan file `.ts` langsung, jangan lewat `npx tsx --eval` atau stdin. Kedua cara itu macet atau gagal mentranspilasi import di lingkungan ini. Beri timeout pada setiap fetch Yahoo supaya satu request yang macet tidak menghentikan seluruh proses.
