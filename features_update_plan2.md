Ya. Saya melihat **dua layar utama EzySaham** yang Anda kirim:

1. **Screener utama** — daftar saham + filter Day Trading/Swing/ARA/Smart Money/Trading Plan.
2. **Detail saham VOKS** — chart + AI Decision & Stock Advisor + scoring Fundamental/Teknikal/Sentimen/Breakout.

Secara keseluruhan, **fondasi desain EzySaham sudah bagus dan terlihat seperti produk fintech/stock-analysis modern**. Tetapi kalau targetnya adalah membuat EzySaham benar-benar berguna untuk trader retail, terutama dengan modal < Rp10 juta seperti strategi yang sedang kita bangun, saya akan mengubah fokus dari **"menampilkan banyak analisis" → "membantu trader mengambil keputusan yang terstruktur."**

TradingView sendiri juga memisahkan market data, technicals, financials, valuation, growth, dan risk/margin sebagai kelompok filter yang berbeda; pendekatan seperti ini bagus dijadikan referensi arsitektur screener. ([TradingView][1])

---

# 1. Penilaian saya

| Area                 | Nilai | Catatan                                 |
| -------------------- | ----: | --------------------------------------- |
| Visual               | ⭐⭐⭐⭐½ | Bersih, modern                          |
| Struktur informasi   |  ⭐⭐⭐⭐ | Sudah baik tetapi terlalu panjang       |
| Screener             |  ⭐⭐⭐⭐ | Potensial sangat kuat                   |
| AI Analysis          |  ⭐⭐⭐⭐ | Menarik, tapi logika perlu diperjelas   |
| Trading Action       |   ⭐⭐⭐ | Belum cukup actionable                  |
| Risk Management      |   ⭐⭐⭐ | Perlu diperkuat                         |
| Data freshness       |    ⭐⭐ | **Ini sangat penting**                  |
| Scalping/Day Trading |   ⭐⭐⭐ | Belum cukup real-time                   |
| Smart Money          |  ⭐⭐⭐½ | Konsep bagus, perlu validasi lebih kuat |
| Trading Plan         |   ⭐⭐⭐ | Bisa menjadi killer feature             |

**Overall: 8/10 untuk prototype.**

Yang paling penting sekarang bukan mempercantik UI lagi.

**Yang perlu diperbaiki adalah "decision engine"-nya.**

---

# 2. Masalah terbesar yang saya lihat

## 🚨 AI Advisor terlalu mudah disalahartikan sebagai sinyal BUY/SELL

Contohnya VOKS:

> NEUTRAL / TAHAN (WATCHLIST)

Tetapi di bagian bawah:

> Technical Bullish
> Lonjakan Volume Akumulasi
> Potensi Smart Money

Kemudian:

> Pantau penembusan resistance Rp290 untuk konfirmasi sinyal beli.

Ini sebenarnya bagus.

Tetapi user bisa bertanya:

> **"Jadi beli atau tidak?"**

AI harus menjawab secara eksplisit.

Saya sarankan mengganti output:

### Jangan:

**NEUTRAL / TAHAN**

### Menjadi:

# 🟡 WAIT FOR CONFIRMATION

**Belum ada entry valid**

Kemudian:

> Entry sekarang: ❌
> Buy on breakout: ✅
> Buy zone: Rp260–270
> Confirmation: Close > Rp290 + volume ≥ 2× rata-rata
> Stop Loss: Rp250
> Target 1: Rp300
> Target 2: Rp320
> Risk/Reward: 1 : 2.4

Ini jauh lebih berguna bagi trader.

---

# 3. Pisahkan "ANALYSIS" dan "ACTION"

Saat ini halaman terlalu banyak mencampur:

* fundamental
* teknikal
* berita
* breakout
* AI
* rekomendasi

Saya akan membuat dua layer.

## Layer 1 — "Apa yang terjadi?"

Misalnya:

**VOKS**

> Trend: 🟢 Bullish
> Momentum: 🟢 Strong
> Volume: 🔥 Abnormal
> RSI: 🔴 Overbought
> Fundamental: 🔴 Weak
> Breakout: 🟡 Confirming

---

## Layer 2 — "Apa yang harus dilakukan?"

### 🎯 TRADING PLAN

**Setup:** Momentum Breakout

**Entry**

> Rp270–275

**Confirmation**

> Break Rp290

**Target**

> TP1 Rp300
> TP2 Rp320
> TP3 Rp350

**Stop Loss**

> Rp250

**Risk**

> High

**Holding**

> 1–5 hari

**Status**

> 🟡 WAIT

Ini akan menjadi jauh lebih powerful.

---

# 4. Saya sangat menyarankan membuat "Trading Plan" sebagai fitur utama

Dari percakapan kita sebelumnya, menurut saya ini justru bisa menjadi **killer feature EzySaham**.

Contoh yang Anda inginkan:

> $RISE — Swing
> Fair Value
> Broker: Akumulasi
> Buy: 970–980
> AVGD: 940–955
> TP: 1005–1015
> CL: 895

Saya akan mengubahnya menjadi card:

---

### 🟢 RISE

**Swing Trading**

**Broker Flow**
🟢 AKUMULASI

### ENTRY

**Rp970 – 980**

### ADD / AVGD

**Rp940 – 955**

### TAKE PROFIT

🎯 TP1 **Rp1.005**
🎯 TP2 **Rp1.015**

### STOP LOSS

🛑 **Rp895**

**Risk/Reward**
`1 : 2.1`

---

Dan yang paling penting:

### 💰 POSITION CALCULATOR

Misalnya modal:

**Rp5.000.000**

Risk:

**1% = Rp50.000**

Maka EzySaham menghitung otomatis:

> Maksimum risiko = Rp50.000
> Jarak entry → SL = Rp80
> Maksimum saham = 625 lot?

Tentunya dihitung berdasarkan lot dan tick size yang benar.

Ini akan membuat EzySaham bukan hanya **stock screener**, tetapi menjadi **trading assistant**.

---

# 5. Tambahkan "Risk Score"

Sekarang Anda punya:

* Fundamental 35
* Technical 84
* Sentiment 44
* Breakout 65

Bagus.

Tetapi trader sebenarnya ingin tahu:

> **"Kalau saya masuk, seberapa besar risiko saya?"**

Tambahkan:

# RISK SCORE

### 🟢 LOW

0–30

### 🟡 MEDIUM

31–60

### 🔴 HIGH

61–100

Contoh:

**VOKS**

> Risk Score: 🔴 72/100

Alasan:

* RSI overbought
* Fundamental lemah
* volatility tinggi
* distribution risk
* harga sudah naik terlalu cepat

Dengan demikian:

**Technical Score 84 bukan berarti BUY.**

Ini sangat penting.

---

# 6. Jangan menjadikan Composite Score sebagai BUY signal

Misalnya:

> Technical 84

User bisa berpikir:

**84 = beli**

Padahal belum tentu.

Saya sarankan:

### Score ≠ Signal

Gunakan:

**Score**

untuk mengukur kualitas setup.

Kemudian:

**Signal Engine**

yang menentukan:

> BUY
> WAIT
> AVOID
> EXIT

Contohnya:

```text
Technical       84
Volume          92
Momentum        88
Breakout        65
Fundamental     35
Risk            72

--------------------
SETUP SCORE     78
RISK SCORE      72

DECISION
🟡 WAIT
```

Ini lebih profesional.

---

# 7. Buat "Why NOT Buy?"

Ini sebenarnya sudah Anda lakukan dan saya suka.

Tetapi saya akan menjadikannya fitur utama.

Contoh:

## ❌ KENAPA JANGAN BELI SEKARANG?

1. RSI 84 → overbought
2. Harga sudah +35%
3. Risk distribution tinggi
4. Fundamental lemah
5. Belum breakout resistance Rp290

Kemudian:

## ✅ KAPAN BOLEH BELI?

> Jika harga break Rp290

dan

> Volume > 2× MA20

dan

> Close tetap di atas Rp290.

Dengan demikian AI tidak hanya berkata:

> "BUY"

tetapi:

> **"BUY JIKA..."**

Ini jauh lebih aman.

---

# 8. Tambahkan "Trigger"

Saya sangat merekomendasikan ini.

Misalnya:

### VOKS

| Trigger         | Status |
| --------------- | ------ |
| Harga > EMA20   | ✅      |
| EMA20 > EMA50   | ✅      |
| RSI > 70        | ⚠️     |
| RVOL > 2        | 🔥     |
| Break Rp290     | ❌      |
| Volume breakout | ❌      |

Kemudian:

### SIGNAL

**4/6 conditions fulfilled**

🟡 **WAIT**

Begitu breakout terjadi:

**6/6**

🟢 **BUY CONFIRMATION**

---

# 9. Ini akan sangat membantu masalah VOKS yang Anda alami

Sebelumnya kita membahas kasus:

> AI mengatakan AVOID
> tetapi VOKS kemudian ARA.

Ini contoh penting bahwa **AI EOD tidak boleh dianggap sebagai prediksi hari berikutnya**.

Anda bahkan sudah menampilkan:

> Data EOD
> bukan prediksi harga

Bagus.

Tetapi saya akan membuatnya jauh lebih jelas.

Di bagian atas screener:

### 🕒 DATA STATUS

> **Market Data:** 07 Aug 2026 11:16 WIB
> **Data:** LIVE
> **Technical:** Intraday

atau:

> **Market Data:** 06 Aug 2026
> **Data:** EOD
> **Delay:** 1 trading day

Dengan warna yang sangat jelas.

Karena:

**EOD 3 Agustus → tidak boleh dipakai untuk menyimpulkan kondisi 7 Agustus.**

---

# 10. Buat Data Freshness Badge

Saya sangat menyarankan setiap saham mempunyai badge:

### 🟢 LIVE

Data < 1 menit

### 🟡 DELAYED

Data 1–15 menit

### 🟠 RECENT

Data < 1 hari

### 🔴 STALE

Data > 1 hari

Contoh:

> VOKS Rp270
> 🟢 LIVE 11:16:32 WIB

atau:

> VOKS Rp202
> 🔴 EOD — 03 Aug 2026

Ini akan mencegah banyak kesalahan interpretasi.

---

# 11. Screener utama terlalu "flat"

Screenshot kedua menunjukkan daftar:

> VOKS
> ROCK
> KBLV
> MCAS
> ISAT
> RODA
> CBPE
> ...

Ini bagus untuk scanning.

Tetapi trader harus bisa melihat **"kenapa saham ini masuk?"**

Tambahkan kolom:

### SETUP

Misalnya:

| Saham |    % | Value | Setup       |
| ----- | ---: | ----: | ----------- |
| VOKS  | +35% |  1.1T | 🚀 Breakout |
| ROCK  | +25% |  2.7T | 🔥 Momentum |
| KBLV  | +24% |  273B | 🚀 Breakout |
| MCAS  | +24% |  256B | 🔥 Volume   |

Jadi bukan sekadar:

> "Naik 35%"

tetapi:

> **"Naik karena apa?"**

---

# 12. Buat "Reason Chips"

Ini akan sangat bagus secara UX.

Contoh:

### VOKS

`🚀 Breakout`

`🔥 RVOL 16x`

`📈 EMA20 ↑`

`⚠️ RSI 84`

`💰 Value 1.1T`

Trader langsung memahami kondisi saham tanpa membuka detail.

---

# 13. Filter Day Trading perlu ditingkatkan

Sekarang Anda punya:

* Semua
* Day Trading
* Swing Hunter
* ARA Hunter
* Smart Money
* Trading Plan

Saya sarankan:

### 🔥 DAY TRADING

Filter:

**Liquidity**

> Value > Rp10B

**Momentum**

> Change > +2%

**RVOL**

> > 1.5

**Trend**

> Price > EMA20

**Momentum**

> RSI 50–75

**Volatility**

> ATR%

> 2%

**Market**

> IHSG trend

Kemudian:

### RESULT

**12 saham**

bukan 50 saham.

---

# 14. Smart Money Hunter perlu dibuat lebih spesifik

Konsep Anda:

> sideways
> EMA20 naik
> volume meningkat
> RVOL >1.3
> MACD golden cross
> RSI 50–60
> belum breakout
> value >5B

Menurut saya **bagus sekali sebagai starting point**.

Tetapi jangan menyebut:

> "Smart Money"

secara terlalu definitif.

Lebih aman:

### 🟢 EARLY ACCUMULATION

atau

### 🟢 SMART MONEY SIGNAL

Karena EzySaham sebenarnya tidak bisa memastikan bahwa:

> "institusi sedang membeli"

hanya dari OHLCV.

Volume dan indikator bisa memberikan **indikasi**, bukan bukti siapa yang melakukan transaksi.

TradingView sendiri menggunakan kombinasi moving averages dan oscillator dalam technical ratings, dan menyediakan filter volume, technicals, market data, dll. ([TradingView][2])

---

# 15. ARA Hunter harus menjadi fitur khusus

Ini menurut saya bisa sangat menarik untuk EzySaham.

Bukan:

> "Cari saham yang sudah ARA"

tetapi:

# 🚀 ARA HUNTER

### PRE-ARA

Mendeteksi saham yang:

* mendekati resistance
* volume meningkat
* RVOL tinggi
* bid kuat
* momentum meningkat
* price acceleration
* value meningkat
* free float rendah
* volatilitas tinggi

Kemudian:

### ARA Probability

Misalnya:

**72/100**

Tetapi tulis:

> **Setup Score: 72/100**

bukan:

> Probability ARA 72%

karena itu terdengar seperti probabilitas statistik yang harus benar-benar dibuktikan dengan backtest.

---

# 16. Tambahkan "Distance to ARA"

Ini akan sangat berguna.

Misalnya:

**VOKS**

Harga:

> Rp270

ARA:

> Rp270

Status:

> 🔥 ARA

Tetapi sebelum ARA:

> Current: Rp265
> ARA: Rp270
> Distance: **+1.89%**

Trader langsung tahu:

> "tinggal sedikit lagi."

---

# 17. Tambahkan "Distance to Resistance"

Contoh:

> Harga: Rp270
> Resistance: Rp290

### +7.4% to resistance

Ini penting untuk menentukan apakah risk/reward masih menarik.

Kalau:

> Entry 270
> Resistance 275

Maka:

❌ **Risk/Reward buruk**

Sebaliknya:

> Entry 270
> Resistance 320

🟢 **Potential room +18.5%**

---

# 18. Saya akan menambahkan fitur "Trade Quality"

Ini bisa menjadi fitur pembeda EzySaham.

Contoh:

# TRADE QUALITY

### 🟢 A+

Setup sangat bagus

### 🟢 A

Bagus

### 🟡 B

Masih layak

### 🟠 C

Risk tinggi

### 🔴 D

Hindari

Misalnya:

**VOKS**

> Technical: 84
> Volume: 95
> Breakout: 65
> Fundamental: 35
> Risk: 72

Output:

# 🟡 B-

**Tradeable, tetapi bukan entry ideal**

---

# 19. Untuk user modal < Rp10 juta, tambahkan "Capital Fit"

Ini menurut saya **WAJIB** untuk EzySaham versi retail.

Misalnya user setting:

> Modal trading: Rp8.000.000

EzySaham menghitung:

### VOKS

Entry:

Rp270

SL:

Rp250

Risk:

7.4%

Kalau user membatasi:

> Max risk/trade = 1%

Maka:

> Maximum loss = Rp80.000

EzySaham otomatis menentukan:

> **Recommended capital: Rp1.08M**

atau jumlah lot sesuai tick/lot.

---

# 20. Ini bisa menjadi "AI Trading Plan Generator"

User klik:

### 📋 BUAT TRADING PLAN

EzySaham menghasilkan:

```text
VOKS
Day Trading

Entry:
270–275

Confirmation:
> 275 + volume meningkat

TP1:
290

TP2:
300

SL:
260

Risk:
3.6%

R/R:
1 : 2

Modal:
Rp5.000.000

Position:
18 lot

Max Loss:
Rp75.000

Status:
WAIT
```

Ini jauh lebih actionable daripada 50 indikator.

---

# 21. Chart perlu diperbaiki

Pada screenshot detail VOKS, chart terlalu kosong.

Terlihat:

> EMA20
> EMA50
> EMA200

tetapi tidak ada candle yang jelas.

Untuk trader, **candlestick jauh lebih penting daripada line chart**.

Saya sarankan:

### Default

**Candlestick**

dengan:

* EMA20
* EMA50
* EMA200
* Volume
* Support
* Resistance

Kemudian tab:

`1D | 1W | 1M | 3M | 6M | 1Y`

---

# 22. Tambahkan timeframe

Sangat penting untuk produk Anda:

### TIMEFRAME

`M1 | M5 | M15 | H1 | H4 | D1 | W1`

Kemudian AI harus berubah berdasarkan timeframe.

Contoh:

### M5

**Day Trading**

> EMA20 > EMA50
> RSI 64
> RVOL 2.8

### D1

**Swing**

> EMA20 < EMA50
> RSI 48

Sehingga:

> **Day Trading: BUY**

tetapi:

> **Swing: WAIT**

Ini jauh lebih realistis.

---

# 23. Jangan gunakan terlalu banyak AI wording

Sekarang ada banyak:

> AI Decision
> AI Confidence
> Buy Catalysts
> Bearish Risks
> Executive Summary
> Philosophy EzySaham
> Fundamental
> Technical
> Sentiment
> Breakout Hunter

Secara visual keren.

Tetapi trader lama-lama akan merasa:

> **"Terlalu banyak membaca."**

Saya sarankan struktur:

### 1️⃣ DECISION

**BUY / WAIT / AVOID**

### 2️⃣ WHY

3 alasan terkuat

### 3️⃣ TRADE PLAN

Entry / TP / SL

### 4️⃣ SCORE

Technical / Fundamental / Momentum / Risk

### 5️⃣ DETAIL

Semua analisis panjang masuk expandable accordion.

---

# 24. Desain screener: saya akan ubah seperti ini

```text
┌──────────────────────────────────────────────┐
│ EzySaham AI                     🔍 Search     │
├──────────────────────────────────────────────┤
│ IHSG 6,409  ▲0.7%        LIVE ●             │
├──────────────────────────────────────────────┤
│                                              │
│ [Semua] [Day] [Swing] [ARA] [Smart Money]   │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔥 DAY TRADING                          │ │
│ │ 19 setup ditemukan                       │ │
│ │                                          │ │
│ │ VOKS      +35%   🔥 RVOL 16x    A       │ │
│ │ ROCK      +25%   🚀 Breakout    A-      │ │
│ │ KBLV      +24%   🔥 Momentum    B+      │ │
│ │ MCAS      +24%   🚀 Breakout    B       │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Filter ▼                                     │
│                                              │
│ Value >10B   RVOL >1.5   RSI 50–75           │
│ EMA20 > EMA50   Change >2%                   │
└──────────────────────────────────────────────┘
```

Lebih cepat dibaca.

---

# 25. Fitur yang menurut saya harus menjadi roadmap

Saya akan prioritaskan seperti ini:

## 🔥 P0 — WAJIB

### 1. Data freshness

`LIVE / DELAYED / EOD / STALE`

### 2. Trading Plan

Entry / AVGD / TP / SL / R:R

### 3. Position Calculator

Modal → lot → risk → potential profit

### 4. Signal Engine

BUY / WAIT / AVOID

### 5. Trigger

"BUY jika..."

### 6. Risk Score

---

## 🚀 P1 — Sangat penting

### 7. Multi timeframe

M1/M5/M15/H1/H4/D1

### 8. Breakout Hunter

### 9. Smart Money Hunter

### 10. ARA Hunter

### 11. Market Regime

```text
IHSG
🟢 Bullish
🟡 Sideways
🔴 Bearish
```

Kemudian rekomendasi saham menyesuaikan kondisi IHSG.

---

## 💎 P2 — Pembeda EzySaham

### 12. Trade Journal

Setiap transaksi:

> Entry
> Exit
> Profit
> Loss
> Screenshot
> Reason

Kemudian AI menganalisis:

> Win rate 63%
> Average win +5.8%
> Average loss -2.1%
> Best setup: Breakout
> Worst setup: Revenge trading

Ini **sangat powerful**.

---

# 26. Fitur paling menarik: "EzySaham Scorecard"

Saya bahkan akan membuat satu tampilan seperti ini:

```text
             VOKS
        Rp270  +35%

       🟡 WAIT

┌───────────────────────┐
│ TECHNICAL       84 🟢 │
│ MOMENTUM        91 🔥 │
│ VOLUME          96 🔥 │
│ BREAKOUT        65 🟡 │
│ FUNDAMENTAL     35 🔴 │
│ RISK            72 🔴 │
└───────────────────────┘

WHY?

🔥 RVOL 16x
📈 Above EMA20
🚀 Strong momentum

BUT

⚠ RSI 84
⚠ +35% today
⚠ Distribution risk

────────────────────────

ENTRY        > Rp290
TP1          Rp310
TP2          Rp330
SL           Rp260

R/R          1 : 2.0

STATUS

🟡 WAIT FOR BREAKOUT
```

**Ini menurut saya jauh lebih kuat daripada sekadar "AI Advisor".**

---

# 27. Satu perubahan paling penting

Kalau saya menjadi **Product Manager EzySaham**, saya akan menggeser positioning dari:

> **"AI Stock Advisor"**

menjadi:

# **AI Trading Decision Assistant**

Karena EzySaham sebenarnya tidak perlu mengklaim:

> "Kami tahu saham akan naik."

Tetapi:

> **"Kami membantu Anda menemukan setup, menghitung risiko, menentukan entry/TP/SL, dan menjelaskan kapan TIDAK boleh masuk."**

Itu lebih kredibel.

Dan indikator teknikal memang lebih tepat diposisikan sebagai alat konfirmasi daripada mesin prediksi tunggal; TradingView misalnya menggabungkan moving averages dan berbagai oscillator untuk technical rating, bukan mengandalkan satu indikator saja. ([TradingView][2])

---

## 🎯 Kesimpulan saya

**UI EzySaham saat ini sudah bagus. Jangan terlalu banyak redesign visual.**

Yang perlu dilakukan sekarang adalah **menaikkan kualitas decision UX**:

> **Screener → Setup → Confirmation → Trading Plan → Position Size → Risk → Execution → Journal**

Bukan:

> Screener → banyak indikator → AI Score → selesai.

Kalau alur pertama berhasil dibuat, EzySaham bisa berkembang dari **website screener saham** menjadi **platform trading assistant untuk trader Indonesia**, terutama untuk trader retail dengan modal kecil.

Dan menurut saya, **Trading Plan + Position Calculator + Risk Engine + Data Freshness** adalah 4 fitur yang paling layak Anda kerjakan terlebih dahulu.

[1]: https://in.tradingview.com/support/solutions/43000718866-tradingview-stock-screener-trade-smarter-not-harder/?utm_source=chatgpt.com "TradingView Stock Screener: trade smarter, not harder — TradingView India"
[2]: https://www.tradingview.com/support/solutions/43000475547-what-do-the-ratings-in-the-screener-mean/?utm_source=chatgpt.com "What do the ratings in the Screener mean? — TradingView"
