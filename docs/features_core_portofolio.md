Berikut adalah panduan praktis untuk memasukkan kriteria **Core** dan **Satellite Portfolio** ke dalam fitur **Screener** di aplikasi **Stockbit** (baik versi Mobile maupun Web/Desktop).

---

## 1. Persiapan & Cara Akses Screener Stockbit

1. Buka aplikasi **Stockbit** dan masuk ke akunmu.
2. Pilih menu **Screener** (ikon corong di navigasi bawah atau baris menu utama).
3. Klik tombol **Create New Screener** (atau ikon **+** di pojok kanan atas) untuk membuat preset filter baru.

---

## 2. Setting Filter: Core Portfolio (Quality & Growth)

Gunakan *Preset* ini untuk menyaring saham ber fundamental kuat dan konsisten.

### Langkah Input Filter:

1. **Member of Index / Universe:**
* Pilih `Kompas100` atau `IDX80` (untuk memastikan saham likuid dan masuk papan utama).


2. **Market Capitalization:**
* Klik **Add Filter** $\rightarrow$ cari **Market Cap**.
* Set aturan: `Market Cap > 10,000,000,000,000` (10 Triliun Rupiah).


3. **Return on Equity (ROE):**
* Klik **Add Filter** $\rightarrow$ cari **ROE (TTM)** atau **ROE (Latest Quarter)**.
* Set aturan: `ROE > 15%`.


4. **Debt to Equity Ratio (DER):**
* Klik **Add Filter** $\rightarrow$ cari **DER (Latest Quarter)**.
* Set aturan: `DER < 1.0` *(Catatan: Tambahkan pengecualian sektor Financials jika tidak ingin saham bank tereliminasi).*


5. **EPS Growth:**
* Klik **Add Filter** $\rightarrow$ cari **EPS Growth 3 Year (CAGR)** atau **EPS Growth YoY**.
* Set aturan: `EPS Growth > 8%`.


6. **Free Cash Flow:**
* Klik **Add Filter** $\rightarrow$ cari **Free Cash Flow (TTM)**.
* Set aturan: `Free Cash Flow > 0`.



> **Simpan Preset:** Klik **Save Screener** $\rightarrow$ Beri nama **`Core - High Quality Growth`**.

---

## 3. Setting Filter: Satellite Portfolio (Value & Turnaround)

Gunakan *Preset* ini untuk mencari saham terdiskon (*undervalued*) atau berpotensi mengalami pemulihan kinerja.

### Langkah Input Filter:

1. **Market Capitalization:**
* Klik **Add Filter** $\rightarrow$ cari **Market Cap**.
* Set aturan: `Market Cap BETWEEN 1,000,000,000,000 AND 10,000,000,000,000` (1 Triliun – 10 Triliun Rupiah).


2. **Price to Book Value (PBV):**
* Klik **Add Filter** $\rightarrow$ cari **PBV (Latest Quarter)**.
* Set aturan: `PBV < 1.0`.


3. **Price to Earnings Ratio (PER):**
* Klik **Add Filter** $\rightarrow$ cari **PE Ratio (TTM)**.
* Set aturan: `PE Ratio < 10` dan `PE Ratio > 0` (memastikan perusahaan tidak dalam kondisi rugi).


4. **Current Ratio:**
* Klik **Add Filter** $\rightarrow$ cari **Current Ratio (Latest Quarter)**.
* Set aturan: `Current Ratio > 1.5`.


5. **Operating Profit Growth (Katalis Turnaround):**
* Klik **Add Filter** $\rightarrow$ cari **Operating Profit Growth QoQ** atau **YoY**.
* Set aturan: `Operating Profit Growth > 0`.



> **Simpan Preset:** Klik **Save Screener** $\rightarrow$ Beri nama **`Satellite - Deep Value Turnaround`**.

---

## 4. Menggunakan Custom Formula (Stockbit Pro Feature)

Jika kamu ingin penyaringan yang lebih presisi menggunakan fitur **Custom Formula** di Stockbit Pro, kamu bisa menyalin baris logika berikut:

### Custom Formula: Core Portfolio

```text
[Market Cap] > 10000000000000 
AND [ROE (TTM)] > 15 
AND [DER (Quarter)] < 1 
AND [Free Cash Flow (TTM)] > 0

```

### Custom Formula: Valuation Discount (PBV vs Historis 5 Tahun)

Untuk mencari saham yang harganya berada di bawah rata-rata historisnya sendiri (*Standard Deviation -1*):

```text
[PBV (Quarter)] < [PBV Mean 5 Years] - [PBV StdDev 5 Years]
AND [PE Ratio (TTM)] > 0

```

---

## Tips Eksekusi Hasil Screener

```
Jalankan screener `Core` setiap bulan sebelum jadwal *top-up*, dan screener `Satellite` setiap akhir kuartal setelah laporan keuangan rilis.


Buka hasil emiten di Chartbit, aktifkan indikator Valuation Band (PE/PBV Band) untuk melihat apakah posisi harga saat ini berada di area *bottom* (hijau/biru).


Periksa Berita & Keuangan emiten untuk memastikan tidak ada skandal hukum, kasus fraud, atau suspensi dari regulator sebelum eksekusi beli.

```

## Tips Optimization & Offline-First Data Fetching

* Jangan menghitung rasio fundamental (seperti ROE/PBV) secara *real-time* saat request HTTP masuk. Gunakan Cron Job (misal via Vercel Cron atau BullMQ) untuk memperbarui tabel `StockMetrics` 1x sehari setelah pasar tutup (pukul 16:30 WIB).
* Jika ingin EzySaham terasa instan (tanpa *latency* API), *download* seluruh *dataset* ringkas emiten BEI (sekitar ~900 saham) ke IndexedDB pengguna di browser saat pertama kali dibuka. Filter screener kemudian dijalankan secara *in-memory/client-side*.