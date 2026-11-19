# **EzySaham Entry Finder — Combined Strategy 3–10 Days**

Kita tetapkan EzySaham agar tidak hanya mencari saham yang sudah naik dan menembus resistance. Sistem juga harus bisa menemukan saham yang masih berada dekat support, sebelum breakout terjadi.

Artinya, EzySaham akan mencari peluang melalui tiga jalur:

1. **Early Entry:** membeli dekat support sebelum breakout.
2. **Breakout Entry:** membeli setelah resistance berhasil ditembus.
3. **Pullback Entry:** membeli ketika harga kembali menguji area breakout atau support dinamis setelah tren menguat.

Ketiganya menggunakan satu mesin penilaian risiko. Tidak ada strategi yang boleh menghasilkan sinyal BUY jika gagal melewati hard risk gate.

## **1. Konfigurasi utama**

**EzySaham Entry Finder**

Combined

Modal trading

# **Rp1 juta**

Risiko maksimal/trade

# **3%**

Rp30.000

Target keuntungan

# **10%**

Target minimum kotor

Rekomendasi harian

# **5 saham**

Maksimal, bukan wajib

| Parameter      | Konfigurasi                                         |
| -------------- | --------------------------------------------------- |
| Strategi       | Combined                                            |
| Holding period | 3–10 hari bursa                                     |
| Timeframe      | Daily / EOD                                         |
| Indikator tren | EMA8, EMA20, EMA200                                 |
| Momentum       | RSI14                                               |
| Volatilitas    | ATR14                                               |
| Volume         | Relative Volume                                     |
| Resistance     | Highest High 20 hari sebelumnya                     |
| Support        | Swing low terkonfirmasi                             |
| Likuiditas     | Rata-rata nilai transaksi 20 hari ≥ Rp1 miliar/hari |
| Stop loss      | Maksimal 8% dan 2,5 ATR                             |
| Reward/Risk    | Minimal 1:2 setelah estimasi biaya                  |

**Prinsip utama:** target 10% bukan jaminan keuntungan. Sistem hanya boleh merekomendasikan transaksi jika harga target secara teknikal masuk akal dan risiko masih memenuhi ketentuan.

## **2. Rule engine tiga strategi**

### **A. Early Entry — beli dekat support**

Entry sebelum breakout

Tujuannya mencari saham yang sedang turun atau berkonsolidasi, tetapi mulai menunjukkan tanda bahwa pembeli mempertahankan area support.

[All 12 Candlestick Chart Patterns in the Stock Market Hindi - InvestExpert Academy : Making Sense Of Investing](https://images.openai.com/static-rsc-4/aUdf_pE4F-c2IPkgx-TUuwPPIeYP4X0viCoIYXANNagm2OWgyc6H0aK6U9CiQp7SoIpgpjhPLcWo0PM254L0tZrU9KGH0DwA_vCbjs_jE_mV3YmMHWUUhFky4NJ-DQq5j7s599s8qy3UB0b4u70SfKalsfXxCkQBRdLpfz6jDOg?purpose=inline)

[investexpert.app](https://www.investexpert.app/all-12-candlestick-chart-patterns-in-the-stock-market-hindi?utm_source=chatgpt.com)

**Kondisi setup:**

| Rule          | Persyaratan                                                |
| ------------- | ---------------------------------------------------------- |
| Support       | Swing low terkonfirmasi                                    |
| Jarak harga   | Close maksimal 1 ATR di atas support                       |
| Candle        | Bullish candle, close di atas open                         |
| Posisi candle | Close berada di bagian atas 50% range                      |
| RSI14         | 45–65 dan tidak menunjukkan pelemahan ekstrem              |
| Volume        | Tidak ada lonjakan volume distribusi                       |
| Tren          | Tidak sedang mengalami penurunan tajam yang belum terhenti |

Support tidak boleh ditentukan hanya dari satu candle terendah. Gunakan swing low yang terkonfirmasi, misalnya pivot dengan dua candle di kiri dan dua candle di kanan. Karena itu, pivot baru dapat digunakan setelah dua candle berikutnya selesai.

**Entry rule:**

- Entry indikatif: harga penutupan candle konfirmasi.
- Entry eksekusi: harga pembukaan sesi berikutnya atau harga lain yang benar-benar tersedia.
- Jika harga pembukaan terlalu jauh dari entry indikatif, batalkan atau hitung ulang rencana.
- Jika support ditembus sebelum eksekusi, sinyal dibatalkan.

Early Entry tidak harus menunggu harga menembus resistance. Tetapi harus ada bukti awal bahwa support bertahan.

### **B. Breakout Entry — beli setelah resistance ditembus**

Entry setelah konfirmasi

[Breakout Trading Strategy (Step-by-Step Guide for 2026)](https://images.openai.com/static-rsc-4/yDCzoWcrHRY0LiKVV9oUwcgeC6MZoSRE14trgVOgZK4A15w5a8K7j_wY9MM92alDGmNHqeFylN-INdXDthM6Wi4a90apZNFl_67sVY1YffZJ_e2zi-P8XSpjpmNkxNufDZ1wqI3qlNHZqbtLeRXm_PQFyLive5Kb9vQW-rhFqbs?purpose=inline)

[edgebreak.ai](https://www.edgebreak.ai/blog.html?utm_source=chatgpt.com)

**Kondisi setup:**

| Rule          | Persyaratan                             |
| ------------- | --------------------------------------- |
| Resistance    | Highest High 20 candle sebelumnya       |
| Breakout      | Close di atas resistance                |
| Volume        | RVOL ≥ 1,5×                             |
| Candle        | Bullish                                 |
| Posisi candle | Close berada di 25% bagian atas range   |
| Tren          | EMA8 > EMA20                            |
| Momentum      | RSI14 50–70                             |
| Extension     | Jarak harga dari EMA20 maksimal 1,5 ATR |

Rumus resistance:

\\[ R\_{20}=\max(High\_{t-20},...,High\_{t-1}) \\]

Candle hari ini tidak boleh dimasukkan dalam perhitungan resistance.

**Entry rule:**

- Konfirmasi setelah candle breakout ditutup.
- Entry pada sesi berikutnya.
- Jangan mengejar harga jika gap naik membuat stop loss atau reward/risk tidak lagi memenuhi syarat.
- Jika harga kembali masuk ke bawah resistance sebelum eksekusi, evaluasi ulang sinyal.

### **C. Pullback Entry — beli setelah harga melakukan retest**

Entry setelah koreksi sehat

[Chiến lược đầu tư theo xu hướng (Trend Following): MA, ADX, Breakout, Pullback | Vecomda](https://images.openai.com/static-rsc-4/TwZ1jh4rsWCXpWswcxFY__ZWrjbq56Egu9kSLRkUgiX6GWLn_7j3vPqZMxWQIrES9gPnihcWXdhmudwAAYn1djpflQZUYGrwejn3wKCEiof-efLm_MNvUxE9CmNjOWgXzL0eL9luBM55xQmbIuikkHwOPcfGd_a37XCtzhFLPg4?purpose=inline)

[vecomda.com](https://vecomda.com/info/kien-thuc/chien-luoc-theo-xu-huong?utm_source=chatgpt.com)

**Kondisi setup:**

| Rule           | Persyaratan                                                      |
| -------------- | ---------------------------------------------------------------- |
| Tren           | EMA8 > EMA20                                                     |
| Harga          | Close berada di atas EMA20                                       |
| Pullback       | Harga mendekati EMA8, EMA20, atau resistance yang telah ditembus |
| Volume koreksi | Cenderung menurun                                                |
| Konfirmasi     | Candle bullish setelah retest                                    |
| RSI14          | 45–70                                                            |
| Extension      | Maksimal 1,5 ATR dari EMA20                                      |

**Entry rule:**

- Tunggu harga menguji area support dinamis atau resistance yang berubah menjadi support.
- Volume saat koreksi idealnya lebih kecil daripada volume saat kenaikan.
- Entry setelah muncul candle bullish konfirmasi.
- Batalkan jika area retest ditembus secara meyakinkan.

## **3. Scoring engine — penilaian 0–100**

Setiap saham akan dinilai berdasarkan kualitas setup, bukan sekadar kenaikan harga.

| Komponen                                     | Bobot   |
| -------------------------------------------- | ------- |
| Tren                                         | 15      |
| RSI / momentum                               | 10      |
| Volume                                       | 15      |
| Kualitas setup                               | 20      |
| Kualitas candle                              | 10      |
| Posisi terhadap support / resistance / EMA20 | 10      |
| Likuiditas                                   | 10      |
| Reward/Risk                                  | 10      |
| **Total**                                    | **100** |

Nilai masing-masing komponen dihitung sesuai strategi. Contohnya:

- Early Entry mendapatkan skor tinggi jika harga dekat support, support teruji, dan candle bullish.
- Breakout mendapatkan skor tinggi jika resistance ditembus dengan volume besar dan candle kuat.
- Pullback mendapatkan skor tinggi jika tren sehat, volume koreksi mengecil, dan retest berhasil.

**Kategori hasil:**

85–100

**BUY QUALIFIED**

Setup berkualitas dan seluruh hard gate lolos.

70–84

**WATCHLIST**

Potensial, tetapi masih ada syarat konfirmasi atau kualitas yang belum cukup.

Di bawah 70

**WAIT**

Belum memenuhi standar kualitas.

Gagal hard gate

**BLOCKED**

Tidak boleh dibeli meskipun skornya tinggi.

Catatan: skor 85 bukan jaminan saham akan naik. Scoring hanya mengurutkan kandidat yang sudah memenuhi persyaratan.

## **4. Hard risk gate — gerbang wajib sebelum BUY**

Ini bagian terpenting. Hard gate harus dieksekusi setelah scoring, dan tidak boleh dikalahkan oleh skor tinggi.

| Gate             | Aturan                                         | Jika gagal     |
| ---------------- | ---------------------------------------------- | -------------- |
| Data             | OHLCV valid, candle lengkap, tidak duplikat    | DATA_INVALID   |
| Likuiditas       | Nilai transaksi rata-rata 20 hari ≥ Rp1 miliar | BLOCKED        |
| Harga            | Harga ≥ batas auto-rejection BEI yang berlaku  | BLOCKED        |
| Setup            | Salah satu dari 3 setup terdeteksi             | WAIT           |
| Konfirmasi       | Trigger strategi terpenuhi                     | WAIT           |
| Support/struktur | Level stop dapat ditentukan secara teknikal    | BLOCKED        |
| Stop loss        | Jarak SL maksimal 8%                           | BLOCKED        |
| ATR              | Jarak SL maksimal 2,5 ATR                      | BLOCKED        |
| Target           | Potensi target minimal 10%                     | BLOCKED        |
| Reward/Risk      | Net R:R minimal 1:2                            | BLOCKED        |
| Extension        | Maksimal 1,5 ATR di atas EMA20                 | BLOCKED        |
| Distribusi       | Tidak ada sinyal distribusi berat              | BLOCKED        |
| Eksekusi         | Harga masih berada dalam batas entry           | WAIT / BLOCKED |

Ada satu penyempurnaan: harga Rp50 bukan otomatis harga yang layak dibeli. Harga minimum, batas auto-rejection, suspensi, dan kondisi perdagangan harus mengikuti aturan BEI yang berlaku dan data provider.

### **Status hasil rule engine**

- `BUY_QUALIFIED`: seluruh gate lulus dan skor minimal 85.
- `WAIT_CONFIRMATION`: setup terdeteksi, tetapi trigger belum terpenuhi.
- `WAIT_PRICE`: trigger sudah ada, tetapi harga eksekusi sudah terlalu jauh.
- `BLOCKED_RISK`: risiko, SL, target, atau R:R tidak memenuhi.
- `BLOCKED_LIQUIDITY`: likuiditas tidak memenuhi.
- `DATA_INVALID`: data tidak valid atau tidak lengkap.

Dengan demikian, dashboard tidak boleh menampilkan BUY hanya karena saham mendapat skor 90.

## **5. Kalkulasi Entry, Stop Loss, dan Take Profit**

Kita gunakan satu mesin kalkulasi untuk semua strategi, tetapi sumber level harga berbeda.

### **A. Menentukan harga entry**

| Strategi    | Entry indikatif                               |
| ----------- | --------------------------------------------- |
| Early Entry | Close candle bullish konfirmasi dekat support |
| Breakout    | Close candle yang menembus resistance         |
| Pullback    | Close candle bullish setelah retest           |

Harga indikatif bukan berarti harga yang pasti didapat. Untuk eksekusi, gunakan harga aktual yang tersedia pada sesi berikutnya.

### **B. Menentukan stop loss**

Stop loss harus mengikuti struktur teknikal, bukan sekadar mengurangi harga sebesar 3% atau 5%.

Definisikan:

- `Entry`: harga masuk.
- `Support`: level support atau swing low relevan.
- `ATR`: ATR14.
- `Buffer`: jarak pengaman di bawah support.

Rumus awal:

\\[ SL\_{raw}=Support-Buffer \\]

Buffer dapat dikonfigurasi, misalnya:

\\[ Buffer=0.2\times ATR14 \\]

Jarak stop:

\\[ StopDistance=Entry-SL\_{raw} \\]

Hard gate:

\\[ \frac{StopDistance}{Entry}\leq 8\\% \\]

\\[ StopDistance\leq 2.5\times ATR14 \\]

Jika salah satu batas gagal, sistem tidak boleh memaksakan SL lebih dekat hanya agar transaksi lolos. Sistem harus mencari struktur lain atau membatalkan transaksi.

**Penerapan menurut strategi:**

| Strategi    | Dasar SL                                                  |
| ----------- | --------------------------------------------------------- |
| Early Entry | Di bawah swing low support                                |
| Breakout    | Di bawah resistance yang ditembus atau swing low terdekat |
| Pullback    | Di bawah low retest                                       |

### **C. Menentukan take profit**

Target pertama berdasarkan persyaratan Anda:

\\[ TP\_{minimum}=Entry\times1.10 \\]

Tetapi target teknikal juga harus memperhitungkan resistance berikutnya.

\\[ TP=\max(TP\_{minimum},TP\_{struktur}) \\]

Rumus di atas hanya dapat dipakai jika target teknikal memang berada pada atau di atas target minimum. Jika resistance terdekat berada di bawah target minimum dan tidak ada target teknikal lain yang masuk akal, saham harus ditolak.

Reward/Risk kotor:

\\[ RR=\frac{TP-Entry}{Entry-SL} \\]

Untuk keputusan akhir gunakan net reward dan net risk setelah biaya transaksi estimasi:

\\[ NetRR=\frac{NetPotentialProfit}{NetPotentialLoss} \\]

Syarat:

\\[ NetRR\geq2 \\]

### **D. Menghitung jumlah lot**

Modal Rp1.000.000, risiko maksimal 3%.

\\[ RiskBudget=1.000.000\times3\\%=Rp30.000 \\]

Jumlah lot berdasarkan risiko:

\\[ LotRisk= \left\lfloor \frac{RiskBudget-EstimatedFees} {(Entry-SL)\times100} \right\rfloor \\]

Jumlah lot berdasarkan modal:

\\[ LotCapital= \left\lfloor \frac{Capital-EstimatedBuyFees} {Entry\times100} \right\rfloor \\]

Jumlah lot akhir:

\\[ LotFinal=\min(LotRisk,LotCapital) \\]

Semua perhitungan menggunakan pembulatan ke bawah. Sistem juga harus memperhitungkan biaya beli, biaya jual, slippage, fraksi harga, dan ketentuan lot BEI.

**Contoh ilustrasi, bukan rekomendasi harga saham:**

**Simulasi rencana transaksi**

| Komponen           | Nilai   |
| ------------------ | ------- |
| Entry              | Rp1.000 |
| Support            | Rp950   |
| ATR14              | Rp20    |
| Buffer             | Rp4     |
| SL                 | Rp946   |
| Jarak risiko/saham | Rp54    |
| TP minimum         | Rp1.100 |
| Reward/saham       | Rp100   |
| Gross R:R          | 1,85    |

BLOCKED — R:R gagal

R:R 1,85 belum mencapai 1:2. Walaupun target keuntungan 10% tersedia, transaksi tidak lolos.

Ini contoh penting: saham yang terlihat murah dan memiliki target 10% belum tentu layak dibeli jika jarak stop loss terlalu besar.

## **6. Ranking dan pemilihan lima saham harian**

Satu saham bisa terdeteksi oleh lebih dari satu strategi. Karena itu, sistem harus mencegah duplikasi.

Urutan pemilihan:

1. Jalankan tiga setup pada seluruh universe.
2. Kelompokkan hasil berdasarkan kode saham.
3. Jika satu saham memenuhi beberapa setup, simpan strategi dengan skor terbaik dan catat setup lainnya sebagai alternatif.
4. Jalankan seluruh hard gate.
5. Urutkan kandidat yang lolos berdasarkan skor, Net R:R, likuiditas, dan kualitas konfirmasi.
6. Ambil maksimal lima saham.

Prioritas strategi ketika nilai skor sama:

1. Pullback dengan tren sehat.
2. Early Entry dengan support kuat.
3. Breakout dengan volume terkonfirmasi.

Ini bukan berarti Early Entry selalu lebih baik. Ranking akhir tetap menggunakan skor dan risiko.

**Jika hanya ada dua saham yang lolos, tampilkan dua saham. Jangan memaksakan lima rekomendasi setiap hari.**

## **7. Dashboard yang perlu dibangun**

**EzySaham Entry Finder**

EOD Scanner

Saham dipindai

# **—**

BUY qualified

# **—**

Watchlist

# **—**

Blocked

# **—**

**Filter strategi**

Early Entry

Breakout

Pullback

**Tabel rekomendasi**

| Saham       | Strategi | Skor | Status |
| ----------- | -------- | ---- | ------ |
| Data aktual | Early    | —    | —      |
| Data aktual | Breakout | —    | —      |
| Data aktual | Pullback | —    | —      |

Tampilan ini merupakan rancangan dashboard. Angka dan saham akan berasal dari hasil pemindaian EOD, bukan data contoh.

Setiap saham perlu memiliki halaman detail:

- Grafik candlestick dan EMA8/20/200.
- Support dan resistance.
- Posisi entry, SL, dan TP.
- Skor setiap komponen.
- Status setiap hard gate.
- Alasan BUY, WAIT, atau BLOCKED.
- Estimasi lot dan modal.
- Tanggal kedaluwarsa sinyal.
- Tombol tambah ke watchlist dan jurnal transaksi.

## **8. Spesifikasi rule engine untuk developer**

Saya menyarankan memisahkan empat bagian agar sistem mudah diuji dan dikembangkan.

\#chatgpt-mermaid-\_r_1a7\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_1a7\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1a7\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_1a7\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_1a7\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_1a7\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_1a7\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_1a7\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_1a7\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_1a7\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1a7\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1a7\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_1a7\_ p{margin:0;}#chatgpt-mermaid-\_r_1a7\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_1a7\_ .label text,#chatgpt-mermaid-\_r_1a7\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .node rect,#chatgpt-mermaid-\_r_1a7\_ .node circle,#chatgpt-mermaid-\_r_1a7\_ .node ellipse,#chatgpt-mermaid-\_r_1a7\_ .node polygon,#chatgpt-mermaid-\_r_1a7\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .rough-node .label text,#chatgpt-mermaid-\_r_1a7\_ .node .label text,#chatgpt-mermaid-\_r_1a7\_ .image-shape .label,#chatgpt-mermaid-\_r_1a7\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_1a7\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .rough-node .label,#chatgpt-mermaid-\_r_1a7\_ .node .label,#chatgpt-mermaid-\_r_1a7\_ .image-shape .label,#chatgpt-mermaid-\_r_1a7\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_1a7\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_1a7\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1a7\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1a7\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_1a7\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1a7\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1a7\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1a7\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_1a7\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_1a7\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_1a7\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_1a7\_ .icon-shape,#chatgpt-mermaid-\_r_1a7\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_1a7\_ .icon-shape p,#chatgpt-mermaid-\_r_1a7\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_1a7\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_1a7\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_1a7\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_1a7\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_1a7\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_1a7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_1a7\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_1a7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_1a7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1a7\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_1a7\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_1a7\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1a7\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_1a7\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_1a7\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_1a7\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .node rect,#chatgpt-mermaid-\_r_1a7\_ .node circle,#chatgpt-mermaid-\_r_1a7\_ .node ellipse,#chatgpt-mermaid-\_r_1a7\_ .node polygon,#chatgpt-mermaid-\_r_1a7\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_1a7\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_1a7\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_1a7\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_1a7\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_1a7\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}EOD Market DataData ValidationUniverse ScreenerIndicator EngineSetup DetectionScoring EngineHard Risk GateSemua gate lolos?WAIT / BLOCKEDEntry / SL / TP CalculatorNet R:R = 2?Ranking & Top 5Dashboard & WatchlistTidakYaTidakYa

### **Struktur modul**

| Modul                 | Tanggung jawab                           |
| --------------------- | ---------------------------------------- |
| `MarketDataService`   | Mengambil dan menormalisasi data         |
| `DataValidator`       | Memeriksa kelengkapan dan konsistensi    |
| `IndicatorEngine`     | EMA, RSI, ATR, RVOL                      |
| `UniverseScreener`    | Memilih saham yang likuid                |
| `EarlyEntryDetector`  | Mendeteksi peluang dekat support         |
| `BreakoutDetector`    | Mendeteksi resistance breakout           |
| `PullbackDetector`    | Mendeteksi retest                        |
| `ScoringEngine`       | Menghitung skor                          |
| `RiskGateEngine`      | Menjalankan hard gate                    |
| `TradePlanCalculator` | Menghitung entry, SL, TP, lot            |
| `RankingEngine`       | Mengambil maksimal lima kandidat         |
| `ExplanationService`  | Menjelaskan hasil dalam bahasa sederhana |

### **Contoh kontrak TypeScript**

```

type EntryStrategy =
  | "EARLY_ENTRY"
  | "BREAKOUT"
  | "PULLBACK";

type SignalStatus =
  | "BUY_QUALIFIED"
  | "WAIT_CONFIRMATION"
  | "WAIT_PRICE"
  | "BLOCKED_RISK"
  | "BLOCKED_LIQUIDITY"
  | "DATA_INVALID";

interface EntryFinderConfig {
  capital: number;
  riskPercent: number;
  minimumTargetPercent: number;
  minimumNetRR: number;
  minimumScore: number;
  maxDailyRecommendations: number;
  maxStopLossPercent: number;
  maxStopAtr: number;
  maxExtensionAtr: number;
  minimumLiquidity20D: number;
  holdingDaysMin: number;
  holdingDaysMax: number;
}

interface TradePlan {
  symbol: string;
  strategy: EntryStrategy;
  referencePrice: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  lots: number;
  riskAmount: number;
  potentialProfit: number;
  netRewardRisk: number;
  score: number;
  status: SignalStatus;
  gateResults: {
    name: string;
    passed: boolean;
    reason: string;
  }[];
}

```

### **Pseudocode inti**

```

async function analyzeStock(stock, config) {
  const validation = validateMarketData(stock);

  if (!validation.valid) {
    return blocked("DATA_INVALID");
  }

  const indicators = calculateIndicators(stock);
  const universe = screenLiquidity(stock);

  if (!universe.passed) {
    return blocked("BLOCKED_LIQUIDITY");
  }

  const setups = [
    detectEarlyEntry(stock, indicators),
    detectBreakout(stock, indicators),
    detectPullback(stock, indicators),
  ].filter(setup => setup.detected);

  const candidates = [];

  for (const setup of setups) {
    const score = scoreSetup(
      stock,
      indicators,
      setup
    );

    const plan = calculateTradePlan(
      stock,
      indicators,
      setup,
      config
    );

    const gates = runHardRiskGates(
      stock,
      indicators,
      setup,
      plan,
      config
    );

    candidates.push({
      setup,
      score,
      plan,
      gates
    });
  }

  return rankStrategyCandidates(candidates);
}

```

Pseudocode ini adalah rancangan logika, bukan kode produksi siap pakai. Detail perhitungan indikator, pembulatan harga, validasi kalender perdagangan, dan biaya transaksi perlu dibuat unit test.

## **9. Backtesting sebelum digunakan dengan uang sungguhan**

Saya tidak menyarankan langsung mengaktifkan sinyal BUY sebelum ketiga strategi diuji secara terpisah.

Metrik yang harus ditampilkan:

| Metrik               | Tujuan                              |
| -------------------- | ----------------------------------- |
| Win rate             | Persentase transaksi profit         |
| Average R            | Rata-rata hasil dalam satuan risiko |
| Profit factor        | Gross profit / gross loss           |
| Maximum drawdown     | Penurunan modal maksimum            |
| Expectancy           | Ekspektasi hasil per transaksi      |
| False breakout rate  | Persentase breakout gagal           |
| Average holding days | Durasi kepemilikan                  |
| Slippage             | Selisih harga rencana dan eksekusi  |

Lakukan pengujian:

- Early Entry saja.
- Breakout saja.
- Pullback saja.
- Combined.
- Kondisi bullish, bearish, dan sideways.

Pastikan backtest tidak menggunakan informasi masa depan. Pivot support yang memerlukan dua candle konfirmasi hanya boleh dianggap tersedia setelah kedua candle tersebut selesai. Masukkan biaya transaksi, slippage, suspensi, dan saham yang sudah delisting dalam pengujian historis jika datanya tersedia.

## **10. Urutan implementasi**

| Tahap | Pekerjaan                        | Hasil                       |
| ----- | -------------------------------- | --------------------------- |
| 1     | Audit EzySaham dan provider data | Peta sistem existing        |
| 2     | Normalisasi data dan indikator   | Data EOD tervalidasi        |
| 3     | Implementasi 3 setup detector    | Early, Breakout, Pullback   |
| 4     | Scoring dan hard gate            | Mesin seleksi               |
| 5     | Trade plan calculator            | Entry, SL, TP, lot          |
| 6     | Dashboard dan watchlist          | Tampilan rekomendasi        |
| 7     | Backtesting dan paper trading    | Validasi strategi           |
| 8     | Production deployment            | Entry Finder siap digunakan |

Estimasi awal sekitar 20–30 hari kerja untuk satu developer, dengan asumsi akses data saham dan sistem EzySaham yang ada sudah dapat digunakan.

## **Keputusan final desain**

**EzySaham Entry Finder 3–10 Days**

Konfigurasi ditetapkan

1. Combined: Early Entry + Breakout + Pullback.
2. Early Entry wajib dekat support dengan candle bullish.
3. Modal Rp1 juta dan risiko maksimal Rp30 ribu per transaksi.
4. Target keuntungan minimal 10% dan Net R:R minimal 1:2.
5. Stop loss maksimal 8% dan 2,5 ATR.
6. Skor minimal 85 untuk BUY QUALIFIED.
7. Maksimal lima rekomendasi per hari, boleh nol.
8. EOD only, tidak menggunakan sinyal intraday.

**Satu hal yang ingin saya tekankan:** EzySaham harus mencari harga masuk yang menarik, bukan sekadar saham yang sedang ramai dibeli. Early Entry memberikan kesempatan masuk lebih awal, tetapi tetap harus membuktikan bahwa support bertahan dan potensi keuntungan sebanding dengan risikonya.

Langkah berikutnya yang paling tepat adalah mengaudit repository EzySaham versi 3 dan sumber data yang sudah digunakan, kemudian menerapkan spesifikasi ini tanpa merusak fitur yang sudah berjalan.