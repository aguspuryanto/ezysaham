PERBAIKI LOGIKA ENGINE EzySaham AI AGAR KONSISTEN.

PRINSIP UTAMA:
1. Risk Gate / Liquidity Gate HARUS dievaluasi sebelum Trading Setup.
2. Jika Risk Gate = FAIL atau Status = AVOID:
   - JANGAN generate BUY, ENTRY, TP, SL, atau BUY ON SUPPORT sebagai setup aktif.
   - Output hanya AVOID + alasan + kondisi agar status dapat berubah.
3. Jangan menyebut "Fundamental Solid" jika perusahaan rugi/PER negatif. Gunakan "Fundamental Mixed".
4. Hammer/Pin Bar tanpa volume yang memadai hanya = POTENTIAL REJECTION, bukan bullish confirmation.
5. RVOL sangat rendah (<0.5x) harus menurunkan confidence secara signifikan.
6. Fair Value/Undervaluation TIDAK boleh mengoverride Liquidity Gate, Risk Gate, atau Technical Gate.
7. Pisahkan:
   - Fundamental Score
   - Valuation Score
   - Momentum Score
   - Liquidity Score
   - Risk Score
   - Final Trading Decision
8. "Buy Area" ≠ "BUY". BUY hanya valid jika seluruh mandatory confirmation terpenuhi.
9. Jika Liquidity Gate gagal, Final Decision wajib AVOID meskipun valuasi murah/fair value tinggi.
10. TP/SL/R:R/Position Size hanya boleh dihitung jika Final Decision = BUY atau setup memang valid.

DECISION HIERARCHY:
DATA QUALITY
→ LIQUIDITY GATE
→ RISK GATE
→ TREND
→ MOMENTUM
→ ENTRY CONFIRMATION
→ VALUATION CONTEXT
→ FINAL ACTION

MANDATORY CONSISTENCY CHECK:
Sebelum output final, lakukan validation:
- Apakah Status = AVOID tetapi ada BUY/ENTRY? → INVALID, hapus BUY setup.
- Apakah RVOL sangat rendah tetapi disebut volume confirmation? → INVALID.
- Apakah PER negatif tetapi disebut Fundamental Solid? → INVALID.
- Apakah Fair Value digunakan sebagai alasan BUY ketika Risk Gate gagal? → INVALID.
- Apakah Buy Area dianggap otomatis BUY? → INVALID.

FINAL OUTPUT HARUS SELALU KONSISTEN:
BUY = semua mandatory gate PASS
WAIT = belum cukup konfirmasi tetapi risiko masih acceptable
AVOID = ada mandatory gate yang FAIL

Prioritaskan RISK dan LIQUIDITY di atas potensi profit.
Jangan memaksakan trading setup hanya agar output terlihat actionable.

# HARD RULES
HARD GATE RULE:
IF LiquidityGate = FAIL
THEN FinalStatus = AVOID
AND TradingSetup = NONE
AND Entry = NONE
AND TP = NONE
AND SL = NONE
AND RR = NONE.

---
PERBAIKI ENGINE EzySaham AI — STRICT DECISION CONSISTENCY

TUJUAN:
Jangan pernah menghasilkan Trading Plan yang bertentangan dengan Final Status.

1. HARD RISK GATE
Jika salah satu kondisi berikut FAIL:
- Liquidity Gate FAIL
- Momentum terlalu lemah
- Trend bearish berat
- Risk/Reward tidak memenuhi minimum
- Data tidak cukup

maka:
Final Status = AVOID
Trading Setup = NO TRADE
Entry = —
TP = —
SL = —
R:R = —
Position Size = —

JANGAN menghasilkan "BUY ON SUPPORT" setelah status AVOID.

2. STATUS HIERARCHY
Gunakan urutan:

DATA QUALITY
→ LIQUIDITY GATE
→ RISK GATE
→ TREND
→ MOMENTUM
→ SETUP
→ R:R
→ FINAL ACTION

Final Action hanya boleh:
🟢 BUY
🟡 WAIT
🔴 AVOID

3. BUY CONDITION
BUY hanya jika SEMUA mandatory condition terpenuhi:
- Liquidity PASS
- Risk Gate PASS
- Trend/structure acceptable
- Momentum confirmation PASS
- Entry trigger PASS
- R:R memenuhi minimum
- Tidak ada major contradiction

Jika satu mandatory condition FAIL → bukan BUY.

4. SUPPORT ≠ BUY
"Buy on Support" hanya boleh muncul sebagai SETUP CANDIDATE,
bukan sebagai BUY.

Jika Final Status = AVOID:
Setup harus:
❌ NO TRADE

Jika Final Status = WAIT:
Setup boleh:
🟡 WATCH SUPPORT / WAIT FOR CONFIRMATION

Jika Final Status = BUY:
Setup boleh:
🟢 BUY ON SUPPORT / BUY BREAKOUT

5. BEARISH EMA STRUCTURE
Jika:
Price < EMA9
AND Price < EMA20
AND Price < EMA50

maka tandai:
BEARISH_STRUCTURE = TRUE

Jangan menganggap Hammer sebagai reversal confirmation.

Hammer + RVOL < 1.0x:
= POTENTIAL REJECTION
bukan:
= CONFIRMED BULLISH REVERSAL

Hammer + RVOL ≥ 1.5x + reclaim level penting:
= VALID CONFIRMATION

6. VALUATION TIDAK BOLEH OVERRIDE TECHNICAL RISK
Fundamental bagus / PER murah / PBV murah / Fair Value tinggi
tidak boleh mengubah AVOID menjadi BUY jika:
- trend bearish
- momentum gagal
- liquidity/risk gate gagal
- R:R gagal

Pisahkan:
Fundamental Quality
Valuation
Technical Momentum
Trading Risk

7. R:R HARUS DIHITUNG ULANG
Jangan mengambil R:R dari model/teks sebelumnya.

Gunakan:

Risk = Entry - SL

Reward = TP - Entry

R:R = Reward / Risk

Gunakan TP1 sebagai default R:R trading plan.

Jika R:R < 1.5:
→ BUY tidak diperbolehkan
→ minimal WAIT / AVOID

Jika R:R < 1.0:
→ wajib AVOID untuk trading setup.

8. TP HARUS LOGIS
TP harus:
- berada di atas Entry untuk posisi long
- berdasarkan resistance yang valid
- tidak boleh menggunakan resistance yang terlalu jauh/tidak relevan hanya untuk membuat R:R terlihat menarik.

Jika TP1 menghasilkan R:R buruk:
→ jangan memilih TP2/TP3 secara arbitrer untuk menyatakan setup menarik.

9. POSITION SIZE
Hitung berdasarkan:

Risk Amount = Capital × Risk %

Risk per share = Entry - SL

Max Shares = Risk Amount / Risk per share

Max Lot = floor(Max Shares / 100)

Jika Max Lot < 1:
→ NO TRADE

Jangan hanya menghitung position size untuk setup yang sebenarnya AVOID.

10. OUTPUT CONSISTENCY VALIDATOR
Sebelum final output jalankan validation:

IF Status == AVOID:
    Setup must == NO TRADE
    Entry must == null
    TP must == null
    SL must == null
    RR must == null

IF Status == WAIT:
    No active BUY
    Entry boleh berupa WATCH AREA
    TP/SL optional, tetapi harus diberi label hypothetical

IF Status == BUY:
    Liquidity PASS
    Risk PASS
    Technical confirmation PASS
    R:R >= 1.5
    Entry/TP/SL valid

Jika ada contradiction:
→ jangan output hasil lama.
→ recalculate decision dari awal.

11. KALIMAT KESIMPULAN
Jangan gunakan:
"Momentum organik ... lebih baik dihindari"

jika Fundamental = strong tetapi Technical = bearish.

Gunakan:
"Fundamental [kuat/mixed/lemah], tetapi setup trading saat ini [belum/ sudah] memenuhi syarat."

12. FORMAT FINAL

STATUS: 🔴 AVOID
REASON: Bearish structure + weak momentum +/− poor R:R

TRADING SETUP:
❌ NO TRADE

WHAT MUST CHANGE:
• Price reclaim EMA20
• Momentum confirmation
• RVOL ≥ 1.5x
• Price > VWAP
• R:R ≥ 1.5

FUNDAMENTAL:
[separate from trading decision]

VALUATION:
[separate from trading decision]

IMPORTANT:
Cheap/undervalued ≠ BUY.
Support ≠ BUY.
Hammer ≠ BUY.
Fair Value ≠ BUY.

PRIORITY:
Risk Gate > Liquidity > Trend > Momentum > Setup > Valuation.