Untuk **CAMP**, report ini sudah jauh lebih aman daripada report EzySaham versi lama, tetapi masih ada beberapa **bug alignment** yang sebaiknya diperbaiki di engine.

### Audit CAMP

| Bagian           | Kondisi          | Masalah                                                  |
| ---------------- | ---------------- | -------------------------------------------------------- |
| Market           | 🟢 BULLISH       | Konsisten                                                |
| Setup            | 🔴 BREAKOUT      | Tidak konsisten dengan “Mean Reversion / Buy on Support” |
| Current vs Entry | 🟠 ABOVE ZONE    | Logis jika harga sekitar Rp205                           |
| RSI 85           | 🟠 OVERBOUGHT    | Benar; jangan otomatis SELL                              |
| RVOL 14.34x      | 🟠 VERY_HIGH     | Label “Volume Meningkat” terlalu generik                 |
| Risk Gate        | 🟡 CONDITIONAL   | Masuk akal jika EMA200 hanya warning                     |
| Buy Permission   | 🟡 CONDITIONAL   | Konsisten dengan belum siap entry                        |
| Entry Status     | 🟡 WATCH         | Konsisten                                                |
| Final Action     | 🟡 WAIT/PULLBACK | **Seharusnya eksplisit**                                 |
| TP1 Rp202        | 🔴               | Jika current ≈205, TP1 sudah terlewati                   |
| TP2 Rp208        | 🟡               | Masih prospective                                        |
| R:R              | 🔴               | Belum ditampilkan                                        |
| Position Risk    | 🔴               | Negatif `-0.5% s.d. -1.5%`                               |
| Sentiment        | 🟡               | Perlu cek relevansi tanggal/katalis                      |
| AI Score 66      | 🟡               | Jangan dikatakan “mengarah ke BUY”                       |

## 1. Bug terbesar: TP1 sudah tercapai

Report mengatakan:

```text
Entry: 196–198
Current ≈ 205

TP1: 202
TP2: 208
```

Kalau current memang sekitar Rp205, maka:

```text
202 < 205
```

Artinya **TP1 sudah berada di belakang harga sekarang**.

Jangan menghasilkan:

```text
Target Price 1: Rp202
```

sebagai target masa depan.

Engine harus menghasilkan:

```text
TP1_STATUS = ALREADY_REACHED
```

kemudian mencari resistance berikutnya.

Misalnya jika resistance terdekat berikutnya Rp208 dan berikutnya Rp215:

```text
Entry       196–198
Current     205

TP1         208
TP2         215
```

---

# 2. Setup BREAKOUT masih salah

Ini:

> Strategi (Setup): Breakout (Gaya: Mean Reversion / Buy on Support)

secara konsep bertentangan.

Kalau entry:

```text
Support = 196
Entry = 196–198
Current = 205
```

maka strategi sebenarnya lebih cocok:

```text
BUY_ON_SUPPORT
```

atau:

```text
BUY_ON_PULLBACK
```

Bukan `BREAKOUT`.

### Rule engine

```typescript
if (
  entryZoneNearSupport &&
  currentPrice > entryHigh
) {
  setup = "BUY_ON_PULLBACK";
}
```

Sedangkan `BREAKOUT` baru:

```text
Price approaches resistance
        +
Resistance breaks
        +
Volume confirmation
        +
Breakout confirmation
```

---

# 3. RVOL 14.34 harus VERY_HIGH

Saat ini:

> RVOL 14.34× — Volume Meningkat

Saya akan ubah menjadi:

```text
RVOL = 14.34x
Classification = VERY_HIGH
```

Rule:

```text
< 0.5       VERY_LOW
0.5–0.8     LOW
0.8–1.2     NORMAL
1.2–2       ELEVATED
2–5         HIGH
>5          VERY_HIGH
```

Tetapi penting:

**RVOL 14.34 bukan otomatis bullish.**

Dia hanya mengatakan aktivitas volume sangat tinggi.

Harus dianalisis bersama:

```text
Price Direction
Close Location
Volume
Resistance
Distribution
```

---

# 4. RSI 85 sudah benar

Ini:

```text
RSI 85
Overbought
```

sudah benar.

Jangan diubah menjadi:

```text
SELL
```

Rule yang lebih baik:

```text
RSI > 80
→ EXTREME_OVERBOUGHT
→ Chasing Risk HIGH
```

Tetapi:

```text
RSI > 80 ≠ SELL
```

Dalam kasus CAMP:

```text
RSI 85
+
Current > Entry Zone
+
VWAP 205
+
Current sekitar 205
```

lebih cocok:

```text
WAIT_FOR_PULLBACK
```

daripada mengejar harga.

---

# 5. Position Risk salah format

Report:

> Position Risk: -0.5% s.d. -1.5%

Jangan gunakan angka negatif untuk risk.

Risk adalah besarnya risiko.

Seharusnya:

```text
Position Risk: 0.5%–1.5%
```

atau lebih jelas:

```text
Risk to SL: 0.5%–1.5%
```

Kalau entry 196–198 dan SL195:

```text
196 → 195
Risk = 0.51%

198 → 195
Risk = 1.52%
```

Jadi:

```text
Position Risk: 0.51%–1.52%
```

Ini jauh lebih akurat daripada `-0.5% s.d. -1.5%`.

---

# 6. R:R wajib ditambahkan

Dengan:

```text
Entry low  = 196
Entry high = 198
SL         = 195
TP1        = 202
TP2        = 208
```

gunakan entry konservatif/high:

### Berdasarkan entry Rp198

```text
Risk TP = 198 - 195
        = 3

Reward TP1 = 202 - 198
           = 4

RR TP1 = 4 / 3
       = 1.33R
```

TP2:

```text
Reward = 208 - 198
       = 10

RR = 10 / 3
   = 3.33R
```

Jadi:

```text
RR TP1 = 1.33R
RR TP2 = 3.33R
```

Tetapi karena TP1 kemungkinan **sudah tercapai**, target engine harus menghitung ulang.

---

# 7. “Skor komposit mengarah ke BUY” harus dihapus

Ini kalimat yang menurut saya cukup berbahaya:

> “skor komposit mengarah ke BUY”

Padahal deterministic engine mengatakan:

```text
Buy Permission = CONDITIONAL
Entry Status   = WATCH
Zone Status    = ABOVE_ZONE
```

Lebih baik:

> **Skor komposit 66/100 menunjukkan kualitas setup yang cukup menarik, tetapi tidak merupakan sinyal BUY. Keputusan akhir tetap mengikuti Risk Gate, Zone Status, dan Entry Confirmation.**

Ini menjaga pemisahan:

```text
AI SCORE
   ↓
QUALITY / RANKING

DETERMINISTIC ENGINE
   ↓
TRADE ACTION
```

---

# 8. Final Action harus eksplisit

Report saat ini:

```text
Trade Status:
WAIT — CHASING RISK, TUNGGU PULLBACK
```

Saya justru akan membuat field machine-readable:

```json
{
  "finalAction": "WAIT_FOR_PULLBACK"
}
```

Kemudian UI:

> **WAIT — TUNGGU PULLBACK**

Alasannya:

```text
Current Price > Entry Zone
RSI = 85
Risk Gate = CONDITIONAL
Entry Confirmation = NOT_CONFIRMED
```

---

# 9. Risk Gate juga perlu diperbaiki

Report mengatakan:

> Main Risk: Harga di bawah EMA200

Tetapi tidak memberikan EMA200.

Saya sarankan:

```json
{
  "primaryTrendRisk": {
    "type": "BELOW_EMA200",
    "status": "WARNING",
    "ema200": 210,
    "price": 205
  }
}
```

Kemudian:

```text
Risk Gate = CONDITIONAL
Primary Trend Risk = BELOW_EMA200
```

Jangan mencampur:

```text
Risk Gate
```

dengan:

```text
Risk Reason
```

---

# 10. Sentiment perlu News Relevance

Berita:

> CAMP Akan Bagi Dividen Tunai Tahun Buku 2023 Sebesar Rp20 per Saham

Sistem harus menyimpan:

```json
{
  "relevance": "DIRECT",
  "sentiment": "POSITIVE",
  "publishedAt": "...",
  "effectiveDate": "...",
  "confidence": 0.95
}
```

Yang perlu diperhatikan adalah **tahun berita**.

Kalau EzySaham sedang menganalisis September 2026 tetapi sentiment berasal dari berita lama tentang FY2023, jangan memberi bobot sama seperti katalis terbaru.

Tambahkan:

```text
NEWS_AGE
```

misalnya:

```text
0–7 hari       CURRENT
8–30 hari      RECENT
31–90 hari     AGING
>90 hari       HISTORICAL
```

---

# 11. Versi report CAMP yang saya inginkan

```text
🚨 [EQUITY RESEARCH REPORT] - $CAMP

Market Status: BULLISH
Trade Status: WAIT — TUNGGU PULLBACK

Swing Suitability: 52/100 — LOW QUALITY SETUP

Risk Gate: CONDITIONAL
Buy Permission: CONDITIONAL
Entry Status: WATCH
Zone Status: ABOVE_ZONE

📌 Setup
BUY_ON_PULLBACK
Style: Mean Reversion / Buy on Support

Expected Holding: 1–5 Hari

Entry Zone: Rp196–198
Current Price: ~Rp205

Stop Loss: Rp195
TP1: [NEXT VALID RESISTANCE]
TP2: [NEXT RESISTANCE]

Position Risk: 0.51%–1.52%

Primary Trend Risk:
BELOW_EMA200

Technical:
• Uptrend
• RSI 85 — EXTREME_OVERBOUGHT
• MACD Golden Cross
• RVOL 14.34x — VERY_HIGH
• Support Rp196
• Resistance Rp208

Entry Timing:
WAIT_FOR_PULLBACK

Reason:
Harga sudah berada di atas entry zone dan RSI
sudah sangat tinggi. Volume sangat tinggi tetapi
belum cukup untuk mengonfirmasi breakout.

Final Action:
WAIT_FOR_PULLBACK
```

---

## 12. Rule final untuk engine CAMP

Saya akan masukkan aturan ini ke **EzySaham Trading Engine**:

```text
IF currentPrice > entryHigh
THEN
    zoneStatus = ABOVE_ZONE
    entryStatus = WATCH
    finalAction = WAIT_FOR_PULLBACK

IF RSI >= 80
THEN
    rsiClass = EXTREME_OVERBOUGHT
    chasingRisk = HIGH

IF RVOL > 5
THEN
    rvolClass = VERY_HIGH

IF entry is support-based
THEN
    setup = BUY_ON_SUPPORT / BUY_ON_PULLBACK

IF currentPrice >= TP1
THEN
    TP1_STATUS = ALREADY_REACHED
    recalculate TP1

IF riskGate = CONDITIONAL
THEN
    buyPermission != BUY_NOW
    unless all entry confirmations are satisfied

AI_SCORE
    NEVER directly determines finalAction
```

### Kesimpulan audit CAMP

**Status deterministic-nya sebenarnya sudah mengarah ke WAIT yang benar.** Masalah utama sekarang bukan keputusan akhirnya, tetapi **konsistensi data di bawahnya**:

1. ❌ `BREAKOUT` → ganti `BUY_ON_PULLBACK`
2. ❌ TP1 Rp202 kemungkinan sudah tercapai → **Target Validation Engine**
3. ❌ `Position Risk -0.5%` → jadikan positif
4. ❌ RVOL 14.34 hanya “Volume Meningkat” → `VERY_HIGH`
5. ❌ “AI score mengarah ke BUY” → hapus
6. ⚠️ RSI 85 sudah benar sebagai `EXTREME_OVERBOUGHT`
7. ⚠️ `BELOW_EMA200` pisahkan dari `RiskGate`
8. ⚠️ Sentiment harus memperhitungkan **news age**
9. ✅ `ABOVE_ZONE → WAIT` sudah benar
10. ✅ `CONDITIONAL → WATCH` sudah benar

**Yang paling penting: engine sudah hampir sampai pada model yang kita inginkan: AI menjelaskan, deterministic engine yang menentukan status trading.**

---
Gunakan prompt ringkas berikut untuk AI EzySaham:

```text
Perbaiki Equity Research Engine agar seluruh output konsisten dan deterministic.

RULE WAJIB:

1. SETUP
- Jika entry berasal dari support/pullback → BUY_ON_SUPPORT atau BUY_ON_PULLBACK.
- Jangan gunakan BREAKOUT kecuali harga benar-benar breakout resistance + confirmation + volume/retest.

2. ZONE & FINAL ACTION
- Current > entryHigh → ABOVE_ZONE → WAIT_FOR_PULLBACK.
- Current dalam entry zone → IN_ZONE, tetapi BUY_NOW hanya jika EntryConfirmation=CONFIRMED.
- RiskGate=BLOCK → NO_TRADE.
- AI tidak boleh mengubah FinalAction deterministic.

3. RSI
<30 EXTREME_OVERSOLD
30–40 WEAK
40–50 PULLBACK_ZONE
50–60 NEUTRAL_BULLISH
60–70 BULLISH_MOMENTUM
70–80 OVERBOUGHT
80–90 EXTREME_OVERBOUGHT
>90 EXTREME_OVERBOUGHT
RSI tinggi bukan otomatis SELL.

4. RVOL
<0.5 VERY_LOW
0.5–0.8 LOW
0.8–1.2 NORMAL
1.2–2 ELEVATED
2–5 HIGH
>5 VERY_HIGH
RVOL=0 → NO_DATA, bukan volume rendah.
RVOL tinggi tidak otomatis bullish.

5. RISK
Risk harus ditampilkan sebagai nilai positif:
Risk % = ABS(entry - SL) / entry × 100.
Jangan tampilkan -0.5% atau -1.5%.

6. R:R
Long:
Risk = Entry - SL
Reward = TP - Entry
RR = Reward / Risk
Validasi ulang semua angka yang ditampilkan.

7. TARGET VALIDATION
TP1 harus merupakan resistance valid di atas current/entry.
Jika TP1 <= currentPrice → TP1_ALREADY_REACHED → cari resistance berikutnya.
TP2 harus > TP1.

8. EMA200
Harga di bawah EMA200 → PrimaryTrendRisk=BELOW_EMA200.
Jangan otomatis membuat RiskGate=BLOCK kecuali rule risk memang memblokir.
Pisahkan RiskGate dan PrimaryTrendRisk.

9. FUNDAMENTAL
Jangan menyebut "Undervalued" tanpa benchmark sektor/historis.
Jika hanya berdasarkan PER/PBV → gunakan "Valuation Relatively Low/High".
DER rendah tidak otomatis berarti fundamental sehat; evaluasi ROE/profitability juga.

10. SENTIMENT
Klasifikasikan berita:
DIRECT / INDIRECT / SECTOR / MARKET / UNRELATED / NO_RELEVANT_NEWS.
Berita perusahaan lain tidak boleh menjadi sentiment saham.
Perhitungkan usia berita; berita lama jangan diberi bobot seperti katalis terbaru.

11. AI SCORE
AI Score hanya untuk QUALITY/RANKING/CONFIDENCE.
AI Score tidak boleh menghasilkan BUY.
Jangan menulis "score mengarah ke BUY".

12. OUTPUT FINAL
Pastikan field berikut konsisten:
MarketStatus
Setup
RiskGate
BuyPermission
ZoneStatus
EntryStatus
PrimaryTrendRisk
Entry
SL
TP1
TP2
RR
FinalAction

PRIORITAS:
Deterministic Trading Engine > AI Interpretation.

AI hanya menjelaskan hasil engine dan tidak boleh mengubah nilai deterministic.
```

### Tambahkan satu rule penting

```text
Sebelum menghasilkan report, jalankan FINAL CONSISTENCY CHECK.
Jika ada konflik antara Setup, ZoneStatus, EntryStatus, RiskGate, TP, RR, atau FinalAction, perbaiki data berdasarkan deterministic rules terlebih dahulu, baru generate narasi.
```

Ini akan langsung menargetkan bug yang terlihat pada report **CAMP** tanpa membuat prompt terlalu panjang.
