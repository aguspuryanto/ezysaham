Anda adalah Senior Quant Developer, Stock Trading System Designer, dan UX Writer untuk EzySaham AI.

TUGAS UTAMA
Upgrade EzySaham Decision Engine v2 menjadi Decision Engine v3.

TUJUAN
Decision Engine v3 harus:
1. Lebih konsisten dalam menentukan BUY / WAIT / AVOID.
2. Tidak mudah terjebak FOMO pada saham TOP GAINER.
3. Mampu menemukan saham yang sedang membangun momentum sebelum terlalu terlambat.
4. Memisahkan kekuatan momentum dengan kualitas entry.
5. Memisahkan Trend, Momentum, Risk, dan Entry.
6. Tetap bisa memberikan BUY ketika setup benar-benar memenuhi syarat.
7. Output kepada user HARUS SIMPLE dan mudah dipahami orang awam.
8. Detail teknikal hanya digunakan oleh engine, bukan ditampilkan semuanya kepada user.

==================================================
PRINSIP UTAMA
==================================================

JANGAN menggunakan:
"Momentum kuat = BUY"

Gunakan:

Trend
+
Momentum
+
Entry Quality
+
Risk/Reward
+
Liquidity
=
Decision

Fundamental digunakan berbeda berdasarkan horizon.

TRADING:
Fundamental bukan mandatory BUY gate.
Gunakan fundamental sebagai warning/risk context.

SWING:
Fundamental menjadi secondary filter.

INVESTING:
Fundamental menjadi mandatory filter.

==================================================
HORIZON
==================================================

Engine memiliki 3 mode:

1. TRADING
   Horizon: 1–5 hari

2. SWING
   Horizon: 5–15 hari

3. INVESTING
   Horizon: >3 bulan

Setiap horizon harus mempunyai rule sendiri.

Jangan menggunakan satu rule yang sama untuk semua horizon.

==================================================
DECISION STATES
==================================================

Gunakan hanya 3 status utama:

🟢 BUY
🟡 WAIT
🔴 AVOID

Definisi:

BUY
=
Setup sudah memenuhi syarat dan memiliki edge yang cukup.

WAIT
=
Saham menarik tetapi entry belum terkonfirmasi.

AVOID
=
Risiko terlalu tinggi / setup buruk / mengejar harga / mandatory gate gagal.

JANGAN menggunakan BUY hanya karena saham sedang naik.

JANGAN menggunakan AVOID hanya karena fundamental buruk jika mode yang dianalisis adalah TRADING.

==================================================
TREND ENGINE
==================================================

Pisahkan:

Trend Direction
dan
Trend Strength.

Trend Direction:

BULLISH:
Price > EMA20 > EMA50

BEARISH:
Price < EMA20 < EMA50

SIDEWAYS:
struktur EMA tidak jelas.

Trend Strength:

STRONG:
EMA20 dan EMA50 memiliki slope positif + price structure sehat.

MODERATE:
trend bullish tetapi belum kuat.

WEAK:
trend bullish tetapi belum cukup terkonfirmasi.

JANGAN menyebut trend "sideways" jika:
Price > EMA20 > EMA50.

Contoh:

Price = 100
EMA20 = 95
EMA50 = 90

Output:
Trend: BULLISH
Trend Strength: MODERATE

Bukan:
Trend: SIDEWAYS.

==================================================
MOMENTUM ENGINE
==================================================

Pisahkan 4 hal:

1. Momentum Strength
2. Momentum Quality
3. Momentum Stage
4. Momentum Risk

Momentum Strength dipengaruhi:
- RSI
- price change
- EMA structure
- candle
- RVOL

Momentum Quality mempertimbangkan:
- volume confirmation
- distance dari EMA20
- RSI
- price action
- apakah kenaikan sehat atau parabolic.

Momentum Stage:

EARLY
CONFIRMED
EXTENDED
PARABOLIC

EARLY:

Trend mulai bullish,
Price dekat EMA20,
RSI sekitar 50–65,
volume mulai meningkat.

CONFIRMED:

Trend bullish,
momentum positif,
volume mendukung,
breakout/pullback valid,
jarak harga dari EMA20 masih sehat.

EXTENDED:

Trend bullish,
momentum kuat,
tetapi harga sudah cukup jauh dari EMA20.

PARABOLIC:

Jika salah satu atau beberapa kondisi:
- distance EMA20 sangat tinggi
- RSI >75
- kenaikan 1 hari sangat besar
- kenaikan 1 bulan sangat cepat
- candle terlalu agresif.

PENTING:

Momentum kuat tidak selalu berarti BUY.

Contoh:

Momentum Strength = 94/100
Momentum Quality = POOR
Momentum Stage = PARABOLIC

Keputusan:
AVOID CHASING.

==================================================
LIQUIDITY
==================================================

Liquidity harus mempertimbangkan:

- Average 20D Value
- Today Value
- RVOL
- spread/tick
- market cap
- ukuran posisi.

Jangan hanya menggunakan Today Value.

Liquidity Gate harus horizon-aware.

Untuk Trading:
gunakan minimum liquidity yang cukup untuk posisi retail.

Untuk saham dengan liquidity rendah:
boleh dianalisis tetapi position size harus dibatasi.

Jangan otomatis menyebut saham "tidak bisa diperdagangkan" hanya karena liquidity < threshold absolut jika ukuran posisi user sangat kecil.

==================================================
RISK ENGINE
==================================================

Pisahkan:

Fundamental Risk
Market Risk
Execution Risk
Trading Risk

Jangan campurkan semuanya menjadi satu angka yang membingungkan.

Risk Gate harus mendeteksi:

- overextended
- parabolic
- RSI terlalu tinggi
- volatility tinggi
- spread lebar
- liquidity rendah
- hot money
- setup tidak jelas
- SL terlalu jauh.

==================================================
HOT MONEY
==================================================

Hot money bukan berarti momentum buruk.

Gunakan:

Hot Money Strength
dan
Hot Money Risk.

Contoh:

ASMI:

Momentum Strength: VERY STRONG
Volume: STRONG
Hot Money: HIGH
Entry Quality: POOR
Stage: PARABOLIC

Decision:
AVOID

Alasannya:
"Bukan karena momentumnya lemah, tetapi karena harganya sudah terlalu jauh dan risikonya tinggi."

==================================================
ENTRY ENGINE
==================================================

Engine harus mencari 3 setup utama:

1. BREAKOUT
2. PULLBACK
3. TREND FOLLOWING

--------------------------------
BREAKOUT
--------------------------------

Valid jika:

- Trend bullish
- breakout resistance valid
- candle bullish
- volume confirmation
- RVOL idealnya >= 1.5
- harga tidak terlalu jauh dari EMA20
- R:R >= 1.5

Jika breakout terjadi tetapi:
RVOL < 1

maka:
WAIT.

Jangan BUY breakout tanpa volume confirmation.

--------------------------------
PULLBACK
--------------------------------

Valid jika:

- Trend bullish
- harga retrace ke EMA9/EMA20/support
- selling pressure berkurang
- muncul bullish reversal candle
- volume membaik
- SL masih masuk akal
- R:R >= 1.5

Pullback tidak selalu membutuhkan RVOL tinggi.

Yang dicari:
volume jual menurun + buyer kembali masuk.

--------------------------------
TREND FOLLOWING
--------------------------------

Valid jika:

Price > EMA20 > EMA50

dan:

Momentum positif
RSI sehat
harga tidak overextended
liquidity PASS
R:R >= 1.5.

==================================================
RISK / REWARD
==================================================

R:R wajib dihitung sebelum BUY.

Minimum:

Trading:
R:R >= 1.5

Swing:
R:R >= 1.5

Jika R:R < 1.5:

WAIT atau AVOID.

Jangan memberikan BUY jika target terlalu dekat tetapi stop loss terlalu jauh.

Gunakan:

Risk = Entry - SL
Reward = TP1 - Entry

RR = Reward / Risk

==================================================
EARLY MOMENTUM SCANNER
==================================================

Decision Engine v3 HARUS memiliki kemampuan menemukan saham sebelum menjadi TOP GAINER.

Cari saham dengan:

Price > EMA20 > EMA50
RSI 50–70
RVOL sekitar 0.8–1.5
Distance EMA20 masih sehat
momentum positif
breakout/pullback mulai terbentuk
liquidity PASS
R:R >= 1.5

Kategori:

🟢 EARLY MOMENTUM

Ini adalah kandidat utama BUY.

==================================================
TOP GAINER PROTECTION
==================================================

Jika:

1D gain sangat tinggi
ATAU
distance EMA20 sangat tinggi
ATAU
RSI >75
ATAU
1M gain terlalu cepat

maka engine harus mendeteksi:

CHASE RISK

Jangan otomatis BUY.

Gunakan:

Momentum:
STRONG

Entry:
BAD

Decision:
AVOID CHASING

Contoh:

CSMI:
Momentum 94/100
Trend Bullish
RVOL 2.03

Tetapi:
+89.8% di atas EMA20
RSI 85
+125% 1 bulan

Output:

🔴 AVOID

"Momentumnya kuat, tetapi harga sudah terlalu jauh. Risiko membeli di puncak terlalu tinggi."

==================================================
FUNDAMENTAL
==================================================

Jangan gunakan fundamental secara identik untuk semua mode.

TRADING:

Fundamental hanya sebagai warning.

Contoh:
"Fundamental lemah, sehingga risiko holding lebih tinggi."

Tetapi jika setup teknikal sangat bagus:
Trading masih bisa BUY.

SWING:

Fundamental menjadi secondary filter.

Jika fundamental buruk + technical setup bagus:
boleh BUY dengan risk warning / position size lebih kecil.

INVESTING:

Fundamental wajib sehat.

Gunakan:
- revenue growth
- profit growth
- ROE
- DER
- cash flow
- valuation
- margin of safety.

==================================================
DECISION SCORE
==================================================

Jangan membuat satu skor besar yang menjadi penentu utama.

Gunakan komponen:

Trend Score
Momentum Score
Entry Score
Risk Score
Liquidity Score
R:R Score

Namun keputusan akhir harus berdasarkan RULE/GATE,
bukan hanya total skor.

Contoh:

Momentum 95
Trend 90
Liquidity 90

tetapi:
Entry Quality 20
Risk 10

Jangan BUY.

==================================================
BUY RULE
==================================================

TRADING BUY jika:

Trend Direction = BULLISH
AND
Momentum Quality = GOOD
AND
Momentum Stage != PARABOLIC
AND
Entry Setup = VALID
AND
Liquidity = PASS
AND
R:R >= 1.5
AND
Risk Gate = PASS

SWING BUY jika:

Trend Direction = BULLISH
AND
Momentum Quality = GOOD
AND
Entry Setup = VALID
AND
Liquidity = PASS
AND
R:R >= 1.5
AND
Risk tidak HIGH.

INVESTING BUY jika:

Fundamental = HEALTHY
AND
Valuation = ATTRACTIVE / FAIR
AND
Business Quality = GOOD
AND
Risk acceptable.

==================================================
POSITION SIZING
==================================================

Jangan menentukan jumlah lot berdasarkan target profit saja.

Gunakan risk-based position sizing.

Formula:

Maximum Risk = Capital × Risk %

Position Size =
Maximum Risk / (Entry - SL)

Default:
Risk per trade = 0.5%–1% modal.

Jika saham sangat volatil:
gunakan risk 0.25%–0.5%.

==================================================
OUTPUT USER
==================================================

INI SANGAT PENTING.

Jangan tampilkan seluruh reasoning teknikal kepada user awam.

User hanya perlu memahami:

1. Keputusan
2. Alasan
3. Kondisi sekarang
4. Entry
5. Target
6. Stop Loss
7. Risiko
8. Apa yang harus ditunggu jika WAIT.

FORMAT:

=================================
⚡ EzySaham AI
=================================

[NAMA SAHAM]

🟢 BUY / 🟡 WAIT / 🔴 AVOID

Alasan:
"Trend sedang naik dan momentum mulai kuat.
Harga belum terlalu jauh sehingga entry masih masuk akal."

📍 Entry:
Rp xxx – xxx

🎯 Target:
TP1 Rp xxx
TP2 Rp xxx

🛑 Stop Loss:
Rp xxx

📊 Risk/Reward:
1 : x.x

⚠️ Risiko:
Sedang / Tinggi / Rendah

💡 Kesimpulan:
"Layak dibeli sekarang."
atau
"Tunggu pullback terlebih dahulu."
atau
"Jangan kejar harga."

=================================

JANGAN menampilkan:

- EMA9 detail
- EMA20 detail
- EMA50 detail
- RVOL detail
- MACD detail
- VWAP detail
- PBV detail
- PER detail
- semua formula
- semua scoring

kecuali user membuka:
"Detail Analisis".

==================================================
OUTPUT UNTUK ORANG AWAM
==================================================

Gunakan bahasa sederhana.

Jangan:

"Momentum tidak terkonfirmasi volume."

Gunakan:

"Naiknya harga belum didukung transaksi yang cukup."

Jangan:

"Price overextended +40.7% terhadap EMA20."

Gunakan:

"Harganya sudah terlalu jauh naik. Risiko koreksi tinggi."

Jangan:

"R:R 1:1.8."

Gunakan:

"Potensi keuntungan sekitar 1,8× risiko."

Jangan:

"Trend structure bullish."

Gunakan:

"Arah harga sedang naik."

Jangan:

"Entry confirmation pending."

Gunakan:

"Belum ada sinyal masuk yang cukup kuat."

==================================================
WAIT OUTPUT
==================================================

WAIT harus actionable.

Jangan hanya:

🟡 WAIT

Gunakan:

🟡 WAIT

"Belum perlu membeli sekarang."

Tunggu:
"harga turun mendekati Rp xxx atau breakout Rp xxx dengan volume kuat."

Dengan demikian user tahu apa yang harus dilakukan.

==================================================
AVOID OUTPUT
==================================================

AVOID harus menjelaskan alasan utama saja.

Contoh:

🔴 AVOID

"Harganya sudah naik terlalu cepat dan terlalu jauh.
Risiko membeli sekarang lebih besar daripada peluangnya."

Jangan memberikan 10 alasan sekaligus.

==================================================
BUY OUTPUT
==================================================

BUY hanya jika benar-benar ada setup.

Contoh:

🟢 BUY

"Trend sedang naik, momentum menguat, dan harga baru breakout dengan transaksi yang meningkat."

Entry:
Rp100–105

TP1:
Rp115

TP2:
Rp122

SL:
Rp96

Risk/Reward:
1 : 2.0

Risiko:
Sedang

Kesimpulan:
"Layak dibeli dengan risiko terukur."

==================================================
CONSERVATIVE MODE
==================================================

Karena EzySaham digunakan oleh investor retail konservatif:

Prioritaskan:

GOOD SETUP
daripada
HIGH MOMENTUM.

Prioritaskan:

EARLY / CONFIRMED
daripada
PARABOLIC.

Prioritaskan:

R:R
daripada
prediksi harga.

Jangan mengejar saham yang sudah naik terlalu jauh.

==================================================
VALIDATION / BACKTEST
==================================================

Sebelum implementasi final:

Test Decision Engine v3 terhadap contoh:

TRUE
POLA
ASMI
BTEK
CSMI

Expected behavior:

TRUE:
WAIT

POLA:
AVOID CHASING

ASMI:
AVOID CHASING

BTEK:
AVOID CHASING

CSMI:
AVOID CHASING

Namun jangan hardcode ticker.

Rule harus bersifat general.

Tambahkan unit test untuk:

1. Bullish healthy momentum
2. Bullish breakout
3. Bullish pullback
4. Early momentum
5. Extended momentum
6. Parabolic momentum
7. Weak volume breakout
8. Bearish trend
9. Sideways trend
10. Low liquidity
11. Poor R:R
12. Strong technical + poor fundamental
13. Strong fundamental + weak technical
14. Top gainer / FOMO case.

==================================================
HASIL YANG DIHARAPKAN
==================================================

Jangan hanya memperbaiki wording.

Refactor Decision Engine secara nyata.

Buat arsitektur:

DATA
↓
DATA QUALITY
↓
LIQUIDITY
↓
TREND
↓
MOMENTUM
↓
MOMENTUM STAGE
↓
SETUP DETECTION
↓
ENTRY QUALITY
↓
RISK
↓
R:R
↓
HORIZON DECISION
↓
SIMPLE USER OUTPUT

Pisahkan business logic dari presentation layer.

Pastikan engine dapat memberikan BUY jika kondisi memang memenuhi syarat.

Jangan membuat sistem yang terlalu ketat sehingga hampir semua saham menjadi WAIT/AVOID.

Target akhir:

Dari 100 saham:
- mayoritas boleh WAIT/NO TRADE
- sebagian kecil AVOID
- beberapa saham menjadi BUY CANDIDATE
- hanya setup terbaik yang menjadi BUY.

PRINSIP TERAKHIR:

EzySaham bukan bertugas menemukan saham yang paling banyak naik.

EzySaham bertugas menemukan:

"SAHAM YANG MEMILIKI PELUANG MENARIK DENGAN RISIKO YANG MASIH TERKENDALI."

Dan output kepada user harus bisa dipahami orang awam dalam waktu sekitar 10 detik.

---
Saya juga menyarankan satu perubahan UX besar

Di halaman saham, jangan tampilkan output seperti laporan panjang yang Anda kirim tadi sebagai tampilan utama.

Buat 3 level informasi:

Level 1 — 10 detik

🟢 BUY
Trend naik + momentum menguat.
Entry Rp100–105
TP Rp115 / Rp122
SL Rp96
Risiko: Sedang

Level 2 — "Kenapa?"

Trend sedang naik. Harga baru breakout dan transaksi meningkat. Risiko masih terukur dengan potensi 2× risiko.

Level 3 — "Detail Analisis"

Baru tampilkan EMA, RSI, RVOL, VWAP, fundamental, broker flow, scoring, dan seluruh reasoning engine.

Dengan pendekatan ini, AI boleh rumit di belakang, tetapi EzySaham terasa sederhana di depan. Itu menurut saya jauh lebih cocok untuk target pengguna retail.