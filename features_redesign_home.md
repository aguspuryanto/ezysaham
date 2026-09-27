Redesign halaman SCREENER SAHAM EzySaham berdasarkan screenshot referensi yang saya lampirkan.

TUJUAN:
Buat UI screener saham yang terlihat modern, profesional, clean, ringan, dan jauh lebih mudah dibaca daripada desain saat ini. Fokus utama adalah membantu user menemukan saham yang memenuhi kriteria trading/investasi dalam waktu 10 detik.

JANGAN mengubah logic, API, database, atau perhitungan existing. Fokus pada UI/UX dan penyusunan informasi.

LAYOUT DESKTOP:

1. TOP HEADER
- Logo EzySaham AI
- Search saham berdasarkan kode/nama/sektor
- Market status
- IHSG + perubahan %
- tanggal/jam
- notification
- profile user

2. SIDEBAR KIRI
Menu:
- Beranda
- Screener Saham
- Watchlist
- Portofolio
- Analisa Saham
- Backtest
- AI Assistant
- Edukasi
- Pengaturan

Di bawah menu buat "FILTER SCREENER":
- Sektor
- Market Cap
- Harga
- Volume
- Market Phase
- Trend
- Fundamental
- Momentum
- Valuation Status
- Risk

Gunakan dropdown/chips yang compact.
Tambahkan tombol:
"RESET"
"TERAPKAN FILTER"

3. MARKET SUMMARY DI ATAS
Buat card:
- IHSG
- LQ45
- USD/IDR
- Market Breadth
- Pergerakan IHSG

Gunakan mini chart/sparkline.
Warna hijau hanya untuk kondisi positif dan merah untuk negatif.

4. AREA UTAMA — SCREENER SAHAM

Header:
"Screener Saham"
subtitle:
"Temukan saham berdasarkan fundamental, teknikal, valuasi, momentum dan risiko."

Tambahkan:
- Simpan Screener
- Refresh
- jumlah hasil screening

Tab:
SEMUA
DAY TRADING
SWING HUNTER
FUNDAMENTAL
HIGH GROWTH

5. TABLE SCREENER

Prioritaskan informasi yang benar-benar berguna.

Kolom:

#
KODE
EMITEN
MARKET PHASE
TREND
FUNDAMENTAL
MOMENTUM
VOLUME
HARGA
FAIR VALUE
UPSIDE
VALUATION
RISK
AKSI

Gunakan badge/chip yang clean.

Contoh:

Market Phase:
Accumulation / Breakout / Uptrend / Distribution

Trend:
Bullish / Sideways / Bearish

Fundamental:
Excellent / Good / Neutral / Weak

Momentum:
Strong / Moderate / Weak

Volume:
High / Medium / Low

Valuation:
UNDERVALUED / FAIR VALUE / OVERVALUED

Risk:
Low / Medium / High

6. FAIR VALUE

Tampilkan:

Harga Sekarang
Rp 4.800

Fair Value
Rp 5.900 – 6.600
Median Rp 6.250

Upside
+30,21%

Valuation:
UNDERVALUED

Gunakan visual hierarchy yang jelas sehingga user langsung melihat:
HARGA → FAIR VALUE → UPSIDE → STATUS.

7. RIGHT SIDEBAR

Buat tiga card:

TOP 5 GAINER
Kode | Harga | % Change

TOP 5 LOSER
Kode | Harga | % Change

RINGKASAN VALUASI
Jumlah Emiten
Undervalued
Fair Value
Overvalued

8. UX UTAMA

Jangan membuat semua informasi terlihat sama penting.

Hierarchy:

PRIMARY:
Kode saham
Harga
Fair Value
Upside
Valuation Status

SECONDARY:
Market Phase
Trend
Momentum
Volume
Fundamental

TERTIARY:
Risk
metadata lainnya

9. VISUAL DESIGN

Gunakan:
- background putih / very light gray
- navy/dark blue sebagai primary color
- green untuk positive
- red untuk negative
- yellow/orange hanya sebagai warning
- card dengan border tipis
- border-radius 8–12px
- subtle shadow
- typography modern seperti Inter
- spacing konsisten
- table tidak terlalu padat
- sticky table header
- sticky filter/sidebar jika memungkinkan

Hindari:
- gradient berlebihan
- terlalu banyak warna
- font terlalu kecil
- border hitam tebal
- card berlebihan
- informasi duplikat
- dashboard terlihat seperti spreadsheet lama

10. RESPONSIVE

Desktop:
sidebar + main content + right insight panel.

Tablet:
sidebar dapat collapse.

Mobile:
sidebar menjadi drawer.
Table berubah menjadi card/list saham dengan informasi utama:
Kode → Harga → Upside → Valuation → Trend → Risk.

11. INTERACTION

Tambahkan:
- sorting setiap kolom yang relevan
- filter chips
- search
- pagination
- row hover
- klik saham membuka detail analisis
- favorite/watchlist
- save screener
- refresh data
- tooltip untuk istilah teknikal/fundamental
- loading skeleton
- empty state
- error state

12. AI INSIGHT

Tambahkan kolom/tooltip "AI Insight" yang singkat.

Contoh:
"Uptrend + momentum kuat + volume meningkat. Harga masih di bawah median fair value."

Jangan membuat AI memberikan BUY hanya berdasarkan valuasi.
Pisahkan:
VALUATION
TECHNICAL
RISK

13. KONSISTENSI DATA

Jangan membuat data dummy baru jika data/API existing sudah tersedia.
Pertahankan field dan logic existing.
Jika sebuah data belum tersedia, tampilkan "--" atau "N/A", bukan mengarang angka.

14. HASIL AKHIR

Desain harus terasa seperti:
"Professional Stock Screener"

bukan:
"Dashboard admin biasa".

Prioritas utama:
READABILITY → INFORMATION HIERARCHY → FAST DECISION → CONSISTENT UI.

Pertahankan branding EzySaham AI tetapi modernisasi seluruh halaman screener.

---
IMPLEMENTATION RULES:

- Audit komponen screener existing terlebih dahulu.
- Jangan membuat halaman baru jika komponen existing dapat direfactor.
- Reuse existing API, hooks, types, utilities dan state management.
- Jangan mengubah business logic tanpa alasan.
- Pecah UI menjadi reusable components:
  ScreenerHeader
  MarketSummary
  ScreenerTabs
  ScreenerFilters
  ScreenerTable
  ValuationBadge
  MarketPhaseBadge
  TrendBadge
  RiskBadge
  GainerLoserPanel
  ValuationSummary
- Pastikan TypeScript strict dan tidak menghasilkan error.
- Pastikan responsive.
- Jangan menggunakan hardcoded mock data jika API existing tersedia.
- Setelah implementasi, periksa overflow table, loading state, empty state dan mobile layout.