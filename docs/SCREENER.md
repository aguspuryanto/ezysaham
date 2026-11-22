# **Strategi Screener Saham: Mencari Peluang dengan Risiko Terukur**

Menurut saya, pendekatan terbaik bukan mencari saham yang *besok pasti naik*, tetapi mencari saham yang memenuhi tiga syarat:

1. **Fundamental sehat:** perusahaan memiliki bisnis dan keuangan yang layak.
2. **Teknikal bullish:** harga menunjukkan kecenderungan naik.
3. **Risiko terkendali:** potensi keuntungan minimal dua kali potensi kerugian.

Kita akan membuat sistem screener yang menggabungkan dua mesin:

## **1. Momentum Trade Engine**

Timing

Mencari saham yang sedang mengalami penguatan harga, volume, dan momentum.

## **2. Value Growth Hunter**

Quality

Mencari perusahaan dengan valuasi menarik, profitabilitas baik, dan pertumbuhan bisnis.

## **3. Risk Management Engine**

Proteksi

Menghitung entry, stop loss, target profit, ukuran posisi, dan rasio risiko.

Tujuannya: jangan sampai kita membeli saham hanya karena harganya terlihat murah atau sedang ramai dibicarakan.

## **1. Tahap pertama: screening seluruh saham BEI**

Gunakan timeframe Daily (1D), dengan data harga penutupan terakhir yang sudah valid.

Berikut filter awal yang saya rekomendasikan.

| Indikator       | Kriteria                        | Tujuan                          |
| --------------- | ------------------------------- | ------------------------------- |
| Harga           | Di atas Rp100                   | Menghindari saham terlalu murah |
| Value transaksi | Di atas Rp1 miliar/hari         | Likuiditas                      |
| EMA 8           | Di atas EMA 18                  | Tren pendek positif             |
| Harga           | Di atas EMA 18                  | Konfirmasi tren                 |
| Harga           | Di atas EMA 200                 | Tren jangka panjang             |
| RSI 14          | 50–68                           | Momentum sehat                  |
| Volume          | Di atas 1,5 × rata-rata 20 hari | Konfirmasi minat beli           |
| ADX 14          | Di atas 20                      | Kekuatan tren                   |

Hasilnya adalah daftar kandidat awal, bukan rekomendasi beli.

**Catatan:** jangan menganggap semua filter harus terpenuhi secara mutlak. Misalnya, saham yang baru mengalami breakout bisa belum memiliki EMA 8 di atas EMA 18.

## **2. Tahap kedua: Value Growth Hunter**

Setelah mendapatkan kandidat teknikal, periksa fundamentalnya.

| Indikator             | Kriteria awal       | Prioritas |
| --------------------- | ------------------- | --------- |
| ROE                   | Di atas 10%         | Tinggi    |
| DER                   | Di bawah 1x         | Tinggi    |
| Current Ratio         | Di atas 1,2x        | Menengah  |
| Net Profit Margin     | Positif             | Tinggi    |
| Revenue Growth YoY    | Positif             | Tinggi    |
| Net Profit Growth YoY | Positif             | Tinggi    |
| PBV                   | Dibandingkan sektor | Menengah  |
| PER                   | Dibandingkan sektor | Menengah  |

Untuk bank, perusahaan komoditas, dan perusahaan siklikal, standar fundamental perlu disesuaikan dengan industrinya.

**Penting:** PBV rendah tidak otomatis berarti undervalued. SMGR yang Anda tunjukkan sebelumnya merupakan contoh bagus: PBV 0,2x terlihat murah, tetapi ROE 1,5% dan margin 1,6% menunjukkan profitabilitas yang masih lemah.

## **3. Tahap ketiga: Risk Management Engine**

Ini bagian terpenting. Saham bagus pun bisa menjadi transaksi buruk jika entry terlalu tinggi.

Saya menyarankan tiga aturan:

- Risiko per transaksi maksimal 1% dari modal trading.
- Stop loss berdasarkan support atau ATR, bukan angka asal.
- Risk/Reward Ratio minimal 1:2.

### **Contoh simulasi SMGR**

Misalkan:

| Parameter                | Nilai   |
| ------------------------ | ------- |
| Harga entry              | Rp1.600 |
| Stop loss                | Rp1.565 |
| Target profit            | Rp1.670 |
| Risiko per saham         | Rp35    |
| Potensi profit per saham | Rp70    |
| Risk/Reward              | 1:2     |

Jika modal trading Rp1 juta dan risiko maksimal 1%:

\\[ Risiko = Rp1.000.000 \times 1\\% = Rp10.000 \\]

Jumlah saham yang bisa dibeli:

\\[ \frac{10.000}{1.600-1.565}=285\ saham \\]

Karena pembelian saham BEI menggunakan kelipatan 100 lembar, maksimalnya 2 lot atau 200 saham.

**Hasil simulasi transaksi SMGR**

Modal digunakan

# **Rp320.000**

Risiko maksimal teoritis

# **Rp7.000**

Potensi keuntungan

# **Rp14.000**

Risk/Reward

# **1:2**

Belum termasuk biaya transaksi dan kemungkinan slippage. Stop loss tidak menjamin eksekusi tepat pada harga tersebut.

Jangan memaksakan ukuran posisi hanya agar modal terpakai seluruhnya.

## **4. Sistem penilaian kandidat saham**

Saya menyarankan setiap saham memperoleh skor 0–100.

| Komponen                    | Bobot   |
| --------------------------- | ------- |
| Trend EMA 8/18/200          | 20      |
| RSI dan momentum            | 15      |
| Volume dan akumulasi        | 15      |
| Breakout/support            | 10      |
| ROE dan profitabilitas      | 15      |
| Pertumbuhan pendapatan/laba | 10      |
| Valuasi                     | 5       |
| Risk/Reward                 | 10      |
| **Total**                   | **100** |

Klasifikasi hasil:

**80–100**

PRIORITAS

Kandidat terbaik untuk dianalisis dan menunggu entry.

**70–79**

WATCHLIST

Menarik, tetapi perlu konfirmasi tambahan.

**60–69**

OBSERVASI

Belum memenuhi kualitas setup yang diinginkan.

**Di bawah 60**

SKIP

Tidak perlu dipaksakan untuk ditransaksikan.

Catatan: skor ini adalah rancangan sistem kita, bukan standar resmi BEI. Saham yang gagal pada pemeriksaan likuiditas, suspensi, atau risiko ekstrem langsung dikeluarkan meskipun skornya tinggi.

## **5. Workflow screener harian**

Karena Anda menggunakan pendekatan EOD (End of Day), saya sarankan alur berikut.

1. **Setelah market tutup**

   Jalankan screener seluruh saham BEI menggunakan data candle harian yang sudah selesai.
2. **Seleksi fundamental**

   Periksa laporan keuangan, pertumbuhan laba, utang, dan valuasi.
3. **Technical review**

   Periksa EMA, RSI, volume, support, resistance, dan ATR.
4. **Risk calculation**

   Hitung entry, stop loss, target, jumlah lot, dan R/R.
5. **Sebelum market buka**

   Buat daftar maksimal 3–5 kandidat dan siapkan rencana order. Jangan otomatis membeli semuanya.
6. **Evaluasi**

   Catat hasil transaksi dan evaluasi mingguan.

Perhatikan juga pengumuman BEI mengenai UMA, suspensi, notasi khusus, dan papan pemantauan khusus sebelum mengambil keputusan. BEI sendiri menganjurkan investor memantau kinerja emiten, aksi korporasi, likuiditas, dan kondisi perdagangan.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://www.idx.co.id\&sz=32)

IDX+1



## **6. Template screener yang bisa langsung digunakan**

Berikut konfigurasi awal untuk Stockbit atau EzySaham.

**Momentum Trade Engine**

Swing 3–10 hari

```
Timeframe       : 1D
EMA 8           : > EMA 18
Close           : > EMA 18
Close           : > EMA 200
RSI 14          : 50–68
Volume          : > 1.5 x Avg Volume 20D
ADX 14          : > 20
Avg Value 20D   : > Rp1 Miliar
```

**Value Growth Hunter**

```
ROE             : > 10%
DER             : < 1
Current Ratio   : > 1.2
Net Margin      : > 0
Revenue Growth  : > 0%
Net Profit      : Positif
```

**Risk Management**

```
Stop Loss       : Berdasarkan support / ATR
Risk per Trade  : Maksimal 1%
Risk Reward     : Minimal 1:2
Max Positions   : 3–5 saham
```

## **7. Rekomendasi penerapan**

Saya ingin menekankan satu hal: mengingat dana darurat Anda sebelumnya masih terbatas, jangan menggunakan dana kebutuhan hidup, dana darurat, atau pinjaman untuk menjalankan strategi ini. Prioritaskan perlindungan modal daripada mengejar target keuntungan.&#x20;

Untuk memperdalam sistem ini, saya sarankan kita membangun screener yang memiliki tiga keluaran:

- **BUY SETUP:** memenuhi kriteria dan memiliki entry yang layak.
- **WAIT:** saham bagus tetapi belum memiliki konfirmasi entry.
- **NO TRADE:** risiko terlalu tinggi atau setup tidak memenuhi syarat.

## **8. Tentukan konfigurasi sistem screener Anda**

Saya ingin menyesuaikan sistem ini sebelum kita menerapkannya pada saham BEI.

**1. Strategi utama**

Momentum Trading (3–10 hari)

Value Investing (1–6 bulan)

Kombinasi Momentum + Value Growth

**2. Modal khusus trading**

Rp1 juta

Rp5 juta

Rp10 juta

Rp30 juta

**3. Risiko maksimal per transaksi**

0,5% (Sangat konservatif)

1% (Konservatif)

2% (Moderat)

**4. Platform screener**

Stockbit

EzySaham (screener otomatis EOD)

Excel / Google Sheets

Buat sistem screener saya

Target kita bukan menemukan saham yang paling cepat naik. Target kita menemukan saham dengan **peluang terbaik, risiko terukur, dan disiplin eksekusi.**

----
EzySaham — Combined Stock Screener BEI
System Design
EOD Only
Risk Controlled

Saya akan merancang EzySaham sebagai sistem analisis saham BEI yang menggabungkan:
- Momentum Trade Engine: menemukan saham yang sedang menunjukkan kekuatan harga.
- Value Growth Hunter: mencari perusahaan dengan fundamental dan valuasi menarik.
- Risk Management Engine: menentukan harga entry, stop loss, take profit, dan jumlah lot.
- Daily Stock Scanner: menghasilkan kandidat saham setiap hari berdasarkan candle yang sudah ditutup.
Sistem ini tidak akan asal memberikan label BUY. Jika data tidak lengkap, sinyal bertentangan, atau risiko tidak layak, hasilnya harus WAIT atau NO TRADE.
1. Konfigurasi utama
Modal trading
Rp1.000.000

Risiko per transaksi
2%

Batas risiko nominal
Rp20.000

Horizon trading
3–15 hari



Parameter	Konfigurasi
Universe	Saham BEI
Strategi	Momentum + Value
Timeframe	Daily (1D)
Data	EOD
Evaluasi	Setelah market tutup
Maksimal posisi	3
Minimal Risk/Reward	1:2
Target kandidat	5–10 saham
Platform	EzySaham


Catatan penting: risiko 2% adalah batas maksimum kerugian terencana, bukan jaminan kerugian aktual. Gap harga, likuiditas, dan slippage dapat menyebabkan kerugian lebih besar.
2. Arsitektur sistem screener








marketsense-ai.com


Sistem akan memiliki lima tahapan pemrosesan.
#chatgpt-mermaid-_r_ke_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-_r_ke_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_ke_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-_r_ke_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-_r_ke_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-_r_ke_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-_r_ke_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-_r_ke_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-_r_ke_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-_r_ke_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ke_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ke_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-_r_ke_ p{margin:0;}#chatgpt-mermaid-_r_ke_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-_r_ke_ .label text,#chatgpt-mermaid-_r_ke_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .node rect,#chatgpt-mermaid-_r_ke_ .node circle,#chatgpt-mermaid-_r_ke_ .node ellipse,#chatgpt-mermaid-_r_ke_ .node polygon,#chatgpt-mermaid-_r_ke_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .rough-node .label text,#chatgpt-mermaid-_r_ke_ .node .label text,#chatgpt-mermaid-_r_ke_ .image-shape .label,#chatgpt-mermaid-_r_ke_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-_r_ke_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .rough-node .label,#chatgpt-mermaid-_r_ke_ .node .label,#chatgpt-mermaid-_r_ke_ .image-shape .label,#chatgpt-mermaid-_r_ke_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-_r_ke_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-_r_ke_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ke_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ke_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-_r_ke_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_ke_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ke_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ke_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-_r_ke_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-_r_ke_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-_r_ke_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-_r_ke_ .icon-shape,#chatgpt-mermaid-_r_ke_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-_r_ke_ .icon-shape p,#chatgpt-mermaid-_r_ke_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-_r_ke_ .icon-shape .label rect,#chatgpt-mermaid-_r_ke_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-_r_ke_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-_r_ke_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-_r_ke_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node rect,#chatgpt-mermaid-_r_ke_ [data-look="neo"].cluster rect,#chatgpt-mermaid-_r_ke_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-_r_ke_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ke_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-_r_ke_-gradient);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-_r_ke_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ke_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-_r_ke_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-_r_ke_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ke_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-_r_ke_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-_r_ke_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_ke_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-_r_ke_ .node tspan[font-weight="normal"],#chatgpt-mermaid-_r_ke_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-_r_ke_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .node rect,#chatgpt-mermaid-_r_ke_ .node circle,#chatgpt-mermaid-_r_ke_ .node ellipse,#chatgpt-mermaid-_r_ke_ .node polygon,#chatgpt-mermaid-_r_ke_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-_r_ke_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-_r_ke_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-_r_ke_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-_r_ke_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-_r_ke_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}BEI EOD Market DataData ValidationMomentum Trade EngineValue Growth HunterCombined Scoring EngineRisk Management EngineRisk/Reward = 1:2?BUY SETUP / WATCHLISTNO TRADEDaily Screener ReportEzySaham DashboardYaTidak





Setiap tahapan harus menyimpan hasil per tanggal perdagangan agar kita bisa melakukan backtest dan mengevaluasi akurasi sinyal.
3. Filter saham: Momentum Trade Engine
Mesin pertama bertugas menyaring saham yang berpotensi mengalami kenaikan harga.
A. Hard filters
Saham langsung dikeluarkan jika:
- Tidak memiliki data EOD valid.
- Tidak memiliki likuiditas yang cukup.
- Sedang disuspensi.
- Memiliki data harga atau volume yang tidak wajar.
- Berada pada kondisi perdagangan khusus yang tidak cocok untuk strategi ini.
- Tidak memiliki ruang profit yang memenuhi Risk/Reward 1:2.
B. Technical filters
Indikator	Kriteria	Bobot
EMA 8	Di atas EMA 18	5
EMA 18	Di atas EMA 200	5
Close	Di atas EMA 18	5
RSI 14	50–68	5
MACD	Bullish / histogram meningkat	5
Volume	Di atas 1,5 × Avg20	5
ADX	Di atas 20	5
Breakout	Close menembus resistance	5
Pullback	Rebound valid di EMA18/support	5
Relative Strength	Mengungguli IHSG	5
Total		50

Breakout dan pullback merupakan dua jenis setup alternatif. Keduanya tidak harus terjadi bersamaan.
C. Tipe setup yang dicari










1. Breakout Setup

Harga menembus resistance dengan volume meningkat, kemudian mempertahankan area breakout.
Prioritas tinggi













2. Pullback Setup

Harga terkoreksi menuju EMA18 atau support, kemudian muncul candle reversal dengan volume yang mendukung.
Entry lebih terukur













3. Consolidation Setup

Harga bergerak sideways, volatilitas mengecil, dan volume mulai meningkat sebelum potensi breakout.
Watchlist



4. Value Growth Hunter
Mesin kedua memeriksa kualitas perusahaan.

Saya menyarankan bobot fundamental sebesar 35 poin.
Indikator	Kriteria ideal	Poin
ROE	Di atas 10%	7
Revenue Growth	Positif	5
Net Profit Growth	Positif	5
Net Profit Margin	Positif dan stabil	5
DER	Di bawah 1x	4
Current Ratio	Di atas 1,2x	3
PER	Wajar dibandingkan sektor	3
PBV	Wajar dibandingkan sektor	3
Total		35

Aturan penting:
- Gunakan laporan keuangan terakhir yang sudah dipublikasikan pada tanggal screening.
- Pertumbuhan laba dibandingkan periode yang sama tahun sebelumnya.
- Jika data tidak tersedia, statusnya N/A, bukan dianggap nol atau diberi skor penuh.
- Gunakan sektor sebagai pembanding valuasi.
- Untuk perbankan, asuransi, dan perusahaan komoditas, gunakan standar sektoral yang sesuai.
Khusus perusahaan turnaround seperti SMGR: perusahaan tidak otomatis dikeluarkan karena ROE rendah. Namun, skor fundamentalnya harus lebih rendah sampai ada bukti perbaikan yang konsisten.
5. Combined Scoring Engine
Kita gabungkan kedua mesin dengan penilaian kualitas setup dan likuiditas.
Komposisi nilai maksimal
Momentum Technical

50/100




Fundamental Value Growth

35/100




Liquidity & Trade Quality

10/100




Data Quality

5/100





Rumus:
\[
Score = Momentum + Fundamental + Quality + Data
\]

Klasifikasi
Skor	Status	Tindakan
85–100	PRIORITY	Kandidat utama
75–84	WATCHLIST	Tunggu konfirmasi
65–74	OBSERVE	Belum siap
Di bawah 65	REJECT	Abaikan

Skor tinggi tidak otomatis menghasilkan BUY.

Syarat ENTRY READY:
1. Skor minimal 85.
2. Data EOD valid.
3. Tidak terkena hard filter.
4. Setup breakout atau pullback terkonfirmasi.
5. Risk/Reward minimal 1:2.
6. Position sizing memenuhi modal dan batas risiko.
Dengan begitu, saham dengan fundamental bagus tetapi teknikal buruk tetap berstatus WAIT.
6. Risk Management Engine
Ini bagian yang akan mengontrol penggunaan modal Rp1 juta.
A. Batas risiko
Parameter	Nilai
Modal	Rp1.000.000
Risiko maksimum	2%
Risiko rupiah	Rp20.000
Maksimal posisi terbuka	3
Maksimal risiko gabungan	Rp40.000
Minimum R/R	1:2

Maksimal risiko gabungan Rp40.000 berarti dua posisi dengan risiko penuh Rp20.000 atau beberapa posisi dengan alokasi lebih kecil.
B. Menentukan entry
Sistem menghitung dua kemungkinan:

Breakout:
- Resistance berdasarkan swing high atau konsolidasi.
- Entry menggunakan harga pemicu yang valid setelah breakout.
- Tidak mengejar harga jika sudah terlalu jauh dari area pemicu.
Pullback:
- Tentukan support atau EMA18.
- Tunggu candle reversal.
- Entry setelah konfirmasi, bukan saat harga masih jatuh.
C. Menentukan stop loss
Gunakan struktur harga dan ATR.
\[
SL = Support - (0,2 \times ATR14)
\]

Sistem kemudian memvalidasi jarak stop loss:
\[
StopDistance = Entry - SL
\]

Aturan:
- Jarak stop ideal sekitar 1–2,5 ATR.
- Jika jarak lebih dari 2,5 ATR, NO TRADE.
- Jika support tidak jelas, jangan memaksakan entry.
- Sesuaikan SL ke fraksi harga BEI yang berlaku.
D. Menentukan take profit
\[
TP = Entry + (2 \times (Entry-SL))
\]

Target tambahan bisa dihitung berdasarkan resistance berikutnya.

Strategi exit:
Kondisi	Tindakan
Mencapai 1R	Evaluasi kekuatan tren
Mencapai 2R	Take profit sebagian atau penuh
Tren melemah	Evaluasi exit lebih awal
Stop loss tersentuh	Keluar sesuai rencana
Breakout gagal	Batalkan setup

1R adalah besarnya risiko awal per saham.
7. Position Sizing — menghitung jumlah lot otomatis
Ini adalah fitur wajib. EzySaham tidak boleh sekadar memberi harga entry dan stop loss tanpa menghitung jumlah saham.
Rumus dasar
\[
RiskBudget = Modal \times 2\%
\]

\[
Lots_{risk} =
\left\lfloor
\frac{RiskBudget}
{(Entry-SL)\times100}
\right\rfloor
\]

Kemudian hitung batas modal:
\[
Lots_{capital} =
\left\lfloor
\frac{Modal}
{Entry\times100}
\right\rfloor
\]

Jumlah lot final:
\[
Lots = \min(Lots_{risk},Lots_{capital})
\]

Dalam implementasi produksi, tambahkan estimasi biaya beli dan jual dari konfigurasi broker. Jangan menganggap biaya transaksi nol.
Algoritma
interface PositionSizingInput {
  capital: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  buyFeeRate: number;
  sellFeeRate: number;
}

function calculatePositionSize(input: PositionSizingInput) {
  const {
    capital,
    riskPercent,
    entry,
    stopLoss,
    buyFeeRate,
    sellFeeRate
  } = input;

  if (entry <= stopLoss || stopLoss <= 0) {
    throw new Error("Invalid entry or stop loss");
  }

  const riskBudget = capital * riskPercent / 100;

  const riskPerLot =
    (entry - stopLoss) * 100 +
    (entry * 100 * buyFeeRate) +
    (stopLoss * 100 * sellFeeRate);

  const costPerLot =
    entry * 100 * (1 + buyFeeRate);

  const riskLots = Math.floor(riskBudget / riskPerLot);
  const capitalLots = Math.floor(capital / costPerLot);

  const lots = Math.min(riskLots, capitalLots);

  return {
    riskBudget,
    riskLots,
    capitalLots,
    lots,
    shares: lots * 100,
    investment: lots * costPerLot,
    estimatedRisk: lots * riskPerLot,
    remainingCapital: capital - lots * costPerLot
  };
}


Kode ini merupakan fondasi perhitungan, bukan modul produksi lengkap. Perlu ditambahkan pembulatan fraksi harga, validasi data, dan pembatasan total risiko portofolio.

Penting untuk modal Rp1 juta: bisa saja sebuah saham memenuhi seluruh indikator tetapi tidak layak dibeli karena satu lot saja sudah menggunakan terlalu banyak modal atau risikonya melampaui Rp20.000. Saham tersebut harus diberi status SKIP — POSITION SIZE NOT FEASIBLE.
Contoh hasil yang harus ditampilkan
Position Sizing Calculator

Ilustrasi menggunakan input variabel, bukan rekomendasi harga saham tertentu.
Output	Hasil
Modal	Rp1.000.000
Risk budget	Rp20.000
Harga entry	Data EOD
Stop loss	Hasil analisis
Risiko per lot	Hasil perhitungan
Lot maksimal	Hasil perhitungan
Nilai transaksi	Hasil perhitungan
Sisa modal	Hasil perhitungan
Estimasi kerugian	Hasil perhitungan


8. Daily EOD Scanner
Scanner berjalan otomatis setelah data perdagangan selesai diperbarui.

Jadwal yang saya sarankan:
Waktu	Proses
16:15–16:30	Menunggu penyelesaian perdagangan
16:30–17:00	Import dan validasi EOD
17:00–17:15	Kalkulasi indikator teknikal
17:15–17:30	Screening fundamental
17:30–17:45	Scoring dan risk calculation
17:45	Generate laporan harian

Jadwal ini adalah target operasional, bukan jaminan feed sudah tersedia pada waktu tersebut. Jika data belum lengkap, proses harus ditunda.

Jam perdagangan BEI saat ini mengatur perdagangan reguler sampai pukul 16:01 dan pascapenutupan sampai pukul 16:15 pada hari perdagangan. Jumat memiliki perbedaan jam sesi siang. 

suit-baze

Validasi data
Sebelum scanner berjalan, sistem harus memeriksa:
- Apakah tanggal candle merupakan hari perdagangan terakhir?
- Apakah OHLC valid?
- Apakah volume dan nilai transaksi tersedia?
- Apakah terdapat missing candles?
- Apakah terjadi stock split, reverse split, atau corporate action?
- Apakah harga sudah disesuaikan terhadap corporate action?
- Apakah laporan keuangan masih berlaku pada tanggal screening?
Jangan menghitung indikator menggunakan candle yang belum selesai.

Simpan juga data_as_of, source, last_updated, dan data_quality_status untuk setiap hasil screening.

9. Format laporan kandidat harian
Ini merupakan tampilan utama yang saya rekomendasikan untuk EzySaham.
EzySaham Daily Scanner
EOD MODE

Daily Stock Opportunities
Tanggal perdagangan: diisi dari data EOD terakhir yang valid
--
Total scanned

--
Entry ready

--
Watchlist


Top Stock Candidates

Contoh struktur tabel. Tidak berisi rekomendasi saham aktual.
Saham	Score	Setup	Status
—	—	—	WAIT
—	—	—	WAIT
—	—	—	WAIT


Trading Plan
Parameter	Nilai
Entry	Berdasarkan data
Stop Loss	Berdasarkan support/ATR
Target 1	1R
Target 2	2R
Risk/Reward	Minimal 1:2
Lot	Position sizing
Risk nominal	Maksimal Rp20.000


Market Condition
- IHSG trend: menunggu data
- Market breadth: menunggu data
- Sektor terkuat: menunggu data
- Kondisi pasar: belum dihitung
  
  Semua tanda — adalah data yang belum tersedia, bukan nilai nol.

Detail setiap kandidat
Setiap saham harus mempunyai halaman analisis tersendiri:
1. Ringkasan fundamental.
2. Grafik candlestick Daily.
3. EMA 8, 18, 200.
4. RSI, MACD, ADX, ATR.
5. Volume dan nilai transaksi.
6. Support dan resistance.
7. Setup breakout/pullback.
8. Entry, SL, TP.
9. Position sizing.
10. Alasan BUY SETUP, WAIT, atau NO TRADE.
Sistem juga perlu menyediakan penjelasan Why Selected dan Why Rejected. Ini penting supaya pengguna memahami alasan AI memberikan skor tertentu.
10. Desain database EzySaham
Saya menyarankan memisahkan data pasar, fundamental, indikator, dan hasil screening.
Tabel	Fungsi
stocks	Master saham BEI
daily_prices	OHLCV harian
fundamental_reports	Laporan keuangan
fundamental_ratios	PER, PBV, ROE, DER, dll.
technical_indicators	EMA, RSI, MACD, ATR, ADX
market_conditions	Kondisi IHSG dan sektor
screening_runs	Riwayat proses scanner
screening_results	Hasil scoring setiap saham
trade_plans	Entry, SL, TP, lot
watchlists	Kandidat yang dipantau
trade_journals	Hasil transaksi aktual
scanner_settings	Parameter dan konfigurasi

Arsitektur teknis
Mengikuti stack EzySaham yang sudah direncanakan, saya merekomendasikan:
EzySaham Application
Nuxt 4 / Web Dashboard

Daily scanner · Stock detail · Portfolio · Reports


Hono API

Authentication · Screening API · Risk API


Supabase PostgreSQL

Market data · Fundamental · Results

Scanner Worker

EOD processing · Indicator · Scoring



Market Data Providers

EOD OHLCV · Financial Statements · Corporate Actions


Untuk data pasar, gunakan sumber yang mempunyai hak distribusi sesuai penggunaan EzySaham. BEI menyediakan produk IDX Equity EOD dan Data Reference yang mencakup informasi laporan keuangan serta aksi korporasi. Jangan menganggap semua feed pihak ketiga otomatis boleh digunakan untuk redistribusi komersial. 

idx.id+1

11. Implementasi bertahap
Saya tidak menyarankan langsung membangun seluruh fitur sekaligus. Kita mulai dari mesin inti dan pastikan perhitungannya benar.
1. Phase 1 — Market Data Foundation
   Prioritas pertama
   - Master saham BEI.
   - Import OHLCV EOD.
   - Fundamental data.
   - Corporate action adjustment.
   - Data validation.
2. Phase 2 — Technical Engine
   - EMA 8/18/200.
   - RSI 14.
   - MACD.
   - ADX.
   - ATR 14.
   - Volume analysis.
   - Support/resistance.
3. Phase 3 — Fundamental Engine
   - ROE, DER, PER, PBV.
   - Revenue growth.
   - Net profit growth.
   - Margin analysis.
   - Sector comparison.
4. Phase 4 — Combined Scoring
   - Momentum scoring.
   - Value Growth scoring.
   - Ranking saham.
   - BUY SETUP / WAIT / NO TRADE.
5. Phase 5 — Risk Engine
   - Entry calculation.
   - Stop loss.
   - Take profit.
   - Position sizing.
   - Risk/reward.
6. Phase 6 — Dashboard & Backtesting
   - Daily scanner.
   - Stock detail.
   - Trade journal.
   - Backtesting.
   - Performance report.

12. Acceptance criteria: kapan sistem dianggap selesai?
Sebelum dipakai untuk keputusan trading sungguhan, EzySaham harus memenuhi kriteria berikut.
Pengujian	Kriteria lulus
EOD data	Tidak menggunakan candle berjalan
Historical data	Indikator dapat direproduksi
Fundamental	Tidak menggunakan laporan yang belum terbit pada tanggal simulasi
Scoring	Maksimal 100 poin
Position sizing	Tidak melampaui modal dan risk budget
Stop loss	Mengikuti fraksi harga BEI
Risk/Reward	Tidak meloloskan setup di bawah 1:2
Backtesting	Tidak menggunakan look-ahead bias
Corporate action	Harga historis disesuaikan dengan benar
Daily report	Menyertakan tanggal dan sumber data

Metrik yang wajib dievaluasi
Jangan hanya mengukur persentase kemenangan.
- Win rate.
- Average profit.
- Average loss.
- Profit factor.
- Maximum drawdown.
- Expectancy per trade.
- Jumlah transaksi.
- Biaya transaksi.
- Kinerja berdasarkan sektor dan tipe setup.
Lakukan backtest dengan data historis, kemudian paper trading setidaknya 20–30 transaksi sebelum mempertimbangkan penggunaan modal sungguhan. Jumlah tersebut merupakan tahap evaluasi awal, bukan jaminan validitas statistik.

13. Keputusan desain final
Spesifikasi dasar ditetapkan
EzySaham akan menggunakan aturan berikut:
Fitur	Keputusan
Strategi	Combined Momentum + Value
Data	EOD
Modal	Rp1 juta
Risiko/trade	Maksimal 2%
Minimum R/R	1:2
Scanner	Seluruh saham BEI yang memenuhi syarat
Kandidat harian	Maksimal 10
Prioritas	Skor minimal 85
Entry	Breakout / Pullback
Stop loss	Support + ATR
Take profit	2R dan resistance
Eksekusi	Manual oleh investor
AI	Menjelaskan hasil analisis, bukan mengarang data

Satu prinsip yang harus menjadi fondasi EzySaham:
Lebih baik tidak membeli saham daripada membeli saham yang tidak memenuhi kriteria risiko.

Referensi data resmi
1. BEI – Jam dan Mekanisme Perdagangan.
2. BEI – Layanan Data BEI.
3. BEI – Stock Screener.
4. BEI – Stock Summary.
Langkah berikutnya: kita bisa mulai mengimplementasikan Phase 1–3 ke source code EzySaham menggunakan Nuxt 4, Hono, Supabase PostgreSQL, dan worker EOD, kemudian melanjutkan ke scoring dan risk engine.

----
# **EzySaham × Stockbit — Combined Stock Screener BEI**

Stockbit Workflow

EOD Only

Risk Controlled

Kita akan menggunakan **Stockbit sebagai alat screening dan analisis**, dengan sistem penilaian Combined Momentum + Value Growth yang sudah dirancang sebelumnya.

Perbedaannya dengan konfigurasi EzySaham: Stockbit menjadi tempat mencari dan memeriksa saham, sedangkan perhitungan scoring, position sizing, dan trading plan dapat dilakukan melalui spreadsheet atau kalkulator pendamping.

Saya tidak akan mengarang harga saham atau menyebut kandidat BUY tanpa data EOD yang benar-benar tersedia.

## **1. Konfigurasi trading**

Modal trading

# **Rp1.000.000**

Risiko maksimal/trade

# **2%**

Risk budget

# **Rp20.000**

Periode trading

# **3–15 hari**

| Parameter       | Pengaturan       |
| --------------- | ---------------- |
| Platform        | Stockbit         |
| Universe        | Saham BEI        |
| Timeframe       | Daily (1D)       |
| Data            | EOD              |
| Strategi        | Momentum + Value |
| Maksimal posisi | 3                |
| Minimal R/R     | 1:2              |
| Kandidat harian | 5–10             |
| Eksekusi        | Manual           |

**Prinsip utama:** modal Rp1 juta bukan berarti harus selalu diinvestasikan seluruhnya. Kita hanya membeli saham jika ukuran posisi dan risiko masuk akal.

## **2. Tahap pertama — Stockbit Screener**

[Cara Memilih dan Mencari Saham Murah Fundamental Bagus  — Stockbit Snips | Berita Saham](https://images.openai.com/static-rsc-4/Eu9QEgNvI9LG9Nz2c6u9NOKpCzaFbcd8vP60x-MtikUO8Tyyl7VVRWQZLHQcBObbPkYmOpha-2JfMKoSrpc_SeT-wmPj6yFQbxyMWrtoQae-Dhe7KyuraJ0msR3ICHfpGZtD-82Jf3cLgiWZnqZb4I5ZVNdvNH7dCMT0ZoTaHu4?purpose=inline)

[snips.stockbit.com](https://snips.stockbit.com/investasi/saham-murah-fundamental-bagus?utm_source=chatgpt.com)

Buka Stockbit, masuk ke fitur Screener, kemudian buat dua kelompok screening.

### **Screener A — Momentum Trade Engine**

Tujuan: menemukan saham yang sedang mengalami penguatan tren.

| Filter                    | Kriteria                  |
| ------------------------- | ------------------------- |
| Price                     | Di atas Rp100             |
| Average Transaction Value | Di atas Rp1 miliar        |
| Price vs EMA 8            | Price di atas EMA 8       |
| EMA 8 vs EMA 18           | EMA 8 di atas EMA 18      |
| EMA 18 vs EMA 200         | EMA 18 di atas EMA 200    |
| RSI 14                    | 50–68                     |
| Volume                    | Di atas rata-rata 20 hari |
| ADX 14                    | Di atas 20                |

Catatan implementasi:

- Gunakan filter yang benar-benar tersedia di Stockbit.
- Jika EMA, ADX, atau volume multiplier tidak tersedia sebagai filter, lakukan pemeriksaan di chart Daily.
- Jangan mengganti EMA dengan SMA tanpa mengubah definisi strategi.
- Untuk volume, gunakan perbandingan volume hari terakhir dengan rata-rata 20 hari, bukan sekadar volume besar secara absolut.

### **Screener B — Value Growth Hunter**

Tujuan: menemukan perusahaan yang memiliki fundamental menarik.

| Filter                | Kriteria            |
| --------------------- | ------------------- |
| ROE                   | Di atas 10%         |
| DER                   | Di bawah 1x         |
| Current Ratio         | Di atas 1,2x        |
| Net Profit Margin     | Positif             |
| Revenue Growth YoY    | Positif             |
| Net Profit Growth YoY | Positif             |
| PER                   | Dibandingkan sektor |
| PBV                   | Dibandingkan sektor |

Untuk saham perbankan, pertambangan, dan perusahaan komoditas, sesuaikan indikator dengan karakteristik bisnisnya.

**Jangan langsung membeli saham yang lolos screener fundamental.** Kita masih perlu memastikan tren teknikalnya mendukung.

## **3. Membuat screener langsung di Stockbit**

Stockbit mendukung pembuatan screener sendiri dengan kombinasi kriteria fundamental dan teknikal, serta fitur Saved Screener untuk menyimpan konfigurasi.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://help.stockbit.com\&sz=32)

Stockbit+1



Saya menyarankan membuat tiga screener terpisah agar hasilnya tidak terlalu sempit.

**SCREEN 01 — MOMENTUM**

Wajib

Nama Saved Screener: `EZYS_MOMENTUM_EOD`

| Rule       | Kondisi                  |
| ---------- | ------------------------ |
| Price      | Greater than Rp100       |
| EMA 8      | Greater than EMA 18      |
| EMA 18     | Greater than EMA 200     |
| RSI 14     | 50–68                    |
| ADX 14     | Greater than 20          |
| Volume     | Greater than Volume MA20 |
| Value MA20 | Greater than Rp1 miliar  |

Jika Stockbit menyediakan Ratio vs Ratio, gunakan Volume ≥ 1,5 × Volume MA20 untuk aturan volume.

**SCREEN 02 — VALUE GROWTH**

Wajib

Nama Saved Screener: `EZYS_VALUE_GROWTH`

| Rule              | Kondisi           |
| ----------------- | ----------------- |
| ROE               | Greater than 10%  |
| DER               | Less than 1       |
| Current Ratio     | Greater than 1,2  |
| Net Profit Margin | Greater than 0    |
| Revenue Growth    | Greater than 0    |
| Net Profit Growth | Greater than 0    |
| PER               | Evaluasi sektoral |
| PBV               | Evaluasi sektoral |

**SCREEN 03 — COMBINED**

Final shortlist

Nama Saved Screener: `EZYS_COMBINED_EOD`

Gabungkan filter likuiditas, tren, dan fundamental yang tersedia di Stockbit. Gunakan hasilnya sebagai shortlist, kemudian hitung scoring dan risiko secara terpisah.

**Cara membuatnya:**

1. Login ke Stockbit.
2. Pilih menu Screener.
3. Klik Create Screener.
4. Pilih Stock Universe: IHSG.
5. Klik Add a Rule.
6. Tambahkan kriteria satu per satu.
7. Klik Screen.
8. Simpan dengan nama yang sudah ditentukan.

Panduan resmi: [Cara Membuat Screener Sendiri di Stockbit](https://help.stockbit.com/id/article/screener-bagaimana-cara-membuat-screener-sendiri-1mialns/?utm_source=chatgpt.com).

Catatan: tidak semua rule harus dipasang dalam satu screener. Beberapa indikator lebih baik diperiksa di Chartbit agar kita tidak kehilangan kandidat akibat filter yang terlalu ketat.

## **4. Scoring gabungan 100 poin**

Setelah mendapatkan hasil ketiga screener, lakukan penilaian berikut.

| Komponen                  | Poin maksimum |
| ------------------------- | ------------- |
| Trend EMA                 | 15            |
| RSI + MACD                | 10            |
| Volume                    | 10            |
| Breakout / Pullback       | 10            |
| Relative Strength vs IHSG | 5             |
| ROE                       | 7             |
| Revenue Growth            | 5             |
| Net Profit Growth         | 5             |
| Net Profit Margin         | 5             |
| DER                       | 4             |
| Current Ratio             | 3             |
| PER                       | 3             |
| PBV                       | 3             |
| Likuiditas                | 5             |
| Trade setup quality       | 5             |
| Data completeness         | 5             |
| **Total**                 | **100**       |

### **Interpretasi skor**

| Skor        | Keputusan                |
| ----------- | ------------------------ |
| 85–100      | Prioritas analisis entry |
| 75–84       | Watchlist                |
| 65–74       | Observasi                |
| Di bawah 65 | Reject                   |

Pengecualian: saham yang terkena hard filter tetap ditolak, meskipun skornya tinggi.

Jangan memberi nilai penuh kepada indikator yang datanya tidak tersedia. Gunakan status `N/A`, lalu tandai skor sebagai provisional sampai data lengkap.

## **5. Entry, stop loss, dan take profit**

Lakukan pemeriksaan Chartbit pada timeframe Daily.

[Trade Spotlight: How should you trade LTIMindtree, JSW Steel, Cyient, GHCL, Muthoot Finance, TTML, and others on Friday?](https://images.openai.com/static-rsc-4/v2lP6SXx0Rn_f_mQLgKD40rjHeLnAyEtJ6n_WsSZLrjsUahZkFV92P0LfMed_CzJhwhkVHjXqUhagEL7nZvu6h-7WZ8MBR-kVAV_aQMMFp5yktlfmhGLmnbI4Su5kzKQRTpi7AqIKo5eI4-HTOlNZ-JEJqtuiud95LE0al7efmM?purpose=inline)

[moneycontrol.com](https://www.moneycontrol.com/news/business/markets/trade-spotlight-how-should-you-trade-ltimindtree-jsw-steel-cyient-ghcl-muthoot-finance-ttml-and-others-on-friday-12889013.html?utm_source=chatgpt.com)

**Setup A — Breakout**

- Identifikasi resistance dari beberapa puncak harga sebelumnya.
- Tunggu candle Daily ditutup di atas resistance.
- Pastikan volume minimal 1,5 kali rata-rata 20 hari.
- Jangan mengejar harga jika sudah terlalu jauh dari titik breakout.

**Setup B — Pullback**

- Harga berada dalam tren naik.
- Tunggu koreksi menuju EMA18 atau support.
- Cari candle reversal.
- Entry hanya setelah ada konfirmasi pembeli.

### **Formula trading plan**

\\[ SL = Support - 0,2 \times ATR(14) \\]

\\[ Risk = Entry - SL \\]

\\[ TP_1 = Entry + 1R \\]

\\[ TP_2 = Entry + 2R \\]

Jika resistance kuat berada sebelum TP2, jangan memaksakan target. Turunkan ekspektasi atau batalkan setup apabila R/R tidak lagi memenuhi 1:2.

**Aturan penting:** seluruh perhitungan menggunakan harga aktual yang sudah tersedia di Stockbit, bukan harga prediksi.

## **6. Position sizing — modal Rp1 juta**

Risk budget Rp20.000

Rumus:

\\[ RiskBudget = 1.000.000 \times 2\\% \\]

\\[ Lot = \left\lfloor \frac{20.000} {(Entry-SL)\times100} \right\rfloor \\]

Kemudian batasi lagi berdasarkan kemampuan modal membeli saham.

Berikut contoh simulasi menggunakan angka ilustratif, bukan harga saham BEI aktual:

| Parameter                       | Simulasi    |
| ------------------------------- | ----------- |
| Modal                           | Rp1.000.000 |
| Entry                           | Rp500       |
| Stop loss                       | Rp450       |
| Risiko per saham                | Rp50        |
| Risiko per lot                  | Rp5.000     |
| Maksimum lot berdasarkan risiko | 4 lot       |
| Nilai pembelian                 | Rp200.000   |
| Risiko nominal                  | Rp20.000    |
| Target 2R                       | Rp600       |

Angka belum memasukkan biaya transaksi.

### **Kalkulator position sizing**

Berikut kalkulator yang bisa dipakai untuk mengevaluasi kandidat dari Stockbit.

**Stockbit Trading Calculator**

Modal trading (Rp)

Entry (Rp)

Stop Loss (Rp)

Risk (%)

Biaya beli (%)

Biaya jual (%)

**Hasil perhitungan**

Batas risiko

# **Rp20.000**

Jumlah lot

# **3 lot**

Nilai pembelian + fee

**Rp150.225**

Estimasi risiko

**Rp15.563**

Target profit 2R

**Rp600**

Sisa modal

**Rp849.775**



Position size tersedia



Estimasi risiko sudah memasukkan fee beli dan jual berdasarkan persentase input. Target 2R belum memasukkan biaya jual pada perhitungan profit. Sesuaikan fee dengan tarif aktual broker Stockbit. Perhitungan belum membulatkan harga berdasarkan fraksi BEI.

## **7. Laporan kandidat harian**

Setiap hari setelah market tutup, buat laporan dengan format berikut.

**EZYSaham Daily Report**

EOD

# **Combined Market Scanner**

Tanggal dan data penutupan: otomatis mengikuti sesi terakhir yang valid.

**Market Overview**

| Indikator        | Status        |
| ---------------- | ------------- |
| IHSG trend       | Menunggu data |
| Market breadth   | Menunggu data |
| Leading sector   | Menunggu data |
| Market condition | Belum dinilai |

**Top 5 Candidates**

| Saham | Score | Setup | Status |
| ----- | ----- | ----- | ------ |
| —     | —     | —     | WAIT   |
| —     | —     | —     | WAIT   |
| —     | —     | —     | WAIT   |
| —     | —     | —     | WAIT   |
| —     | —     | —     | WAIT   |

**Trading Plan**

| Parameter | Sumber         |
| --------- | -------------- |
| Entry     | Chartbit EOD   |
| Stop Loss | Support + ATR  |
| TP1       | 1R             |
| TP2       | 2R             |
| Lot       | Kalkulator     |
| Risk      | Maks. Rp20.000 |

**Decision**

- BUY SETUP: sudah memenuhi semua syarat.
- WAIT: kandidat bagus, belum ada konfirmasi.
- NO TRADE: risiko atau setup tidak layak.

Tidak ada saham yang wajib masuk laporan sebagai BUY. Jika tidak ada kandidat yang lolos, laporan harus menyatakan `NO TRADE TODAY`.

## **8. Rutinitas menggunakan Stockbit**

Saya menyarankan alur yang tidak membutuhkan pemantauan intraday.

**Setelah market tutup**

1. Jalankan `EZYS_MOMENTUM_EOD`.
2. Jalankan `EZYS_VALUE_GROWTH`.
3. Gabungkan hasil dan pilih maksimal 10 saham.
4. Buka Chartbit Daily untuk validasi setup.
5. Hitung entry, SL, TP dan lot.
6. Simpan maksimal 3–5 saham ke watchlist.

**Sebelum market buka**

1. Periksa berita dan corporate action.
2. Periksa gap harga dan kondisi pasar.
3. Siapkan order berdasarkan trading plan.
4. Batalkan rencana jika harga sudah melewati batas entry.

Stockbit menyediakan Saved Screener dan preset Value Momentum serta Technical untuk membantu workflow ini. Namun, pembuatan laporan harian otomatis dan kalkulasi position sizing tetap memerlukan proses pendamping; jangan menganggap tombol Screen otomatis menjalankan seluruh sistem tersebut.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://help.stockbit.com\&sz=32)

Stockbit+2



## **9. Checklist sebelum membeli saham**

**Pre-Trade Checklist**

0/10 selesai

Data EOD sudah lengkap dan valid

Saham lolos filter likuiditas

EMA 8 > EMA 18 dan tren mendukung

RSI dan volume mendukung momentum

Fundamental sudah diperiksa

Tidak ada berita atau corporate action berisiko

Entry dan support sudah ditentukan

Stop loss sudah ditentukan

Risk/Reward minimal 1:2

Jumlah lot tidak melebihi modal dan risk budget

Jangan mengambil posisi sebelum seluruh pemeriksaan yang relevan selesai.

Reset checklist

## **10. Rekomendasi saya**

Untuk tahap awal, gunakan tiga preset tersimpan berikut:

1. `EZYS_MOMENTUM_EOD`
2. `EZYS_VALUE_GROWTH`
3. `EZYS_COMBINED_EOD`

Mulai dengan paper trading dan catat minimal 20–30 transaksi sebelum menilai apakah sistem menghasilkan keunggulan yang konsisten.

Satu hal yang perlu dijaga: dengan modal Rp1 juta dan batas risiko Rp20 ribu, jangan memaksakan 3 posisi sekaligus. Satu posisi berkualitas atau bahkan tidak melakukan transaksi lebih baik daripada mengambil tiga posisi dengan risiko yang tidak terkendali.

**Referensi Stockbit:**

- [Panduan Screener Stockbit](https://help.stockbit.com/id/article/screener-bagaimana-cara-menggunakan-dan-apa-fungsinya-24j2qc/?utm_source=chatgpt.com).
- [Membuat Custom Screener](https://help.stockbit.com/id/article/screener-bagaimana-cara-membuat-screener-sendiri-1mialns/?utm_source=chatgpt.com).
- [Stockbit Pro Screener dan Financial Metrics](https://stockbit.com/info/pro-tools/screener?utm_source=chatgpt.com).
- [Screener Bandarmology](https://help.stockbit.com/id/article/screener-cara-menggunakan-screener-bandarmology-1d9j3q4/?utm_source=chatgpt.com).

*Catatan: konfigurasi di atas merupakan rancangan sistem dan panduan operasional. Belum ada hasil screening aktual karena data EOD dari akun Stockbit Anda belum diberikan.*