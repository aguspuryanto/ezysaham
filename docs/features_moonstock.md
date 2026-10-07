Buat 3 screener discovery baru untuk Moonstock:

1. 🌙 MOONSTOCK INTRADAY
Tujuan: menemukan saham yang sedang memiliki momentum intraday dan berpotensi ditradingkan hari yang sama.

Filter utama:
- Price Change positif / momentum meningkat
- Price > VWAP
- RVOL ≥ 1,5x
- Volume meningkat
- Momentum MODERATE/STRONG
- Breakout atau mendekati resistance
- Likuiditas memadai
- Hindari saham EXTENDED/parabolik
- Hindari chasing

Output:
Ticker | Price | Change | VWAP | RVOL | Volume | Momentum | Structure | Resistance | Setup | Trigger

Label:
🔥 BREAKOUT
⚡ MOMENTUM
👀 WATCH
🔴 AVOID CHASING

--------------------------------------------------

2. 🚀 MOONSTOCK SWING
Tujuan: menemukan saham dengan setup swing 2 hari–beberapa minggu.

Filter utama:
- Price > EMA20
- EMA20 > EMA50
- Prioritaskan EMA50 > EMA200
- Higher High + Higher Low
- RSI 50–70
- RVOL ≥ 1,2–1,5x
- Volume meningkat
- Breakout atau Pullback
- Resistance tidak terlalu jauh
- Upside potential ≥20%
- Kandidat R:R ≥1:2
- Hindari EXTENDED dan DOWNTREND

Setup:
BREAKOUT / PULLBACK / MOMENTUM DEVELOPING

Output:
Ticker | Price | Trend | Structure | RSI | RVOL | Setup | Support | Resistance | Upside | Trigger

Label:
🚀 BREAKOUT
🔄 PULLBACK
🟡 DEVELOPING
🔴 AVOID

--------------------------------------------------

3. 💰 MOONSTOCK INVESTING
Tujuan: menemukan saham fundamental berkualitas untuk investasi jangka menengah/panjang.

Filter utama:
- Revenue growth positif
- Net profit growth positif
- ROE sehat
- Cash flow operasional positif
- Debt terkendali
- Profit margin sehat/stabil
- Valuation menarik berdasarkan PER/PBV dibanding historis/sektor
- Prioritaskan earnings growth
- Hindari value trap
- Hindari fundamental deteriorating

Output:
Ticker | Price | PER | PBV | ROE | Revenue Growth | Profit Growth | Margin | Debt | Cash Flow | Valuation | Quality

Label:
💎 UNDERVALUED
🟢 QUALITY
🟡 FAIR VALUE
🔴 VALUE TRAP RISK

--------------------------------------------------

ATURAN GLOBAL MOONSTOCK:

1. Moonstock adalah DISCOVERY RADAR, bukan mesin BUY.
2. Jangan menghasilkan BUY otomatis.
3. Kandidat hanya muncul jika snapshot data yang kompatibel tersedia.
4. Jika data kosong → EMPTY.
5. Jika data stale → STALE.
6. Jangan mengarang data atau kandidat.
7. Jangan memaksakan kandidat hanya agar screener menghasilkan hasil.
8. Candidate ≠ BUY.
9. Moonstock hanya menemukan kandidat; Momentum Trade Engine melakukan validasi akhir.
10. Semua output harus deterministic: input data sama → output sama.

FLOW:

Market Universe
→ Moonstock Intraday / Swing / Investing
→ Ranking Candidate
→ Technical/Fundamental Analysis
→ Momentum Trade Engine
→ HARD RISK GATE
→ BUY / WAIT / NO TRADE


Buat 3 formulasi stock screener di Stockbit untuk Moonstock berdasarkan kategori berikut:

1. 🌙 MOONSTOCK INTRADAY
Purpose: Saham yang sedang trending hari ini dengan momentum intraday dan potensi scalping.

Ticker | Price | Change | VWAP | RVOL | Volume | Momentum | Structure | Resistance | Setup | Trigger

Kondisi Utama:

Price > VWAP
RVOL ≥ 1.5x
Volume > 100.000 lembar
Price Change > 0%
Momentum Moderate/Strong
Price mendekati Resistance atau Breakout
Ukuran Saham: L/M
Min Value: Rp 5 M

2. 🚀 MOONSTOCK SWING
Purpose: Saham untuk swing trading 2 hari – beberapa minggu dengan tren bersih.

Ticker | Price | Trend | Structure | RSI | RVOL | Setup | Support | Resistance | Upside | Trigger

Kondisi Utama:

Price > EMA20 > EMA50
Prioritas: EMA50 > EMA200 (Uptrend kuat)
RVOL ≥ 1.2x
RSI: 50–70
Higher High + Higher Low
Upside potential ≥20%
Risk/Reward ≥ 1:2
Ukuran Saham: M/L
Min Value: Rp 10 M

3. 💰 MOONSTOCK INVESTING
Purpose: Saham fundamental untuk investasi jangka panjang (position trading).

Ticker | Price | PER | PBV | ROE | Rev Growth | Profit Growth | Margin | Debt | Valuation

Kondisi Utama:

Revenue Growth > 15% YoY
Profit Growth > 15% YoY
ROE > 15%
Debt/Equity < 1.0
Net Profit Margin > 10%
Valuation reasonable (cek PBV/PER vs sektor & historis)
Ukuran Saham: M/L
Min Value: Rp 50 M

Output Final:
Untuk setiap screener tampilkan: Ticker | Kategori | Parameter1 | Parameter2 | Parameter3 | Status | Setup

Status: HOT / SOLID / GROWTH / WATCH
Setup: BREAKOUT / PULLBACK / UPTREND / VALUE / etc