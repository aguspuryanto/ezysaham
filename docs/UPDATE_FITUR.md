Saya sudah menelusuri situs **Ezysaham** (https://ezysaham.vercel.app/) dan melihat halaman utama serta halaman *screener*-nya. Secara umum, situs ini tampil sebagai **dasbor data pasar yang bersih dan ringkas**, namun ada beberapa catatan penting jika target market-nya adalah **investor pemula** dengan tujuan spesifik menghindari jebakan (FOMO, saham gorengan, *dividend trap*, *value trap*) dan mencetak profit dalam setahun pertama.

---

### 📊 Apa yang Sudah Ada di Situs

Situs ini menyajikan ringkasan IHSG, *market breadth*, dan kinerja sektor. Fitur utamanya adalah **Screener Saham** yang menyaring saham berdasarkan empat tab: **Momentum, Fundamental, Dividen, dan Akumulasi**. Tab **Top Momentum** menampilkan saham yang naik ≥3% hari itu dengan volume di atas median pasar. Tab **Top Akumulasi** menampilkan saham yang harganya *sideways* tetapi ramai ditransaksikan dan ditutup mendekati harga tertinggi—indikasi ada akumulasi.

Dari sisi teknis, UI-nya bersih dan data yang disajikan (harga, volume, kapitalisasi pasar, PER, *dividend yield*, performa) relevan untuk analisis awal.

---

### 🎯 Evaluasi Terhadap Tujuan Anda & Target Market

#### 1. Menghindari FOMO
**Masalah:** Tab **Top Momentum** justru berpotensi **memicu FOMO**. Daftar saham yang naik ≥3% dalam sehari bisa membuat pemula tergoda untuk mengejar harga yang sudah terbang. Padahal, FOMO adalah salah satu kesalahan paling umum investor pemula, dan keputusan berbasis FOMO—bukan fundamental—sering berujung kerugian. Situs ini tidak memberikan peringatan atau konteks bahwa momentum harian belum tentu berkelanjutan.

**Saran:** Tambahkan *disclaimer* atau panduan singkat di tab Momentum, misalnya: “Momentum harian bisa berbalik cepat. Pastikan cek fundamental dan hindari mengejar harga di akhir lonjakan.”

#### 2. Menghindari Saham Gorengan
**Masalah:** Daftar **Top Momentum** saat ini memuat beberapa saham berkapitalisasi kecil dan likuiditas tipis (misalnya MANG, IDEA, NZIA, AKKU, TRON). Saham seperti ini justru sering masuk kategori **saham gorengan**—likuiditasnya tipis, *free float*-nya kecil, dan harganya mudah dimanipulasi. Situs tidak memiliki filter atau label yang secara eksplisit menyaring saham gorengan (misalnya berdasarkan *free float* minimum, kapitalisasi pasar minimum, atau rasio likuiditas).

**Saran:** Tambahkan **filter “Hindari Gorengan”** yang otomatis mengecualikan saham dengan *free float* di bawah ambang tertentu, volume transaksi yang terlalu tipis, atau kapitalisasi pasar di bawah batas aman. Beri penjelasan singkat mengapa kriteria itu penting.

#### 3. Menghindari Dividend Trap
**Masalah:** Ada tab **Dividen**, tetapi tidak ada penjelasan tentang **dividend trap**—kondisi di mana harga saham turun tajam setelah *cum date* sehingga *capital loss* menggerus bahkan melebihi dividen yang diterima. Situs hanya menampilkan *dividend yield*, tanpa metrik keberlanjutan dividen seperti *payout ratio*, arus kas bebas, atau riwayat pembayaran dividen. Pemula bisa saja membeli saham dengan *yield* tinggi tanpa sadar itu jebakan.

**Saran:** Sertakan **skor keberlanjutan dividen** atau setidaknya *payout ratio* dan peringatan jika *yield* tinggi tetapi *payout ratio* tidak wajar. Tambahkan edukasi singkat: “Yield tinggi belum tentu aman; cek apakah laba dan arus kas mampu menutup dividen.”

#### 4. Menghindari “Fundamental Bagus tapi Harga Turun” (Value Trap)
**Masalah:** Situs tidak memiliki fitur atau penjelasan yang membantu pemula membedakan antara **koreksi sementara** dan **value trap**. Saham dengan fundamental baik bisa turun karena sentimen pasar, aksi jual asing, atau sektor yang sedang tertekan—bukan karena kinerja perusahaan memburuk. Tanpa panduan, pemula mungkin panik dan menjual di harga rendah, atau sebaliknya, membeli saham yang sebenarnya sedang dalam tren penurunan struktural.

**Saran:** Tambahkan **checklist sederhana** di halaman detail saham atau di tab Fundamental: “Apakah penurunan harga disertai penurunan laba? Bagaimana arus kas? Apakah ada utang yang membengkak?” Ini membantu pemula berpikir kritis sebelum mengambil keputusan.

#### 5. Fokus Profit dalam 1 Tahun Pertama
**Masalah:** Tidak ada fitur yang secara langsung mendukung tujuan **profit dalam 1 tahun**. Situs ini murni alat *screening*, bukan alat perencanaan atau pemantauan portofolio. Tidak ada fitur untuk menetapkan target profit, mensimulasikan alokasi, atau melacak kinerja setelah saham dipilih.

**Saran:** Jika memungkinkan, tambahkan **watchlist sederhana** dengan input harga beli dan target profit, atau setidaknya panduan alokasi modal untuk pemula (misalnya “mulai dari saham blue-chip, diversifikasi 3–5 emiten, gunakan uang dingin”). Ini akan membuat situs lebih aplikatif, bukan sekadar referensi.

---

### 💎 Kesimpulan

Ezysaham sudah punya **fondasi data yang baik** dan tampilan yang bersih. Namun, untuk benar-benar menjadi alat bantu investor pemula sesuai tujuan Anda, situs ini masih perlu **lapisan edukasi dan penyaringan yang lebih eksplisit** terhadap jebakan-jebakan yang Anda sebutkan.

**Prioritas perbaikan yang disarankan:**
1. **Filter “Hindari Gorengan”** (free float, likuiditas, kapitalisasi).
2. **Peringatan dan metrik keberlanjutan dividen** (payout ratio, arus kas).
3. **Panduan anti-FOMO** di tab Momentum.
4. **Checklist value trap** di halaman fundamental.
5. **Fitur watchlist/target profit** sederhana untuk mendukung tujuan 1 tahun.

Dengan tambahan-tambahan ini, Ezysaham tidak hanya menjadi *screener*, tetapi benar-benar menjadi **pendamping belajar** bagi pemula—sesuai dengan tujuan awal Anda.

----
# Prompt AI: Priorisasi Perbaikan Website Ezysaham

Anda adalah seorang Product Manager + UX Researcher + Financial Product Analyst yang berpengalaman membangun produk untuk investor ritel pemula di Indonesia.

KONTEKS PRODUK
- Nama produk: Ezysaham
- URL: https://ezysaham.vercel.app/
- Target market: investor saham pemula
- Tujuan utama: memudahkan investor pemula memilih saham
- Tujuan spesifik:
  1. Tidak terjebak FOMO
  2. Tidak terjebak saham gorengan
  3. Tidak terjebak dividend trap
  4. Tidak terjebak value trap / fundamental bagus tapi harga saham turun
  5. Fokus mendapatkan profit dalam 1 tahun pertama
- Kondisi saat ini: website berupa dasbor data pasar + screener saham dengan tab Momentum, Fundamental, Dividen, dan Akumulasi. Tampilan bersih, tetapi belum memiliki lapisan edukasi, filter risiko, dan fitur pendamping keputusan yang cukup untuk pemula.

TEMUAN AWAL YANG HARUS DIPERTIMBANGKAN
1. Tab Top Momentum berpotensi memicu FOMO karena menampilkan saham naik ≥3% harian tanpa konteks keberlanjutan.
2. Daftar momentum memuat saham small-cap/likuiditas tipis yang berpotensi masuk kategori saham gorengan.
3. Tab Dividen hanya menampilkan dividend yield, belum ada payout ratio, arus kas, atau peringatan dividend trap.
4. Belum ada panduan untuk membedakan koreksi sementara vs value trap.
5. Belum ada fitur watchlist, target profit, atau panduan alokasi untuk mendukung tujuan profit 1 tahun.

TUGAS ANDA
Buat priorisasi perbaikan produk yang paling berdampak untuk investor pemula, dengan sumber daya pengembangan yang terbatas (asumsikan tim kecil: 1 frontend, 1 backend, 1 product/design part-time).

KRITERIA PRIORISASI
Gunakan kerangka RICE atau Impact-Effort, dengan mempertimbangkan:
- Dampak terhadap keselamatan keputusan investor pemula
- Dampak terhadap tujuan profit 1 tahun
- Risiko jika tidak segera diperbaiki
- Effort pengembangan
- Ketergantungan data/API
- Kemudahan edukasi ke pengguna
- Potensi quick win

OUTPUT YANG DIMINTA
1. Tabel prioritas berisi:
   - Ranking
   - Nama perbaikan
   - Masalah yang diselesaikan
   - Solusi yang diusulkan
   - Skor Impact (1-5)
   - Skor Effort (1-5)
   - Skor Risiko jika ditunda (1-5)
   - Skor prioritas akhir
   - Alasan singkat
   - Definisi "done" / acceptance criteria
   - Estimasi effort
   - Dependencies

2. Kelompokkan hasil menjadi:
   - Quick wins (≤1 minggu)
   - Prioritas utama (1-4 minggu)
   - Pengembangan lanjutan (>1 bulan)

3. Buat roadmap 30/60/90 hari.

4. Berikan 3 rekomendasi metrik keberhasilan, misalnya:
   - persentase pengguna yang membuka panduan anti-FOMO
   - jumlah pengguna yang memakai filter anti-gorengan
   - retensi watchlist setelah 7 hari

5. Berikan catatan asumsi dan data yang masih perlu divalidasi.

ATURAN
- Jangan mengarang data spesifik tentang traffic, konversi, atau API yang tidak diberikan. Jika membutuhkan data, tulis sebagai asumsi.
- Prioritaskan solusi yang sederhana, edukatif, dan bisa diimplementasikan di website berbasis Vercel.
- Fokus pada dampak nyata bagi pemula, bukan fitur yang terlihat canggih tetapi tidak menyelesaikan masalah.
- Gunakan bahasa Indonesia yang jelas dan ringkas.

Batasan tambahan:
- Website saat ini menggunakan Next.js/Vercel.
- Data saham berasal dari [isi sumber data Anda, misalnya Yahoo Finance/API lain].
- Tidak ada tim data scientist.
- Fokus pada perbaikan yang tidak memerlukan lisensi data mahal.
- Prioritaskan fitur yang bisa diluncurkan dalam 3 sprint pertama.

---

Ketiga item ini masih **rencana di dokumen**. Belum ada kode yang diubah. Berikut yang nanti akan berubah untuk masing-masing.

---

## #1 Bahasa label & disclaimer
**Tujuannya:** supaya Ezysaham tidak terbaca seperti memberi perintah beli/jual atau menuduh emiten tertentu. Item ini wajib selesai sebelum promosi.

**Yang berubah:**

1. **Label sinyal entry diganti.** Label sekarang ada di [src/lib/entrySignal.ts](src/lib/entrySignal.ts) dan berbentuk perintah. Nanti diganti jadi deskripsi kondisi:

   | Sekarang | Nanti |
   |---|---|
   | Layak beli | Diskon besar dari harga wajar |
   | Akumulasi bertahap | Diskon moderat |
   | Mahal — tunggu koreksi | Di atas harga wajar |
   | Hindari | Fundamental lemah |

2. **Label risiko ditulis sebagai fakta, bukan vonis.** Misalnya "Free float 8% · naik 70% dalam sebulan", bukan "Saham gorengan". Kata "gorengan" tidak tampil di UI, hanya dijelaskan di glosarium.
3. **Halaman baru "Cara membaca label di Ezysaham"** yang menjelaskan setiap label, cara menghitungnya, dan batasannya. Setiap badge menautkan ke sini.
4. **Satu komponen `Disclaimer` yang sama dipakai di semua tempat.** Sekarang teks "bukan rekomendasi" tersebar dengan kalimat berbeda-beda (footer, EntrySignalCard, kartu teknikal, harga wajar, berita).
5. **Review oleh pihak yang paham ketentuan OJK** sebelum kampanye promosi. Ini syarat sebelum promosi dimulai, bukan pekerjaan coding.

---

## #5 Glosarium & tooltip istilah
**Tujuannya:** pemula paham arti angka sebelum membaca kesimpulan seperti "Waspada dividend trap".

**Kondisi sekarang:** 10 rasio di halaman detail saham sudah punya `hint` (PER, PBV, ROE, DER, dan lainnya). Tapi penjelasan istilah belum ada di screener, tab dividen, dan portofolio.

**Yang berubah:**
1. **Satu sumber definisi.** File baru `src/lib/glossary.ts` menampung semua definisi, termasuk 10 hint yang sudah ada. Istilah baru yang ditambahkan: payout ratio, dividend yield, cum date, free float, kapitalisasi, margin of safety, harga wajar, value trap, dividend trap, saham gorengan, FOMO, ARA/ARB.
2. **Komponen `TermTooltip`** untuk penjelasan singkat saat istilah disorot atau diklik. Dipasang di header kolom screener, badge, kartu dividen, dan portofolio.
3. **Halaman `/glosarium`** berisi penjelasan lengkap per istilah, bisa dibuka tanpa login. Setiap tooltip punya tautan "Selengkapnya" ke sini.

---

## #9 Keandalan & kesegaran data
**Tujuannya:** pengguna tahu kapan data terakhir diperbarui, dan tim tahu kalau sumber data (Pasardana/Yahoo) bermasalah. Tanpa ini, filter risiko bisa diam-diam tidak menyaring apa pun.

**Yang berubah:**
1. **Keterangan waktu di halaman screener**, misalnya "Data per 24 Nov 2026, 16.00 WIB". Dashboard dan detail saham sudah punya, screener belum. Bagian ini kecil, jadi masuk Sprint 1.
2. **Fungsi pemeriksa kesehatan data** (`getDataHealth`) yang menghitung:
   - jumlah saham aktif,
   - persentase data kosong di field penting (free float, kapitalisasi, nilai transaksi),
   - apakah tanggal data sudah lewat lebih dari 1 hari bursa.
3. **Banner peringatan otomatis** kalau data basi atau lebih dari 20% field penting kosong: "Sebagian data tidak tersedia; label risiko mungkin tidak lengkap."
4. **Pemantauan harian:** job terjadwal yang menjalankan pemeriksaan di atas dan mengirim notifikasi ke admin kalau ada masalah.
5. **Cadangan data:** kalau sumber gagal, aplikasi menampilkan data terakhir yang valid dengan label "data tertunda", bukan halaman error.

---

**Urutan pengerjaan:** #1 dan #5 dibangun di Sprint 1–2, lalu dirilis bersama dalam paket "Lapisan Kepercayaan" di akhir minggu ke-4. Untuk #9, keterangan waktu di screener rilis di minggu ke-1. Sisanya (pemeriksa, banner, pemantauan) dikerjakan di Sprint 3–4.