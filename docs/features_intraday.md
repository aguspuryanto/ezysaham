Buat EzySaham Trading Pattern Engine v1 — INTRADAY.

TUJUAN:
Mencari saham Indonesia dengan setup intraday yang memiliki momentum nyata, bukan sekadar banyak indikator bullish. Target trading default: modal Rp1.000.000, target profit Rp100.000/trade.

CORE INDICATORS:
- VWAP
- Volume + RVOL
- EMA9
- EMA20
- RSI14
- ATR14
- Support/Resistance
- Price Action
- IHSG Market Regime

FOCUS HANYA 2 PATTERN:

1. VWAP MOMENTUM BREAKOUT
Valid jika:
- Price > VWAP
- EMA9 >= EMA20
- RVOL >= 1.5x
- Volume mendukung breakout
- Break resistance valid
- Bullish momentum candle
- Harga belum terlalu jauh dari breakout/VWAP

2. VWAP PULLBACK / RECLAIM
Valid jika:
- Sebelumnya bullish
- Price berada/berhasil kembali di atas VWAP
- Pullback dengan volume mengecil
- Bertahan di VWAP/EMA9/EMA20
- Muncul bullish reversal
- Volume kembali meningkat

PRICE ACTION:
Deteksi:
Higher High, Higher Low, Lower High, Lower Low,
Breakout, Breakdown, Compression, Expansion,
Momentum Candle, Rejection.

SCORING 0–100:
- VWAP           20
- Volume/RVOL    20
- Structure      20
- Pattern        15
- EMA             10
- Momentum Candle 10
- RSI              5

CLASSIFICATION:
90–100 = A+
80–89  = A
70–79  = B
60–69  = WATCH
<60    = NO TRADE

RISK GATE:
Reject signal jika:
- Price jauh di bawah VWAP
- RVOL rendah
- Breakout tanpa volume
- Likuiditas tidak memadai
- Harga terlalu extended
- Stop loss tidak logis
- Risk/Reward < 1:2
- Market sangat lemah

FOMO FILTER:
Hitung jarak harga terhadap VWAP, breakout level, dan ATR.
Jika terlalu extended → OVEREXTENDED / WAIT_PULLBACK.
Jangan mengejar saham yang sudah naik terlalu jauh.

ENTRY:
Tentukan:
- ENTRY_BREAKOUT
- ENTRY_PULLBACK
- ENTRY_RECLAIM
- WAIT_PULLBACK
- NO_ENTRY

RISK MANAGEMENT:
Hitung:
- Entry
- Stop Loss berbasis support/swing low/VWAP/ATR
- Target 1
- Target 2
- Risk %
- Reward %
- Risk/Reward

TARGET Rp100K:
Input:
trading_capital = Rp1.000.000
target_profit = Rp100.000

Hitung:
required_return %
potential_profit %
potential_profit_amount
target_feasibility =
FEASIBLE / MARGINAL / NOT_FEASIBLE

FINAL OUTPUT:
TRADE / WATCH / NO_TRADE

Setiap signal wajib menjelaskan alasan keputusan.

Contoh:

Ticker: XXXX
Pattern: VWAP_MOMENTUM_BREAKOUT
Score: 84/100
RVOL: 2.15x
RSI: 63
Market: BULLISH
Entry: 1.000–1.010
SL: 950
TP1: 1.050
TP2: 1.100
R:R: 1:2
Target Rp100K: FEASIBLE
FOMO Risk: LOW
Decision: TRADE

PENTING:
- Jangan menggunakan RSI/MACD sebagai trigger utama.
- Jangan membuat BUY hanya karena banyak indikator bullish.
- Jangan menambahkan pattern lain pada v1.
- Semua threshold harus configurable.
- Pisahkan DATA → PATTERN → SCORE → RISK GATE → ENTRY/SL/TP → DECISION.
- Simpan setiap signal agar dapat digunakan untuk backtest.
- Prioritaskan kualitas setup daripada jumlah signal.
- Engine harus dirancang agar nantinya dapat dibandingkan Win Rate, Average Win, Average Loss, Profit Factor, Expectancy, MFE dan MAE.