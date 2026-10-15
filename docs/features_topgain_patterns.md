# Pola Top Gainer — Kenapa Saham Bisa Naik ≥ 10% Sehari

Periode data: **15 April – 14 Oktober 2026** (122 hari bursa) · Dijalankan: 15 Oktober 2026

Tujuan: mencari pola berulang di sekitar hari sebuah saham menjadi top gainer, memakai data aktual. Ini **bukan** rekomendasi BUY/WAIT. Studi ini mengukur kondisi apa yang paling sering muncul sebelum dan pada hari topgain, dibandingkan dengan hari biasa.

> Hasil statistik dari data EOD, bukan rekomendasi investasi. Korelasi ≠ sebab.

## Ringkasan Temuan

1. **Top gainer cenderung berulang di saham yang sama.** 60% topgain terjadi pada saham yang sudah pernah naik ≥ 10% dalam 20 hari bursa sebelumnya. 1.759 topgain berasal dari hanya 521 saham, dan ALKA sendirian topgain 17 kali dalam 6 bulan.
2. **Saham yang sudah bergerak liar, bukan yang tenang.** Range 10 hari > 30% muncul sebelum 53% topgain (lift 2,7×). Sebaliknya, konsolidasi sempit (range 10 hari < 8%) hanya ada sebelum 3% topgain (lift 0,19×). Pola "squeeze lalu meledak" **tidak** terbukti di data ini.
3. **Ekstrem di dua arah.** Sebelum topgain, saham biasanya sudah jauh di atas EMA20 (+10%, lift 3,9×), sudah naik ≥ 25% dalam 20 hari (lift 3,6×), atau RSI > 70 (lift 3,5×). Kondisi sebaliknya juga lebih sering: turun ≥ 20% dalam 20 hari (lift 2,2×), atau turun ≥ 5% sehari sebelumnya (lift 2,5×). Yang jarang topgain adalah saham netral (RSI 30–50, lift 0,72×).
4. **Volume sudah naik sebelum harga meledak.** RVOL hari sebelumnya ≥ 2 (lift 2,4×). Rata-rata RVOL 5 hari ≥ 1,5 muncul sebelum 37% topgain, padahal hanya ada di 19% hari biasa.
5. **Saham harga rendah dan pasar yang sedang naik membantu.** Saham < Rp200 (batas ARA 35%) menyumbang 49% topgain, sedangkan porsinya di hari-hari likuid hanya 34%. Pada hari IHSG naik ≥ 1%, peluang topgain 1,6× lebih tinggi. Pada 9 Juni 2026 (IHSG +7,57%) ada 98 topgain dalam sehari.

Setelah topgain, **kebanyakan saham tidak berlanjut.** Median return besok −2,0%, dan hanya 34% yang naik lagi besoknya. Pengecualiannya adalah saham yang **tutup di ARA**: median besok 0,0% dan 47% naik lagi.

## Sumber Data

| Data | Sumber | Kode di aplikasi |
|---|---|---|
| Daftar emiten, sektor, kapitalisasi, free float | Pasardana `StockSearchResult/GetAll` | [pasardana.ts](../src/data/external/pasardana.ts) → `mapToStockSummary` |
| OHLCV harian 1 tahun (6 bulan dianalisa + 6 bulan pemanasan indikator) | Yahoo Finance `v8/finance/chart/{KODE}.JK` | [yahooFinance.ts](../src/data/external/yahooFinance.ts) → `fetchYahooDailyBars` |
| IHSG harian | Yahoo `^JKSE` | `fetchYahooIndexBars` |
| EMA, RSI14, ATR, RVOL, high 20 hari, tick IDX | Fungsi aplikasi | `ema`, `rsi`, `atr`, `computeRvolSeries`, `priorHigh`, `idxTickSize` |

Validasi silang: Pasardana per 14 Oktober 2026 mencatat 14 saham yang naik ≥ 10% dengan nilai transaksi ≥ Rp1 M. Studi ini menemukan **14 saham yang sama** (ALDO, BAIK, BELI, BIKE, GRPH, HATM, KBLV, MGNA, ROCK, SAFE, SICO, SONA, STRK, TRON). Close dan % 1D-nya identik dengan Pasardana; selisih terbesar 0,01 poin persen (MGNA).

## Definisi

- **Topgain**: `close_t / close_{t−1} − 1 ≥ 10%` dan nilai transaksi hari itu (`close × volume`) ≥ Rp1 miliar.
- **Kondisi "sebelum"** diukur pada t−1 atau sebelumnya, jadi tidak ada data hari H yang ikut terpakai.
- **P(topgain)** = peluang hari berikutnya menjadi topgain bila kondisi terpenuhi hari ini. **Lift** = P(topgain | kondisi) ÷ base rate.
  - Lift > 1: kondisi itu lebih sering muncul sebelum topgain.
  - Lift < 1: kondisi itu justru lebih jarang muncul sebelum topgain.
- **Sanitasi**:
  - Perubahan harian > 35% (di atas ARA tertinggi) dibuang. Ada 3 kasus: BNBR −36,2%, COCO −51,1% dan FORU −93,6%, kemungkinan aksi korporasi.
  - Saham-hari dengan volume 0 dibuang (9.317 saham-hari, suspensi/tanpa transaksi).
  - Saham dengan data < 60 bar juga dibuang.

| Sampel | Jumlah |
|---|---|
| Emiten di Pasardana / berhasil diambil dari Yahoo | 978 / 921 |
| Saham-hari dianalisa / likuid (nilai ≥ Rp1 M) | 102.579 / 41.737 |
| **Topgain** | **1.759** (521 saham unik) |
| Base rate topgain per saham-hari | 1,71% |
| Topgain per hari | median 13, maks 98 |
| Besar kenaikan | 10–15%: 792 · 15–25%: 683 · ≥ 25%: 284 |

## 1. Kondisi Sebelum Topgain (t−1)

Diurutkan dari lift tertinggi. "% topgain" = berapa persen topgain yang didahului kondisi ini. "% semua" = berapa persen seluruh saham-hari yang punya kondisi ini.

| Kondisi pada t−1 | % topgain | % semua | P(topgain besok) | Lift |
|---|---:|---:|---:|---:|
| Close > EMA20 + 10% | 26,4% | 6,8% | 6,66% | **3,88×** |
| Naik ≥ 25% dalam 20 hari | 25,2% | 7,1% | 6,10% | **3,56×** |
| RSI > 70 | 15,1% | 4,3% | 6,04% | **3,52×** |
| Naik ≥ 10% dalam 5 hari | 27,8% | 9,1% | 5,26% | 3,07× |
| Range 10 hari > 30% (sangat volatil) | 53,2% | 19,7% | 4,62% | 2,70× |
| Hari t−1 turun ≥ 5% | 18,6% | 7,6% | 4,22% | 2,46× |
| Close < EMA20 − 10% | 22,3% | 9,5% | 4,04% | 2,36× |
| RVOL t−1 ≥ 2 | 26,8% | 11,4% | 4,04% | 2,35× |
| Pernah topgain dalam 20 hari | 60,1% | 27,6% | 3,74% | 2,18× |
| Turun ≥ 20% dalam 20 hari | 20,6% | 9,6% | 3,70% | 2,16× |
| RVOL rata-rata 5 hari ≥ 1,5 | 37,3% | 19,3% | 3,32% | 1,93× |
| Dalam 5% dari high 1 tahun | 4,3% | 2,3% | 3,17% | 1,85× |
| RSI < 30 (oversold) | 10,2% | 5,6% | 3,09% | 1,80× |
| Nilai rata-rata 20 hari ≥ Rp10 M | 25,2% | 18,0% | 2,40% | 1,40× |
| EMA20 > EMA50 | 44,4% | 34,0% | 2,23% | 1,30× |
| Harga < Rp200 (ARA 35%) | 48,6% | 40,4% | 2,06% | 1,20× |
| Kapitalisasi < Rp1 T | 52,3% | 45,0% | 1,99% | 1,16× |
| Close dalam 3% dari high 20 hari | 12,8% | 12,3% | 1,79% | 1,04× |
| Harga Rp200–500 | 21,4% | 21,7% | 1,69% | 0,99× |
| RSI 50–70 | 37,8% | 38,7% | 1,67% | 0,98× |
| Dalam 10% dari low 1 tahun | 9,9% | 18,2% | 0,93% | 0,54× |
| ATR14/ATR50 < 0,8 (squeeze) | 25,0% | 30,3% | 1,42% | 0,83× |
| Harga > Rp5.000 | 3,5% | 4,4% | 1,37% | 0,80× |
| Harga Rp500–5.000 | 26,5% | 33,5% | 1,35% | 0,79× |
| Kapitalisasi > Rp10 T | 15,0% | 18,2% | 1,41% | 0,82× |
| Free float < 15% | 25,4% | 33,7% | 1,29% | 0,75× |
| RSI 30–50 | 36,9% | 51,3% | 1,23% | 0,72× |
| RVOL t−1 < 0,7 (sepi) | 37,3% | 52,5% | 1,22% | 0,71× |
| Nilai rata-rata 20 hari < Rp1 M (sepi) | 31,3% | 53,3% | 1,01% | 0,59× |
| Range 10 hari < 8% (konsolidasi sempit) | 3,2% | 16,7% | 0,33% | **0,19×** |

Catatan baca tabel:
- Lift tertinggi pun hanya membuat peluang topgain besok naik dari 1,7% ke sekitar 6–7%. Tidak ada satu kondisi pun yang bisa "memprediksi" topgain. Kondisi-kondisi ini hanya menandai **kelompok saham tempat topgain biasanya terjadi**.
- Kondisi "sepi" terlihat rendah sebagian karena definisi topgain mensyaratkan nilai ≥ Rp1 M di hari H.

## 2. Ciri pada Hari Topgain

Dibandingkan dengan semua saham-hari yang likuid (nilai ≥ Rp1 M).

| Kondisi hari H | % topgain | % hari biasa | Lift |
|---|---:|---:|---:|
| Tutup di ARA | 23,0% | 1,0% | **23,7×** |
| RVOL ≥ 5 | 41,3% | 4,8% | 8,7× |
| Tembus high 20 hari | 46,3% | 5,6% | 8,2× |
| Gap up ≥ 3% saat open | 25,9% | 4,9% | 5,2× |
| RVOL ≥ 2 | 76,5% | 17,2% | 4,5× |
| Close position ≥ 85% (tutup dekat high) | 53,0% | 13,9% | 3,8× |
| IHSG naik ≥ 1% | 36,0% | 23,0% | 1,6× |
| IHSG naik | 52,5% | 40,2% | 1,3× |
| IHSG turun | 47,5% | 59,8% | 0,8× |
| Open ≤ prev close (naiknya terjadi di dalam sesi) | 39,2% | 59,6% | 0,7× |
| Close position < 50% | 8,1% | 53,9% | 0,15× |

Yang bisa dibaca dari tabel ini:
- **Hampir semua topgain disertai lonjakan volume.** 3 dari 4 topgain punya RVOL ≥ 2.
- **Kebanyakan tidak gap up.** Hanya 26% gap ≥ 3%. 39% justru dibuka di atau di bawah harga kemarin, lalu naik selama sesi.
- **Topgain tidak bergantung pada IHSG.** Hampir separuh topgain (47,5%) terjadi saat IHSG turun.

## 3. Arketipe Topgain

Setiap topgain diberi **satu** label. Aturan dicek berurutan dari atas, dan aturan pertama yang cocok dipakai. Kolom "% memenuhi" menghitung semua topgain yang memenuhi aturan itu, walaupun labelnya jatuh ke arketipe lain di atasnya.

| # | Arketipe | Aturan | % memenuhi | Jumlah (label) | Median t+1 | Naik t+1 | Median t+5 | Naik t+5 | Tutup ARA |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Lanjutan momentum | pernah topgain ≤ 20 hari, atau naik ≥ 25% dalam 20 hari | 61,5% | 1.082 | −1,4% | 34,7% | −4,0% | 36,7% | 22,6% |
| 2 | Rebound dari oversold / dekat low | RSI t−1 < 35, atau ≤ 10% dari low 1 tahun | 18,8% | 211 | −1,1% | **42,6%** | −2,4% | **41,4%** | 20,9% |
| 3 | Breakout dari konsolidasi | tembus high 20 hari dan (range 10 hari < 12% atau ATR14/ATR50 < 0,8) | 18,0% | 206 | −2,9% | 31,6% | −1,9% | 36,8% | **35,4%** |
| 4 | Rotasi sektor | ≥ 3 topgain dari sektor yang sama di hari yang sama | 51,7% | 126 | −3,3% | 29,6% | −5,0% | 30,6% | 19,0% |
| 5 | Breakout biasa | tembus high 20 hari | 46,3% | 52 | −4,9% | 21,6% | −6,0% | 34,7% | 23,1% |
| 6 | Spike saham sepi | nilai rata-rata 20 hari < Rp1 M | 31,3% | 41 | −4,0% | 30,0% | −6,6% | 20,5% | 9,8% |
| 7 | Tanpa pola teknikal jelas | selain di atas | — | 41 | −3,5% | 15,0% | −9,1% | 15,0% | 7,3% |

Contoh nyata (topgain terbaru per arketipe):
- **Lanjutan momentum**: ALDO 14 Okt +11,8%, BIKE 14 Okt +24,9%, GRPH 14 Okt +18,2%, MGNA 14 Okt +18,1%, ROCK 14 Okt +17,3%
- **Rebound oversold**: KBLV 14 Okt +18,4%, TRON 14 Okt +34,7%, CTTH 13 Okt +11,2%, ESIP 13 Okt +10,8%
- **Breakout dari konsolidasi**: SBMA 13 Okt +29,7%, PEVE 8 Okt +24,8%, KDTN 5 Okt +24,4%, MBSS 2 Okt +24,7%
- **Rotasi sektor**: BAIK 14 Okt +15,6%, PICO 13 Okt +28,5%, MINE 12 Okt +17,6%, ZONE 12 Okt +24,6%
- **Breakout biasa**: HATM 14 Okt +10,7%, ARII 8 Okt +24,9%, BDKR 6 Okt +14,1%
- **Spike saham sepi**: BELI 14 Okt +11,3%, MCAS 8 Okt +24,6%, SMAR 29 Sep +15,1%
- **Tanpa pola jelas**: SICO 14 Okt +12,2%, IATA 6 Okt +22,3%, PYFA 6 Okt +15,8%

Interpretasi:
- **Hanya 41 dari 1.759 topgain (2,3%) yang tidak punya jejak teknikal apa pun.** Kelompok inilah yang paling mungkin dipicu berita atau aksi korporasi. Kelompok ini juga punya follow-through **terburuk**: hanya 15% naik lagi besok, dan median 5 hari −9,1%.
- **Rebound dari oversold punya follow-through terbaik.** 43% naik lagi besok dan median 5 hari hanya −2,4%.
- **Breakout dari konsolidasi paling sering tutup di ARA** (35%) dan median 5 harinya juga relatif kecil (−1,9%).
- **Angka rotasi sektor tidak punya pembanding.** Dengan median 13 topgain per hari dan 11 sektor, sebagian kebersamaan dalam satu sektor bisa terjadi kebetulan.

## 4. Apa yang Terjadi Setelahnya

| Kelompok | Jumlah | Median t+1 | Naik t+1 | Median t+5 |
|---|---:|---:|---:|---:|
| Semua topgain | 1.759 | −2,0% | 34,0% | −3,8% |
| Tutup di ARA | 405 | 0,0% | **47,3%** | −5,3% |
| Tidak tutup di ARA | 1.354 | −2,2% | 30,0% | −3,6% |
| Close position ≥ 85% | 932 | −1,0% | 40,5% | −3,8% |
| Close position < 50% | 143 | −2,1% | 31,2% | −3,4% |

Topgain lebih sering **diikuti koreksi** daripada lanjutan. Saham yang tutup di ARA paling kuat besoknya, tetapi dalam 5 hari tetap terkoreksi (median −5,3%). Ini sejalan dengan aturan "jangan kejar harga" di [features_topgain.md](features_topgain.md) dan risk gate Decision Engine v3.

## Kesimpulan — Kenapa Saham Menjadi Top Gainer

Dari data 6 bulan ini, topgain **bukan kejadian acak dan bukan ledakan dari saham yang tenang**. Pola berulangnya:

1. **Saham yang sama dalam fase "panas".** Topgain hari ini paling sering terjadi pada saham yang baru saja topgain atau naik besar dalam 20 hari terakhir. Uang spekulatif cenderung berputar di saham yang sedang ramai.
2. **Volatilitas dan volume sudah naik lebih dulu.** Range 10 hari yang lebar dan RVOL yang meningkat 1–5 hari sebelumnya adalah jejak paling konsisten.
3. **Posisi harga yang ekstrem.** Topgain muncul jauh di atas EMA20 (momentum) atau setelah turun dalam (rebound). Jarang dari posisi netral.
4. **Struktur pasar IDX.** Saham < Rp200 punya ruang ARA 35% dan lebih sering topgain. Hari IHSG naik kuat memperbanyak topgain, tetapi tidak diperlukan.
5. **Hari H selalu disertai lonjakan transaksi.** Biasanya juga tembus high 20 hari dan tutup dekat high. Kenaikan tanpa volume hampir tidak pernah menjadi topgain.

Untuk dipakai di screener: kondisi pra-topgain di atas cocok sebagai **radar "saham sedang panas"**, bukan sinyal beli. Peluang lanjutnya rendah, kecuali pada pola rebound dari oversold dan saham yang tutup di ARA.

## Keterbatasan

- **Tidak ada data berita, aksi korporasi (right issue, stock split, akuisisi) atau broker summary.** Penyebab fundamental atau berita di balik topgain tidak bisa diukur. Studi ini hanya menjelaskan jejak harga dan volume.
- Harga Yahoo tidak disesuaikan dividen. Nilai transaksi dihitung sebagai `close × volume` (aproksimasi).
- Universe = saham yang listing hari ini (bias survivorship). 57 emiten gagal diambil dari Yahoo.
- Kapitalisasi dan free float adalah snapshot 14 Oktober 2026, bukan nilai per tanggal topgain.
- Batas ARA (35% / 25% / 20% berdasarkan harga) dijadikan parameter. "Tutup di ARA" = close = high dan close ≥ harga ARA − 1 tick.
- Periode 6 bulan dan satu rezim pasar. Hasil bisa berbeda di periode lain.

## Cara Menjalankan Ulang

Jalankan dari root proyek (file `.ts` langsung, bukan `--eval`). Argumen pertama adalah folder output:

```bash
./node_modules/.bin/tsx --tsconfig tsconfig.json topgainStudy.ts ./out
```

Hasil: `topgain_result.json` (ringkasan, tabel, arketipe, validasi silang) dan `topgain_events.json` (semua event beserta fiturnya). Parameter (ambang 10%, nilai minimum, periode, batas ARA) ada di bagian atas skrip.

```ts
// topgainStudy.ts — jalankan dari root repo: ./node_modules/.bin/tsx --tsconfig tsconfig.json <path>/topgainStudy.ts [outDir]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapToStockSummary, PASARDANA_LIST_URL } from '@/data/external/pasardana';
import { fetchYahooDailyBars, fetchYahooIndexBars } from '@/data/external/yahooFinance';
import { idxTickSize } from '@/domain/analysis/idxTick';
import { priorHigh } from '@/domain/history/breakoutEvents';
import { computeRvolSeries } from '@/domain/history/volumeEvents';
import { atr } from '@/domain/indicators/atr';
import { closes, ema } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { OHLCVBar } from '@/domain/models/History';
import { mapWithConcurrency } from '@/lib/concurrency';

// ── Parameter ──────────────────────────────────────────────────────────────────
const GAIN = 0.10;            // topgain: naik ≥ 10% sehari
const MIN_VALUE = 1e9;        // nilai transaksi hari H ≥ Rp1 M
const MAX_CHANGE = 0.35;      // > 35% = di atas ARA tertinggi → anomali data / corporate action
const MIN_BARS = 60;
const MONTHS = 6;
const araLimit = (prev: number) => (prev <= 200 ? 0.35 : prev <= 5000 ? 0.25 : 0.2);

const OUT = process.argv[2] ?? '.';
const withTimeout = <V>(p: Promise<V>, ms: number, fallback: V) =>
  Promise.race([p.catch(() => fallback), new Promise<V>((r) => setTimeout(() => r(fallback), ms))]);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

interface Row {
  ticker: string; date: string; sector: string; event: boolean; chg: number; value: number;
  prevClose: number; tier: string; cap: string; ff: string;
  // sebelum (t−1)
  rsiPrev: number; distEma20: number; emaUp: boolean | null; ret5: number; ret20: number;
  distLow: number; distHigh: number; rvolPrev: number; rvol5: number; atrRatio: number; range10: number;
  distHigh20: number; priorTopgain20: boolean; prevDrop: boolean; avgValue20: number;
  // hari H
  gap: number; closePos: number; rvolDay: number; breakout20: boolean; atAra: boolean; ihsg: number;
  // sesudah
  fwd1: number; fwd3: number; fwd5: number;
  sectorEvents?: number; archetype?: string;
}

(async () => {
  const list: any[] = await (await fetch(PASARDANA_LIST_URL)).json();
  const universe = list.filter((x) => x.Code && x.Last > 0).map(mapToStockSummary);
  const ihsgRes = await fetchYahooIndexBars('^JKSE', '1y');
  const ihsgBars = ihsgRes.bars;
  const ihsgChg = new Map<string, number>();
  ihsgBars.forEach((b, k) => { if (k > 0) ihsgChg.set(b.date.slice(0, 10), b.close / ihsgBars[k - 1].close - 1); });
  const lastDate = ihsgBars[ihsgBars.length - 1].date.slice(0, 10);
  const start = new Date(`${lastDate}T00:00:00Z`); start.setUTCMonth(start.getUTCMonth() - MONTHS);
  const startDate = start.toISOString().slice(0, 10);
  // Bar hari ini bisa harga live (sesi berjalan) → analisa sampai bar IHSG terakhir yang sudah tutup sebelum hari ini.
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const endDate = lastDate >= todayWib ? ihsgBars[ihsgBars.length - 2].date.slice(0, 10) : lastDate;
  console.error(`universe ${universe.length}, window ${startDate}..${endDate}`);

  let fetched = 0, failed = 0, anomalies = 0, suspendedDays = 0;
  const anomalyList: string[] = [];
  const rows: Row[] = [];

  await mapWithConcurrency(universe, 8, async (s) => {
    const res = await withTimeout(fetchYahooDailyBars(s.ticker, '1y'), 20000, { ok: false, bars: [] } as any);
    fetched += 1;
    if (fetched % 100 === 0) console.error(`fetched ${fetched}/${universe.length}`);
    const bars: OHLCVBar[] = (res.bars ?? []).filter((b: OHLCVBar) => b.close > 0 && b.date.slice(0, 10) <= endDate);
    if (!res.ok || bars.length < MIN_BARS) { failed += 1; return; }

    const c = closes(bars);
    const ema20 = ema(c, 20), ema50 = ema(c, 50);
    const rsi14 = rsi(bars, 14);
    const atr14 = atr(bars, 14), atr50 = atr(bars, 50);
    const rvol = computeRvolSeries(bars);
    const chgAt = (i: number) => bars[i].close / bars[i - 1].close - 1;
    const tier = (p: number) => (p < 200 ? '<200' : p < 500 ? '200–500' : p <= 5000 ? '500–5.000' : '>5.000');
    const cap = s.capitalization < 1e12 ? '<Rp1 T' : s.capitalization < 1e13 ? 'Rp1–10 T' : '>Rp10 T';
    const ff = s.freeFloat < 15 ? '<15%' : s.freeFloat < 40 ? '15–40%' : '≥40%';

    for (let i = 21; i < bars.length; i++) {
      const date = bars[i].date.slice(0, 10);
      if (date < startDate) continue;
      const cur = bars[i], prev = bars[i - 1];
      if (cur.volume === 0) { suspendedDays += 1; continue; }
      const chg = chgAt(i);
      if (Math.abs(chg) > MAX_CHANGE + 0.005) { anomalies += 1; anomalyList.push(`${s.ticker} ${date} ${(chg * 100).toFixed(1)}%`); continue; }
      let lo = Infinity, hi = -Infinity, lo10 = Infinity, hi10 = -Infinity, val20: number[] = [], top20 = false;
      for (let j = 0; j < i; j++) { lo = Math.min(lo, bars[j].low); hi = Math.max(hi, bars[j].high); }
      for (let j = i - 10; j < i; j++) { lo10 = Math.min(lo10, bars[j].low); hi10 = Math.max(hi10, bars[j].high); }
      for (let j = i - 20; j < i; j++) { val20.push(bars[j].close * bars[j].volume); if (j > 0 && chgAt(j) >= GAIN) top20 = true; }
      const lim = araLimit(prev.close);
      const araRaw = prev.close * (1 + lim);
      const araPrice = Math.floor(araRaw / idxTickSize(araRaw)) * idxTickSize(araRaw);
      const fwd = (k: number) => (bars[i + k] ? bars[i + k].close / cur.close - 1 : NaN);
      const value = cur.close * cur.volume;
      rows.push({
        ticker: s.ticker, date, sector: s.sector, event: chg >= GAIN && value >= MIN_VALUE, chg, value,
        prevClose: prev.close, tier: tier(prev.close), cap, ff,
        rsiPrev: rsi14[i - 1], distEma20: prev.close / ema20[i - 1] - 1,
        emaUp: Number.isFinite(ema50[i - 1]) ? ema20[i - 1] > ema50[i - 1] : null,
        ret5: prev.close / bars[i - 6].close - 1, ret20: prev.close / bars[i - 21].close - 1,
        distLow: prev.close / lo - 1, distHigh: prev.close / hi - 1,
        rvolPrev: rvol[i - 1], rvol5: avg(rvol.slice(i - 5, i).filter(Number.isFinite)),
        atrRatio: atr14[i - 1] / atr50[i - 1], range10: (hi10 - lo10) / prev.close,
        distHigh20: prev.close / priorHigh(bars, i) - 1, priorTopgain20: top20, prevDrop: chgAt(i - 1) <= -0.05,
        avgValue20: avg(val20),
        gap: cur.open / prev.close - 1, closePos: cur.high > cur.low ? (cur.close - cur.low) / (cur.high - cur.low) : 0.5,
        rvolDay: rvol[i], breakout20: cur.close > priorHigh(bars, i), atAra: cur.close >= araPrice - idxTickSize(araPrice) && cur.close >= cur.high,
        ihsg: ihsgChg.get(date) ?? NaN,
        fwd1: fwd(1), fwd3: fwd(3), fwd5: fwd(5),
      });
    }
  });

  const events = rows.filter((r) => r.event);
  const liquid = rows.filter((r) => r.value >= MIN_VALUE);
  const baseRate = events.length / rows.length;

  // Rotasi sektor: jumlah topgain di sektor yang sama pada hari yang sama.
  const secDay = new Map<string, number>();
  for (const e of events) secDay.set(`${e.sector}|${e.date}`, (secDay.get(`${e.sector}|${e.date}`) ?? 0) + 1);
  for (const e of events) e.sectorEvents = secDay.get(`${e.sector}|${e.date}`)!;
  const eventsPerDay = new Map<string, number>();
  for (const e of events) eventsPerDay.set(e.date, (eventsPerDay.get(e.date) ?? 0) + 1);

  // ── Tabel A: kondisi SEBELUM (t−1) → P(topgain di t | kondisi) vs base rate ──
  type Cond = [string, (r: Row) => boolean | null];
  const fin = (n: number) => Number.isFinite(n);
  const pre: Cond[] = [
    ['Harga < 200 (ARA 35%)', (r) => r.prevClose < 200],
    ['Harga 200–500', (r) => r.prevClose >= 200 && r.prevClose < 500],
    ['Harga 500–5.000', (r) => r.prevClose >= 500 && r.prevClose <= 5000],
    ['Harga > 5.000', (r) => r.prevClose > 5000],
    ['Kapitalisasi < Rp1 T', (r) => r.cap === '<Rp1 T'],
    ['Kapitalisasi > Rp10 T', (r) => r.cap === '>Rp10 T'],
    ['Free float < 15%', (r) => r.ff === '<15%'],
    ['Nilai rata-rata 20H < Rp1 M (sepi)', (r) => r.avgValue20 < 1e9],
    ['Nilai rata-rata 20H ≥ Rp10 M', (r) => r.avgValue20 >= 1e10],
    ['RSI t−1 < 30 (oversold)', (r) => (fin(r.rsiPrev) ? r.rsiPrev < 30 : null)],
    ['RSI t−1 30–50', (r) => (fin(r.rsiPrev) ? r.rsiPrev >= 30 && r.rsiPrev < 50 : null)],
    ['RSI t−1 50–70', (r) => (fin(r.rsiPrev) ? r.rsiPrev >= 50 && r.rsiPrev <= 70 : null)],
    ['RSI t−1 > 70', (r) => (fin(r.rsiPrev) ? r.rsiPrev > 70 : null)],
    ['EMA20 > EMA50 (uptrend)', (r) => r.emaUp],
    ['Close t−1 > EMA20 + 10%', (r) => (fin(r.distEma20) ? r.distEma20 > 0.1 : null)],
    ['Close t−1 < EMA20 − 10%', (r) => (fin(r.distEma20) ? r.distEma20 < -0.1 : null)],
    ['Naik ≥ 25% dalam 20H sebelumnya', (r) => r.ret20 >= 0.25],
    ['Turun ≥ 20% dalam 20H sebelumnya', (r) => r.ret20 <= -0.2],
    ['Naik ≥ 10% dalam 5H sebelumnya', (r) => r.ret5 >= 0.1],
    ['Dalam 10% dari low 1 tahun', (r) => r.distLow <= 0.1],
    ['Dalam 5% dari high 1 tahun', (r) => r.distHigh >= -0.05],
    ['RVOL t−1 ≥ 2', (r) => (fin(r.rvolPrev) ? r.rvolPrev >= 2 : null)],
    ['RVOL rata-rata 5H ≥ 1,5 (akumulasi)', (r) => (fin(r.rvol5) ? r.rvol5 >= 1.5 : null)],
    ['RVOL t−1 < 0,7 (sepi)', (r) => (fin(r.rvolPrev) ? r.rvolPrev < 0.7 : null)],
    ['ATR14/ATR50 < 0,8 (squeeze)', (r) => (fin(r.atrRatio) ? r.atrRatio < 0.8 : null)],
    ['Range 10H < 8% (konsolidasi sempit)', (r) => r.range10 < 0.08],
    ['Range 10H > 30% (sangat volatil)', (r) => r.range10 > 0.3],
    ['Close t−1 dalam 3% dari high 20H', (r) => (fin(r.distHigh20) ? r.distHigh20 >= -0.03 : null)],
    ['Pernah topgain dalam 20H terakhir', (r) => r.priorTopgain20],
    ['Hari t−1 turun ≥ 5%', (r) => r.prevDrop],
  ];
  const tableA = pre.map(([name, f]) => {
    const withC = rows.filter((r) => f(r) === true);
    const defined = rows.filter((r) => f(r) !== null);
    const evC = withC.filter((r) => r.event).length;
    const evDefined = defined.filter((r) => r.event).length;
    const p = withC.length ? evC / withC.length : 0;
    return {
      kondisi: name, pctEvent: pct(evC, evDefined), pctSemua: pct(withC.length, defined.length),
      pTopgain: Math.round(p * 10000) / 100, lift: Math.round((p / baseRate) * 100) / 100, n: withC.length, nEvent: evC,
    };
  });

  // ── Tabel B: kondisi HARI H — event vs semua saham-hari likuid ──
  const day: Cond[] = [
    ['RVOL hari H ≥ 2', (r) => (fin(r.rvolDay) ? r.rvolDay >= 2 : null)],
    ['RVOL hari H ≥ 5', (r) => (fin(r.rvolDay) ? r.rvolDay >= 5 : null)],
    ['Gap up ≥ 3% saat open', (r) => r.gap >= 0.03],
    ['Open ≤ prev close (naik dari intraday)', (r) => r.gap <= 0],
    ['Close position ≥ 85%', (r) => r.closePos >= 0.85],
    ['Close position < 50%', (r) => r.closePos < 0.5],
    ['Tembus high 20H', (r) => r.breakout20],
    ['Tutup di ARA', (r) => r.atAra],
    ['IHSG hari itu naik', (r) => (fin(r.ihsg) ? r.ihsg > 0 : null)],
    ['IHSG hari itu naik ≥ 1%', (r) => (fin(r.ihsg) ? r.ihsg >= 0.01 : null)],
    ['IHSG hari itu turun', (r) => (fin(r.ihsg) ? r.ihsg < 0 : null)],
  ];
  const tableB = day.map(([name, f]) => {
    const e = events.filter((r) => f(r) !== null), b = liquid.filter((r) => f(r) !== null);
    const pe = e.filter((r) => f(r)).length / (e.length || 1), pb = b.filter((r) => f(r)).length / (b.length || 1);
    return { kondisi: name, pctEvent: pct(pe, 1), pctBaseline: pct(pb, 1), lift: Math.round((pe / pb) * 100) / 100 };
  });

  // ── Arketipe (berurutan, satu label per event) ──
  const ARCH: Array<[string, (r: Row) => boolean]> = [
    ['Lanjutan momentum', (r) => r.priorTopgain20 || r.ret20 >= 0.25],
    ['Rebound dari oversold / dekat low', (r) => (fin(r.rsiPrev) && r.rsiPrev < 35) || r.distLow <= 0.1],
    ['Breakout dari konsolidasi', (r) => r.breakout20 && (r.range10 < 0.12 || (fin(r.atrRatio) && r.atrRatio < 0.8))],
    ['Rotasi sektor (≥3 topgain sektor sama)', (r) => (r.sectorEvents ?? 0) >= 3],
    ['Breakout biasa (tembus high 20H)', (r) => r.breakout20],
    ['Spike saham sepi (nilai 20H < Rp1 M)', (r) => r.avgValue20 < 1e9],
    ['Tanpa pola teknikal jelas', () => true],
  ];
  for (const e of events) e.archetype = ARCH.find(([, f]) => f(e))![0];
  const med = (xs: number[]) => { const v = xs.filter(fin).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : NaN; };
  const fwdStats = (rs: Row[]) => ({
    n: rs.length,
    medFwd1: Math.round(med(rs.map((r) => r.fwd1)) * 1000) / 10,
    pctNaikT1: pct(rs.filter((r) => r.fwd1 > 0).length, rs.filter((r) => fin(r.fwd1)).length),
    medFwd5: Math.round(med(rs.map((r) => r.fwd5)) * 1000) / 10,
    pctNaikT5: pct(rs.filter((r) => r.fwd5 > 0).length, rs.filter((r) => fin(r.fwd5)).length),
    pctAra: pct(rs.filter((r) => r.atAra).length, rs.length),
  });
  const archetypes = ARCH.map(([name, f]) => {
    const rs = events.filter((e) => e.archetype === name);
    const any = events.filter((e) => f(e)).length;
    const ex = rs.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map((r) => `${r.ticker} ${r.date} +${(r.chg * 100).toFixed(1)}%`);
    return { arketipe: name, pctEventMemenuhi: pct(any, events.length), ...fwdStats(rs), contoh: ex };
  });

  // ── Ringkasan ──
  const countBy = (rs: Row[], k: (r: Row) => string) => {
    const m = new Map<string, number>(); for (const r of rs) m.set(k(r), (m.get(k(r)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const perSectorBase = countBy(liquid, (r) => r.sector);
  const summary = {
    window: { startDate, endDate }, universe: universe.length, fetchedOk: universe.length - failed, failed,
    rows: rows.length, liquidRows: liquid.length, events: events.length, uniqueTickers: new Set(events.map((e) => e.ticker)).size,
    baseRatePct: Math.round(baseRate * 10000) / 100, anomaliesExcluded: anomalies, suspendedDays,
    tradingDays: new Set(rows.map((r) => r.date)).size,
    eventsPerDay: { median: med([...eventsPerDay.values()]), max: Math.max(...eventsPerDay.values()) },
    busiestDays: [...eventsPerDay.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d, n]) => ({ date: d, n, ihsgPct: Math.round((ihsgChg.get(d) ?? NaN) * 10000) / 100 })),
    perMonth: countBy(events, (r) => r.date.slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])),
    perTier: countBy(events, (r) => r.tier).map(([k, n]) => [k, n, pct(n, events.length), pct(liquid.filter((r) => r.tier === k).length, liquid.length)]),
    perSector: countBy(events, (r) => r.sector).map(([k, n]) => [k, n, pct(n, events.length), pct(perSectorBase.find(([s]) => s === k)?.[1] ?? 0, liquid.length)]),
    topTickers: countBy(events, (r) => r.ticker).slice(0, 15),
    allFollow: fwdStats(events),
    gainSize: { pct10to15: events.filter((e) => e.chg < 0.15).length, pct15to25: events.filter((e) => e.chg >= 0.15 && e.chg < 0.25).length, gte25: events.filter((e) => e.chg >= 0.25).length },
  };

  // Validasi silang: event hari terakhir vs snapshot Pasardana bertanggal sama.
  const pd = new Map(list.filter((x) => (x.LastDate || "").startsWith(endDate)).map((x) => [x.Code, x]));
  const recent = events.filter((e) => e.date === endDate).map((e) => ({ ticker: e.ticker, yahooClose: Math.round(e.prevClose * (1 + e.chg)), yahooPct: Math.round(e.chg * 10000) / 100, pasardanaLast: pd.get(e.ticker)?.Last ?? null, pasardanaPct: pd.has(e.ticker) ? Math.round(pd.get(e.ticker).OneDay * 10000) / 100 : null }));
  writeFileSync(join(OUT, 'topgain_result.json'), JSON.stringify({ summary, tableA, tableB, archetypes, recent, anomalyList }, null, 1));
  writeFileSync(join(OUT, 'topgain_events.json'), JSON.stringify(events));
  console.log(JSON.stringify({ summary, tableA, tableB, archetypes }, null, 1));
  process.exit(0);
})();
```
