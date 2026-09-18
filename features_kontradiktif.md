Kalau tiga laporan **UDNG, AYLS, dan MMLP** dibandingkan sebagai **test case EzySaham**, masalah utamanya bukan lagi sekadar indikator saham, tetapi **logika pengambilan keputusan dari indikator → setup → action**.

Saya melihat ada **7 area utama yang perlu diperbaiki**.

### 1. Komparasi tiga saham

| Komponen         | UDNG                                | AYLS            | MMLP              | Yang perlu diperbaiki                           |
| ---------------- | ----------------------------------- | --------------- | ----------------- | ----------------------------------------------- |
| Market           | 🔴 Bearish                          | 🟢 Bullish      | 🟢 Bullish        | Sudah oke                                       |
| Setup            | Short on Rejection                  | Buy on Pullback | Buy on Support    | Harus dipisahkan dari Action                    |
| Buy Allowed      | ❌ Seharusnya FALSE                  | ✅ TRUE          | ✅ TRUE            | Jangan otomatis menjadi BUY                     |
| RSI              | 21.7 Oversold                       | 60.9            | 76.6 Overbought   | Klasifikasi RSI perlu konsisten                 |
| Fundamental      | Sangat lemah                        | Lemah           | Lebih baik        | Fundamental jangan otomatis menentukan BUY/SELL |
| Bandar           | Distribution                        | Neutral         | Neutral           | Jangan campur dengan market cycle               |
| VWAP             | Mendukung bearish                   | Price < VWAP    | Price < VWAP      | Bagus sebagai confirmation                      |
| EMA9/21          | Bullish intraday tetapi HTF bearish | 181 < 182       | 333 < 334         | Jangan biarkan intraday override HTF            |
| RVOL             | 0x                                  | 8.14x           | 3.55x             | Volume tinggi ≠ bullish                         |
| Current Action   | ❌ Seharusnya NO TRADE               | ⏳ WAIT          | ⏳ WAIT            | Ini bagian paling penting                       |
| Problem terbesar | Risk Gate salah                     | BUY vs WAIT     | Zone status salah | Perlu state machine                             |

Secara fundamental, data publik 2Q26 juga mendukung perlunya kehati-hatian pada ketiga model tersebut: UDNG dan AYLS masih mencatat rugi, sedangkan MMLP mencatat laba bersih 6M26 Rp76,4 miliar. ([IPOT News][1])

---

# 2. BUG TERBESAR: `BUY_ALLOWED` ≠ `BUY`

Ini menurut saya **perbaikan nomor satu**.

Saat ini EzySaham masih memiliki pola:

```text
Market = BULLISH
Buy Allowed = TRUE
        ↓
Trade = BUY
```

Ini salah.

Harus menjadi:

```text
Market
   ↓
Setup
   ↓
Risk Gate
   ↓
Buy Permission
   ↓
Price Location
   ↓
Entry Confirmation
   ↓
FINAL ACTION
```

Contohnya **MMLP**:

```text
Market = BULLISH
Setup = BUY_ON_SUPPORT
BuyAllowed = TRUE
CurrentPrice = 334
EntryZone = 330-334
RSI = 76.6
Price < VWAP
EMA9 < EMA21
EntryConfirmation = FALSE
```

Maka:

```text
FINAL ACTION = WAIT
```

**bukan BUY.**

---

# 3. Buat `ZONE STATUS`

Ini akan menyelesaikan masalah AYLS dan MMLP.

Tambahkan:

```text
ZoneStatus:
- ABOVE_ZONE
- IN_ZONE
- BELOW_ZONE
```

### AYLS

Harga:

```text
180
```

Entry:

```text
178–179
```

Maka:

```text
ZoneStatus = ABOVE_ZONE
```

Action:

```text
WAIT_FOR_PULLBACK
```

### MMLP

Harga:

```text
334
```

Entry:

```text
330–334
```

Maka:

```text
ZoneStatus = IN_ZONE
```

**Bukan**:

> harga sudah jauh di atas entry zone

Karena 334 masih tepat berada di batas atas entry zone.

Ini bug logika yang penting.

---

# 4. Tambahkan `ENTRY_CONFIRMATION`

Masuk zona **belum tentu BUY**.

Saya sarankan:

```text
EntryStatus:
- NOT_READY
- WATCH
- CONFIRMED
- INVALIDATED
```

Misalnya MMLP:

```text
Price = 334
Entry Zone = 330–334

RSI = 76.6        → ❌ Overbought
Price < VWAP      → ❌
EMA9 < EMA21      → ❌
Bandar = Neutral  → ⚠️
Cycle = Unclear   → ⚠️
```

Maka:

```text
ZoneStatus = IN_ZONE
EntryStatus = WATCH
FinalAction = WAIT
```

Bukan BUY.

---

# 5. Risk Gate harus menjadi VETO

Ini adalah bug paling serius di UDNG.

Saat ini:

> **BUY DIIZINKAN — Harga di bawah EMA200**

Ini secara logika tidak masuk akal apabila EMA200 digunakan sebagai filter bullish.

Jangan membuat:

```text
if price < EMA200:
    buyAllowed = true
```

melainkan tentukan dulu aturan EMA200.

Misalnya:

```text
if MarketTrend == BEARISH:
    buyAllowed = false
```

dan:

```text
if StrongDistribution:
    buyAllowed = false
```

dan:

```text
if FallingKnife:
    buyAllowed = false
```

dan:

```text
if DataInvalid:
    buyAllowed = false
```

Untuk UDNG:

```text
Market = BEARISH
RSI = 21.7
Fundamental = Weak
Bandar = Strong Distribution
Falling Knife = TRUE
```

Maka:

```text
BUY_ALLOWED = FALSE
```

dan:

```text
FINAL ACTION = NO_TRADE
```

Bukan WAIT biasa.

Ini semakin relevan karena pada September 2026 UDNG memang dilaporkan mengalami tekanan harga ekstrem dan status UMA BEI; kinerja 1H26 juga masih rugi. ([https://www.idxchannel.com/][2])

---

# 6. RSI jangan hanya `Oversold / Neutral / Overbought`

Klasifikasi sekarang masih terlalu kasar.

Saya sarankan:

```text
RSI < 30
    OVERSOLD

30–50
    WEAK

50–60
    NEUTRAL_BULLISH

60–70
    BULLISH_MOMENTUM

70–80
    OVERBOUGHT

>80
    EXTREME_OVERBOUGHT
```

Sehingga:

### UDNG

```text
RSI 21.7
→ OVERSOLD
```

Tapi **jangan diterjemahkan menjadi BUY**.

Oversold hanya berarti:

> tekanan jual sudah sangat tinggi.

Bukan:

> harga pasti segera rebound.

### AYLS

```text
RSI 60.9
→ BULLISH_MOMENTUM
```

### MMLP

```text
RSI 76.6
→ OVERBOUGHT
```

Ini harus menjadi **chasing-risk penalty**, bukan otomatis SELL.

---

# 7. RVOL perlu diperbaiki

Ini juga penting.

Jangan:

```text
RVOL tinggi → bullish
```

Karena:

```text
RVOL 8x
```

bisa berarti:

* breakout
* distribusi
* panic selling
* accumulation
* news-driven trading

Jadi RVOL hanya menjawab:

> **"Seberapa besar aktivitas volume?"**

Bukan:

> **"Arah saham ke mana?"**

Gunakan kombinasi:

```text
RVOL
+
Price Change
+
VWAP
+
EMA9/21
+
Candle Structure
```

Contoh AYLS:

```text
RVOL = 8.14x
Price < VWAP
EMA9 < EMA21
```

Maka:

```text
Volume = HIGH
Direction Confirmation = WEAK
```

Bukan:

```text
RVOL HIGH → BUY
```

---

# 8. Pisahkan `BANDAR STATUS` dan `MARKET CYCLE`

Sekarang ada output seperti:

```text
Bandar: Neutral
Cycle: Belum Jelas
```

Ini sebenarnya bagus, tetapi engine harus benar-benar memperlakukannya sebagai **dua variabel berbeda**.

Contoh:

```text
bandarStatus:
    ACCUMULATION
    NEUTRAL
    DISTRIBUTION

priceCycle:
    MARKUP
    MARKDOWN
    ACCUMULATION
    DISTRIBUTION
    BREAKOUT
    PULLBACK
    UNKNOWN
```

Jangan menghasilkan:

```text
Strong Accumulation + Phase 3 Momentum
```

hanya karena beberapa indikator bullish.

Harus ada rule yang jelas.

---

# 9. `Strategy` dan `Final Action` jangan digabung

Ini menurut saya perubahan UI yang sangat penting.

Contoh MMLP:

```text
Strategy:
BUY ON SUPPORT
```

tidak berarti:

```text
BUY NOW
```

Karena strategy menjawab:

> **Bagaimana saham ini sebaiknya ditradingkan?**

Sedangkan action menjawab:

> **Apa yang dilakukan sekarang?**

Jadi tampilkan:

```text
STRATEGY
Buy on Support

SETUP
Valid

ENTRY ZONE
330–334

ZONE STATUS
IN ZONE

ENTRY CONFIRMATION
NOT CONFIRMED

FINAL ACTION
WAIT
```

Jauh lebih jelas.

---

# 10. Formula Final Action

Saya sangat menyarankan EzySaham menggunakan deterministic rule seperti ini:

```javascript
if (riskGate === "BLOCK") {
    action = "NO_TRADE";
}

else if (setupDirection === "LONG") {

    if (zoneStatus === "ABOVE_ZONE") {
        action = "WAIT_FOR_PULLBACK";
    }

    else if (zoneStatus === "BELOW_ZONE") {
        action = "WAIT";
    }

    else if (
        zoneStatus === "IN_ZONE" &&
        entryConfirmation === "CONFIRMED"
    ) {
        action = "BUY_NOW";
    }

    else {
        action = "WAIT";
    }
}

else if (setupDirection === "SHORT") {

    if (rejectionConfirmed === true) {
        action = "SHORT";
    } else {
        action = "SHORT_SETUP_WATCH";
    }
}
```

Dengan demikian AI tidak bisa seenaknya mengubah:

```text
WAIT → BUY
```

hanya karena AI Score tinggi.

---

# 11. Hasil yang seharusnya dari 3 test case

### 🔴 UDNG

```text
Market       = BEARISH
Setup        = SHORT_ON_REJECTION
Buy Allowed  = FALSE
Risk Gate    = BLOCK
Final Action = NO_TRADE
```

AI boleh menjelaskan potensi short, tetapi **bukan BUY**.

---

### 🟡 AYLS

```text
Market       = BULLISH
Setup        = BUY_ON_PULLBACK
Buy Allowed  = TRUE

Price        = 180
Entry Zone   = 178–179
Zone Status  = ABOVE_ZONE

Final Action = WAIT
```

Alasannya:

```text
Tunggu harga masuk 178–179
+
support bertahan
+
momentum kembali menguat
```

---

### 🟡 MMLP

```text
Market       = BULLISH
Setup        = BUY_ON_SUPPORT
Buy Allowed  = TRUE

Price        = 334
Entry Zone   = 330–334
Zone Status  = IN_ZONE

RSI          = 76.6
VWAP         = 339
EMA9         < EMA21
Entry Confirm= FALSE

Final Action = WAIT
```

Jadi **MMLP bukan BUY hanya karena harga sudah masuk entry zone**.

---

# 12. Prioritas perbaikan EzySaham

Kalau saya urutkan berdasarkan dampaknya:

| Prioritas | Perbaikan                          | Dampak        |
| --------- | ---------------------------------- | ------------- |
| 🔴 P0     | Risk Gate sebagai VETO             | Sangat tinggi |
| 🔴 P0     | `BUY_ALLOWED ≠ BUY`                | Sangat tinggi |
| 🔴 P0     | Deterministic Final Action         | Sangat tinggi |
| 🔴 P0     | Zone Status                        | Sangat tinggi |
| 🔴 P0     | Entry Confirmation                 | Sangat tinggi |
| 🟠 P1     | Pisahkan Strategy vs Action        | Tinggi        |
| 🟠 P1     | Perbaiki RSI classification        | Tinggi        |
| 🟠 P1     | RVOL tidak menentukan arah         | Tinggi        |
| 🟠 P1     | Bandar vs Cycle dipisah            | Sedang        |
| 🟡 P2     | Perbaiki wording AI                | Sedang        |
| 🟡 P2     | AI Score hanya sebagai confidence  | Sedang        |
| 🟡 P2     | Valuation label berbasis benchmark | Sedang        |

## Kesimpulan

Tiga saham ini justru bagus sebagai **unit test EzySaham** karena mewakili tiga kondisi berbeda:

```text
UDNG
↓
BEARISH + RISK BLOCK
↓
NO TRADE


AYLS
↓
BULLISH + BUY PERMITTED
+ PRICE ABOVE ENTRY
↓
WAIT PULLBACK


MMLP
↓
BULLISH + BUY PERMITTED
+ PRICE IN ENTRY ZONE
+ NO CONFIRMATION
↓
WAIT
```

**Inti perbaikannya:** jangan biarkan satu indikator, AI Score, atau `Buy Allowed = TRUE` langsung menghasilkan BUY.

Model final yang saya sarankan:

```text
RAW DATA
   ↓
INDICATORS
   ↓
MARKET REGIME
   ↓
SETUP DETECTION
   ↓
RISK GATE
   ↓
BUY/SHORT PERMISSION
   ↓
ZONE STATUS
   ↓
ENTRY CONFIRMATION
   ↓
FINAL ACTION
```

Dengan arsitektur ini, kasus **UDNG, AYLS, dan MMLP** tidak lagi menghasilkan keputusan yang kontradiktif.

[1]: https://www.ipotnews.com/module/newsDetail.php?group_news=RESEARCHNEWS&halaman=1&jdl=Financial_Statements_2Q_2026_of_UDNG&news_id=493219&q=Financial+Statements&taging_subtype=COMPANYUPDATE&utm_source=chatgpt.com "Financial Statements 2Q 2026 of UDNG"
[2]: https://www.idxchannel.com/playlists/jatuh-90-persen-sejak-awal-2026-saham-udng-alami-arb-berjilid-jilid?utm_source=chatgpt.com "Jatuh 90 Persen Sejak Awal 2026, Saham UDNG Alami ARB Berjilid-jilid"

----
TRUE ini justru **test case yang sangat bagus** karena memperlihatkan masalah yang belum muncul sejelas pada MPIX/KICI: **Market = SIDEWAYS tetapi engine masih memakai logika BUY ON SUPPORT seolah-olah market bullish.**

## 🔎 Audit TRUE

| Komponen     |                        TRUE | Status                |
| ------------ | --------------------------: | --------------------- |
| Market       |                    SIDEWAYS | 🟡                    |
| Strategy     |              Buy on Support | ⚠️ Perlu syarat       |
| Price        |                          67 | —                     |
| Entry        |                       52–53 | 🔴 Above zone         |
| Zone Status  |              **ABOVE_ZONE** | ❗ Harus eksplisit     |
| RSI          |                        96.6 | 🔴 Extreme overbought |
| MACD         |                     Bullish | 🟢                    |
| VWAP         |            66, price > VWAP | 🟢                    |
| EMA9/21      |                       67/67 | ⚠️ Hampir flat        |
| RVOL         |                       0.00x | 🔴 Data/volume issue  |
| Fundamental  |                      23/100 | 🔴 Weak               |
| DER          |                        151% | 🔴 High leverage      |
| ROE          |                      -15.7% | 🔴 Negative           |
| Bandar       | Neutral / Distribution Risk | 🔴 Warning            |
| Cycle        |                Distribution | 🔴 Warning            |
| AI Score     |                          43 | 🔴 Weak/Mixed         |
| Final Action |                        WAIT | ✅                     |
| Risk Gate    |                 BUY Allowed | ⚠️ Salah/ambigu       |

---

# 1. `WAIT` sudah benar, tetapi sebenarnya TRUE lebih cocok `NO TRADE` atau minimal `WAIT HIGH RISK`

Ini perbedaan penting.

TRUE memiliki:

```text
Market = SIDEWAYS
RSI = 96.6
Fundamental = 23/100
DER = 151%
ROE = -15.7%
Cycle = DISTRIBUTION
AI Score = 43
Entry = 52–53
Price = 67
```

Ada terlalu banyak warning yang berkumpul.

Jadi saya tidak akan membiarkan:

```text
Buy Allowed = TRUE
```

tanpa label tambahan.

Lebih baik:

```text
Buy Permission = CONDITIONAL
Risk Level = HIGH
Entry Status = NOT READY
Final Action = WAIT
```

Bahkan jika sistem Anda menjadikan **distribution + fundamental lemah + sideways** sebagai hard blocker, hasilnya bisa:

```text
FINAL ACTION = NO_TRADE
```

Yang penting: **rule-nya harus eksplisit**, bukan AI yang menentukan secara bebas.

---

# 2. Market `SIDEWAYS` harus memengaruhi Strategy

Ini bug baru yang sangat penting.

Laporan:

```text
Market = SIDEWAYS
Strategy = BUY ON SUPPORT
```

Tidak selalu salah.

Tetapi harus ada konteks:

### Sideways + support kuat

```text
SIDEWAYS
+
SUPPORT CONFIRMED
+
RSI NORMAL
+
REVERSAL
```

→ Buy on Support bisa valid.

Tetapi TRUE:

```text
SIDEWAYS
+
RSI 96.6
+
DISTRIBUTION
+
FUNDAMENTAL 23
```

→ **bukan setup support yang aktif sekarang.**

Jadi:

```text
Market Regime
     ↓
Strategy Eligibility
```

harus ada.

Contoh:

```javascript id="4ljs7b"
if (marketStatus === "SIDEWAYS") {
    allowBuyOnSupport = true;
    requireStrongSupportConfirmation = true;
}
```

---

# 3. RSI 96.6 harus `EXTREME OVERBOUGHT`

Ini sudah tidak cukup hanya:

> RSI 96.6 (Overbought)

Saya akan menggunakan:

```text
RSI 96.6
↓
EXTREME OVERBOUGHT
↓
VERY HIGH CHASING RISK
```

Tetapi tetap:

```text
Extreme Overbought ≠ Automatic Sell
```

---

# 4. Harga 67 vs entry 52–53

Ini sangat jelas:

```text
67 > 53
```

maka:

```text
ZoneStatus = ABOVE_ZONE
```

Dan jaraknya:

```text
(67 - 53) / 67 = 20.9%
```

Laporan mengatakan 21.6%; angka ini perlu dicek kembali terhadap formula yang digunakan.

Jangan biarkan engine hanya menghasilkan:

> harga sudah jauh di atas entry zone.

Harus ada field:

```text
Zone Status = ABOVE_ZONE
Distance To Entry = 20.9%
```

Dengan begitu UI bisa konsisten.

---

# 5. R:R 1:16.24 harus diaudit karena Stop Loss = Rp52

Ini bahkan lebih mencolok.

Entry:

```text
52–53
```

Stop:

```text
52
```

Target 1:

```text
69
```

Jika entry = 53:

```text
Risk   = 53 - 52 = 1
Reward = 69 - 53 = 16
R:R    = 16R
```

Jadi angka 1:16 memang bisa muncul.

Tetapi:

> **R:R besar karena stop loss sangat dekat.**

Bukan otomatis karena setup sangat bagus.

Tambahkan:

```text
RR Quality
```

yang mempertimbangkan:

```text
R:R
+
SL Distance
+
ATR
+
Support Width
+
Volatility
```

---

# 6. Stop Loss `Rp52` dan trigger `Close < Rp51,74` membingungkan

Ini juga perlu diperbaiki.

Laporan:

```text
Stop Loss = 52
Cut loss jika Close < 51.74
```

Berarti sebenarnya ada dua level:

```text
Nominal SL = 52
Confirmation/trigger = 51.74
```

Jangan tampilkan seolah-olah satu angka.

Gunakan:

```text
Structural Support : 52
Hard SL             : 51.74
```

atau:

```text
SL Level            : 52
Invalidation        : Close < 51.74
```

Ini jauh lebih mudah dipahami.

---

# 7. RVOL `0.00x — Volume Meningkat` adalah BUG paling jelas

Ini harus segera diperbaiki.

```text
RVOL = 0.00x
```

tidak boleh:

> Volume Meningkat.

Harus:

```text
RVOL = 0.00x
Volume Status = NO DATA / INVALID
```

atau jika benar-benar volume aktual nol:

```text
Volume Status = ZERO VOLUME
```

Ini penting karena **0.00x bisa berarti data belum tersedia**, bukan benar-benar tidak ada transaksi.

Jadi engine sebaiknya:

```javascript id="1e5hyk"
if (rvol == null)
    volumeStatus = "NO_DATA";

else if (rvol === 0)
    volumeStatus = "INVALID_OR_ZERO";

else if (rvol < 0.5)
    volumeStatus = "VERY_LOW";

...
```

Jangan langsung:

```javascript id="6v1r0d"
rvol < 1 ? "Volume Meningkat" : ...
```

---

# 8. EMA9 = EMA21 tetapi status `EMA9 > EMA21`

Sama seperti KICI.

Tampilkan precision:

```text
EMA9  = 67.xx
EMA21 = 66.xx
```

atau:

```text
EMA9/EMA21 = 67/67
EMA Status = Bullish, spread sangat tipis
```

Jangan menghasilkan:

> 67 / 67 — EMA9 > EMA21

karena secara visual user akan menganggap data salah.

---

# 9. Fundamental TRUE harus menjadi hard warning

Ini cukup jelas:

```text
Fundamental Score = 23/100
DER = 151%
ROE = -15.7%
```

Saya akan klasifikasikan:

```text
Fundamental Quality = WEAK
Leverage Risk        = HIGH
Profitability        = NEGATIVE
```

Bukan hanya:

> Berisiko (Risky)

Kemudian berikan penalty terhadap:

```text
Confidence
Position Size
Entry Permission
```

Contoh:

```text
Fundamental Score < 30
→ Confidence Penalty
```

Apabila Anda ingin fundamental sebagai hard blocker:

```text
Fundamental Score < 25
→ BUY BLOCK
```

TRUE dengan 23/100 akan terkena blocker tersebut.

---

# 10. Distribution + Sideways + RSI 96.6 = chasing/distribution setup

Ini kombinasi yang harus dikenali engine.

TRUE:

```text
SIDEWAYS
+
EXTREME OVERBOUGHT
+
DISTRIBUTION RISK
+
PRICE FAR ABOVE SUPPORT
```

Ini berbeda dengan MPIX:

```text
BULLISH
+
EXTREME OVERBOUGHT
+
DISTRIBUTION
```

MPIX masih punya trend bullish yang kuat.

TRUE:

```text
SIDEWAYS
```

sehingga conviction seharusnya lebih rendah.

Saya akan membuat:

```text
Trend Strength = WEAK/MIXED
Momentum       = EXTREME
Cycle Risk     = HIGH
Entry Risk     = VERY HIGH
```

---

# 11. Sentiment juga harus diperbaiki

Ada:

> Belum ada sentimen positif signifikan

dan:

> Negatif — Aksi Korporasi...

Ini agak membingungkan.

Lebih baik:

```text
Sentiment
NEGATIVE

Catalyst
Corporate Action Uncertainty
```

Jangan:

```text
Positive Sentiment = None
Negative Sentiment = ...
```

Karena UI menjadi redundan.

---

# 12. AI Score 43 konsisten dengan WAIT

Bagian ini justru sudah cukup baik.

```text
AI Score = 43/100
```

dan AI menyimpulkan:

> risiko teknikal/fundamental perlu diwaspadai.

Ini cocok.

Tetapi saya akan mengubah:

> Disarankan menunda keputusan entry hingga terbentuk pola pembalikan arah yang valid.

menjadi rule yang lebih konkret:

```text
Wait for:
1. Pullback ke support 52–53
2. Support bertahan
3. RSI keluar dari extreme overbought
4. Reversal candle
5. Volume confirmation
6. Tidak close di bawah invalidation
```

---

# 13. Risk Gate TRUE masih salah

Ini:

> **BUY DIIZINKAN — Harga di bawah EMA200**

tetap problem yang sama.

Lebih parah karena TRUE memiliki fundamental 23 dan market sideways.

Saya sarankan:

```text
Risk Gate
⚠️ CONDITIONAL / HIGH RISK

Reason:
- Market sideways
- Fundamental weak
- Distribution risk
- Extreme overbought
- Price far above entry
```

Jika rule Anda menetapkan fundamental <25 sebagai hard blocker:

```text
Risk Gate
🔴 BLOCKED

Reason:
Fundamental score 23/100
```

---

# 14. Output TRUE yang lebih ideal

Saya akan ubah report menjadi:

```text
🚨 $TRUE

Market Status
🟡 SIDEWAYS

Setup
BUY ON SUPPORT

Current Price
Rp67

Entry Zone
Rp52–53

Zone Status
🔴 ABOVE_ZONE

Entry Status
⛔ NOT_READY

Buy Permission
CONDITIONAL / HIGH RISK

Final Action
⏳ WAIT — JANGAN CHASING
```

### Technical

```text
Trend        : Sideways
RSI          : 96.6 — EXTREME OVERBOUGHT
MACD         : Bullish
VWAP         : 66 — Price Above VWAP
EMA9/EMA21   : 67/67 — Bullish but spread very small
RVOL         : 0.00x — INVALID/NO DATA
```

### Risk

```text
Fundamental  : WEAK
Score        : 23/100
DER          : 151% — HIGH
ROE          : -15.7% — NEGATIVE

Bandar       : Neutral
Distribution : Elevated
Cycle        : Distribution
```

### Entry

```text
WAIT FOR:

✓ Price pullback → Rp52–53
✓ Support holds
✓ RSI normalizes
✓ Reversal confirmed
✓ Volume becomes valid and supportive
✓ No close below invalidation
```

---

# 🔥 TRUE memberikan pelajaran baru untuk engine

Kalau kita gabungkan **UDNG + AYLS + MMLP + KICI + MPIX + TRUE**, sekarang pola bug EzySaham semakin jelas:

| Test case | Bug yang diuji                                       |
| --------- | ---------------------------------------------------- |
| **UDNG**  | Risk Gate / Falling Knife / Distribution             |
| **AYLS**  | Above Entry → harus WAIT                             |
| **MMLP**  | In Entry Zone ≠ otomatis BUY                         |
| **KICI**  | Extreme Overbought + RVOL salah                      |
| **MPIX**  | Bullish trend tetapi Distribution/Chasing            |
| **TRUE**  | **SIDEWAYS + Fundamental Weak + Extreme Overbought** |

Dan rule final seharusnya:

```text
                    MARKET
                       ↓
              ┌───────────────┐
              │ MARKET REGIME │
              └───────┬───────┘
                      ↓
                    SETUP
                      ↓
                 RISK GATE
                      ↓
             BUY PERMISSION
                      ↓
                ZONE STATUS
                      ↓
            ENTRY CONFIRMATION
                      ↓
               FINAL ACTION
```

Dengan rule:

```text
BUY_NOW
=
BUY_ALLOWED
AND
RISK_GATE != BLOCK
AND
ZONE_STATUS == IN_ZONE
AND
ENTRY_CONFIRMATION == CONFIRMED
```

Sedangkan TRUE:

```text
BUY_ALLOWED           = TRUE/CONDITIONAL
RISK_GATE             = WARNING/BLOCK
ZONE_STATUS           = ABOVE_ZONE
ENTRY_CONFIRMATION    = FALSE

                         ↓

FINAL ACTION = WAIT
```

**Satu perbaikan yang menurut saya wajib dilakukan sekarang di EzySaham adalah mengganti `Buy Allowed: TRUE` menjadi tiga field terpisah: `Risk Gate`, `Buy Permission`, dan `Entry Status`.** Itu akan menghilangkan sebagian besar kebingungan yang berulang di UDNG, AYLS, MMLP, KICI, MPIX, dan TRUE.

---
Ya, **versi TRUE terbaru ini jauh lebih konsisten** dibanding report sebelumnya. Bahkan bagian `FINAL DECISION — WAIT` sudah mengarah ke arsitektur yang benar. Tetapi masih ada beberapa bug penting yang perlu diperbaiki.

### Audit TRUE terbaru

| Komponen    | Kondisi           | Audit                                                  |
| ----------- | ----------------- | ------------------------------------------------------ |
| Market      | SIDEWAYS          | ✅                                                      |
| Trade       | WAIT              | ✅                                                      |
| Buy Allowed | TRUE              | ⚠️ terlalu permisif                                    |
| Setup       | Buy on Support    | ✅                                                      |
| Harga       | 67                | —                                                      |
| Entry       | 52–53             | —                                                      |
| Zone        | 67 > 53           | **ABOVE_ZONE**                                         |
| RSI         | 96.6              | **EXTREME_OVERBOUGHT**, bukan sekadar overbought       |
| MACD        | Bullish           | ✅                                                      |
| VWAP        | 66, harga 67      | Bullish intraday                                       |
| EMA9/21     | 67/67             | ⚠️ tampilan membulat, jangan klaim `>` tanpa raw value |
| RVOL        | 20×               | ⚠️ tinggi sekali, tetapi bukan otomatis bullish        |
| Fundamental | 40/100            | ⚠️ lemah                                               |
| DER         | 151%              | ⚠️ tinggi                                              |
| ROE         | -22.2%            | ⚠️ negatif                                             |
| Bandar      | Neutral           | ⚠️ perlu dipisah dari market cycle                     |
| Cycle       | Momentum / markup | ⚠️ jangan campur dua klasifikasi                       |
| Trigger     | Not Confirmed     | ✅                                                      |
| Final       | WAIT              | **✅ tepat**                                            |

## 1. `BUY ALLOWED: TRUE` masih problem

Ini bug paling penting.

Report mengatakan:

> Buy Allowed: TRUE

tetapi pada saat yang sama:

> RSI 96.6
> harga 67 vs entry 52–53
> Trigger: Not Confirmed
> Fundamental risky
> Market Sideways
> Final Decision: WAIT

Kalau `BUY_ALLOWED` maksudnya **boleh membeli sekarang**, maka ini kontradiktif.

Saya sarankan ubah definisinya:

```text
BUY_ALLOWED = permission
BUY_NOW = action
```

Jadi:

```text
Buy Permission: CONDITIONAL
Final Action: WAIT
```

atau:

```text
Buy Allowed: TRUE
Buy Now: FALSE
```

Yang lebih bersih menurut saya:

```text
Buy Permission : CONDITIONAL
Zone Status    : ABOVE_ZONE
Entry Status   : NOT_CONFIRMED
Final Action   : WAIT_FOR_PULLBACK
```

---

# 2. RSI 96.6 harus masuk EXTREME_OVERBOUGHT

Sekarang report menulis:

> RSI 96.6 (Overbought)

Secara sistem lebih baik:

```text
RSI < 30       OVERSOLD
30–50          WEAK
50–60          NEUTRAL_BULLISH
60–70          BULLISH_MOMENTUM
70–80          OVERBOUGHT
80–90          HIGH_OVERBOUGHT
>90            EXTREME_OVERBOUGHT
```

TRUE:

```text
RSI = 96.6
```

sehingga:

```text
RSI_STATUS = EXTREME_OVERBOUGHT
CHASING_RISK = VERY_HIGH
```

**Tetapi jangan otomatis menghasilkan SELL.**

Saham bisa tetap naik walaupun RSI ekstrem. Informasi yang benar adalah:

> momentum sangat kuat tetapi risiko entry baru meningkat.

---

# 3. Zone Status sekarang harus otomatis `ABOVE_ZONE`

Ini bisa dijadikan unit test sederhana:

```javascript
if (currentPrice > entryHigh) {
    zoneStatus = "ABOVE_ZONE";
}
else if (currentPrice >= entryLow && currentPrice <= entryHigh) {
    zoneStatus = "IN_ZONE";
}
else {
    zoneStatus = "BELOW_ZONE";
}
```

TRUE:

```text
Current = 67
Entry   = 52–53
```

Maka:

```text
67 > 53

ZONE_STATUS = ABOVE_ZONE
```

Jadi action:

```text
WAIT_FOR_PULLBACK
```

bukan BUY.

---

# 4. Ada masalah pada perhitungan jarak entry

Report:

> Entry berjarak 21.6% dari harga saat ini

Kalau menggunakan batas atas entry:

```text
(67 - 53) / 67 × 100
= 20.90%
```

Kalau menggunakan batas bawah:

```text
(67 - 52) / 67 × 100
= 22.39%
```

Jadi **21.6% tidak jelas berasal dari mana**.

Lebih baik jangan hanya menampilkan satu angka.

Tampilkan:

```text
Distance to Entry:
Rp53 → -20.9%
Rp52 → -22.4%
```

atau:

```text
Current Rp67
Entry Zone Rp52–53
Distance: 20.9%–22.4%
```

Ini jauh lebih transparan.

---

# 5. R:R 1:16.24 juga perlu diperbaiki

Dengan:

```text
Entry = 53
SL    = 52
TP1   = 69
```

maka:

```text
Risk   = 53 - 52 = 1
Reward = 69 - 53 = 16

R:R = 16 / 1 = 16.0
```

Bukan 16.24.

Kalau memakai harga lain/precision internal, bisa berbeda sedikit, tetapi sistem harus menggunakan **angka yang sama dengan yang ditampilkan** atau menampilkan precision yang digunakan.

Lebih penting lagi:

> R:R 1:16 bukan berarti setup sangat bagus.

Karena stop hanya Rp1 dari entry.

Tambahkan:

```text
SL Type: TIGHT_STRUCTURAL_SL
```

dan warning:

```text
⚠️ R:R tinggi terutama karena jarak SL sangat sempit.
```

---

# 6. `SL 52` dan `Close < 51.74` harus dipisahkan

Sekarang:

> Stop Loss Rp52 → Cut loss jika Close < Rp51.74

Ini mencampurkan dua konsep.

Lebih baik:

```text
Structural Support : Rp52
Hard Invalidation   : Close < Rp51.74
```

atau:

```text
Reference SL        : Rp52
Close Invalidation  : < Rp51.74
```

Karena kalau sistem mengatakan SL = 52, tetapi kemudian mengatakan cut loss hanya kalau close <51.74, user bisa bingung sebenarnya stop-nya di mana.

---

# 7. RVOL 20× adalah informasi besar, tetapi jangan diterjemahkan menjadi bullish otomatis

Sekarang:

> RVOL 20.00× (Volume Meningkat)

`20×` memang sangat tinggi.

Tetapi:

```text
RVOL = volume relatif tinggi
```

bukan:

```text
RVOL = BUY
```

Sistem harus melihat kombinasi:

```text
RVOL
+
Price Direction
+
VWAP
+
EMA
+
Candle Structure
```

Contohnya:

```text
RVOL 20x
Price > VWAP
EMA9 > EMA21
MACD Bullish
```

→ momentum bullish terkonfirmasi lebih kuat.

Tetapi:

```text
RVOL 20x
Price turun
Price < VWAP
```

bisa berarti distribusi/panic selling.

Jadi ubah label:

```text
RVOL: 20.00× — VERY HIGH
Volume Direction: UNCONFIRMED
```

Kemudian baru:

```text
Volume Confirmation: BULLISH
```

jika price/volume memang mendukung.

---

# 8. EMA9 = EMA21 tetapi status `EMA9 > EMA21`

Report:

```text
EMA9/EMA21: 67 / 67
EMA9 > EMA21
```

Ini kemungkinan besar masalah **display rounding**.

Misalnya data sebenarnya:

```text
EMA9  = 67.384
EMA21 = 67.271
```

maka memang:

```text
EMA9 > EMA21
```

tetapi setelah dibulatkan:

```text
67 / 67
```

Solusi:

```text
EMA9  = 67.38
EMA21 = 67.27
Spread = +0.11
```

atau minimal:

```text
EMA9 > EMA21 (+0.11)
```

Ini penting supaya report tidak terlihat kontradiktif.

---

# 9. Market Cycle jangan mencampur `Markup` dan `Momentum`

Sekarang:

> Bandar Neutral (Markup...)
> Fase Siklus Pasar Fase 3 — MOMENTUM

Saya sarankan struktur datanya dipisah:

```json
{
  "bandarStatus": "NEUTRAL",
  "distributionRisk": "MODERATE",
  "priceCycle": "MOMENTUM"
}
```

Jangan membuat:

```text
Bandar Neutral = Markup
Market Cycle = Momentum
```

karena **bandar status dan price cycle adalah dua dimensi berbeda**.

---

# 10. Fundamental TRUE harus memberi penalty cukup besar

Data:

```text
Fundamental Score : 40/100
DER               : 151%
ROE               : -22.2%
PBV               : 2.38x
PER               : unavailable
```

Jangan sampai sistem membaca:

```text
Technical bullish
+
RVOL 20x
+
MACD bullish
=
BUY
```

Fundamental harus menjadi risk modifier.

Misalnya:

```javascript
if (fundamentalScore < 30)
    fundamentalRisk = "HIGH";

else if (fundamentalScore < 50)
    fundamentalRisk = "MODERATE_HIGH";

else if (fundamentalScore < 70)
    fundamentalRisk = "MODERATE";

else
    fundamentalRisk = "LOW";
```

TRUE:

```text
40 → MODERATE_HIGH
```

Ditambah:

```text
DER 151%
ROE -22.2%
```

maka:

```text
Fundamental Risk = HIGH
```

Kalau Anda ingin fundamental score <25 menjadi hard blocker, itu juga bisa dibuat configurable.

---

# 11. Risk Gate masih salah

Sekarang:

> 🚦 Risk Gate: BUY DIIZINKAN — Harga di bawah EMA200.

Ini masih menjadi bug yang sama seperti report sebelumnya.

Kalimat ini tidak cukup untuk menentukan risk gate.

Kalau aturan Anda:

```text
Price < EMA200 = bearish primary trend
```

maka:

```text
Risk Gate = BLOCK
```

bukan:

```text
BUY DIIZINKAN
```

Kalau memang Anda sengaja menjadikan EMA200 hanya sebagai warning:

```text
Risk Gate = PASS_WITH_WARNING
```

maka tulis:

> EMA200 Warning — harga berada di bawah EMA200.

Jangan:

> BUY DIIZINKAN — Harga di bawah EMA200.

Karena kalimat tersebut membingungkan antara **indikator** dan **permission**.

---

# 12. Final Decision TRUE sekarang sudah bagus

Bagian ini:

> 🟡 FINAL DECISION — WAIT
> Setup Buy on Support belum aktif
> Momentum menunjukkan kondisi overbought
> Entry di area 52 belum berada pada kondisi trigger yang tervalidasi

**Ini sudah jauh lebih benar.**

Saya bahkan akan membuatnya lebih deterministic:

```text
🟡 FINAL DECISION — WAIT FOR PULLBACK

Reason:
• Current price Rp67 > Entry Zone Rp52–53
• Zone Status: ABOVE_ZONE
• RSI 96.6 = EXTREME_OVERBOUGHT
• Entry Trigger: NOT_CONFIRMED
• Market Regime: SIDEWAYS
• Fundamental Risk: HIGH

Action:
Tunggu pullback ke Rp52–53.
Jangan mengejar harga Rp67.
```

---

# Arsitektur final yang saya sarankan untuk EzySaham

Ini yang menurut saya paling penting untuk Anda implementasikan:

```text
RAW MARKET DATA
       ↓
INDICATORS
       ↓
MARKET REGIME
       ↓
SETUP DETECTION
       ↓
RISK GATE
       ↓
BUY PERMISSION
       ↓
ZONE STATUS
       ↓
ENTRY CONFIRMATION
       ↓
FINAL ACTION
```

Dengan TRUE:

```text
Market Regime
    = SIDEWAYS

Setup
    = BUY_ON_SUPPORT

Risk Gate
    = PASS_WITH_WARNING / HIGH_RISK
      atau BLOCK jika aturan fundamental Anda hard

Buy Permission
    = CONDITIONAL

Current Price
    = 67

Entry Zone
    = 52–53

Zone Status
    = ABOVE_ZONE

RSI
    = 96.6 EXTREME_OVERBOUGHT

Entry Confirmation
    = NOT_CONFIRMED

Final Action
    = WAIT_FOR_PULLBACK
```

Dan rule paling penting:

```javascript
const buyNow =
    buyPermission === "TRUE" &&
    riskGate !== "BLOCK" &&
    zoneStatus === "IN_ZONE" &&
    entryConfirmation === "CONFIRMED";
```

Kalau:

```javascript
buyNow === false
```

maka **LLM tidak boleh mengubahnya menjadi BUY**.

### Expected TRUE

```text
🟡 WAIT — WAIT FOR PULLBACK

Market       : SIDEWAYS
Setup        : BUY ON SUPPORT
Current      : Rp67
Entry        : Rp52–53
Zone         : ABOVE_ZONE
RSI          : 96.6 EXTREME_OVERBOUGHT
MACD         : BULLISH
VWAP         : BULLISH
RVOL         : 20x VERY HIGH
Fundamental  : HIGH RISK
Trigger      : NOT_CONFIRMED

Action:
WAIT — JANGAN CHASING

Next valid condition:
1. Harga pullback ke Rp52–53
2. Support bertahan
3. Tidak terjadi breakdown
4. Muncul candle reversal/rebound
5. Volume mendukung
6. Trigger entry CONFIRMED
```

**Kesimpulan audit:** untuk test case TRUE ini, `FINAL DECISION = WAIT` sudah benar. Yang masih perlu Anda benahi terutama adalah **BUY_ALLOWED/Risk Gate**, **RSI classification**, **Zone Status**, **R:R**, **RVOL**, dan **pemisahan Bandar vs Market Cycle**. Ini menunjukkan bug utama EzySaham memang berada di **decision engine**, bukan pada kemampuan report menghasilkan narasi.
