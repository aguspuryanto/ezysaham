# Studi Kasus Top Gainer — 15 Oktober 2026 vs 14 Oktober 2026

Dijalankan: 15 Oktober 2026, setelah penutupan bursa · Definisi, fitur dan aturan arketipe sama dengan [features_topgain_patterns.md](features_topgain_patterns.md)

Tujuan: menganalisa Top 5 Gainer hari ini, membandingkannya dengan kondisi 1 hari sebelumnya, dan mencari pola kenapa saham-saham itu masuk Top 5. Ini **bukan** rekomendasi BUY/WAIT.

> Hasil statistik dari data EOD, bukan rekomendasi investasi. Korelasi ≠ sebab.

## Ringkasan

1. **Kelima saham di Top 5 sudah "panas" sebelum hari ini.** Tiga sudah naik ≥ 25% dalam 20 hari, dua lainnya baru saja ARA atau topgain.
2. **Ada dua jalur masuk.** Pertama, saham panas yang turun sehari lalu dibeli lagi (AKKU, SBMA). Kedua, saham sepi dengan free float kecil yang naiknya berlanjut sampai ARA (ALDO, PTSP, TFCO).
3. **Rotasi terkonsentrasi di dua sektor**, Barang Konsumen Non-Primer dan Barang Baku, masing-masing dengan 3 topgain.
4. **Semuanya naik walaupun IHSG turun −1,33%.** Namun jumlah topgain hari itu hanya 9, di bawah median studi (13).
5. **Top 5 kemarin tidak berlanjut.** Tidak ada yang masuk Top 5 lagi, median return hari ini −2,3%, dan hanya 2 dari 5 yang naik.

## Sumber Data

| Data | Sumber | Kode di aplikasi |
|---|---|---|
| Daftar emiten, sektor, kapitalisasi, free float | Pasardana `StockSearchResult/GetAll` | [pasardana.ts](../src/data/external/pasardana.ts) → `mapToStockSummary` |
| OHLCV harian 1 tahun | Yahoo Finance `v8/finance/chart/{KODE}.JK` | [yahooFinance.ts](../src/data/external/yahooFinance.ts) → `fetchYahooDailyBars` |
| IHSG harian | Yahoo `^JKSE` | `fetchYahooIndexBars` |
| EMA, RSI14, ATR, RVOL, high 20 hari, tick IDX | Fungsi aplikasi | `ema`, `rsi`, `atr`, `computeRvolSeries`, `priorHigh`, `idxTickSize` |

Universe: 978 emiten Pasardana. Validasi silang: close dan % 1D kelima saham Top 5 identik dengan Pasardana bertanggal 15 Oktober 2026.

## Gambaran Pasar

| | 14 Okt 2026 | 15 Okt 2026 |
|---|---:|---:|
| IHSG | +0,29% | **−1,33%** |
| Jumlah topgain (≥ 10%, nilai ≥ Rp1 M) | 14 | **9** |

- **Topgain 15 Okt:** AKKU +34,62%, ALDO +24,92%, PTSP +24,72%, TFCO +24,61%, SBMA +19,35%, DKHH +13,73%, PCAR +12,66%, MPIX +11,68%, SQMI +11,11%
- **Topgain 14 Okt:** TRON +34,67%, SONA +25%, BIKE +24,92%, STRK +18,89%, KBLV +18,37%, GRPH +18,18%, MGNA +18,12%, ROCK +17,26%, BAIK +15,57%, SICO +12,17%, ALDO +11,79%, BELI +11,35%, HATM +10,74%, SAFE +10,47%

Sebaran sektor topgain:

| Sektor | 14 Okt | 15 Okt |
|---|---:|---:|
| Barang Konsumen Non-Primer | **5** | **3** |
| Barang Baku | 1 | **3** |
| Teknologi | 2 | 1 |
| Transportasi & Logistik | 2 | — |
| Barang Konsumen Primer | 1 | 1 |
| Kesehatan | — | 1 |
| Infrastruktur, Properti, Energi | 1 masing-masing | — |

## 1. Top 5 Gainer 15 Oktober 2026 — Hari H

| # | Saham | Sektor | Naik | Prev → Close | Nilai | Tutup ARA | Close pos | RVOL | Tembus high 20 hari | Gap | Arketipe |
|---|---|---|---:|---|---:|:-:|---:|---:|:-:|---:|---|
| 1 | AKKU | Kons. Non-Primer | +34,62% | 78 → 105 | Rp30,6 M | ✅ | 100% | 5,29 | ✅ | 0% | Lanjutan momentum |
| 2 | ALDO | Barang Baku | +24,92% | 1.565 → 1.955 | Rp3,8 M | ✅ | 100% | 3,68 | ✅ | 0% | Lanjutan momentum |
| 3 | PTSP | Kons. Non-Primer | +24,72% | 1.335 → 1.665 | Rp2,7 M | ✅ | 100% | 12,07 | ✅ | +3,4% | Rotasi sektor |
| 4 | TFCO | Kons. Non-Primer | +24,61% | 1.605 → 2.000 | Rp1,3 M | ✅ | 100% | 5,70 | ✅ | +23,7% | Lanjutan momentum |
| 5 | SBMA | Barang Baku | +19,35% | 124 → 148 | Rp25,2 M | ❌ | 63% | 10,43 | ❌ (high 20 hari 149) | +2,4% | Lanjutan momentum |

Catatan per saham:
- **AKKU** dibuka tepat di harga kemarin (78), lalu naik sepanjang sesi sampai ARA 35% (batas untuk harga < Rp200). Nilai transaksinya terbesar di Top 5.
- **ALDO** juga dibuka di harga kemarin, lalu naik sampai ARA.
- **TFCO** dibuka dengan gap +23,7%, hampir langsung di ARA.
- **SBMA** sempat menyentuh 164 tetapi ditutup di 148. Ini satu-satunya yang tidak tutup di ARA dan tidak tembus high 20 hari, jadi ada tekanan jual di atas.

## 2. Komparasi dengan 1 Hari Sebelumnya (kondisi t−1 = 14 Okt)

| Saham | Perubahan 14 Okt | Naik 20 hari | Naik 5 hari | RSI t−1 | Jarak dari EMA20 | Range 10 hari | RVOL t−1 | Rata-rata RVOL 5 hari | Topgain dalam 20 hari | Rata-rata nilai 20 hari | Free float | Kapitalisasi |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| AKKU | **−7,14%** | +105,3% | +9,9% | 73,4 | +32,3% | 83,3% | 0,83 | 3,74 | 4× | Rp2,93 M | 56,9% | Rp0,7 T |
| ALDO | **+11,79% (topgain)** | +63,0% | +22,7% | 81,8 | +31,1% | 45,4% | 5,27 | 1,69 | 1× | Rp0,55 M | 13,7% | Rp5,3 T |
| PTSP | **+24,77% (ARA, nilai < Rp1 M)** | +8,5% | +24,2% | 64,1 | +15,6% | 26,2% | 7,56 | 3,65 | 0 | Rp0,07 M | 31,4% | Rp0,4 T |
| TFCO | **0% (volume 0)** | +100,6% | +94,5% | 81,5 | +56,7% | 54,2% | 0 | 2,77 | 0 | Rp0,09 M | 10,8% | Rp9,6 T |
| SBMA | **−13,89%** | +10,7% | +13,8% | 58,2 | +8,5% | 35,5% | 5,26 | 4,40 | 1× (13 Okt +29,7%) | Rp1,06 M | 22,0% | Rp0,1 T |

Kondisi pra-topgain dari studi, dicocokkan dengan Top 5 hari ini:

| Kondisi pada t−1 | Lift di studi | Memenuhi | Saham |
|---|---:|:-:|---|
| Rata-rata RVOL 5 hari ≥ 1,5 | 1,93× | **5/5** | semua |
| Close > EMA20 + 10% | 3,88× | 4/5 | AKKU, ALDO, PTSP, TFCO |
| Range 10 hari > 30% | 2,70× | 4/5 | AKKU, ALDO, TFCO, SBMA (PTSP 26%) |
| Naik ≥ 25% dalam 20 hari | 3,56× | 3/5 | AKKU, ALDO, TFCO |
| RSI > 70 | 3,52× | 3/5 | AKKU, ALDO, TFCO |
| Naik ≥ 10% dalam 5 hari | 3,07× | 4/5 | ALDO, PTSP, TFCO, SBMA |
| Pernah topgain dalam 20 hari | 2,18× | 3/5 | AKKU, ALDO, SBMA |
| Hari t−1 turun ≥ 5% | 2,46× | 2/5 | AKKU, SBMA |
| RVOL t−1 ≥ 2 | 2,35× | 3/5 | ALDO, PTSP, SBMA |
| Range 10 hari < 8% (konsolidasi sempit) | 0,19× | **0/5** | — |

*Pernah topgain* di sini mengikuti definisi studi, yaitu naik ≥ 10% dengan nilai ≥ Rp1 M. Karena itu ARA PTSP pada 14 Okt tidak terhitung, sebab nilainya di bawah Rp1 M.

## 3. Pola — Kenapa Masuk Top 5 Hari Ini

**1. Saham yang sedang panas, bukan yang tenang.** Kelima saham sudah bergerak besar sebelum hari H, dan tidak ada yang berasal dari konsolidasi sempit. Ini sejalan dengan temuan utama studi: 60% topgain terjadi di saham yang baru saja topgain atau naik besar.

**2. Volatilitas dan volume sudah naik lebih dulu.** Rata-rata RVOL 5 hari ≥ 1,5 ada di kelima saham, dan range 10 hari > 30% ada di 4 dari 5 saham.

**3. Dua jalur masuk yang terlihat dari perbandingan dengan kemarin:**

| Jalur | Saham | Ciri |
|---|---|---|
| **Turun dulu, lalu dibeli lagi** | AKKU, SBMA | Saham panas yang terkoreksi sehari (−7,1% dan −13,9%), lalu langsung diserbu lagi. Nilai transaksinya besar (Rp25–31 M). |
| **Kenaikan berlanjut di saham sepi** | ALDO, PTSP, TFCO | Kemarin topgain, ARA, atau tidak ada transaksi. Rata-rata nilai 20 hari < Rp1 M dan free float kecil (ALDO 13,7%, TFCO 10,8%). Pembeli dalam jumlah kecil sudah cukup untuk mengunci harga di ARA. |

**4. Rotasi sektor.**
- Barang Konsumen Non-Primer tetap menjadi sektor topgain terbanyak dua hari berturut-turut (5 kemarin, lalu 3 hari ini).
- Barang Baku naik dari 1 kemarin menjadi 3 hari ini.

**5. Tidak bergantung pada IHSG.** Kelima saham naik besar saat IHSG −1,33%. Namun pasar yang turun mengurangi jumlah topgain, dari 14 kemarin menjadi 9 hari ini.

**6. Ciri hari H sesuai studi.** Semua saham punya RVOL ≥ 3,7. Empat dari lima tutup di ARA, dengan close position 100% dan tembus high 20 hari.

## 4. Nasib Top 5 Kemarin (14 Okt) pada Hari Ini

| Saham | Arketipe 14 Okt | 14 Okt | Tutup ARA 14 Okt | 15 Okt | Close pos 15 Okt | RVOL 15 Okt | Nilai 15 Okt |
|---|---|---:|:-:|---:|---:|---:|---:|
| TRON | Rebound oversold | +34,67% | ✅ | **−14,85%** | 0% | 3,86 | Rp13,3 M |
| SONA | Lanjutan momentum | +25,00% | ✅ | −2,32% | 2% | 3,24 | Rp1,7 M |
| BIKE | Lanjutan momentum | +24,92% | ✅ | **+5,05%** | 59% | 4,53 | Rp52,8 M |
| STRK | Lanjutan momentum | +18,89% | ❌ | +0,93% | 53% | 1,56 | Rp17,1 M |
| KBLV | Rebound oversold | +18,37% | ❌ | −5,17% | 55% | 1,07 | Rp2,3 M |

- **Tidak satu pun Top 5 kemarin masuk Top 5 hari ini.** Hanya ALDO (peringkat 11 kemarin) yang topgain lagi.
- Median return hari ini −2,3%, dan 2 dari 5 naik. Ini sejalan dengan studi (median t+1 −2,0%, 34% naik).
- Dari tiga saham yang tutup di ARA kemarin, hanya BIKE yang naik hari ini. TRON dan SONA justru ditutup di dekat low hari ini.
- **Komposisinya bergeser.** Kemarin ada dua saham rebound dari oversold (TRON, KBLV). Hari ini seluruh Top 5 adalah saham yang sedang panas.

## Kesimpulan

Top 5 Gainer 15 Oktober 2026 adalah **saham spekulatif yang sudah panas**. Ada dua jalannya: koreksi sehari lalu dibeli lagi (AKKU, SBMA), atau kenaikan yang berlanjut sampai ARA di saham sepi berfloat kecil (ALDO, PTSP, TFCO). Rotasinya terkonsentrasi di Barang Konsumen Non-Primer dan Barang Baku, dan semuanya terjadi saat IHSG melemah.

Berdasarkan studi 6 bulan dan hasil Top 5 kemarin, peluang lanjut besok rendah. Tiga saham yang sepi (ALDO, PTSP, TFCO) juga berisiko sulit dijual ketika arah berbalik. Ini sejalan dengan aturan "jangan kejar harga" di [features_topgain.md](features_topgain.md).

## Keterbatasan

- **TFCO tidak punya transaksi sama sekali pada 14 Okt (volume 0).** Bisa suspensi atau cooling-down, tetapi tanpa data pengumuman bursa penyebabnya tidak bisa dipastikan.
- Tidak ada data berita, aksi korporasi atau broker summary. Analisis ini hanya melihat jejak harga dan volume.
- Studi kasus satu hari (n = 5). Pola di sini adalah ilustrasi dari temuan studi 6 bulan, bukan bukti statistik baru.
- Kapitalisasi dan free float adalah snapshot Pasardana 15 Oktober 2026. Nilai transaksi dihitung sebagai `close × volume` (aproksimasi).

## Cara Menjalankan Ulang

Jalankan dari root proyek, setelah bursa tutup. Argumen pertama adalah folder output:

```bash
./node_modules/.bin/tsx --tsconfig tsconfig.json top5today.ts ./out
```

Hari H adalah bar IHSG terakhir, dan pembandingnya bar sebelumnya. Hasilnya `top5_result.json`.

```ts
// top5today.ts — Top 5 gainer hari ini vs kemarin, fitur mengikuti docs/features_topgain_patterns.md
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

const GAIN = 0.10, MIN_VALUE = 1e9, MAX_CHANGE = 0.35;
const araLimit = (prev: number) => (prev <= 200 ? 0.35 : prev <= 5000 ? 0.25 : 0.2);
const OUT = process.argv[2] ?? '.';
const withTimeout = <V>(p: Promise<V>, ms: number, fb: V) =>
  Promise.race([p.catch(() => fb), new Promise<V>((r) => setTimeout(() => r(fb), ms))]);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

(async () => {
  const list: any[] = await (await fetch(PASARDANA_LIST_URL)).json();
  const pd = new Map(list.map((x) => [x.Code, x]));
  const universe = list.filter((x) => x.Code && x.Last > 0).map(mapToStockSummary);
  const ihsg = (await fetchYahooIndexBars('^JKSE', '3mo')).bars;
  const D0 = ihsg[ihsg.length - 1].date.slice(0, 10), D1 = ihsg[ihsg.length - 2].date.slice(0, 10);
  const ihsgChg = (d: string) => { const k = ihsg.findIndex((b) => b.date.slice(0, 10) === d); return ihsg[k].close / ihsg[k - 1].close - 1; };
  console.error(`D0=${D0} D1=${D1} universe=${universe.length}`);

  const rows: any[] = [];
  let fetched = 0;
  await mapWithConcurrency(universe, 8, async (s) => {
    const res = await withTimeout(fetchYahooDailyBars(s.ticker, '1y'), 20000, { ok: false, bars: [] } as any);
    if (++fetched % 200 === 0) console.error(`fetched ${fetched}`);
    const bars: OHLCVBar[] = (res.bars ?? []).filter((b: OHLCVBar) => b.close > 0 && b.date.slice(0, 10) <= D0);
    if (!res.ok || bars.length < 60) return;
    const c = closes(bars), ema20 = ema(c, 20), ema50 = ema(c, 50), rsi14 = rsi(bars, 14);
    const atr14 = atr(bars, 14), atr50 = atr(bars, 50), rvol = computeRvolSeries(bars);
    const chgAt = (i: number) => bars[i].close / bars[i - 1].close - 1;
    const feat = (i: number) => {
      const cur = bars[i], prev = bars[i - 1];
      let lo = Infinity, lo10 = Infinity, hi10 = -Infinity, top20 = 0; const val20: number[] = [];
      for (let j = 0; j < i; j++) lo = Math.min(lo, bars[j].low);
      for (let j = i - 10; j < i; j++) { lo10 = Math.min(lo10, bars[j].low); hi10 = Math.max(hi10, bars[j].high); }
      for (let j = i - 20; j < i; j++) { val20.push(bars[j].close * bars[j].volume); if (j > 0 && chgAt(j) >= GAIN && bars[j].close * bars[j].volume >= MIN_VALUE) top20++; }
      const araRaw = prev.close * (1 + araLimit(prev.close));
      const araPrice = Math.floor(araRaw / idxTickSize(araRaw)) * idxTickSize(araRaw);
      const r = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
      return {
        date: cur.date.slice(0, 10), open: cur.open, high: cur.high, low: cur.low, close: cur.close, prevClose: prev.close,
        chg: r(chgAt(i) * 100, 2), valueM: r((cur.close * cur.volume) / 1e9, 2),
        // t−1 (pra)
        rsiPrev: r(rsi14[i - 1]), distEma20Prev: r((prev.close / ema20[i - 1] - 1) * 100), emaUpPrev: ema20[i - 1] > ema50[i - 1],
        ret5Prev: r((prev.close / bars[i - 6].close - 1) * 100), ret20Prev: r((prev.close / bars[i - 21].close - 1) * 100),
        chgPrev: r(chgAt(i - 1) * 100, 2), rvolPrev: r(rvol[i - 1], 2), rvol5Prev: r(avg(rvol.slice(i - 5, i).filter(Number.isFinite)), 2),
        range10Prev: r(((hi10 - lo10) / prev.close) * 100), atrRatioPrev: r(atr14[i - 1] / atr50[i - 1], 2),
        distLowPrev: r((prev.close / lo - 1) * 100), topgain20: top20, avgValue20M: r(avg(val20) / 1e9, 2),
        // hari H
        gap: r((cur.open / prev.close - 1) * 100, 2), closePos: r(cur.high > cur.low ? ((cur.close - cur.low) / (cur.high - cur.low)) * 100 : 50, 0),
        rvolDay: r(rvol[i], 2), breakout20: cur.close > priorHigh(bars, i), high20: priorHigh(bars, i),
        atAra: cur.close >= araPrice - idxTickSize(araPrice) && cur.close >= cur.high, araPrice,
        rsiDay: r(rsi14[i]), distEma20Day: r((cur.close / ema20[i] - 1) * 100),
      };
    };
    const i0 = bars.length - 1;
    if (bars[i0].date.slice(0, 10) !== D0 || bars[i0 - 1].date.slice(0, 10) !== D1) return;
    for (const i of [i0, i0 - 1]) {
      if (bars[i].volume === 0 || Math.abs(chgAt(i)) > MAX_CHANGE + 0.005) continue;
      rows.push({ ticker: s.ticker, sector: s.sector, capT: Math.round(s.capitalization / 1e11) / 10, ff: s.freeFloat, ...feat(i) });
    }
  });

  const pick = (d: string) => rows.filter((r) => r.date === d && r.chg >= GAIN * 100 && r.valueM >= MIN_VALUE / 1e9).sort((a, b) => b.chg - a.chg);
  const ev0 = pick(D0), ev1 = pick(D1);
  const sectorCount = (evs: any[]) => evs.reduce((m: any, e) => ((m[e.sector] = (m[e.sector] ?? 0) + 1), m), {});
  const sc0 = sectorCount(ev0), sc1 = sectorCount(ev1);
  const arch = (r: any, sc: any) =>
    r.topgain20 > 0 || r.ret20Prev >= 25 ? 'Lanjutan momentum'
    : r.rsiPrev < 35 || r.distLowPrev <= 10 ? 'Rebound oversold / dekat low'
    : r.breakout20 && (r.range10Prev < 12 || r.atrRatioPrev < 0.8) ? 'Breakout dari konsolidasi'
    : sc[r.sector] >= 3 ? 'Rotasi sektor'
    : r.breakout20 ? 'Breakout biasa'
    : r.avgValue20M < 1 ? 'Spike saham sepi' : 'Tanpa pola teknikal jelas';
  const top0 = ev0.slice(0, 5).map((r) => ({ ...r, archetype: arch(r, sc0), inYesterdayTopgain: ev1.some((e) => e.ticker === r.ticker), pdLast: pd.get(r.ticker)?.Last, pdPct: Math.round((pd.get(r.ticker)?.OneDay ?? NaN) * 10000) / 100, pdDate: pd.get(r.ticker)?.LastDate }));
  const top1 = ev1.slice(0, 5).map((r) => ({ ...r, archetype: arch(r, sc1), today: rows.find((x) => x.ticker === r.ticker && x.date === D0) ?? null }));
  const out = {
    D0, D1, ihsg0: ihsgChg(D0) * 100, ihsg1: ihsgChg(D1) * 100, nTopgain0: ev0.length, nTopgain1: ev1.length,
    sectors0: sc0, sectors1: sc1, all0: ev0.map((e) => `${e.ticker} +${e.chg}%`), all1: ev1.map((e) => `${e.ticker} +${e.chg}%`),
    top0, top1,
  };
  writeFileSync(join(OUT, 'top5_result.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
```
