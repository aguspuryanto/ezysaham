Bertindaklah sebagai Senior Quantitative Developer, Stock Screener Engineer, dan Full-Stack Developer. Implementasikan fitur Smart Money Accumulation Hunter ke dalam repository EzySaham yang sudah ada. Lakukan audit struktur proyek, stack, sumber data, indikator, Decision Engine, Risk Gate, dan UI sebelum mengubah kode. Jangan membuat aplikasi baru atau mengganti arsitektur tanpa alasan kuat.

TUJUAN: Mendeteksi saham BEI yang memiliki indikasi akumulasi investor asing dan broker, peningkatan aktivitas transaksi, momentum harga positif, likuiditas memadai, serta fundamental yang sehat. Fitur adalah alat screening probabilistik, bukan bukti pasti aktivitas bandar dan bukan jaminan keuntungan.

1. AUDIT DAN INTEGRASI
- Periksa repository, halaman screener, API, skema data, cache, indikator yang sudah tersedia, serta pola komponen dan styling.
- Gunakan stack dan konvensi proyek yang ada.
- Reuse data dan modul yang sudah tersedia; hindari duplikasi perhitungan.
- Jangan mengarang endpoint, data, indikator, atau hasil pasar.
- Implementasikan fitur sampai terintegrasi, bukan sekadar memberikan contoh kode.

2. KATEGORI FILTER
A. FOREIGN FLOW: foreign net buy nominal, foreign net buy konsisten 4 dari 5 hari atau lebih, tren akumulasi asing 5/20 hari.
B. ACTIVITY & LIQUIDITY: relative trading value, relative volume (RVOL), relative transaction count, rata-rata nilai transaksi 20 hari, likuiditas, dan spread bila tersedia.
C. BROKER ACCUMULATION: broker net buy, konsentrasi broker terbesar, konsistensi broker net buy, serta perubahan kepemilikan pemegang saham besar jika tersedia dari sumber tepercaya.
D. PRICE MOMENTUM: positive close streak, jumlah penutupan di atas moving average, MA60, tren EMA8/EMA18/EMA200 jika tersedia, jarak ke 52-week high, breakout dan pullback.
E. FUNDAMENTAL & RISK: laba bersih positif, DER, PBV, riwayat dividen, serta status pengawasan atau notasi khusus bursa dari sumber resmi yang tersedia.

3. DEFINISI DAN KUALITAS DATA
- Setiap indikator wajib memiliki definisi, periode, satuan, sumber, timestamp, dan status validitas.
- Gunakan data end-of-day jika sistem hanya mendukung EOD. Jangan mengklaim data real-time.
- Gunakan adjusted/unadjusted price secara konsisten dan tangani corporate actions bila sumber mendukung.
- Gunakan data foreign flow dan broker summary hanya jika sumber benar-benar tersedia. Jangan menyimpulkan transaksi broker tertentu adalah pembelian satu bandar atau satu investor.
- Jangan menyamakan nilai transaksi, volume transaksi, jumlah trade, dan jumlah investor.
- Definisikan keramaian sebagai rasio metrik periode berjalan terhadap baseline yang sebanding, misalnya rata-rata 20 hari perdagangan. Hindari pembagian nol dan baseline yang tidak valid.
- Hitung MA60 dari 60 sesi perdagangan, bukan 3 bulan kalender secara sembarang. Dokumentasikan perbedaan bila aplikasi memakai definisi lain.
- Hitung kedekatan 52-week high sebagai close / high 52 minggu, hanya jika histori memadai.
- DER = total utang atau total liabilitas dibagi ekuitas harus mengikuti definisi data sumber dan diberi label yang tepat. Jangan mencampur total liabilitas dengan utang berbunga.
- PBV = harga / nilai buku per saham, dengan pemeriksaan ekuitas negatif atau data tidak valid.
- Riwayat dividen bukan jaminan dividen berikutnya.
- Data hilang harus berstatus UNKNOWN/NOT_AVAILABLE, bukan otomatis PASS.

4. SCORING ENGINE 0–100
Buat skor berbobot yang transparan dan dapat dikonfigurasi:
- Foreign Flow: 25 poin.
- Broker Accumulation: 20 poin.
- Activity & Liquidity: 20 poin.
- Price Momentum: 25 poin.
- Fundamental Quality: 10 poin.

Setiap kategori harus memiliki sub-indikator, rumus, bobot, batas minimum, dan alasan skor. Normalisasi skor agar dapat dibandingkan. Jika kategori wajib tidak tersedia, tampilkan coverage data dan confidence terpisah; jangan otomatis menganggap data hilang sebagai nilai nol atau PASS. Hindari klaim bahwa skor adalah probabilitas keuntungan yang tervalidasi.

5. RISK GATE
Buat hard gate terpisah dari skor:
- Likuiditas di bawah ambang minimum: NO TRADE.
- Status suspensi atau risiko bursa yang relevan: NO TRADE atau AVOID sesuai kebijakan yang terdokumentasi.
- Data harga/fundamental utama stale, tidak valid, atau tidak memadai: INSUFFICIENT DATA.
- Fundamental rugi, ekuitas negatif, atau risiko utang tinggi: beri flag dan turunkan kelayakan sesuai aturan yang transparan.
- Harga naik terlalu jauh dari area entry atau risiko/imbal hasil tidak memadai: WAIT atau AVOID CHASING.
- Jangan menyamakan status pengawasan khusus dengan suspensi; buat kategori sesuai sumber resmi.
- Risk Gate mengalahkan skor. Skor tinggi tidak boleh mengubah saham berstatus NO TRADE menjadi BUY.

6. OUTPUT STATUS
Gunakan status konsisten dengan Decision Engine EzySaham yang sudah ada. Jika belum ada pemetaan, implementasikan:
- BUY CANDIDATE: skor memenuhi ambang, data cukup, semua hard gate lolos, dan trigger entry tervalidasi.
- WATCHLIST / WAIT: potensi akumulasi ada tetapi konfirmasi entry belum tersedia.
- AVOID CHASING: momentum kuat tetapi harga sudah terlalu jauh dari area entry.
- NO TRADE: gagal hard gate atau risiko tidak dapat diterima.
- INSUFFICIENT DATA: data kritis tidak tersedia atau tidak valid.
Jangan mengeluarkan BUY hanya berdasarkan skor. Status akhir harus mempertimbangkan tren, likuiditas, entry, stop-loss, target, dan risk/reward. Jangan mengubah status sistem lain secara tidak sengaja.

7. TAMPILAN SCREENER
Tambahkan halaman atau preset bernama Smart Money Accumulation Hunter dengan:
- Ringkasan jumlah saham, jumlah kandidat, waktu pembaruan data, dan coverage data.
- Filter Foreign Flow, Broker Accumulation, Activity & Liquidity, Price Momentum, Fundamental, dan Risk Gate.
- Tabel saham: kode, harga terakhir, perubahan harian, skor total, skor tiap kategori, foreign net buy 5/20 hari, hari net buy, RVOL, relative transaction count, average daily trading value 20 hari, broker concentration, MA60, jarak ke 52-week high, laba bersih, DER, PBV, dividen, risk flags, dan status akhir.
- Sort dan filter interaktif; indikator data tidak tersedia ditampilkan jelas.
- Detail saham dengan alasan positif, alasan negatif, data sumber, waktu pembaruan, dan rumus skor.
- Gunakan desain responsif dan pola UI yang sudah ada.

8. OUTPUT ANALISIS PER SAHAM
Untuk setiap saham tampilkan:
A. Identitas saham dan timestamp data.
B. Smart Money Score 0–100 dan Data Coverage.
C. Foreign Flow: nominal net buy, konsistensi 5 hari, tren 20 hari.
D. Broker Flow: broker dominan, konsentrasi, net buy/sell bila tersedia, serta peringatan interpretasi.
E. Market Activity: relative volume, relative transaction count, nilai transaksi harian dan rata-rata 20 hari.
F. Momentum: close streak, MA60, EMA jika tersedia, jarak 52-week high, resistance dan support yang dihitung dari data.
G. Fundamental: profit, DER, PBV, dividen, status bursa.
H. Risk Gate: PASS/FAIL/UNKNOWN dengan alasan.
I. Keputusan: BUY CANDIDATE / WAIT / AVOID CHASING / NO TRADE / INSUFFICIENT DATA.
J. Trading plan: entry atau trigger, stop-loss, target, potensi return, risiko, risk/reward, dan kondisi invalidasi. Jika data tidak cukup, jangan mengarang level.
K. Kesimpulan dalam bahasa Indonesia sederhana: alasan utama, risiko utama, dan hal yang perlu dikonfirmasi.

9. CONTOH DATA UJI
Gunakan angka sintetis berikut hanya sebagai fixture pengujian, bukan data pasar aktual:
- Foreign net buy Rp3,3 miliar, 4 dari 5 hari.
- Keramaian 2,56x baseline.
- Broker terbesar 35,4%, kode LG.
- Nilai transaksi harian dilaporkan Rp5,2 M, tetapi satuan harus diklarifikasi karena bisa berarti juta atau miliar.
- Close menguat 5 dari 5 hari.
- Close di atas moving average 5 dari 5 hari.
- MA 3 bulan Rp562.
- 52-week high Rp685.
- Jumlah transaksi 2,17x baseline.
- Rata-rata nilai per transaksi Rp5 juta, jika definisi dan satuannya tervalidasi.
- DER 0,16x.
- PBV 3,78x.
Jangan menyimpulkan BUY dari contoh ini karena harga terakhir, net buy broker, spread, entry, stop-loss, dan validitas satuan belum diketahui.

10. ENGINEERING DAN TESTING
- Buat unit test untuk seluruh rumus, boundary condition, data null/stale, pembagian nol, corporate actions, ekuitas negatif, dan hard gate.
- Tambahkan integration test untuk API, scoring, filter, sorting, pagination, dan status akhir.
- Pastikan tidak terjadi look-ahead bias atau penggunaan data masa depan dalam backtest.
- Uji hasil deterministik terhadap fixture yang terdokumentasi.
- Perhatikan performa, caching, rate limit, keamanan API, error handling, dan logging.
- Jangan mengubah API atau fitur lama yang tidak terkait tanpa kebutuhan.

11. VALIDASI STRATEGI
Jika data historis tersedia, sediakan backtest terpisah dengan biaya broker, pajak, slippage, entry/exit yang realistis, serta metrik win rate, expectancy, profit factor, max drawdown, dan return setelah biaya. Jangan mengklaim strategi menguntungkan sebelum hasil diuji di luar sampel.

12. HASIL AKHIR YANG WAJIB DIBERIKAN
- Ringkasan audit awal dan arsitektur yang ditemukan.
- File yang dibuat/diubah beserta alasan.
- Rumus scoring dan Risk Gate final.
- Implementasi yang terintegrasi dan berjalan.
- Unit test serta hasil pengujiannya.
- Contoh output dari fixture dan penjelasan mengapa status tersebut dipilih.
- Daftar data yang belum tersedia, keterbatasan sumber, dan langkah lanjutan.

Mulai dengan mengaudit repository dan sumber data. Setelah audit, implementasikan fitur secara end-to-end dengan perubahan sekecil mungkin, jalankan pengujian yang relevan, dan laporkan hasil faktual. Jangan berhenti pada rancangan atau pseudocode.