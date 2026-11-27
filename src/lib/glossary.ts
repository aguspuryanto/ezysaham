/**
 * Glosarium istilah saham — satu-satunya sumber definisi untuk tooltip (TermTooltip)
 * dan halaman /glosarium. Tulis untuk investor pemula: kalimat pendek, tanpa jargon
 * yang tidak dijelaskan, dan bukan rekomendasi jual/beli.
 */

export type GlossaryCategory = "valuasi" | "kinerja" | "keuangan" | "dividen" | "perdagangan" | "risiko";

export const GLOSSARY_CATEGORIES: { id: GlossaryCategory; label: string; description: string }[] = [
  { id: "valuasi", label: "Valuasi", description: "Apakah harga saham murah atau mahal dibanding kinerjanya." },
  { id: "kinerja", label: "Kinerja & pertumbuhan", description: "Seberapa baik perusahaan menghasilkan laba." },
  { id: "keuangan", label: "Kesehatan keuangan", description: "Apakah perusahaan sanggup membayar utangnya." },
  { id: "dividen", label: "Dividen", description: "Bagian laba yang dibagikan ke pemegang saham." },
  { id: "perdagangan", label: "Perdagangan & portofolio", description: "Istilah saat membeli, menjual, dan mencatat saham." },
  { id: "risiko", label: "Risiko & jebakan", description: "Pola yang sering menjebak investor pemula." },
];

interface TermDef {
  /** Nama istilah seperti ditampilkan */
  term: string;
  /** Nama lain / singkatan yang juga dicari orang */
  aliases?: string[];
  category: GlossaryCategory;
  /** Satu kalimat untuk tooltip */
  short: string;
  /** Penjelasan lengkap di halaman glosarium, per paragraf */
  body: string[];
  example?: string;
  /** id istilah terkait (divalidasi di glossaryRelated) */
  related?: string[];
}

const TERMS = {
  // ── Valuasi ───────────────────────────────────────────────
  per: {
    term: "PER",
    aliases: ["Price to Earnings Ratio", "P/E"],
    category: "valuasi",
    short: "Harga saham dibagi laba per saham. Makin kecil, makin murah dibanding labanya.",
    body: [
      "PER menunjukkan berapa tahun laba perusahaan (dengan laba sekarang) yang dibutuhkan untuk “menebus” harga sahamnya.",
      "PER hanya berarti jika perusahaan untung. PER negatif artinya perusahaan sedang rugi. Bandingkan PER dengan emiten sejenis, karena PER wajar bank berbeda dengan PER perusahaan teknologi.",
    ],
    example: "Harga Rp1.000 dan laba per saham Rp100 → PER 10x.",
    related: ["pbv", "harga-wajar", "value-trap"],
  },
  pbv: {
    term: "PBV",
    aliases: ["Price to Book Value"],
    category: "valuasi",
    short: "Harga saham dibagi nilai buku per saham. Di bawah 1 berarti dihargai di bawah nilai bukunya.",
    body: [
      "Nilai buku adalah ekuitas (aset dikurangi utang) per lembar saham. PBV membandingkan harga pasar dengan nilai buku itu.",
      "PBV rendah tidak otomatis murah. Bisa jadi pasar menilai asetnya bermasalah atau labanya terus turun. Cek juga ROE: PBV rendah dengan ROE rendah sering kali memang wajar.",
    ],
    example: "Harga Rp800 dan nilai buku per saham Rp1.000 → PBV 0,8x.",
    related: ["per", "roe", "value-trap"],
  },
  "harga-wajar": {
    term: "Harga wajar",
    aliases: ["Fair value", "Graham Number"],
    category: "valuasi",
    short: "Perkiraan nilai saham berdasarkan laba dan nilai bukunya. Hasil hitungan, bukan harga pasti.",
    body: [
      "Ezysaham memperkirakan harga wajar dari Graham Number serta median PER dan PBV emiten sejenis, lalu mengambil rata-ratanya.",
      "Harga wajar bergantung pada data laporan keuangan terakhir. Metode ini paling cocok untuk perusahaan dengan laba stabil, dan kurang cocok untuk saham bertumbuh tinggi, siklikal, atau bank.",
    ],
    related: ["margin-of-safety", "per", "pbv"],
  },
  "margin-of-safety": {
    term: "Margin of safety",
    aliases: ["MoS", "Diskon dari harga wajar"],
    category: "valuasi",
    short: "Selisih antara harga wajar dan harga pasar. Makin besar diskonnya, makin besar ruang aman jika perkiraan meleset.",
    body: [
      "Dihitung sebagai (harga wajar − harga sekarang) ÷ harga wajar. Angka positif artinya harga di bawah perkiraan nilai wajarnya.",
      "Gunanya sebagai bantalan: perkiraan harga wajar bisa salah, jadi membeli dengan diskon memberi ruang toleransi.",
    ],
    example: "Harga wajar Rp1.000 dan harga sekarang Rp750 → margin of safety 25%.",
    related: ["harga-wajar", "value-trap"],
  },
  kapitalisasi: {
    term: "Kapitalisasi pasar",
    aliases: ["Market cap", "Kap. pasar"],
    category: "valuasi",
    short: "Harga saham dikali jumlah saham beredar, yaitu nilai seluruh perusahaan di mata pasar.",
    body: [
      "Kapitalisasi menggambarkan ukuran perusahaan. Saham berkapitalisasi besar (blue-chip) umumnya lebih likuid dan lebih sulit digerakkan oleh segelintir pihak.",
      "Saham berkapitalisasi kecil bisa bertumbuh cepat, tetapi harganya juga lebih mudah bergejolak.",
    ],
    related: ["saham-gorengan", "free-float"],
  },
  "skor-fundamental": {
    term: "Skor fundamental",
    category: "valuasi",
    short: "Skor 0–100 dari Ezysaham yang menggabungkan ROE (50%), PER (30%), dan PBV (20%).",
    body: [
      "Skor ini dipakai untuk mengurutkan tab Fundamental di screener. ROE makin tinggi menambah skor, sedangkan PER dan PBV makin rendah menambah skor.",
      "Skor hanya memakai tiga rasio, jadi tidak melihat utang, arus kas, atau prospek bisnis. Pakai sebagai titik awal riset, bukan kesimpulan.",
    ],
    related: ["roe", "per", "pbv"],
  },

  // ── Kinerja & pertumbuhan ─────────────────────────────────
  roe: {
    term: "ROE",
    aliases: ["Return on Equity"],
    category: "kinerja",
    short: "Laba bersih dibagi ekuitas. Mengukur seberapa efisien perusahaan menghasilkan laba dari modalnya.",
    body: [
      "ROE 15% artinya setiap Rp100 modal pemegang saham menghasilkan laba Rp15 setahun. Banyak investor memakai 15% sebagai patokan ROE yang bagus.",
      "ROE bisa terlihat tinggi karena utang besar (ekuitas kecil). Karena itu, cek ROE bersama DER.",
    ],
    related: ["der", "net-margin", "pbv"],
  },
  "net-margin": {
    term: "Net margin",
    aliases: ["Margin laba bersih"],
    category: "kinerja",
    short: "Persentase laba bersih dari pendapatan. Menunjukkan berapa yang tersisa sebagai laba dari setiap penjualan.",
    body: [
      "Net margin 10% artinya dari setiap Rp100 pendapatan, Rp10 menjadi laba bersih.",
      "Margin wajar sangat berbeda antar industri: ritel biasanya bermargin tipis, sedangkan perusahaan teknologi atau consumer brand bisa bermargin tebal.",
    ],
    related: ["roe", "yoy"],
  },
  yoy: {
    term: "Pertumbuhan YoY",
    aliases: ["Year on year", "Pertumbuhan pendapatan", "Pertumbuhan laba"],
    category: "kinerja",
    short: "Perubahan dibanding periode yang sama tahun lalu.",
    body: [
      "Pertumbuhan pendapatan dan laba YoY membandingkan kinerja sekarang dengan periode yang sama tahun sebelumnya, sehingga pengaruh musim ikut tersaring.",
      "Laba yang turun sementara harga saham juga turun adalah tanda penting untuk dicek sebelum menganggap saham sedang “diskon”.",
    ],
    related: ["value-trap", "net-margin"],
  },

  // ── Kesehatan keuangan ────────────────────────────────────
  der: {
    term: "DER",
    aliases: ["Debt to Equity Ratio"],
    category: "keuangan",
    short: "Utang dibagi ekuitas. Makin rendah, makin kecil ketergantungan perusahaan pada utang.",
    body: [
      "DER 50% artinya utang perusahaan setengah dari modalnya sendiri. Utang besar memperbesar risiko saat bunga naik atau penjualan turun.",
      "Bank dan perusahaan pembiayaan wajar memiliki DER tinggi karena bisnisnya memang mengelola dana pihak lain, jadi jangan dibandingkan dengan sektor lain.",
    ],
    related: ["current-ratio", "roe"],
  },
  "current-ratio": {
    term: "Current ratio",
    aliases: ["Rasio lancar"],
    category: "keuangan",
    short: "Aset lancar dibagi utang lancar. Di atas 1,5 umumnya berarti sanggup membayar kewajiban jangka pendek.",
    body: [
      "Aset lancar adalah aset yang bisa dicairkan dalam setahun (kas, piutang, persediaan). Utang lancar adalah kewajiban yang jatuh tempo dalam setahun.",
      "Current ratio di bawah 1 berarti utang jangka pendek lebih besar dari aset lancarnya, sehingga perlu dicek dari mana perusahaan akan membayarnya.",
    ],
    related: ["der"],
  },
  beta: {
    term: "Beta",
    category: "keuangan",
    short: "Seberapa besar harga saham bergerak dibanding pasar. Di atas 1 berarti lebih fluktuatif dari IHSG.",
    body: [
      "Beta 1,5 artinya, secara historis, saat IHSG naik atau turun 1%, saham ini cenderung bergerak sekitar 1,5%.",
      "Beta dihitung dari data masa lalu (1 tahun) dan bisa berubah. Beta tinggi berarti potensi naik turunnya lebih tajam.",
    ],
    related: ["saham-gorengan"],
  },

  // ── Dividen ───────────────────────────────────────────────
  "dividend-yield": {
    term: "Dividend yield",
    aliases: ["Yield dividen"],
    category: "dividen",
    short: "Dividen setahun dibagi harga saham. Menunjukkan “bunga” dari dividen jika membeli di harga sekarang.",
    body: [
      "Yield 5% artinya dengan membeli saham senilai Rp1 juta, dividen 12 bulan terakhir setara Rp50 ribu.",
      "Yield bisa naik karena harga saham jatuh, bukan karena dividennya naik. Yield yang sangat tinggi justru perlu dicek: apakah labanya masih sanggup membayar dividen yang sama tahun depan?",
    ],
    example: "Dividen Rp100 per saham dan harga Rp2.000 → yield 5%.",
    related: ["payout-ratio", "dividend-trap", "cum-date"],
  },
  "payout-ratio": {
    term: "Payout ratio",
    aliases: ["Rasio pembayaran dividen", "DPR"],
    category: "dividen",
    short: "Porsi laba yang dibagikan sebagai dividen. Di atas 100% berarti dividen lebih besar dari laba.",
    body: [
      "Payout 40% artinya 40% laba dibagikan ke pemegang saham dan sisanya ditahan untuk mengembangkan bisnis.",
      "Payout di atas 100% tidak bisa dipertahankan lama, karena perusahaan membayar dividen dari kas simpanan atau utang. Ini salah satu tanda dividend trap.",
    ],
    related: ["dividend-yield", "dividend-trap"],
  },
  dps: {
    term: "DPS",
    aliases: ["Dividend per share", "Dividen per saham"],
    category: "dividen",
    short: "Jumlah dividen yang diterima untuk setiap satu lembar saham.",
    body: [
      "DPS (TTM) adalah total dividen per lembar saham selama 12 bulan terakhir.",
      "Karena 1 lot = 100 lembar, DPS Rp50 berarti dividen Rp5.000 per lot (sebelum pajak).",
    ],
    related: ["dividend-yield", "lot"],
  },
  "cum-date": {
    term: "Cum date",
    aliases: ["Ex date", "Cum dividen"],
    category: "dividen",
    short: "Hari terakhir membeli saham agar berhak atas dividen. Esoknya (ex date) harga biasanya turun.",
    body: [
      "Investor harus sudah membeli saham paling lambat pada cum date di pasar reguler untuk tercatat sebagai penerima dividen.",
      "Pada ex date, harga saham umumnya terkoreksi kira-kira sebesar dividennya. Membeli hanya demi dividen menjelang cum date sering kali tidak menguntungkan jika harganya turun lebih dalam dari dividen yang diterima.",
    ],
    related: ["dividend-trap", "dividend-yield"],
  },

  // ── Perdagangan & portofolio ──────────────────────────────
  lot: {
    term: "Lot",
    category: "perdagangan",
    short: "Satuan jual beli saham di BEI. 1 lot = 100 lembar saham.",
    body: [
      "Harga saham ditampilkan per lembar, tetapi transaksi dilakukan per lot.",
    ],
    example: "Harga Rp1.500 per lembar → 1 lot = Rp150.000 (belum termasuk fee).",
    related: ["fee-transaksi", "harga-rata-rata"],
  },
  "harga-rata-rata": {
    term: "Harga rata-rata",
    aliases: ["Avg", "Average price"],
    category: "perdagangan",
    short: "Rata-rata harga beli semua lot yang kamu miliki untuk satu saham.",
    body: [
      "Jika membeli saham yang sama beberapa kali di harga berbeda, harga rata-ratanya dihitung tertimbang jumlah lembar.",
      "Untung/rugi dihitung dari selisih harga sekarang dengan harga rata-rata ini.",
      "Seperti di aplikasi broker, avg di EzySaham sudah termasuk fee beli, sehingga modal = avg × jumlah lembar.",
    ],
    example: "Beli 1 lot di Rp1.000 dan 1 lot di Rp800 → harga rata-rata Rp900.",
    related: ["untung-rugi", "lot"],
  },
  "fee-transaksi": {
    term: "Fee transaksi",
    aliases: ["Fee broker", "Biaya transaksi"],
    category: "perdagangan",
    short: "Biaya yang dipotong sekuritas setiap kali membeli atau menjual saham.",
    body: [
      "Besarnya berbeda di tiap sekuritas, dan fee jual biasanya lebih besar karena termasuk pajak penjualan. Portofolio Ezysaham memakai asumsi fee beli 0,15% dan fee jual 0,25%.",
      "Karena ada fee, harga saham harus naik sedikit lebih dulu sebelum posisimu benar-benar untung. Sering jual-beli membuat fee menumpuk.",
    ],
    related: ["untung-rugi"],
  },
  "untung-rugi": {
    term: "Untung/rugi (U/R)",
    aliases: ["Unrealized", "Realized", "P/L", "Floating"],
    category: "perdagangan",
    short: "Selisih nilai saham sekarang dengan modalmu. Unrealized = belum dijual; realized = sudah dijual.",
    body: [
      "Unrealized (floating) masih bisa berubah mengikuti harga pasar. Untung/rugi baru menjadi realized setelah saham dijual.",
      "Di Ezysaham, modal sudah termasuk fee beli, dan hasil penjualan sudah dikurangi fee jual, sehingga angkanya mendekati yang kamu terima di rekening.",
    ],
    related: ["harga-rata-rata", "fee-transaksi"],
  },
  "nilai-transaksi": {
    term: "Nilai transaksi",
    aliases: ["Value", "Likuiditas"],
    category: "perdagangan",
    short: "Total rupiah saham yang diperdagangkan hari itu. Makin besar, makin mudah membeli dan menjual tanpa menggeser harga.",
    body: [
      "Nilai transaksi adalah ukuran likuiditas yang paling praktis. Saham dengan nilai transaksi kecil bisa sulit dijual saat dibutuhkan, dan harganya mudah digerakkan oleh sedikit pembeli atau penjual.",
      "Screener Ezysaham menyaring saham dengan nilai transaksi di bawah Rp1 miliar per hari agar saham yang “tidur” tidak ikut muncul.",
    ],
    related: ["volume", "saham-gorengan"],
  },
  volume: {
    term: "Volume",
    category: "perdagangan",
    short: "Jumlah lembar atau lot saham yang diperdagangkan dalam satu hari.",
    body: [
      "Volume yang melonjak jauh di atas biasanya menandakan ada kabar atau minat besar. Lonjakan volume yang disertai kenaikan harga tajam pada saham kecil perlu diwaspadai.",
      "Untuk membandingkan antar saham, nilai transaksi (rupiah) lebih adil daripada volume (lembar), karena harga per lembarnya berbeda-beda.",
    ],
    related: ["nilai-transaksi", "akumulasi"],
  },
  "free-float": {
    term: "Free float",
    category: "perdagangan",
    short: "Porsi saham yang beredar bebas di publik, di luar pemegang saham pengendali.",
    body: [
      "Free float kecil berarti hanya sedikit saham yang benar-benar diperdagangkan. Harganya lebih mudah digerakkan oleh segelintir pihak.",
      "Sebagai gambaran, median free float saham di BEI sekitar 20%. Free float di bawah 10% tergolong tipis.",
    ],
    related: ["saham-gorengan", "kapitalisasi"],
  },
  hsc: {
    term: "HSC",
    aliases: ["High Shareholding Concentration", "Kepemilikan saham terkonsentrasi tinggi"],
    category: "risiko",
    short: "Saham yang ≥ 92,5% kepemilikannya dikuasai 10 pemegang saham terbesar. Tidak dihitung di IHSG.",
    body: [
      "BEI dan KSEI menandai saham sebagai High Shareholding Concentration (HSC) bila 10 pemegang saham terbesarnya menguasai sedikitnya 92,5% saham. Artinya, porsi yang benar-benar beredar di publik sangat kecil.",
      "Saham HSC dikeluarkan dari perhitungan IHSG. Karena sedikit saham yang diperdagangkan, harganya mudah digerakkan oleh segelintir pihak dan bisa sulit dijual saat dibutuhkan.",
      "Label HSC bukan berarti perusahaannya buruk. Ini peringatan soal likuiditas dan risiko harga yang tidak wajar.",
    ],
    related: ["free-float", "saham-gorengan"],
  },
  return: {
    term: "Return",
    aliases: ["1 Bln", "Kinerja harga"],
    category: "perdagangan",
    short: "Perubahan harga saham dalam periode tertentu, misalnya 1 bulan (1 Bln) atau 1 tahun.",
    body: [
      "Return 1 bulan +40% artinya harga naik 40% dibanding sebulan lalu. Return di sini belum termasuk dividen.",
      "Saham yang sudah naik sangat tinggi dalam waktu singkat menyimpan risiko koreksi yang juga tinggi.",
    ],
    related: ["fomo", "momentum"],
  },
  "ara-arb": {
    term: "ARA / ARB",
    aliases: ["Auto Rejection Atas", "Auto Rejection Bawah"],
    category: "perdagangan",
    short: "Batas kenaikan (ARA) dan penurunan (ARB) harga maksimal dalam sehari yang ditetapkan BEI.",
    body: [
      "Order di luar batas ini otomatis ditolak sistem. Persentasenya bergantung pada rentang harga saham dan bisa diubah oleh BEI.",
      "Saham yang berhari-hari menyentuh ARA sering memancing FOMO. Saat berbalik, saham bisa terkena ARB berturut-turut dan sulit dijual karena antrean jual menumpuk.",
    ],
    related: ["fomo", "saham-gorengan"],
  },
  momentum: {
    term: "Momentum",
    category: "perdagangan",
    short: "Kecenderungan harga yang sedang naik untuk terus naik dalam jangka pendek.",
    body: [
      "Tab Momentum Ezysaham menampilkan saham yang naik ≥3% hari ini, dengan nilai transaksi di atas median pasar dan kinerja sepekan positif.",
      "Momentum bisa berbalik sangat cepat. Masuk di akhir lonjakan berarti membeli di harga tertinggi. Cek fundamental dan seberapa jauh harga sudah naik sebelum ikut membeli.",
    ],
    related: ["fomo", "return", "saham-gorengan"],
  },
  akumulasi: {
    term: "Akumulasi",
    category: "perdagangan",
    short: "Pola ketika harga relatif datar tetapi ramai ditransaksikan, sebagai tanda ada pihak yang sedang mengumpulkan saham.",
    body: [
      "Tab Akumulasi Ezysaham mencari saham yang bergerak sideways (±5% sebulan), ramai ditransaksikan, dan ditutup dekat harga tertinggi hari itu.",
      "Ini hanya indikasi dari data harga, bukan bukti. Pola yang sama juga bisa muncul pada saham yang sedang “disiapkan” untuk digoreng.",
    ],
    related: ["volume", "saham-gorengan"],
  },

  // ── Risiko & jebakan ──────────────────────────────────────
  fomo: {
    term: "FOMO",
    aliases: ["Fear of Missing Out"],
    category: "risiko",
    short: "Takut ketinggalan: membeli karena harga sedang naik dan banyak orang membicarakannya, bukan karena analisis.",
    body: [
      "FOMO membuat investor membeli di dekat puncak lalu panik saat harga berbalik. Ini salah satu penyebab kerugian paling umum pada investor pemula.",
      "Sebelum membeli saham yang sedang naik tinggi, tanyakan: sudah naik berapa persen sebulan terakhir? Apakah labanya ikut naik? Di harga berapa saya akan mengaku salah dan menjual?",
    ],
    related: ["momentum", "return", "saham-gorengan"],
  },
  "saham-gorengan": {
    term: "Saham gorengan",
    category: "risiko",
    short: "Istilah untuk saham yang harganya diduga digerakkan secara tidak wajar, bukan oleh kinerja perusahaan.",
    body: [
      "Ciri yang sering muncul: kapitalisasi kecil, free float tipis, nilai transaksi biasanya sepi, lalu harga melonjak tajam dalam waktu singkat tanpa kabar kinerja yang sepadan.",
      "Ciri-ciri ini adalah tanda risiko, bukan bukti manipulasi. Banyak saham kecil yang sehat juga memiliki sebagian ciri tersebut. Gunakan sebagai alasan untuk berhati-hati dan memperkecil porsi, bukan sebagai tuduhan.",
    ],
    related: ["free-float", "kapitalisasi", "nilai-transaksi", "fomo"],
  },
  "dividend-trap": {
    term: "Dividend trap",
    aliases: ["Jebakan dividen"],
    category: "risiko",
    short: "Saham yang tampak menarik karena yield tinggi, tetapi harganya turun lebih dalam dari dividen yang diterima.",
    body: [
      "Yield tinggi sering muncul karena harga sudah jatuh atau karena dividen hanya dibagikan sekali. Jika laba tidak sanggup menopang dividen, dividen tahun depan bisa dipangkas dan harga turun lagi.",
      "Tanda-tanda yang perlu dicek: payout ratio di atas 100%, laba yang turun, riwayat dividen yang tidak rutin, dan harga yang turun lebih dari besaran yield dalam setahun.",
    ],
    related: ["dividend-yield", "payout-ratio", "cum-date"],
  },
  "value-trap": {
    term: "Value trap",
    aliases: ["Jebakan valuasi"],
    category: "risiko",
    short: "Saham yang terlihat murah (PER/PBV rendah), tetapi murah karena bisnisnya memang sedang memburuk.",
    body: [
      "Harga turun bisa karena sentimen sementara (pasar sedang lesu, aksi jual asing) atau karena penurunan struktural (laba turun terus, utang membengkak, industrinya meredup). Yang kedua disebut value trap.",
      "Sebelum menganggap saham sedang diskon, cek: apakah laba dan pendapatan ikut turun? Apakah utang naik? Apakah seluruh sektornya juga turun, atau hanya saham ini?",
    ],
    related: ["per", "pbv", "yoy", "margin-of-safety"],
  },
} satisfies Record<string, TermDef>;

export type TermId = keyof typeof TERMS;

export interface GlossaryTerm extends TermDef {
  id: TermId;
}

export const GLOSSARY: Record<TermId, GlossaryTerm> = Object.fromEntries(
  Object.entries(TERMS).map(([id, t]) => [id, { id, ...t }]),
) as Record<TermId, GlossaryTerm>;

export function isTermId(id: string): id is TermId {
  return Object.hasOwn(GLOSSARY, id);
}

/** Istilah terkait yang benar-benar ada di glosarium. */
export function glossaryRelated(t: GlossaryTerm): GlossaryTerm[] {
  return (t.related ?? []).filter(isTermId).map((id) => GLOSSARY[id]);
}

/** Semua istilah, urut abjad dalam tiap kategori. */
export function glossaryByCategory() {
  return GLOSSARY_CATEGORIES.map((c) => ({
    ...c,
    terms: Object.values(GLOSSARY)
      .filter((t) => t.category === c.id)
      .sort((a, b) => a.term.localeCompare(b.term, "id")),
  }));
}
