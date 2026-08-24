export interface GlossaryTerm {
  term: string;
  definition: string;
}

export interface GlossaryCategory {
  key: string;
  label: string;
  terms: GlossaryTerm[];
}

export const GLOSSARY: GlossaryCategory[] = [
  {
    key: 'umum',
    label: 'Umum & Aturan Bursa',
    terms: [
      {
        term: 'EOD (End of Day)',
        definition:
          'Data harga/volume yang diambil setelah bursa tutup untuk hari itu — bukan data real-time. EzySaham menggunakan data EOD, jadi harga yang tampil adalah harga penutupan terakhir, bukan harga saat ini juga sedang berjalan.',
      },
      {
        term: 'ARA (Auto Rejection Atas)',
        definition:
          'Batas maksimum kenaikan harga saham dalam satu hari yang ditetapkan bursa (persentasenya berbeda tergantung rentang harga saham). Jika tersentuh, order beli tidak bisa lagi mengejar harga lebih tinggi hari itu.',
      },
      {
        term: 'ARB (Auto Rejection Bawah)',
        definition:
          'Kebalikan dari ARA — batas maksimum penurunan harga saham dalam satu hari. Jika tersentuh, order jual tidak bisa lagi menurunkan harga lebih jauh hari itu.',
      },
      {
        term: 'UMA (Unusual Market Activity)',
        definition:
          'Peringatan resmi dari Bursa Efek Indonesia (BEI) ketika pergerakan harga atau volume suatu saham dinilai tidak wajar. Status UMA bukan berarti pasti ada pelanggaran, tapi tanda bahwa saham tersebut sedang diawasi lebih ketat.',
      },
      {
        term: 'Suspensi',
        definition:
          'Penghentian sementara perdagangan suatu saham oleh bursa, biasanya karena lonjakan harga ekstrem atau masalah keterbukaan informasi, sampai kondisi dianggap kembali wajar.',
      },
      {
        term: 'Free Float',
        definition:
          'Persentase saham yang benar-benar beredar bebas di pasar dan bisa diperjualbelikan publik, di luar saham yang dikuasai pemegang saham pengendali/afiliasi. Free float kecil membuat harga lebih mudah bergerak tajam dengan volume transaksi yang relatif kecil.',
      },
      {
        term: 'Bandarmology',
        definition:
          'Istilah informal untuk analisis pergerakan "pemain besar" (institusi/bandar) di suatu saham lewat pola harga dan volume. Karena data broker summary resmi tidak tersedia gratis untuk publik, fitur seperti ini di banyak aplikasi (termasuk EzySaham) bersifat perkiraan/proxy, bukan data pasti.',
      },
      {
        term: 'IHSG',
        definition:
          'Indeks Harga Saham Gabungan — indikator pergerakan rata-rata seluruh saham yang tercatat di Bursa Efek Indonesia, dipakai sebagai tolok ukur kondisi pasar secara umum.',
      },
      {
        term: 'Lot',
        definition: '1 lot saham di BEI setara dengan 100 lembar saham — satuan minimum untuk transaksi saham di Indonesia.',
      },
    ],
  },
  {
    key: 'teknikal',
    label: 'Indikator Teknikal',
    terms: [
      {
        term: 'RSI (Relative Strength Index)',
        definition:
          'Indikator momentum berskala 0–100 yang mengukur seberapa kuat/cepat harga bergerak. Umumnya RSI di atas 70 dianggap "jenuh beli" (overbought) dan di bawah 30 dianggap "jenuh jual" (oversold), meski ini bukan aturan mutlak.',
      },
      {
        term: 'MACD',
        definition:
          'Moving Average Convergence Divergence — indikator yang membandingkan dua rata-rata harga bergerak untuk mendeteksi perubahan arah/momentum tren. Saat garis MACD memotong ke atas garis sinyalnya, ini sering disebut "golden cross" dan dibaca sebagai sinyal bullish.',
      },
      {
        term: 'EMA (Exponential Moving Average)',
        definition:
          'Rata-rata harga bergerak yang memberi bobot lebih besar pada harga terbaru. EMA20/EMA50 berarti rata-rata 20 atau 50 hari terakhir. Saat EMA20 berada di atas EMA50, ini biasanya dibaca sebagai tren jangka pendek sedang menguat.',
      },
      {
        term: 'ADX (Average Directional Index)',
        definition:
          'Mengukur seberapa kuat sebuah tren (naik maupun turun), bukan arahnya. ADX di atas 25 umumnya diartikan tren sedang cukup kuat, tanpa memandang apakah tren itu naik atau turun.',
      },
      {
        term: 'Stochastic',
        definition:
          'Indikator momentum yang membandingkan harga penutupan terhadap rentang harga tertinggi-terendah dalam suatu periode, untuk melihat apakah harga relatif berada di area jenuh beli atau jenuh jual.',
      },
      {
        term: 'OBV (On-Balance Volume)',
        definition:
          'Indikator yang mengakumulasi volume berdasarkan arah pergerakan harga, dipakai untuk melihat apakah volume mendukung atau justru bertentangan dengan pergerakan harga ("divergensi").',
      },
      {
        term: 'RVOL (Relative Volume)',
        definition:
          'Perbandingan volume perdagangan hari ini terhadap rata-rata volume pada periode sebelumnya. RVOL tinggi berarti aktivitas transaksi jauh di atas kebiasaan — sering menandakan ada minat pasar yang tidak biasa.',
      },
      {
        term: 'ATR (Average True Range)',
        definition:
          'Ukuran rata-rata volatilitas harga suatu saham dalam periode tertentu, sering dipakai untuk menentukan jarak stop loss yang wajar sesuai karakter volatilitas saham tersebut.',
      },
      {
        term: 'Support & Resistance',
        definition:
          'Support adalah level harga yang secara historis cenderung menahan penurunan lebih lanjut (area "lantai"). Resistance adalah kebalikannya — level yang cenderung menahan kenaikan lebih lanjut (area "atap").',
      },
      {
        term: 'Breakout',
        definition:
          'Situasi ketika harga berhasil menembus level resistance (breakout ke atas) atau support (breakdown ke bawah) disertai volume yang meningkat, sering dibaca sebagai awal dari pergerakan tren baru.',
      },
    ],
  },
  {
    key: 'fundamental',
    label: 'Rasio Fundamental',
    terms: [
      {
        term: 'P/E Ratio (PER)',
        definition:
          'Price to Earnings Ratio — perbandingan harga saham terhadap laba bersih per saham (EPS). Semakin tinggi angkanya, semakin mahal harga saham dibanding labanya saat ini — meski "mahal" bisa wajar jika pertumbuhan labanya juga tinggi.',
      },
      {
        term: 'P/B Ratio (PBV)',
        definition:
          'Price to Book Value — perbandingan harga saham terhadap nilai buku (aset bersih) per saham. PBV di atas 1x berarti pasar menghargai perusahaan lebih tinggi dari nilai buku asetnya.',
      },
      {
        term: 'ROE (Return on Equity)',
        definition: 'Mengukur seberapa efisien perusahaan menghasilkan laba dari modal (ekuitas) pemegang saham. Semakin tinggi umumnya semakin baik, dengan catatan perlu dibandingkan dengan rata-rata sektornya.',
      },
      {
        term: 'ROA (Return on Assets)',
        definition: 'Mengukur seberapa efisien perusahaan menghasilkan laba dari total asetnya, tanpa memandang dari mana aset itu didanai (utang atau modal sendiri).',
      },
      {
        term: 'EPS (Earnings per Share)',
        definition: 'Laba bersih perusahaan yang dibagi dengan jumlah saham beredar — menunjukkan porsi laba yang secara teoritis menjadi hak setiap satu lembar saham.',
      },
      {
        term: 'Dividend Yield',
        definition: 'Persentase dividen tahunan yang dibagikan perusahaan dibandingkan dengan harga sahamnya saat ini — semakin tinggi berarti semakin besar imbal hasil dividen relatif terhadap harga beli.',
      },
      {
        term: 'Debt to Equity (DER)',
        definition: 'Rasio total utang perusahaan dibanding modal (ekuitas) pemegang saham. Angka yang terlalu tinggi menandakan perusahaan cukup bergantung pada utang untuk mendanai operasionalnya.',
      },
      {
        term: 'Current Ratio',
        definition: 'Rasio aset lancar dibanding liabilitas (utang) jangka pendek — menunjukkan kemampuan perusahaan membayar kewajiban jangka pendeknya. Di bawah 1x bisa jadi tanda tekanan likuiditas.',
      },
    ],
  },
  {
    key: 'skor',
    label: 'Istilah Skor EzySaham',
    terms: [
      {
        term: 'Skor Komposit',
        definition: 'Angka gabungan hasil dari beberapa sub-indikator teknikal/fundamental yang ditimbang sesuai preset yang dipilih (misalnya Day Trading vs Fundamental). Skor tinggi menandakan saham tersebut memenuhi lebih banyak kriteria preset itu — bukan jaminan harga akan naik.',
      },
      {
        term: 'Momentum',
        definition: 'Sub-skor yang mengukur seberapa kuat dan konsisten kecepatan pergerakan harga suatu saham belakangan ini, biasanya dari kombinasi RSI, MACD, dan tren EMA.',
      },
      {
        term: 'Smart Money',
        definition: 'Sub-skor yang mencoba mendeteksi tanda-tanda aktivitas beli oleh pelaku pasar besar lewat pola volume dan harga historis — bersifat perkiraan (proxy), bukan data transaksi resmi institusi.',
      },
      {
        term: 'Compression',
        definition: 'Kondisi saat rentang pergerakan harga menyempit dalam periode tertentu, sering dibaca sebagai tanda saham sedang "mengumpulkan energi" sebelum bergerak besar ke satu arah.',
      },
      {
        term: 'Volume Expansion',
        definition: 'Peningkatan volume transaksi yang signifikan dibanding rata-rata sebelumnya, biasanya dipakai untuk mengonfirmasi apakah suatu pergerakan harga didukung minat pasar yang nyata.',
      },
      {
        term: 'Quality Gate',
        definition: 'Syarat minimum kualitas fundamental (misalnya profitabilitas atau kesehatan keuangan) yang harus dipenuhi sebelum sebuah saham dianggap lolos preset Fundamental.',
      },
      {
        term: 'Fase Wyckoff / Struktur Harga',
        definition: 'Kerangka analisis klasik yang membagi siklus harga saham ke dalam fase seperti akumulasi (pengumpulan posisi diam-diam) dan distribusi (pelepasan posisi). Di EzySaham, klasifikasi ini adalah perkiraan berdasarkan pola harga & volume historis, bukan konfirmasi resmi.',
      },
      {
        term: 'Risk/Reward Ratio',
        definition: 'Perbandingan antara potensi rugi (jarak ke stop loss) dan potensi untung (jarak ke target harga) dari sebuah rencana trading. Rasio 1:2 misalnya berarti potensi untung dua kali lebih besar dari potensi ruginya.',
      },
      {
        term: 'Stop Loss & Take Profit (TP)',
        definition: 'Stop loss adalah batas harga di mana Anda memutuskan menjual untuk membatasi kerugian jika prediksi salah. Take Profit (TP1, TP2, dst) adalah target harga di mana Anda berencana mengambil untung secara bertahap.',
      },
    ],
  },
];
