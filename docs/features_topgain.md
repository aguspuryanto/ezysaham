Kalau tujuan Anda **menemukan Top Gainer dari data EOD** untuk kemudian mencari kandidat **intraday/swing hari berikutnya**, jangan hanya mengurutkan berdasarkan `% change`. Yang lebih berguna adalah mencari **Top Gainer yang didukung volume, value, momentum, dan struktur harga**.

## 1. Rumus dasar Top Gainer EOD

Misalnya data EOD memiliki:

* `PrevClose`
* `Open`
* `High`
* `Low`
* `Close`
* `Volume`
* `Value`
* `Frequency`

Rumus:

```text
Change = Close - PrevClose

ChangePct = ((Close / PrevClose) - 1) × 100
```

Kemudian:

```text
Top Gainer = sort(ChangePct DESC)
```

Contoh:

| Saham |  Prev | Close | Change | Change % |
| ----- | ----: | ----: | -----: | -------: |
| ABCD  |   100 |   125 |    +25 |     +25% |
| EFGH  |   500 |   580 |    +80 |     +16% |
| IJKL  | 1.000 | 1.100 |   +100 |     +10% |

Secara sederhana ABCD adalah Top Gainer.

**Tetapi ABCD belum tentu merupakan saham terbaik untuk entry.**

---

# 2. Filter Top Gainer yang lebih berkualitas

Saya sarankan pipeline seperti ini:

```text
ALL STOCK
   ↓
Top Gainer
   ↓
Liquidity Filter
   ↓
Volume Confirmation
   ↓
Price Structure
   ↓
Momentum
   ↓
Accumulation
   ↓
Breakout / Pullback
   ↓
ENTRY CANDIDATE
```

### Filter 1 — Minimum kenaikan

Misalnya:

```text
ChangePct >= 3%
```

Tetapi jangan terlalu tinggi.

Saya lebih suka membagi:

```text
+3% s/d +7%   = Normal bullish
+7% s/d +15%  = Strong bullish
> +15%        = Extreme / perlu hati-hati
```

Karena saham +20–30% justru bisa sudah **extended**.

---

# 3. Volume adalah filter terpenting

Bandingkan volume hari ini dengan rata-rata.

```text
Volume Ratio =
Volume Today / Average Volume 20 Days
```

Contoh:

```text
Volume Today = 120 juta
Avg Volume 20 = 30 juta

Volume Ratio = 120 / 30
             = 4x
```

Artinya volume hari ini **400% dari rata-rata**.

Saya bisa klasifikasikan:

| Volume Ratio | Interpretasi  |
| -----------: | ------------- |
|       < 0.7x | Sepi          |
|     0.7–1.0x | Normal rendah |
|     1.0–1.5x | Normal        |
|       1.5–2x | Mulai menarik |
|         2–3x | Strong        |
|          >3x | 🔥 Extreme    |

Untuk Top Gainer, saya lebih tertarik:

```text
ChangePct > 3%
AND
VolumeRatio > 1.5
```

---

# 4. Gunakan Value, bukan Volume saja

Ini penting karena volume saham Rp50 berbeda maknanya dengan volume saham Rp5.000.

Gunakan:

```text
Trading Value
```

Misalnya filter:

```text
Value >= Rp10 Miliar
```

atau disesuaikan dengan strategi Anda.

Lebih bagus lagi:

```text
Value Ratio =
Value Today / Average Value 20
```

Contoh:

```text
Value Today = Rp100 M
Avg Value 20 = Rp25 M

Value Ratio = 4x
```

Ini menunjukkan **arus transaksi benar-benar meningkat**.

---

# 5. Posisi Close terhadap High

Ini salah satu filter favorit saya untuk EOD.

Rumus:

```text
Close Position =
(Close - Low) / (High - Low) × 100
```

Contoh:

```text
Low   = 100
High  = 130
Close = 128

Close Position =
(128-100)/(130-100) ×100
= 93.3%
```

Artinya harga ditutup sangat dekat dengan high.

### Interpretasi

| Close Position | Kondisi         |
| -------------: | --------------- |
|           <30% | Lemah           |
|         30–50% | Netral          |
|         50–70% | Cukup           |
|         70–85% | Bullish         |
|           >85% | 🔥 Strong close |

Jadi saya lebih suka:

```text
Top Gainer
+
Volume naik
+
Close dekat High
```

daripada sekadar `% gain` besar.

---

# 6. Cari breakout

Dari EOD Anda bisa menghitung:

```text
20D High = MAX(High 20 hari terakhir)
```

Kemudian:

```text
Breakout =
Close > Previous 20D High
```

Contoh:

```text
Previous 20D High = 1.000
Close             = 1.080
```

Maka:

```text
Breakout = TRUE
```

Lebih kuat apabila:

```text
Close > 20D High
AND
Volume Ratio > 1.5
AND
ChangePct > 3%
```

Ini jauh lebih menarik daripada Top Gainer biasa.

---

# 7. Bedakan Top Gainer menjadi 5 fase

Ini cocok sekali dengan sistem yang sebelumnya Anda ingin buat:

### 🟢 1. BULLISH AWAL

```text
ChangePct > 0
VolumeRatio > 1
Close > EMA20
EMA9 > EMA21
RSI 50–65
```

Belum breakout.

**Bias: ACCUMULATE**

---

### 🚀 2. BREAKOUT

```text
Close > 20D High
VolumeRatio > 1.5
ChangePct > 3%
ClosePosition > 75%
```

**Bias: BUY ON BREAKOUT / CONFIRMATION**

---

### 🔥 3. EXTENDED

Misalnya:

```text
ChangePct > 10%
OR
RSI > 75
OR
Close jauh > EMA20
OR
VolumeRatio > 3
```

**Jangan mengejar harga.**

Cari:

```text
Pullback
```

---

### 🟠 4. DISTRIBUTION

Contoh indikasi:

```text
Price masih naik
BUT
Volume besar
AND
ClosePosition rendah
```

Misalnya:

```text
Gain +8%
Volume 4x
Close Position 35%
```

Ini mencurigakan.

Bisa terjadi:

```text
Buyer masuk
→ harga naik
→ seller besar distribusi
→ close ditekan
```

---

### 🔴 5. PULLBACK / BEARISH

Pullback sehat:

```text
Close < High sebelumnya
AND
Volume turun
AND
Close masih > EMA21
```

Bearish:

```text
Close < EMA21
AND
EMA9 < EMA21
AND
RSI < 50
AND
Volume jual meningkat
```

---

# 8. Saya sarankan buat "Top Gainer Score"

Daripada hanya:

```text
Rank berdasarkan Change%
```

buat scoring:

```text
TOP GAINER SCORE

Change Score       = 20%
Volume Score       = 20%
Value Score        = 15%
Close Position     = 15%
Breakout Score     = 15%
Momentum Score     = 10%
Trend Score        = 5%
```

Contoh:

```text
ABCD

Gain             = 8%
Volume Ratio     = 3.2x
Value Ratio      = 2.8x
Close Position   = 91%
Breakout         = YES
RSI              = 67
EMA9 > EMA21     = YES
```

Bisa menghasilkan:

```text
TOP GAINER SCORE = 88/100
STATUS = BREAKOUT
```

Sedangkan saham:

```text
Gain             = 18%
Volume Ratio     = 0.8x
Close Position   = 42%
Breakout         = NO
RSI              = 82
```

bisa hanya:

```text
SCORE = 55/100
STATUS = EXTENDED
```

**Ini jauh lebih berguna untuk trading.**

---

# 9. Struktur tabel EOD yang saya rekomendasikan

Kalau Anda sedang membangun screener EzySaham, saya akan buat output seperti:

| Ticker | Close |   Chg% | Vol Ratio | Value Ratio | Close Pos | RSI | EMA21 | 20D Breakout | Phase           | Score |
| ------ | ----: | -----: | --------: | ----------: | --------: | --: | ----- | ------------ | --------------- | ----: |
| ABCD   |   125 |  +8.2% |      3.4x |        2.9x |       93% |  67 | ↑     | ✅            | 🚀 Breakout     |    89 |
| EFGH   |   580 | +12.5% |      4.1x |        3.8x |       88% |  78 | ↑     | ✅            | 🔥 Extended     |    82 |
| IJKL   | 1.100 |  +6.1% |      2.1x |        1.8x |       81% |  62 | ↑     | ❌            | 🟢 Bullish Awal |    78 |
| MNOP   |   250 |  +9.8% |      3.8x |        3.2x |       38% |  73 | ↑     | ✅            | 🟠 Distribution |    61 |

Dengan begitu **Top Gainer bukan berarti otomatis BUY**.

---

## 10. Formula inti yang bisa langsung Anda pakai

```text
GAIN =
(CLOSE / PREV_CLOSE - 1) × 100
```

```text
VOL_RATIO =
VOLUME / SMA(VOLUME,20)
```

```text
VALUE_RATIO =
VALUE / SMA(VALUE,20)
```

```text
CLOSE_POSITION =
(CLOSE - LOW) / (HIGH - LOW) × 100
```

```text
BREAKOUT_20 =
CLOSE > MAX(HIGH,20)
```

Kemudian klasifikasi:

```text
IF Change% < 0
    → BEARISH

ELSE IF Close < EMA21
    → BEARISH / PULLBACK

ELSE IF RSI > 75
    → EXTENDED

ELSE IF Close > 20D_High
     AND VolumeRatio > 1.5
     AND ClosePosition > 75
    → BREAKOUT

ELSE IF VolumeRatio > 1.5
     AND ClosePosition < 50
    → DISTRIBUTION

ELSE IF Close > EMA21
     AND EMA9 > EMA21
     AND RSI >= 50
    → BULLISH AWAL

ELSE
    → NEUTRAL
```

### 🎯 Untuk strategi Anda

Saya justru akan membuat **3 daftar EOD terpisah**:

```text
🔥 TOP GAINER
   ↓
🚀 TOP BREAKOUT
   ↓
🎯 TOP ENTRY BESOK
```

Karena **Top Gainer ≠ Top Breakout ≠ Top Entry**.

Yang terakhir inilah yang paling penting: saham yang **belum terlalu extended, likuid, volume masuk, close kuat, trend bullish, dan R:R masih menarik**.

Kalau Anda mau, saya bisa lanjutkan dengan **rumus SQL/PostgreSQL lengkap untuk menghitung Top Gainer + Volume Ratio + RSI + EMA9/21/50/200 + Breakout + 5 fase BULLISH AWAL → BREAKOUT → EXTENDED → DISTRIBUTION → PULLBACK → BEARISH dari data EOD**, sehingga bisa langsung dipakai di EzySaham.

Bisa. Untuk **PostgreSQL**, saya sarankan jangan membuat semuanya dalam satu `SELECT` panjang. Buat pipeline CTE: **raw EOD → indikator → breakout → phase → score → ranking**.

Di bawah ini versi yang bisa langsung Anda adaptasi untuk screener **EzySaham**.

## 1. Asumsi tabel EOD

Misalnya:

```sql
CREATE TABLE stock_eod (
    ticker      VARCHAR(10) NOT NULL,
    trade_date  DATE NOT NULL,
    open        NUMERIC(18,2),
    high        NUMERIC(18,2),
    low         NUMERIC(18,2),
    close       NUMERIC(18,2),
    volume      BIGINT,
    value       NUMERIC(24,2),
    PRIMARY KEY (ticker, trade_date)
);
```

Index:

```sql
CREATE INDEX idx_stock_eod_ticker_date
ON stock_eod (ticker, trade_date DESC);
```

---

# 2. Query lengkap

Query berikut menghitung:

* Change %
* Volume Ratio
* Value Ratio
* EMA 9
* EMA 21
* EMA 50
* EMA 200
* RSI 14
* 20D High
* Breakout
* Close Position
* Trend
* Phase
* Score
* Ranking Top Gainer

```sql
WITH RECURSIVE

/* =========================================================
   1. RAW DATA + PREVIOUS CLOSE
   ========================================================= */
base AS (
    SELECT
        ticker,
        trade_date,
        open,
        high,
        low,
        close,
        volume,
        value,

        LAG(close) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
        ) AS prev_close

    FROM stock_eod
    WHERE close IS NOT NULL
),

/* =========================================================
   2. DAILY CHANGE
   ========================================================= */
price_change AS (
    SELECT
        *,
        close - prev_close AS change,

        CASE
            WHEN prev_close > 0
            THEN ((close / prev_close) - 1) * 100
            ELSE NULL
        END AS change_pct

    FROM base
),

/* =========================================================
   3. SMA VOLUME + VALUE
   ========================================================= */
volume_stats AS (
    SELECT
        *,
        
        AVG(volume) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
        ) AS avg_volume_20,

        AVG(value) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 19 PRECEDING AND CURRENT ROW
        ) AS avg_value_20

    FROM price_change
),

/* =========================================================
   4. VOLUME / VALUE RATIO
   ========================================================= */
ratios AS (
    SELECT
        *,

        CASE
            WHEN avg_volume_20 > 0
            THEN volume / avg_volume_20
            ELSE NULL
        END AS volume_ratio,

        CASE
            WHEN avg_value_20 > 0
            THEN value / avg_value_20
            ELSE NULL
        END AS value_ratio

    FROM volume_stats
),

/* =========================================================
   5. RSI PREPARATION
   ========================================================= */
rsi_calc AS (
    SELECT
        *,
        GREATEST(change, 0) AS gain,
        GREATEST(-change, 0) AS loss

    FROM ratios
),

rsi_avg AS (
    SELECT
        *,
        
        AVG(gain) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
        ) AS avg_gain_14,

        AVG(loss) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 13 PRECEDING AND CURRENT ROW
        ) AS avg_loss_14

    FROM rsi_calc
),

rsi_result AS (
    SELECT
        *,
        
        CASE
            WHEN avg_loss_14 = 0
                 AND avg_gain_14 > 0
                THEN 100

            WHEN avg_loss_14 = 0
                THEN 50

            ELSE
                100 -
                (
                    100 /
                    (
                        1 +
                        avg_gain_14 / avg_loss_14
                    )
                )
        END AS rsi_14

    FROM rsi_avg
),

/* =========================================================
   6. EMA RECURSIVE
   ========================================================= */

ema_seed AS (
    SELECT
        ticker,
        trade_date,
        close,
        ROW_NUMBER() OVER (
            PARTITION BY ticker
            ORDER BY trade_date
        ) AS rn
    FROM rsi_result
),

/* EMA 9 */
ema9_recursive AS (
    SELECT
        ticker,
        trade_date,
        close,
        rn,
        close AS ema9
    FROM ema_seed
    WHERE rn = 1

    UNION ALL

    SELECT
        e.ticker,
        e.trade_date,
        e.close,
        e.rn,

        (
            e.close * (2.0 / (9 + 1))
            +
            r.ema9 * (1 - (2.0 / (9 + 1)))
        ) AS ema9

    FROM ema_seed e
    JOIN ema9_recursive r
        ON e.ticker = r.ticker
       AND e.rn = r.rn + 1
),

/* EMA 21 */
ema21_recursive AS (
    SELECT
        ticker,
        trade_date,
        close,
        rn,
        close AS ema21
    FROM ema_seed
    WHERE rn = 1

    UNION ALL

    SELECT
        e.ticker,
        e.trade_date,
        e.close,
        e.rn,

        (
            e.close * (2.0 / (21 + 1))
            +
            r.ema21 * (1 - (2.0 / (21 + 1)))
        ) AS ema21

    FROM ema_seed e
    JOIN ema21_recursive r
        ON e.ticker = r.ticker
       AND e.rn = r.rn + 1
),

/* EMA 50 */
ema50_recursive AS (
    SELECT
        ticker,
        trade_date,
        close,
        rn,
        close AS ema50
    FROM ema_seed
    WHERE rn = 1

    UNION ALL

    SELECT
        e.ticker,
        e.trade_date,
        e.close,
        e.rn,

        (
            e.close * (2.0 / (50 + 1))
            +
            r.ema50 * (1 - (2.0 / (50 + 1)))
        ) AS ema50

    FROM ema_seed e
    JOIN ema50_recursive r
        ON e.ticker = r.ticker
       AND e.rn = r.rn + 1
),

/* EMA 200 */
ema200_recursive AS (
    SELECT
        ticker,
        trade_date,
        close,
        rn,
        close AS ema200
    FROM ema_seed
    WHERE rn = 1

    UNION ALL

    SELECT
        e.ticker,
        e.trade_date,
        e.close,
        e.rn,

        (
            e.close * (2.0 / (200 + 1))
            +
            r.ema200 * (1 - (2.0 / (200 + 1)))
        ) AS ema200

    FROM ema_seed e
    JOIN ema200_recursive r
        ON e.ticker = r.ticker
       AND e.rn = r.rn + 1
),

/* =========================================================
   7. COMBINE EMA
   ========================================================= */
indicators AS (
    SELECT
        r.*,

        e9.ema9,
        e21.ema21,
        e50.ema50,
        e200.ema200

    FROM rsi_result r

    LEFT JOIN ema9_recursive e9
        ON r.ticker = e9.ticker
       AND r.trade_date = e9.trade_date

    LEFT JOIN ema21_recursive e21
        ON r.ticker = e21.ticker
       AND r.trade_date = e21.trade_date

    LEFT JOIN ema50_recursive e50
        ON r.ticker = e50.ticker
       AND r.trade_date = e50.trade_date

    LEFT JOIN ema200_recursive e200
        ON r.ticker = e200.ticker
       AND r.trade_date = e200.trade_date
),

/* =========================================================
   8. 20 DAY HIGH / LOW
   ========================================================= */
technical AS (
    SELECT
        *,

        MAX(high) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) AS high_20_prev,

        MIN(low) OVER (
            PARTITION BY ticker
            ORDER BY trade_date
            ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) AS low_20_prev

    FROM indicators
),

/* =========================================================
   9. CLOSE POSITION
   ========================================================= */
structure AS (
    SELECT
        *,

        CASE
            WHEN high > low
            THEN
                ((close - low) / (high - low)) * 100
            ELSE 50
        END AS close_position,

        CASE
            WHEN high_20_prev IS NOT NULL
                 AND close > high_20_prev
            THEN TRUE
            ELSE FALSE
        END AS breakout_20d

    FROM technical
),

/* =========================================================
   10. TREND
   ========================================================= */
trend AS (
    SELECT
        *,

        CASE
            WHEN ema9 > ema21
             AND ema21 > ema50
             AND ema50 > ema200
            THEN 'STRONG_UPTREND'

            WHEN ema9 > ema21
             AND ema21 > ema50
            THEN 'UPTREND'

            WHEN ema9 < ema21
             AND ema21 < ema50
            THEN 'DOWNTREND'

            ELSE 'MIXED'
        END AS trend_status

    FROM structure
),

/* =========================================================
   11. PHASE
   ========================================================= */
phase AS (
    SELECT
        *,

        CASE

            /* =========================================
               BEARISH
               ========================================= */
            WHEN close < ema21
             AND ema9 < ema21
             AND rsi_14 < 50
            THEN 'BEARISH'


            /* =========================================
               PULLBACK
               ========================================= */
            WHEN close < ema9
             AND close >= ema21
             AND ema9 > ema21
             AND volume_ratio < 1.5
            THEN 'PULLBACK'


            /* =========================================
               EXTENDED
               ========================================= */
            WHEN rsi_14 >= 75
              OR change_pct >= 10
              OR (
                    ema21 > 0
                    AND ((close - ema21) / ema21) * 100 >= 10
                 )
            THEN 'EXTENDED'


            /* =========================================
               DISTRIBUTION
               ========================================= */
            WHEN volume_ratio >= 2
             AND close_position < 50
             AND change_pct > 0
            THEN 'DISTRIBUTION'


            /* =========================================
               BREAKOUT
               ========================================= */
            WHEN breakout_20d = TRUE
             AND volume_ratio >= 1.5
             AND close_position >= 70
             AND change_pct >= 3
            THEN 'BREAKOUT'


            /* =========================================
               BULLISH AWAL
               ========================================= */
            WHEN close > ema21
             AND ema9 > ema21
             AND rsi_14 BETWEEN 50 AND 70
             AND volume_ratio >= 1
            THEN 'BULLISH_AWAL'


            ELSE 'NEUTRAL'

        END AS phase_status

    FROM trend
),

/* =========================================================
   12. SCORING
   ========================================================= */
scored AS (
    SELECT
        *,

        (
            /* PRICE MOMENTUM 20 */
            CASE
                WHEN change_pct >= 7 THEN 20
                WHEN change_pct >= 5 THEN 16
                WHEN change_pct >= 3 THEN 12
                WHEN change_pct > 0 THEN 8
                ELSE 0
            END

            +

            /* VOLUME 20 */
            CASE
                WHEN volume_ratio >= 3 THEN 20
                WHEN volume_ratio >= 2 THEN 16
                WHEN volume_ratio >= 1.5 THEN 12
                WHEN volume_ratio >= 1 THEN 8
                ELSE 0
            END

            +

            /* VALUE 15 */
            CASE
                WHEN value_ratio >= 3 THEN 15
                WHEN value_ratio >= 2 THEN 12
                WHEN value_ratio >= 1.5 THEN 9
                WHEN value_ratio >= 1 THEN 6
                ELSE 0
            END

            +

            /* CLOSE POSITION 15 */
            CASE
                WHEN close_position >= 85 THEN 15
                WHEN close_position >= 70 THEN 12
                WHEN close_position >= 55 THEN 8
                WHEN close_position >= 40 THEN 4
                ELSE 0
            END

            +

            /* BREAKOUT 15 */
            CASE
                WHEN breakout_20d THEN 15
                ELSE 0
            END

            +

            /* MOMENTUM / RSI 10 */
            CASE
                WHEN rsi_14 BETWEEN 55 AND 70 THEN 10
                WHEN rsi_14 BETWEEN 50 AND 75 THEN 7
                WHEN rsi_14 > 75 THEN 3
                ELSE 0
            END

            +

            /* TREND 5 */
            CASE
                WHEN trend_status = 'STRONG_UPTREND'
                    THEN 5
                WHEN trend_status = 'UPTREND'
                    THEN 3
                ELSE 0
            END

        ) AS technical_score

    FROM phase
),

/* =========================================================
   13. RANKING
   ========================================================= */
ranked AS (
    SELECT
        *,

        RANK() OVER (
            PARTITION BY trade_date
            ORDER BY change_pct DESC
        ) AS gainer_rank,

        RANK() OVER (
            PARTITION BY trade_date
            ORDER BY technical_score DESC
        ) AS score_rank

    FROM scored
)

/* =========================================================
   FINAL
   ========================================================= */

SELECT

    ticker,
    trade_date,

    close,
    prev_close,

    ROUND(change::NUMERIC, 2)
        AS change,

    ROUND(change_pct::NUMERIC, 2)
        AS change_pct,

    volume,
    ROUND(volume_ratio::NUMERIC, 2)
        AS volume_ratio,

    value,
    ROUND(value_ratio::NUMERIC, 2)
        AS value_ratio,

    ROUND(ema9::NUMERIC, 2)
        AS ema9,

    ROUND(ema21::NUMERIC, 2)
        AS ema21,

    ROUND(ema50::NUMERIC, 2)
        AS ema50,

    ROUND(ema200::NUMERIC, 2)
        AS ema200,

    ROUND(rsi_14::NUMERIC, 2)
        AS rsi_14,

    ROUND(close_position::NUMERIC, 2)
        AS close_position,

    high_20_prev,

    breakout_20d,

    trend_status,

    phase_status,

    technical_score,

    gainer_rank,

    score_rank

FROM ranked

WHERE trade_date = (
    SELECT MAX(trade_date)
    FROM stock_eod
)

ORDER BY technical_score DESC;
```

---

# 3. Tetapi ada satu hal penting: EMA

Untuk **screener saham**, saya tidak menyarankan menghitung EMA dengan recursive CTE setiap kali user membuka halaman.

Query di atas bagus sebagai **referensi formula**, tetapi untuk production EzySaham sebaiknya indikator dihitung saat **EOD ingestion**.

Misalnya buat tabel:

```sql
CREATE TABLE stock_indicators (
    ticker              VARCHAR(10),
    trade_date          DATE,

    change_pct          NUMERIC(10,2),

    volume_ratio        NUMERIC(10,2),
    value_ratio         NUMERIC(10,2),

    ema9                NUMERIC(18,4),
    ema21               NUMERIC(18,4),
    ema50               NUMERIC(18,4),
    ema200              NUMERIC(18,4),

    rsi14               NUMERIC(10,2),

    high20              NUMERIC(18,4),
    close_position      NUMERIC(10,2),

    breakout20          BOOLEAN,

    trend_status        VARCHAR(30),
    phase_status        VARCHAR(30),

    technical_score     INTEGER,

    PRIMARY KEY (ticker, trade_date)
);
```

Kemudian aplikasi cukup:

```sql
SELECT *
FROM stock_indicators
WHERE trade_date = CURRENT_DATE
ORDER BY technical_score DESC;
```

Ini akan **jauh lebih cepat**.

---

# 4. Query khusus TOP GAINER

Kalau hanya ingin Top Gainer:

```sql
SELECT
    ticker,
    trade_date,
    close,
    prev_close,
    change_pct,
    volume_ratio,
    value_ratio,
    rsi_14,
    phase_status,
    technical_score

FROM ranked

WHERE trade_date = (
    SELECT MAX(trade_date)
    FROM stock_eod
)

AND change_pct >= 3

ORDER BY change_pct DESC

LIMIT 30;
```

Namun saya lebih menyukai:

```sql
ORDER BY technical_score DESC
```

daripada:

```sql
ORDER BY change_pct DESC
```

karena tujuan akhirnya adalah **mencari kandidat entry**, bukan sekadar saham yang sudah naik paling tinggi.

---

# 5. Screener "TOP GAINER BERKUALITAS"

Untuk gaya trading Anda, saya akan membuat filter:

```sql
WHERE change_pct >= 3
  AND change_pct <= 10

  AND volume_ratio >= 1.5

  AND value_ratio >= 1.5

  AND close_position >= 70

  AND rsi_14 BETWEEN 50 AND 75

  AND close > ema21

  AND ema9 > ema21

ORDER BY technical_score DESC;
```

Ini menghasilkan saham yang:

**naik + volume masuk + transaksi meningkat + close kuat + trend bullish + belum terlalu ekstrem.**

---

# 6. Bedakan "Top Gainer" dengan "Top Entry"

Ini bagian yang menurut saya sangat penting untuk EzySaham.

### TOP GAINER

```text
change_pct DESC
```

### TOP MOMENTUM

```text
change_pct
+
volume_ratio
+
RSI
```

### TOP BREAKOUT

```text
breakout20 = TRUE
+
volume_ratio >= 1.5
+
close_position >= 70
```

### TOP PULLBACK

```text
phase = PULLBACK
+
close > ema21
+
ema9 > ema21
+
volume_ratio < 1.5
```

### TOP ENTRY

```text
technical_score DESC
+
phase IN (
    'BULLISH_AWAL',
    'BREAKOUT',
    'PULLBACK'
)
```

**Ini akan jauh lebih berguna daripada satu daftar Top Gainer.**

---

# 7. Saya juga akan menambahkan "Risk Filter"

Untuk menghindari kasus seperti saham yang tiba-tiba +20–30% lalu Anda mengejar harga:

```sql
AND rsi_14 < 75
AND change_pct < 10
AND close < ema21 * 1.10
```

Kemudian:

```text
Jika RSI >75
       ↓
EXTENDED
       ↓
JANGAN CHASE
       ↓
tunggu PULLBACK
```

---

# 8. Arsitektur EzySaham yang saya rekomendasikan

Karena Anda menggunakan **EOD**, arsitekturnya sebaiknya:

```text
Pasardana / EOD API
        ↓
    stock_eod
        ↓
   Indicator Engine
        ↓
stock_indicators
        ↓
┌───────────────────────────────┐
│ TOP GAINER                    │
│ TOP VOLUME                    │
│ TOP VALUE                     │
│ TOP BREAKOUT                  │
│ BULLISH AWAL                  │
│ PULLBACK                      │
│ EXTENDED                      │
│ DISTRIBUTION                  │
│ BEARISH                       │
│ TOP ENTRY                     │
└───────────────────────────────┘
        ↓
     EzySaham
        ↓
   Signal + AI Analysis
```

Dan saya akan menyimpan **phase setiap hari**, bukan hanya kondisi terakhir. Dengan begitu Anda bisa membuat histori:

```text
10 Sep → BULLISH AWAL
11 Sep → BULLISH AWAL
12 Sep → BREAKOUT
15 Sep → EXTENDED
16 Sep → DISTRIBUTION
17 Sep → PULLBACK
18 Sep → BEARISH
```

Ini membuka fitur yang sangat menarik: **"Phase Transition Detector"** — bukan hanya mengetahui bahwa saham sekarang BREAKOUT, tetapi mendeteksi **perubahan fase dari kemarin → hari ini**, yang biasanya jauh lebih berguna untuk signal entry.

Berikut **prompt AI siap copy-paste** untuk meminta AI membuat engine analisis EOD yang lengkap. Saya buat agar AI **tidak sekadar mencari saham yang naik paling tinggi**, tetapi mengklasifikasikan fase dan menghasilkan kandidat entry konservatif.

### Prompt AI — EOD Technical Screener

```text
Anda adalah QUANT TRADING ENGINEER dan SENIOR TECHNICAL ANALYST untuk saham BEI/IDX.

Tugas Anda adalah merancang RUMUS, LOGIKA, SQL PostgreSQL, dan algoritma untuk membangun EOD STOCK SCREENER.

SUMBER DATA:
Gunakan hanya data EOD saham berikut:

- ticker
- trade_date
- open
- high
- low
- close
- volume
- value

Jangan menggunakan data intraday.
Jangan mengarang data yang tidak tersedia.

==================================================
A. DAILY PRICE CHANGE / TOP GAINER
==================================================

Hitung:

Previous Close:
prev_close = LAG(close)

Change:
change = close - prev_close

Change %:
change_pct =
((close / prev_close) - 1) * 100

Buat ranking:

gainer_rank =
RANK() OVER (
    PARTITION BY trade_date
    ORDER BY change_pct DESC
)

Klasifikasi:

< 0%       = LOSER
0–3%       = NORMAL
3–7%       = GAINER
7–10%      = STRONG GAINER
>10%       = EXTREME GAINER

Jangan menganggap EXTREME GAINER otomatis sebagai BUY.

==================================================
B. VOLUME RATIO
==================================================

Hitung:

avg_volume_20 =
SMA(volume, 20)

volume_ratio =
volume / avg_volume_20

Klasifikasi:

< 0.7x     = VERY LOW
0.7–1.0x   = LOW
1.0–1.5x   = NORMAL
1.5–2.0x   = HIGH
2.0–3.0x   = VERY HIGH
>3.0x      = EXTREME

Volume confirmation dianggap valid jika:

volume_ratio >= 1.5

==================================================
C. VALUE RATIO
==================================================

Hitung:

avg_value_20 =
SMA(value, 20)

value_ratio =
value / avg_value_20

Klasifikasi:

<1x        = LOW
1–1.5x     = NORMAL
1.5–2x     = HIGH
2–3x       = VERY HIGH
>3x        = EXTREME

==================================================
D. EMA
==================================================

Hitung:

EMA9
EMA21
EMA50
EMA200

Gunakan formula EMA standar:

multiplier =
2 / (period + 1)

EMA =
(close * multiplier)
+
(previous EMA * (1 - multiplier))

Pastikan perhitungan EMA dilakukan berdasarkan:

PARTITION BY ticker
ORDER BY trade_date

Buat status:

STRONG UPTREND:

EMA9 > EMA21
AND EMA21 > EMA50
AND EMA50 > EMA200

UPTREND:

EMA9 > EMA21
AND EMA21 > EMA50

DOWNTREND:

EMA9 < EMA21
AND EMA21 < EMA50

MIXED:

selain kondisi di atas.

==================================================
E. RSI 14
==================================================

Hitung RSI periode 14.

Gunakan:

Gain =
MAX(change, 0)

Loss =
MAX(-change, 0)

RS =
Average Gain / Average Loss

RSI =
100 - (100 / (1 + RS))

Gunakan RSI 14 standar.

Klasifikasi:

RSI < 30       = OVERSOLD
30–40          = WEAK
40–50          = NEUTRAL WEAK
50–60          = BULLISH
60–70          = STRONG BULLISH
70–75          = HOT
>75            = EXTENDED

Jangan menganggap RSI >70 otomatis bearish.

==================================================
F. CLOSE POSITION
==================================================

Hitung posisi close terhadap range candle:

close_position =
((close - low) / (high - low)) * 100

Klasifikasi:

0–30%       = VERY WEAK
30–50%      = WEAK
50–70%      = NORMAL
70–85%      = STRONG
85–100%     = VERY STRONG

Jika:

close_position >= 70%

anggap candle memiliki strong closing.

==================================================
G. BREAKOUT
==================================================

Hitung:

previous_20d_high =
MAX(high)
20 hari sebelumnya,
tidak termasuk hari berjalan.

Breakout 20D:

close > previous_20d_high

Buat juga:

breakout_strength =
((close - previous_20d_high)
 / previous_20d_high) * 100

Breakout VALID jika:

close > previous_20d_high
AND volume_ratio >= 1.5
AND close_position >= 70

Breakout STRONG jika:

close > previous_20d_high
AND volume_ratio >= 2
AND close_position >= 80
AND change_pct >= 3

==================================================
H. DETEKSI EXTENDED
==================================================

Saham dianggap EXTENDED jika memenuhi salah satu:

RSI >= 75

ATAU

change_pct >= 10%

ATAU

close >= EMA21 * 1.10

ATAU

close >= EMA9 * 1.10

Namun jangan menganggap EXTENDED sebagai SELL otomatis.

Status:

EXTENDED = "DO NOT CHASE"

Rekomendasi:

WAIT FOR PULLBACK

==================================================
I. DETEKSI DISTRIBUTION
==================================================

Identifikasi potensi distribusi menggunakan kombinasi:

volume_ratio >= 2

AND

close_position < 50

AND

change_pct >= 0

ATAU:

harga masih naik tetapi:

volume meningkat
AND
close semakin jauh dari high
AND
close_position menurun.

Tambahkan flag:

distribution_warning = TRUE/FALSE

Jangan menyebutnya distribusi pasti.
Gunakan istilah:

POTENTIAL DISTRIBUTION

==================================================
J. 5 PHASE MARKET STATE
==================================================

Klasifikasikan setiap saham ke dalam:

1. BULLISH AWAL
2. BREAKOUT
3. EXTENDED
4. DISTRIBUTION
5. PULLBACK
6. BEARISH

Walaupun disebut "5 fase", gunakan keenam state di atas karena
BEARISH merupakan kondisi akhir yang perlu dipisahkan.

Prioritas klasifikasi WAJIB diperhatikan.

Gunakan prioritas:

1. BEARISH
2. PULLBACK
3. EXTENDED
4. DISTRIBUTION
5. BREAKOUT
6. BULLISH AWAL
7. NEUTRAL

==================================================
K. DEFINISI PHASE
==================================================

BULLISH AWAL:

close > EMA21
AND EMA9 > EMA21
AND RSI BETWEEN 50 AND 70
AND volume_ratio >= 1

Interpretasi:

Trend mulai bullish.
Belum breakout.
Cari entry dekat support.

-----------------------------------------------

BREAKOUT:

close > previous_20d_high
AND volume_ratio >= 1.5
AND close_position >= 70
AND change_pct >= 3
AND EMA9 > EMA21

Interpretasi:

Breakout terkonfirmasi volume.

-----------------------------------------------

EXTENDED:

RSI >= 75
OR change_pct >= 10
OR close >= EMA21 * 1.10

Interpretasi:

Harga sudah terlalu jauh.

ACTION:

DO NOT CHASE.

Tunggu pullback.

-----------------------------------------------

DISTRIBUTION:

volume_ratio >= 2
AND close_position < 50
AND change_pct >= 0

Interpretasi:

Potensi seller/distribusi.

ACTION:

WAIT / REDUCE RISK.

-----------------------------------------------

PULLBACK:

close < EMA9
AND close >= EMA21
AND EMA9 > EMA21
AND volume_ratio < 1.5

Interpretasi:

Pullback dalam trend bullish.

Ini merupakan kandidat ENTRY jika:

RSI >= 45
AND
close masih bertahan di atas EMA21.

-----------------------------------------------

BEARISH:

close < EMA21
AND EMA9 < EMA21
AND RSI < 50

Interpretasi:

Trend bearish.

ACTION:

AVOID / WAIT.

==================================================
L. PHASE TRANSITION
==================================================

Jangan hanya menghitung phase hari ini.

Bandingkan dengan phase sebelumnya:

previous_phase =
LAG(phase_status)

Buat:

phase_transition

Contoh:

NEUTRAL → BULLISH_AWAL
BULLISH_AWAL → BREAKOUT
BREAKOUT → EXTENDED
EXTENDED → DISTRIBUTION
DISTRIBUTION → PULLBACK
PULLBACK → BULLISH_AWAL
PULLBACK → BEARISH

Buat flag:

is_new_breakout
is_new_pullback
is_new_bearish
is_new_extended

Contoh:

is_new_breakout =
phase_status = 'BREAKOUT'
AND previous_phase <> 'BREAKOUT'

==================================================
M. TECHNICAL SCORE 0–100
==================================================

Buat scoring:

PRICE MOMENTUM        = 20
VOLUME CONFIRMATION   = 20
VALUE CONFIRMATION    = 15
CLOSE STRENGTH        = 15
BREAKOUT              = 15
RSI MOMENTUM          = 10
TREND                  = 5

TOTAL = 100

Contoh:

PRICE MOMENTUM:

change_pct >= 7      → 20
change_pct >= 5      → 16
change_pct >= 3      → 12
change_pct > 0       → 8
else                 → 0

VOLUME:

volume_ratio >= 3    → 20
>=2                   → 16
>=1.5                 → 12
>=1                   → 8
else                  → 0

VALUE:

value_ratio >= 3     → 15
>=2                   → 12
>=1.5                 → 9
>=1                   → 6
else                  → 0

CLOSE POSITION:

>=85                 → 15
>=70                 → 12
>=55                 → 8
>=40                 → 4
else                 → 0

BREAKOUT:

TRUE                 → 15
FALSE                → 0

RSI:

55–70                → 10
50–75                → 7
>75                  → 3
else                 → 0

TREND:

STRONG_UPTREND       → 5
UPTREND              → 3
else                 → 0

==================================================
N. ENTRY SCORE
==================================================

Buat score khusus ENTRY.

Jangan samakan dengan Technical Score.

ENTRY SCORE harus memberikan penalti:

EXTENDED             → -30
DISTRIBUTION         → -30
BEARISH              → -50

Berikan bonus:

BULLISH AWAL         → +10
BREAKOUT VALID       → +20
PULLBACK SEHAT       → +20

Tambahkan:

volume_ratio >= 1.5  → +10

RSI 50–70             → +10

close > EMA21         → +10

EMA9 > EMA21          → +10

Batasi:

ENTRY SCORE = 0–100

==================================================
O. TOP GAINER QUALITY
==================================================

Jangan ranking hanya berdasarkan change_pct.

Buat:

top_gainer_quality_score

berdasarkan:

change_pct
volume_ratio
value_ratio
close_position
RSI
EMA trend
breakout
phase

Buat ranking:

RANK() OVER (
    PARTITION BY trade_date
    ORDER BY top_gainer_quality_score DESC
)

==================================================
P. CONSERVATIVE ENTRY FILTER
==================================================

Buat filter:

CONSERVATIVE BUY CANDIDATE

Jika:

change_pct >= 2
AND change_pct <= 8

AND volume_ratio >= 1.2

AND value_ratio >= 1.2

AND close_position >= 65

AND RSI BETWEEN 50 AND 70

AND close > EMA21

AND EMA9 > EMA21

AND phase_status IN (
    'BULLISH_AWAL',
    'BREAKOUT',
    'PULLBACK'
)

AND phase_status NOT IN (
    'EXTENDED',
    'DISTRIBUTION',
    'BEARISH'
)

maka:

entry_signal = 'WATCH / BUY SETUP'

==================================================
Q. ENTRY QUALITY
==================================================

Klasifikasikan:

90–100 = A+
80–89  = A
70–79  = B
60–69  = C
<60    = AVOID

Tetapi:

Jika EXTENDED:
maximum grade = C

Jika DISTRIBUTION:
maximum grade = D

Jika BEARISH:
grade = AVOID

==================================================
R. OUTPUT SQL
==================================================

Buat SQL PostgreSQL production-ready.

Gunakan CTE secara terstruktur:

1. base
2. price_change
3. volume_stats
4. volume_ratio
5. RSI
6. EMA9
7. EMA21
8. EMA50
9. EMA200
10. 20D high
11. close_position
12. breakout
13. trend
14. phase
15. phase_transition
16. technical_score
17. entry_score
18. ranking

Jika menggunakan recursive CTE untuk EMA, pastikan hasilnya benar.

Jika ada pendekatan yang lebih efisien untuk production PostgreSQL,
jelaskan dan berikan alternatif.

==================================================
S. PRODUCTION DATABASE
==================================================

Berikan rekomendasi schema:

stock_eod

stock_indicators

stock_signals

stock_phase_history

Sertakan:

CREATE TABLE
CREATE INDEX
UPSERT
ON CONFLICT

serta strategi menghitung indikator hanya untuk EOD terbaru.

==================================================
T. API RESPONSE
==================================================

Buat contoh JSON API:

{
  "ticker": "XXXX",
  "trade_date": "YYYY-MM-DD",
  "close": 1234,
  "change_pct": 5.67,
  "volume_ratio": 2.31,
  "value_ratio": 1.87,
  "rsi14": 63.2,
  "ema9": 1200,
  "ema21": 1150,
  "ema50": 1080,
  "ema200": 1000,
  "close_position": 87,
  "breakout20": true,
  "trend": "STRONG_UPTREND",
  "phase": "BREAKOUT",
  "previous_phase": "BULLISH_AWAL",
  "phase_transition": "BULLISH_AWAL → BREAKOUT",
  "technical_score": 89,
  "entry_score": 91,
  "entry_grade": "A+",
  "entry_signal": "WATCH / BUY SETUP"
}

==================================================
U. EOD SCREENER OUTPUT
==================================================

Buat query untuk menghasilkan:

1. TOP GAINER
2. TOP VOLUME
3. TOP VALUE
4. TOP BREAKOUT
5. BULLISH AWAL
6. PULLBACK
7. EXTENDED
8. DISTRIBUTION
9. BEARISH
10. TOP ENTRY

Setiap daftar minimal menampilkan:

ticker
close
change_pct
volume_ratio
value_ratio
RSI
EMA9
EMA21
EMA50
EMA200
breakout
trend
phase
previous_phase
phase_transition
technical_score
entry_score
entry_grade
entry_signal

==================================================
V. IMPORTANT RULE
==================================================

Jangan memberikan rekomendasi BUY hanya karena:

- Top Gainer
- RSI tinggi
- Volume tinggi
- Breakout

Semua indikator harus dianalisis secara kombinasi.

Prioritaskan:

1. Trend
2. Volume
3. Price structure
4. Breakout
5. RSI
6. Risk/reward
7. Phase

Tujuan utama sistem:

MENCARI SAHAM YANG SEDANG MULAI BERGERAK,
BUKAN MENGEJAR SAHAM YANG SUDAH TERLALU NAIK.

==================================================
OUTPUT YANG SAYA INGINKAN
==================================================

Berikan jawaban dalam urutan:

1. Arsitektur perhitungan
2. Semua rumus matematika
3. SQL PostgreSQL lengkap
4. CREATE TABLE
5. Index
6. UPSERT EOD
7. Phase detection
8. Phase transition
9. Technical Score
10. Entry Score
11. Query Top Gainer
12. Query Top Breakout
13. Query Top Pullback
14. Query Top Entry
15. Contoh hasil
16. Optimasi PostgreSQL untuk ribuan saham
17. Rekomendasi implementasi API
18. Edge cases dan validasi data

Pastikan SQL valid PostgreSQL dan tidak menggunakan fungsi yang
tidak tersedia di PostgreSQL.

Gunakan NULLIF untuk menghindari division by zero.

Gunakan ROUND secara tepat untuk output.

Jangan mengarang data saham.

Jelaskan bagian yang merupakan parameter/threshold yang dapat
diubah oleh developer.
```

### 🔥 Tambahan yang saya rekomendasikan

Untuk **EzySaham**, saya akan menambahkan satu bagian lagi ke prompt tersebut: **"Early Momentum Detector"**.

Tujuannya bukan mencari saham yang sudah `+10%`, tetapi menemukan saham seperti:

```text
Kemarin:
BULLISH AWAL
Volume 1.1x
RSI 54

Hari ini:
+3.8%
Volume 2.1x
RSI 61
Close Position 88%
Breakout 20D = TRUE
```

Lalu sistem menghasilkan:

```text
🚀 NEW BREAKOUT
Score       : 91
Phase       : BULLISH AWAL → BREAKOUT
Volume      : 2.1x
RSI         : 61
Close Pos   : 88%
Action      : WATCH / BUY SETUP
```

Ini menurut saya **lebih bernilai daripada sekadar halaman Top Gainer**, karena sistem mulai mendeteksi **perubahan fase sebelum saham menjadi terlalu extended**.
