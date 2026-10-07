Saya justru akan membagi sistem menjadi 4 mode utama, supaya tidak terlalu banyak kategori di UI:

⚡ 1. INTRADAY

Holding: menit–hari yang sama

Momentum → VWAP → Volume → Breakout → Entry → TP/SL

🚀 2. SWING

Holding: 2 hari–beberapa minggu

Trend → Momentum → Volume → Breakout/Pullback → Entry → TP/SL

📈 3. POSITION

Holding: minggu–bulan

Trend besar → EMA50/200 → Fundamental → Catalyst → Risk

💰 4. INVESTING

Holding: bulan–tahun

Fundamental → Valuation → Growth → Dividend → Margin of Safety

Sedangkan Breakout, Pullback, Reversal, Momentum, Dividend sebaiknya diperlakukan sebagai strategi/pattern, bukan sebagai mode utama.

Jadi arsitekturnya bisa seperti:

MOONSTOCK
   │
   ├── Discovery
   │     ├── Breakout
   │     ├── Pullback
   │     ├── Momentum
   │     ├── Reversal
   │     └── Volume Surge
   │
   ▼
TECHNICAL ANALYSIS
   │
   ├── Trend
   ├── Momentum
   ├── Volume
   ├── Support
   └── Resistance
   │
   ▼
TRADING MODE
   ├── Intraday
   ├── Swing
   ├── Position
   └── Investing
   │
   ▼
HARD RISK GATE
   │
   ├── BUY
   ├── WAIT
   └── AVOID

Ini menurut saya lebih kuat untuk EzySaham daripada membuat banyak "jenis trading", karena Moonstock menemukan peluang, Technical membaca setup, Trading Mode menentukan horizon, lalu Hard Risk Gate menentukan apakah boleh masuk.

---
Format ini **sudah jauh lebih aman** untuk Momentum Trade Engine. Yang paling penting: engine **tidak memaksakan entry** ketika setup sudah extended.

Namun ada **1 masalah logika yang cukup penting**:

> `Potential ≥20%: PASS` dan `R:R ≥1:2: PASS` **tidak boleh membuat Risk Gate terlihat PASS secara keseluruhan** ketika `Entry Trigger = FAIL` dan `Valid SL = FAIL`.

Saya sarankan output final dibuat seperti:

### 🚀 Momentum Trade Engine — PCAR

**Status: 🔴 AVOID CHASING**
**Momentum:** STRONG
**Structure:** EXTENDED
**Entry:** N/A
**SL:** N/A
**TP1:** N/A
**TP2:** N/A
**Potential:** N/A
**R:R:** N/A
**Exit Risk:** MEDIUM

### 🛡️ HARD RISK GATE

| Gate              | Status         |
| ----------------- | -------------- |
| Potential ≥20%    | 🟢 PASS        |
| R:R ≥1:2          | 🟢 PASS        |
| Entry Trigger     | 🔴 FAIL        |
| Valid SL          | 🔴 FAIL        |
| Distribution Risk | 🟢 PASS        |
| Upside ≥20%       | 🟢 PASS        |
| **FINAL GATE**    | **🔴 BLOCKED** |

**Kenapa BLOCKED?**

Karena **potensi profit saja tidak cukup untuk menghasilkan BUY**.

```text
Potential      PASS
R:R            PASS
      ↓
Entry Trigger  FAIL
Valid SL       FAIL
      ↓
HARD RISK GATE
      ↓
🔴 BLOCKED
      ↓
AVOID CHASING
```

### 🎯 Trigger Entry

> Tunggu harga kembali mendekati **EMA20 ± Rp57** dan membentuk **Higher Low** dengan konfirmasi volume/price action.

Baru setelah itu engine menghitung ulang:

**Entry → SL → TP → R:R → Potential**

Ini penting karena **Entry, SL, TP, Potential, dan R:R seharusnya tidak dipaksakan muncul ketika entry belum valid.**

### ⚠️ Satu koreksi lagi

Kalimat:

> **Harga sudah 40% di atas EMA20 (+25% seminggu)**

sangat kuat sebagai alasan `EXTENDED`.

Tetapi `RSI 83.9` sebaiknya jangan diterjemahkan otomatis sebagai **“harus turun”**. Lebih tepat:

> **RSI 83.9 → momentum sangat kuat tetapi kondisi overextended, sehingga risiko pullback/profit taking meningkat.**

Dengan begitu AI tidak jatuh ke kesalahan:

**RSI tinggi → SELL**

atau

**harga naik jauh → pasti reversal.**

---

### 🧠 Prinsip yang saya rekomendasikan untuk Momentum Engine

**Momentum kuat + harga extended = bukan otomatis SELL.**

Melainkan:

> **Momentum STRONG → jangan kejar → tunggu reset/pullback → validasi ulang → baru hitung entry.**

Jadi PCAR ini sebenarnya contoh yang bagus untuk menunjukkan filosofi EzySaham:

**“Saham bagus untuk diamati belum tentu bagus untuk dibeli sekarang.”**
