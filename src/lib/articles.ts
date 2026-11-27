export interface Article {
  slug: string;
  title: string;
  summary: string;
  category: "Dasar" | "Teknikal" | "Fundamental" | "Strategi";
  minutes: number;
  sections: { heading?: string; paragraphs: string[]; bullets?: string[] }[];
}

export const ARTICLES: Article[] = [
  {
    slug: "mulai-investasi-saham",
    title: "Mulai Investasi Saham dari Nol",
    summary: "Langkah pertama: buka RDN, pahami lot, fraksi harga, dan biaya transaksi sebelum membeli saham pertama.",
    category: "Dasar",
    minutes: 4,
    sections: [
      {
        paragraphs: [
          "Saham adalah bukti kepemilikan sebagian kecil sebuah perusahaan. Ketika perusahaan tumbuh dan labanya naik, nilai sahammu ikut naik, dan kamu bisa menerima dividen.",
        ],
      },
      {
        heading: "Hal yang perlu disiapkan",
        paragraphs: ["Sebelum membeli saham pertama, pastikan hal-hal berikut:"],
        bullets: [
          "Dana darurat 3–6 bulan pengeluaran sudah aman di tabungan/reksa dana pasar uang.",
          "Membuka rekening efek & RDN di sekuritas yang terdaftar OJK.",
          "Memahami bahwa 1 lot = 100 lembar saham. Harga Rp1.000 berarti minimal Rp100.000 per lot.",
          "Biaya beli sekitar 0,15% dan jual sekitar 0,25% (bervariasi per sekuritas).",
        ],
      },
      {
        heading: "Mulai kecil, rutin, dan belajar",
        paragraphs: [
          "Mulailah dengan dana yang siap kamu diamkan dalam jangka panjang. Pilih saham perusahaan besar yang bisnisnya kamu pahami, lalu catat setiap pembelian di menu Portofolio agar mudah dipantau.",
        ],
      },
    ],
  },
  {
    slug: "cara-membaca-rsi",
    title: "Cara Membaca RSI untuk Pemula",
    summary: "RSI membantu melihat apakah harga sudah naik/turun terlalu kencang. Pahami arti 70 dan 30, serta jebakannya.",
    category: "Teknikal",
    minutes: 3,
    sections: [
      {
        paragraphs: [
          "Relative Strength Index (RSI) adalah indikator momentum dengan skala 0–100. RSI menghitung perbandingan rata-rata kenaikan dan penurunan harga selama 14 hari terakhir.",
        ],
      },
      {
        heading: "Patokan umum",
        paragraphs: [],
        bullets: [
          "RSI > 70: overbought (jenuh beli). Harga sudah naik kencang, rawan koreksi.",
          "RSI < 30: oversold (jenuh jual). Harga sudah turun dalam, berpotensi memantul.",
          "RSI 30–70: area normal.",
        ],
      },
      {
        heading: "Jebakan yang sering terjadi",
        paragraphs: [
          "Pada tren naik yang kuat, RSI bisa bertahan di atas 70 cukup lama. Sebaliknya, saham dengan masalah fundamental bisa terus oversold. Jangan membeli hanya karena RSI rendah — cek juga tren (SMA) dan kondisi perusahaannya.",
        ],
      },
    ],
  },
  {
    slug: "moving-average-dan-tren",
    title: "Moving Average: Mengenali Arah Tren",
    summary: "SMA 20 dan SMA 50 adalah cara paling sederhana untuk tahu apakah saham sedang uptrend atau downtrend.",
    category: "Teknikal",
    minutes: 3,
    sections: [
      {
        paragraphs: [
          "Simple Moving Average (SMA) adalah rata-rata harga penutupan dalam periode tertentu. SMA 20 mewakili tren jangka pendek (±1 bulan), SMA 50 tren menengah (±2,5 bulan).",
        ],
      },
      {
        heading: "Cara membaca",
        paragraphs: [],
        bullets: [
          "Harga > SMA 20 > SMA 50: tren naik yang sehat.",
          "Harga < SMA 20 < SMA 50: tren turun, sebaiknya berhati-hati.",
          "SMA 20 memotong SMA 50 ke atas sering disebut golden cross; ke bawah disebut death cross.",
        ],
      },
      {
        paragraphs: ["Di halaman detail saham, garis oranye adalah SMA 20 dan garis biru adalah SMA 50."],
      },
    ],
  },
  {
    slug: "memahami-macd",
    title: "Memahami MACD dan Persilangan Garis",
    summary: "MACD menunjukkan perubahan momentum. Golden cross dan death cross pada MACD bisa jadi sinyal awal.",
    category: "Teknikal",
    minutes: 3,
    sections: [
      {
        paragraphs: [
          "MACD (Moving Average Convergence Divergence) adalah selisih EMA 12 dan EMA 26. Garis signal adalah EMA 9 dari MACD, sedangkan histogram menunjukkan jarak keduanya.",
        ],
      },
      {
        heading: "Sinyal yang umum dipakai",
        paragraphs: [],
        bullets: [
          "MACD memotong signal ke atas (histogram berubah positif): momentum menguat.",
          "MACD memotong signal ke bawah (histogram berubah negatif): momentum melemah.",
          "Histogram yang makin pendek menandakan momentum mulai habis.",
        ],
      },
    ],
  },
  {
    slug: "per-pbv-roe",
    title: "PER, PBV, dan ROE: Tiga Rasio Wajib",
    summary: "Tiga rasio ini cukup untuk menilai apakah saham murah dan perusahaannya efisien menghasilkan laba.",
    category: "Fundamental",
    minutes: 5,
    sections: [
      {
        heading: "PER (Price to Earnings Ratio)",
        paragraphs: [
          "Harga saham dibagi laba per saham. PER 10x artinya kamu membayar 10 kali laba tahunan perusahaan. Bandingkan dengan saham sejenis di sektor yang sama.",
        ],
      },
      {
        heading: "PBV (Price to Book Value)",
        paragraphs: [
          "Harga dibandingkan nilai buku (ekuitas) per saham. PBV < 1 berarti harga di bawah nilai bukunya — namun bisa juga tanda bisnis sedang bermasalah.",
        ],
      },
      {
        heading: "ROE (Return on Equity)",
        paragraphs: [
          "Laba bersih dibagi ekuitas. ROE di atas 15% konsisten menandakan perusahaan efisien. Kombinasi ROE tinggi + PER wajar adalah dasar dari Top Fundamental di screener.",
        ],
      },
    ],
  },
  {
    slug: "investasi-dividen",
    title: "Strategi Investasi Dividen",
    summary: "Dividend yield tinggi menarik, tapi konsistensi pembayaran dan payout ratio jauh lebih penting.",
    category: "Strategi",
    minutes: 4,
    sections: [
      {
        paragraphs: [
          "Dividend yield = dividen per saham setahun dibagi harga saham. Yield 6% artinya setiap Rp100 juta investasi menghasilkan sekitar Rp6 juta per tahun (sebelum pajak).",
        ],
      },
      {
        heading: "Checklist saham dividen",
        paragraphs: [],
        bullets: [
          "Rutin membagi dividen minimal 5 tahun terakhir.",
          "Payout ratio 30–80%: cukup dibagikan tanpa mengorbankan ekspansi.",
          "Laba stabil atau tumbuh — dividen berasal dari laba.",
          "Waspadai yield sangat tinggi akibat harga anjlok atau dividen satu kali (special dividend).",
        ],
      },
    ],
  },
  {
    slug: "diversifikasi-portofolio",
    title: "Diversifikasi: Jangan Taruh Telur di Satu Keranjang",
    summary: "Menyebar investasi ke beberapa saham dan sektor menurunkan risiko tanpa harus mengorbankan imbal hasil.",
    category: "Strategi",
    minutes: 3,
    sections: [
      {
        paragraphs: [
          "Jika seluruh dana ada di satu sektor, satu kabar buruk (misal harga komoditas jatuh) bisa memukul seluruh portofolio. Diversifikasi membuat dampaknya lebih kecil.",
        ],
      },
      {
        heading: "Aturan praktis",
        paragraphs: [],
        bullets: [
          "Miliki 5–15 saham dari minimal 3–4 sektor berbeda.",
          "Satu saham sebaiknya tidak lebih dari 20% portofolio.",
          "Satu sektor sebaiknya tidak lebih dari 40% — EzySaham akan memberi peringatan otomatis.",
          "Lakukan rebalancing berkala, misalnya tiap 6 bulan.",
        ],
      },
    ],
  },
  {
    slug: "manajemen-risiko",
    title: "Manajemen Risiko & Cut Loss",
    summary: "Tentukan batas rugi sebelum membeli. Disiplin cut loss melindungi modal untuk peluang berikutnya.",
    category: "Strategi",
    minutes: 4,
    sections: [
      {
        paragraphs: [
          "Kerugian 50% membutuhkan kenaikan 100% untuk kembali modal. Karena itu menjaga modal lebih penting daripada mengejar untung besar.",
        ],
      },
      {
        heading: "Prinsip sederhana",
        paragraphs: [],
        bullets: [
          "Tentukan harga cut loss (misal −7% s.d. −10%) sebelum membeli untuk trading jangka pendek.",
          "Jangan average down pada saham yang fundamentalnya memburuk.",
          "Gunakan uang dingin; jangan pernah memakai pinjaman untuk membeli saham.",
          "Catat alasan membeli; jual bila alasan itu sudah tidak berlaku.",
        ],
      },
    ],
  },
];

export function getArticle(slug: string) {
  return ARTICLES.find((a) => a.slug === slug);
}
