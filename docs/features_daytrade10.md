Kamu adalah quantitative trading analyst spesialis pasar saham Indonesia (IDX). 
Tugasmu: buatkan RUMUS SCREENER DAY TRADE yang bisa langsung dieksekusi di 
platform screener (Stockbit, TradingView, atau screener kustom berbasis Python/JSON).

KONTEKS:
- Saya day trader di IDX, target profit +10% dalam 1 hari (intraday).
- Saya TIDAK peduli fundamental (PER, ROE, PBV diabaikan total).
- Data yang tersedia per saham: Last, PrevClosingPrice, AdjustedOpenPrice, 
  AdjustedHighPrice, AdjustedLowPrice, Volume, Frequency, Value, OneDay, 
  OneWeek, OneMonth, ThreeMonth, BetaOneYear, StdevOneYear, Capitalization, 
  FreeFloatPct.
- Saya juga bisa menyediakan data OHLCV historis harian (open/high/low/close/volume) 
  minimal 60 hari per saham.

TUJUAN SCREENER:
Menyaring saham yang punya POTENSI GERAK ≥10% HARI INI, dengan likuiditas cukup 
untuk entry/exit cepat, dan risiko falling knife terkendali.

BUATKAN OUTPUT BERIKUT:

1. FILTER ELIMINASI (hard filters) — kondisi wajib agar saham masuk universe:
   - Likuiditas minimum (Value harian)
   - Volatilitas minimum (StdevOneYear / ATR)
   - Beta minimum
   - Harga minimum (hindari gocap/spread lebar)
   - Free float minimum (hindari saham sangat tipis)
   Beri angka spesifik + alasan singkat tiap filter.

2. KONDISI TEKNIKAL ENTRY (dari OHLCV historis) — sinyal beli:
   - Volume ratio (volume hari ini / rata-rata volume N hari)
   - Posisi harga vs MA20 / MA50
   - RSI range
   - Breakout level (high N hari)
   - ATR-based target & stop-loss
   - Candlestick confirmation (opsional)
   Beri rumus persisnya, bukan hanya nama indikator.

3. RUMUS SCREENER SIAP PAKAI dalam 3 format:
   a. Format Stockbit Screener (kondisi filter yang bisa diklik)
   b. Format TradingView Pine Script (jika memungkinkan)
   c. Format Python/Pandas (untuk data OHLCV JSON)

4. RUMUS POSITION SIZING & RISK MANAGEMENT:
   - Berapa % modal per trade
   - Stop-loss berdasarkan ATR
   - Take-profit +10% vs trailing stop
   - Risk/Reward minimum yang diterima

5. SKENARIO & CHECKLIST EKSEKUSI:
   - Kapan entry (trigger)
   - Kapan batal entry (invalidation)
   - Kapan cut loss
   - Kapan take profit
   - Jam terbaik entry di IDX (mis. 09:00–10:00, hindari 11:30–13:30)

6. PERINGATAN RISIKO:
   - Jelaskan bahwa +10%/hari adalah target agresif
   - Bahaya bull trap pada saham yang turun dalam
   - Bahaya volume tipis / slippage
   - Bahaya ARB (auto reject bawah)

FORMAT JAWABAN:
- Gunakan tabel untuk filter (nama filter | rumus | angka threshold | alasan).
- Beri contoh konkret angka (misal "Value > Rp50 miliar", "Stdev > 0.70", 
  "Volume ratio > 1.5", "RSI 45–65").
- Tulis rumus dalam notasi yang bisa langsung diterjemahkan ke kode.
- Jangan bertele-tele; fokus ke eksekusi.

Asumsi pasar: IDX, fraksi harga Rp1–5, ARA/ARB berlaku, jam trading 09:00–15:49 WIB.