Mengukur **winrate** (persentase tingkat keberhasilan) dari sistem analisis atau strategi *screener* saham seperti **EzySaham** dapat dilakukan dengan dua pendekatan utama: **Backtesting (Data Historis)** dan **Forward Testing / Paper Trading (Data Real-Time)**.

---

### **Formula Utama Winrate**

$$\text{Winrate (\%)} = \left( \frac{\text{Jumlah Transaksi Cuan (Winning Trades)}}{\text{Total Transaksi (Winning + Losing Trades)}} \right) \times 100\%$$

> **Catatan Penting:** Winrate 60% sudah tergolong sangat bagus di pasar saham, asalkan dikombinasikan dengan **Risk to Reward Ratio (RRR)** minimal $1 : 2$.

---

### **1. Cara Mengukur via Backtesting (Uji Data Historis)**

Cara ini dilakukan dengan melihat sinyal-sinyal yang dihasilkan oleh EzySaham di masa lalu, lalu mencatat hasilnya setelah *holding period* tertentu.

1. **Tentukan Parameter Strategi & Risk Management:** Tentukan aturan main sebelum mencatat data.
* **Trigger Entry:** Misal, *Beli saat skor AI Screener > 75* atau *RSI oversold + Golden Cross*.
* **Target Profit (TP):** Misal, $+5\%$ atau menyentuh *Resistance*.
* **Stop Loss (SL):** Misal, $-3\%$ atau jebol *Support*.
* **Holding Period:** Misal, maksimal 10 hari bursa.


2. **Kumpulkan Sample Data Sinyal (Minimal 30-50 Transaksi):** Hindari mengambil sampel terlalu sedikit agar data valid.
* Ambil data histori sinyal screener EzySaham untuk 30–50 emiten berbeda selama kurun waktu 3–6 bulan terakhir.
* Catat tanggal sinyal keluar dan harga *Close* saat sinyal terdeteksi.


3. **Evaluasi Outcome Setiap Sinyal:** Cek mana yang menyentuh TP atau SL lebih dulu.
* **Win (1):** Jika harga berhasil menyentuh Target Profit (+5%) lebih dahulu.
* **Loss (0):** Jika harga menyentuh Stop Loss (-3%) lebih dahulu atau terkena cut loss batas waktu.


4. **Hitung Winrate & Expectancy Ratio:** Kalkulasikan total performa.
Gunakan rumus di atas untuk menentukan persentase *Winrate*.


---

### **2. Cara Mengukur via Trading Journal (Forward Testing)**

Jika kamu menguji analisis EzySaham secara langsung di pasar saat ini (*real-time*):

* Buat **Trading Log / Journal** menggunakan tabel sederhana (Excel/Notion):

| Tanggal | Ticker | Harga Entry | Target Profit (TP) | Stop Loss (SL) | Status Exit | Hasil (Win/Loss) | Gain/Loss (%) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01/09/2026 | BTPS | Rp1.060 | Rp1.150 (+8,5%) | Rp1.020 (-3,7%) | Exit TP | **WIN** | +8,5% |
| 03/09/2026 | INPP | Rp900 | Rp960 (+6,6%) | Rp870 (-3,3%) | Exit SL | **LOSS** | -3,3% |

---

### **3. Indikator Penting Selain Winrate (Profit Factor & Expectancy)**

Winrate tinggi saja tidak menjamin portofolio tumbuh jika kekalahannya (*loss*) jauh lebih besar daripada kemenangannya (*win*). Kamu wajib mengukur **Expectancy Ratio**:

$$\text{Expectancy} = (\text{Winrate} \times \text{Rata-rata Gain}) - (\text{Loss Rate} \times \text{Rata-rata Loss})$$

* **Contoh Kasus:**
* Winrate Screener: **50%**
* Rata-rata Win (TP): **+8%**
* Rata-rata Loss (SL): **-3%**
* $\text{Expectancy} = (0,50 \times 8\%) - (0,50 \times 3\%) = +4\% - 1,5\% = \mathbf{+2,5\%}$
* *Sistem ini menguntungkan secara konsisten dalam jangka panjang karena nilainya positif.*