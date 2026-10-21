# Saham Tahan Banting — IHSG Crash 16 Oktober 2026

Dijalankan: 17 Oktober 2026 (Sabtu), memakai data EOD 16 Oktober 2026 · Lanjutan dari [features_topgain_case_20261016.md](features_topgain_case_20261016.md)

Tujuan: mencari saham yang **(a) turun jauh lebih dangkal dari IHSG** dan **(b) mulai membentuk struktur pemulihan** pada hari IHSG −11,57%. Hasilnya adalah daftar pantauan, **bukan** rekomendasi BUY.

> Hasil statistik dari data EOD, bukan rekomendasi investasi. Korelasi ≠ sebab.

## Ringkasan

1. **Hampir tidak ada tempat berlindung.**
   - Dari 223 saham likuid, hanya 1 yang naik (BYAN +0,45%).
   - Median return −14,44% dan 77 saham (35%) ditutup di ARB.
   - Hampir semua saham sempat menyentuh sekitar −15% intraday.
2. **7 saham lolos kelas A, yaitu tahan banting dan strukturnya utuh:** SMIL, MSJA, GULA, ULTJ, INTP, BDKR, PKPK. Yang paling bersih adalah **SMIL, ULTJ dan INTP**: likuid, bukan saham spekulatif, dan close kembali di atas pivot low dengan volume tinggi.
3. **Barang Konsumen Primer adalah sektor paling tahan.** Median sektornya −12,07%, terbaik dari semua sektor, dan menyumbang 3 saham kelas A serta 5 kelas B. Sektor lain yang menonjol: semen (INTP, CMNT) dan batu bara (BYAN, BSSR, PKPK).
4. **Ciri bersamanya adalah beta rendah.** Beta 60 hari saham kelas A berkisar 0,15–0,64. Selama sebulan terakhir, saham-saham ini juga jauh lebih baik dari IHSG: 20 hari +14,6 sampai +84,6pp di atas IHSG.
5. **Struktur ini baru terbentuk di satu candle.** Konfirmasinya baru ada pada hari bursa berikutnya (Senin 19 Okt). Level batal untuk tiap saham ada di [bagian 5](#5-level-konfirmasi--batal).

## Konteks

detikFinance ([IHSG Ambruk 11,57% ke 5.185 Dibayangi Ancaman Downgrade MSCI](https://finance.detik.com/bursa-dan-valas/d-8710354/ihsg-ambruk-11-57-ke-5-185-dibayangi-ancaman-downgrade-msci)):
- **Penyebab:** MSCI berencana menurunkan status Indonesia dari *Emerging Market* menjadi *Standalone Market* karena kekhawatiran soal aksesibilitas dan tata kelola pasar. Rencana ini masih konsultasi, dengan keputusan final paling lambat **30 Juni 2027**.
- **Transaksi:** Rp31,92 T, dengan 68,56 miliar lembar dan 2,13 juta kali transaksi.
- **Kinerja IHSG:** seminggu −14,91%, sebulan −19,50%, YTD −40,04%.
- **Koreksi data:** artikel menulis breadth "775 menguat, 10 melemah". Angka ini terbalik. Data Pasardana tanggal 16 Okt: **11 naik / 812 turun / 155 flat**.

## Sumber Data

| Data | Sumber | Kode di aplikasi |
|---|---|---|
| Daftar emiten, sektor, kapitalisasi, free float, nilai, frekuensi | Pasardana `StockSearchResult/GetAll` | [pasardana.ts](../src/data/external/pasardana.ts) → `mapToStockSummary` |
| OHLCV harian 1 tahun, IHSG 6 bulan | Yahoo Finance | [yahooFinance.ts](../src/data/external/yahooFinance.ts) |
| EMA, RSI14, RVOL, swing pivot | Fungsi aplikasi | `ema`, `rsi`, `computeRvolSeries`, `swingPivots` ([momentumSetups.ts](../src/domain/analysis/momentumSetups.ts)) |

- **Universe:** 223 saham likuid, dengan syarat:
  - rata-rata nilai 20 hari ≥ Rp5 M;
  - ada transaksi pada 16 Okt;
  - minimal 60 bar data.

  Saham sepi dibuang karena "tahan" di saham sepi biasanya hanya berarti tidak ada transaksi (contoh: AKKU, ALDO, TFCO di [studi 16 Okt](features_topgain_case_20261016.md)).
- **Validasi silang:** % 1D semua kandidat identik antara Yahoo dan Pasardana.

## Gambaran Pasar (223 saham likuid)

| | Nilai |
|---|---:|
| IHSG 1D / 5D / 20D | −11,57% / −14,91% / −19,50% |
| IHSG dari high 20 hari | −20,5% |
| Close position IHSG | 0% (ditutup di low) |
| Saham naik | **1** (BYAN) |
| Median return 1D | −14,44% |
| Tutup di ARB (−15%) | 77 (35%) |
| Turun ≥ 10% | 177 (79%) |
| Lebih baik dari IHSG + 6pp (turun < 5,6%) | 13 (6%) |

Median return 1D per sektor:

| Sektor | n | Median 1D | Kelas A | Kelas B | Kelas C |
|---|---:|---:|---:|---:|---:|
| **Barang Konsumen Primer** | 37 | **−12,07%** | **3** | **5** | 2 |
| Teknologi | 9 | −13,46% | — | 2 | — |
| Properti & Real Estat | 16 | −13,73% | — | 1 | 1 |
| Transportasi & Logistik | 7 | −13,89% | — | — | 1 |
| Keuangan | 20 | −14,14% | — | 1 | 1 |
| Perindustrian | 14 | −14,44% | 1 | 1 | — |
| Barang Konsumen Non-Primer | 34 | −14,45% | — | 2 | — |
| Kesehatan | 8 | −14,52% | — | — | — |
| Energi | 34 | −14,55% | 1 | 5 | — |
| Infrastruktur | 18 | −14,77% | 1 | — | 1 |
| Barang Baku | 26 | −14,78% | 1 | 1 | 1 |

## Metode

**Ketahanan relatif:** `rel1 = return 1D saham − return 1D IHSG`. Ini dilengkapi `rel5`, `rel20` dan beta 60 hari terhadap IHSG.

**Struktur pemulihan:** dibaca dari **close**, bukan dari low.
- Hampir semua saham sempat menyentuh sekitar −15% intraday. Karena itu syarat "low tidak menembus pivot" hampir tidak mungkin dipenuhi; versi awal screen dengan syarat itu menghasilkan 0 saham.
- Syarat yang dipakai: close kembali **di atas pivot low terakhir** (`swingPivots`, k = 2). Inilah reclaim atau *spring*: sempat menembus support, lalu ditutup kembali di atasnya.

| Kelas | Aturan |
|---|---|
| **A — Tahan & struktur utuh** | rel1 ≥ +4pp **dan** close position ≥ 60% **dan** close ≥ pivot low terakhir **dan** close > EMA50 |
| **B — Tahan, struktur belum jadi** | rel1 ≥ +4pp, tetapi gagal salah satu syarat lain |
| **C — Rebound intraday saja** | rel1 < +4pp, tetapi close position ≥ 60% dan close ≥ low + 5% |

Penanda tambahan:
- **spekulatif:** RSI > 80 atau naik > 50% dalam 20 hari;
- **tipis:** nilai < Rp5 M atau RVOL < 0,5.

## 1. Kelas A — Tahan & Struktur Utuh

| Saham | Sektor | 1D | rel1 | rel20 | Low intraday | Close pos | Pivot low (tgl) | Close | Jarak EMA50 | RVOL | Nilai | Beta | Kap. | Catatan |
|---|---|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---|
| **SMIL** | Perindustrian | 0,00% | +11,6 | +32,6 | −14,9% | 100% | 460 (13 Okt) | 482 | +12,0% | 1,64 | Rp47,9 M | 0,33 | Rp4,2 T | **Prioritas** |
| **ULTJ** | Kons. Primer | −3,83% | +7,7 | +17,1 | −13,2% | 83% | 2.000 (29 Sep) | 2.010 | +9,2% | 1,68 | Rp77,7 M | 0,35 | Rp20,9 T | **Prioritas** |
| **INTP** | Barang Baku | −4,19% | +7,4 | +18,5 | −15,0% | 89% | 4.900 (8 Okt) | 5.150 | +0,5% | 3,63 | Rp25,0 M | 0,54 | Rp17,7 T | **Prioritas**, *spring* |
| PKPK | Energi | −7,19% | +4,4 | +84,6 | −14,7% | 66% | 6.475 (8 Okt) | 7.100 | +33,3% | 2,99 | Rp93,9 M | 0,62 | Rp8,5 T | Spekulatif (+65% 20 hari) |
| BDKR | Infrastruktur | −5,91% | +5,7 | +29,6 | −14,5% | 73% | 155 (24 Sep) | 175 | +2,2% | 1,01 | Rp6,3 M | 0,64 | Rp0,8 T | Kapitalisasi kecil |
| GULA | Kons. Primer | −0,64% | +10,9 | +14,6 | −14,7% | 96% | 745 (1 Okt) | 775 | 0,0% | 0,60 | Rp7,2 M | 0,15 | Rp0,8 T | Kapitalisasi kecil, tepat di EMA50 |
| MSJA | Kons. Primer | 0,00% | +11,6 | +15,8 | −10,2% | 100% | 710 (1 Okt) | 785 | +12,2% | 0,15 | Rp2,0 M | 0,21 | Rp4,6 T | **Tipis**, free float 7,6% |

Catatan per saham:
- **SMIL**
  - Dibuka 422 (−12,4%) dan sempat ke 410 (−14,9%).
  - Lalu naik terus dan ditutup di high 482, sama dengan harga kemarin.
  - Volume 99 jt lembar, tertinggi dalam 7 hari: ada pembeli yang menampung semua tekanan jual.
  - Masih di atas EMA20 dan EMA50, dan hanya 3,6% di bawah high 20 hari. Struktur terbersih di seluruh universe.
- **ULTJ**
  - Sempat ke 1.815 (−13,2%), lalu ditutup 2.010, persis di atas pivot 2.000.
  - Volume 38,7 jt lembar, sekitar 3–4× rata-rata harian minggu itu.
  - Reclaim-nya tipis, sehingga level 2.000 menjadi penentu.
- **INTP**
  - *Spring* klasik: menembus pivot 4.900 sampai 4.570 (ARB), lalu ditutup 5.150.
  - Volume 4,9 jt lembar, tertinggi seminggu (RVOL 3,63).
  - Close masih di atas EMA20 dan EMA50.
- **PKPK**
  - Dibuka dekat ARB (6.525), lalu rebound ke 7.100 dengan volume 13,2 jt lembar (4× hari biasa).
  - Low-nya tidak menembus pivot 6.475, satu-satunya saham kelas A yang begitu.
  - Tetapi ini saham momentum (+65% dalam 20 hari, 33% di atas EMA50), jadi risikonya lebih ke pembalikan momentum daripada ke pasar.
- **MSJA**
  - "Tahan" karena hampir tidak ada transaksi: RVOL 0,15, nilai Rp2 M, free float 7,6%.
  - Ini bukan bukti ada permintaan, jadi diperlakukan seperti kasus volume 0 di studi sebelumnya.

## 2. Kelas B — Tahan, Struktur Belum Jadi (18 saham)

| Saham | Sektor | 1D | rel1 | Close pos | Yang belum terpenuhi | Catatan |
|---|---|---:|---:|---:|---|---|
| **BYAN** | Energi | **+0,45%** | +12,0 | 87% | Close 11.150 < pivot 11.525, di bawah EMA50 (−9,4%) | Satu-satunya saham likuid yang naik. Sempat −14,9% lalu rebound 18%. Rel20 hanya +0,2, jadi sebulan terakhir bergerak sama dengan IHSG. |
| **CMNT** | Barang Baku | −0,66% | +10,9 | 88% | Close 0,2% di bawah EMA50 | Low hanya −5,3%, beta −0,05, rel20 +18,2. **Nyaris kelas A**, tapi frekuensinya rendah (245 kali). |
| **INDF** | Kons. Primer | −4,68% | +6,9 | 72% | Di bawah EMA20 dan EMA50 | Nilai **Rp202 M, RVOL 5,3**, penampungan terbesar di daftar ini. Reclaim pivot 6.600 tipis (close 6.625). |
| MARK | Perindustrian | −2,28% | +9,3 | 93% | Close 1.070 < pivot 1.085, di bawah EMA50 | Rebound 14,4% dari low |
| BJBR | Keuangan | −4,67% | +6,9 | 79% | Di bawah pivot dan EMA | RSI 24,8 (oversold) |
| ENRG | Energi | −4,86% | +6,7 | 100% | Di bawah pivot dan EMA | **Rel20 −13,1, beta 1,45.** Lebih tepat disebut rebound daripada tahan. |
| HMSP | Kons. Primer | −5,43% | +6,1 | 46% | Close position rendah, di bawah EMA | |
| BSSR | Energi | −5,90% | +5,7 | 69% | Close 4.940 < pivot 5.050 | Masih di atas EMA50 |
| SGER | Energi | −7,14% | +4,4 | 63% | Close 715 < pivot 745 | Masih di atas EMA50 |
| MYOR, AUTO, BUKA, AYAM, STAA, GPRA, BSML | — | −6,2 s.d. −7,5% | +4,1 s.d. +5,4 | 42–73% | Di bawah EMA50 | GPRA, BSML dan STAA tipis |
| GOTO | Teknologi | −7,41% | +4,2 | 50% | Di bawah EMA50 | Rel20 −30,5 |
| BIKE | Kons. Non-Primer | −3,89% | +7,7 | 44% | Close position rendah | **Spekulatif** (+272% 20 hari, RSI 91). Bukan saham tahan banting, tetapi saham panas dari [studi topgain](features_topgain_case_20261015.md). |

## 3. Kelas C — Rebound Intraday Saja (7 saham)

| Saham | Sektor | 1D | rel1 | Close pos | Rebound dari low |
|---|---|---:|---:|---:|---:|
| MPXL | Transportasi | −7,74% | +3,8 | 73% | +8,3% (tipis, spekulatif) |
| CTRA | Properti | −8,47% | +3,1 | 64% | +6,9% |
| EMAS | Barang Baku | −8,44% | +3,1 | 74% | +7,6% |
| SUPA | Keuangan | −9,09% | +2,5 | 100% | +7,0% (RSI 17,4) |
| ICBP | Kons. Primer | −9,35% | +2,2 | 65% | +6,3% |
| AALI | Kons. Primer | −9,54% | +2,0 | 64% | +6,1% |
| PGEO | Infrastruktur | −10,20% | +1,4 | 82% | +5,4% |

Saham-saham ini sempat di ARB lalu ada pembelinya, tetapi turunnya tetap hampir sedalam pasar. Close masih di bawah pivot dan EMA50.

## 4. Pola

**1. Defensif dan beta rendah.**
- Sektor paling tahan adalah Barang Konsumen Primer (ULTJ, INDF, GULA, MYOR, HMSP, ICBP).
- Saham kelas A punya beta 0,15–0,64. Ketahanannya juga bukan hanya hari itu: rel20 semuanya positif besar.

**2. Aliran dana yang menampung terlihat dari RVOL.**
- Pembeda antara saham yang benar-benar tahan dan yang tahan karena sepi adalah volume.
- SMIL, ULTJ, INTP, INDF dan PKPK naik dengan RVOL 1,6–5,3.
- MSJA dan GULA tahan dengan RVOL < 1, sehingga lebih rapuh.

**3. *Spring* lebih umum daripada higher low.**
- Pada hari crash, hampir semua support sempat jebol intraday.
- Yang membedakan adalah close-nya kembali di atas support (INTP, ULTJ, SMIL) atau tetap di bawah (BYAN, MARK, BSSR, SGER).

**4. Sektor saham Top 5 topgain sebelumnya tidak ikut tahan.** Barang Konsumen Non-Primer (sektor topgain terbanyak 14–15 Okt) median −14,45% dan tidak punya saham kelas A. Rotasi spekulatif tidak memberi perlindungan saat pasar crash.

## 5. Level Konfirmasi & Batal

Struktur kelas A dianggap **berlanjut** jika pada hari-hari berikutnya close tetap di atas pivot low. Struktur dianggap **batal** jika close kembali di bawah pivot. Jika low hari crash juga tembus, struktur gagal sepenuhnya.

| Saham | Close 16 Okt | Pivot (batal jika close di bawah) | Low hari crash (gagal penuh) | Jarak close → pivot |
|---|---:|---:|---:|---:|
| SMIL | 482 | 460 | 410 | −4,6% |
| ULTJ | 2.010 | 2.000 | 1.815 | **−0,5%** |
| INTP | 5.150 | 4.900 | 4.570 | −4,9% |
| PKPK | 7.100 | 6.475 | 6.525 | −8,8% |
| BDKR | 175 | 155 | 159 | −11,4% |
| GULA | 775 | 745 | 665 | −3,9% |
| MSJA | 785 | 710 | 705 | −9,6% |

Margin ULTJ sangat tipis: turun 0,5% saja sudah menembus pivot.

## Kesimpulan

Saat IHSG −11,57%, yang benar-benar tahan dan mulai membentuk struktur pemulihan adalah **SMIL, ULTJ dan INTP**. Ketiganya likuid dan berbeta rendah. Close-nya kembali di atas pivot low dan di atas EMA50, dengan volume penampungan yang tinggi. Daftar pantauan kedua:
- **CMNT**, karena nyaris kelas A;
- **INDF**, karena penampungannya terbesar tetapi masih di bawah EMA;
- **BYAN**, satu-satunya saham likuid yang naik, tetapi close-nya belum di atas pivot.

Polanya: **defensif (konsumen primer, semen) + beta rendah + volume tinggi + close kembali di atas support**. Saham panas dari rotasi topgain sebelumnya tidak memberi perlindungan.

Ancaman downgrade MSCI masih berjalan sampai keputusan Juni 2027, jadi risiko arus keluar asing belum selesai. Struktur dari satu candle baru bisa dikonfirmasi oleh perilaku harga pada hari-hari berikutnya.

## Keterbatasan

- **Baru satu hari pasca-crash.** Tidak ada hari lanjutan untuk mengonfirmasi struktur, dan kelas A bisa berubah total pada Senin 19 Okt.
- **Tidak ada data asing atau broker summary.** "Penampungan" hanya disimpulkan dari volume dan close position, bukan dari identitas pembeli.
- **Kemungkinan trading halt** (tag artikel). Bentuk candle intraday bisa terpengaruh oleh jeda perdagangan.
- **Pivot memakai k = 2.** Pivot lain (k = 3 atau 5) bisa memberi level berbeda.
- **Threshold rel1 diturunkan dari +6pp menjadi +4pp** setelah versi awal (syarat low di atas pivot) menghasilkan 0 saham di hari crash.
- **ARB diasumsikan 15%** dan nilai transaksi dihitung sebagai `close × volume`.
- Kapitalisasi dan free float adalah snapshot Pasardana tanggal 16 Okt 2026.

## Cara Menjalankan Ulang

Dari root proyek, setelah bursa tutup. Argumen pertama adalah folder output:

```bash
./node_modules/.bin/tsx --tsconfig tsconfig.json crashres.ts ./out
```

Hasilnya `crashres_result.json` berisi `mkt`, `dist`, `sectors`, `A`, `B` dan `C`. Hari H adalah bar IHSG terakhir.

```ts
// crashres.ts — saham yang tahan saat IHSG crash & mulai membentuk struktur pemulihan
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapToStockSummary, PASARDANA_LIST_URL } from '@/data/external/pasardana';
import { fetchYahooDailyBars, fetchYahooIndexBars } from '@/data/external/yahooFinance';
import { swingPivots } from '@/domain/analysis/momentumSetups';
import { computeRvolSeries } from '@/domain/history/volumeEvents';
import { closes, ema } from '@/domain/indicators/movingAverages';
import { rsi } from '@/domain/indicators/rsi';
import { OHLCVBar } from '@/domain/models/History';
import { mapWithConcurrency } from '@/lib/concurrency';

const MIN_AVG_VALUE = 5e9, ARB = 0.15, REL_MIN = 4, CLOSEPOS_MIN = 60;
const OUT = process.argv[2] ?? '.';
const withTimeout = <V>(p: Promise<V>, ms: number, fb: V) =>
  Promise.race([p.catch(() => fb), new Promise<V>((r) => setTimeout(() => r(fb), ms))]);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const r1 = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

(async () => {
  const list: any[] = await (await fetch(PASARDANA_LIST_URL)).json();
  const pd = new Map(list.map((x) => [x.Code, x]));
  const universe = list.filter((x) => x.Code && x.Last > 0).map(mapToStockSummary);
  const ihsg = (await fetchYahooIndexBars('^JKSE', '6mo')).bars;
  const iD = ihsg.length - 1, D0 = ihsg[iD].date.slice(0, 10);
  const ix = new Map(ihsg.map((b, k) => [b.date.slice(0, 10), k]));
  const iRet = (n: number) => (ihsg[iD].close / ihsg[iD - n].close - 1) * 100;
  const iHi20 = Math.max(...ihsg.slice(iD - 20, iD).map((b) => b.high));
  const mkt = { D0, ihsg: ihsg[iD].close, ret1: iRet(1), ret5: iRet(5), ret20: iRet(20), dd20: (ihsg[iD].close / iHi20 - 1) * 100,
    closePos: ((ihsg[iD].close - ihsg[iD].low) / (ihsg[iD].high - ihsg[iD].low)) * 100 };
  console.error(`D0=${D0} IHSG ${mkt.ret1.toFixed(2)}% universe=${universe.length}`);

  const rows: any[] = [];
  await mapWithConcurrency(universe, 8, async (s) => {
    const res = await withTimeout(fetchYahooDailyBars(s.ticker, '1y'), 20000, { ok: false, bars: [] } as any);
    const bars: OHLCVBar[] = (res.bars ?? []).filter((b: OHLCVBar) => b.close > 0 && b.date.slice(0, 10) <= D0);
    if (!res.ok || bars.length < 60) return;
    const i = bars.length - 1, cur = bars[i], prev = bars[i - 1];
    if (cur.date.slice(0, 10) !== D0 || cur.volume === 0) return;
    const val20 = avg(bars.slice(i - 20, i).map((b) => b.close * b.volume));
    if (val20 < MIN_AVG_VALUE) return;
    const c = closes(bars), e20 = ema(c, 20), e50 = ema(c, 50), rsi14 = rsi(bars, 14), rvol = computeRvolSeries(bars);
    const ret = (n: number) => (cur.close / bars[i - n].close - 1) * 100;
    const hi20 = Math.max(...bars.slice(i - 20, i).map((b) => b.high));
    const lo20 = Math.min(...bars.slice(i - 20, i).map((b) => b.low));
    // beta 60 hari terhadap IHSG (tanggal dicocokkan)
    const xs: number[] = [], ys: number[] = [];
    for (let j = i - 60; j <= i; j++) {
      const k = ix.get(bars[j].date.slice(0, 10)), kp = ix.get(bars[j - 1].date.slice(0, 10));
      if (k == null || kp == null || k - kp !== 1) continue;
      xs.push(ihsg[k].close / ihsg[kp].close - 1); ys.push(bars[j].close / bars[j - 1].close - 1);
    }
    const mx = avg(xs), my = avg(ys);
    const beta = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    // pivot low terakhir yang terkonfirmasi sebelum D0 (pivot butuh 2 bar kanan, jadi dihitung dari bar s.d. t−1)
    const piv = swingPivots(bars.slice(0, i), 2).lows;
    const lastPiv = piv[piv.length - 1];
    const prevPiv = piv[piv.length - 2];
    const p = pd.get(s.ticker);
    rows.push({
      ticker: s.ticker, sector: s.sector, capT: r1(s.capitalization / 1e12, 1), ff: s.freeFloat,
      prevClose: prev.close, open: cur.open, high: cur.high, low: cur.low, close: cur.close,
      ret1: r1(ret(1), 2), ret5: r1(ret(5)), ret20: r1(ret(20)),
      rel1: r1(ret(1) - mkt.ret1), rel5: r1(ret(5) - mkt.ret5), rel20: r1(ret(20) - mkt.ret20),
      dd20: r1((cur.close / hi20 - 1) * 100), beta: r1(beta, 2),
      closePos: r1(cur.high > cur.low ? ((cur.close - cur.low) / (cur.high - cur.low)) * 100 : 50, 0),
      lowDay: r1((cur.low / prev.close - 1) * 100), rebound: r1((cur.close / cur.low - 1) * 100),
      atArb: cur.close <= Math.ceil(prev.close * (1 - ARB)) , distArb: r1((cur.close / (prev.close * (1 - ARB)) - 1) * 100),
      rvol: r1(rvol[i], 2), valueM: r1((cur.close * cur.volume) / 1e9, 1), avgValue20M: r1(val20 / 1e9, 1),
      pivLow: lastPiv?.price ?? null, pivLowDate: lastPiv ? bars[lastPiv.index].date.slice(0, 10) : null,
      pivHL: lastPiv && prevPiv ? lastPiv.price > prevPiv.price : null,
      holdsPiv: lastPiv ? cur.low > lastPiv.price : false, newLow20: cur.low < lo20,
      aboveE20: cur.close > e20[i], aboveE50: cur.close > e50[i],
      distE20: r1((cur.close / e20[i] - 1) * 100), distE50: r1((cur.close / e50[i] - 1) * 100),
      rsi: r1(rsi14[i]), pdLast: p?.Last, pdPct: r1((p?.OneDay ?? NaN) * 100, 2), pdValueM: r1((p?.Value ?? 0) / 1e9, 1), pdFreq: p?.Frequency,
    });
  });

  // Hampir semua saham menyentuh ~−15% intraday, jadi "low tidak tembus pivot" hampir mustahil.
  // Struktur dibaca dari CLOSE: kembali di atas pivot low terakhir (reclaim / spring) dan di atas EMA50.
  for (const r of rows) {
    r.reclaim = r.pivLow != null && r.close >= r.pivLow;
    r.spec = r.rsi > 80 || r.ret20 > 50;
    r.thin = r.valueM < 5 || r.rvol < 0.5;
    const resilient = r.rel1 >= REL_MIN;
    r.cls = resilient && r.closePos >= CLOSEPOS_MIN && r.reclaim && r.aboveE50 ? 'A'
      : resilient ? 'B'
      : r.closePos >= CLOSEPOS_MIN && r.rebound >= 5 ? 'C' : '-';
  }
  const by = (c: string) => rows.filter((r) => r.cls === c).sort((a, b) => b.rel1 - a.rel1 || b.rel20 - a.rel20);
  const sectors: any = {};
  for (const r of rows) { const s = (sectors[r.sector] ??= { n: 0, A: 0, B: 0, C: 0, ret1: [] as number[] }); s.n++; s.ret1.push(r.ret1); if (r.cls !== '-') s[r.cls]++; }
  for (const s of Object.values<any>(sectors)) { const v = [...s.ret1].sort((a, b) => a - b); s.medRet1 = v[Math.floor(v.length / 2)]; delete s.ret1; }
  const dist = { atArb: rows.filter((r) => r.atArb).length, le10: rows.filter((r) => r.ret1 <= -10).length, gtM5: rows.filter((r) => r.ret1 > -5.57).length, up: rows.filter((r) => r.ret1 > 0).length, n: rows.length,
    median: [...rows.map((r) => r.ret1)].sort((a, b) => a - b)[Math.floor(rows.length / 2)] };
  const out = { mkt, dist, sectors, A: by('A'), B: by('B'), C: by('C') };
  writeFileSync(join(OUT, 'crashres_result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ mkt, dist, nA: out.A.length, nB: out.B.length, nC: out.C.length }));
  process.exit(0);
})();
```
