Untuk **ULTJ**, saya justru akan **mengoreksi signal AI tersebut sebelum entry**. Ada beberapa red flag penting.

### 🔎 Bedah Signal ULTJ

| Faktor            | Penilaian       | Catatan                                  |
| ----------------- | --------------- | ---------------------------------------- |
| Trend             | 🟢 Bullish      | MACD GC + harga di atas support          |
| RSI 78,8          | 🔴 Overbought   | **Jangan mengejar harga**                |
| Fundamental       | 🟢 Sangat baik  | PER 8,7x, PBV 1,96x                      |
| DER 0,5%          | 🟢 Sangat sehat | Neraca kuat                              |
| Support           | 🟢 Rp1.528      | Level penting                            |
| Resistance        | 🟡 Rp1.725      | Target relatif dekat                     |
| R:R               | 🔴 Buruk        | **1:0,11**                               |
| Breakout Score 57 | 🟡 Lemah        | Belum cukup meyakinkan                   |
| Composite 75      | 🟢 Cukup baik   | Tetapi bukan alasan untuk entry langsung |

### 🚨 Masalah terbesar: Risk/Reward

Signal memberikan:

**Entry Rp1.530–1.705**
**TP Rp1.725**
**SL Rp1.520**

Kalau entry Rp1.700:

* Risk = Rp180 / saham
* Reward = Rp25 / saham
* R:R ≈ **1 : 0,14**

Ini **tidak menarik untuk swing trading**.

Bahkan kalau entry Rp1.530:

* Risk = Rp10
* Reward = Rp195
* R:R ≈ **1 : 19,5**

Jadi entry zone **Rp1.530–1.705 terlalu lebar** dan menghasilkan profil risiko yang sangat berbeda.

---

## 🎯 Strategi yang lebih konservatif

Saya tidak akan menggunakan:

> **"Accumulate Rp1.530–1.705"**

Saya akan membaginya menjadi 3 skenario:

### 🟢 Skenario A — Buy on Pullback

**Preferred**

> Entry: **Rp1.530–1.570**

Konfirmasi:

* harga bertahan di sekitar Rp1.528
* volume selling mengecil
* RSI turun dari 78 → sekitar 60–70
* candle reversal
* MACD tetap bullish

Kemudian:

**TP1:** Rp1.650
**TP2:** Rp1.725
**SL:** Close < Rp1.520

Ini jauh lebih masuk akal untuk strategi mean reversion.

---

### 🟢 Skenario B — Breakout

Jangan membeli hanya karena harga mendekati Rp1.725.

Tunggu:

**Close > Rp1.725 + volume ≥ 1,5× rata-rata 20 hari**

Kemudian:

> Buy breakout / buy retest Rp1.700–1.725

Target berikutnya harus dihitung dari resistance berikutnya, bukan tetap Rp1.725.

---

### 🔴 Skenario C — Jangan Entry

Jika:

> RSI >75
> harga mendekati resistance Rp1.725
> volume breakout tidak kuat

**WAIT.**

Ini penting karena saham yang fundamentalnya bagus sekalipun **bisa mengalami pullback setelah overbought**.

---

# ⭐ Verdict saya

**ULTJ = BULLISH, tetapi bukan BUY di sembarang harga.**

Saya akan memberikan:

**Fundamental:** 9/10 🟢
**Trend:** 8/10 🟢
**Momentum:** 7/10 🟢
**Entry quality saat ini:** 4/10 🔴
**Risk/Reward signal:** 2/10 🔴
**Overall:** **WAIT / BUY ON PULLBACK**

### Entry yang saya sukai

> 🟢 **Rp1.530–1.570**

### Entry agresif

> 🟡 Rp1.600–1.650 dengan konfirmasi price action

### Hindari mengejar

> 🔴 **>Rp1.680 sebelum breakout**

### Breakout

> 🟢 **Close > Rp1.725 + volume ≥1,5× Avg20**

---

**Yang paling penting:** menurut saya algoritma EzySaham Anda perlu diperbaiki pada bagian **Entry Zone + TP + RRR**. Signal bisa mengatakan **BULLISH 75/100**, tetapi kalau TP hanya 1,2% sementara risiko bisa 10%+, maka sistem seharusnya **menolak signal tersebut sebagai entry konservatif**.

Kalau Anda mau, saya bisa buatkan **rumus SQL/PostgreSQL “Conservative Entry Score”** yang otomatis mengubah signal seperti ULTJ menjadi **BUY / WAIT / NO TRADE**, berdasarkan **RSI + support + resistance + ATR + volume + R:R + breakout + fase bullish/breakout/extended/distribution/pullback/bearish**.
