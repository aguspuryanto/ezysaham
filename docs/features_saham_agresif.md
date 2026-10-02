# Saham Agresif — Preset Screener (Growth Mid Cap & Small Cap Alpha)

## 1. Latar Belakang & Tujuan

Mendukung strategi portofolio **"100% Saham Agresif"** (target return
15–20%/tahun) dengan dua sub-alokasi berkarakter berbeda:

- **Growth (Mid Cap) — porsi 35%**: mesin penggerak portofolio, perusahaan
  established yang sedang bertumbuh cepat.
- **Small Cap / Alpha — porsi 15%**: akselerator return, risiko lebih tinggi
  tapi potensi lonjakan harga jauh lebih besar.

Karena keduanya punya threshold fundamental & profil risiko yang berbeda,
keduanya diimplementasikan sebagai **dua preset screener terpisah**
(`agresifGrowth` & `agresifAlpha`) — bukan satu preset gabungan — mengikuti
pola yang sudah dipakai codebase ini untuk kasus serupa (`swingTrend` vs
`swingMomentum`: dua gaya trading dari satu strategi induk, dipisah jadi dua
tab filter independen di `src/domain/screener/presets.ts`).

Dokumen ini memetakan setiap kriteria finansial ke field/fungsi yang sudah
ada di codebase, supaya implementasi berikutnya (menambah 2 preset baru)
tinggal mengikuti resep konkret di bawah — bukan menerka ulang.

## 2. Matrix Kriteria (referensi asli)

| Indikator / Kategori | Growth (Mid Cap — 35%) | Small Cap / Alpha (15%) |
| --- | --- | --- |
| Market Cap | Rp2T – Rp10T | < Rp2T |
| Pertumbuhan Laba (EPS Growth) | > 15% YoY, konsisten 3–4 kuartal | > 25% YoY atau turnaround rugi→untung |
| Profitabilitas (ROE) | > 15% | > 10% (atau ekspansi margin kotor tajam) |
| Kesehatan Utang (DER) | < 1,0x | < 0,8x |
| Valuasi (PEG) | < 1,0x | PER/PBV di bawah rata-rata historis industri |
| Likuiditas Harian | > Rp5 miliar/hari | > Rp1–2 miliar/hari |
| Tren Teknikal | Uptrend (di atas MA50 & MA200) | Breakout dari konsolidasi (Base Stage 1/2) |

Kriteria teknikal & transaksi (MA integrity, volume breakout/bandarmology,
risk-reward ratio) berlaku untuk **kedua preset** — lihat Section 5.

## 3. Preset A — "Agresif Growth" (Mid Cap)

- `id: 'agresifGrowth'`, label UI: **"Agresif Growth"**
- Target: 15–25% dalam 1–6 bulan (gaya swing/posisi, bukan day trading)
- `needsHistory: true`, `needsFundamentals: true`
- `coarseFilter`: `s.capitalization >= 2_000_000_000_000 && s.capitalization <= 10_000_000_000_000 && s.roe > 15 && s.per > 0`

| Kriteria user | Implementasi | Status |
| --- | --- | --- |
| Market Cap Rp2T–10T | `s.capitalization` (`StockSummary`, sudah Rupiah penuh) | ✅ Field langsung |
| ROE > 15% | `s.roe` | ✅ Field langsung |
| DER < 1,0x | `fundamentals.debtToEquity < 100` (skala persen Yahoo: 100 = 1,0x); **skip gate bila `null`** (umum untuk bank) — pola sama seperti `fundamentalQualityPreset` | ⚠️ Via Yahoo, nullable |
| EPS Growth > 15% YoY, konsisten 3–4 kuartal | Tidak ada sumber data historis EPS per-kuartal di codebase ini. **Proxy**: `fundamentals.revenueGrowth > 15` (YoY revenue, bukan EPS, hanya kuartal terakhir — bukan "konsisten 3–4 kuartal"); skip gate bila `null` | 🟡 Proxy kasar, dicatat di `dataNotes` |
| PEG < 1,0x | Tidak bisa dihitung literal (butuh growth rate valid). **Diganti**: reuse `calcValuationScore(s.per, s.pbv)` (sudah ada & exported di `presets.ts`), threshold skor ≥ 55 | 🟡 Diganti proxy valuasi PER+PBV |
| Likuiditas > Rp5 miliar/hari | `s.value > 5_000_000_000` | ✅ Field langsung |
| Tren Uptrend (di atas MA50 & MA200) | Reuse `sma`/`ema` dari `@/domain/indicators/movingAverages`: hard gate `s.lastClose > ma200` ("coret dari watchlist" bila di bawah MA200, sesuai penekanan user), soft-reason `ema20 > ma50 > ma200` (stack penuh) | ✅ Reuse indicator yang sudah ada |

Reasons/failed string mengikuti gaya `verdict()` yang sudah dipakai semua
preset lain (lihat contoh `fundamentalQualityPreset`).

**Data gaps khusus preset ini**: EPS growth asli (per-kuartal, konsisten
3–4 kuartal) dan PEG asli tidak tersedia — lihat Section 6 untuk detail &
alasan.

## 4. Preset B — "Agresif Alpha" (Small Cap)

- `id: 'agresifAlpha'`, label UI: **"Agresif Alpha"**
- Target: 20–40%+ dalam 1–3 bulan, lebih spekulatif & breakout-driven
- `needsHistory: true`, `needsFundamentals: true`
- `coarseFilter`: `s.capitalization < 2_000_000_000_000 && s.freeFloat >= 15 && s.freeFloat <= 35 && s.value > 1_000_000_000`

| Kriteria user | Implementasi | Status |
| --- | --- | --- |
| Market Cap < Rp2T | `s.capitalization < 2_000_000_000_000` | ✅ Field langsung |
| ROE > 10% (atau ekspansi margin kotor tajam) | `s.roe > 10`; ekspansi margin kotor historis tidak bisa dilacak (tidak ada time-series margin) — **tidak digate**, hanya ROE > 10 sebagai proxy profitabilitas | 🟡 Bagian kedua kriteria di-drop |
| DER < 0,8x | `fundamentals.debtToEquity < 80` (skala persen Yahoo); skip gate bila `null` | ⚠️ Via Yahoo, nullable |
| EPS Growth > 25% YoY atau turnaround rugi→untung | Sama seperti Growth: tidak ada data EPS historis. **Proxy**: `fundamentals.revenueGrowth > 25`, skip bila `null`. Deteksi "turnover rugi→untung" butuh histori multi-kuartal net income — **tidak tersedia, di-drop dari MVP** | 🟡 Proxy parsial, turnaround di-drop |
| Valuasi PER/PBV di bawah rata-rata historis industri | Rata-rata historis per sektor butuh time-series per sektor (tidak ada), dan `evaluate()` cuma menerima 1 ticker (tidak ada akses ke universe/peer saat itu — perubahan arsitektur lebih besar, di luar scope). **Diganti**: bound absolut lewat `calcValuationScore(s.per, s.pbv)`, threshold skor ≥ 45 (lebih longgar dari Growth, karena small cap growth wajar PER lebih tinggi) | 🟡 Diganti bound absolut, bukan relatif-sektor |
| Likuiditas > Rp1–2 miliar/hari | `s.value > 1_000_000_000` (pakai batas bawah 1M sebagai gate; 2M disebut sebagai referensi "lebih ketat" di deskripsi preset) | ✅ Field langsung |
| Free float 15%–35% | `s.freeFloat >= 15 && s.freeFloat <= 35` | ✅ Field langsung, match persis |
| Breakout dari konsolidasi (Base Stage 1/2: Cup&Handle/Ascending Triangle/Box) | Tidak ada pattern-recognition chart literal. **Reuse**: `computeBreakoutScores(s, bars)` (sudah exported dari `presets.ts`, dipakai `breakoutPreset`) — pakai field `.compression` (kontraksi volatilitas, "coiled spring") dan `.breakoutPosition` (posisi close dalam range terkini) sebagai proxy konsolidasi+breakout, threshold masing-masing ≥ 60 | 🟡 Proxy dari Breakout Hunter, bukan pattern-recognition literal |

Kriteria kualitatif yang **tidak digate secara numerik**:
- **Katalis pertumbuhan jelas** (ekspansi pabrik, produk baru, regulasi) —
  tidak bisa di-screen massal (fetch berita per-ticker terlalu mahal untuk
  jalur scan massal, sudah dicatat di komentar `computeAraProbability`).
  Dicatat sebagai *"cek manual di tab Analisis Berita & Sentimen Pasar per
  ticker"* pada halaman detail saham.

**Data gaps khusus preset ini**: turnaround rugi→untung, rata-rata historis
PER/PBV per sektor, chart pattern recognition literal — lihat Section 6.

## 5. Kriteria Teknikal & Transaksi Bersama (kedua preset)

Berlaku sama untuk `agresifGrowth` dan `agresifAlpha`:

1. **MA Integrity (Stage 2 Markup)** — Reuse `ema`/`sma` dari
   `@/domain/indicators/movingAverages`. Hard gate: `Close > MA200` (sesuai
   penekanan user — "coret dari watchlist" bila di bawah MA200). Soft-reason
   tambahan bila stack penuh `EMA20 > MA50 > MA200` terpenuhi.
2. **Volume Breakout & Bandarmology (proxy)** — Kriteria asli "Volume 2x–3x
   lipat rata-rata" **dan** "Broker Summary & Orderbook — Akumulasi Masif"
   digabung jadi satu gate OR (minimal satu sinyal akumulasi terpenuhi),
   karena keduanya adalah proxy untuk hal yang sama (ada pembeli besar
   masuk) dan data broker/asing asli tidak tersedia gratis untuk saham IDX
   (dikonfirmasi eksplisit di komentar `bandarDetectorPreset`):
   - `relativeVolume(bars, 20) >= 2` (RVOL, dari `@/domain/indicators/volume`), **ATAU**
   - `computeBandarScore(s, bars).total >= 50` (proxy Price+Volume+OBV,
     reuse dari `@/domain/analysis/bandarScore`, dipakai juga oleh
     `bandarDetectorPreset`)
3. **Risk/Reward Ratio** — Reuse `computeTradingPlanScore(s, bars)` (sudah
   exported, dipakai `tradingPlanPreset`) untuk `riskRewardRatio` dari
   skenario bullish yang identik dengan section "Rencana Trading" di
   halaman detail ticker (supaya angka konsisten di seluruh aplikasi).
   Threshold: **≥ 1:2** untuk Growth, **≥ 1:3** untuk Alpha (lebih ketat,
   karena risiko small cap lebih tinggi — perlu asimetri reward lebih besar
   untuk kompensasi, sesuai penekanan user "akselerator return").

## 6. Ringkasan Gap Data

| Kriteria asli user | Tersedia? | Pendekatan di MVP | Alasan |
| --- | --- | --- | --- |
| EPS Growth per-kuartal (konsisten 3–4 kuartal) | ❌ Tidak ada di manapun | Proxy `fundamentals.revenueGrowth` (Yahoo, YoY, kuartal terakhir saja) | Tidak ada sumber data laporan keuangan historis multi-kuartal (Pasardana snapshot & Yahoo `quoteSummary` sama-sama tidak expose ini) |
| PEG Ratio | ❌ Tidak bisa dihitung literal | Diganti `calcValuationScore(per, pbv)` yang sudah ada | Butuh growth rate valid (EPS growth), yang tidak tersedia (lihat baris di atas) |
| Turnaround rugi→untung (small cap) | ❌ Tidak tersedia | Di-drop dari MVP | Butuh histori net income multi-kuartal untuk deteksi perubahan tanda (rugi→untung) |
| Rata-rata historis PER/PBV per sektor | ❌ Tidak tersedia | Bound absolut PER/PBV (skor `calcValuationScore`) | Butuh time-series PER per sektor; lagipula `evaluate()` di framework preset saat ini hanya menerima 1 ticker per panggilan, tidak ada akses ke universe/peer saat itu — perubahan arsitektur lebih besar (passing `allSummaries` ke `evaluate()`, atau tahap grouping terpisah setelah scan) |
| Broker Summary & Orderbook (akumulasi institusi/asing asli) | ❌ Tidak tersedia (dikonfirmasi eksplisit di komentar `bandarDetectorPreset`) | Proxy `computeBandarScore` (Price+Volume+OBV, Wyckoff-style) sebagai gate pengganti (OR dengan RVOL, lihat Section 5) | Data broker summary/foreign flow asli tidak tersedia lewat API gratis untuk saham IDX |
| Katalis pertumbuhan kualitatif (ekspansi, produk baru, regulasi) | ❌ Tidak bisa di-screen numerik/massal | Dicatat sebagai cek manual di tab Analisis Berita & Sentimen Pasar per ticker | Fetch berita per-ticker untuk ~900+ saham di jalur scan massal terlalu mahal (pola yang sama sudah diputuskan untuk `araPreset`/`araHunterPreset`) |
| Chart pattern literal (Cup&Handle, Ascending Triangle, Box Consolidation) | ❌ Tidak ada pattern-recognition shape-based | Proxy `compression` + `breakoutPosition` dari `computeBreakoutScores` | Tidak ada modul deteksi pola chart berbasis bentuk (shape-matching) di codebase ini; proxy volatility-contraction sudah cukup dekat secara intent |

## 7. Langkah Integrasi (checklist implementasi berikutnya)

- [ ] Tambah `'agresifGrowth' | 'agresifAlpha'` ke union `ScreenerPresetId`
      di `src/domain/screener/presets.ts`
- [ ] Implementasikan `agresifGrowthPreset` & `agresifAlphaPreset` mengikuti
      struktur `ScreenerPreset` (coarseFilter + evaluate), reuse fungsi-fungsi
      yang sudah disebutkan di Section 3–5 (jangan tulis ulang logic MA/RVOL/
      Bandar Score/Trading Plan/Breakout Score dari nol)
- [ ] Daftarkan keduanya di `SCREENER_PRESETS` (record) dan
      `SCREENER_PRESET_LIST` (array) di file yang sama
- [ ] Tambah entry baru ke `FILTER_ITEMS` di
      `src/presentation/features/screener/ScreenerPage.tsx` (sekitar baris
      45) — preset baru **tidak otomatis muncul di UI** tanpa ini. Ikon
      yang disarankan (sudah ter-import dari `lucide-react` di file
      tersebut): `TrendingUp` untuk Agresif Growth, `Rocket` untuk Agresif
      Alpha
- [ ] Jalankan dev server, pilih tab baru di Screener, verifikasi hasil
      serta reasons/failed muncul benar di `ResultsTable`
- [ ] `npx tsc --noEmit` dan `npx eslint` pada file yang diubah

## 8. Out of Scope / Future Work

- EPS growth historis asli (multi-kuartal) & PEG asli — butuh sumber data
  laporan keuangan tambahan (belum ada endpoint yang menyediakan ini secara
  stabil untuk saham IDX).
- Rata-rata historis PER/PBV per sektor — butuh perubahan arsitektur
  (`evaluate()` perlu akses ke universe/peer, bukan hanya 1 ticker), atau
  tahap agregasi terpisah setelah scan massal selesai.
- Deteksi pola chart literal (Cup&Handle, Ascending Triangle, Box
  Consolidation) — butuh modul shape-matching baru, di luar scope preset
  berbasis skor numerik yang sudah ada.
- Deteksi turnaround rugi→untung — butuh histori net income multi-kuartal.
