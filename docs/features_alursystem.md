## Cara kerja EzySaham (dilihat dari [ScreenerPage.tsx](src/presentation/features/screener/ScreenerPage.tsx))

### Alur kerja Screener

1. **Ambil daftar semua saham.** Saat halaman dibuka, `loadSummaries` memanggil `/api/stocks`. Route ini mengambil data dari Pasardana dan menyimpannya di cache selama 5 menit. Hasilnya berupa ringkasan tiap saham: harga, perubahan, sektor, dan volume. Kalau sebelumnya Anda pernah menekan "Simpan Screener", pilihan tab, filter, dan urutan dipulihkan dari localStorage ([ScreenerPage.tsx:137-163](src/presentation/features/screener/ScreenerPage.tsx#L137-L163)).

2. **Scan bertahap.** Begitu Anda memilih tab, `runScan` berjalan ([ScreenerPage.tsx:169-210](src/presentation/features/screener/ScreenerPage.tsx#L169-L210)):
   - **Filter kasar (`coarseFilter`):** menyaring cepat dari data ringkasan saja, tanpa request tambahan, untuk membuang saham yang jelas tidak cocok.
   - **Analisis mendalam:** setiap kandidat yang lolos diambil riwayat OHLCV-nya (dari Yahoo Finance) dan/atau data fundamentalnya. Maksimal 6 request berjalan bersamaan. Selama proses ini progress bar menampilkan hitungan seperti `checked/total`.
   - **Evaluasi preset (`preset.evaluate`):** menentukan apakah saham lolos, sekaligus memberi alasan, skor, dan rencana trading.
   - Ada pengaman berupa token. Kalau Anda pindah tab dengan cepat, hasil scan lama tidak akan menimpa hasil yang baru.

3. **Penyaringan lanjutan di sisi pengguna:**
   - Pencarian berdasarkan ticker, nama, atau sektor, ditambah filter dasar di sidebar.
   - Filter lanjutan dan pengurutan berdasarkan "verdict" (fase, fundamental, valuasi). Verdict dihitung per saham, tapi hanya untuk baris yang tampil di halaman. Perhitungan untuk seluruh daftar hanya dilakukan kalau filter atau urutan memang membutuhkannya, supaya hemat request.
   - Hasil ditampilkan 25 baris per halaman.

4. **Tindak lanjut:** saham bisa dimasukkan ke Watchlist, dipilih untuk Compare, atau disimpan lewat **Create Jurnal**. Create Jurnal mengambil 5 saham dengan skor tertinggi, tapi hanya yang berstatus `DAY TRADE SETUP` atau `SWING BUY SETUP`. Saham berstatus WATCH atau WAIT tidak ikut. Entry, TP, SL, dan R:R terisi otomatis, lalu disimpan di Vercel Blob.

### Arsitektur
Kode dibagi menjadi tiga lapisan:
- `domain/` berisi logika murni: indikator, mesin analisis, dan preset. Sebagian sudah punya unit test.
- `data/` berisi repository dan sumber data eksternal (Pasardana, Yahoo, IndexAlpha).
- `presentation/` berisi UI.

## Fitur yang tersedia

| Halaman | Fungsi |
|---|---|
| **/screener** | 6 tab: Semua, Day Trading, Swing Trading, Fundamental, High Growth, Core Portofolio. Di kode juga ada preset lain yang tidak muncul sebagai tab: ARA Hunter, Breakout Hunter, Bandar Detector, Early Accumulation, Swing Trend/Momentum, dan Fundamental Quality. |
| **/screener/[ticker]** | Analisis per saham memakai **Decision Engine v3**. Alurnya: kualitas data → likuiditas → trend → momentum → tahap momentum → deteksi setup → kualitas entry → R:R → keputusan per horizon (trading/swing/investing). Ada juga perhitungan ukuran posisi berbasis risiko. |
| **/moonstock** | Radar penemuan saham dalam 3 mode: Intraday (VWAP, RVOL), Swing (EMA stack, HH/HL), dan Investing (pertumbuhan, ROE, D/E). |
| **/signal**, **/terminal** | Sinyal trading dan tampilan ala terminal. |
| **/backtest** | Uji strategi historis per saham, termasuk mode harian. |
| **/history/[code]** | Riwayat event teknikal: breakout, cross indikator, akumulasi/distribusi, lonjakan volume. |
| **/compare** | Membandingkan beberapa saham: fundamental, grafik harga, dan verdict AI. |
| **/sektor**, **/gainers**, **/losers** | Pergerakan per sektor serta saham top naik dan turun. |
| **/watchlist**, **/jurnal** | Daftar pantauan dan jurnal trading yang mencatat rencana vs realisasi. |
| **AI Chat + Research Report** | Lewat `/api/ai-chat` (default model deepseek-v4-flash melalui router BangunWeb). Laporan riset disusun dari hasil analisis yang sudah dihitung. |
| **Market regime** | Menentukan kondisi IHSG (bullish/netral/bearish) dari EMA 9/21/50/200, RSI, dan MACD. |
| Lainnya | Blog, panduan, tutorial, login (next-auth), dan PWA. |

## Kelebihan dibanding kompetitor

Pembandingnya: Stockbit, RTI, IPOT, Ajaib, dan screener TradingView.

1. **Memberi keputusan, bukan sekadar filter angka.** Screener kompetitor umumnya hanya menyaring indikator ("RSI < 30", "PER < 10"). EzySaham langsung menghasilkan status (SETUP/WATCH/NO TRADE), trigger entry, TP1/TP2, SL, R:R, dan batas entry ("jangan kejar").
2. **Disiplin risiko sudah tertanam di aturan.** Contohnya: R:R minimal 1,5, SL maksimal 8%, dan aturan *chase*. Saham yang sudah naik ≥10% sehari atau RSI-nya di atas 75 diberi label AVOID CHASING sekuat apa pun momentumnya. Prinsip "momentum kuat ≠ BUY" ini jarang ada di aplikasi lain.
3. **Analisis disesuaikan dengan horizon.** Peran fundamental dan syarat likuiditas berbeda untuk trading, swing, dan investing.
4. **Terbuka soal batas data.** Data yang tidak tersedia tidak ditebak (ditampilkan "DATA TIDAK TERSEDIA"). Bandar Detector juga terang-terangan menyebut dirinya proxy dari harga, volume, dan OBV, bukan broker summary asli. Data basi diberi peringatan oleh `dataFreshness`.
5. **Alur kerja lengkap dalam satu aplikasi:** screener → analisis → jurnal → backtest. Di Stockbit, misalnya, jurnal dan backtest tidak tersedia secara native.
6. **Gratis dan ringan:** berbentuk web/PWA tanpa perlu akun sekuritas, ditambah AI research report berbahasa Indonesia.

## Kelemahan yang perlu diingat
- **Data masih EOD.** Day trading hanya dihitung dari data penutupan hari sebelumnya, sedangkan Stockbit dan RTI punya data realtime, orderbook, dan running trade.
- **Data bandar terbatas.** Broker summary dan foreign flow lengkap (berbayar di Stockbit Pro/RTI Pro) belum masuk ke skor Bandar Detector.
- **Bergantung pada sumber data gratis** (Yahoo, Pasardana). Fundamental bisa kosong, terutama untuk saham bank, dan ada risiko rate-limit saat scan berjalan paralel.
- **Belum ada fitur sosial/komunitas.** Ini justru kekuatan utama Stockbit.

Singkatnya, posisi EzySaham paling kuat sebagai alat bantu keputusan yang disiplin untuk trader dan investor ritel. Untuk eksekusi intraday secara realtime, aplikasi ini belum bisa menggantikan Stockbit atau RTI.

---
Model monetisasi tersebut cocok untuk EzySaham, terutama jika prinsip utamanya adalah pengguna gratis tetap bisa mengambil keputusan saham yang masuk akal, sedangkan pengguna Pro membayar untuk kecepatan, kedalaman analisis, otomatisasi, dan skala kerja yang lebih besar.

Saya menyarankan agar EzySaham tidak menjadikan sinyal BUY yang lebih baik sebagai hak eksklusif Pro. Keputusan dasar `BUY / WAIT / AVOID`, alasan keputusan, dan HARD RISK GATE sebaiknya tetap tersedia di Free. Dengan demikian, monetisasi tidak mendorong pengguna membayar hanya demi mendapatkan peringatan risiko atau menghilangkan batasan keselamatan.

## 1. Struktur paket yang disarankan

## Free — Belajar dan mengambil keputusan

Gratis

Cocok untuk investor pemula dan pengguna yang melakukan analisis EOD.

- Screener saham dengan kuota wajar.
- Analisis dasar dan Decision Engine v3.
- Status BUY / WAIT / AVOID beserta alasan dan Risk Gate.
- Trading plan dasar: entry, TP, SL, dan R:R.
- Jurnal dengan jumlah catatan terbatas.
- Watchlist dan riwayat analisis dasar.
- AI dengan kuota harian terbatas.

## Pro — Analisis lebih mendalam

Berbayar

Untuk trader aktif dan pengguna yang membutuhkan efisiensi.

- Data intraday, jika sumber data dan lisensinya tersedia.
- Broker summary dan foreign flow yang didukung data sumber.
- Backtest multi-saham dan pengujian strategi.
- AI dengan kuota tinggi atau penggunaan wajar.
- Alert harga dan sinyal otomatis.
- Jurnal lebih besar, statistik performa, dan ekspor laporan.
- Analisis multi-saham dan laporan riset lanjutan.

## 2. Harga awal untuk diuji

Saya menyarankan menguji harga secara bertahap, bukan langsung berinvestasi besar pada data intraday dan infrastruktur mahal.

Paket Pro bulanan

# Rp99.000

Harga hipotesis awal untuk diuji kepada pengguna, bukan harga pasar yang sudah tervalidasi.

AI dan analisis lanjutan

Backtest multi-saham

Alert otomatis

Fitur Pro lain sesuai ketersediaan data

Harga Rp99.000/bulan bisa dijadikan hipotesis awal karena selaras dengan konsep EzySaham yang pernah Anda rencanakan. Namun, harga ini baru layak dipertahankan jika biaya data, AI, penyimpanan, dan operasional per pengguna masih memungkinkan margin yang sehat.

## 3. Fitur mana yang gratis dan berbayar?

| Fitur              | Free                             | Pro                            |
| ------------------ | -------------------------------- | ------------------------------ |
| Screener EOD       | Ya, kuota wajar                  | Kuota lebih besar              |
| BUY / WAIT / AVOID | Ya                               | Ya                             |
| HARD RISK GATE     | Ya                               | Ya                             |
| Trading plan dasar | Ya                               | Ya, fitur lanjutan             |
| AI analysis        | Kuota terbatas                   | Kuota tinggi                   |
| Data intraday      | Tidak                            | Jika sumber tersedia           |
| Broker summary     | Ringkasan terbatas jika tersedia | Lebih lengkap jika berlisensi  |
| Backtest           | Strategi atau periode terbatas   | Multi-saham dan fitur lanjutan |
| Alert              | Watchlist/manual                 | Otomatis, sesuai kuota         |
| Jurnal             | Catatan terbatas                 | Kuota lebih besar dan analitik |

Catatan penting: jangan menjanjikan data realtime, broker summary, atau foreign flow sebelum hak akses, frekuensi pembaruan, biaya, dan izin redistribusi datanya dipastikan.

## 4. Batas gratis yang tidak terasa menghukum

Hindari paywall yang muncul sebelum pengguna memahami manfaat produk. Berikan pengalaman nyata terlebih dahulu.

Contoh batas awal untuk eksperimen:

- Screener: 20–30 saham per pemindaian.
- AI: 3–5 analisis per hari.
- Jurnal: 20 catatan aktif.
- Backtest: satu saham dan periode terbatas.
- Alert otomatis: hanya tersedia di Pro.

Angka tersebut adalah usulan untuk eksperimen, bukan batas final. Ukur pemakaian aktual dan biaya sebelum menetapkannya.

Ketika kuota habis, hasil analisis yang sudah dibuat sebaiknya tetap dapat dilihat. Pengguna dapat menunggu kuota diperbarui atau meningkatkan paket untuk kebutuhan lebih besar.

## 5. Strategi konversi Free ke Pro

1. Tarik pengguna lewat Free. Berikan screener yang benar-benar berguna dan laporan keputusan yang mudah dipahami.
2. Tunjukkan manfaat Pro pada momen yang tepat. Misalnya ketika pengguna ingin membandingkan 50 saham sekaligus atau mengatur alert otomatis.
3. Jangan menyembunyikan risiko. Status AVOID, alasan kegagalan gate, dan peringatan data tidak valid tetap terlihat di Free.
4. Uji konversi secara bertahap. Ukur pengguna aktif, penggunaan fitur, konversi ke Pro, pembatalan langganan, dan biaya AI per pengguna.

## 6. Implementasi pada arsitektur EzySaham

Saya merekomendasikan tiga lapisan terpisah:

- Decision Engine: aturan analisis dan Risk Gate yang konsisten untuk semua paket.
- Entitlement / Plan Service: menentukan fitur, kuota, dan hak akses pengguna.
- Data Provider Service: mengelola akses data EOD, intraday, broker summary, dan sumber AI berdasarkan izin serta paket.

Dengan pemisahan ini, perubahan paket tidak mengubah logika keputusan saham. Preset juga tidak boleh melewati HARD RISK GATE hanya karena pengguna berlangganan Pro.

Prioritas MVP monetisasi: mulai dari AI berkuota, jurnal terbatas, dan analisis lanjutan. Tambahkan intraday serta broker summary setelah biaya dan lisensi data terverifikasi. Ini lebih terkendali dibanding membangun seluruh fitur premium sekaligus.