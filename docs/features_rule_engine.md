Perbaiki RULE ENGINE Trading Plan EzySaham agar tidak menghasilkan setup yang kontradiktif atau INVALID.

RULE WAJIB:

1. LEVEL HIERARCHY
Support < Entry/Pullback < Breakout < TP1 < TP2 < TP3
- Resistance terdekat = Breakout Trigger
- Resistance berikutnya = TP
- Jangan gunakan TP sebagai Breakout Trigger.

2. TP VALIDATION
Untuk LONG:
- TP1 > Entry
- TP2 > TP1
- TP3 > TP2
- SL < Entry
- Jika TP2 == TP1 atau tidak ada resistance valid berikutnya → hapus TP2.
- Jangan membuat target/level secara otomatis hanya agar TP2/TP3 terisi.

3. BREAKOUT VALIDATION
- Breakout Trigger harus berasal dari resistance valid.
- Breakout Trigger < TP1.
- Jika Breakout >= TP1 → INVALID PLAN dan regenerate level.
- Setelah breakout, target pertama adalah resistance berikutnya.

4. ENTRY VALIDATION
- Entry < TP1.
- Jangan membuat TP di bawah Entry untuk posisi LONG.
- Jika Entry >= TP1 → INVALID PLAN.

5. VWAP
- Price < VWAP → jangan beri bullish confirmation.
- Price > VWAP belum otomatis BUY.
- Untuk confirmation LONG: reclaim VWAP + hold + bullish price action + volume confirmation.

6. RVOL
RVOL hanya menunjukkan aktivitas volume, BUKAN arah.
- RVOL tinggi + bullish candle/breakout → positive confirmation.
- RVOL tinggi + bearish candle/rejection → selling-pressure warning.
- Jangan menganggap RVOL tinggi = BUY.

7. MOMENTUM
Gabungkan:
Price vs VWAP + EMA structure + candle + MACD + RSI + RVOL.
Jangan menentukan bullish hanya dari satu indikator.

8. TECHNICAL BREAKOUT ≠ FUNDAMENTAL RERATING
Pisahkan:
- Technical Breakout
- Fundamental Rerating
Breakout teknikal tidak boleh otomatis dianggap fundamental rerating.

9. STATUS
Jika rule belum terpenuhi:
WAIT.
Jika plan melanggar rule:
INVALID PLAN → regenerate.
Jangan memaksakan BUY/TP/TP2/TP3.

10. FINAL QA VALIDATOR
Sebelum output:
- Entry < TP1
- TP1 < TP2 < TP3 jika level tersedia
- SL < Entry
- Breakout < TP1
- TP tidak boleh berada di bawah Entry
- Tidak ada TP duplikat
- Tidak ada breakout trigger yang sebenarnya merupakan target
- Semua level harus berasal dari data teknikal yang tersedia.

Jika data tidak cukup, tampilkan "DATA TIDAK TERSEDIA", jangan mengarang level.

Tujuan:
Output EzySaham harus konsisten, logis, tidak FOMO, dan tidak menghasilkan Trading Plan INVALID.

MASTER RULE:
"Never invent a trading level to complete the plan.
Use only validated Support, Resistance, VWAP, EMA, Price Action, and historical price data.
If a valid level does not exist, omit it."

----
PATCH RULE ENGINE EzySaham — LEVEL, ENTRY & SIGNAL CONSISTENCY

Perbaiki engine Trading Plan berdasarkan kasus CUAN dan BBRI.

1. LEVEL HIERARCHY LONG
Urutan wajib:
SUPPORT < ENTRY < BREAKOUT < CONFIRMATION < TP1 < TP2 < TP3

Namun BREAKOUT dan ENTRY tidak selalu harus berbeda.
Jika entry adalah breakout, gunakan:
ENTRY = BREAKOUT
TP1 = resistance berikutnya.

Jangan membuat level hanya untuk memenuhi format.

2. RESISTANCE MAPPING
- Resistance terdekat di atas current price = candidate breakout.
- Setelah breakout valid, resistance berikutnya = TP1.
- Resistance berikutnya setelah TP1 = TP2.
- Jangan menggunakan resistance yang sama sebagai Breakout dan TP.
- Jangan menggunakan TP sebagai breakout trigger.

3. TP VALIDATION
Untuk LONG:
SL < ENTRY < TP1 < TP2 < TP3

Jika hanya tersedia satu resistance valid:
→ tampilkan TP1 saja.
→ jangan membuat TP2 secara artificial.

Jika TP1 <= ENTRY:
→ INVALID PLAN → regenerate.

Jika TP2 <= TP1:
→ hapus TP2.

4. BREAKOUT vs CONFIRMATION
Pisahkan:
- Breakout Trigger = resistance
- Confirmation = reclaim EMA20/VWAP/structure
- TP = resistance berikutnya

Contoh:
Resistance 855
EMA20 895
Resistance berikutnya 995

Output:
Breakout >855
Confirmation >895
TP1 995

Jangan:
Breakout >895
TP1 995
jika 895 bukan resistance/breakout level.

5. ENTRY PRIORITY
Untuk SWING:
A. Pullback setup:
Entry = pullback support/EMA valid
B. Breakout setup:
Entry = breakout level atau sedikit di atas breakout
C. Confirmation:
EMA20/VWAP digunakan sebagai confirmation, bukan otomatis entry.

Jangan mencampur:
"Entry 895" tetapi "breakout 855"
tanpa menjelaskan bahwa 855 adalah trigger dan 895 adalah confirmation.

6. INTRADAY
Jika Current Price < VWAP:
→ LONG = WAIT/NO TRADE
→ jangan memberi entry long aktif.

Jika Current Price > VWAP:
→ tetap membutuhkan price action + volume confirmation.

RVOL tinggi TIDAK otomatis bullish.

7. RVOL DIRECTION
RVOL = aktivitas volume, bukan arah.

RVOL tinggi + bullish candle/breakout
→ bullish confirmation

RVOL tinggi + bearish candle/rejection
→ selling pressure

RVOL tinggi + candle netral
→ activity only

8. MOMENTUM SCORE
Gunakan kombinasi:
VWAP + EMA structure + Price Action + MACD + RSI + RVOL.

Jangan menyimpulkan bullish hanya karena:
RVOL > 1.5x.

9. TECHNICAL BREAKOUT
Technical Breakout hanya valid jika:
Close > resistance
+ RVOL threshold
+ bullish price action.

Technical Breakout ≠ Fundamental Rerating.

10. FUNDAMENTAL RERATING
Fundamental rerating hanya boleh aktif jika:
- fundamental growth tersedia dan positif,
- growth dianggap sustainable,
- valuation masih memiliki ruang,
- technical breakout/price confirmation terjadi.

Jika data fundamental growth tidak tersedia:
→ Fundamental Rerating = DATA TIDAK TERSEDIA / WAIT CONFIRMATION
→ jangan mengarang catalyst.

11. INVESTING STATUS
Bedakan:
- ACCUMULATE = valuation menarik + fundamental sehat + thesis valid
- HOLD = sudah memiliki posisi / valuation masih reasonable
- WAIT = fundamental menarik tetapi harga/timing belum ideal
- AVOID = fundamental/valuation tidak memenuhi criteria.

Jika user belum diketahui memiliki saham:
jangan gunakan HOLD sebagai rekomendasi entry baru.

12. BANK / FINANCIAL
Jangan menggunakan DER sebagai metric utama bank.

Untuk bank:
- ROE
- NIM
- NPL / asset quality
- CASA
- LDR
- CAR
- earnings growth
- PER
- PBV

Jika metric tidak tersedia:
DATA TIDAK TERSEDIA.

13. VALUATION
Jangan membuat "fair value" tunggal seolah-olah pasti.

Tampilkan:
Valuation Reference / Estimated Fair Value

Dan selalu jelaskan:
"estimasi model, bukan target harga pasti."

14. RISK GATE
LONG hanya valid jika:
SL < ENTRY < TP1

Jika:
TP <= ENTRY
SL >= ENTRY
Breakout >= TP1
TP2 <= TP1
→ STATUS = INVALID PLAN

Kemudian regenerate dari data valid.

15. NO ARTIFICIAL LEVEL
MASTER RULE:

NEVER INVENT A PRICE LEVEL.

Jika data tidak cukup:
→ DATA TIDAK TERSEDIA
atau
→ hanya tampilkan level yang valid.

Lebih baik memiliki:
Entry + TP1

daripada memaksakan:
Entry + TP1 + TP2 + TP3.

16. FINAL OUTPUT VALIDATION
Sebelum menghasilkan response, jalankan validator:

[ ] Entry valid
[ ] SL berada di sisi yang benar
[ ] TP1 > Entry
[ ] TP2 > TP1
[ ] TP3 > TP2
[ ] Breakout < TP1
[ ] Breakout bukan TP
[ ] Tidak ada TP duplicate
[ ] Tidak ada TP di bawah Entry
[ ] VWAP logic konsisten
[ ] RVOL tidak dianggap directional
[ ] Fundamental dan Technical Signal terpisah
[ ] Tidak ada level hasil tebakan

Jika salah satu gagal:
→ regenerate Trading Plan sebelum output ke user.

OUTPUT PRINCIPLE:
"VALID PLAN > COMPLETE PLAN."

Jangan memaksakan semua field terisi.

----
PATCH FINAL — EZYSAHAM TRADING PLAN RULE ENGINE V3

TUJUAN:
Trading Plan harus VALID secara matematis DAN logis.
Jangan memaksakan Entry/TP/Breakout jika data level tidak cukup.

==================================================
1. LEVEL ROLE ENGINE
==================================================

Setiap harga wajib memiliki ROLE:

SUPPORT
PULLBACK_ENTRY
VWAP
EMA_CONFIRMATION
BREAKOUT_TRIGGER
TP1
TP2
TP3
INVALIDATION

Jangan menggunakan satu harga untuk dua role berbeda kecuali secara eksplisit valid.

Contoh:
Resistance 5.500
→ BREAKOUT_TRIGGER

Resistance berikutnya tidak tersedia
→ TP1 = DATA TIDAK TERSEDIA

JANGAN:
Breakout > 5.500
Target = DATA TIDAK TERSEDIA
tetapi tetap menyebut setup sebagai valid breakout.

==================================================
2. LAST RESISTANCE RULE
==================================================

Jika harga berada dekat resistance tertinggi yang tersedia:

IF resistance_next == NONE:

    BREAKOUT_SETUP = "WAIT — NO TARGET DATA"

    Jangan membuat TP.

    Jangan menghitung R/R.

    Jangan menyatakan breakout sebagai setup executable.

    Status:
    "WAIT CONFIRMATION"

Setelah breakout terjadi:
→ tunggu pembentukan resistance baru
→ jangan mengarang target.

==================================================
3. BREAKOUT VALIDATION
==================================================

Breakout hanya EXECUTABLE jika:

BREAKOUT_TRIGGER tersedia
AND
TP1 tersedia
AND
TP1 > BREAKOUT_TRIGGER
AND
volume confirmation valid
AND
price action bullish.

Jika:

BREAKOUT_TRIGGER tersedia
BUT
TP1 tidak tersedia

maka:

Technical Breakout = "WATCH ONLY"

bukan:

Technical Breakout = "WAIT ENTRY"

==================================================
4. ENTRY VALIDATION
==================================================

LONG:

SL < ENTRY < TP1

Jika TP1 tidak tersedia:
→ Entry tidak boleh dihitung sebagai executable trade.

Jika Entry >= TP1:
→ INVALID PLAN.

Jika Entry < TP1 tetapi risk/reward < minimum:
→ WAIT / NO TRADE.

==================================================
5. RISK/REWARD
==================================================

R/R hanya dihitung jika:

ENTRY tersedia
SL tersedia
TP1 tersedia

Formula:

Risk = ENTRY - SL
Reward = TP1 - ENTRY
RR = Reward / Risk

Jika TP1 DATA TIDAK TERSEDIA:
→ R/R = DATA TIDAK TERSEDIA

Jangan menghasilkan angka R/R.

==================================================
6. MULTIPLE ENTRY SETUPS
==================================================

Pisahkan:

A. PULLBACK SETUP
B. BREAKOUT SETUP

Jangan mencampur keduanya.

Contoh BSSR:

PULLBACK:
Entry = EMA20 5.082
SL = valid structural support
TP = resistance berikutnya 5.500

BREAKOUT:
Trigger = 5.500
TP = DATA TIDAK TERSEDIA

Maka:

Pullback Setup = WAIT
Breakout Setup = WATCH ONLY

Jangan membuat satu trading plan yang mencampur:
"pullback ke 5.082 ATAU breakout 5.500"

==================================================
7. EMA = CONFIRMATION, BUKAN OTOMATIS ENTRY
==================================================

EMA20 dapat digunakan sebagai:

- trend confirmation
- reclaim confirmation
- pullback reference

Tetapi jangan otomatis:

EMA20 = Entry

kecuali harga benar-benar melakukan pullback/rejection/reclaim
di sekitar EMA20.

==================================================
8. VWAP RULE
==================================================

Intraday LONG:

Price < VWAP
→ WAIT / NO TRADE

Price > VWAP
→ belum otomatis BUY.

Valid confirmation membutuhkan:
Price > VWAP
+ hold/reclaim
+ bullish price action
+ volume/activity confirmation.

==================================================
9. RVOL RULE
==================================================

RVOL hanya mengukur AKTIVITAS.

RVOL tinggi ≠ bullish.

Gunakan:

RVOL + bullish candle + breakout
→ BUY-SIDE CONFIRMATION

RVOL + bearish candle + rejection
→ SELLING PRESSURE

RVOL rendah
→ WEAK CONFIRMATION

==================================================
10. MOMENTUM RULE
==================================================

Momentum score harus mempertimbangkan:

VWAP
EMA structure
Price Action
MACD
RSI
RVOL

Namun:

MACD negatif + RSI rendah + harga di bawah EMA
tidak boleh diberi status "Momentum Normal" hanya karena
satu indikator bullish.

Gunakan:

STRONG BULLISH
BULLISH
NEUTRAL
WEAK
BEARISH

==================================================
11. SWING STATUS
==================================================

Gunakan:

BUY / WAIT / NO TRADE

BUY hanya jika:
- executable entry tersedia
- TP1 tersedia
- SL valid
- R/R memenuhi minimum
- trend/price action memenuhi setup.

WAIT jika:
- setup mungkin valid tetapi confirmation belum terjadi.

NO TRADE jika:
- struktur berlawanan
- risk/reward buruk
- fundamental/technical risk terlalu tinggi
- tidak ada executable setup.

==================================================
12. INVESTING STATUS
==================================================

ACCUMULATE:
Fundamental sehat + valuation menarik + thesis valid.

HOLD:
Posisi sudah ada + thesis masih valid.

WAIT:
Fundamental menarik tetapi valuation/timing belum ideal.

AVOID:
Fundamental deterioration / valuation tidak menarik / value trap risk tinggi.

Jangan menggunakan HOLD jika sistem tidak mengetahui apakah user
memiliki saham.

==================================================
13. FUNDAMENTAL vs TECHNICAL
==================================================

SELALU PISAHKAN:

Fundamental Quality
Valuation
Technical Trend
Technical Momentum
Technical Breakout
Fundamental Rerating

Technical breakout ≠ fundamental rerating.

Fundamental rerating hanya:
fundamental improvement
+ sustainability
+ valuation room
+ market confirmation.

==================================================
14. BANK SPECIAL RULE
==================================================

Untuk bank/financial:

JANGAN menggunakan DER sebagai quality metric utama.

Prioritaskan:

ROE
NIM
NPL
CAR
CASA
LDR
Loan Growth
Profit Growth
PER
PBV

Jika data tidak tersedia:
DATA TIDAK TERSEDIA.

==================================================
15. FINAL QA — SEMANTIC VALIDATOR
==================================================

Selain numerical QA, lakukan semantic QA:

[ ] Apakah BREAKOUT benar-benar resistance?
[ ] Apakah TP1 benar-benar resistance setelah breakout?
[ ] Apakah TP bukan resistance yang sama dengan breakout?
[ ] Apakah Entry executable?
[ ] Apakah TP1 tersedia?
[ ] Apakah SL berada di sisi yang benar?
[ ] Apakah R/R dapat dihitung?
[ ] Apakah VWAP logic konsisten?
[ ] Apakah EMA digunakan sebagai confirmation/reference?
[ ] Apakah RVOL tidak dianggap directional?
[ ] Apakah Technical Breakout dipisahkan dari Fundamental Rerating?
[ ] Apakah tidak ada level yang diarang?
[ ] Apakah status sesuai dengan kondisi setup?

==================================================
16. INVALID PLAN HANDLER
==================================================

Jika validator gagal:

JANGAN hanya menulis:

"INVALID PLAN"

Tetapi:

1. Identifikasi error
2. Hapus level invalid
3. Regenerate dari data valid
4. Jika tidak bisa → tampilkan DATA TIDAK TERSEDIA
5. Ubah status menjadi WAIT / NO TRADE.

==================================================
17. NO ARTIFICIAL TARGET
==================================================

MASTER RULE:

"VALID PLAN > COMPLETE PLAN"

Lebih baik:

TP1 = DATA TIDAK TERSEDIA

daripada:

TP1 = angka hasil tebakan.

Lebih baik:

BREAKOUT = WATCH ONLY

daripada:

BREAKOUT = WAIT dengan R/R palsu.

==================================================
18. FINAL OUTPUT RULE
==================================================

Jika tidak ada executable setup:

Jangan menulis:

"entry hanya valid jika..."

Gunakan:

"Belum ada executable setup.
Tunggu kondisi berikut: ..."

Jika ada executable setup:

Tampilkan:

ENTRY
SL
TP1
R/R
TRIGGER
INVALIDATION

==================================================
19. KESIMPULAN
==================================================

Kesimpulan harus mengikuti STATUS aktual.

Jika:
Fundamental bagus
Technical bullish
tetapi breakout belum valid

→ "Fundamental sehat, tetapi technical entry belum terkonfirmasi."

Jika:
Fundamental buruk
Technical bearish

→ "Fundamental dan technical sama-sama lemah; tidak ada setup."

JANGAN membuat kesimpulan seperti:

"menarik ... tetapi entry hanya valid jika Tidak ada entry"

Ini adalah OUTPUT BUG dan wajib diperbaiki.

==================================================
MASTER PRINCIPLE
==================================================

JANGAN MEMAKSA SAHAM MEMILIKI TRADING PLAN.

Sistem harus mampu mengatakan:

"NO EXECUTABLE SETUP"

jika data memang belum memberikan edge.