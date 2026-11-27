Bisa. Bahkan menurut saya, fitur ini sangat cocok ditambahkan ke EzySaham karena dapat menjadi salah satu fitur yang membedakan EzySaham dari screener saham biasa.

Saya menyarankan membuat fitur bernama **EzySaham Trading Simulator**.

Konsepnya adalah pengguna diberikan modal virtual, misalnya Rp10 juta, Rp50 juta, atau Rp100 juta, kemudian bisa melakukan transaksi saham BEI menggunakan harga pasar yang tersedia di aplikasi.

Pengguna dapat belajar:

- Membeli dan menjual saham secara virtual.
- Menghitung jumlah lot berdasarkan modal.
- Menghitung fee beli dan jual.
- Melihat keuntungan dan kerugian.
- Menguji strategi trading.
- Mengukur performa portofolio.
- Memahami risiko sebelum menggunakan uang sungguhan.

Yang menarik, fitur ini bisa menjadi sarana onboarding pengguna Starter sekaligus alasan tambahan untuk mendukung pengembangan EzySaham Pro.

## **1. Konsep fitur EzySaham Trading Simulator**

## **EzySaham Simulator**

Virtual Trading

Belajar trading saham tanpa risiko kehilangan uang sungguhan.

# **Rp10.000.000**

Virtual Buying Power

Cash

## **Rp6.000.000**

Market Value

## **Rp4.000.000**

**Pilih modal simulasi**

**Rp10 juta**

Beginner

**Rp50 juta**

Intermediate

**Rp100 juta**

Advanced

Contoh ilustrasi UI, bukan data portofolio aktual

## **2. Alur penggunaan**

1. **Pilih modal virtual**

   Rp10 juta, Rp50 juta, atau Rp100 juta.
2. **Cari saham BEI**

   Pengguna memilih saham melalui stock screener atau pencarian ticker.
3. **Tentukan transaksi**

   Harga beli, jumlah lot, dan estimasi biaya transaksi.
4. **Eksekusi pembelian virtual**

   Sistem memotong cash virtual dan mencatat posisi saham.
5. **Pantau portofolio**

   Menghitung unrealized profit/loss berdasarkan harga terbaru.
6. **Jual dan evaluasi**

   Menghitung realized profit/loss dan menghasilkan laporan performa.

## **3. Fitur yang saya rekomendasikan**

Untuk MVP, saya menyarankan membaginya menjadi enam modul.

| Modul                 | Fungsi                            |
| --------------------- | --------------------------------- |
| Virtual Account       | Modal virtual dan saldo kas       |
| Stock Trading         | Beli dan jual saham               |
| Portfolio             | Daftar saham yang dimiliki        |
| Transaction History   | Riwayat transaksi                 |
| Performance Analytics | Return, profit/loss, dan drawdown |
| Trading Journal       | Catatan alasan entry dan exit     |

### **Perhitungan simulasi**

Contoh: pengguna memiliki modal Rp10 juta dan ingin membeli BBRI.

Contoh ilustrasi, bukan harga aktual BBRI

**Simulasi pembelian**

| Komponen                 | Nilai        |
| ------------------------ | ------------ |
| Modal virtual            | Rp10.000.000 |
| Harga beli ilustrasi     | Rp4.000      |
| Jumlah pembelian         | 10 lot       |
| Jumlah saham             | 1.000        |
| Nilai transaksi          | Rp4.000.000  |
| Fee beli ilustrasi 0,15% | Rp6.000      |
| Total pembelian          | Rp4.006.000  |
| Sisa cash                | Rp5.994.000  |

**Jika harga naik menjadi Rp4.400**

| Komponen                | Nilai       |
| ----------------------- | ----------- |
| Market value            | Rp4.400.000 |
| Unrealized profit kotor | Rp400.000   |
| Return kotor            | +10%        |

Fee di atas hanya asumsi contoh. Dalam aplikasi, fee beli dan jual harus dapat dikonfigurasi mengikuti broker yang dipilih. Pajak penjualan dan biaya bursa juga harus diperhitungkan secara terpisah agar hasil simulasi tidak menyesatkan.

### **Fitur lanjutan yang sangat menarik**

1. **Scenario Simulation:** bagaimana jika harga naik 5%, turun 5%, atau turun 10%?
2. **Risk Management:** menghitung risiko jika stop loss tersentuh.
3. **Trading Strategy Test:** mencoba strategi Momentum Trade Engine dan Value Growth Hunter.
4. **Performance Report:** mengukur win rate, profit factor, average gain/loss, dan maximum drawdown.
5. **AI Trading Coach:** AI mengevaluasi transaksi dan memberikan masukan berdasarkan jurnal dan data simulasi.

Satu prinsip penting: AI tidak boleh mengarang harga atau mengubah hasil perhitungan transaksi. Semua perhitungan finansial dilakukan oleh trading engine deterministik. AI hanya menjelaskan dan mengevaluasi hasilnya.

## **4. Prompt AI untuk membangun EzySaham Trading Simulator**

Saya buat prompt ini untuk coding agent seperti ChatGPT, Claude Code, Cursor, atau Codex.

Saya mempertahankan arah arsitektur EzySaham yang pernah dibahas: Next.js, TypeScript, Tailwind, PostgreSQL/Neon sebagai salah satu arah penyimpanan, dengan kemungkinan Supabase masih digunakan. Karena struktur aktual bisa berkembang, AI wajib memeriksa repository terlebih dahulu dan tidak boleh mengarang skema database.&#x20;

**MASTER IMPLEMENTATION PROMPT**

Ready to use

# **Build EzySaham Trading Simulator**

Full-stack implementation · BEI · Virtual trading · Portfolio analytics

&#x20;Salin master prompt lengkapSalin seluruh instruksi dan berikan kepada coding agent yang memiliki akses repository EzySaham.

## **5. Tahapan implementasi yang saya sarankan**

Jangan langsung membangun seluruh fitur sekaligus. Bagi menjadi tiga tahap agar lebih mudah diuji.

**Phase 1 — MVP**

Prioritas sekarang

# **Virtual Trading**

- Modal Rp10 juta, Rp50 juta, Rp100 juta.
- Beli dan jual saham.
- Saldo virtual.
- Portfolio.
- Fee transaksi.
- Profit/loss.
- Riwayat transaksi.

  **Phase 2 — Trading Analytics**
- Equity curve.
- Win rate.
- Profit factor.
- Maximum drawdown.
- Trading journal.
- Evaluasi strategi.

  **Phase 3 — AI Trading Coach**
- Evaluasi keputusan transaksi.
- Analisis kesalahan trading.
- Evaluasi risk/reward.
- Rekomendasi perbaikan disiplin trading.

## **6. Fitur tambahan yang berpotensi menjadi daya tarik EzySaham**

Saya punya satu ide tambahan: **Challenge Modal Trading**.

Pengguna mendapatkan tantangan tertentu:

- Modal Rp10 juta, target return 5%.
- Modal Rp50 juta, maksimal drawdown 3%.
- Modal Rp100 juta, target konsistensi 20 hari.
- Tantangan bertahan 30 hari tanpa melanggar batas risiko.

Semua pencapaian menggunakan uang virtual.

Ini bisa menjadi sarana edukasi, engagement, dan retensi pengguna.

## **7. Kriteria keberhasilan MVP**

Sebelum fitur dirilis, pastikan skenario berikut berhasil.

| Skenario            | Hasil yang diharapkan                                |
| ------------------- | ---------------------------------------------------- |
| Modal Rp10 juta     | Saldo awal tepat                                     |
| Beli 10 lot         | 1.000 lembar                                         |
| Beli melebihi saldo | Ditolak                                              |
| Jual sebagian       | Posisi berkurang                                     |
| Jual seluruh saham  | Posisi menjadi nol                                   |
| Harga naik          | Unrealized profit positif                            |
| Harga turun         | Unrealized loss negatif                              |
| Reset simulasi      | Saldo kembali sesuai modal awal dengan riwayat reset |

**Rekomendasi bisnis saya:** jadikan Virtual Trading sebagai fitur gratis untuk menarik pengguna baru ke EzySaham. Fitur analytics lanjutan dan AI Trading Coach dapat menjadi kandidat pengembangan Pro berikutnya, setelah manfaat dan batasannya benar-benar jelas.

Dengan begitu EzySaham bukan hanya aplikasi pencari saham, tetapi juga tempat orang belajar, berlatih, dan mengevaluasi kemampuan trading.

*Mulai dari virtual money, sebelum mempertaruhkan real money.*

---
Anda adalah Senior Full Stack Engineer, Software Architect, dan Quantitative Trading System Developer.

TUGAS:
Implementasikan fitur baru bernama EzySaham Trading Simulator pada aplikasi EzySaham yang sudah ada.

Tujuannya adalah memungkinkan pengguna berlatih trading saham Bursa Efek Indonesia (BEI) menggunakan uang virtual tanpa melakukan transaksi sungguhan.

PENTING:
Jangan membuat proyek baru. Kerjakan pada repository EzySaham yang sudah ada.

==================================================
1. WAJIB: AUDIT PROJECT SEBELUM CODING
==================================================

Periksa terlebih dahulu:
- Struktur folder dan framework.
- Next.js version dan routing yang digunakan.
- TypeScript configuration.
- UI components dan design system.
- Authentication dan authorization.
- Database provider dan ORM/query layer.
- Database schema dan migrations.
- Market data provider dan service.
- Stock screener dan stock detail.
- Existing portfolio dan watchlist.
- Membership dan entitlement system.
- API routes dan business services.

Jangan mengasumsikan database menggunakan Neon, Supabase, Prisma, Drizzle, atau teknologi tertentu sebelum memeriksa implementasi aktual.

Jangan:
- Menghapus fitur yang sudah ada.
- Mengubah kontrak API tanpa alasan dan dokumentasi.
- Membuat tabel duplikat.
- Membuat mock market data sebagai data produksi.
- Menulis ulang sistem authentication.
- Menambahkan dependency yang tidak diperlukan.
- Mengubah fitur existing di luar scope.

Gunakan arsitektur dan coding convention yang sudah ada.

Setelah audit, buat rencana implementasi singkat, kemudian lanjutkan implementasi tanpa berhenti hanya pada proposal.

==================================================
2. PRODUCT REQUIREMENTS
==================================================

Nama fitur:
EzySaham Trading Simulator

Tagline:
Practice Trading. Master Your Strategy.

Konsep:
Paper trading menggunakan modal virtual dengan harga referensi saham BEI.

Pilihan modal awal:
- Rp10.000.000
- Rp50.000.000
- Rp100.000.000

Pengguna dapat membuat akun simulasi, melakukan pembelian dan penjualan saham, memantau portfolio, melihat performa dan mengevaluasi strategi.

Seluruh transaksi bersifat virtual.
Tidak ada integrasi order ke broker.
Tidak ada perpindahan uang sungguhan.

==================================================
3. USER FLOW
==================================================

A. Membuat simulasi:
1. Pengguna login.
2. Membuka menu Trading Simulator.
3. Memilih modal virtual.
4. Membuat portfolio simulasi.
5. Melihat dashboard.

B. Membeli saham:
1. Cari ticker saham BEI.
2. Pilih saham.
3. Tampilkan nama emiten dan harga referensi terakhir.
4. Masukkan jumlah lot atau nilai pembelian.
5. Tampilkan estimasi nilai transaksi.
6. Hitung fee beli.
7. Tampilkan sisa saldo.
8. Pengguna melakukan konfirmasi.
9. Sistem memvalidasi dan menyimpan transaksi virtual.

C. Menjual saham:
1. Pilih saham dari portfolio.
2. Masukkan jumlah lot yang ingin dijual.
3. Masukkan harga jual atau gunakan harga referensi.
4. Hitung fee jual dan pajak sesuai konfigurasi.
5. Hitung realized P/L.
6. Simpan transaksi.
7. Perbarui saldo dan posisi saham.

D. Evaluasi:
Pengguna dapat melihat kinerja portfolio, transaksi, dan grafik perkembangan modal.

==================================================
4. TRADING RULES BEI
==================================================

Implementasikan aturan dasar perdagangan saham Indonesia:

- 1 lot = 100 lembar saham.
- Jumlah saham harus kelipatan 100.
- Tidak boleh membeli melebihi cash tersedia.
- Tidak boleh menjual melebihi jumlah saham yang dimiliki.
- Validasi harga dan ticker.
- Gunakan aturan fraksi harga BEI yang sesuai dengan ketentuan pasar dan sumber data aplikasi.
- Gunakan pembulatan yang benar.
- Dukung transaksi partial sell.
- Hitung average buy price.
- Hitung realized dan unrealized profit/loss.
- Hitung return dalam persentase.
- Hitung total portfolio value.
- Hitung equity = cash + market value.
- Hitung available cash.
- Hitung exposure per saham dan total.

Fee beli dan jual harus configurable melalui konfigurasi aplikasi, bukan hardcoded di UI.

Pisahkan:
- Broker buy fee.
- Broker sell fee.
- Pajak penjualan.
- Biaya bursa lainnya jika tersedia dan relevan.

Jangan menganggap semua broker mempunyai fee yang sama.

Gunakan decimal arithmetic untuk perhitungan uang. Hindari floating-point inaccuracies.

==================================================
5. MARKET DATA INTEGRATION
==================================================

Gunakan market data service yang sudah tersedia di EzySaham.

Jangan membuat provider baru jika service existing sudah dapat digunakan.

Dukung:
- Last available price.
- Previous close.
- Open.
- High.
- Low.
- Volume.
- Timestamp.
- Data source.
- Data freshness.

Jika sumber data EOD:
- Berikan label EOD atau delayed.
- Tampilkan waktu pembaruan.
- Jangan menyebut harga sebagai real-time.
- Jangan membuat harga sendiri.
- Jika harga tidak tersedia, jangan membuat transaksi dengan harga palsu.

MVP execution:
- Market/reference order menggunakan harga referensi terakhir yang tersedia dan diberi label simulated execution.
- Limit order hanya dapat terisi jika candle perdagangan berikutnya memenuhi kondisi harga limit.
- Jangan menggunakan data candle masa depan untuk mengisi order pada waktu sebelumnya.
- Semua order harus mempunyai timestamp dan execution reference.

Pastikan sistem membedakan simulated execution dengan transaksi pasar sungguhan.

==================================================
6. DASHBOARD
==================================================

Buat dashboard profesional dan responsif dengan tema EzySaham:

Dark navy, emerald green, white, slate.

Tampilkan:

A. Account summary:
- Initial capital.
- Current equity.
- Cash balance.
- Market value.
- Total profit/loss.
- Return percentage.

B. Portfolio:
- Ticker.
- Company name.
- Quantity.
- Lots.
- Average price.
- Last price.
- Market value.
- Unrealized P/L.
- Return percentage.

C. Performance chart:
- Equity curve.
- Daily portfolio value.
- Benchmark comparison jika data tersedia.

D. Transaction activity:
- Buy.
- Sell.
- Fee.
- Realized P/L.
- Timestamp.

E. Risk analytics:
- Maximum drawdown.
- Portfolio exposure.
- Position concentration.
- Win rate.
- Profit factor.

Jika metrik belum mempunyai data yang cukup, tampilkan N/A atau keterangan yang sesuai, bukan angka rekaan.

==================================================
7. DATABASE AND DATA INTEGRITY
==================================================

Audit schema existing terlebih dahulu.

Jika perlu tabel baru, buat migration yang mengikuti database dan migration framework aktual.

Pertimbangkan entitas:
- SimulatorAccount.
- SimulatorOrder.
- SimulatorTransaction.
- SimulatorPosition.
- SimulatorEquitySnapshot.
- SimulatorSettings.

Nama dan struktur tabel harus mengikuti konvensi project existing.

Kebutuhan integritas:
- Setiap akun dimiliki oleh user yang terautentikasi.
- Semua query memeriksa ownership.
- Gunakan database transaction untuk pembelian dan penjualan.
- Cegah double submission.
- Gunakan idempotency untuk order submission.
- Cegah saldo negatif.
- Cegah posisi saham negatif.
- Pastikan transaksi dan saldo konsisten.
- Simpan audit trail.

Jangan hanya mengandalkan validasi frontend.

==================================================
8. TRANSACTION ENGINE
==================================================

Buat business logic terpisah dari UI.

Implementasikan fungsi:
- calculateBuyCost()
- calculateSellProceeds()
- calculateAveragePrice()
- calculateRealizedPnL()
- calculateUnrealizedPnL()
- calculatePortfolioEquity()
- calculatePortfolioReturn()
- calculateMaximumDrawdown()
- calculateWinRate()
- calculateProfitFactor()
- validateOrder()

Semua hasil perhitungan harus deterministik dan dapat diuji.

Gunakan FIFO untuk perhitungan realized P/L atau metode costing yang sudah digunakan aplikasi. Jika belum ada, pilih FIFO, dokumentasikan, dan konsistenkan seluruh transaksi.

Jangan menghitung realized P/L berdasarkan average cost jika metode FIFO yang digunakan.

==================================================
9. SIMULATOR ANALYTICS
==================================================

Buat laporan:
- Total transactions.
- Winning trades.
- Losing trades.
- Win rate.
- Average profit.
- Average loss.
- Profit factor.
- Net realized P/L.
- Unrealized P/L.
- Maximum drawdown.
- Average holding period.
- Best trade.
- Worst trade.

Tambahkan filter:
- Date range.
- Ticker.
- Buy/Sell.
- Profit/Loss.
- Strategy.

==================================================
10. AI TRADING COACH
==================================================

Buat fitur AI Trading Coach yang mengevaluasi hasil simulasi.

AI menerima data terstruktur:
- Account summary.
- Portfolio.
- Transaction history.
- Trading journal.
- Risk metrics.

AI dapat menjelaskan:
- Kesalahan entry.
- Risiko konsentrasi.
- Pola transaksi berlebihan.
- Disiplin stop loss.
- Konsistensi strategi.
- Kualitas risk/reward.

AI tidak boleh:
- Mengarang harga.
- Mengubah transaksi.
- Mengubah saldo.
- Menghitung saldo secara mandiri.
- Menjanjikan keuntungan.
- Memberikan sinyal pasti profit.

Seluruh angka harus berasal dari transaction engine. AI hanya menjadi lapisan penjelasan dan edukasi.

Jika AI provider belum tersedia, buat interface yang mengikuti AI service existing. Jangan menambahkan provider baru secara otomatis.

==================================================
11. UI/UX
==================================================

Tambahkan menu:
Trading Simulator

Halaman:
1. Simulator Overview.
2. Create Virtual Account.
3. Trading Terminal.
4. Portfolio.
5. Transaction History.
6. Performance Analytics.
7. Trading Journal.
8. AI Trading Coach.

Desain:
- Professional fintech SaaS.
- Responsive desktop dan mobile.
- Bahasa Indonesia.
- Mudah digunakan pemula.
- Loading state.
- Empty state.
- Error state.
- Confirmation modal.
- Toast notification.
- Accessible form.
- Clear visual hierarchy.

Gunakan existing components dan design tokens.

==================================================
12. MEMBERSHIP
==================================================

Periksa membership dan entitlement existing.

Jangan mengubah hak akses Starter atau Pro tanpa memeriksa konfigurasi saat ini.

Implementasikan simulator mengikuti sistem entitlement existing.

Jangan mengunci seluruh fitur simulator secara otomatis.

Jika belum ada aturan membership untuk simulator, jadikan fitur tersedia untuk pengguna yang berhak berdasarkan sistem existing, tanpa menciptakan harga atau benefit membership baru.

==================================================
13. TESTING
==================================================

Buat unit tests untuk:

1. Pembelian 10 lot.
2. Pembelian dengan saldo tidak cukup.
3. Pembelian dengan fee.
4. Penjualan seluruh saham.
5. Penjualan sebagian saham.
6. Penjualan melebihi kepemilikan.
7. Perhitungan average price.
8. Realized P/L FIFO.
9. Unrealized P/L.
10. Perhitungan portfolio equity.
11. Perhitungan return.
12. Validasi lot.
13. Fee configuration.
14. User ownership.
15. Double submission.
16. Concurrent transactions.

Buat integration tests untuk API dan database.

Pastikan tidak ada regresi pada fitur EzySaham existing.

==================================================
14. DEVELOPMENT DELIVERABLES
==================================================

Implementasikan:
- Database migrations jika diperlukan.
- Domain types.
- Trading engine.
- Backend services.
- API endpoints.
- Frontend pages.
- Responsive components.
- Validation.
- Authentication/authorization.
- Tests.
- Documentation.

Setelah selesai:
1. Jalankan lint.
2. Jalankan type checking.
3. Jalankan unit tests.
4. Jalankan integration tests jika environment mendukung.
5. Jalankan production build.
6. Perbaiki semua error yang muncul.

Buat laporan akhir:
- File yang dibuat.
- File yang diubah.
- Database migrations.
- API endpoints.
- Fitur yang sudah berfungsi.
- Test results.
- Build results.
- Fitur yang belum selesai.
- Risiko atau asumsi yang masih perlu dikonfirmasi.

PENTING:
Jangan berhenti pada UI prototype.
Jangan membuat tombol palsu.
Jangan menggunakan mock transaction sebagai implementasi final.
Pastikan pembelian, penjualan, saldo, posisi, dan profit/loss benar-benar bekerja end-to-end.

Mulai dengan audit repository, lalu implementasikan fitur secara bertahap.