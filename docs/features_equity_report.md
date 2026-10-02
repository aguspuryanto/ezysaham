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

Untuk **SNLK**, justru contoh ini menunjukkan kenapa **Conservative Entry Score** yang kita buat diperlukan.

## 🔍 Evaluasi SNLK

Saya pisahkan antara **"sahamnya bagus/bullish"** dan **"harga sekarang layak dibeli"**.

| Faktor                    | Data SNLK | Penilaian |
| ------------------------- | --------: | --------- |
| Trend                     |   Uptrend | 🟢        |
| RSI                       |      64,7 | 🟢        |
| MACD                      |   Bullish | 🟢        |
| Support                   |       226 | 🟢        |
| Resistance                |       256 | 🟡        |
| Fundamental AI            |    40/100 | 🔴        |
| PBV                       |     0,70x | 🟢        |
| Sentimen                  | Tidak ada | 🟡        |
| Technical Score           |    84/100 | 🟢        |
| TP1                       |       256 | 🟡        |
| TP2                       |       262 | 🟢        |
| R:R berdasarkan entry 248 |     buruk | 🔴        |

### 🚨 Masalah utamanya sama seperti ULTJ

Entry zone:

> **226–248**

tetapi TP hanya:

> **256–262**

sementara SL:

> **224**

Artinya kualitas entry berubah drastis tergantung harga beli.

---

# 🧮 Hitung pada beberapa harga entry

### Entry Rp248

TP1:

```text
Risk   = 248 - 224 = 24
Reward = 256 - 248 = 8

R:R = 0,33
```

TP2:

```text
Reward = 262 - 248 = 14

R:R = 0,58
```

❌ **Tidak boleh BUY secara konservatif.**

---

### Entry Rp240

TP1:

```text
Risk   = 240 - 224 = 16
Reward = 256 - 240 = 16

R:R = 1.00
```

TP2:

```text
R:R = 22 / 16
    = 1.38
```

❌ Masih **belum memenuhi R:R minimum 1.5**.

---

### Entry Rp235

TP1:

```text
Risk   = 235 - 224 = 11
Reward = 256 - 235 = 21

R:R = 1.91
```

TP2:

```text
R:R = 27 / 11
    = 2.45
```

🟢 **Mulai menarik.**

---

### Entry Rp230

TP1:

```text
Risk   = 230 - 224 = 6
Reward = 256 - 230 = 26

R:R = 4.33
```

TP2:

```text
R:R = 32 / 6
    = 5.33
```

🟢 **Sangat menarik secara R:R**, tetapi perlu diperhatikan apakah Rp230 benar-benar mendapatkan support/konfirmasi reversal.

---

# 🎯 Jadi saya akan mengubah Entry Zone SNLK

Bukan:

> ❌ **BUY 226–248**

tetapi:

### 🟢 Conservative Entry

**Rp228–235**

dengan syarat:

```text
RSI 50–68
Harga dekat support
Volume selling mengecil
Ada bullish reversal
Support 226 bertahan
R:R >= 1.5
```

### 🟡 Aggressive Entry

**Rp236–240**

hanya jika ada konfirmasi kuat.

### 🔴 Avoid

**Rp241–248**

karena semakin dekat resistance, upside semakin kecil.

---

# 🚦 Bagaimana CES akan membaca SNLK?

Berdasarkan data yang Anda berikan, saya akan memberikan **dua output**, karena CES harus dihitung berdasarkan harga entry aktual.

### Jika Entry = Rp248

```text
SNLK

Technical       🟢
RSI             🟢
MACD            🟢
Fundamental     🔴
Resistance      🔴
R:R             🔴
Phase           🟡

Conservative Entry:
🔴 NO TRADE
```

**Alasan utama:**

> R:R TP1 hanya **0,33** dan TP2 hanya **0,58**.

---

### Jika Entry = Rp235

```text
SNLK

Technical       🟢
RSI             🟢
MACD            🟢
Support         🟢
Resistance      🟢
R:R             🟢
Fundamental     🔴
Sentiment       🟡

Conservative Entry:
🟡/🟢 BUY
```

Tergantung volume dan phase.

---

# 🔥 Ada satu perubahan penting untuk sistem EzySaham

Saya sarankan **Entry Zone jangan lagi menjadi satu angka/range statis**.

Buat sistem menghasilkan:

```text
ENTRY ZONE
     ↓
┌────────────────────────────┐
│ Conservative Entry         │
│ Rp228–235                  │
├────────────────────────────┤
│ Aggressive Entry           │
│ Rp236–240                  │
├────────────────────────────┤
│ Avoid                       │
│ Rp241–248                  │
└────────────────────────────┘
```

Kemudian hitung **CES pada setiap candidate entry price**.

Misalnya:

```text
Entry 226 → CES 91
Entry 230 → CES 89
Entry 235 → CES 82
Entry 240 → CES 68
Entry 245 → CES 51
Entry 248 → NO TRADE
```

Ini jauh lebih powerful daripada:

> `Entry Zone = 226–248`

karena **Rp226 dan Rp248 bukan trade yang sama**.

---

## ⭐ Rule yang saya rekomendasikan

Untuk EzySaham:

```text
                 R:R
                  │
         ┌────────┴────────┐
         │                 │
       <1.5               >=1.5
         │                 │
    NO TRADE           lanjut scoring
                           │
                    ┌──────┴──────┐
                    │             │
                 RSI >75       RSI <=75
                    │             │
                  WAIT       lanjut scoring
                                  │
                         ┌────────┴────────┐
                         │                 │
                     Resistance        Support
                      dekat              dekat
                         │                 │
                       WAIT              BUY
```

Dan satu prinsip yang sangat penting:

> **AI Score menentukan kualitas saham. Conservative Entry Score menentukan apakah HARGANYA layak dibeli.**

SNLK adalah contoh sempurna:

**AI Score 61 ≠ otomatis NO TRADE.**
Technical Score 84 ≠ otomatis BUY.

Yang harus ditanyakan sistem adalah:

> **"Dengan harga entry X, apakah reward yang tersedia cukup besar dibanding risiko?"**

Kalau jawabannya tidak → **NO TRADE**, walaupun teknikalnya bullish.
