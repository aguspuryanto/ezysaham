REDESIGN DETAIL PAGE EZYSAHAM AI

Gunakan gambar referensi yang saya lampirkan sebagai acuan utama desain UI.

Tujuan:
Redesign halaman "Detail Emiten / Stock Detail" EzySaham AI agar konsisten dengan desain baru halaman Screener Saham yang sudah dibuat.

JANGAN mengubah business logic, API, database, calculation, routing, atau struktur data yang sudah berjalan.
Fokus pada UI/UX, layout, hierarchy informasi, responsive design, dan visual consistency.

==================================================
1. DESIGN SYSTEM
==================================================

Gunakan design language yang sama dengan halaman Screener:

- Clean modern fintech SaaS
- Background putih / very light gray
- Primary navy / blue EzySaham
- Accent green untuk bullish / positif
- Red untuk bearish / negatif
- Yellow/orange untuk warning
- Border tipis
- Rounded corners 8–12px
- Subtle shadow
- Banyak whitespace
- Typography modern dan mudah dibaca
- Compact tetapi tetap nyaman untuk data saham
- Jangan gunakan gradient berlebihan
- Jangan membuat UI terlihat seperti crypto dashboard
- Prioritaskan readability daripada dekorasi

Pastikan semua komponen menggunakan design token yang konsisten:
- color
- spacing
- border-radius
- font-size
- font-weight
- badge
- button
- card
- table
- tabs

==================================================
2. PAGE STRUCTURE
==================================================

Buat struktur halaman:

[Sidebar]
[Top Header]

                    [Main Content]              [Right Insight Panel]

Breadcrumb

Stock Header Card

Tabs:
Ringkasan | Chart | Fundamental | Technical |
Bandarmology | Valuation | Corporate Action | News

--------------------------------------------------

MAIN CONTENT

A. STOCK HEADER

Tampilkan:

BBRI
Bank Rakyat Indonesia Tbk.
Sector: Perbankan

Current Price:
Rp 3.860

Change:
+Rp 80 (+2,12%)

Market status:
OPEN

Tambahkan:
High
Low
Volume

Action:
+ Tambah Watchlist
Buat Trading Plan

Header harus menjadi focal point halaman.

Gunakan hierarchy:

Ticker → paling besar
Nama emiten → secondary
Harga → sangat prominent
Change → green/red
Metadata → compact

--------------------------------------------------

B. CHART SECTION

Card:

"Grafik Harga"

Timeframe:
1D | 1W | 1M | 3M | 6M | 1Y

Indicator toggles:

EMA 9
EMA 21
EMA 50
EMA 200
VWAP

Tampilkan:

- Candlestick chart
- Volume chart
- Price axis
- Date axis
- Crosshair/tooltip jika chart library mendukung
- Current price marker

Chart harus menjadi elemen terbesar di halaman.

Jangan membuat chart terlalu dekoratif.

Prioritaskan:
price readability
indicator readability
volume readability

--------------------------------------------------

C. TECHNICAL SUMMARY

Buat 5 compact cards:

TREND
Bullish
Harga di atas EMA 50 & EMA 200

MOMENTUM
Strong
MACD positif

VOLUME
High
Volume > 1.5x rata-rata

RSI
68
Overbought
(bukan sinyal jual otomatis)

MACD
Bullish
MACD di atas signal line

Gunakan semantic colors.

Green:
Bullish / Strong / Positive

Red:
Bearish / Weak / Negative

Yellow:
Warning / Neutral

Blue:
Informational

--------------------------------------------------

D. AI INSIGHT

Buat card khusus:

"AI Insight"

Badge:
Analisa Berbasis Data & Indikator

Isi AI harus berupa analytical summary, bukan klaim pasti.

Contoh:

"BBRI menunjukkan tren utama bullish dengan harga berada di atas EMA 50 dan EMA 200. Momentum masih menguat. Area support terdekat berada di Rp3.700."

Di sisi kanan:

"Signal Utama"

✓ Trend utama bullish
✓ Harga di atas EMA 50 & EMA 200
✓ Momentum menguat

⚠ Waspada jika kehilangan Rp3.700

Gunakan icon dan semantic color.

Jangan menggunakan wording:
"Pasti naik"
"100% BUY"
"Auto profit"

AI hanya menjelaskan kondisi berdasarkan data.

==================================================
3. RIGHT SIDEBAR
==================================================

Buat sidebar insight yang sticky pada desktop.

CARD 1 — SNAPSHOT

Market Phase
Accumulation

Fair Value
Rp 4.900 – 5.420

Upside Potential
+33,68%

Status
UNDERVALUED

Risk
Medium

Gunakan badge untuk status.

--------------------------------------------------

CARD 2 — KEY LEVELS

Support
Rp 3.700

Resistance
Rp 4.000

Breakout
Rp 4.050

Gunakan visual hierarchy yang jelas.

--------------------------------------------------

CARD 3 — FUNDAMENTAL

Grid:

ROE
18,4%

PER
11,2x

PBV
2,1x

DER
5,8x

Revenue Growth
+8,2%

Net Profit Growth
+10,5%

Jangan membuat tabel terlalu padat.

--------------------------------------------------

CARD 4 — OWNERSHIP / FLOW

Foreign Flow (Net)
+Rp125B

Broker Activity
Akumulasi

Foreign Flow
Positif

Gunakan indicator hijau jika positif.

--------------------------------------------------

CARD 5 — PRICE PERFORMANCE

1D
+2,12%

1W
+6,48%

1M
+12,31%

3M
+18,76%

1Y
+42,18%

Gunakan compact horizontal grid.

--------------------------------------------------

CARD 6 — PRICE VS TARGET

Visual horizontal range:

Current Price
Rp3.860

Fair Value
Rp4.900 – Rp5.420

Upside
+33,68%

Buat visual sederhana seperti progress/range bar.

==================================================
4. NAVIGATION
==================================================

Gunakan horizontal tabs:

Ringkasan
Chart
Fundamental
Technical
Bandarmology
Valuation
Corporate Action
News

Active tab:
blue underline + blue text.

Tabs harus tetap usable pada layar kecil:
horizontal scroll jika diperlukan.

==================================================
5. RESPONSIVE
==================================================

Desktop:
Sidebar kiri + Main Content + Right Insight Panel

Tablet:
Sidebar dapat collapse
Right panel menjadi bagian bawah content

Mobile:
1 column

Urutan mobile:

Stock Header
Tabs
Chart
Technical Summary
AI Insight
Snapshot
Key Levels
Fundamental
Ownership / Flow
Performance
Price Target

Jangan membuat horizontal overflow.

==================================================
6. COMPONENT ARCHITECTURE
==================================================

Jika project menggunakan React/Next.js:

Pisahkan menjadi reusable components:

StockDetailPage
├── Breadcrumb
├── StockHeader
├── StockTabs
├── PriceChart
├── ChartToolbar
├── TechnicalSummary
├── AIInsight
├── SnapshotCard
├── KeyLevelsCard
├── FundamentalCard
├── OwnershipFlowCard
├── PerformanceCard
└── PriceTargetCard

Jangan membuat satu component besar berisi seluruh halaman.

Gunakan data props agar component reusable untuk semua emiten.

Contoh:

<StockHeader stock={stock} />
<PriceChart data={chartData} />
<TechnicalSummary indicators={indicators} />
<AIInsight analysis={aiAnalysis} />

==================================================
7. DATA INTEGRITY
==================================================

PENTING:

Jangan hardcode data BBRI jika aplikasi sudah mempunyai API/state/data provider.

Gunakan existing data source.

Jika data belum tersedia:
gunakan placeholder/mock hanya untuk visual development,
tetapi struktur harus siap menerima data real.

Jangan mengubah:
- API endpoint
- database schema
- calculation
- authentication
- routing
- existing business logic

==================================================
8. UX IMPROVEMENT
==================================================

Tambahkan:

- Tooltip untuk indikator
- Hover state
- Loading skeleton
- Empty state
- Error state
- Responsive chart
- Sticky right insight panel desktop
- Smooth tab navigation
- Consistent badge
- Consistent number formatting

Format:

Rp 3.860
+2,12%
+33,68%
18,4%
11,2x
52,3M

Gunakan format Indonesia.

==================================================
9. VISUAL PRIORITY
==================================================

Prioritas visual:

1. Stock identity
2. Current price
3. Price chart
4. Technical condition
5. AI insight
6. Key levels
7. Fundamental
8. Flow / Bandarmology
9. Performance
10. Valuation

Jangan membuat semua card terlihat sama penting.

Gunakan typography, spacing, dan ukuran card untuk membangun hierarchy.

==================================================
10. FINAL REQUIREMENT
==================================================

Hasil akhir harus terasa seperti:

"Bloomberg-style stock analysis"
+
"modern fintech SaaS"
+
"EzySaham AI"

Tetapi tetap:
- clean
- simple
- beginner friendly
- data driven
- professional
- tidak terlalu ramai

Pertahankan sidebar dan header dari desain Screener yang sudah ada.

Yang berubah terutama adalah area Detail Emiten.

Pastikan Detail Emiten terlihat sebagai bagian dari satu Design System EzySaham AI, bukan halaman dengan desain yang berbeda.

Gunakan gambar referensi yang diberikan sebagai visual reference utama.