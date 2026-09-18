Ya, **ini konsep yang lebih menarik untuk EzySaham**. Jangan menjadikan watchlist hanya berdasarkan sektor atau indikator teknikal, tetapi buat **thematic watchlist berdasarkan kelompok, katalis, karakter saham, atau strategi**.

Contohnya:

### Watchlist berdasarkan Group

**Group Haji Isam**

```text
JARR
PGUN
TEBE
PACK
RANS
BYAN*
```

`* BYAN` sebaiknya diberi status **Planned/Conditional**, karena keterkaitan Jhonlin dengan BYAN berasal dari rencana transaksi yang belum final.

Lalu Anda bisa punya banyak watchlist dengan title berbeda.

---

## Struktur Watchlist EzySaham

Saya akan membuat model seperti ini:

| Watchlist                  | Isi                                 |
| -------------------------- | ----------------------------------- |
| **Group Haji Isam**        | JARR, PGUN, TEBE, PACK, RANS, BYAN* |
| **Group Low Tuck Kwong**   | BYAN                                |
| **Group Prajogo Pangestu** | BREN, BRPT, CUAN, TPIA              |
| **Group Anthoni Salim**    | ICBP, INDF, SIMP, LSIP, FAST*       |
| **Group Hartono**          | BBCA, GGRM*                         |
| **Group Barito**           | BREN, BRPT, TPIA                    |
| **Group Sinarmas**         | BSDE, SMMA, DSSA, BSIM*             |
| **Group Astra**            | ASII, UNTR, AALI, AUTO              |
| **Group MNC**              | BHIT, BMTR, MNCN, BCAP              |
| **Group Lippo**            | LPCK, LPKR, MLPL, MPPA              |
| **Group Djarum**           | BBCA, BLTA*                         |
| **Group Emtek**            | EMTK, SCMA, VIVA                    |
| **Group CT Corp**          | MEGA, MFIN*                         |
| **Group Jhonlin**          | JARR, PGUN, TEBE, PACK, RANS, BYAN* |

Tetapi **jangan menganggap semua perusahaan dalam daftar tersebut otomatis merupakan kepemilikan langsung**. Untuk database EzySaham, hubungan harus mempunyai tipe.

---

# Saya sarankan 5 tipe Watchlist

Jangan semua diberi nama "Group".

### 1. 👑 Ownership / Group

Contoh:

```text
Group Haji Isam
Group Low Tuck Kwong
Group Prajogo Pangestu
Group Salim
Group Hartono
Group Astra
```

Tujuannya:

> "Saya ingin melihat semua saham yang terhubung dengan grup tertentu."

---

### 2. 🚀 Momentum

```text
Momentum Kandidat
Breakout Kandidat
High RVOL
New High
Strong Trend
```

Misalnya:

```text
Momentum Kandidat
------------------
AMIN
MMLP
KICI
IDEA
...
```

Isi bisa berubah otomatis berdasarkan screener.

---

### 3. 💰 Fundamental

```text
Dividend Jumbo
Undervalued
High ROE
Low DER
Earnings Growth
Turnaround
```

Contoh:

```text
Dividend Jumbo
---------------
BBRI
BSSR
DMAS
TEBE
PSAB
...
```

---

### 4. 🔥 Corporate Action / Catalyst

Ini menurut saya **sangat berguna**.

```text
Potensi Corporate Action
Rights Issue
Stock Split
Akuisisi
Divestasi
Buyback
IPO
Perubahan Pengendali
Dividen
```

Contoh:

```text
Perubahan Pengendali
---------------------
BYAN
PACK
...
```

---

### 5. 📈 Trading Strategy

Ini khusus untuk workflow trading Anda:

```text
Swing 1–5 Hari
Buy on Support
Breakout Watch
Pullback Watch
Rebound Candidate
High Risk
Avoid / Falling Knife
```

---

# Yang lebih bagus: satu saham boleh masuk banyak watchlist

Misalnya **BYAN**:

```text
BYAN
 │
 ├── Group Haji Isam
 ├── Group Low Tuck Kwong
 ├── Corporate Action
 ├── Ownership Change
 └── Swing Watch
```

Sedangkan **TEBE**:

```text
TEBE
 │
 ├── Group Haji Isam
 ├── Dividend
 ├── Coal
 └── Swing Watch
```

Jadi **Watchlist bukan salinan saham**, melainkan **tag/kumpulan dinamis**.

---

# Struktur database yang saya rekomendasikan

Jangan membuat:

```text
watchlist_haji_isam = ["JARR","PGUN","TEBE"...]
```

Lebih fleksibel:

```text
watchlists
-----------
id
title
slug
description
type
is_dynamic
created_at
```

Contoh:

```text
1 | Group Haji Isam | group-haji-isam | ...
2 | Group Low Tuck Kwong | group-low-tuck-kwong | ...
3 | Dividend Jumbo | dividend-jumbo | ...
4 | Swing 1-5 Hari | swing-1-5-hari | ...
```

Kemudian:

```text
watchlist_items
----------------
id
watchlist_id
ticker
relationship
status
note
sort_order
```

Contoh:

```text
watchlist_id = 1

JARR | AFFILIATED | ACTIVE
PGUN | AFFILIATED | ACTIVE
TEBE | AFFILIATED | ACTIVE
PACK | DIRECT     | ACTIVE
RANS | DIRECT     | ACTIVE
BYAN | PLANNED    | CONDITIONAL
```

---

# Ini bisa dibuat jauh lebih powerful

Misalnya user membuka:

## 👑 Group Haji Isam

EzySaham langsung menampilkan:

| Ticker | Harga | Trend   | RSI | RVOL | Swing | Status      |
| ------ | ----: | ------- | --: | ---: | ----: | ----------- |
| JARR   |     — | Bullish |   — |    — |     — | Watch       |
| PGUN   |     — | Bullish |   — |    — |     — | Watch       |
| TEBE   |     — | —       |   — |    — |     — | Watch       |
| PACK   |     — | —       |   — |    — |     — | Watch       |
| RANS   |     — | —       |   — |    — |     — | Watch       |
| BYAN   |     — | —       |   — |    — |     — | Conditional |

Dan **data teknikal otomatis diperbarui dari EOD**.

Jadi watchlist bukan sekadar daftar saham.

Ia menjadi:

> **"Universe saham yang ingin saya pantau."**

Kemudian engine Swing 1–5 hari melakukan:

```text
GROUP WATCHLIST
       ↓
EOD DATA
       ↓
TECHNICAL SCREEN
       ↓
SWING SUITABILITY
       ↓
SETUP DETECTION
       ↓
RISK GATE
       ↓
ENTRY ZONE
       ↓
TRADING PLAN
```

---

## Bahkan saya akan tambahkan "Watchlist Builder"

Di EzySaham:

**+ Buat Watchlist**

Pilihan:

```text
┌─────────────────────────────┐
│ Buat Watchlist              │
├─────────────────────────────┤
│ ○ Manual                    │
│ ○ Group / Konglomerasi      │
│ ○ Sektor                    │
│ ○ Fundamental               │
│ ○ Technical                 │
│ ○ Corporate Action          │
│ ○ Dividend                  │
│ ○ Swing Trading             │
│ ○ Custom Filter             │
└─────────────────────────────┘
```

Untuk kasus Anda:

```text
Title:
Group Haji Isam

Description:
Saham yang terkait dengan jaringan usaha
Haji Isam/Jhonlin Group.

Members:
JARR
PGUN
TEBE
PACK
RANS
BYAN

Update:
Manual / Admin
```

**Ini menurut saya lebih cocok untuk EzySaham daripada membuat satu screener besar saja.** Anda bisa memiliki **"Watchlist berbasis narasi"** dan kemudian membiarkan mesin teknikal menentukan **saham mana dari watchlist tersebut yang sedang memiliki setup Swing 1–5 hari**.

----
Tentu. Untuk EzySaham, saya sarankan prompt AI-nya dibuat agar **AI tidak asal memasukkan saham ke sebuah group**, tetapi memahami bahwa watchlist adalah **kumpulan saham berdasarkan tema/hubungan tertentu**.

Berikut prompt yang bisa langsung Anda pakai.

```text
SYSTEM PROMPT — EZYSAHAM WATCHLIST AI

Kamu adalah AI Watchlist Curator untuk EzySaham.

Tugas utama:
Membantu membuat, mengelola, memvalidasi, dan menjelaskan watchlist saham berdasarkan tema tertentu seperti:
- Group / Konglomerasi
- Kepemilikan
- Afiliasi bisnis
- Sektor
- Sub-sektor
- Fundamental
- Dividend
- Corporate Action
- Momentum
- Swing Trading
- Technical Setup
- Custom Theme

==================================================
1. PRINSIP UTAMA
==================================================

Watchlist adalah kumpulan saham yang memiliki hubungan atau karakteristik tertentu.

Jangan memasukkan saham hanya karena:
- sektornya mirip
- produknya mirip
- pernah diberitakan bersama
- harga sahamnya bergerak sama
- terdapat rumor tanpa sumber yang jelas

Setiap anggota watchlist harus mempunyai alasan yang dapat dijelaskan.

Gunakan relationship_type untuk menjelaskan hubungan saham dengan watchlist.

Relationship type yang diperbolehkan:

DIRECT_OWNERSHIP
CONTROLLING
AFFILIATED
GROUP_COMPANY
SUBSIDIARY
ASSOCIATE
PLANNED_TRANSACTION
SECTOR
SUBSECTOR
THEMATIC
CORPORATE_ACTION
TECHNICAL
FUNDAMENTAL
DIVIDEND
CUSTOM

==================================================
2. GROUP / KONGLOMERASI
==================================================

Jika user meminta:

"buat watchlist Group Haji Isam"

maka identifikasi perusahaan/saham yang:
- dimiliki langsung
- dikendalikan
- terafiliasi
- merupakan bagian dari kelompok usaha
- mempunyai hubungan korporasi yang terdokumentasi
- sedang dalam proses transaksi yang relevan

Pisahkan status hubungan:

ACTIVE
CONDITIONAL
PLANNED
HISTORICAL
UNCONFIRMED

Jangan mengubah PLANNED atau CONDITIONAL menjadi ACTIVE.

Contoh:

Group Haji Isam

JARR → GROUP_COMPANY → ACTIVE
PGUN → GROUP_COMPANY → ACTIVE
TEBE → AFFILIATED → ACTIVE
PACK → DIRECT_OWNERSHIP → ACTIVE
RANS → DIRECT_OWNERSHIP → ACTIVE
BYAN → PLANNED_TRANSACTION → CONDITIONAL

Jika transaksi belum selesai, wajib diberi status CONDITIONAL atau PLANNED.

==================================================
3. JANGAN MENYAMAKAN GROUP DENGAN KEPEMILIKAN LANGSUNG
==================================================

Jika sebuah saham hanya terafiliasi dengan suatu grup,
jangan tulis:

"Dimiliki oleh X"

gunakan:

"Terafiliasi dengan X"

Jika hubungan berasal dari transaksi yang belum selesai:

"Direncanakan terkait dengan X melalui transaksi yang masih bersyarat."

Gunakan istilah yang tepat:

Direct Ownership
Controlling Ownership
Affiliated
Group Company
Planned Transaction
Conditional

==================================================
4. WATCHLIST DINAMIS
==================================================

Satu saham boleh berada di banyak watchlist.

Contoh:

BYAN dapat berada di:

Group Low Tuck Kwong
Group Haji Isam
Coal
Corporate Action
Ownership Change
Swing Watch

TEBE dapat berada di:

Group Haji Isam
Coal
Dividend
Swing Watch

Jangan membuat duplikasi data saham.

Gunakan relasi many-to-many:

WATCHLIST
    ↓
WATCHLIST_ITEMS
    ↓
TICKER

==================================================
5. JENIS WATCHLIST
==================================================

A. GROUP / OWNERSHIP

Contoh:
- Group Haji Isam
- Group Low Tuck Kwong
- Group Prajogo Pangestu
- Group Salim
- Group Hartono
- Group Astra

B. FUNDAMENTAL

Contoh:
- Dividend Jumbo
- High ROE
- Low DER
- Undervalued Candidate
- Earnings Growth
- Turnaround

C. TECHNICAL

Contoh:
- Breakout Watch
- Pullback Watch
- Rebound Candidate
- New High
- High RVOL
- Momentum

D. TRADING

Contoh:
- Swing 1–5 Hari
- Buy on Support
- Breakout Candidate
- Mean Reversion
- High Risk

E. CORPORATE ACTION

Contoh:
- Rights Issue
- Stock Split
- Buyback
- Akuisisi
- Divestasi
- Perubahan Pengendali
- Tender Offer
- IPO
- Dividen

F. SECTOR / THEME

Contoh:
- Coal
- Banking
- Data Center
- Renewable Energy
- Infrastructure
- Consumer

==================================================
6. WATCHLIST CUSTOM
==================================================

Jika user memberikan daftar saham secara manual:

"buat watchlist Saham Pilihan Saya:
BBRI, BMRI, BBNI"

jangan mengubah atau menambahkan saham secara otomatis.

Gunakan:

type = CUSTOM

source = USER

members = saham yang diberikan user

==================================================
7. VALIDASI TICKER
==================================================

Pastikan ticker merupakan saham BEI yang valid.

Jika ticker tidak ditemukan:

status = UNVERIFIED

Jangan mengarang nama perusahaan.

Jika nama perusahaan ambigu, tandai:

NEEDS_VERIFICATION

==================================================
8. SUMBER HUBUNGAN
==================================================

Jika hubungan ownership/group digunakan, prioritaskan sumber:

1. Laporan tahunan
2. Keterbukaan informasi BEI
3. Prospektus
4. Laporan kepemilikan saham
5. Corporate action disclosure
6. Website perusahaan
7. Sumber berita finansial terpercaya

Jangan menggunakan rumor media sosial sebagai bukti kepemilikan.

Jika hanya rumor:

relationship_status = UNCONFIRMED

==================================================
9. WATCHLIST + DATA TRADING
==================================================

Watchlist bukan sinyal BUY.

Setelah watchlist dibuat, EzySaham dapat menjalankan:

WATCHLIST
    ↓
EOD DATA
    ↓
TREND
    ↓
SWING SUITABILITY
    ↓
SETUP
    ↓
RISK GATE
    ↓
ZONE STATUS
    ↓
ENTRY STATUS
    ↓
FINAL ACTION

Final Action:

BUY_NOW
WAIT_FOR_PULLBACK
WAIT
NO_TRADE

AI TIDAK BOLEH mengubah Final Action berdasarkan opini.

==================================================
10. SWING 1–5 HARI
==================================================

Untuk watchlist trading:

Expected Holding = 1–5 days

Fokus pada data EOD:

- EMA20
- EMA50
- EMA200
- RSI
- MACD
- Volume
- RVOL
- ATR
- Support
- Resistance
- Price Structure
- Market Regime

EMA9/EMA21/VWAP intraday hanya supplementary
jika data tersedia.

Jangan menjadikan indikator intraday sebagai sumber utama
untuk keputusan swing jika data utamanya EOD.

==================================================
11. WATCHLIST STATUS
==================================================

Setiap saham dalam watchlist dapat memiliki:

WATCH
ACTIVE_SETUP
WAIT
NO_SETUP
INVALIDATED

Contoh:

Group Haji Isam

JARR → WATCH
PGUN → ACTIVE_SETUP
TEBE → WAIT
PACK → WATCH
RANS → NO_SETUP
BYAN → CONDITIONAL

Status tersebut adalah status trading,
BUKAN status kepemilikan.

==================================================
12. SCORING
==================================================

Jangan menggunakan AI Score sebagai keputusan BUY.

Pisahkan:

Group Relevance Score
Swing Suitability Score
Technical Score
Fundamental Score
Sentiment Score
Risk Score

Contoh:

Swing Suitability = 72
Technical = 81
Fundamental = 64
Risk = MODERATE

Final Action tetap ditentukan oleh deterministic trading engine.

==================================================
13. OUTPUT SAAT MEMBUAT WATCHLIST
==================================================

Gunakan format:

WATCHLIST CREATED

Title:
Group Haji Isam

Type:
GROUP / OWNERSHIP

Description:
Saham yang memiliki hubungan kepemilikan,
afiliasi, atau hubungan korporasi dengan jaringan
usaha Haji Isam/Jhonlin.

Members:

1. JARR
   Relationship: GROUP_COMPANY
   Status: ACTIVE

2. PGUN
   Relationship: GROUP_COMPANY
   Status: ACTIVE

3. TEBE
   Relationship: AFFILIATED
   Status: ACTIVE

4. PACK
   Relationship: DIRECT_OWNERSHIP
   Status: ACTIVE

5. RANS
   Relationship: DIRECT_OWNERSHIP
   Status: ACTIVE

6. BYAN
   Relationship: PLANNED_TRANSACTION
   Status: CONDITIONAL

==================================================
14. OUTPUT JSON
==================================================

Jika API meminta JSON, gunakan struktur:

{
  "watchlist": {
    "title": "Group Haji Isam",
    "slug": "group-haji-isam",
    "type": "GROUP_OWNERSHIP",
    "description": "...",
    "source": "AI_CURATED"
  },
  "items": [
    {
      "ticker": "JARR",
      "relationship_type": "GROUP_COMPANY",
      "relationship_status": "ACTIVE",
      "confidence": 0.95,
      "reason": "..."
    },
    {
      "ticker": "PGUN",
      "relationship_type": "GROUP_COMPANY",
      "relationship_status": "ACTIVE",
      "confidence": 0.95,
      "reason": "..."
    }
  ]
}

==================================================
15. ATURAN PENTING
==================================================

JANGAN:

- Mengarang hubungan ownership.
- Menganggap rumor sebagai fakta.
- Menganggap perusahaan satu sektor sebagai satu grup.
- Mengubah transaksi conditional menjadi completed.
- Menganggap watchlist sebagai rekomendasi BUY.
- Memberikan ranking saham hanya karena termasuk satu grup.
- Mengubah data deterministic trading engine.
- Menggunakan AI opinion untuk menentukan Final Action.

SELALU:

- Jelaskan hubungan setiap saham.
- Berikan relationship_type.
- Berikan relationship_status.
- Bedakan ownership langsung dan afiliasi.
- Bedakan transaksi completed dan planned.
- Izinkan satu ticker berada di banyak watchlist.
- Gunakan confidence.
- Simpan sumber/referensi hubungan jika tersedia.
```

### Saya juga sarankan database EzySaham-nya mengikuti prompt ini

```text
watchlists
├── id
├── title
├── slug
├── type
├── description
└── source

watchlist_items
├── id
├── watchlist_id
├── ticker
├── relationship_type
├── relationship_status
├── confidence
├── reason
├── source_url
└── source_date
```

Dengan begitu **AI hanya bertugas mengkurasi hubungan**, sedangkan **Trading Engine tetap bertugas menentukan apakah saham tersebut BUY / WAIT / NO TRADE**.

Contoh akhirnya:

> **Group Haji Isam**
> JARR · PGUN · TEBE · PACK · RANS · BYAN*
>
> `* BYAN = CONDITIONAL / PLANNED TRANSACTION`

Kemudian ketika user membuka watchlist tersebut, EzySaham bisa otomatis menampilkan **Swing Suitability, RSI, RVOL, Setup, Entry Zone, Risk Gate, dan Final Action** untuk semua saham di dalamnya.

----
Bisa. Bahkan untuk kebutuhan **EzySaham Watchlist**, Vercel bisa diintegrasikan dengan storage/database yang terhubung ke project Vercel.

Namun ada satu hal penting: istilah **"Vercel Storage"** sekarang mencakup beberapa layanan. Untuk data seperti:

```text
Watchlist
├── Group Haji Isam
│   ├── JARR
│   ├── PGUN
│   ├── TEBE
│   ├── PACK
│   ├── RANS
│   └── BYAN
│
├── Group Low Tuck Kwong
│   └── BYAN
│
├── Dividend Jumbo
│   ├── BBRI
│   ├── BSSR
│   └── TEBE
```

saya **lebih menyarankan database**, bukan object/blob storage.

### Pilihan arsitektur EzySaham

```text
                EzySaham
                   │
             Next.js / Vercel
                   │
          ┌────────┴────────┐
          │                 │
       API/Server        Frontend
          │
          ↓
     Database
          │
     ┌────┴─────┐
     │          │
 Watchlists   WatchlistItems
```

Untuk struktur data kamu, **Vercel Postgres sudah berubah menjadi Neon integration**, sementara Vercel juga menyediakan **Vercel Blob** untuk penyimpanan file/object. Untuk relational data seperti watchlist, PostgreSQL/Neon jauh lebih cocok.

### Schema yang saya rekomendasikan

```sql
CREATE TABLE watchlists (
    id UUID PRIMARY KEY,
    title VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    is_dynamic BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY,
    watchlist_id UUID REFERENCES watchlists(id) ON DELETE CASCADE,
    ticker VARCHAR(10) NOT NULL,
    relationship_type VARCHAR(50),
    relationship_status VARCHAR(30),
    confidence NUMERIC(5,2),
    reason TEXT,
    source_url TEXT,
    source_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(watchlist_id, ticker)
);
```

Kemudian AI cukup menghasilkan:

```json
{
  "title": "Group Haji Isam",
  "type": "GROUP_OWNERSHIP",
  "items": [
    {
      "ticker": "JARR",
      "relationship_type": "GROUP_COMPANY",
      "relationship_status": "ACTIVE"
    },
    {
      "ticker": "PGUN",
      "relationship_type": "GROUP_COMPANY",
      "relationship_status": "ACTIVE"
    },
    {
      "ticker": "BYAN",
      "relationship_type": "PLANNED_TRANSACTION",
      "relationship_status": "CONDITIONAL"
    }
  ]
}
```

Lalu backend menyimpan hasil tersebut ke database.

**Vercel Blob** baru saya gunakan kalau nanti EzySaham perlu menyimpan:

* PDF laporan emiten
* screenshot chart
* laporan keuangan
* dokumen corporate action
* hasil research AI
* file CSV
* attachment berita

Jadi sederhananya:

| Kebutuhan EzySaham    | Storage             |
| --------------------- | ------------------- |
| Watchlist             | **PostgreSQL/Neon** |
| Ticker & relationship | **PostgreSQL/Neon** |
| User portfolio        | **PostgreSQL/Neon** |
| Swing setup           | **PostgreSQL/Neon** |
| AI research metadata  | **PostgreSQL/Neon** |
| PDF laporan           | **Vercel Blob**     |
| CSV                   | **Vercel Blob**     |
| Screenshot/chart      | **Vercel Blob**     |

Kalau EzySaham kamu saat ini masih menggunakan **Supabase**, sebenarnya **tidak perlu pindah hanya karena aplikasinya di-deploy ke Vercel**. Supabase PostgreSQL sudah sangat cocok untuk struktur watchlist ini.

Kalau tujuanmu adalah **mengurangi ketergantungan Supabase dan membuat EzySaham full Vercel**, saya bisa bantu buatkan **arsitektur EzySaham → Vercel + Neon + Blob + AI**, termasuk `.env`, schema SQL, API Next.js, dan migrasi tabel Watchlist dari Supabase.

-----
Bisa. Untuk **EzySaham**, saya sarankan arsitektur yang cukup sederhana tetapi siap berkembang: **Vercel sebagai application layer, Neon sebagai database utama, Vercel Blob sebagai file storage, dan AI sebagai analysis layer**.

![Image](https://images.openai.com/static-rsc-4/iS56B7HGi2b-08kSp1DaPaqCjbfIoy5tatuzwdp4FncL5FjvDyvEytlKSR3IWcupVs04BqoRfoC0ZXLn0TJjkJrZSZSdjsj9FQhq7KyOakl8s93Jo-P5pA-iypFlwAo7c09SgmPsiwaNqtgOS3D5dOiO4MDSSZRFfwlvlGK8Af9e6dKXD1xTLmjJ9P-aui3K?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/kt_VCUy12-Z2TSV1dj7cpjKk5XlzMkSZDjaP6tFbfTFeVGd8tFrXI1T8EwHhruzE6sMxN-mmfb4tsDJEZCLbt_Upgh6QdXFcZWzDqu_d4mmtwXS7RhHTrFE8ju7yQ-MOgGq742DUr4qvM4K1BkB45MpQU-sxdbCUwT9RH7hwyfKqnB0joC7LP_ecELvjQYxi?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/_VkJ_ZV7UHYPRmsp6Arb_Hic9KHHc1h8DxdmzKjFVYYeMwggIk3ZAsBmQGbnUU3HxkCO27SFgxsMbDSGnEQVF9T5LFSCDD52pmb4pNot_m1H_PTBRqYp-IyzrHLeSJgtxOdL2KYyXTY_Ab2Oop5f9vukD5ZjyEqSDscX33ywvbbTX44UrpY-gLI18t2jfebG?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/WqDaoitN7k50Cl1AltZvfLiNaYPXfmUcEtLGBj5dRUkksIMDJwmWBsAwe2cjKti3IwoUXV1QgDkbfK3b0KrAZwwLfwaBabPgITeFSJ4bPj6qqowFKWperILCIpnsGanFD7OqZ3WILMHbHcVzbmfPSnhB3d0PsXrHKsvcXPaPbQDDhkwiP-Qfszp8QSNjv33v?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/ZV9EBVqDQjimlpiragoTsNUhK6FC_lgKDijTGqjSHEu4q1L5nFDDpvzkbP3P_zudOkZFCcCufpzqxEiS3GNTlUnDXAxAsq-S_i6cVa4hHRY2VXrYbVY6Y6tnfcd_-mafFdlk0bE69k2EgwQ6eFwcUOPuR4te0dAW_qCVytU36ur872mcLg8ANQ64IxCjFf2u?purpose=fullsize)

## 1. Arsitektur EzySaham yang saya rekomendasikan

```text
                         ┌─────────────────────┐
                         │       USER          │
                         │ Web / Mobile / PWA  │
                         └──────────┬──────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │          VERCEL           │
                    │       Next.js App         │
                    │                           │
                    │ Dashboard                 │
                    │ Screener                 │
                    │ Watchlist                 │
                    │ Stock Detail              │
                    │ Equity Research            │
                    │ Portfolio                 │
                    └─────────────┬─────────────┘
                                  │
                 ┌────────────────┼────────────────┐
                 │                │                │
                 ▼                ▼                ▼
          ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
          │ API Routes  │  │ AI Engine   │  │ Blob Storage │
          │ /api/*      │  │             │  │              │
          └──────┬──────┘  └──────┬──────┘  └──────────────┘
                 │                 │
                 │                 ▼
                 │        ┌─────────────────┐
                 │        │ AI Provider     │
                 │        │ LLM             │
                 │        └─────────────────┘
                 │
                 ▼
          ┌──────────────────────┐
          │        NEON          │
          │   PostgreSQL DB      │
          │                      │
          │ Stocks               │
          │ EOD                  │
          │ Indicators           │
          │ Watchlists           │
          │ Signals              │
          │ Research             │
          │ Users                │
          │ AI Results           │
          └──────────┬───────────┘
                     │
                     ▼
              ┌───────────────┐
              │ EOD Data API  │
              │ Pasardana/etc │
              └───────────────┘
```

### Pembagian tanggung jawab

| Komponen     | Fungsi                                   |
| ------------ | ---------------------------------------- |
| **Vercel**   | Next.js, frontend, API, cron/job trigger |
| **Neon**     | Database PostgreSQL                      |
| **Blob**     | PDF, CSV, laporan, gambar, dokumen       |
| **AI**       | Analisis saham, research, summarization  |
| **EOD API**  | Harga & volume harian                    |
| **Next.js**  | UI + orchestration                       |
| **Neon SQL** | Source of truth                          |
| **AI**       | Interpretation, bukan source of truth    |

---

# 2. Prinsip terpenting EzySaham

Saya justru menyarankan **jangan membuat AI sebagai pusat sistem**.

Gunakan:

```text
DATA
  ↓
CALCULATION ENGINE
  ↓
DETERMINISTIC SIGNAL
  ↓
RISK ENGINE
  ↓
AI INTERPRETATION
  ↓
REPORT
```

Bukan:

```text
DATA
 ↓
AI
 ↓
BUY
```

Ini penting karena sebelumnya kita menemukan beberapa masalah pada report EzySaham seperti:

* `BUY_ALLOWED` ≠ `BUY_NOW`
* TP1 sudah tercapai tetapi masih dijadikan target
* RSI 89 dianggap sinyal jual otomatis
* RVOL 0 dianggap volume rendah
* setup `BREAKOUT` tetapi entry sebenarnya support
* R:R tidak sesuai perhitungan
* harga sudah di atas entry zone tetapi masih `BUY_NOW`
* berita perusahaan lain dianggap sentiment saham
* fundamental rendah tetapi disebut undervalued

Dengan arsitektur baru, **AI tidak boleh mengubah hasil calculation engine**.

---

# 3. Database Neon

Saya akan membagi database menjadi beberapa domain.

```text
NEON POSTGRES
│
├── market
│   ├── stocks
│   ├── eod_prices
│   ├── technical_indicators
│   └── corporate_actions
│
├── trading
│   ├── swing_setups
│   ├── trade_levels
│   ├── risk_analysis
│   └── signals
│
├── watchlist
│   ├── watchlists
│   └── watchlist_items
│
├── research
│   ├── research_reports
│   ├── news
│   ├── news_relevance
│   └── research_sources
│
├── ai
│   ├── ai_runs
│   ├── ai_outputs
│   └── ai_prompts
│
└── user
    ├── users
    ├── portfolios
    └── transactions
```

---

# 4. Core table: stocks

```sql
CREATE TABLE stocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticker VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255),

    sector VARCHAR(100),
    subsector VARCHAR(100),

    listed_status VARCHAR(30) DEFAULT 'ACTIVE',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

Contoh:

```text
BBRI
BYAN
BSSR
TEBE
PSAB
DMAS
SINI
RISE
```

---

# 5. EOD data

Karena EzySaham fokus **Swing Trading 1–5 hari**, tabel EOD adalah salah satu tabel paling penting.

```sql
CREATE TABLE eod_prices (
    id BIGSERIAL PRIMARY KEY,

    stock_id UUID REFERENCES stocks(id),

    trading_date DATE NOT NULL,

    open NUMERIC(18,4),
    high NUMERIC(18,4),
    low NUMERIC(18,4),
    close NUMERIC(18,4),

    volume BIGINT,

    value BIGINT,

    UNIQUE(stock_id, trading_date)
);
```

Kemudian indicator:

```sql
CREATE TABLE technical_indicators (
    id BIGSERIAL PRIMARY KEY,

    stock_id UUID REFERENCES stocks(id),
    trading_date DATE NOT NULL,

    ema9 NUMERIC(18,4),
    ema21 NUMERIC(18,4),
    ema50 NUMERIC(18,4),
    ema200 NUMERIC(18,4),

    rsi14 NUMERIC(10,4),

    macd NUMERIC(18,6),
    macd_signal NUMERIC(18,6),
    macd_histogram NUMERIC(18,6),

    atr14 NUMERIC(18,4),

    rvol NUMERIC(10,4),

    vwap NUMERIC(18,4),

    UNIQUE(stock_id, trading_date)
);
```

---

# 6. Trading Engine

Saya sarankan hasil calculation disimpan.

```sql
CREATE TABLE swing_setups (
    id BIGSERIAL PRIMARY KEY,

    stock_id UUID REFERENCES stocks(id),
    trading_date DATE NOT NULL,

    market_status VARCHAR(30),

    setup VARCHAR(50),

    swing_suitability INTEGER,

    risk_gate VARCHAR(30),

    buy_permission VARCHAR(30),

    zone_status VARCHAR(30),

    entry_status VARCHAR(30),

    final_action VARCHAR(50),

    primary_trend_risk VARCHAR(50),

    confidence NUMERIC(5,2),

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(stock_id, trading_date)
);
```

Contoh hasil:

```json
{
  "ticker": "AMIN",
  "marketStatus": "BULLISH",
  "setup": "BUY_ON_SUPPORT",
  "swingSuitability": 62,
  "riskGate": "CONDITIONAL",
  "buyPermission": "CONDITIONAL",
  "zoneStatus": "ABOVE_ZONE",
  "entryStatus": "WATCH",
  "finalAction": "WAIT_FOR_PULLBACK"
}
```

---

# 7. Trade levels

Pisahkan level harga dari setup.

```sql
CREATE TABLE trade_levels (
    id BIGSERIAL PRIMARY KEY,

    swing_setup_id BIGINT REFERENCES swing_setups(id),

    entry_low NUMERIC(18,4),
    entry_high NUMERIC(18,4),

    stop_loss NUMERIC(18,4),

    tp1 NUMERIC(18,4),
    tp2 NUMERIC(18,4),

    risk_percent NUMERIC(10,4),

    rr_tp1 NUMERIC(10,4),
    rr_tp2 NUMERIC(10,4),

    sl_type VARCHAR(40),

    invalidation_price NUMERIC(18,4)
);
```

Dengan demikian R:R bisa dihitung deterministically:

```text
risk   = entry - SL
reward = TP - entry

RR = reward / risk
```

AI tidak boleh menghitung ulang lalu mengganti nilainya.

---

# 8. Watchlist

Untuk sistem watchlist yang kita bahas sebelumnya:

```sql
CREATE TABLE watchlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(100) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,

    type VARCHAR(50) NOT NULL,

    description TEXT,

    is_dynamic BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT NOW()
);
```

Dan:

```sql
CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    watchlist_id UUID REFERENCES watchlists(id)
        ON DELETE CASCADE,

    ticker VARCHAR(10) NOT NULL,

    relationship_type VARCHAR(50),

    relationship_status VARCHAR(30),

    confidence NUMERIC(5,2),

    reason TEXT,

    source_url TEXT,

    source_date DATE,

    created_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(watchlist_id, ticker)
);
```

Contoh:

```text
Group Haji Isam
│
├── JARR
├── PGUN
├── TEBE
├── PACK
├── RANS
└── BYAN
```

Tetapi:

```text
WATCHLIST
   ≠
BUY SIGNAL
```

Ini harus dipertahankan di level arsitektur.

---

# 9. News + AI Research

Untuk news:

```sql
CREATE TABLE news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ticker VARCHAR(10),

    title TEXT NOT NULL,

    summary TEXT,

    source_name VARCHAR(100),

    source_url TEXT,

    published_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);
```

Kemudian relevance:

```sql
CREATE TABLE news_relevance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    news_id UUID REFERENCES news(id),

    ticker VARCHAR(10),

    relevance VARCHAR(30),

    sentiment VARCHAR(30),

    confidence NUMERIC(5,2),

    reason TEXT
);
```

Misalnya:

```json
{
  "ticker": "AMIN",
  "relevance": "DIRECT",
  "sentiment": "POSITIVE",
  "confidence": 91
}
```

Sedangkan berita PALM:

```json
{
  "ticker": "AMIN",
  "relevance": "UNRELATED",
  "sentiment": "NEUTRAL",
  "confidence": 98
}
```

Jadi AI tidak asal mengambil semua berita sebagai sentiment.

---

# 10. Vercel Blob

Blob jangan digunakan sebagai database.

Gunakan untuk:

```text
Blob
│
├── research/
│   ├── AMIN/
│   ├── BYAN/
│   └── BBRI/
│
├── reports/
│   ├── 2026/
│   └── 2027/
│
├── documents/
│   ├── annual-report/
│   ├── prospectus/
│   └── corporate-action/
│
├── screenshots/
│
└── exports/
    ├── csv/
    └── pdf/
```

Misalnya Annual Report:

```text
Blob
   ↓
annual-report-byan-2025.pdf
   ↓
AI document parser
   ↓
extract text
   ↓
Neon
   ↓
RAG
   ↓
AI Research
```

---

# 11. AI Architecture

Saya sarankan AI dibagi menjadi **4 AI Agent**, bukan satu AI besar.

```text
                    AI LAYER
                       │
       ┌───────────────┼────────────────┐
       │               │                │
       ▼               ▼                ▼
 Research AI      Watchlist AI      Report AI
       │               │                │
       └───────────────┼────────────────┘
                       ▼
                  Explanation AI
```

### Research AI

Tugas:

```text
Annual Report
Financial Statement
News
Corporate Action
Prospectus
        ↓
Structured Facts
```

Output:

```json
{
  "revenue_growth": 12.4,
  "net_profit_growth": 18.2,
  "roe": 17.9,
  "der": 5.5,
  "valuation": "RELATIVELY_LOW"
}
```

---

### Watchlist AI

Tugas:

```text
Company relationships
Ownership
Corporate action
Sector
Theme
```

Output:

```json
{
  "ticker": "BYAN",
  "relationshipType": "PLANNED_TRANSACTION",
  "relationshipStatus": "CONDITIONAL",
  "confidence": 94
}
```

---

### Trading AI

Ini yang paling penting:

**AI tidak menentukan signal.**

Trading engine menghitung:

```text
EMA
RSI
MACD
RVOL
ATR
Support
Resistance
Trend
Market Regime
Risk
Entry Zone
TP
SL
RR
```

Kemudian AI hanya menjelaskan:

```text
"Price is above the proposed entry zone.
The setup remains valid, but current price is not
an optimal entry according to the predefined zone."
```

---

# 12. Report AI

Baru setelah semua data tersedia:

```text
Neon
 │
 ├── EOD
 ├── Indicators
 ├── Setup
 ├── Risk
 ├── Fundamental
 ├── News
 ├── Watchlist
 │
 ▼
AI
 │
 ▼
Equity Research Report
```

Contoh:

```text
$AMIN

Market       BULLISH
Setup        BUY_ON_SUPPORT
Suitability  62/100

Entry        234–238
Current      257

Zone         ABOVE_ZONE
Entry        NOT_READY

Risk Gate    CONDITIONAL

Final Action
WAIT_FOR_PULLBACK
```

AI boleh menjelaskan **mengapa**.

AI tidak boleh mengubah:

```text
FinalAction
Entry
SL
TP
RR
RiskGate
ZoneStatus
```

---

# 13. API Next.js

Struktur project:

```text
src/
│
├── app/
│   ├── page.tsx
│   │
│   ├── screener/
│   │   └── page.tsx
│   │
│   ├── stock/
│   │   └── [ticker]/
│   │       └── page.tsx
│   │
│   ├── watchlists/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   │
│   └── api/
│       ├── stocks/
│       ├── screener/
│       ├── watchlists/
│       ├── research/
│       ├── signals/
│       └── ai/
│
├── lib/
│   ├── db/
│   ├── trading/
│   ├── indicators/
│   ├── risk/
│   ├── ai/
│   ├── blob/
│   └── news/
│
├── components/
│
└── types/
```

---

# 14. Trading engine sebaiknya murni TypeScript

Contohnya:

```text
lib/trading/

market-regime.ts
trend-engine.ts
indicator-engine.ts
setup-engine.ts
risk-engine.ts
zone-engine.ts
entry-engine.ts
target-engine.ts
signal-engine.ts
swing-engine.ts
```

Pipeline:

```text
EOD
 ↓
Indicators
 ↓
Market Regime
 ↓
Trend
 ↓
Setup
 ↓
Risk Gate
 ↓
Entry Zone
 ↓
Zone Status
 ↓
Entry Confirmation
 ↓
Target Validation
 ↓
R:R
 ↓
Final Action
```

---

# 15. Final Action Engine

Saya akan membuat satu fungsi sebagai **single source of truth**.

```typescript
function determineFinalAction(input) {

  if (input.riskGate === "BLOCK") {
    return "NO_TRADE";
  }

  if (input.zoneStatus === "ABOVE_ZONE") {
    return "WAIT_FOR_PULLBACK";
  }

  if (input.zoneStatus === "BELOW_ZONE") {
    return "WAIT";
  }

  if (
    input.buyPermission === "TRUE" &&
    input.entryConfirmation === "CONFIRMED" &&
    input.zoneStatus === "IN_ZONE"
  ) {
    return "BUY_NOW";
  }

  return "WAIT";
}
```

Dengan aturan ini, LLM tidak akan bisa secara tidak sengaja menghasilkan:

```text
Entry 234-238
Current 257
BUY NOW
```

---

# 16. Scheduled EOD Pipeline

Setiap hari setelah market selesai:

```text
17:00
 │
 ▼
Fetch EOD
 │
 ▼
Neon
 │
 ▼
Calculate Indicators
 │
 ▼
Calculate Swing Setup
 │
 ▼
Risk Engine
 │
 ▼
Target Engine
 │
 ▼
Screener
 │
 ▼
AI Research
 │
 ▼
Generate Reports
 │
 ▼
Save to Neon
 │
 ▼
Optional PDF → Blob
```

Hasilnya:

```text
EOD 18 Sep 2026

2,000 stocks
      ↓
Technical filter
      ↓
500
      ↓
Liquidity filter
      ↓
150
      ↓
Swing suitability
      ↓
40
      ↓
Risk gate
      ↓
15
      ↓
AI research
      ↓
10
```

---

# 17. Screener EzySaham

Dashboard bisa seperti:

```text
┌─────────────────────────────────────────────┐
│ EzySaham                                   │
├─────────────────────────────────────────────┤
│ Market: BULLISH                            │
│ IHSG: xxxx                                 │
├─────────────────────────────────────────────┤
│ 🔥 Swing Opportunity                       │
│                                             │
│ Ticker Setup       Score Zone       Action  │
│ AMIN   Support      62   Above      WAIT    │
│ AYLS   Pullback     71   Above      WAIT    │
│ BSSR   Support      78   In Zone    WATCH   │
│ BBRI   Pullback     81   In Zone    WATCH   │
└─────────────────────────────────────────────┘
```

Filter:

```text
Market
Sector
Liquidity
Trend
Setup
RSI
RVOL
Risk Gate
Zone
Swing Suitability
Watchlist
```

---

# 18. AI Research Report

Saya akan membuat report menjadi structured JSON terlebih dahulu.

```json
{
  "ticker": "AMIN",

  "market": {
    "status": "BULLISH"
  },

  "trading": {
    "style": "SWING_1_5_DAYS",
    "setup": "BUY_ON_SUPPORT",
    "suitability": 62,
    "riskGate": "CONDITIONAL",
    "zoneStatus": "ABOVE_ZONE",
    "entryStatus": "WATCH",
    "finalAction": "WAIT_FOR_PULLBACK"
  },

  "levels": {
    "entryLow": 234,
    "entryHigh": 238,
    "stopLoss": 233.69,
    "tp1": 260,
    "tp2": 284
  },

  "technical": {
    "rsi": 67.7,
    "rsiClass": "BULLISH_MOMENTUM",
    "rvol": 1.67,
    "rvolClass": "ELEVATED"
  },

  "fundamental": {
    "per": 8.8,
    "pbv": 1.37,
    "roe": 17.9,
    "der": 5.5,
    "valuation": "RELATIVELY_LOW"
  },

  "news": {
    "relevance": "DIRECT",
    "sentiment": "POSITIVE"
  }
}
```

Baru kemudian:

```text
JSON
 ↓
LLM
 ↓
Human-readable report
```

---

# 19. AI Guardrail

Saya sangat menyarankan menambahkan:

```text
DETERMINISTIC DATA
        ↓
     LOCKED
        ↓
      AI
        ↓
EXPLANATION ONLY
```

AI menerima:

```json
{
  "finalAction": "WAIT_FOR_PULLBACK",
  "locked": true
}
```

Prompt:

> You may explain the trading result but MUST NOT change deterministic fields.

Kemudian validator:

```typescript
if (ai.finalAction !== engine.finalAction) {
    ai.finalAction = engine.finalAction;
}
```

Jadi kalau AI menjawab:

```text
BUY NOW
```

sedangkan engine:

```text
WAIT_FOR_PULLBACK
```

sistem otomatis mempertahankan:

```text
WAIT_FOR_PULLBACK
```

---

# 20. Vercel + Neon + Blob + AI

Secara keseluruhan:

```text
                  EZYSAHAM
                     │
              ┌──────▼──────┐
              │   VERCEL    │
              │   Next.js   │
              └──────┬──────┘
                     │
       ┌─────────────┼──────────────┐
       │             │              │
       ▼             ▼              ▼
     NEON           BLOB            AI
  PostgreSQL      Documents        LLM
       │             │              │
       │             │              │
       └─────────────┼──────────────┘
                     │
                     ▼
               RESEARCH ENGINE
                     │
                     ▼
               TRADING ENGINE
                     │
                     ▼
                SCREENER
                     │
                     ▼
                USER/UI
```

## Rekomendasi saya untuk EzySaham

**Jangan pindahkan semuanya ke Vercel sekaligus.**

Gunakan migrasi bertahap:

### Phase 1 — Foundation

```text
Vercel
+
Neon
+
Blob
```

Migrasikan:

```text
stocks
EOD
indicators
watchlists
watchlist_items
```

### Phase 2 — Trading Engine

Implementasikan:

```text
Trend
RSI
MACD
RVOL
Support/Resistance
Setup
Risk Gate
Zone
Entry
TP/SL
R:R
Final Action
```

### Phase 3 — AI

Tambahkan:

```text
Research AI
Watchlist AI
News AI
Report AI
```

### Phase 4 — Premium EzySaham

Baru tambahkan:

```text
Portfolio
Trading Journal
Alert
Personal Watchlist
AI Research
Historical Backtest
Performance Tracking
```

Dengan struktur ini, **Neon menjadi source of truth, Blob menjadi document/file layer, Vercel menjadi application layer, dan AI menjadi intelligence/explanation layer**.

Itu menurut saya fondasi yang paling cocok untuk mengembangkan EzySaham dari screener sederhana menjadi **platform stock research + swing trading intelligence** tanpa membuat arsitekturnya terlalu kompleks sejak awal.
