# Priorisasi Perbaikan Ezysaham untuk Investor Pemula — v2

> Hasil menjalankan "Prompt AI" di [UPDATE_FITUR.md](UPDATE_FITUR.md), disesuaikan dengan kondisi codebase branch `version4`.
> **v2 (25 Nov 2026):** menindaklanjuti review atas v1 (lihat Lampiran) dan memasukkan hasil validasi data langsung dari Pasardana.
> Tim: 1 frontend, 1 backend, 1 product/design part-time. Sprint = 2 minggu.

## 0. Kondisi saat ini

### 0.1 Koreksi terhadap temuan awal `UPDATE_FITUR.md`

| Temuan awal | Kondisi sebenarnya |
|---|---|
| "Belum ada watchlist / target profit" | Sudah ada: watchlist dengan catatan & target harga (Pro), portofolio, jual saham, dan riwayat untung/rugi terealisasi termasuk fee. |
| "Tab Dividen hanya menampilkan yield" | `payoutRatio` dan `dividendHistory` sudah diambil dari Yahoo dan payout tampil di halaman detail. Yang belum ada: **interpretasi dan peringatannya**. |
| "Belum ada panduan value trap" | `entrySignal.ts` sudah mengecek laba, ROE, margin, pertumbuhan, DER, dan current ratio. Yang belum ada: **framing "koreksi sementara atau value trap"**. |
| "Tidak ada filter gorengan" | **Benar.** Screener hanya memakai nilai transaksi min. Rp1 M dan harga ≥ Rp50. |
| "Momentum memicu FOMO" | **Benar.** Tidak ada konteks atau peringatan di tab Momentum/Gainer. |

### 0.2 Validasi data (dijalankan 25 Nov 2026, data per 24 Nov 2026, 834 saham aktif)

| Pertanyaan | Hasil | Dampak ke rencana |
|---|---|---|
| Cakupan `FreeFloatPct` | **830/834 terisi (99,5%)**, 0 null, 4 bernilai 0 | Free float bisa langsung dipakai di Sprint 1. Item filter risiko **tidak perlu dipecah** jadi versi dengan/tanpa free float. |
| Sebaran free float | Median 20%. Di bawah 15%: **283 saham (34%)**. Di bawah 10%: 150. Di bawah 7,5%: 30 | Ambang 15% di v1 terlalu agresif. **UNVR (14,07%) akan ikut tercap.** Ambang diturunkan ke < 10% dan free float hanya dihitung sebagai **satu** flag, tidak pernah cukup sendirian. |
| Blue-chip sebagai uji kewajaran | BBCA 42%, BBRI 41%, TLKM 39%, BMRI 37%, ASII 42%, ICBP 19% | Tidak ada yang tercap dengan aturan baru. |
| Kapitalisasi < Rp1 T | 405 saham (49%). Kapitalisasi < Rp1 T **dan** free float < 15%: 105 saham | Aturan "≥ 2 flag" penting agar label tidak menimpa separuh bursa. |
| `Capitalization`, `Value`, `Roe`, 52W high, `LastDate` | 0 null | Aman untuk dipakai. |
| `Per` | 12 null | Sudah ditangani (`peRatio == null`). |

> Validasi ini hanya mengukur **cakupan**, bukan **akurasi**. Akurasi free float Pasardana perlu dicocokkan dengan sumber resmi (KSEI/BEI) untuk sampel ±20 saham sebelum rilis.

### 0.3 Yang sudah ada dan tinggal diperluas

- **Disclaimer:** sudah ada di footer ("Bukan rekomendasi jual/beli"), EntrySignalCard, kartu teknikal, harga wajar, dan halaman berita.
- **Label verdict EntrySignal:** **"Layak beli"**, "Akumulasi bertahap", **"Hindari"**, "Mahal — tunggu koreksi". Label "Layak beli" dan "Hindari" adalah titik risiko regulasi yang paling nyata (lihat item #1).
- **Tooltip istilah:** 10 rasio di halaman detail sudah punya `hint` (PER, PBV, ROE, DER, net margin, current ratio, beta, free float, YoY). Tooltip **belum ada** di screener, tab dividen, dan portofolio. Halaman glosarium juga belum ada.
- **Timestamp data:** sudah ada di dashboard dan detail saham ("Data per …"). **Belum ada** di halaman screener.
- **Analytics:** belum ada.

## 1. Kerangka skor

- **Impact (1–5):** dampak pada keselamatan keputusan pemula dan tujuan profit 1 tahun.
- **Effort (1–5):** 1 = ≤2 hari, 2 = ≤1 minggu, 3 = 1–2 minggu, 4 = 3–4 minggu, 5 = >1 bulan.
- **Risiko jika ditunda (1–5):** kerugian pengguna, reputasi, atau regulasi jika item ini belum ada.
- **Skor prioritas = (Impact + Risiko) × (6 − Effort)**, maksimum 50.

> **Urutan skor ≠ urutan sprint.** Skor menunjukkan nilai sebuah item. Urutan sprint juga mempertimbangkan ketergantungan. Contohnya, event tracking (#7) dikerjakan di minggu pertama karena dibutuhkan untuk baseline, bukan karena skornya tertinggi.

## 2. Tabel prioritas

| # | Perbaikan | I | E | R | Skor | Estimasi | Grup | Baru di v2 |
|---|---|:-:|:-:|:-:|:-:|---|---|:-:|
| 1 | Bahasa label & disclaimer | 4 | 1 | 5 | **45** | 1–2 hari | Quick win | ✓ |
| 2 | Panduan & label anti-FOMO | 4 | 1 | 4 | **40** | 1–2 hari | Quick win | |
| 3 | Filter & label "Risiko tinggi" (dulu "Rawan gorengan") | 5 | 2 | 5 | **40** | 3–4 hari | Quick win | diubah |
| 4 | Peringatan dividend trap | 4 | 2 | 4 | **32** | 3–4 hari | Quick win | |
| 5 | Glosarium & tooltip istilah — **✅ selesai 25 Nov** | 4 | 2 | 3 | **28** | 2–3 hari | Quick win | ✓ |
| 6 | Checklist value trap di detail saham | 4 | 2 | 3 | **28** | 2–3 hari | Quick win | |
| 7 | Event tracking (fondasi metrik) | 2 | 1 | 3 | **25** | 1–2 hari | Quick win | |
| 8 | Target & batas tinjau per posisi portofolio | 4 | 2 | 2 | **24** | 4–5 hari | Prioritas utama | |
| 9 | Keandalan & kesegaran data | 3 | 3 | 4 | **21** | 1–2 minggu | Prioritas utama | ✓ |
| 10 | Cek kesehatan portofolio & panduan alokasi | 4 | 3 | 3 | **21** | 1–2 minggu | Prioritas utama | |
| 11 | Mode Pemula / onboarding 3 langkah | 3 | 3 | 2 | **15** | 1–2 minggu | Prioritas utama | |
| 12 | Arus kas bebas untuk cek dividen | 3 | 3 | 2 | **15** | ±1 minggu | Prioritas utama | |
| 13 | Notasi khusus, UMA, dan papan pemantauan BEI | 4 | 4 | 3 | **14** | 2–4 minggu | Lanjutan | |
| 14 | Alert email target/sinyal (fitur Pro "Segera") | 4 | 4 | 2 | **12** | 3–4 minggu | Lanjutan | |
| 15 | Track record screener (snapshot harian) | 3 | 4 | 1 | **8** | >1 bulan | Lanjutan | |

Jika skornya sama, item dengan effort atau ketergantungan lebih kecil diletakkan lebih dulu.

## 3. Detail per item

### Quick wins (≤1 minggu)

#### 1. Bahasa label & disclaimer
- **Masalah:** Label "Layak beli" dan "Hindari" di EntrySignal bisa dibaca sebagai rekomendasi. Label "gorengan" pada emiten tertentu bisa dibaca sebagai tuduhan. Ini risiko dengan konsekuensi terbesar, dan biayanya naik tajam kalau baru diperbaiki setelah kampanye promosi.
- **Solusi:**
  - Ganti label verdict menjadi deskripsi kondisi, bukan perintah. Contoh: "Layak beli" → "Diskon besar dari harga wajar"; "Hindari" → "Fundamental lemah"; "Akumulasi bertahap" → "Diskon moderat"; "Mahal — tunggu koreksi" → "Di atas harga wajar".
  - Semua label risiko di item #3, #4, dan #6 ditulis sebagai **fakta yang bisa dicek** ("Free float 8% · naik 70% dalam sebulan"), bukan vonis.
  - Halaman statis **"Cara membaca label di Ezysaham"** yang menjelaskan setiap label, rumusnya, dan batasannya. Semua badge menautkan ke halaman ini.
  - Komponen `Disclaimer` tunggal dipakai di setiap kartu yang menyimpulkan sesuatu, menggantikan teks yang sekarang tersebar.
- **Done:** Tidak ada lagi label berbentuk perintah beli/jual/hindari di UI (dicek dengan grep). Halaman label sudah live. Copy sudah direview oleh pihak yang paham ketentuan OJK **sebelum** kampanye promosi apa pun (gate).
- **Dependencies:** Reviewer copy (eksternal atau internal) harus ditentukan.

#### 2. Panduan & label anti-FOMO
- **Masalah:** Tab Momentum dan Gainer mendorong pemula mengejar saham yang sudah naik tinggi.
- **Solusi:**
  - Banner yang bisa ditutup di tab Momentum/Gainer: "Momentum harian bisa berbalik cepat. Cek fundamental dan jangan beli di puncak lonjakan."
  - Badge per baris **"Sudah naik tinggi"** jika salah satu terpenuhi: return 1 bulan > 25%, harga ≥ 95% dari 52W high, atau naik ≥ 15% hari ini. Badge disertai angkanya.
  - Di halaman detail, jika badge aktif, tampilkan "Cek sebelum beli" (3 poin) di atas EntrySignalCard.
- **Done:** Banner tampil di dua tab dan status tutupnya tersimpan per pengguna. Badge muncul sesuai aturan. Ambang ditaruh sebagai konstanta di `screener.ts`.
- **Dependencies:** Bahasa mengikuti item #1.

#### 3. Filter & label "Risiko tinggi"
- **Masalah:** Daftar Momentum/Gainer memuat small-cap dengan free float tipis yang mudah dimanipulasi.
- **Solusi:**
  - Fungsi `riskFlags(stock)` di `src/lib/` (dikerjakan BE) yang mengembalikan daftar alasan:
    - free float < 10%
    - kapitalisasi < Rp1 T
    - harga < Rp200
    - return 1 bulan > 50%
    - nilai transaksi tipis
    - beta ekstrem
  - Saham dengan **≥ 2 flag** diberi label **"Risiko tinggi"** beserta alasannya. Kata "gorengan" tidak dipakai di UI; konsepnya cukup dijelaskan di glosarium.
  - Toggle **"Sembunyikan risiko tinggi"**, ON secara default di tab Momentum, Gainer, dan Akumulasi.
  - Label yang sama tampil di halaman detail dan saat menambah saham ke portofolio atau watchlist. Saham tetap bisa dicari dan dibuka; filter hanya menyembunyikan dari daftar screener.
- **Done:**
  - Jumlah yang disembunyikan selalu terlihat ("12 saham disembunyikan karena risiko tinggi · **Tampilkan**").
  - **Empty state:** jika semua hasil tersaring (terutama di tab Akumulasi), tampilkan penjelasan dan tombol "Tampilkan", bukan tabel kosong.
  - **Degradasi anggun:** flag dihitung dari field yang tersedia. Jika `freeFloat` null/0, flag itu dilewati (tidak dianggap lolos atau gagal) dan alasan "data free float tidak tersedia" ditampilkan.
  - Uji kewajaran: 8 blue-chip di bagian 0.2 tidak ada yang tercap. Ada unit check untuk 5 kasus (blue-chip, small-cap likuid, saham tipis naik tajam, free float null, saham dengan semua flag).
- **Dependencies:** Item #1 (bahasa). Validasi akurasi free float dengan sampel (bagian 7).

#### 4. Peringatan dividend trap
- **Masalah:** Pemula membeli saham yield tinggi tanpa tahu dividennya tidak berkelanjutan, atau harganya jatuh setelah cum date.
- **Solusi:** Badge di tab Dividen (`DividendCard`) dan halaman detail:
  - **"Payout > 100%"**: dividen lebih besar dari laba.
  - **"Yield tidak wajar"**: yield > 10%.
  - **"Laba turun"**: `earningsGrowth` < 0.
  - **"Tidak konsisten"**: `dividendHistory` kurang dari 3 tahun berturut-turut.
  - **"Harga turun > yield"**: return 1 tahun < −yield.
- **Done:** Setiap saham di tab Dividen punya status Aman / Perlu dicek / Waspada beserta alasannya, dengan tautan ke glosarium "dividend trap".
- **Dependencies:** Kualitas data dividen Yahoo untuk saham IDX.

#### 5. Glosarium & tooltip istilah
- **Masalah:** Item #3, #4, dan #6 menampilkan kesimpulan di atas angka yang belum tentu dipahami pemula. Tooltip yang ada sekarang hanya ada di halaman detail.
- **Solusi:**
  - Pindahkan 10 `hint` yang sudah ada ke satu sumber (`src/lib/glossary.ts`). Tambahkan istilah: payout ratio, dividend yield, cum date, free float, kapitalisasi, margin of safety, harga wajar, value trap, dividend trap, saham gorengan, FOMO, ARA/ARB.
  - Komponen `TermTooltip` dipakai di header kolom screener, badge, kartu dividen, dan portofolio.
  - Halaman `/glosarium` dengan anchor per istilah, ditautkan dari setiap tooltip ("Selengkapnya").
- **Done:** Setiap istilah teknis di header tabel dan badge punya tooltip. Halaman glosarium live dan bisa diakses tanpa login.
- **Dependencies:** Tidak ada. Isi glosarium ditulis PD.
- **Status (25 Nov 2026): selesai.**
  - **Glosarium:** 31 istilah dalam 6 kategori di `src/lib/glossary.ts`.
  - **`TermTooltip`:** dipasang di header tabel screener, "Istilah terkait" per tab, rasio/dividen/harga wajar di halaman detail, margin of safety di EntrySignalCard, dan portofolio.
  - **Halaman `/glosarium`:** dilengkapi pencarian dan anchor per istilah.
  - **Akses:** menu Glosarium di sidebar desktop. Di mobile, aksesnya lewat kartu di halaman Tips.
  - **Saat item #3/#4/#6 dikerjakan:** setiap badge baru wajib memakai `TermTooltip` dan istilahnya ditambahkan ke `glossary.ts`.

#### 6. Checklist value trap di detail saham
- **Masalah:** Pemula tidak bisa membedakan koreksi sementara dari penurunan struktural.
- **Solusi:** Kartu "Koreksi sementara atau value trap?" yang muncul jika return 3 atau 6 bulan < −15%. Isinya menjawab empat pertanyaan:
  - Apakah laba turun?
  - Apakah pendapatan turun?
  - Apakah utang membengkak?
  - Apakah sektornya ikut turun?

  Kesimpulannya: **"Kemungkinan sentimen"**, **"Penurunan disertai laba turun"**, atau **"Data kurang"**.
- **Done:** Kartu hanya muncul jika syarat penurunan terpenuhi. Setiap poin bertanda lolos / perlu dicek / tidak lolos dan bertooltip glosarium.
- **Dependencies:** Item #1 dan #5.

#### 7. Event tracking (fondasi metrik)
- **Masalah:** Belum ada analytics, jadi keberhasilan item lain tidak bisa diukur.
- **Solusi:**
  - Tabel `ezysaham.events` di Supabase plus helper `track()`.
  - **Anonymous ID:** UUID acak di localStorage, tanpa data pribadi, sehingga pengguna yang belum login ikut terhitung. Saat login, ID ini ditautkan ke `user_id`.
  - Event: `screener_tab_view`, `risk_filter_toggle`, `risk_reason_open`, `fomo_banner_dismiss`, `dividend_warning_open`, `valuetrap_card_view`, `glossary_open`, `watchlist_add`, `portfolio_add` (dengan properti `risk_flags` dan `filter_on`).
  - Vercel Web Analytics bisa ditambahkan untuk pageview, tetapi tidak cukup untuk retensi per pengguna.
- **Done:** Event masuk ke Supabase. Ada baseline minimal 2 minggu **sebelum** paket "Lapisan Kepercayaan" dirilis. Kebijakan privasi menyebut pencatatan ini.
- **Dependencies:** Migrasi DB.

### Prioritas utama (1–4 minggu)

#### 8. Target & batas tinjau per posisi portofolio
- **Solusi:** Kolom target jual dan batas tinjau per posisi. Nilai default diambil dari `plan.target` dan `plan.reviewPrice` di EntrySignal. Ditambah indikator "Di sekitar target" / "Tembus batas tinjau".
- **Done:** Ada migrasi Supabase (schema `ezysaham`), nilai bisa diubah, indikator mengikuti harga live, dan juga bekerja untuk mode localStorage.
- **Dependencies:** Migrasi DB dan `usePortfolio`.

#### 9. Keandalan & kesegaran data
- **Masalah:** Pasardana dan Yahoo adalah endpoint tidak resmi dan menjadi ketergantungan terbesar produk. Jika sebuah field tiba-tiba kosong, filter risiko bisa diam-diam tidak menyaring apa pun tanpa ada yang tahu.
- **Solusi:**
  - **Timestamp di screener** ("Data per 24 Nov 2026, 16.00 WIB"), menyusul dashboard dan detail yang sudah punya. *Bagian ini masuk Sprint 1 karena effort-nya beberapa jam.*
  - **Health check** `getDataHealth(stocks)`: jumlah saham aktif, persentase null per field penting (`FreeFloatPct`, `Capitalization`, `Value`), dan umur `LastDate` dibanding hari bursa terakhir.
  - **Banner otomatis** jika data basi (lebih dari 1 hari bursa) atau field penting null di atas 20%: "Sebagian data tidak tersedia; label risiko mungkin tidak lengkap."
  - **Monitoring:** job terjadwal harian yang mencatat hasil health check dan mengirim notifikasi ke admin bila ambang terlampaui.
  - **Fallback:** sajikan snapshot terakhir yang valid (sudah dicache Next.js) dengan label "data tertunda", bukan error.
- **Done:** Timestamp tampil di semua halaman data. Banner muncul saat simulasi field null. Admin menerima notifikasi saat endpoint gagal.
- **Dependencies:** Vercel Schedules dan saluran notifikasi admin (bisa berbagi dengan item #14).

#### 10. Cek kesehatan portofolio & panduan alokasi
- **Solusi:** Kartu di halaman portofolio:
  - Jumlah emiten (saran 3–5)
  - Porsi terbesar per saham (peringatan > 30%)
  - Porsi per sektor (peringatan > 50%)
  - Porsi saham berlabel "Risiko tinggi"
  - Panduan singkat: blue-chip dulu, uang dingin, cicil bertahap
- **Sudah ada sebagian:** `PortfolioView` sudah menampilkan "Portofolio kurang terdiversifikasi" jika satu sektor melebihi 40% nilai portofolio (`SECTOR_LIMIT`). Item ini tinggal melengkapi cek lainnya, sehingga estimasinya bisa turun.
- **Done:** Status sehat / perlu perhatian dengan maksimal 3 saran konkret, tanpa API baru.
- **Dependencies:** Item #3 (`riskFlags`).

#### 11. Mode Pemula / onboarding 3 langkah
- **Solusi:** Onboarding singkat: tujuan, horizon, toleransi risiko. Hasilnya menentukan tab screener default dan perilaku filter risiko.
- **Done:** Profil tersimpan dan bisa diubah. Onboarding bisa dilewati.
- **Dependencies:** Item #2, #3, dan #7.

#### 12. Arus kas bebas untuk cek dividen
- **Solusi:** Perluas `fetchYahooFundamentals` dengan free cash flow dan hitung "FCF menutup dividen?".
- **Dependencies:** Ketersediaan FCF dari Yahoo untuk saham `.JK` (belum diverifikasi).

### Pengembangan lanjutan (>1 bulan)

#### 13. Notasi khusus, UMA, dan papan pemantauan BEI
- Ini sinyal risiko resmi yang paling kuat. Butuh sumber data pengumuman BEI; belum ada API resmi gratis yang diketahui, dan scraping berisiko dari sisi stabilitas dan ketentuan penggunaan. Perlu riset sumber dulu.

#### 14. Alert email target/sinyal
- Butuh penyedia email, Vercel Schedules, preferensi notifikasi, dan item #8.

#### 15. Track record screener
- Simpan snapshot hasil screener harian mulai bulan ke-2, karena data tidak bisa dikumpulkan mundur.

## 4. Strategi rilis: paket "Lapisan Kepercayaan"

Item #1–#6 hampir seluruhnya pekerjaan frontend, dan hanya ada 1 FE. Karena itu:

- **Logika dipisah dari UI.** `riskFlags`, `dividendFlags`, `valueTrapCheck`, glosarium, dan health check ditulis BE sebagai fungsi murni di `src/lib/`. FE hanya merender.
- **Dirilis sebagai satu paket di akhir minggu ke-4**, bukan empat rilis terpisah. Paket ini mencakup label & disclaimer, anti-FOMO, filter risiko tinggi, dividend trap, glosarium, dan value trap. Dengan begitu ada satu pengumuman, satu kampanye edukasi, dan satu titik perbandingan sebelum/sesudah yang bersih untuk metrik.
- **Tracking (#7) dan timestamp screener masuk produksi di minggu pertama**, terpisah dari paket, agar baseline terkumpul ≥ 2 minggu sebelum paket rilis.

Perkiraan beban FE untuk paket: ±10–11 hari kerja. Ini muat dalam 2 sprint tetapi ketat. Jika meleset, value trap (#6) bisa digeser ke Sprint 3 tanpa menahan paket.

## 5. Roadmap 30/60/90 hari

| Periode | Sprint | Fokus | Item |
|---|---|---|---|
| **Pra-Sprint** (2–3 hari) | — | Validasi yang tersisa | Cocokkan akurasi free float (±20 saham) dengan KSEI/BEI, cek kualitas data dividen Yahoo untuk 40 saham, tentukan reviewer copy OJK |
| **Hari 1–30** | Sprint 1 (mg 1–2) | Ukur & bangun fondasi | **Rilis langsung:** #7 tracking, timestamp screener (#9). **Dibangun:** #1 bahasa label, #3 `riskFlags` + filter, #2 anti-FOMO, #5 glosarium |
| | Sprint 2 (mg 3–4) | Lengkapi & rilis paket | #4 dividend trap, #6 value trap, review copy → **rilis paket "Lapisan Kepercayaan"** di akhir minggu ke-4 |
| **Hari 31–60** | Sprint 3 (mg 5–6) | Rencana keluar | #8 target/batas tinjau, #9 health check & banner |
| | Sprint 4 (mg 7–8) | Kesehatan portofolio & data | #10 cek kesehatan, #9 monitoring, #15 mulai simpan snapshot, evaluasi metrik 30 hari pasca-rilis |
| **Hari 61–90** | Sprint 5 (mg 9–10) | Personalisasi pemula | #11 Mode Pemula, #12 FCF |
| | Sprint 6 (mg 11–12) | Fitur Pro & riset data BEI | #14 alert email (MVP), riset sumber data #13 |

**Gate:** kampanye promosi berskala besar (lihat `ROADMAP.md`) baru dijalankan setelah paket "Lapisan Kepercayaan" rilis dan copy-nya lolos review.

## 6. Pembagian kerja (indikatif)

- **Frontend:** banner, badge, toggle + empty state, `TermTooltip`, halaman glosarium & cara membaca label, kartu dividen/value trap, kartu kesehatan portofolio, onboarding.
- **Backend:** `riskFlags`, `dividendFlags`, `valueTrapCheck`, `getDataHealth` (fungsi murni + unit check), tabel events, migrasi portofolio, job monitoring, snapshot harian, FCF, alert.
- **Product/design:** copy label & disclaimer, isi glosarium, ambang batas, koordinasi review OJK, definisi event, evaluasi metrik per 30 hari.

## 7. Metrik keberhasilan

1. **Paparan saham berisiko pada keputusan nyata, dibagi dua kohort.** Persentase saham baru di portofolio/watchlist yang berlabel "Risiko tinggi" atau "Sudah naik tinggi" saat ditambahkan, dipisah antara:
   - **(a) filter ON:** pengguna yang tetap memakai filter. Angka ini turun terutama karena sahamnya tidak terlihat, jadi yang diukur adalah **UI**.
   - **(b) filter OFF atau masuk lewat pencarian/detail:** pengguna yang **melihat** label lalu tetap memutuskan. Ini yang mengukur **perilaku**. Jika angka `risk_flags` di kohort (b) tidak turun dibanding baseline, edukasinya belum bekerja.
2. **Penggunaan pagar pengaman.** Persentase sesi Momentum/Gainer yang tetap menyalakan filter, rasio pembukaan "kenapa disaring?", tooltip glosarium, dan kartu dividend/value trap per sesi. *Jika banyak yang mematikan filter, mungkin ambangnya terlalu ketat atau penjelasannya kurang meyakinkan.*
3. **Retensi watchlist/portofolio D7 dan D30**, dihitung per anonymous ID (item #7), sehingga **pengguna yang belum login ikut terhitung**. Laporkan terpisah untuk pengguna login dan anonim. Batasan: anonymous ID hilang jika localStorage dihapus atau pengguna ganti perangkat, sehingga retensi anonim cenderung tercatat lebih rendah dari aslinya.

> Profit 1 tahun pengguna **tidak bisa diukur jujur dalam 90 hari**. Metrik #1 dan #3 adalah indikator awalnya. Setelah item #15 berjalan, tambahkan "kinerja 12 bulan pilihan screener vs IHSG".

## 8. Asumsi & data yang perlu divalidasi

**Data**
- ~~Cakupan `FreeFloatPct`~~ **Sudah divalidasi: 99,5%** (bagian 0.2). Yang tersisa: **akurasi** nilainya dibanding KSEI/BEI.
- **Kualitas data Yahoo untuk IDX:** payout ratio, riwayat dividen, earnings/revenue growth, dan FCF belum diverifikasi. Dijadwalkan di Pra-Sprint.
- **Ambang batas** adalah heuristik, bukan standar resmi BEI. Free float < 10% sudah dikalibrasi terhadap sebaran data. Ambang lain perlu diuji dengan sampel saham.
- **Pasardana dan Yahoo adalah endpoint tidak resmi.** Mitigasinya ada di item #9, bukan sekadar dicatat sebagai asumsi.

**Pengguna**
- Belum ada data traffic, konversi, atau proporsi pengguna pemula. Validasi lewat onboarding (item #11) dan event tracking (item #7).

**Regulasi & komunikasi**
- Ditangani sebagai item #1 dan gate sebelum promosi (bagian 5).
- Fitur Pro yang masih "Segera" (alert, export CSV) tetap ditandai jelas sampai benar-benar dirilis.

## 9. Tanggapan atas review v1

| Saran review | Keputusan | Alasan |
|---|---|---|
| Tambah glosarium & tooltip | **Diterima** → #5 | Effort lebih kecil dari perkiraan karena 10 `hint` sudah ada dan tinggal dipusatkan. |
| Disclaimer & bahasa label jadi item tersendiri | **Diterima** → #1 (skor tertinggi) + gate promosi | Terkonfirmasi di kode: label "Layak beli" dan "Hindari" memang dipakai. |
| Keandalan & kesegaran data | **Diterima** → #9. Timestamp screener masuk Sprint 1 | Timestamp sudah ada di dashboard dan detail, tetapi belum di screener. |
| Pecah #2 jadi versi tanpa/dengan free float | **Tidak diperlukan** | Cakupan free float 99,5%. Masalah yang sebenarnya adalah **ambang** (34% saham < 15%, termasuk UNVR), dan itu sudah diperbaiki. Degradasi anggun tetap masuk acceptance criteria #3. |
| Empty state filter | **Diterima** → acceptance criteria #3 | |
| Catatan urutan sprint ≠ skor | **Diterima** → bagian 1 | |
| Rilis satu paket "Lapisan Kepercayaan" | **Diterima** → bagian 4 | Ditambah pemisahan logika (BE) dan UI (FE) untuk mengurangi bottleneck FE. |
| Metrik #1 dua kohort | **Diterima** → metrik #1 | |
| Metrik #3 pengguna anonim | **Diterima** → anonymous ID di #7 | Konsekuensinya, tracking memakai tabel Supabase, bukan hanya Vercel Analytics. |
| Validasi data sebelum Sprint 1 | **Sebagian sudah dijalankan** (cakupan). Akurasi dan data Yahoo dijadwalkan di Pra-Sprint | |

----

# Lampiran: Review atas v1 (arsip, tidak diubah)


Dokumen ini **jauh di atas rata-rata** hasil prompt AI: ada koreksi terhadap temuan awal (bagus, itu tanda dokumennya jujur), kerangka skor eksplisit, acceptance criteria, dependency, dan yang paling penting—**pemisahan antara "yang bisa diukur dalam 90 hari" dan "profit 1 tahun"**. Itu sudah benar dan jarang dilakukan.

Tapi ada beberapa celah yang, kalau tidak ditutup, bisa membuat 6 minggu pertama habis untuk hal yang benar tapi belum cukup.

---

## 1. Tiga item yang hilang dan seharusnya masuk

### a. Glosarium & tooltip istilah — **Quick win, skor ~28**
Target Anda investor pemula, tetapi tidak ada satu pun item yang menjelaskan arti **PER, DER, payout ratio, free float, dividend yield, current ratio**. Item #3 dan #4 menampilkan kesimpulan ("Waspada value trap") di atas angka yang tidak dipahami penggunanya. Pemula akan mengklik, tidak paham, lalu kembali ke tab Momentum—kebalikan dari tujuan Anda.

Solusi murah: satu komponen `TermTooltip` yang dipakai di semua kartu + halaman `/glosarium`. Effort ≤ 3 hari, dampaknya besar.

### b. Disclaimer & bahasa label sebagai item tersendiri — **Quick win, skor ~36**
Di dokumen ini, risiko regulasi hanya muncul di bagian **Asumsi**, padahal itu **risiko dengan konsekuensi terbesar** (bukan sekadar kerugian pengguna). Label "gorengan" pada emiten tertentu bisa dibaca sebagai tuduhan; label "buy/accumulate" bisa dibaca sebagai rekomendasi.

Naikkan ini jadi item:
- Ganti "Rawan gorengan" → **"Likuiditas tipis / risiko tinggi"** dengan alasan faktual ("free float 8%, naik 70% dalam sebulan"), bukan vonis.
- Halaman statis "Cara membaca label di Ezysaham" + disclaimer di setiap kartu yang menyimpulkan sesuatu.
- Review copy oleh pihak yang paham ketentuan OJK **sebelum** kampanye promosi apa pun.

Effort kecil, tapi kalau ditunda sampai setelah promosi, biayanya jauh lebih besar.

### c. Keandalan data & transparansi kesegaran data — **Prioritas utama, skor ~21**
Dokumen Anda sendiri menyebut Pasardana dan Yahoo sebagai *"ketergantungan terbesar produk"*—tapi tidak ada satu item pun untuk itu. Ini inkonsistensi paling serius di tabel prioritas.

Minimal yang perlu ada:
- **Timestamp "Data per [tanggal/jam]"** di setiap tab. Untuk pemula, data yang terlihat real-time padahal telat 2 hari adalah sumber keputusan salah.
- **Fallback & monitoring**: alert kalau endpoint gagal atau field `freeFloat` tiba-tiba `null` massal.
- **Degradasi anggun**: kalau `freeFloat` tidak tersedia, filter gorengan harus tetap jalan dengan flag lain—bukan mati total.

Tanpa ini, item #2 (yang bergantung penuh pada `FreeFloatPct`) bisa jadi filter yang diam-diam tidak menyaring apa pun, dan Anda tidak akan tahu.

---

## 2. Koreksi pada skoring dan roadmap

**Item #2 naik ke rank 2 padahal punya dependency yang belum divalidasi.** Acceptance criteria-nya sudah bagus (menangani `freeFloat = null`), tapi urutannya berisiko. Saran: pecah jadi dua—**#2a: `riskFlags` versi konservatif** (hanya pakai `marketCap`, `value`, `return`, `change` yang sudah pasti ada) rilis di Sprint 1; **#2b: tambah free float** setelah validasi cakupan data. Dengan begitu quick win tetap quick win.

**#5 (tracking) di rank 5 tapi dijadwalkan pertama.** Itu keputusan yang benar, tapi dokumennya perlu satu kalimat eksplisit: *"urutan sprint ≠ urutan skor; #5 adalah dependency, bukan prioritas."* Kalau tidak, pembaca akan menganggap tabelnya tidak konsisten.

**Risiko tab Akumulasi jadi kosong.** Filter gorengan ON by default di tab Akumulasi—padahal tab itu memang menangkap saham kecil yang sedang diakumulasi. Tambahkan **empty state** yang menjelaskan ("12 saham disembunyikan karena likuiditas tipis — tampilkan") ke acceptance criteria #2, bukan sebagai item baru.

**Bottleneck ada di frontend, bukan di skor.** Item #1–#4 semuanya kerja frontend, dan hanya ada 1 FE. Enam minggu pertama sebaiknya dirilis sebagai **satu paket "Lapisan Kepercayaan"** (banner + badge + checklist + glosarium + disclaimer), bukan empat rilis terpisah. Satu rilis, satu kampanye edukasi, satu siklus ukur.

---

## 3. Dua masalah pada metrik

**Metrik #1 cacat karena filter ON by default.** Kalau filter gorengan menyala otomatis, "persentase saham berisiko yang ditambahkan ke portofolio" akan turun **karena pengguna tidak pernah melihat sahamnya**, bukan karena mereka belajar menghindarinya. Itu mengukur UI, bukan perilaku.

Perbaiki: ukur **dua kohort terpisah** — (a) pengguna dengan filter ON, (b) pengguna yang mematikan filter. Kalau di kohort (b) angka `risk_flag` tetap tinggi, berarti edukasinya belum bekerja. Itu sinyal yang sebenarnya Anda butuhkan.

**Metrik #3 (retensi D7/D30) hanya menghitung pengguna login.** Pengguna localStorage—kemungkinan besar mayoritas pemula yang baru coba-coba—tidak terhitung. Tambahkan pelacakan anonim via `localStorage` ID, atau nyatakan eksplisit bahwa metrik ini hanya berlaku untuk pengguna terdaftar.

---

## 4. Ringkasan revisi yang disarankan

| Aksi | Item |
|---|---|
| Tambah | Glosarium/tooltip istilah (quick win) |
| Tambah | Disclaimer & revisi bahasa label (quick win, gate sebelum promosi) |
| Tambah | Keandalan data, timestamp, fallback, monitoring (prioritas utama) |
| Pecah | #2 → #2a (tanpa free float) + #2b (dengan free float) |
| Pindah ke acceptance criteria | Empty state filter, bukan item baru |
| Perbaiki | Metrik #1 jadi dua kohort; metrik #3 sebutkan batasan auth |
| Catatan | Urutan sprint ≠ urutan skor (#5) |

Dengan empat tambahan ini, roadmap 90 hari Anda tidak hanya menyelesaikan lima tujuan spesifik—tetapi juga menutup dua risiko yang saat ini tidak terlihat di tabel: **produk yang menyimpulkan tanpa menjelaskan**, dan **produk yang bergantung pada data yang bisa hilang kapan saja**.

Satu catatan metodologis: saya menilai dokumen ini dari isinya saja, tanpa mengakses codebase `version4`. Klaim seperti "`payoutRatio` sudah diambil" atau "`freeFloat` tersedia dari Pasardana" saya terima apa adanya—dan justru karena itu, validasi cakupan data (bagian 7 dokumen Anda) sebaiknya dikerjakan **sebelum** Sprint 1 dimulai, bukan paralel.