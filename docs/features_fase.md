## Kolom "Skor" di ResultsTable

Kolom ini punya **dua mode**, tergantung preset yang dipilih ([ResultsTable.tsx:796-821](src/presentation/features/screener/components/ResultsTable.tsx#L796-L821)):

1. **Preset dengan composite score sendiri** (Breakout Hunter, Trading Plan, ARA Hunter, Fundamental, Core Portofolio, High Growth, Bandar Detector) → menampilkan badge status + `composite/100` dari `compositeScoreInfo()` ([ResultsTable.tsx:744-774](src/presentation/features/screener/components/ResultsTable.tsx#L744-L774)). Masing-masing preset punya rumus skor sendiri di `domain/screener/presets`.
2. **Preset tanpa composite score** (misalnya filter "Semua") → fallback ke badge **Market Phase**, dihitung oleh `computeMarketPhase()` di [marketPhase.ts](src/domain/analysis/marketPhase.ts).

## Logika Market Phase (Extended, Bullish Awal, Breakout, dll)

Butuh minimal 21 bar histori. Dihitung dari indikator: EMA9, EMA21, RSI14, rasio volume terhadap rata-rata 20 hari, posisi close dalam range hari itu, dan apakah harga breakout dari high 20 hari sebelumnya.

Urutan pengecekan **first-match-wins** ([marketPhase.ts:69-84](src/domain/analysis/marketPhase.ts#L69-L84)):

| Fase | Syarat |
|---|---|
| 🔴 **Bearish** | close < EMA21 **dan** EMA9 < EMA21 **dan** RSI14 < 50 |
| 🟡 **Pullback** | close < EMA9 tapi ≥ EMA21, EMA9 > EMA21 (tren naik utuh), volume ratio < 1.5 — lagi koreksi sehat ke EMA9 |
| 🔥 **Extended** | RSI14 ≥ 75, **atau** perubahan harian ≥ 10%, **atau** close sudah ≥10% di atas EMA21 — sudah naik terlalu jauh/overbought |
| 🟠 **Distribution** | volume ratio ≥ 2, posisi close < 50% dari range hari itu, tapi perubahan harian masih positif — volume besar namun close lemah = indikasi distribusi walau harga masih hijau |
| 🚀 **Breakout** | close > high 20 hari sebelumnya, volume ratio ≥ 1.5, posisi close ≥ 70% dari range, perubahan harian ≥ 3% |
| 🟢 **Bullish Awal** | close > EMA21, EMA9 > EMA21, RSI14 antara 50–70, volume ratio ≥ 1 — tren naik baru terbentuk, belum overbought |
| ⚪ **Netral** | tidak memenuhi kriteria manapun di atas |

**Definisi metrik pendukung:**
- `volumeRatio` = volume hari ini ÷ SMA20(volume)
- `closePosition` = `(close - low) / (high - low) * 100` pada bar hari itu (0 = close di low, 100 = close di high)
- `breakout20d` = close hari ini > high tertinggi dari 20 hari sebelumnya (tidak termasuk hari ini)

Kalau data histori kurang dari 21 bar atau indikator NaN, fungsi mengembalikan `null` → di tabel muncul tanda `—` (bukan loading, tapi "data tidak cukup").

----
Sekarang saya punya gambaran lengkapnya. Ringkasan perhitungan skor tab **Fundamental**:

## Alur Skor Fundamental

`computeFundamentalScore()` di [presets.ts:1417-1458](src/domain/screener/presets.ts#L1417-L1458) menghitung **5 dimensi** (0-100 masing-masing), lalu digabung jadi 1 angka komposit tertimbang.

### 1. Profitability (bobot 30) — dari ROE
[presets.ts:1311-1318](src/domain/screener/presets.ts#L1311-L1318)
| ROE | Skor |
|---|---|
| ≥ 20% | 100 |
| ≥ 15% | 80 |
| ≥ 10% | 60 |
| ≥ 5% | 35 |
| > 0% | 15 |
| ≤ 0% | 0 |

### 2. Valuation (bobot 25) — dari PER & PBV
[presets.ts:1320-1339](src/domain/screener/presets.ts#L1320-L1339) — dihitung terpisah lalu dirata-rata:
- **PER**: ≤8x→100, ≤12x→85, ≤18x→65, ≤25x→45, ≤35x→25, >35x→10 (PER ≤0 → 20, skeptis bukan otomatis 0)
- **PBV**: ≤1x→100, ≤2x→80, ≤3x→60, ≤5x→35, >5x→15
- Valuation = rata-rata PER-score & PBV-score

### 3. Financial Health (bobot 20) — dari Debt/Equity & Current Ratio (Yahoo Finance)
[presets.ts:1359-1380](src/domain/screener/presets.ts#L1359-L1380) — rata-rata dari yang tersedia:
- **DER**: ≤30%→100, ≤60%→80, ≤100%→60, ≤150%→35, >150%→15
- **Current Ratio**: ≥2→100, ≥1.5→80, ≥1→60, ≥0.75→35, <0.75→15
- Bisa `null` (mis. saham bank tidak punya current ratio yang relevan) → tidak ikut dihitung, bukan menyeret skor ke 0.

### 4. Dividend (bobot 15) — dari Dividend Yield & Payout Ratio
[presets.ts:1385-1405](src/domain/screener/presets.ts#L1385-L1405)
- Yield ≤2%→55, ≤4%→75, ≤7%→90, >7%→70 (yield ekstrem tinggi dicurigai, bukan dianggap terbaik)
- Payout ≤60%→100, ≤80%→75, ≤100%→45, >100%→15 (bayar dividen melebihi laba = risiko dipotong)
- Dividend score = `yieldScore*0.5 + payoutScore*0.5`
- `null` kalau fetch Yahoo gagal total

### 5. Quality Gate (bobot 10) — proxy keandalan data harga
[presets.ts:1341-1355](src/domain/screener/presets.ts#L1341-L1355) — rata-rata free float score & likuiditas (nilai transaksi) score. Bukan soal fundamental perusahaan, tapi soal apakah harga/rasio sahamnya bisa dipercaya (saham tipis/free float kecil rawan distorsi harga).

### Komposit & Status
`weightedComposite()` ([presets.ts:1409-1415](src/domain/screener/presets.ts#L1409-L1415)) merata-ratakan tertimbang **hanya dari dimensi yang datanya tersedia** — kalau Financial Health atau Dividend `null`, bobotnya tidak ikut membagi (tidak menyeret skor turun).

Bobot: **Profitability 30 / Valuation 25 / Financial Health 20 / Dividend 15 / Quality Gate 10**

Status akhir ([presets.ts:1434-1438](src/domain/screener/presets.ts#L1434-L1438)):
| Komposit | Status |
|---|---|
| ≥ 80 | EXCELLENT |
| ≥ 65 | GOOD |
| ≥ 50 | FAIR |
| < 50 | WEAK |

Contoh dari screenshot: **BPTR** skor 55/100 → **FAIR** (masuk rentang 50-64), **DYAN** 81/100 → **EXCELLENT** (≥80).

Catatan: preset "Fundamental" ini baru mencakup ROE, PER, PBV, DER, Current Ratio, Dividend Yield/Payout — **belum** ada Growth (CAGR) atau Cash Flow, karena data historis multi-tahun tidak tersedia stabil dari sumber data yang dipakai.