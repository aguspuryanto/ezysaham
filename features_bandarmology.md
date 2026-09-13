# Rumusan Screener EOD & Workflow Bandarmologi — Saham BEI

## 1. RUMUSAN SCREENER EOD 1: "Volume Contraction & Tight Range (VCP)"

**Fokus:** Menangkap saham yang sedang membentuk pola *Volatility Contraction Pattern* — range menyempit progresif + volume mengering — sebagai fase "napas sebelum lompat" sebelum breakout kuat.

### A. Price Action (Kontraksi Range)
| Parameter | Kriteria | Alasan |
|---|---|---|
| Range 10-20 hari | (High tertinggi − Low terendah) / Harga < 12-15% | Sideways ketat = supply lemah sudah habis diserap |
| Kontraksi progresif | Range 5 hari terakhir < 60-70% dari range 5 hari sebelumnya | VCP sejati punya beberapa kontraksi berurutan yang makin menyempit (bukan sideways acak) |
| Struktur higher-low | Swing low terakhir ≥ swing low sebelumnya | Menandakan seller makin lemah, bukan sekadar konsolidasi flat |
| Posisi vs MA | Close ≥ EMA20 dan Close ≥ EMA50 | Konsolidasi terjadi di *atas* support dinamis, bukan di bawahnya (basing sehat, bukan pelemahan tren) |

### B. Volume (Drying Up)
| Parameter | Kriteria | Alasan |
|---|---|---|
| Rasio Volume MA10 / Volume MA50 | < 0,6 – 0,7 | Volume rata-rata jangka pendek jauh lebih kecil dari jangka menengah = minat jual-beli mengering |
| RVOL selama konsolidasi | < 0,8x | Tidak ada aksi besar selama fase basing — pasar "menahan napas" |
| RVOL saat sinyal breakout | ≥ 1,5 – 2x pada hari candle breakout | Volume harus "meledak" tepat saat harga menembus resistance konsolidasi — ini pembeda breakout asli vs *fakeout* |

### C. Moving Average
- EMA20 > EMA50 (ideal EMA50 > EMA200 juga) — tren menengah-panjang masih *intact*, sideways ini hanya jeda, bukan awal downtrend.
- Slope EMA50 tidak boleh menurun tajam — hindari saham yang "sideways" karena sebenarnya sedang topping/melemah.

### D. RSI / MACD
| Parameter | Kriteria | Alasan |
|---|---|---|
| RSI(14) | 45 – 60 | Netral — bukan overbought (rawan jenuh) atau oversold (rawan masih lemah) |
| MACD Histogram | Mendekati 0, menyempit (convergence) | Momentum sedang "istirahat", energi terkumpul untuk ekspansi berikutnya |
| MACD saat trigger | Histogram baru saja cross ke positif (golden cross) bersamaan breakout | Konfirmasi momentum baru menyala, bukan breakout tanpa dukungan momentum |

**Logika inti:** VCP bekerja karena setiap kontraksi menyingkirkan pemegang saham yang lemah/tidak sabar (weak hands). Saat suplai jual tersisa sedikit dan volume kering, pembeli baru yang agresif (biasanya bandar/institusi) hanya butuh sedikit tenaga untuk mendorong harga tembus resistance — menghasilkan pergerakan yang eksplosif karena minim perlawanan jual (*low resistance path*).

---

## 2. RUMUSAN SCREENER EOD 2: "Pure Bandar Accumulation EOD"

**Fokus:** Saham micro/small cap yang sedang "dikumpulkan" oleh broker tertentu secara konsisten, tanpa menaikkan harga secara mencolok (supaya cost basis bandar tetap rendah).

### A. Market Cap & Likuiditas Dasar
| Parameter | Kriteria | Alasan |
|---|---|---|
| Market Cap | < Rp 1–5 triliun (micro–small cap) | Modal menengah sudah cukup untuk menggerakkan/mendominasi float — mustahil dilakukan di big cap seperti BBCA/BBRI |
| Free Float | Kecil–menengah | Semakin sempit float, semakin mudah dikontrol dengan modal terbatas |
| Nilai transaksi harian | Tidak terlalu kecil (masih likuid untuk keluar-masuk), tapi juga belum ramai/viral | Saham yang *sudah* ramai biasanya sudah telat untuk fase akumulasi |

### B. Broker Summary (BroSum) — Konsentrasi
| Parameter | Kriteria | Alasan |
|---|---|---|
| Top 5 Broker Buyer | ≥ 50–60% dari total volume/value beli harian | Dominasi segelintir broker = indikasi pembeli terkoordinasi, bukan ritel acak |
| Konsistensi broker | Broker (atau grup broker berelasi) yang sama muncul net-buy 5–10 hari berturut-turut | Akumulasi bandar adalah proses bertahap, bukan transaksi sekali jalan — konsistensi adalah pembeda dari *noise* |
| Net buy value broker dominan | Meningkat / stabil positif setiap hari selama window pengamatan | Menunjukkan strategi terencana untuk mengumpulkan barang, bukan spekulasi jangka pendek |
| Broker lawan (seller) | Tidak didominasi 1-2 broker besar yang net sell agresif | Jika ada broker besar net sell berlawanan arah, sinyal akumulasi jadi lemah/kontradiktif |

### C. Volume Ratio & Turnover
| Parameter | Kriteria | Alasan |
|---|---|---|
| RVOL | 1,1 – 1,5x (sedikit di atas normal) | Cukup untuk broker besar bertransaksi, tapi belum menarik perhatian crowd (>2-3x biasanya sudah "ketahuan") |
| Turnover Ratio (volume/free float) | Rendah–menengah | Barang yang berpindah tangan masih dalam porsi wajar, belum "digoreng" habis-habisan |

### D. Price Action Tanpa Kenaikan Mencolok
| Parameter | Kriteria | Alasan |
|---|---|---|
| Perubahan harga harian | Sempit, misal -2% s/d +3%, meski value transaksi broker dominan besar | Ini **kunci utama** — broker besar bertransaksi signifikan tapi harga nyaris tidak bergerak = *absorption* (semua jualan diserap tanpa menaikkan harga) |
| Harga vs support kunci | Bertahan flat/naik tipis di atas support, tidak breakdown | Bandar menjaga harga tetap "murah" selama mungkin sebelum markup |

### Cara Membaca Konsentrasi di Data EOD
1. **Effort vs Result**: Bandingkan *value* transaksi broker top buyer dengan pergerakan harga hari itu. Value besar + harga nyaris diam = sinyal absorption kuat (bandar menyerap semua supply tanpa mau menaikkan harga sendiri).
2. **Rekurensi broker**: Jangan hanya lihat 1 hari — tarik data BroSum 5-10 hari dan cek apakah kode broker yang sama berulang di posisi top buyer. Kemunculan sekali saja biasanya noise, bukan akumulasi.
3. **Selisih Buy vs Sell top broker**: Net value (total buy top broker − total sell top broker) yang konsisten positif dan membesar dari hari ke hari menandakan barang makin terkumpul di segelintir tangan.

---

## 3. WORKFLOW EVALUASI DATA EOD (18.00 WIB → 08.50 WIB)

| Jam | Aktivitas |
|---|---|
| **18.00 – 18.30** | Tarik data EOD lengkap: closing price, volume, value, dan **Broker Summary** per saham dari sumber data (RTI/Stockbit/aplikasi sekuritas). |
| **18.30 – 19.30** | Jalankan **Screener EOD 1 (VCP)** dan **Screener EOD 2 (Bandar Accumulation)** ke seluruh universe saham → hasilkan shortlist awal (misal 20-50 saham per screener). |
| **19.30 – 20.30** | **Validasi manual tahap 1**: buka chart tiap kandidat satu per satu — pastikan pola visual benar-benar rapi (bukan sekadar lolos angka tapi candle berantakan/gap tidak wajar). |
| **20.30 – 21.00** | **Validasi manual tahap 2 (BroSum & berita)**: cek detail broker summary 5-10 hari, dan saring berita/aksi korporasi (RUPS, rights issue, rumor) untuk membuang saham yang bergerak karena katalis berita — bukan akumulasi teknikal murni (hindari *false positive*). |
| **21.00 – 21.30** | Finalisasi **watchlist prioritas** (5-10 saham teratas) + tentukan level Entry, SL, TP masing-masing. |
| **21.30 – 08.30** | Monitoring pasif: berita after-market, sentimen bursa global (Wall Street/Asia), tanpa mengubah watchlist kecuali ada red flag baru. |
| **08.30 – 08.50** | Final check watchlist, siapkan alert/rencana order di masing-masing level, cek indikasi pre-opening (jika ada gap tidak wajar, evaluasi ulang rencana entry). |

### A. Aturan Entry Point / Trigger
- **Pola VCP**: Entry **hanya** saat candle breakout — close di atas resistance konsolidasi **dan** volume ≥ 150% dari rata-rata 20 hari. Jangan entry di tengah konsolidasi menebak arah — tunggu konfirmasi.
- **Bandar Accumulation**: Dua opsi —
  - *Entry bertahap (scaling in)* selama harga masih di zona akumulasi & broker top buyer masih aktif net-buy konsisten.
  - *Entry agresif* saat mulai muncul tanda awal markup: volume naik + harga mulai breakout dari base, mengonfirmasi transisi dari fase akumulasi ke markup.

### B. Stop Loss & Take Profit
- **Stop Loss**: di bawah swing low terakhir / dasar konsolidasi, biasanya **5-8%** dari entry untuk saham volatile menengah — jangan pasang SL berdasarkan persentase kaku tanpa melihat struktur chart.
- **Take Profit**: minimal **Risk:Reward 1:2 – 1:3**.
  - TP1: di resistance/level psikologis terdekat (ambil sebagian profit di sini).
  - TP2: target measured-move — lebar base konsolidasi ditambahkan ke titik breakout (target minimum klasik pola VCP/breakout).

### C. Checklist Validasi Manual (wajib dicentang sebelum eksekusi)
- [ ] Chart pattern sudah dicek visual, bukan hanya lolos filter angka
- [ ] BroSum 5-10 hari terakhir dicek — broker top buyer konsisten (bukan hanya sekali muncul)
- [ ] Tidak ada broker besar berlawanan arah (net sell agresif) yang mengontradiksi sinyal
- [ ] Tidak ada berita negatif/UMA/suspensi/notasi khusus dalam 1-2 minggu terakhir
- [ ] Likuiditas cukup untuk keluar-masuk posisi (bid-ask spread wajar, tidak terlalu tipis)
- [ ] Ukuran posisi sudah disesuaikan money management (risiko per transaksi maksimal 1-2% dari total modal)
