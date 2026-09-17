Data report EzySaham ini justru menunjukkan **inkonsistensi yang perlu diperbaiki di engine**, terutama pada bagian entry/stop loss.

### Bedah report UDNG

**1. Status BEARISH sudah konsisten dengan sebagian besar indikator**

* RSI **21,7** → sangat oversold.
* MACD bearish.
* Fundamental AI **8/100**.
* ROE **-15%**.
* PBV **17,65x**.
* Sentimen negatif.
* Bandar disebut **Strong Distribution**.

Jadi secara sistem, kesimpulan **"jangan mengejar entry sebelum reversal terkonfirmasi"** masih masuk akal.

**2. Tetapi Entry Rp1.335 bermasalah**

Report mengatakan:

> Entry Rp1.335
> TP Rp484
> SL Rp1.355

Ini sebenarnya adalah struktur **short/rejection**, bukan setup BUY biasa.

Jika harga saat ini sekitar Rp460–Rp480, maka **Rp1.335 bukan entry yang relevan untuk kondisi sekarang**. Itu terlihat seperti resistance historis/level breakdown yang mungkin digunakan engine sebagai level rejection.

Kalau maksud strateginya:

**Short on Rejection**

maka logikanya harus:

```text
Harga naik/retest → Rp1.335
        ↓
rejection
        ↓
konfirmasi bearish
        ↓
ENTRY SHORT
        ↓
SL > Rp1.335
        ↓
TP Rp484 / Rp474
```

Tetapi untuk investor saham Indonesia biasa, **short selling tidak boleh diasumsikan tersedia untuk semua saham/investor**. Jadi output user-facing sebaiknya tidak menyajikan "Entry Short" seperti BUY saham biasa tanpa menjelaskan mekanismenya.

---

## 3. Ada bug yang lebih serius: Stop Loss

Report:

> Stop Loss Rp1.355 (Risk -1,5%) → Cut loss jika Close < Rp1.355

Ini **salah secara logika untuk setup bearish/short**.

Kalau entry = Rp1.335 dan SL = Rp1.355:

**Short:**

1.335 → 1.355 = **rugi**, bukan -1,5% dari arah harga saham.

Dan:

> "Cut loss jika Close < Rp1.355"

juga terbalik.

Untuk short, biasanya:

```text
ENTRY SHORT = 1.335
SL = 1.355

Jika CLOSE > 1.355
→ invalidasi bearish
→ EXIT/CUT
```

Bukan `< 1.355`.

### Jadi engine EzySaham perlu membedakan:

```text
LONG
Entry 1.335
SL 1.305
→ cut jika Close < SL

SHORT
Entry 1.335
SL 1.355
→ cut jika Close > SL
```

Ini penting sekali karena kalau engine menghasilkan sinyal otomatis, **arah posisi harus menjadi parameter utama**.

---

# 4. TP juga perlu diperbaiki

Untuk short:

Entry 1.335 → TP 484

Return kotor:

**(1.335 - 484) / 1.335 = +63,75%**

Jadi angka **+63,7% benar secara matematis untuk posisi short**.

Tetapi ini bukan "Gain" dalam arti harga saham naik.

Lebih tepat ditulis:

> **Potensi profit short: +63,7%**

supaya retail tidak salah memahami.

---

# 5. Ada kontradiksi lain

Report mengatakan:

> RSI 21,7 Oversold

tetapi sistem tetap memberi:

> Entry 1.335

Padahal harga sudah jauh di bawah level tersebut.

Untuk sistem trading, saya sarankan jangan hanya menghasilkan satu **Entry Zone**.

Buat **3 level**:

### 🔴 Current Action

**NO TRADE**

Harga sekarang belum memberikan setup reversal.

### 🟠 Rejection Zone

**Rp1.335**

Jika harga melakukan rebound menuju resistance tersebut dan gagal breakout → bearish continuation setup.

### 🟢 Reversal Confirmation

Misalnya:

```text
Break resistance
+
Volume > average
+
EMA9 > EMA21
+
MACD bullish
+
Higher Low
```

→ baru status berubah dari:

**BEARISH → REVERSAL WATCH**

Kemudian:

**REVERSAL WATCH → BUY**

setelah konfirmasi berikutnya.

---

# 6. Saya akan ubah output EzySaham UDNG menjadi seperti ini

```text
🚨 UDNG — HIGH RISK / BEARISH

STATUS
🔴 NO TRADE

Harga: ±Rp460–480
Trend: Bearish
RSI: 21.7 — Oversold
MACD: Bearish
Fundamental Score: 8/100
Composite Score: 33/100
Bandar: Strong Distribution

━━━━━━━━━━━━━━━━━━━━

📍 RESISTANCE / REJECTION
Rp1.335

Level ini bukan BUY ENTRY.

Jika harga rebound menuju Rp1.335
dan gagal breakout:
→ bearish rejection confirmed

━━━━━━━━━━━━━━━━━━━━

📍 SUPPORT
Rp484
Rp474
Rp460
Rp438

━━━━━━━━━━━━━━━━━━━━

⚠️ IMPORTANT

Oversold ≠ BUY

Harga sudah turun ekstrem ≠ murah.

Jangan melakukan average down hanya
karena drawdown sudah besar.

━━━━━━━━━━━━━━━━━━━━

🟢 REVERSAL CONFIRMATION

Tunggu:

☐ Higher Low
☐ EMA9 > EMA21
☐ MACD bullish cross
☐ Volume meningkat
☐ Break resistance
☐ Tidak ada distribusi broker dominan

Jika belum:
→ NO TRADE
```

---

# 7. Justru UDNG bagus untuk menguji "Black List Engine"

Dari kasus ini, saya akan menambahkan **Risk Gate** sebelum EzySaham mengeluarkan BUY.

Misalnya:

```text
IF
    trend = BEARISH
AND RSI < 25
AND fundamental_score < 20
AND distribution = STRONG
AND drawdown_from_high > 70%
THEN

    signal = "NO TRADE"
    confidence = HIGH
    disable_average_down = TRUE
```

Jadi walaupun technical scanner menemukan:

> RSI oversold

sistem **tidak boleh otomatis mengubahnya menjadi BUY**.

Ini sangat penting.

Karena:

**RSI oversold adalah kondisi, bukan sinyal reversal.**

---

## Dan saya akan tambahkan "Knife Catching Risk"

Untuk EzySaham:

| Kondisi                      | Output                |
| ---------------------------- | --------------------- |
| RSI <30                      | Oversold              |
| RSI <25 + downtrend          | 🔴 Falling Knife Risk |
| RSI <25 + bullish divergence | 🟠 Reversal Watch     |
| RSI <25 + higher low         | 🟡 Early Reversal     |
| RSI <25 + breakout + volume  | 🟢 Reversal Confirmed |

Dengan begitu EzySaham tidak lagi sekadar berkata:

> **"RSI oversold → mungkin BUY."**

Tetapi:

> **"Oversold + downtrend + distribusi → jangan menangkap pisau jatuh."**

Menurut saya, **kasus UDNG sangat bagus dijadikan test case untuk memperbaiki scoring engine EzySaham**, terutama supaya sistem tidak menghasilkan **BUY/Entry yang bertentangan dengan arah posisi, SL, dan kondisi harga aktual**.

----
Bisa. Untuk EzySaham, saya sarankan prompt-nya bukan sekadar memperbaiki UDNG, tetapi membuat **AI Research Engine memiliki "Consistency & Risk Gate"** sehingga kasus seperti UDNG tidak terulang pada saham lain.

Berikut prompt yang bisa langsung Anda berikan ke AI coding agent.

```text
Anda adalah Senior Quant Developer + Financial Data Engineer yang bertugas memperbaiki Equity Research Engine EzySaham AI.

TUJUAN UTAMA:
Perbaiki inkonsistensi antara:
- Status saham
- Strategi
- Direction (LONG/SHORT/NO TRADE)
- Entry
- Stop Loss
- Take Profit
- Risk/Reward Ratio
- Gain/Loss %
- Technical signal
- Fundamental signal
- Bandar/Broker signal
- Sentiment
- Current price
- Support/Resistance
- Risk management

Jangan hanya memperbaiki tampilan/output. Audit dan perbaiki LOGIKA ENGINE agar seluruh output saling konsisten.

==================================================
1. MASALAH UTAMA YANG HARUS DIPERBAIKI
==================================================

Contoh kasus UDNG:

STATUS:
BEARISH

STRATEGY:
Hindari / Take Profit
Breakdown / Short on Rejection

ENTRY:
Rp1.335

TP:
Rp484

SL:
Rp1.355

CURRENT PRICE:
sekitar Rp460–480

Masalah:

A. Entry Rp1.335 berada jauh di atas current price.
B. Setup sebenarnya adalah SHORT ON REJECTION, bukan LONG BUY.
C. SL Rp1.355 hanya masuk akal jika position direction = SHORT.
D. Tetapi wording "Cut loss jika Close < Rp1.355" salah arah.
E. TP Rp484 dari entry Rp1.335 menghasilkan profit SHORT, bukan "Gain" LONG.
F. Engine belum membedakan dengan tegas LONG, SHORT, dan NO TRADE.
G. RSI oversold tidak boleh otomatis dianggap BUY.
H. Strong Distribution + Bearish + Fundamental sangat rendah seharusnya dapat memblokir BUY.
I. Entry/SL/TP harus divalidasi terhadap current price.
J. Risk/Reward harus dihitung berdasarkan direction.
K. Sistem tidak boleh menghasilkan rekomendasi trading yang secara matematis atau logis bertentangan.

==================================================
2. BUAT POSITION DIRECTION SEBAGAI FIELD WAJIB
==================================================

Tambahkan:

direction:
- LONG
- SHORT
- NO_TRADE

Semua perhitungan berikut WAJIB menggunakan direction:

- Entry
- Stop Loss
- TP1
- TP2
- Risk
- Reward
- R:R
- Expected Return
- Cut Loss Rule
- Take Profit Rule
- Signal wording

Jangan pernah menghitung Entry/SL/TP sebelum direction ditentukan.

==================================================
3. RULE LONG
==================================================

Untuk LONG:

Entry < TP1
Entry < TP2

Stop Loss < Entry

Risk:
Entry - Stop Loss

Reward TP1:
TP1 - Entry

Reward TP2:
TP2 - Entry

Risk percentage:
(Entry - SL) / Entry * 100

Reward percentage:
(TP - Entry) / Entry * 100

R:R:
(TP - Entry) / (Entry - SL)

Invalidation:
CLOSE < STOP LOSS

Wording:

"Cut loss jika Close < RpX"

Tidak boleh menggunakan wording SHORT pada LONG.

==================================================
4. RULE SHORT
==================================================

Untuk SHORT:

Entry > TP1
Entry > TP2

Stop Loss > Entry

Risk:
Stop Loss - Entry

Reward TP1:
Entry - TP1

Reward TP2:
Entry - TP2

Risk percentage:
(SL - Entry) / Entry * 100

Potential profit:
(Entry - TP) / Entry * 100

R:R:
(Entry - TP) / (SL - Entry)

Invalidation:
CLOSE > STOP LOSS

Wording:

"Exit/Cut loss jika Close > RpX"

Jangan menggunakan kata "Gain" untuk short.

Gunakan:
"Potential Short Profit"

Contoh:

Entry Short = Rp1.335
SL = Rp1.355
TP = Rp484

Potential profit:
(1335 - 484) / 1335 * 100
= 63.75%

Risk:
(1355 - 1335) / 1335 * 100
= 1.50%

R:R:
851 / 20
= 42.55R

Jika hasil R:R ekstrem seperti ini, JANGAN otomatis menganggap setup sangat bagus.

Tambahkan sanity check karena entry mungkin terlalu jauh dari current price atau setup secara praktis tidak executable.

==================================================
5. CURRENT PRICE VALIDATION
==================================================

Tambahkan validation layer.

Bandingkan:

current_price
entry
SL
TP1
TP2

Untuk LONG:

current price harus berada dekat dengan entry zone atau kondisi entry harus dijelaskan sebagai future pullback/breakout entry.

Untuk SHORT ON REJECTION:

current_price boleh berada di bawah entry.

Tetapi output WAJIB menjelaskan:

"Entry hanya aktif jika harga rebound/retest ke area RpX dan terjadi rejection."

Jangan menampilkan Rp1.335 sebagai "Current Entry" jika harga sekarang Rp460.

Gunakan:

REJECTION ZONE:
Rp1.335

ENTRY TRIGGER:
Rejection bearish di Rp1.335

STATUS:
WAIT / NO TRADE

==================================================
6. BEDAKAN ENTRY TYPE
==================================================

Tambahkan:

entry_type:
- MARKET
- BUY_ON_SUPPORT
- BUY_ON_BREAKOUT
- BUY_ON_PULLBACK
- SHORT_ON_REJECTION
- SHORT_ON_BREAKDOWN
- WAIT_CONFIRMATION
- NO_TRADE

Contoh UDNG:

direction:
SHORT

entry_type:
SHORT_ON_REJECTION

resistance:
Rp1.335

current_price:
±Rp460–480

status:
NO_TRADE / WAIT_CONFIRMATION

Artinya:

Harga belum berada di entry zone.

Tidak boleh menghasilkan:

"SHORT NOW"

==================================================
7. OVERSOLD RULE
==================================================

RSI oversold TIDAK boleh otomatis menghasilkan BUY.

Implementasikan:

RSI < 30:
status = OVERSOLD

RSI < 25 + BEARISH TREND:
status = FALLING_KNIFE_RISK

RSI < 25 + bullish divergence:
status = REVERSAL_WATCH

RSI < 25 + Higher Low:
status = EARLY_REVERSAL

RSI < 25 + Breakout Resistance + Volume Confirmation:
status = REVERSAL_CONFIRMED

Contoh:

RSI = 21.7
Trend = Bearish

Output:

"RSI Oversold — tetapi belum merupakan sinyal BUY."

Jika Strong Distribution juga aktif:

"Falling Knife Risk — hindari average down sebelum reversal terkonfirmasi."

==================================================
8. RISK GATE / BUY BLOCKER
==================================================

Tambahkan Risk Gate sebelum menghasilkan BUY.

Contoh:

IF:
trend = BEARISH
AND fundamental_score < 20
AND distribution = STRONG
AND RSI < 25
AND price below EMA50
AND price below EMA200

THEN:

signal = NO_TRADE

buy_allowed = FALSE

reason:
"Multiple bearish conditions detected."

Jangan biarkan satu indikator bullish seperti:

RSI oversold
atau EMA9 > EMA21 intraday

mengalahkan beberapa faktor bearish utama.

==================================================
9. HIERARCHY OF SIGNALS
==================================================

Buat hierarchy:

LEVEL 1 — HARD RISK FILTER

- Suspensi
- Extreme volatility
- Trading halt
- Corporate action risk
- Liquidity risk
- Data invalid
- Fundamental distress

LEVEL 2 — MARKET STRUCTURE

- Higher High
- Higher Low
- Lower High
- Lower Low
- Breakout
- Breakdown

LEVEL 3 — TREND

- EMA9
- EMA21
- EMA50
- EMA200

LEVEL 4 — MOMENTUM

- RSI
- MACD

LEVEL 5 — VOLUME

- RVOL
- Volume expansion
- Volume contraction

LEVEL 6 — BROKER/BANDAR

- Accumulation
- Distribution
- Foreign Flow

LEVEL 7 — SENTIMENT

Jangan biarkan LEVEL 4/5 sendirian membatalkan LEVEL 1/2.

==================================================
10. SUPPORT / RESISTANCE VALIDATION
==================================================

Jangan menggunakan resistance sebagai BUY entry.

Contoh:

Resistance:
Rp1.335

Bearish setup:

"Wait for rejection near Rp1.335."

Bullish setup:

"Breakout confirmation above Rp1.335 with volume."

Jadi resistance bisa menjadi:

- SHORT rejection zone
ATAU
- LONG breakout trigger

tergantung direction.

==================================================
11. STOP LOSS VALIDATION
==================================================

Tambahkan automatic validation.

LONG:

if SL >= Entry:
ERROR_INVALID_LONG_SL

SHORT:

if SL <= Entry:
ERROR_INVALID_SHORT_SL

Jangan publish report jika validation gagal.

==================================================
12. TP VALIDATION
==================================================

LONG:

TP1 > Entry
TP2 >= TP1

SHORT:

TP1 < Entry
TP2 <= TP1

Jika tidak memenuhi:

ERROR_INVALID_TP_STRUCTURE

==================================================
13. R:R VALIDATION
==================================================

Minimum configurable threshold:

MIN_RR = 1.5

Tetapi jangan menjadikan R:R tinggi sebagai alasan otomatis untuk BUY/SHORT.

Contoh:

Entry Short 1.335
SL 1.355
TP 484

R:R = 42.55R

Ini harus diberi warning:

"Extreme R:R detected. Entry is far from current price and setup may not be practically executable."

Jangan menampilkan:

"Excellent R:R"

secara otomatis.

==================================================
14. DISTANCE FROM CURRENT PRICE
==================================================

Tambahkan:

entry_distance_pct

Formula:

abs(entry - current_price) / current_price * 100

Jika distance terlalu besar:

status:
WAIT

warning:
"Entry zone is significantly distant from current market price."

Contoh:

Current:
Rp460

Entry:
Rp1.335

Distance:

abs(1335 - 460) / 460 * 100

≈ 190%

Maka:

"Entry Rp1.335 is not an immediate entry."

==================================================
15. STATUS HARUS DIPISAH DARI STRATEGY
==================================================

Gunakan:

market_status:
- BULLISH
- BEARISH
- SIDEWAYS
- REVERSAL
- UNKNOWN

trade_status:
- BUY
- SELL
- SHORT_SETUP
- WAIT
- NO_TRADE

strategy:
- MOMENTUM
- BUY_ON_SUPPORT
- BUY_ON_BREAKOUT
- MEAN_REVERSION
- SHORT_ON_REJECTION
- BREAKDOWN
- AVOID

Contoh UDNG:

market_status:
BEARISH

trade_status:
NO_TRADE

strategy:
SHORT_ON_REJECTION

Ini lebih benar daripada:

Status BEARISH
+
Entry Rp1.335
+
seolah-olah harus short sekarang.

==================================================
16. "TAKE PROFIT" VS "AVOID"
==================================================

Jika user tidak memiliki posisi:

Jangan gunakan:

"Take Profit"

Gunakan:

"AVOID / NO TRADE"

Jika user memiliki posisi LONG:

"Take Profit / Exit"

Jika setup short:

"Short Setup"

==================================================
17. OUTPUT FORMAT BARU
==================================================

Gunakan format:

🚨 [EQUITY RESEARCH REPORT]
Ticker: $UDNG

MARKET STATUS:
🔴 BEARISH

TRADE STATUS:
⛔ NO TRADE

STRATEGY:
SHORT ON REJECTION

CURRENT PRICE:
RpXXX

--------------------------------

📍 KEY LEVELS

Support:
RpXXX

Resistance:
Rp1.335

Rejection Zone:
Rp1.335

--------------------------------

🎯 ENTRY LOGIC

JANGAN SHORT SEKARANG.

Tunggu:

Harga rebound/retest ke Rp1.335
+
muncul bearish rejection
+
volume/price action mengonfirmasi

Baru setup SHORT aktif.

--------------------------------

🛑 RISK

Entry Short:
Rp1.335

Stop Loss:
Rp1.355

Invalidation:
CLOSE > Rp1.355

Risk:
-1.50%

--------------------------------

🎯 TARGET

TP1:
Rp484

Potential Short Profit:
+63.75%

TP2:
Rp474

Potential Short Profit:
+64.49%

R:R:
42.55R

⚠️ Extreme R:R Warning:
Entry terlalu jauh dari current price.
Setup tidak aktif sebelum harga melakukan retest.

--------------------------------

📊 TECHNICAL

RSI:
21.7 — Oversold

Interpretation:
Oversold ≠ BUY

Trend:
Bearish

MACD:
Bearish

--------------------------------

🏦 MARKET FLOW

Bandar:
Strong Distribution

Interpretation:
Distribution masih menjadi risiko.

--------------------------------

🧮 FUNDAMENTAL

Fundamental Score:
8/100

PBV:
17.65x

ROE:
-15%

--------------------------------

🚨 RISK GATE

BUY BLOCKED = TRUE

Reason:

- Bearish trend
- RSI extremely oversold
- Strong distribution
- Weak fundamental score
- Extreme drawdown
- Reversal belum confirmed

--------------------------------

FINAL:

⛔ NO TRADE

Jangan average down hanya karena RSI oversold atau harga sudah turun sangat dalam.

Tunggu struktur reversal yang valid.

==================================================
18. DATA CONSISTENCY CHECK
==================================================

Sebelum report ditampilkan, jalankan:

validateResearchReport()

Validasi:

1. direction valid
2. strategy compatible dengan direction
3. entry compatible dengan direction
4. SL compatible dengan direction
5. TP compatible dengan direction
6. percentage calculations correct
7. R:R correct
8. current price relationship correct
9. wording compatible dengan direction
10. signal compatible dengan technical state
11. fundamental state tidak bertentangan
12. risk gate tidak dilanggar
13. no missing critical data
14. no divide-by-zero
15. no negative/invalid price
16. TP ordering valid
17. SL ordering valid

Jika salah satu HARD VALIDATION gagal:

report_status:
INVALID

Jangan generate recommendation.

==================================================
19. UNIT TEST WAJIB
==================================================

Buat automated tests untuk minimal:

TEST 1:
LONG normal

Entry 100
SL 95
TP 110

Expected:
Risk = 5%
Reward = 10%
RR = 2R
Invalidation = Close < 95

TEST 2:
SHORT normal

Entry 100
SL 105
TP 90

Expected:
Risk = 5%
Potential Profit = 10%
RR = 2R
Invalidation = Close > 105

TEST 3:
Invalid LONG

Entry 100
SL 105

Expected:
INVALID

TEST 4:
Invalid SHORT

Entry 100
SL 95

Expected:
INVALID

TEST 5:
UDNG-like setup

Current = 460
Entry = 1335
SL = 1355
TP = 484
Direction = SHORT

Expected:

direction = SHORT
entry_type = SHORT_ON_REJECTION
trade_status = WAIT / NO_TRADE
not SHORT_NOW

Potential Profit ≈ 63.75%
Risk ≈ 1.50%
RR ≈ 42.55R

BUT:

extreme_distance_warning = TRUE

TEST 6:
RSI oversold bearish

RSI = 21.7
Trend = BEARISH
Distribution = STRONG

Expected:

BUY = BLOCKED
Status = NO_TRADE
Reason includes:
"oversold does not equal reversal"

TEST 7:
Bullish reversal

RSI = 28
Bullish divergence = TRUE
Higher Low = TRUE
EMA9 > EMA21
Volume expansion = TRUE
Breakout = TRUE

Expected:

status = REVERSAL_CONFIRMED

==================================================
20. JANGAN MENGUBAH DATA MENTAH
==================================================

Jangan mengubah:

- current price
- OHLC
- volume
- broker data
- fundamental data

hanya agar output terlihat konsisten.

Jika data bertentangan:

Tandai sebagai:

DATA_CONFLICT

dan tampilkan warning.

==================================================
21. LOGGING
==================================================

Tambahkan structured logging:

research_validation:

{
  direction,
  strategy,
  current_price,
  entry,
  stop_loss,
  tp1,
  tp2,
  risk_pct,
  reward_pct,
  rr,
  entry_distance_pct,
  risk_gate,
  validation_errors,
  warnings
}

Tujuannya agar setiap report bisa diaudit.

==================================================
22. ACCEPTANCE CRITERIA
==================================================

Perbaikan dianggap berhasil jika:

1. Tidak ada lagi LONG dengan SL > Entry.
2. Tidak ada lagi SHORT dengan SL < Entry.
3. Tidak ada lagi LONG dengan TP < Entry.
4. Tidak ada lagi SHORT dengan TP > Entry.
5. Cut-loss wording selalu mengikuti direction.
6. "Gain" tidak digunakan untuk SHORT.
7. RSI oversold tidak otomatis menjadi BUY.
8. Current price harus diperhitungkan dalam Entry Logic.
9. Resistance tidak otomatis menjadi BUY entry.
10. Entry jauh dari current price harus menghasilkan WAIT/NO_TRADE.
11. Strong Distribution + bearish trend + weak fundamental dapat memblokir BUY.
12. R:R selalu dihitung berdasarkan direction.
13. Extreme R:R mendapat warning.
14. Strategy dan direction tidak boleh bertentangan.
15. Semua report melewati validateResearchReport() sebelum ditampilkan.
16. Semua unit test lulus.

==================================================
23. PRIORITAS IMPLEMENTASI
==================================================

Kerjakan dalam urutan:

P0:
Direction + Entry/SL/TP mathematical validation

P0:
Current Price Validation

P0:
Risk Gate

P0:
RSI Oversold ≠ BUY

P1:
Entry Type

P1:
Market Status vs Trade Status separation

P1:
R:R sanity check

P1:
Extreme distance warning

P2:
Structured validation logging

P2:
Automated unit tests

P2:
UI wording improvements

==================================================
24. HASIL YANG SAYA INGINKAN DARI ANDA
==================================================

Sebelum coding:

1. Audit source code yang terkait Equity Research Engine.
2. Identifikasi file/function yang menghasilkan:
   - status
   - strategy
   - entry
   - SL
   - TP
   - R:R
   - score
   - final recommendation
3. Tunjukkan akar masalah.
4. Buat implementation plan singkat.

Kemudian:

5. Implementasikan perbaikan.
6. Jangan melakukan refactor besar yang tidak diperlukan.
7. Pertahankan API contract yang sudah digunakan frontend jika memungkinkan.
8. Tambahkan backward compatibility jika field lama masih digunakan frontend.
9. Tambahkan unit tests.
10. Jalankan test.
11. Tampilkan contoh output UDNG setelah diperbaiki.
12. Tampilkan contoh LONG normal.
13. Tampilkan contoh SHORT normal.
14. Tampilkan daftar file yang diubah.
15. Tampilkan ringkasan bug yang telah diperbaiki.

PENTING:

Jangan menganggap output AI benar hanya karena secara bahasa terlihat meyakinkan.

Setiap recommendation harus melewati mathematical validation + market-state validation + risk validation terlebih dahulu.

PRINSIP UTAMA:

"NO VALIDATION = NO SIGNAL."

"OVERSOLD ≠ BUY."

"BEARISH ≠ AUTOMATIC SHORT."

"RESISTANCE ≠ BUY ENTRY."

"EXTREME R:R ≠ GOOD TRADE."

"CURRENT PRICE MUST BE PART OF THE DECISION."

Tujuan akhir adalah membuat EzySaham AI menghasilkan research report yang:
- konsisten
- dapat diaudit
- matematis benar
- tidak misleading
- memahami LONG vs SHORT
- mampu mengatakan NO TRADE
- tidak menangkap falling knife
- dan tidak memberikan sinyal hanya karena satu indikator terlihat menarik.
```

### Tambahan yang saya sangat sarankan

Untuk EzySaham, jangan berhenti di prompt di atas. Buat **3 lapisan engine**:

```text
RAW MARKET DATA
       ↓
┌─────────────────────┐
│  ANALYSIS ENGINE    │
│ Fundamental         │
│ Technical           │
│ Broker              │
│ Sentiment           │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│  RISK GATE          │ ← BOLEH / BLOKIR
│ Direction Validator │
│ Entry Validator     │
│ SL/TP Validator     │
│ Current Price Check │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ SIGNAL ENGINE       │
│ BUY                 │
│ WAIT                │
│ NO TRADE            │
│ SHORT SETUP         │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ REPORT GENERATOR    │
│ Human-readable      │
│ EzySaham AI Report  │
└─────────────────────┘
```

**Ini penting:** jangan biarkan LLM langsung menentukan `Entry → SL → TP → Signal` dari data mentah. AI boleh membantu **interpretasi**, tetapi angka dan validitas hubungan **Entry/SL/TP/R:R harus dihitung deterministic oleh code**.

Dengan arsitektur ini, kasus seperti:

> **BEARISH + RSI 21 + Strong Distribution + Fundamental 8/100 → tetapi output seolah-olah ada entry**

akan jauh lebih sulit terjadi.

Dan untuk kasus UDNG, engine akhirnya bisa mengatakan dengan tegas:

**BEARISH → NO TRADE → tunggu rejection/reversal**, bukan sekadar menghasilkan angka entry yang terlihat presisi tetapi tidak actionable.
