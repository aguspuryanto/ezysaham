Menentukan apakah suatu saham sudah mencapai *bottom* (harga terendah) adalah salah satu tantangan terbesar dalam investasi dan trading. Tidak ada indikator tunggal yang 100% akurat, tetapi para pelaku pasar biasanya mengombinasikan **3 pendekatan utama** untuk mendeteksi sinyal *bottoming*:

---

### 1. Analisis Teknikal (Sinyal Grafik)

* **Volume Spiking / Capitulation:** Terjadi lonjakan volume transaksi yang sangat tinggi saat harga anjlok tajam, disusul dengan perlawanan pembalikan arah (*reversal*). Ini menandakan *panic selling* terakhir di mana pemegang saham menyerah dan *smart money* mulai menampung (*accumulation*).
* **Pola Reversal (Price Action):**
* *Double Bottom* atau *Triple Bottom*: Harga menguji level *support* yang sama dua atau tiga kali tanpa menembus ke bawahnya.
* *Bullish Divergence*: Indikator seperti **RSI** atau **MACD** membentuk puncak lebih tinggi (*higher low*), padahal grafik harga saham masih membuat dasar lebih rendah (*lower low*).


* **Moving Averages (MA):** Harga mulai memotong ke atas MA pendek (seperti MA20 atau MA50) setelah lama berada di bawahnya, ditandai dengan terbentuknya *higher low*.

---

### 2. Analisis Valuasi & Fundamental

* **Historical Valuation Discount:** Valuasi saham (seperti **PBV** atau **PER**) sudah berada di bawah standar deviasi -2 ($-2\text{ SD}$) dari rata-rata historis 5 tahunnya.
* **Margin of Safety (Net-Net Asset / Discount to NAV):** Harga saham diperdagangkan di bawah nilai aset bersihnya (*Net Asset Value*) atau bahkan lebih rendah dari jumlah kas bersih per saham yang dimiliki perusahaan.
* **Dividen Yield Tinggi:** Ketika harga turun tajam tetapi fundamental bisnis tetap solid, *dividend yield* menjadi sangat menarik (misal di atas 8–10%). Hal ini biasanya memicu daya tarik bagi investor institusi untuk masuk.

---

### 3. Analisis Bandarmologi & Sentimen Pasar

* **Broker Summary (Akumulasi Institusi):** Terjadi akumulasi berturut-turut oleh broker-broker besar (khususnya asing/institusi) di saat harga cenderung bergerak menyamping (*sideways*) di area *support*.
* **Extreme Pessimism:** Sentimen publik dan media sangat negatif terhadap saham tersebut. Dalam istilah pasar: *"Buy when there's blood in the streets"*.

---

### Strategi Mengurangi Risiko

1. **Cicil Pembelian (*DCA / Staggered Entry*):** Jangan langsung *full power* (All-in) di satu titik. Bagi peluru menjadi 3–4 porsi pembelian.
2. **Tunggu Konfirmasi (*Wait for Confirmation*):** Lebih aman membeli saat harga sudah mulai mengonfirmasi arah pembalikan (membentuk *higher low*) daripada mencoba memotong pisau jatuh (*catching a falling knife*).
3. **Disiplin Stop Loss / Cut Loss:** Tetapkan garis toleransi risiko jika harga ternyata masih menembus level *support* terendah sebelumnya.

Untuk kebutuhan modul *stock screening* dan *decision support* di **EzySaham**, indikator *bottoming* perlu dikuantifikasi menjadi kriteria/rumus logis berbasis data agar bisa diproses secara otomatis oleh sistem.

Berikut adalah **4 indikator kuantitatif & algoritma penanda *bottoming*** yang paling efektif dipasang pada fitur *screener* atau *dashboard* EzySaham:

---

## 1. Indikator Teknikal & Price Action

* **RSI Bullish Divergence (Level Oversold):**
* **Kriteria Logis:** RSI(14) berada di area *oversold* ($<30$). Ketika harga saham membuat *Lower Low* ($P_2 < P_1$), grafik RSI justru membuat *Higher Low* ($RSI_2 > RSI_1$).
* **Fungsi Sistem:** Mengidentifikasi momentum penurunan yang mulai habis meski harga masih terseret turun.


* **Volume Spiking (Capitulation Day):**
* **Kriteria Logis:** Volume harian $> 2,5 \times \text{Average Volume 20 Hari}$ (MA20 Volume) saat harga berada di area *support* atau candle *doji / hammer* (ekor bawah panjang $\ge 60\%$ dari total panjang candle).
* **Fungsi Sistem:** Menandakan *panic selling* puncaknya (pembersihan pemegang saham *retail*) yang ditampung oleh *smart money*.


* **Penembusan Dynamic Resistance:**
* **Kriteria Logis:** Closing price memotong ke atas EMA 20 setelah minimal 20 hari bursa bergerak di bawahnya, diiringi terbentuknya pola *higher low*.



---

## 2. Indikator Valuasi Historis (Fundamental Discount)

* **PBV & PER Band ($\le -2\text{ Standard Deviation}$):**
* **Kriteria Logis:** Valuasi $PBV_{\text{current}} \le \mu_{\text{PBV 5Y}} - 2\sigma$ ATAU $PER_{\text{current}} \le \mu_{\text{PER 5Y}} - 2\sigma$.
* **Fungsi Sistem:** Menandakan secara statistik harga saham sudah berada di titik termurah dalam kurun waktu 5 tahun terakhir.


* **Dividend Yield Threshold:**
* **Kriteria Logis:** *Yield* dividen berjalan melebihi $1,5 \times \text{Rata-rata Yield 5 Tahun}$ atau melebihi *yield* Obligasi Pemerintah 10-Tahun (SBR/FR).



---

## 3. Indikator Flow & Bandarmologi

* **Akumulasi Broker Beruntun (Big Accumulation):**
* **Kriteria Logis:** *Top 3 Broker Buyer* menguasai $> 60\%$ dari total volume beli harian selama 3–5 hari berturut-turut saat harga saham cenderung *sideways* / rentang tipis ($\le 2\%$ per hari).


* **Foreign Net Flow Reversal:**
* **Kriteria Logis:** *Foreign Net Flow* (5 hari) berubah dari *Net Sell* masif menjadi *Net Buy* berturut-turut selama minimal 3 hari di area harga terendah.



---

## 4. Sistem Scoring Bottom EzySaham (Ezy-Bottom Score)

Agar pengguna EzySaham mendapat sinyal yang mudah dipahami, kamu bisa menggabungkan variabel di atas ke dalam **Skor Konfirmasi 0–100**:

| Komponen Indikator | Bobot | Syarat Terpenuhi |
| --- | --- | --- |
| **RSI / MACD Divergence** | $30\%$ | Membentuk *Bullish Divergence* pada timeframe Daily |
| **Capitulation Volume** | $20\%$ | Volume $> 2,5\times$ MA20 Volume + Ekor bawah candle panjang |
| **PBV / PER Discount** | $20\%$ | Valuasi di bawah $-2\text{ SD}$ dari historisnya |
| **Big Accumulation (Bandar)** | $20\%$ | *Top 3 Broker Accumulation* selama $\ge 3$ hari berturut-turut |
| **Breakout EMA20** | $10\%$ | *Close Price* berhasil naik di atas EMA20 |

> **Logika Alert EzySaham:**
> * **Skor 80 – 100:** *Strong Bottom Signal* (Area Akumulasi Sangat Potensial)
> * **Skor 60 – 79:** *Potential Bottom* (Perlu Konfirmasi Reversal)
> * **Skor < 60:** *Downtrend Active* (Belum Ada Sinyal Strong Bottom)

Berikut adalah rancangan logika kuantitatif dan **pseudocode** untuk modul *Ezy-Bottom Engine* yang dapat diterapkan pada pemrosesan data harian (*End of Day* / EOD) di backend EzySaham.

---

## 1. Spesifikasi Input & Output

* **Input Data:**
* Array OHLVC (Open, High, Low, Close, Volume) harian minimal 120 bar terakhir.
* Ringkasan Transaksi / Broker Summary (Top 3 Buyers & Sellers).
* Data Historis PBV/PER 5 tahun ($\mu$ dan $\sigma$).


* **Output:**
* `bottom_score` (Skala 0 – 100)
* `signal_status` ("STRONG_BOTTOM", "POTENTIAL_BOTTOM", "NO_SIGNAL")
* Array `triggers` (Daftar kondisi indikator yang aktif)



---

## 2. Pseudocode Algoritma

```text
FUNCTION calculateEzyBottomScore(stockCode, ohlcvData, brokerData, valuationData):
    
    // -------------------------------------------------------------
    // INITIALIZATION & PARAMETERS
    // -------------------------------------------------------------
    score = 0
    triggers = []
    n = length(ohlcvData)
    
    currentClose = ohlcvData[n-1].close
    currentVolume = ohlcvData[n-1].volume
    currentLow = ohlcvData[n-1].low
    currentHigh = ohlcvData[n-1].high
    
    // -------------------------------------------------------------
    // 1. RSI BULLISH DIVERGENCE (Bobot: 30)
    // -------------------------------------------------------------
    rsiArray = calculateRSI(ohlcvData, 14)
    priceLows = findLocalMinima(ohlcvData.low, lookback=20)
    rsiLows = findLocalMinima(rsiArray, lookback=20)
    
    IF priceLows[latest] < priceLows[previous] AND rsiLows[latest] > rsiLows[previous]:
        IF rsiArray[n-1] < 40:
            score += 30
            triggers.append("RSI_BULLISH_DIVERGENCE")
            
    // -------------------------------------------------------------
    // 2. CAPITULATION VOLUME & CANDLE PATTERN (Bobot: 20)
    // -------------------------------------------------------------
    avgVolume20 = calculateSMA(ohlcvData.volume, 20)
    candleRange = currentHigh - currentLow
    lowerWick = min(ohlcvData[n-1].open, currentClose) - currentLow
    
    isHighVolume = currentVolume >= (2.5 * avgVolume20[n-1])
    isHammerOrDoji = (candleRange > 0) AND ((lowerWick / candleRange) >= 0.55)
    
    IF isHighVolume AND isHammerOrDoji:
        score += 20
        triggers.append("CAPITULATION_VOLUME_HAMMER")
        
    // -------------------------------------------------------------
    // 3. VALUATION DISCOUNT (HISTORICAL PBV/PER) (Bobot: 20)
    // -------------------------------------------------------------
    pbvMean = valuationData.pbv_mean_5y
    pbvStdDev = valuationData.pbv_std_dev_5y
    currentPBV = valuationData.current_pbv
    
    thresholdMinus2SD = pbvMean - (2 * pbvStdDev)
    
    IF currentPBV <= thresholdMinus2SD:
        score += 20
        triggers.append("VALUATION_UNDER_2SD")
        
    // -------------------------------------------------------------
    // 4. BIG BROKER ACCUMULATION (Bobot: 20)
    // -------------------------------------------------------------
    top3BuyVolume = sum(brokerData.top3_buyers.volume)
    totalMarketVolume = brokerData.total_volume
    accumulationRatio = top3BuyVolume / totalMarketVolume
    
    // Cek konsistensi akumulasi minimal 3 hari berturut-turut
    isConsecutiveAcc = checkConsecutiveAccumulation(stockCode, days=3, threshold=0.55)
    
    IF accumulationRatio >= 0.60 OR isConsecutiveAcc:
        score += 20
        triggers.append("BIG_BROKER_ACCUMULATION")
        
    // -------------------------------------------------------------
    // 5. BREAKOUT DYNAMIC RESISTANCE (EMA20) (Bobot: 10)
    // -------------------------------------------------------------
    ema20Array = calculateEMA(ohlcvData.close, 20)
    
    isPrevBelowEMA = ohlcvData[n-2].close < ema20Array[n-2]
    isCurrAboveEMA = currentClose > ema20Array[n-1]
    
    IF isPrevBelowEMA AND isCurrAboveEMA:
        score += 10
        triggers.append("EMA20_CROSSOVER")

    // -------------------------------------------------------------
    // SIGNAL CLASSIFICATION
    // -------------------------------------------------------------
    IF score >= 75:
        status = "STRONG_BOTTOM"
    ELSE IF score >= 50:
        status = "POTENTIAL_BOTTOM"
    ELSE:
        status = "NO_SIGNAL"
        
    RETURN {
        "stock": stockCode,
        "score": score,
        "status": status,
        "triggers": triggers,
        "timestamp": currentTime()
    }
END FUNCTION

```

---

## 3. Logika Detail Komponen Kunci

### A. Deteksi Local Minima (Divergence)

Untuk menentukan pangkalan harga (*Price Lows*) dan pangkalan RSI (*RSI Lows*):

* Cari titik $P[i]$ di mana $P[i] < P[i-1]$ dan $P[i] < P[i+1]$ dalam rentang *window* $N=5$ hari.
* Bandingkan dua titik *local minima* terakhir ($P_2$ vs $P_1$ dan $RSI_2$ vs $RSI_1$).

### B. Standard Deviation Band (Valuasi)

Dihitung menggunakan rumus statistik standar pada *data point* harian 5 tahun (sekitar $1.250$ baris transaksi):

$$\text{Threshold}_{-2\text{SD}} = \mu_{\text{PBV}} - \left(2 \times \sigma_{\text{PBV}}\right)$$

### C. Accumulation Ratio

$$R_{\text{acc}} = \frac{\sum_{i=1}^{3} \text{Volume Beli Broker Top } i}{\text{Total Volume Transaksi Saham}} \times 100\%$$

* **Skor Penuh (+20)** diberikan jika $R_{\text{acc}} \ge 60\%$ atau terjadi konsistensi akumulasi di atas $55\%$ selama 3 hari bursa berturut-turut.