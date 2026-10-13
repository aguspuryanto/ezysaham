Anda adalah Momentum Trade Engine EzySaham.

Analisis data teknikal yang diberikan untuk mencari peluang
MOMENTUM CONTINUATION, bukan sekadar saham yang sedang overbought.

TUJUAN:
Cari peluang entry dengan potensi TP ≥20% selama struktur bullish
masih sehat, sambil menghindari entry sebelum reversal/distribution.

ANALISIS:
1. Trend: EMA, Higher High/Higher Low.
2. Momentum: RSI, MACD, price acceleration.
3. Volume: Volume, RVOL, volume expansion/contraction.
4. Structure: Breakout, retest, support, resistance.
5. Volatility: ATR / range pergerakan.
6. Distribution Risk: rejection, lower high, selling volume,
   breakdown support, MACD weakening.
7. Hitung apakah TP ≥20% realistis berdasarkan resistance dan volatility.

ATURAN:
- RSI >70 TIDAK otomatis AVOID.
- Bullish + momentum kuat + volume tinggi dapat tetap TRADE
  jika continuation structure masih sehat.
- Jangan BUY hanya karena momentum kuat.
- Prioritaskan BREAKOUT VALID, BREAKOUT RETEST, atau PULLBACK.
- Jangan entry jika upside menuju resistance <20%.
- Jangan memaksakan target +20% jika struktur tidak mendukung.
- Jika belum ada entry aman → WAIT.
- Jika distribution/reversal risk tinggi → AVOID.
- Jangan memprediksi ARB secara pasti; deteksi risiko breakdown/reversal.
- Jangan mengarang support, resistance, TP, SL, atau R:R.
- Jika data tidak cukup → N/A.

KLASIFIKASI:
🟢 MOMENTUM BUY
🟡 WAIT PULLBACK
🟡 WAIT BREAKOUT
🔴 AVOID CHASING
🔴 AVOID REVERSAL

OUTPUT WAJIB:

Status: [MOMENTUM BUY / WAIT PULLBACK / WAIT BREAKOUT / AVOID]
Momentum: [STRONG / MODERATE / WEAK]
Structure: [HEALTHY / EXTENDED / DISTRIBUTION]
Entry: [harga/zone atau N/A]
SL: [harga atau N/A]
TP1: [harga]
TP2: [harga dengan target ≥20% jika realistis]
Potential: [+X%]
R:R: [X:X atau N/A]
Exit Risk: [LOW / MEDIUM / HIGH / EXTREME]

Alasan utama:
[2–3 poin paling penting]

Trigger Entry:
[kondisi yang harus terjadi sebelum BUY]

Exit Warning:
[kondisi yang menyebabkan posisi harus dikurangi/ditutup]

Kesimpulan:
[1 kalimat tegas]

PRINSIP UTAMA:
"Overbought bukan berarti harus AVOID.
Yang menentukan adalah apakah momentum masih dapat berlanjut
dengan entry, risk, dan upside yang masuk akal."

----
Anda adalah Momentum Trade Engine EzySaham.

TUJUAN:
Cari momentum trade dengan potensi profit ≥20%,
entry tervalidasi, risk terkendali, dan menghindari
chasing serta reversal/distribution.

ANALISIS:
- Trend: EMA + Higher High/Higher Low
- Momentum: RSI + MACD
- Volume: Volume + RVOL
- Structure: Breakout / Retest / Pullback
- Support & Resistance
- Volatility / ATR
- Distribution & Reversal Risk

ATURAN:
- RSI >70 TIDAK otomatis AVOID.
- Momentum kuat + volume tinggi boleh ditrade jika struktur sehat.
- Jangan BUY hanya karena momentum kuat.
- Bedakan BREAKOUT, RETEST, dan PULLBACK.
- Breakout harus CLOSE di atas resistance + volume confirmation.
- Entry zone ≠ otomatis BUY.
- TP harus berdasarkan resistance / measured move / struktur valid.
- Jangan mengarang Entry, SL, TP, Support, Resistance atau R:R.
- Jangan memprediksi ARB; deteksi breakdown/distribution risk.

━━━━━━━━━━━━━━━━━━━━
🔒 HARD RISK GATE
━━━━━━━━━━━━━━━━━━━━

WAJIB LULUS SEMUA:

1. Potential ≥20%
   Jika <20% → 🔴 NO TRADE

2. R:R ≥1:2
   Jika <1:2 → 🔴 NO TRADE

3. Valid Entry Trigger tersedia
   Jika tidak → 🟡 WAIT

4. SL valid berdasarkan structure
   Jika tidak → 🔴 NO TRADE

5. Distribution/Reversal Risk tidak HIGH/EXTREME
   Jika HIGH/EXTREME → 🔴 AVOID

6. Upside menuju resistance berikutnya ≥20%
   Jika tidak → 🔴 NO TRADE

JANGAN memberikan MOMENTUM BUY jika
salah satu HARD RISK GATE gagal.

━━━━━━━━━━━━━━━━━━━━
STATUS
━━━━━━━━━━━━━━━━━━━━

🟢 MOMENTUM BUY
Semua HARD RISK GATE LULUS.

🟡 WAIT BREAKOUT
Setup berpotensi valid tetapi breakout belum confirmed.

🟡 WAIT PULLBACK
Momentum bullish tetapi entry lebih aman menunggu pullback.

🔴 AVOID CHASING
Harga terlalu jauh dari entry.

🔴 AVOID REVERSAL
Distribution/reversal risk tinggi.

🔴 NO TRADE
Satu atau lebih HARD RISK GATE gagal.

━━━━━━━━━━━━━━━━━━━━
OUTPUT
━━━━━━━━━━━━━━━━━━━━

🚀 Momentum Trade Engine — [TICKER]

Status: [...]
Momentum: [...]
Structure: [...]
Entry: [...]
SL: [...]
TP1: [...]
TP2: [...]
Potential: [...]
R:R: [...]
Exit Risk: [...]

Risk Gate:
Potential ≥20%: PASS/FAIL
R:R ≥1:2: PASS/FAIL
Entry Trigger: PASS/FAIL
Valid SL: PASS/FAIL
Distribution Risk: PASS/FAIL
Upside ≥20%: PASS/FAIL

Alasan utama:
- ...
- ...

Trigger Entry:
...

Exit Warning:
...

Kesimpulan:
...

PRINSIP:
"Momentum kuat bukan berarti BUY.
BUY hanya jika momentum + entry + upside ≥20%
+ R:R ≥1:2 + risk terkendali."

----
# Momentum Trade Engine v2 — Swing 3–10 hari (implementasi)

Kode: `src/domain/analysis/momentumTradeEngine.ts` (klasifikasi & gate), `momentumSetups.ts` (data, likuiditas,
pivot, deteksi setup, biaya), `momentumBacktest.ts` (walk-forward). UI: `TradingMomentumReport.tsx`.
Aturan ≥ 20% di atas tetap berlaku, tetapi khusus mode `momentum20` (dipakai Moonstock).

## Diagnosis v1 (bukti di kode lama, data Yahoo 1D s/d 2026-10-12)

| Saham | Status v1 | Akar masalah |
|---|---|---|
| BIKE, TFCO, IFSH | AVOID CHASING, gate SL/R:R FAIL | Saat extended, kandidat selalu "pullback EMA 20" dengan `triggerOk: false` hard-coded; SL dihitung dari **ATR harga sekarang** di level EMA 20 yang jauh di bawah → "Valid SL FAIL 16,8–25%". Gate menilai rencana hipotetis, sehingga FAIL tampak seperti cacat setup padahal artinya "belum waktunya". |
| ZONE | AVOID CHASING (Structure NO TREND) | Extended dipicu `change1W ≥ 25%` (ambang universal, bukan relatif ATR 7,6%); label Structure (NO TREND) tidak konsisten dengan status (AVOID CHASING). Breakout +10% di atas level tidak dikenali sebagai "tunggu retest". |
| MINE | NO TRADE (HEALTHY, STRONG) | Tidak ada setup → kandidat pullback; SL = `min(low 5 sesi, EMA20) − 0,5 ATR` → 14,5%. Tren sehat tanpa trigger dilabel **NO TRADE**, bukan WAIT. |
| Semua | — | Gate wajib Potential & Upside **≥ 20%** untuk semua setup; `slPct = entry/SL − 1` (bukan (entry − SL)/entry); RVOL memasukkan bar terakhir ke baseline-nya sendiri; candle hari berjalan (Yahoo) dinilai sebagai close; tidak ada gate likuiditas, data stale, suspensi, maupun biaya transaksi. |

## Arsitektur

* **A. Opportunity Scanner** — skor 0–100 (EMA 20>50 15, harga>EMA20 10, slope EMA20 10, HH+HL 15, momentum 20/10, RVOL 10, likuiditas 10, distribusi 10 − 5/flag). Hanya analisa; tidak pernah mengubah status.
* **B. Execution Gate** — BUY hanya jika SEMUA gate PASS. Gate yang belum bisa dinilai (mis. SL pullback sebelum swing low terbentuk) = **MENUNGGU**, bukan PASS.

## Mode (eksplisit, `MOMENTUM_MODES`)

| | swing (default, halaman detail) | momentum20 (Moonstock) |
|---|---|---|
| Horizon | 3–10 hari bursa | ±1 bulan |
| R:R net min | 1:2 | 1:2 |
| Potential min (entry→TP2) | 5% | 20% |
| Upside min (entry→resistance terdekat) | 5% | 20% |
| Pemilihan TP2 | level teknikal tertinggi ≤ min(4×ATR%, 15%); jika tidak ada, level pertama ≤ 4×ATR% | resistance berikutnya, atau measured move bila blue sky |
| SL maks | 8% dan 2,5× ATR | 10% dan 3× ATR |
| Likuiditas min | rata-rata nilai 20 hari ≥ Rp 1 M | sama |

R:R tidak pernah diturunkan otomatis; override per panggilan hanya lewat `opts.config`.

## Status

BUY · WAIT PULLBACK · WAIT BREAKOUT · WAIT RETEST · WATCHLIST · AVOID CHASING · NO TRADE.

Urutan: data stale / reversal (distribusi, breakdown, tren turun) → NO TRADE; extended → AVOID CHASING; setup terpicu & semua
gate PASS → BUY. Setup terpicu tapi gate gagal → candle belum tutup: WAIT …; data/likuiditas: NO TRADE; SL terlalu jauh:
WATCHLIST; target/upside tertahan resistance: WAIT BREAKOUT (resistance itu); di luar zona / momentum lemah: WAIT RETEST/PULLBACK;
lainnya WATCHLIST. Tanpa trigger: setup yang ditunggu (retest → breakout/range → pullback) → WAIT …; tren naik/datar kuat → WATCHLIST.
Trading plan (Entry/SL/TP/R:R) hanya dipublikasikan untuk BUY; status lain menampilkan kondisi pemicu, bukan harga entry.

## Setup (semua dari candle harian; pivot butuh bar di kedua sisi → tanpa look-ahead)

| Setup | Aktivasi / trigger | Invalidasi | SL struktural |
|---|---|---|---|
| Trend | EMA20>EMA50 & menanjak (5 sesi), harga>EMA20, HH+HL (10 vs 10 sesi) | close < EMA 50 | — (konteks) |
| Breakout | close > high 20 sesi sebelumnya (R), RVOL ≥ 1,5× (vs rata-rata 20 sesi **sebelumnya**), candle hijau close di paruh atas, close ≤ R × (1 + max(3%, 0,5×ATR%), maks 6%) | close < R | R − 0,5×ATR |
| Breakout-retest | breakout bervolume ≤ 8 sesi lalu, low 3 sesi ≤ R + 0,5×ATR, candle hijau close > R & > close kemarin, masih di zona | close < R − 0,25×ATR (false breakout) | min(low retest, R) − 0,5×ATR |
| Pullback | tren BULLISH, low 3 sesi masuk zona [EMA20 − 0,25 ATR, max(EMA9, EMA20 + 0,5 ATR) ≤ EMA20 + 1 ATR], volume candle merah ≤ 1,1× rata-rata, candle pantulan hijau | close < zona − 0,5×ATR | swing low 5 sesi − 0,5×ATR |
| Konsolidasi | range 10 sesi ≤ max(10%, 3×ATR%); trigger close > range high + RVOL ≥ 1,5× | close < range low | range low − 0,5×ATR |
| Rejection / distribusi | upper wick ≥ 50% range (range ≥ 0,8 ATR) & close < tengah; Lower High; candle merah vol ≥ 1,5×; breakdown low 10 sesi / EMA 50; MACD melemah; false breakout | — | — |
| Extended | (harga − EMA20)/EMA20 > max(10%, 3,5×ATR%) **atau** ROC5 ≥ max(25%, 5×ATR%) **atau** RSI ≥ 85 | — | — |

## Hard Risk Gate & rumus

1. **Data valid** — ≥ 50 bar; tidak stale (≥ 3 hari kerja); candle terakhir sudah tutup (≥ 16:15 WIB bila tanggalnya hari ini); < 5 sesi volume nol dalam 20 (pola suspensi).
2. **Likuiditas** — avg(close × volume, 20 sesi) ≥ minAvgValue20.
3. **Entry trigger** — setup TERPICU di candle yang sudah tutup, harga di zona entry, momentum ≠ WEAK.
4. **Valid SL** — risiko% = (entry − SL)/entry ≤ maxSlPct **dan** (entry − SL)/ATR ≤ maxSlAtr. SL tidak pernah dipersempit agar lolos.
5. **Potential** — (TP2 − entry)/entry ≥ minRewardPct **dan** TP2 dalam jangkauan ATR (atrReachMult × ATR%).
6. **R:R net** — beli = (entry + slip)(1 + 0,15%); jual(p) = (p − slip)(1 − 0,25%); slip = max(0,1%·p, 1 tick BEI).
   R:R net = (jual(TP2) − beli)/(beli − jual(SL)) ≥ minRR. R:R kotor = (TP2 − entry)/(entry − SL) ditampilkan terpisah.
7. **Distribution risk** — Exit risk LOW/MEDIUM.
8. **Upside** — (resistance terdekat di atas entry − entry)/entry ≥ minUpsidePct (blue sky lulus bila ada TP2).
   *Potential ≠ Upside*: Potential mengukur jarak ke target (TP2), Upside ke rintangan pertama.
9. **Tidak extended** — lihat definisi Extended.

Indikator: RSI 14 (Wilder), MACD 12/26/9 (line vs signal, posisi terhadap nol, perubahan histogram), EMA 9/20/50/200 (EMA 200 dari
riwayat 2 tahun), ATR 14, RVOL = volume terakhir / rata-rata 20 sesi sebelumnya. Harga order dibulatkan ke fraksi BEI (`idxTick.ts`).
RSI > 70 = kuat sekaligus rawan jenuh beli, bukan larangan otomatis.

## Regresi 5 saham (data Yahoo 1D, candle 2026-10-12, mode swing)

| Saham | v1 | v2 | Pemicu re-evaluasi (ringkas) |
|---|---|---|---|
| BIKE | AVOID CHASING (SL 16,8% FAIL) | AVOID CHASING — EXTENDED 7,8× ATR, RSI 93,3; **Data FAIL** (8/20 sesi volume nol → indikasi suspensi) | retest Rp 2.140–2.210 bertahan, atau pullback zona EMA Rp 1.470–1.655 + candle pantulan |
| TFCO | AVOID CHASING (Structure NO TREND) | AVOID CHASING — EXTENDED; likuiditas Rp 0,1 M/hari FAIL; 6/20 sesi volume nol | retest Rp 1.115–1.175 / pullback Rp 865–955; likuiditas ≥ Rp 1 M |
| ZONE | AVOID CHASING | **WAIT RETEST** — breakout Rp 735 sudah terjadi (+10% di atas level), tidak extended relatif ATR 7,6%; likuiditas Rp 0,1 M FAIL; R:R net 1:1,5 FAIL | kembali ke Rp 735–765, tidak close < Rp 720, candle hijau |
| IFSH | AVOID CHASING (SL 17,4% FAIL) | AVOID CHASING — EXTENDED 3,9× ATR; likuiditas Rp 0,4 M FAIL | retest Rp 2.060–2.160 / pullback Rp 1.570–1.825 |
| MINE | NO TRADE (SL 14,5%) | **WAIT BREAKOUT** — close tepat di resistance Rp 320; SL breakout 3,1% PASS; R:R kotor 1:2 tetapi net 1:1 (tick Rp 2 = 0,6%/sisi) FAIL | CLOSE > Rp 320, RVOL ≥ 1,5×, candle hijau kuat, maks Rp 330 |

Tidak satu pun BUY. TradingView "Pembelian kuat" adalah agregat MA/oscillator, bukan gate risiko; perbedaan dengan engine ini wajar.

## Backtest walk-forward (65 saham BEI, 2024-04-24 … 2026-10-12, 37.819 ticker-hari)

Aturan: sinyal di close t → beli open t+1 bila SL < open ≤ batas zona; SL dicek sebelum target; TP1 → jual 50% & SL ke entry;
TP2 → jual sisa; time stop 10 sesi; fee 0,15%/0,25% + slippage ≥ 1 tick. Split berdasarkan tanggal sinyal (50/25/25).
Parameter **tidak** dioptimasi terhadap data ini.

| Mode | BUY | Trade | Win | Expectancy net | PF | Max DD (Σ%) | SL rate | False breakout |
|---|---|---|---|---|---|---|---|---|
| swing | 102 | 81 | 24,7% | −2,12% | 0,36 | 174,7% | 74,1% | 75,0% |
| ↳ dev / val / OOS | | 38 / 26 / 17 | 23,7 / 26,9 / 23,5% | −1,60 / −1,98 / −3,51% | 0,49 / 0,40 / 0,08 | | | |
| momentum20 | 27 | 19 | 26,3% | −2,41% | 0,37 | 58,8% | 68,4% | 72,2% |

* Status-hari (swing): NO TRADE 24.219 · WAIT BREAKOUT 8.378 · WAIT RETEST 1.787 · WATCHLIST 1.449 · WAIT PULLBACK 1.221 · AVOID CHASING 663 · BUY 102.
  Engine v1 memberi MOMENTUM BUY pada 30 dari 37.819 ticker-hari (performanya tidak di-backtest).
* Per setup (swing): Breakout 74 trade, exp −2,27%; Retest 6, −1,13%; Pullback 1, +3,14%. IHSG > EMA50: exp −1,31%; IHSG < EMA50: −4,59%.
  Likuiditas Rp 5–50 M: −2,24%; ≥ Rp 50 M: −2,01%. Holding rata-rata 4,2 sesi; avg win +4,94%, avg loss −4,44%.
* Dari 60 trade yang kena SL, hanya 6 yang kemudian menyentuh TP2 dalam 10 sesi, sedangkan 35 turun > 1R lagi di bawah SL →
  masalahnya kualitas breakout, **bukan** SL terlalu sempit. Memperlebar SL akan memperburuk hasil.
* Missed (hari non-BUY bertren naik yang mencapai +10% sebelum −5% dalam 10 sesi): 2.359; sinyal BUY yang mencapainya: 14/102.

**Kesimpulan jujur:** gate v2 disiplin (BUY jarang, tidak ada BUY untuk saham extended / illikuid), tetapi setup BREAKOUT seperti
didefinisikan **belum terbukti punya edge** pada sampel ini (expectancy negatif di semua split). Jangan anggap BUY sebagai sinyal
otomatis sampai setup breakout diperbaiki dan divalidasi ulang di luar sampel.

Keterbatasan: survivorship (universe dipilih hari ini), sampel kecil (81 trade), data Yahoo (volume nol, bar suspensi), libur BEI
tidak dimodelkan, ARA/ARB & antrean tidak dimodelkan, ukuran posisi sama rata, drawdown = Σ% non-compounding, seleksi top gainer
(alur produk) tidak direplikasi.

## v2.1 — Breakout-retest, Valid SL & HARD RISK GATE (kasus OILS)

**Diagnosis (kode v2, data OILS 1D candle 2026-10-12, close Rp 354 = harga live Yahoo karena close resmi masih null):**
* `detectRetest`: invalidasi = R − 0,25×ATR = Rp 350,6, ditampilkan "Rp 350" (pembulatan tick) tapi dibandingkan dengan 350,6 —
  close Rp 350 akan tampil "tidak di bawah Rp 350" padahal dinilai gagal. Low retest hanya dari 3 bar terakhir. Tidak ada aturan
  volume saat retest. Close Rp 354 di bawah level Rp 358 dilaporkan generik "level sedang diuji".
* Engine: satu gate "Valid SL" menggabungkan % dan ATR, dan dinilai FAIL/PASS pada **entry simulasi** (tengah zona Rp 365/366, padahal
  harga Rp 354 di luar zona) seolah SL final. R:R net juga dinilai final pada entry simulasi. SL dibulatkan ke tick **terdekat**
  (335,3 → 336) sehingga buffer sedikit terpangkas.

**Aturan final:**
* Level breakout R = high tertinggi 20 sesi **selesai** sebelum candle breakout. Candle breakout wajib CLOSE > R dengan
  RVOL ≥ 1,5× = volume candle breakout ÷ rata-rata 20 sesi sebelum breakout. **Volume diwajibkan saat breakout**, bukan saat retest.
* Retest = low terendah sejak breakout ≤ R + 0,5×ATR (`RETEST_RULES.testToleranceAtr`). Saat retest tidak boleh ada candle merah
  bervolume ≥ volume breakout. Konfirmasi = candle terakhir (sudah ada di data) hijau, close > R, close > close sebelumnya, ≤ atas zona.
* Invalidasi = close < floorTick(R − 0,25×ATR) → INVALID, tunggu struktur baru. Angka yang tampil = angka yang dibandingkan.
* Peran level berbeda (ditampilkan di UI): **Rp 358** level breakout & batas bawah zona entry; **Rp 372** batas atas zona
  (R × (1 + max(3%, 0,5×ATR%))); **Rp 350** invalidasi setup; **low retest Rp 350** dasar SL; **SL simulasi Rp 334** =
  floorTick(low retest − 0,5×ATR) — batas risiko, bukan support.
* SL: `slRiskPct = (entry − SL)/entry × 100 ≤ maxSlPct` **dan** `slAtrMultiple = (entry − SL)/ATR ≤ maxSlAtr` (inklusif) — dua gate
  terpisah (`evaluateSl`). SL dibulatkan **ke bawah** ke tick valid.
* Tahap SL (`slStage`): **PROVISIONAL** = simulasi sebelum entry valid → gate SL % / SL ATR / R:R = **PENDING ENTRY** (detail
  menyebut angka simulasi dan apakah akan FAIL); **FINAL** = setelah Entry Trigger PASS → PASS/FAIL sungguhan; **UNKNOWN** = swing low
  pullback belum terbentuk; **NONE** = tidak ada setup. Harga SL hanya dipublikasikan sebagai trading plan bila BUY.
* R:R: risiko = entry − SL, reward = TP2 (resistance / measured move) − entry; net memakai fee 0,15%/0,25% + slippage ≥ 1 tick.
  Tanpa target teknikal → R:R **PENDING**, bukan angka.

**OILS setelah perbaikan (mode swing):** WAIT RETEST. Entry Trigger FAIL — close Rp 354 di bawah level breakout Rp 358 (masih di
atas invalidasi Rp 350). SL ≤ 8%: PENDING ENTRY (simulasi entry Rp 366, SL Rp 334: 8,7% > 8,0%). SL ≤ 2,5× ATR: PENDING ENTRY
(1,1× ≤ 2,5×). R:R net: PENDING ENTRY (simulasi ke TP2 Rp 430: kotor 1:2,0, net 1:1,6 < 1:2,0). Tidak ada trading plan.

Catatan data: candle hari berjalan diisi `regularMarketPrice` oleh `yahooFinance.ts` saat close resmi Yahoo masih null; engine tidak
bisa membedakannya dari close final kecuali lewat jam analisa (< 16:15 WIB). Belum ditandai di model `OHLCVBar`.

## Belum selesai

* Tandai bar yang close-nya diisi harga live di `yahooFinance.ts` agar engine bisa memperlakukannya sebagai candle belum final.
* Riset ulang setup BREAKOUT (mis. base ≥ 3 minggu, close kuat ≥ x ATR di atas level, filter regime IHSG) dengan protokol dev → val → OOS.
* Filter regime IHSG belum ada di engine (input belum membawa data indeks).
* Kalender libur BEI untuk deteksi stale & candle belum tutup.
* Moonstock masih memakai mode momentum20 (sesuai aturannya); belum ada tampilan mode swing di Moonstock.