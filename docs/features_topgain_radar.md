# Radar Top Gainer — Bisakah Top 5 Besok Ditebak?

Periode data: **15 April – 15 Oktober 2026** (123 hari bursa) · Dijalankan: 15 Oktober 2026 setelah bursa tutup · Kandidat untuk: **16 Oktober 2026**

Lanjutan dari [features_topgain_patterns.md](features_topgain_patterns.md) dan [features_topgain_case_20261015.md](features_topgain_case_20261015.md). Pertanyaannya: apakah saham yang akan masuk Top 5 Gainer bisa disimpulkan sebelum bursa buka?

> Hasil statistik dari data EOD, bukan rekomendasi investasi. Korelasi ≠ sebab. Daftar kandidat di bawah **bukan** sinyal BUY.

## Jawaban Singkat

**Top 5 yang tepat tidak bisa ditebak.** Yang bisa dibuat adalah daftar pendek saham yang peluang topgain-nya jauh di atas rata-rata.

| Hasil backtest 3 bulan (out-of-sample) | Nilai |
|---|---:|
| Peluang topgain rata-rata satu saham | 1,7% |
| Peluang topgain untuk 1% saham dengan skor tertinggi tiap hari | **15,7%** (~9× rata-rata) |
| Dari 20 kandidat teratas, rata-rata yang masuk Top 5 hari itu | **1,1 saham** (21,7% dari Top 5) |
| Hari ketika minimal 1 dari Top 5 ada di 20 kandidat teratas | **68%** |
| Hari ketika minimal 1 dari Top 5 ada di 50 kandidat teratas | 89% |

Artinya:
- Radar ini **12–18× lebih baik dari menebak acak**.
- Namun radar ini **hanya sedikit lebih baik dari aturan naif "beli yang kemarin naik paling tinggi"**. Pada K = 10, aturan naif itu malah sedikit lebih baik.
- Sekitar **3 dari 4 saham Top 5 tidak terdeteksi** dari jejak harga dan volume hari sebelumnya. Ini konsisten dengan studi: topgain banyak dipicu hal yang tidak ada di data EOD (berita, aksi korporasi, bandar).

Supaya radar ini bisa jauh lebih tajam, dibutuhkan data yang belum dimiliki aplikasi, misalnya broker summary, berita/keterbukaan informasi, atau data intraday pre-opening.

## Sumber Data

| Data | Sumber | Kode di aplikasi |
|---|---|---|
| Daftar emiten, sektor, kapitalisasi, free float | Pasardana `StockSearchResult/GetAll` | [pasardana.ts](../src/data/external/pasardana.ts) → `mapToStockSummary` |
| OHLCV harian 1 tahun | Yahoo Finance `v8/finance/chart/{KODE}.JK` | [yahooFinance.ts](../src/data/external/yahooFinance.ts) → `fetchYahooDailyBars` |
| Kalender bursa | Yahoo `^JKSE` | `fetchYahooIndexBars` |
| EMA, RSI14, ATR, RVOL, high 20 hari | Fungsi aplikasi | `ema`, `rsi`, `atr`, `computeRvolSeries`, `priorHigh` |

| Sampel | Jumlah |
|---|---|
| Saham-hari dianalisa | 103.406 |
| Topgain (≥ 10%, nilai ≥ Rp1 M) | 1.768 |
| Base rate | 1,71% |
| Rata-rata saham per hari | 831 |

Jumlah topgain 1.768 dibanding 1.759 di studi pola: selisihnya karena jendela bergeser satu hari dan kini memasukkan 9 topgain 15 Okt. Base rate-nya sama (1,71%).

## Cara Kerja Skor Radar

1. Untuk setiap saham-hari, cek 31 kondisi pada **t−1**. Kondisinya adalah tabel kondisi pra-topgain di studi pola, ditambah satu kondisi baru: "hari t−1 naik ≥ 10%".
2. Bobot setiap kondisi = **ln(lift)**. Kondisi yang menaikkan peluang (lift > 1) diberi bobot positif, yang menurunkan peluang (lift < 1) diberi bobot negatif. Kondisi dengan sampel < 300 tidak diberi bobot.
3. **Skor = jumlah bobot kondisi yang terpenuhi.** Skor tinggi berarti banyak jejak pra-topgain sekaligus.

Bobot terbesar (dihitung dari seluruh 6 bulan, dipakai untuk kandidat 16 Okt):

| Kondisi pada t−1 | Lift | Bobot |
|---|---:|---:|
| Hari t−1 naik ≥ 10% | 6,76× | +1,91 |
| Close > EMA20 + 10% | 3,92× | +1,37 |
| Naik ≥ 25% dalam 20 hari | 3,59× | +1,28 |
| RSI > 70 | 3,56× | +1,27 |
| Naik ≥ 10% dalam 5 hari | 3,10× | +1,13 |
| Range 10 hari > 30% | 2,70× | +0,99 |
| Hari t−1 turun ≥ 5% | 2,48× | +0,91 |
| RVOL t−1 ≥ 2 | 2,37× | +0,86 |
| Close < EMA20 − 10% | 2,34× | +0,85 |
| Pernah topgain dalam 20 hari | 2,19× | +0,78 |
| Dalam 10% dari low 1 tahun | 0,54× | −0,61 |
| Nilai rata-rata 20 hari < Rp1 M | 0,59× | −0,53 |
| **Range 10 hari < 8% (konsolidasi sempit)** | 0,19× | **−1,67** |

Penjumlahan ini mengasumsikan kondisi-kondisinya independen, padahal sebagian saling berkorelasi (misalnya RSI > 70 dengan close jauh di atas EMA20). Skor karena itu cocok untuk **mengurutkan** saham, bukan untuk dibaca sebagai peluang yang presisi.

## Backtest Walk-Forward

- **Jendela latih:** 15 Apr – 17 Jul 2026. Bobot dihitung hanya dari jendela ini.
- **Jendela uji:** 20 Jul – 15 Okt 2026 (62 hari bursa). Tidak ada data jendela uji yang dipakai untuk menghitung bobot.
- Setiap hari uji, semua saham diurutkan menurut skor. Lalu diukur berapa dari Top 5 hari itu (Top 5 = 5 topgain dengan kenaikan terbesar) yang masuk K kandidat teratas.

**Recall Top 5**: persentase saham Top 5 yang tertangkap di K kandidat teratas.

| Metode | K = 10 | K = 20 | K = 30 | K = 50 |
|---|---:|---:|---:|---:|
| **Skor radar (semua saham)** | 14,2% | **21,7%** | **25,9%** | **34,6%** |
| Skor radar (rata-rata nilai 20 hari ≥ Rp0,5 M) | 11,7% | 16,5% | 19,4% | 25,9% |
| Naif: top gainer kemarin | **15,2%** | 19,1% | 22,0% | 26,2% |
| Naif: naik terbesar 20 hari | 10,0% | 15,9% | 21,7% | 28,8% |
| Acak | 1,2% | 2,4% | 3,6% | 6,0% |

**% hari dengan minimal 1 dari Top 5 di dalam Top-K**:

| Metode | K = 10 | K = 20 | K = 30 | K = 50 |
|---|---:|---:|---:|---:|
| Skor radar (semua saham) | 51,6% | 67,7% | 72,6% | **88,7%** |
| Skor radar (nilai 20 hari ≥ Rp0,5 M) | 41,9% | 54,8% | 62,9% | 79,0% |
| Naif: top gainer kemarin | **61,3%** | **69,4%** | 72,6% | 85,5% |
| Naif: naik terbesar 20 hari | 41,9% | 54,8% | 66,1% | 75,8% |

**Presisi**: persentase kandidat Top-K yang benar-benar topgain (≥ 10%) pada hari itu.

| Metode | K = 10 | K = 20 | K = 30 | K = 50 |
|---|---:|---:|---:|---:|
| Skor radar (semua saham) | 15,2% | **12,4%** | **10,7%** | **8,8%** |
| Naif: top gainer kemarin | **16,8%** | 11,5% | 8,7% | 6,5% |
| Acak (base rate) | 1,7% | 1,7% | 1,7% | 1,7% |

**Kalibrasi skor** (jendela uji, dibagi ke desil):

| Desil skor | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P(topgain besok) | 0,35% | 0,49% | 0,64% | 0,82% | 0,99% | 0,97% | 0,97% | 1,51% | 2,99% | **7,16%** |

Yang bisa dibaca dari backtest:
- **Skornya konsisten.** Makin tinggi desil, makin besar peluang topgain, dan desil teratas 20× desil terbawah. Untuk 1% skor tertinggi per hari, peluangnya 15,7%, dan untuk 5% tertinggi 9,4%.
- **Keunggulan utamanya ada di K = 20–50.** Di Top 10, isinya didominasi saham yang kemarin naik besar, sehingga hasilnya hampir sama dengan aturan naif. Radar menambah nilai dengan menangkap saham yang **turun dulu** atau sedang **oversold**, yang tidak terlihat oleh aturan naif.
- **Filter likuiditas membuat recall turun** (21,7% menjadi 16,5% pada K = 20). Banyak Top 5 justru saham yang sepi. Ada trade-off antara "bisa ditangkap" dan "bisa ditransaksikan".

## Kandidat Radar untuk 16 Oktober 2026

Skor dihitung dari kondisi penutupan **15 Okt 2026**, dengan bobot dari seluruh 6 bulan. Daftar memakai filter rata-rata nilai 20 hari ≥ Rp0,5 M. Persentil = posisi skor di antara seluruh 103 ribu saham-hari historis.

| # | Saham | Sektor | Close 15 Okt | Chg 15 Okt | Skor | Persentil | RSI | vs EMA20 | Naik 20 hari | RVOL | Nilai rata-rata 20 hari | Jalur |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | AKKU | Kons. Non-Primer | 105 | +34,6% | 11,5 | 99,98 | 83 | +66% | +176% | 5,3 | Rp4,5 M | Lanjutan (ARA) |
| 2 | DKHH | Kesehatan | 116 | +13,7% | 10,9 | 99,90 | 91 | +42% | +66% | 6,2 | Rp5,9 M | Lanjutan |
| 3 | ALDO | Barang Baku | 1.955 | +24,9% | 10,2 | 99,75 | 89 | +54% | +105% | 3,7 | Rp0,7 M | Lanjutan (ARA) |
| 4 | PCAR | Kons. Non-Primer | 89 | +12,7% | 9,6 | 99,58 | 68 | +25% | +102% | 3,4 | Rp7,5 M | Lanjutan |
| 5 | SBMA | Barang Baku | 148 | +19,4% | 9,6 | 99,58 | 70 | +26% | +30% | 10,4 | Rp2,3 M | Lanjutan |
| 6 | BIKE | Kons. Non-Primer | 4.370 | +5,1% | 8,4 | 99,08 | 97 | +103% | +324% | 4,5 | Rp7,8 M | Lanjutan |
| 7 | STRK | Kons. Non-Primer | 108 | +0,9% | 8,0 | 98,77 | 80 | +46% | +64% | 1,6 | Rp9,2 M | Lanjutan |
| 8 | PKPK | Energi | 7.650 | +1,0% | 7,9 | 98,72 | 80 | +20% | +78% | 0,9 | Rp24,0 M | Lanjutan |
| 9 | IDEA | Kons. Non-Primer | 244 | +9,9% | 7,1 | 98,01 | 88 | +44% | +118% | 1,6 | Rp4,0 M | Lanjutan |
| 10 | ARII | Energi | 470 | +4,4% | 6,6 | 97,49 | 75 | +25% | +59% | 1,3 | Rp1,0 M | Lanjutan |
| 11 | HATM | Transportasi | 665 | −0,8% | 6,5 | 97,36 | 72 | +16% | +18% | 3,2 | Rp6,8 M | Lanjutan |
| 12 | GRPH | Kons. Non-Primer | 111 | −14,6% | 5,9 | 96,60 | 51 | +1% | −19% | 2,4 | Rp5,9 M | Turun dulu |
| 13 | VKTR | Kons. Non-Primer | 440 | −12,0% | 5,7 | 96,30 | 24 | −32% | −43% | 2,4 | Rp63,8 M | Rebound oversold |
| 14 | RSCH | Kesehatan | 620 | 0,0% | 5,4 | 95,77 | 90 | +13% | +40% | 0,7 | Rp13,6 M | Lanjutan |
| 15 | ATLA | Energi | 22 | −12,0% | 5,4 | 95,68 | 9 | −38% | −56% | 3,2 | Rp1,2 M | Rebound oversold |
| 16 | FOLK | Perindustrian | 90 | −12,6% | 5,4 | 95,68 | 23 | −46% | −63% | 2,3 | Rp5,8 M | Rebound oversold |
| 17 | TRON | Teknologi | 86 | −14,9% | 5,4 | 95,67 | 49 | +1% | −17% | 3,9 | Rp3,7 M | Turun dulu |
| 18 | PRDA | Kesehatan | 3.350 | +1,2% | 5,1 | 95,28 | 87 | +12% | +17% | 1,8 | Rp2,8 M | Lainnya |

Tanpa filter likuiditas, tiga saham sepi juga masuk 10 besar: **PTSP** (skor 10,6), **TFCO** (10,2) dan **BSWD** (8,3, ARA 15 Okt setelah 3 hari tanpa transaksi). Rata-rata nilai 20 hari ketiganya hanya Rp0,02–0,2 M.

Dua saham dikeluarkan dari daftar karena **tidak ada transaksi sejak ≥ 12 Okt** (kemungkinan suspensi): **CSMI** dan **AIMS**. Skornya tinggi hanya karena kondisi lama.

Cara membaca daftar ini:
- Ekspektasi dari backtest: dari 20 kandidat teratas, rata-rata **sekitar 1 saham** yang benar-benar masuk Top 5 besok, dan sekitar **2–3 saham** yang naik ≥ 10%. Saham yang mana tidak bisa ditentukan.
- **Skor tinggi bukan berarti layak dibeli.** Studi pola menunjukkan median return t+1 setelah topgain adalah −2,0%. Contohnya Top 5 tanggal 14 Okt: TRON, SONA dan KBLV turun pada 15 Okt. Daftar ini adalah radar "saham panas", sesuai aturan "jangan kejar harga" di [features_topgain.md](features_topgain.md).
- Kandidat **turun dulu** (GRPH, TRON) dan **rebound oversold** (VKTR, ATLA, FOLK) adalah tipe yang tidak tertangkap aturan naif. Di studi pola, rebound oversold juga punya follow-through terbaik (43% naik lagi besoknya).

## Keterbatasan

- **Tidak ada data berita, keterbukaan informasi, aksi korporasi atau broker summary.** Topgain yang dipicu hal-hal ini (sekitar 3 dari 4 Top 5) tidak bisa dideteksi.
- Bobot dijumlahkan seolah kondisinya independen (pendekatan naive Bayes), padahal sebagian kondisi saling berkorelasi. Model yang mempelajari kombinasi kondisi (misalnya regresi logistik) mungkin sedikit lebih baik, tetapi risiko overfit dengan sampel 6 bulan cukup besar.
- Satu periode, satu rezim pasar. Jendela uji hanya 62 hari bursa.
- Kapitalisasi dan free float adalah snapshot 15 Okt 2026. Harga Yahoo tidak disesuaikan dividen. Universe adalah saham yang listing hari ini (bias survivorship).
- Suspensi dideteksi hanya dari volume 0 berturut-turut, bukan dari pengumuman bursa.

## Langkah Berikutnya

- **Setelah bursa 16 Okt tutup**, jalankan ulang [top5today.ts](features_topgain_case_20261015.md#cara-menjalankan-ulang) dan bandingkan Top 5 asli dengan daftar di atas.
- Kalau radar ini mau dijadikan fitur aplikasi, tempatnya adalah sebagai **"Radar saham panas"**: daftar pengawasan dengan peringatan risiko, bukan sinyal BUY.

## Cara Menjalankan Ulang

Jalankan dari root proyek **setelah bursa tutup** (setelah 17:00 WIB; sebelum itu D0 otomatis memakai hari bursa sebelumnya). Argumen pertama adalah folder output:

```bash
./node_modules/.bin/tsx --tsconfig tsconfig.json topgainRadar.ts ./out
```

Hasilnya:
- `radar_result.json`: bobot, backtest, kalibrasi dan kandidat.
- `radar_bars_cache.json`: cache bar Yahoo per D0, supaya jalan ulang cepat.

Parameter (ambang topgain, filter likuiditas, sampel minimum per kondisi, nilai K) ada di bagian atas skrip.

```ts
// topgainRadar.ts — radar kandidat topgain: skor log-lift dari kondisi t−1, backtest walk-forward, kandidat hari bursa berikutnya.
// Jalankan dari root repo: ./node_modules/.bin/tsx --tsconfig tsconfig.json <path>/topgainRadar.ts [outDir]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapToStockSummary, PASARDANA_LIST_URL } from '@/data/external/pasardana';
import { fetchYahooDailyBars, fetchYahooIndexBars } from '@/data/external/yahooFinance';
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
const MAX_CHANGE = 0.35;      // > 35% = anomali / corporate action
const MONTHS = 6;             // jendela analisa
const MIN_COND_N = 300;       // kondisi dengan sampel latih < ini tidak diberi bobot
const LIQ_MIN = 0.5e9;        // filter likuiditas kandidat: rata-rata nilai 20 hari ≥ Rp0,5 M
const KS = [10, 20, 30, 50];

const OUT = process.argv[2] ?? '.';
const CACHE = join(OUT, 'radar_bars_cache.json');
const withTimeout = <V>(p: Promise<V>, ms: number, fb: V) =>
  Promise.race([p.catch(() => fb), new Promise<V>((r) => setTimeout(() => r(fb), ms))]);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const fin = (n: number) => Number.isFinite(n);
const r1 = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

interface Pre {
  ticker: string; sector: string; cap: number; ff: number;
  prevDate: string; prevClose: number;
  rsiPrev: number; distEma20: number; emaUp: boolean | null; ret5: number; ret20: number; chgPrev: number;
  distLow: number; distHigh: number; rvolPrev: number; rvol5: number; atrRatio: number; range10: number;
  distHigh20: number; priorTopgain20: boolean; avgValue20: number;
}
interface Row extends Pre { date: string; chg: number; value: number; event: boolean; score?: number; scoreLiq?: boolean }

type Cond = [string, (r: Pre) => boolean | null];
const CONDS: Cond[] = [
  ['Harga < 200 (ARA 35%)', (r) => r.prevClose < 200],
  ['Harga 200–500', (r) => r.prevClose >= 200 && r.prevClose < 500],
  ['Harga 500–5.000', (r) => r.prevClose >= 500 && r.prevClose <= 5000],
  ['Harga > 5.000', (r) => r.prevClose > 5000],
  ['Kapitalisasi < Rp1 T', (r) => r.cap < 1e12],
  ['Kapitalisasi > Rp10 T', (r) => r.cap >= 1e13],
  ['Free float < 15%', (r) => r.ff < 15],
  ['Nilai rata-rata 20H < Rp1 M', (r) => r.avgValue20 < 1e9],
  ['Nilai rata-rata 20H ≥ Rp10 M', (r) => r.avgValue20 >= 1e10],
  ['RSI < 30', (r) => (fin(r.rsiPrev) ? r.rsiPrev < 30 : null)],
  ['RSI 30–50', (r) => (fin(r.rsiPrev) ? r.rsiPrev >= 30 && r.rsiPrev < 50 : null)],
  ['RSI 50–70', (r) => (fin(r.rsiPrev) ? r.rsiPrev >= 50 && r.rsiPrev <= 70 : null)],
  ['RSI > 70', (r) => (fin(r.rsiPrev) ? r.rsiPrev > 70 : null)],
  ['EMA20 > EMA50', (r) => r.emaUp],
  ['Close > EMA20 + 10%', (r) => (fin(r.distEma20) ? r.distEma20 > 0.1 : null)],
  ['Close < EMA20 − 10%', (r) => (fin(r.distEma20) ? r.distEma20 < -0.1 : null)],
  ['Naik ≥ 25% dalam 20H', (r) => r.ret20 >= 0.25],
  ['Turun ≥ 20% dalam 20H', (r) => r.ret20 <= -0.2],
  ['Naik ≥ 10% dalam 5H', (r) => r.ret5 >= 0.1],
  ['Dalam 10% dari low 1 tahun', (r) => r.distLow <= 0.1],
  ['Dalam 5% dari high 1 tahun', (r) => r.distHigh >= -0.05],
  ['RVOL t−1 ≥ 2', (r) => (fin(r.rvolPrev) ? r.rvolPrev >= 2 : null)],
  ['RVOL rata-rata 5H ≥ 1,5', (r) => (fin(r.rvol5) ? r.rvol5 >= 1.5 : null)],
  ['RVOL t−1 < 0,7', (r) => (fin(r.rvolPrev) ? r.rvolPrev < 0.7 : null)],
  ['ATR14/ATR50 < 0,8', (r) => (fin(r.atrRatio) ? r.atrRatio < 0.8 : null)],
  ['Range 10H < 8%', (r) => r.range10 < 0.08],
  ['Range 10H > 30%', (r) => r.range10 > 0.3],
  ['Close dalam 3% dari high 20H', (r) => (fin(r.distHigh20) ? r.distHigh20 >= -0.03 : null)],
  ['Pernah topgain dalam 20H', (r) => r.priorTopgain20],
  ['Hari t−1 turun ≥ 5%', (r) => r.chgPrev <= -0.05],
  ['Hari t−1 naik ≥ 10%', (r) => r.chgPrev >= 0.1],
];

/** Bobot = ln(lift) per kondisi, dihitung hanya dari `train`. */
function fitWeights(train: Row[]) {
  const base = train.filter((r) => r.event).length / train.length;
  return CONDS.map(([name, f]) => {
    const withC = train.filter((r) => f(r) === true);
    const p = withC.length ? withC.filter((r) => r.event).length / withC.length : 0;
    const lift = p / base;
    const w = withC.length >= MIN_COND_N && lift > 0 ? Math.log(lift) : 0;
    return { name, n: withC.length, lift: r1(lift, 2), w };
  });
}
const scoreOf = (r: Pre, weights: { w: number }[]) => CONDS.reduce((s, [, f], k) => s + (f(r) === true ? weights[k].w : 0), 0);

(async () => {
  const list: any[] = await (await fetch(PASARDANA_LIST_URL)).json();
  const pd = new Map(list.map((x) => [x.Code, x]));
  const universe = list.filter((x) => x.Code && x.Last > 0).map(mapToStockSummary);
  const ihsg = (await fetchYahooIndexBars('^JKSE', '1y')).bars;
  const todayWib = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  const lastIhsg = ihsg[ihsg.length - 1].date.slice(0, 10);
  // D0 = hari bursa terakhir yang sudah tutup (bar hari ini bisa harga live sebelum 16:00 WIB).
  const wibHour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date()));
  const D0 = lastIhsg === todayWib && wibHour < 17 ? ihsg[ihsg.length - 2].date.slice(0, 10) : lastIhsg;
  const start = new Date(`${D0}T00:00:00Z`); start.setUTCMonth(start.getUTCMonth() - MONTHS);
  const startDate = start.toISOString().slice(0, 10);
  console.error(`window ${startDate}..${D0}, universe ${universe.length}`);

  // Cache bar supaya jalan ulang tidak mengambil ulang 978 saham.
  let cache: Record<string, OHLCVBar[]> = {};
  if (existsSync(CACHE)) { const c = JSON.parse(readFileSync(CACHE, 'utf8')); if (c.D0 === D0) cache = c.bars; }
  let fetched = 0;
  await mapWithConcurrency(universe, 8, async (s) => {
    if (cache[s.ticker]) return;
    const res = await withTimeout(fetchYahooDailyBars(s.ticker, '1y'), 20000, { ok: false, bars: [] } as any);
    if (++fetched % 200 === 0) console.error(`fetched ${fetched}`);
    if (res.ok) cache[s.ticker] = res.bars;
  });
  writeFileSync(CACHE, JSON.stringify({ D0, bars: cache }));

  const rows: Row[] = [];
  const next: Pre[] = [];   // kondisi per D0 → kandidat hari bursa berikutnya
  for (const s of universe) {
    const bars = (cache[s.ticker] ?? []).filter((b) => b.close > 0 && b.date.slice(0, 10) <= D0);
    if (bars.length < 60) continue;
    const c = closes(bars), ema20 = ema(c, 20), ema50 = ema(c, 50), rsi14 = rsi(bars, 14);
    const atr14 = atr(bars, 14), atr50 = atr(bars, 50), rvol = computeRvolSeries(bars);
    const chgAt = (i: number) => bars[i].close / bars[i - 1].close - 1;
    // Fitur dari bar p (= t−1); semuanya hanya memakai bar ≤ p.
    const pre = (p: number): Pre => {
      let lo = Infinity, hi = -Infinity, lo10 = Infinity, hi10 = -Infinity, top20 = false; const val20: number[] = [];
      for (let j = 0; j <= p; j++) { lo = Math.min(lo, bars[j].low); hi = Math.max(hi, bars[j].high); }
      for (let j = p - 9; j <= p; j++) { lo10 = Math.min(lo10, bars[j].low); hi10 = Math.max(hi10, bars[j].high); }
      for (let j = p - 19; j <= p; j++) { val20.push(bars[j].close * bars[j].volume); if (j > 0 && chgAt(j) >= GAIN) top20 = true; }
      return {
        ticker: s.ticker, sector: s.sector, cap: s.capitalization, ff: s.freeFloat,
        prevDate: bars[p].date.slice(0, 10), prevClose: c[p],
        rsiPrev: rsi14[p], distEma20: c[p] / ema20[p] - 1, emaUp: fin(ema50[p]) ? ema20[p] > ema50[p] : null,
        ret5: c[p] / c[p - 5] - 1, ret20: c[p] / c[p - 20] - 1, chgPrev: chgAt(p),
        distLow: c[p] / lo - 1, distHigh: c[p] / hi - 1, rvolPrev: rvol[p], rvol5: avg(rvol.slice(p - 4, p + 1).filter(fin)),
        atrRatio: atr14[p] / atr50[p], range10: (hi10 - lo10) / c[p], distHigh20: c[p] / priorHigh(bars, p + 1) - 1,
        priorTopgain20: top20, avgValue20: avg(val20),
      };
    };
    for (let i = 22; i < bars.length; i++) {
      const date = bars[i].date.slice(0, 10);
      if (date < startDate) continue;
      if (bars[i].volume === 0) continue;
      const chg = chgAt(i);
      if (Math.abs(chg) > MAX_CHANGE + 0.005) continue;
      const value = bars[i].close * bars[i].volume;
      rows.push({ ...pre(i - 1), date, chg, value, event: chg >= GAIN && value >= MIN_VALUE });
    }
    const last = bars.length - 1;
    if (bars[last].date.slice(0, 10) === D0) next.push(pre(last));
  }

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const split = dates[Math.floor(dates.length / 2)];
  const train = rows.filter((r) => r.date < split), test = rows.filter((r) => r.date >= split);
  const events = rows.filter((r) => r.event);
  console.error(`rows ${rows.length}, events ${events.length}, train ${train.length}, test ${test.length}, split ${split}`);

  // ── Backtest walk-forward: bobot dari train, dinilai di test ──
  const wTrain = fitWeights(train);
  for (const r of test) { r.score = scoreOf(r, wTrain); r.scoreLiq = r.avgValue20 >= LIQ_MIN; }
  const byDay = new Map<string, Row[]>();
  for (const r of test) (byDay.get(r.date) ?? byDay.set(r.date, []).get(r.date)!).push(r);

  type Ranker = [string, (rs: Row[]) => Row[]];
  const sortBy = (rs: Row[], k: (r: Row) => number) => rs.slice().sort((a, b) => k(b) - k(a));
  const rankers: Ranker[] = [
    ['Skor radar (semua saham)', (rs) => sortBy(rs, (r) => r.score!)],
    ['Skor radar (nilai 20H ≥ Rp0,5 M)', (rs) => sortBy(rs.filter((r) => r.scoreLiq), (r) => r.score!)],
    ['Naif: top gainer kemarin', (rs) => sortBy(rs, (r) => r.chgPrev)],
    ['Naif: naik terbesar 20 hari', (rs) => sortBy(rs, (r) => r.ret20)],
  ];
  const evalRanker = (rank: (rs: Row[]) => Row[]) => {
    const acc = KS.map(() => ({ hits: 0, top5: 0, daysAny: 0, prec: 0 }));
    let days = 0;
    for (const [, rs] of byDay) {
      const top5 = new Set(rs.filter((r) => r.event).sort((a, b) => b.chg - a.chg).slice(0, 5).map((r) => r.ticker));
      if (!top5.size) continue;
      days++;
      const ranked = rank(rs);
      KS.forEach((K, k) => {
        const topK = ranked.slice(0, K);
        const h = topK.filter((r) => top5.has(r.ticker)).length;
        acc[k].hits += h; acc[k].top5 += top5.size; acc[k].daysAny += h > 0 ? 1 : 0;
        acc[k].prec += topK.filter((r) => r.event).length / K;
      });
    }
    return KS.map((K, k) => ({
      K, recallTop5: r1((acc[k].hits / acc[k].top5) * 100), pctDaysAny: r1((acc[k].daysAny / days) * 100),
      precision: r1((acc[k].prec / days) * 100), avgHitsPerDay: r1(acc[k].hits / days, 2),
    }));
  };
  const backtest = rankers.map(([name, f]) => ({ name, metrics: evalRanker(f) }));
  // Acak: ekspektasi analitis per hari = K / N.
  const avgN = avg([...byDay.values()].map((rs) => rs.length));
  const testBase = test.filter((r) => r.event).length / test.length;
  backtest.push({ name: 'Acak (ekspektasi)', metrics: KS.map((K) => ({ K, recallTop5: r1((K / avgN) * 100), pctDaysAny: NaN, precision: r1(testBase * 100), avgHitsPerDay: NaN })) });

  // Kalibrasi: P(topgain) per desil skor di test.
  const sortedTest = test.slice().sort((a, b) => a.score! - b.score!);
  const deciles = Array.from({ length: 10 }, (_, d) => {
    const seg = sortedTest.slice(Math.floor((d * sortedTest.length) / 10), Math.floor(((d + 1) * sortedTest.length) / 10));
    return { desil: d + 1, minScore: r1(seg[0].score!, 2), pTopgain: r1((seg.filter((r) => r.event).length / seg.length) * 100, 2) };
  });
  // Top 1% skor harian: peluang topgain.
  const topPct = (q: number) => {
    const sel = [...byDay.values()].flatMap((rs) => sortBy(rs, (r) => r.score!).slice(0, Math.max(1, Math.round(rs.length * q))));
    return r1((sel.filter((r) => r.event).length / sel.length) * 100, 2);
  };

  // ── Kandidat hari bursa berikutnya: bobot dari seluruh 6 bulan ──
  const wAll = fitWeights(rows);
  const allScored = rows.map((r) => scoreOf(r, wAll)).sort((a, b) => a - b);
  const pctile = (s: number) => { let lo = 0, hi = allScored.length; while (lo < hi) { const m = (lo + hi) >> 1; if (allScored[m] < s) lo = m + 1; else hi = m; } return lo / allScored.length; };
  // Peluang historis untuk saham-hari dengan skor ≥ skor kandidat (full sample, in-sample).
  const rowsByScore = rows.map((r) => ({ s: scoreOf(r, wAll), e: r.event })).sort((a, b) => b.s - a.s);
  const pAtLeast = (s: number) => { const sel = rowsByScore.filter((x) => x.s >= s - 1e-9); return sel.length ? r1((sel.filter((x) => x.e).length / sel.length) * 100, 1) : NaN; };
  const cands = next
    .map((p) => ({ p, score: scoreOf(p, wAll) }))
    .sort((a, b) => b.score - a.score);
  const fmtCand = ({ p, score }: { p: Pre; score: number }) => ({
    ticker: p.ticker, sector: p.sector, close: p.prevClose, chgD0: r1(p.chgPrev * 100, 2),
    pdLast: pd.get(p.ticker)?.Last, pdPct: r1((pd.get(p.ticker)?.OneDay ?? NaN) * 100, 2),
    score: r1(score, 2), pctile: r1(pctile(score) * 100, 2), pHist: pAtLeast(score),
    avgValue20M: r1(p.avgValue20 / 1e9, 2), liquid: p.avgValue20 >= LIQ_MIN,
    rsi: r1(p.rsiPrev), distEma20: r1(p.distEma20 * 100), ret5: r1(p.ret5 * 100), ret20: r1(p.ret20 * 100),
    rvol: r1(p.rvolPrev, 2), rvol5: r1(p.rvol5, 2), range10: r1(p.range10 * 100), topgain20: p.priorTopgain20,
    archetype: p.priorTopgain20 || p.ret20 >= 0.25 ? 'Lanjutan momentum' : (fin(p.rsiPrev) && p.rsiPrev < 35) || p.distLow <= 0.1 ? 'Rebound oversold / dekat low' : 'Lainnya',
    kondisi: CONDS.filter(([, f], k) => f(p) === true && wAll[k].w > 0.3).map(([n]) => n),
  });
  const out = {
    window: { startDate, D0, split }, rows: rows.length, events: events.length, baseRatePct: r1((events.length / rows.length) * 100, 2),
    tradingDays: dates.length, testDays: byDay.size, avgStocksPerDay: Math.round(avgN),
    weightsTrain: wTrain.map((w) => ({ ...w, w: r1(w.w, 2) })), weightsAll: wAll.map((w) => ({ ...w, w: r1(w.w, 2) })),
    backtest, deciles, top1pct: topPct(0.01), top5pct: topPct(0.05), testBasePct: r1(testBase * 100, 2),
    candidatesAll: cands.slice(0, 20).map(fmtCand),
    candidatesLiquid: cands.filter((c) => c.p.avgValue20 >= LIQ_MIN).slice(0, 20).map(fmtCand),
    nCandidates: cands.length,
  };
  writeFileSync(join(OUT, 'radar_result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ...out, weightsTrain: undefined, weightsAll: undefined }, null, 1));
  process.exit(0);
})();
```
