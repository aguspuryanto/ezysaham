Buat halaman baru "Signal" untuk EzySaham sebagai dashboard SARA AI (Smart Algorithmic Return Analysis).

Tujuan:
Menampilkan sinyal saham harian secara sangat sederhana, actionable, dan mudah dipahami trader pemula. Fokus pada pertanyaan: "Boleh entry?"

DESIGN:
- Modern fintech dashboard
- Dark/light mode mengikuti existing EzySaham
- Responsive desktop/mobile
- Jangan mengubah design system existing
- Gunakan card, badge, progress score, dan color coding yang konsisten
- Prioritaskan readability dan 10-second decision

HEADER:
"SARA AI Signals"
"Daily algorithmic stock signals"

FILTER:
- Date
- Signal: ALL / BUY / BUY ON WEAKNESS / WAIT / HOLD / SELL / NO TRADE
- Pattern
- Score
- Search ticker

SIGNAL CARD:
Ticker + Company Name
Current Price
Signal badge: BUY / WAIT / SELL
SARA Score: 82/100
Confidence: 82%

Trade Plan:
Entry: 1,230–1,270
TP1: 1,350
TP2: 1,420
Stop Loss: 1,180
Risk/Reward: 1:2.8
Holding Period: 1–5 Days

WHY:
✓ Price > EMA200
✓ EMA8 > EMA18
✓ Momentum candle
✓ Volume 2.1x average
✓ Foreign accumulation
✓ Breakout resistance
✓ RSI 61

RISK:
⚠ Resistance 1,300
⚠ Market trend neutral

DECISION:
BUY ALLOWED: YES/NO
Trigger: "Close > 1,270 + Volume > 1.5x"

Tambahkan:
1. Top Signals hari ini
2. Signal table untuk seluruh saham
3. Score breakdown: Trend, Momentum, Volume, Smart Money, Pattern, Fundamental, Market Risk
4. Mini performance summary: Signals, Win Rate, Avg Return, Active Signals
5. Signal detail drawer/modal saat card diklik
6. "Why this signal?" explanation
7. Timestamp data / Last Updated
8. Empty state dan loading skeleton

IMPORTANT:
- Jangan hardcode data sebagai final implementation.
- Gunakan mock data sementara dengan struktur yang siap diganti API.
- Pisahkan UI components, types/interfaces, mock data, dan API service.
- Buat komponen reusable: SignalCard, ScoreBreakdown, TradePlan, SignalTable, SignalFilters.
- Jangan membuat klaim bahwa AI menjamin profit.
- Fokus pada signal generation dan decision support, bukan financial advice.

---
versi ringkas

Build a new EzySaham page: /signal.

Create a SARA AI Signal Dashboard for daily stock signals.

UI must answer "Boleh entry?" within 10 seconds.

Include:
- Top Signals
- Filters: date, BUY/BUY ON WEAKNESS/WAIT/HOLD/SELL/NO TRADE, pattern, score, ticker
- SignalCard with ticker, price, signal, SARA Score, confidence
- Entry zone, TP1, TP2, SL, R:R, holding period
- WHY: Trend, Momentum, Volume, Smart Money, Pattern, Fundamental
- Risk warnings
- BUY ALLOWED YES/NO
- Trigger condition
- Signal table
- Score breakdown
- Daily performance summary
- Signal detail drawer
- Last updated timestamp
- Loading/empty states

Example:
ABC — Rp1,250
BUY | SARA Score 82/100
Entry 1,230–1,270
TP1 1,350 | TP2 1,420
SL 1,180
R:R 1:2.8
BUY ALLOWED: YES
Trigger: Close > 1,270 + Volume > 1.5x

Use the existing EzySaham design system and stack.
Do not redesign unrelated pages.
Use mock data only as temporary API-ready data.
Create reusable components and TypeScript interfaces.
Responsive desktop/mobile.

---
struktur Signal menjadi 3 lapisan keputusan:

WHY BUY? → alasan objektif
CONFIDENCE → seberapa kuat alasannya
TRADE PLAN → Entry, TP, SL

Buat page baru EzySaham: /signal sebagai "SARA AI Signal".

Tujuan utama:
Membantu user menjawab 3 pertanyaan sebelum membeli saham:

1. KENAPA SAYA LAYAK MEMBELI?
2. SEBERAPA KUAT KONFIRMASINYA?
3. JIKA BELI, DI MANA ENTRY, TP, DAN SL?

Jangan tampilkan BUY sebagai keputusan pertama.
Tampilkan reasoning terlebih dahulu, kemudian confidence, lalu trading plan.

STRUKTUR PAGE:

1. SIGNAL HEADER
- Ticker + Company
- Harga sekarang
- Signal: BUY / WAIT / NO TRADE
- SARA Score 0–100

2. WHY BUY?
Judul:
"Kenapa saham ini layak dibeli?"

Tampilkan 3–5 alasan terkuat berdasarkan:
- Trend
- Momentum
- Volume
- Smart Money / Foreign Flow
- Breakout / Support / Pattern
- Fundamental quality

Contoh:
✓ Harga di atas EMA200 → primary trend bullish
✓ EMA8 > EMA18 → short-term momentum bullish
✓ Volume 2.1x rata-rata → breakout mendapat konfirmasi volume
✓ Foreign accumulation → ada dukungan foreign flow
✓ Breakout resistance Rp1.270 → struktur bullish terkonfirmasi

3. CONFIDENCE
Judul:
"Seberapa kuat konfirmasinya?"

Tampilkan:
- Confidence: 82%
- Strong Confirmations
- Neutral Factors
- Risk Factors

Score breakdown:
Trend 90
Momentum 85
Volume 88
Smart Money 76
Pattern 84
Fundamental 72
Market 65

4. TRADE PLAN
Judul:
"Kalau beli, bagaimana rencananya?"

Entry Zone: Rp1.230–1.270
TP1: Rp1.350
TP2: Rp1.420
Stop Loss: Rp1.180
Risk/Reward: 1:2.8
Holding Period: 1–5 hari

5. ENTRY TRIGGER
Tampilkan kondisi yang harus terpenuhi sebelum entry.

Contoh:
"BUY hanya jika harga bertahan di atas Rp1.270
dan volume ≥ 1.5x average."

6. RISK CHECK
Tampilkan alasan untuk TIDAK membeli:
- Resistance dekat
- Market bearish
- Volume belum confirmed
- Harga terlalu jauh dari EMA
- Risk/Reward tidak menarik

7. FINAL DECISION
Gunakan format:

SARA DECISION
🟢 BUY ALLOWED

Reason:
"Trend bullish + momentum kuat + volume breakout
+ smart money confirmation."

atau:

🟡 WAIT
"Setup menarik, tetapi belum memiliki volume confirmation."

atau:

🔴 NO TRADE
"Risk terlalu tinggi dibandingkan potential reward."

IMPORTANT UX:
User harus bisa memahami:
WHY → CONFIDENCE → PLAN → TRIGGER → RISK → DECISION

Jangan hanya menampilkan indikator.
Terjemahkan indikator menjadi alasan yang mudah dipahami manusia.

Jangan menjanjikan profit.
Jangan menggunakan AI generatif untuk membuat alasan yang tidak berasal dari data.
Setiap alasan harus berasal dari data/indicator yang tersedia.

Gunakan existing EzySaham design system.
Buat responsive desktop/mobile.
Gunakan reusable components:
SignalHeader
WhyBuy
ConfidenceScore
ScoreBreakdown
TradePlan
EntryTrigger
RiskCheck
FinalDecision

Gunakan mock data terlebih dahulu tetapi struktur harus API-ready.