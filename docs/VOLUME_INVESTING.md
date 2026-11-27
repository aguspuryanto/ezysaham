Dalam data saham BEI (Bursa Efek Indonesia), **Volume, Frequency, dan Value** adalah tiga indikator aktivitas transaksi saham. Ketiganya memiliki fungsi berbeda untuk membaca likuiditas dan minat pasar terhadap suatu saham.

Mari kita gunakan contoh data Anda:

```
{
  "Volume": 70100.0,
  "Frequency": 42.0,
  "Value": 19540800.0
}
```

## **1. Pengertian masing-masing**

**Volume: 70.100**

# **7.010.000**

Lembar saham (asumsi data BEI menggunakan satuan lot)

Jumlah saham yang berpindah tangan dalam transaksi. Di BEI, 1 lot = 100 lembar.

**Frequency: 42**

# **42 kali**

Jumlah transaksi yang terjadi pada saham tersebut.

**Value: Rp19.540.800**

# **Rp19,54 juta**

Total nilai uang dari seluruh transaksi saham tersebut.

Catatan: Interpretasi volume di atas mengasumsikan angka 70.100 berasal dari satuan lot. Pastikan satuan dari API sumber data Anda.

## **2. Apa manfaat ketiganya untuk analisis saham?**

| Indikator | Fungsi analisis                         |
| --------- | --------------------------------------- |
| Volume    | Mengukur aktivitas perdagangan          |
| Frequency | Mengukur intensitas transaksi           |
| Value     | Mengukur nilai uang yang diperdagangkan |

Ketiganya sebaiknya dibaca bersama.

Contoh interpretasi:

| Kondisi                         | Kemungkinan arti            |
| ------------------------------- | --------------------------- |
| Volume tinggi, Value tinggi     | Aktivitas perdagangan besar |
| Volume tinggi, Frequency rendah | Transaksi relatif besar     |
| Volume rendah, Frequency tinggi | Banyak transaksi kecil      |
| Volume rendah, Value rendah     | Saham relatif sepi          |

## **3. Bagaimana menggunakannya untuk EzySaham?**

Saya menyarankan ketiga indikator ini dijadikan bagian dari fitur **Liquidity Analyzer**.

Contoh filter:

| Kriteria         | Filter awal                    |
| ---------------- | ------------------------------ |
| Value harian     | Minimal Rp1 miliar             |
| Frequency harian | Minimal 100 transaksi          |
| Volume           | Dibandingkan rata-rata 20 hari |
| Value MA20       | Minimal Rp1 miliar             |

Angka tersebut adalah parameter awal yang bisa disesuaikan dengan strategi trading, bukan standar mutlak.

## **4. Indikator tambahan yang sebaiknya dihitung**

Jangan hanya melihat angka harian. Hitung juga:

**A. Average Transaction Value**

\\[ ATV = \frac{Value}{Frequency} \\]

Dari contoh:

\\[ ATV = \frac{19.540.800}{42} = Rp465.257 \\]

Artinya rata-rata nilai setiap transaksi sekitar Rp465 ribu.

**B. Relative Volume (RVOL)**

\\[ RVOL = \frac{Volume\ Hari\ Ini}{Average\ Volume\ 20D} \\]

Interpretasi:

- RVOL kurang dari 1: aktivitas di bawah rata-rata.
- RVOL 1–1,5: aktivitas normal hingga meningkat.
- RVOL di atas 1,5: aktivitas meningkat.
- RVOL di atas 2: lonjakan aktivitas yang perlu diperiksa.

**C. Average Value 20D**

Mengukur rata-rata nilai transaksi selama 20 hari perdagangan. Ini lebih berguna untuk mengetahui apakah saham cukup likuid untuk trading.

## **5. Rekomendasi untuk EzySaham**

Saya menyarankan jangan menggunakan Volume saja untuk menentukan saham layak dibeli.

Gunakan kombinasi:

1. Value MA20 untuk mengukur likuiditas.
2. RVOL untuk mendeteksi lonjakan aktivitas.
3. Frequency untuk mengukur intensitas transaksi.
4. Price Action untuk melihat arah harga.
5. Broker Flow untuk melihat distribusi dan akumulasi.

**Kesimpulan:** Volume menunjukkan seberapa banyak saham diperdagangkan, Frequency menunjukkan berapa kali transaksi terjadi, sedangkan Value menunjukkan berapa besar uang yang berputar.

Ketiganya merupakan indikator aktivitas dan likuiditas, bukan bukti bahwa suatu saham sedang diakumulasi bandar.