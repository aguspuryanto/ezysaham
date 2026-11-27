import type { Candle, Fundamentals, Stock } from "./types";
import type { TermId } from "./glossary";
import { isFinancial, tickSize } from "./entrySignal";
import { formatCompact, formatNumber, formatPercent } from "./format";

/**
 * "Bedah Data": narasi edukatif berbasis aturan yang membaca kontradiksi data, menghubungkan
 * fundamental dengan pergerakan harga, dan menandai sinyal risiko perdagangan.
 * Sengaja TIDAK memberi rekomendasi beli/jual — hanya menjelaskan apa yang terlihat di data.
 */

export type PointTone = "danger" | "warn" | "info" | "good";

export interface BedahPoint {
  tone: PointTone;
  /** Kata pembuka tebal: "Waspada", "Jebakan", "Perhatikan", ... */
  lead?: string;
  text: string;
}

export interface BedahSection {
  key: "paradoks" | "realita" | "bahaya";
  title: string;
  points: BedahPoint[];
  /** Istilah glosarium yang dipakai di bagian ini */
  terms: TermId[];
}

export interface BedahContext {
  /** Median return 3 bulan saham satu sektor (%) */
  sectorMedian3m: number | null;
  /** Median return YTD saham satu sektor (%) */
  sectorMedianYtd: number | null;
  /** Volume hari terakhir ÷ rata-rata 20 hari sebelumnya */
  volumeRatio: number | null;
}

/** Perubahan/pertumbuhan: bertanda (+5,0%) */
const pct = (v: number, digits = 1) => formatPercent(v, digits);
/** Level/rasio (ROE, margin): tanpa tanda plus (21,3%) */
const lvl = (v: number, digits = 1) => formatPercent(v, digits, false);
const abs = (v: number, digits = 1) => formatPercent(Math.abs(v), digits, false);
const num = (v: number, digits = 1) => formatNumber(v, digits);
const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Konteks pembanding: kinerja sektor dan lonjakan volume dari data historis. */
export function bedahContext(stock: Stock, all: Stock[], history: Candle[]): BedahContext {
  const peers = all.filter((s) => s.sector === stock.sector && s.volume > 0 && s.symbol !== stock.symbol);
  const r3 = peers.map((s) => s.returns.threeMonth).filter(fin);
  const ytd = peers.map((s) => s.returns.ytd).filter(fin);

  let volumeRatio: number | null = null;
  if (history.length >= 21) {
    const last = history[history.length - 1].volume;
    const prev = history.slice(-21, -1).map((c) => c.volume).filter((v) => v > 0);
    const avg = prev.length >= 10 ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
    if (avg > 0 && last > 0) volumeRatio = last / avg;
  }

  return {
    sectorMedian3m: r3.length >= 3 ? median(r3) : null,
    sectorMedianYtd: ytd.length >= 3 ? median(ytd) : null,
    volumeRatio,
  };
}

// ── 1. Paradoks data & jebakan narasi ─────────────────────────────────────
function paradoks(s: Stock, f: Fundamentals | null): BedahSection {
  const points: BedahPoint[] = [];
  const terms = new Set<TermId>();
  const per = s.peRatio;
  const rev = f?.revenueGrowth;
  const earn = f?.earningsGrowth;
  const margin = f?.netMargin;

  if (fin(per) && per <= 0) {
    terms.add("per");
    points.push({
      tone: "danger",
      lead: "Waspada",
      text: `PER ${num(per)}x bernilai negatif karena perusahaan sedang rugi (laba 12 bulan terakhir di bawah nol). PER negatif bukan berarti “sangat murah”. Rasio ini tidak bisa dipakai untuk menilai murah atau mahal sampai perusahaan kembali untung.`,
    });
  } else if (fin(per) && per > 50) {
    terms.add("per");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `PER ${num(per)}x sangat tinggi. Artinya, dengan laba sekarang, dibutuhkan ${num(per, 0)} tahun laba untuk “menebus” harga sahamnya. Harga sudah memasukkan harapan pertumbuhan besar; jika harapan itu meleset, ruang turunnya juga besar.`,
    });
  }

  if (fin(rev) && rev >= 100) {
    terms.add("yoy");
    points.push({
      tone: "warn",
      lead: "Jebakan",
      text: `Pendapatan tumbuh ${pct(rev)} YoY. Angka seekstrem ini jarang berarti bisnis melesat secara normal. Biasanya ini efek low-base (pendapatan tahun lalu sangat kecil), akuisisi, atau bisnis baru yang baru mulai tercatat. Ibarat naik dari Rp1 juta ke Rp15 juta: persentasenya fantastis, nilainya belum tentu besar. Jangan ditelan mentah-mentah.`,
    });
  }

  if (fin(earn) && earn >= 100) {
    terms.add("yoy");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Laba naik ${pct(earn)} YoY. Lonjakan sebesar ini sering berasal dari laba tahun lalu yang sangat kecil atau dari pos sekali jadi (penjualan aset, selisih kurs). Laba seperti ini belum tentu berulang tahun depan.`,
    });
  }

  if (fin(rev) && rev >= 15 && ((fin(earn) && earn < 0) || (fin(margin) && margin < 0))) {
    terms.add("net-margin");
    points.push({
      tone: "danger",
      lead: "Jebakan",
      text: `Pendapatan naik ${pct(rev)}, tetapi ${fin(earn) && earn < 0 ? `laba justru turun ${abs(earn)}` : `margin bersih negatif (${lvl(margin!)})`}. Penjualan bertambah tanpa menghasilkan laba, artinya biaya tumbuh lebih cepat dari pendapatan. Narasi “pendapatan meroket” di sini menyesatkan jika laba tidak ikut naik.`,
    });
  }

  if (fin(earn) && earn > 20 && fin(rev) && rev < 0) {
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Laba naik ${pct(earn)} padahal pendapatan turun ${abs(rev)}. Bisa karena efisiensi biaya, tetapi bisa juga dari laba non-operasional. Cek sumber kenaikannya di laporan keuangan sebelum menganggapnya tren.`,
    });
  }

  if (fin(s.roe) && fin(per) && ((s.roe < 0 && per > 0) || (s.roe > 0 && per < 0))) {
    terms.add("roe");
    points.push({
      tone: "info",
      lead: "Perhatikan",
      text: `ROE (${lvl(s.roe)}) dan PER (${num(per)}x) memberi sinyal berlawanan soal untung atau rugi. Kemungkinan keduanya dihitung dari periode laporan yang berbeda. Anggap salah satunya belum diperbarui, dan cek laporan keuangan terbaru.`,
    });
  }

  if (fin(s.roe) && s.roe >= 25 && fin(f?.der) && f.der >= 150 && !isFinancial(s)) {
    terms.add("der").add("roe");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `ROE ${lvl(s.roe)} terlihat istimewa, tetapi DER ${num(f.der, 0)}% menunjukkan modal sendiri relatif kecil dibanding utang. ROE setinggi ini sebagian “dipompa” oleh utang, bukan semata efisiensi bisnis.`,
    });
  }

  if (fin(s.pbv) && s.pbv > 0 && s.pbv < 1 && fin(s.roe) && s.roe < 5) {
    terms.add("pbv").add("value-trap");
    points.push({
      tone: "warn",
      lead: "Jebakan",
      text:
        s.roe < 0
          ? `PBV ${num(s.pbv, 2)}x (di bawah nilai buku) terlihat murah, tetapi ROE ${lvl(s.roe)}: asetnya justru menghasilkan rugi. Nilai buku bisa terus tergerus selama rugi berlanjut, jadi “diskon” terhadap nilai buku belum tentu nyata. Ini pola klasik value trap.`
          : `PBV ${num(s.pbv, 2)}x (di bawah nilai buku) terlihat murah, tetapi ROE hanya ${lvl(s.roe)}. Asetnya menghasilkan laba sangat kecil, jadi wajar dihargai rendah. Murah karena kurang produktif adalah pola klasik value trap.`,
    });
  }

  if (fin(f?.payoutRatio) && f.payoutRatio > 100) {
    terms.add("payout-ratio").add("dividend-trap");
    points.push({
      tone: "danger",
      lead: "Jebakan",
      text: `Payout ratio ${num(f.payoutRatio, 0)}%: dividen yang dibagikan lebih besar dari labanya. Ini dibayar dari kas simpanan atau utang dan sulit dipertahankan. Yield ${fin(f.dividendYield) ? `${num(f.dividendYield)}% ` : ""}bisa menjadi dividend trap.`,
    });
  } else if (fin(f?.dividendYield) && f.dividendYield >= 10) {
    terms.add("dividend-yield").add("dividend-trap");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Dividend yield ${num(f.dividendYield)}% sangat tinggi. Yield sering membengkak karena harga sudah jatuh atau dividen hanya dibagikan sekali, bukan karena dividennya rutin naik.`,
    });
  }

  if (!points.length) {
    points.push({
      tone: "good",
      text: "Tidak ditemukan kontradiksi mencolok antar data valuasi, pertumbuhan, dan profitabilitas. Data yang tampak wajar tetap bukan jaminan; laporan keuangan lengkap tetap sumber utama.",
    });
  }

  return { key: "paradoks", title: "Paradoks Data & Jebakan Narasi", points, terms: [...terms] };
}

// ── 2. Realita fundamental vs kinerja harga ───────────────────────────────
function realita(s: Stock, f: Fundamentals | null, ctx: BedahContext): BedahSection {
  const points: BedahPoint[] = [];
  const terms = new Set<TermId>();
  const r = s.returns;
  const financial = isFinancial(s);

  const moves = [
    fin(r.threeMonth) && `${pct(r.threeMonth)} dalam 3 bulan`,
    fin(r.ytd) && `${pct(r.ytd)} sejak awal tahun (YTD)`,
    fin(r.year) && `${pct(r.year)} dalam setahun`,
  ].filter(Boolean);
  if (moves.length) {
    terms.add("return");
    points.push({ tone: "info", text: `Pergerakan harga: ${moves.join(", ")}.` });
  }

  // Penilaian kesehatan fundamental dari data yang tersedia
  // Pertumbuhan laba ≥100% tidak dihitung sebagai kekuatan (sering efek low-base / laba sekali jadi; lihat bagian 1).
  const strong: string[] = [];
  const weak: string[] = [];
  const rate = (term: TermId, label: string, verdict: "strong" | "weak" | null) => {
    if (!verdict) return;
    (verdict === "strong" ? strong : weak).push(label);
    terms.add(term);
  };
  if (fin(s.roe)) rate("roe", `ROE ${lvl(s.roe)}`, s.roe >= 15 ? "strong" : s.roe < 5 ? "weak" : null);
  if (fin(f?.netMargin)) rate("net-margin", `margin bersih ${lvl(f.netMargin)}`, f.netMargin >= 10 ? "strong" : f.netMargin < 0 ? "weak" : null);
  if (fin(f?.earningsGrowth))
    rate("yoy", `laba ${f.earningsGrowth >= 0 ? "naik" : "turun"} ${abs(f.earningsGrowth)}`, f.earningsGrowth >= 0 && f.earningsGrowth < 100 ? "strong" : f.earningsGrowth <= -10 ? "weak" : null);
  if (!financial && fin(f?.der)) rate("der", `DER ${num(f.der, 0)}%`, f.der < 100 ? "strong" : f.der >= 200 ? "weak" : null);
  const known = strong.length + weak.length;
  /** Sisi lemah lebih dulu, lalu yang masih baik — agar semua istilah di "Pelajari" memang disebut di teks. */
  const weakFirst = (fallback: string) =>
    `${weak.length ? weak.join(", ") : fallback}${strong.length ? `; yang masih baik: ${strong.join(", ")}` : ""}`;
  const solid = known >= 2 && weak.length === 0;
  const broken = weak.length >= 2 || (fin(f?.earningsGrowth) && f.earningsGrowth <= -20) || (fin(s.peRatio) && s.peRatio <= 0);

  const drop = Math.min(r.threeMonth ?? 0, r.ytd ?? 0);
  const rise = Math.max(r.threeMonth ?? 0, r.ytd ?? 0);
  const sectorDown = (fin(ctx.sectorMedian3m) && ctx.sectorMedian3m <= -8) || (fin(ctx.sectorMedianYtd) && ctx.sectorMedianYtd <= -10);
  const sectorNote = fin(ctx.sectorMedian3m) ? `median saham sektor ${s.sector} ${pct(ctx.sectorMedian3m)} dalam 3 bulan` : null;

  if (drop <= -15) {
    terms.add("value-trap");
    if (broken) {
      points.push({
        tone: "danger",
        lead: "Waspada value trap",
        text: `Harga turun ${abs(drop)} bersamaan dengan fundamental yang melemah (${weakFirst("perusahaan sedang rugi")}). Penurunan ini searah dengan kinerjanya, jadi tidak bisa langsung dianggap “diskon”. Saham bisa terus murah karena bisnisnya memang memburuk.`,
      });
    } else if (solid && sectorDown) {
      points.push({
        tone: "info",
        lead: "Kemungkinan sentimen",
        text: `Harga turun ${abs(drop)}, tetapi fundamental masih terlihat sehat (${strong.join(", ")}) dan sektornya ikut tertekan (${sectorNote}). Pola ini lebih mirip koreksi sektoral karena sentimen daripada kerusakan bisnis. Tetap pantau laporan kuartal berikutnya untuk memastikan.`,
      });
    } else if (solid) {
      points.push({
        tone: "warn",
        lead: "Perhatikan",
        text: `Harga turun ${abs(drop)} padahal fundamental yang tercatat masih sehat (${strong.join(", ")})${sectorNote ? `, dan sektornya tidak turun sedalam itu (${sectorNote})` : ""}. Saham turun sendirian biasanya punya alasan spesifik, seperti berita, aksi korporasi, atau ekspektasi laba ke depan yang memburuk. Cari tahu penyebabnya sebelum menyimpulkan saham ini sedang diskon.`,
      });
    } else {
      points.push({
        tone: "warn",
        lead: "Perhatikan",
        text: `Harga turun ${abs(drop)}, sementara data fundamentalnya campuran${known ? ` (${[...strong, ...weak].join(", ")})` : " atau belum lengkap"}. Data ini belum cukup untuk memastikan apakah ini koreksi sementara atau value trap. Bandingkan dengan laporan keuangan beberapa kuartal terakhir.`,
      });
    }
  } else if (rise >= 30) {
    terms.add("fomo");
    if (broken || (!solid && known > 0)) {
      points.push({
        tone: "danger",
        lead: "Waspada",
        text: `Harga naik ${abs(rise)}, tetapi fundamentalnya tidak sekuat itu (${weakFirst("data kinerja lemah atau tidak lengkap")}). Kenaikan yang jauh mendahului kinerja biasanya didorong ekspektasi atau spekulasi. Jika ekspektasi itu tidak terwujud, harga bisa turun secepat naiknya.`,
      });
    } else {
      points.push({
        tone: "warn",
        lead: "Perhatikan",
        text: `Harga naik ${abs(rise)} dan sebagian didukung kinerja (${strong.join(", ") || "data terbatas"}). Namun, setelah kenaikan sebesar ini, valuasi${fin(s.peRatio) && s.peRatio > 0 ? ` (PER ${num(s.peRatio)}x)` : ""} sudah ikut naik. Kinerja yang bagus tidak berarti harga sekarang masih murah.`,
      });
    }
  } else if (known) {
    points.push({
      tone: broken ? "warn" : "good",
      text: broken
        ? `Harga relatif stabil, tetapi ada fundamental yang melemah (${weakFirst("")}). Harga yang tenang belum tentu aman; pasar bisa bereaksi saat laporan berikutnya terbit.`
        : `Harga bergerak dalam rentang wajar dan fundamental yang tercatat ${solid ? "tampak sehat" : "campuran"} (${[...strong, ...weak].join(", ")}). Belum terlihat jarak besar antara harga dan kinerja.`,
    });
  }

  if (!financial && fin(f?.currentRatio) && f.currentRatio < 1) {
    terms.add("current-ratio");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Current ratio ${num(f.currentRatio, 2)}x: utang jangka pendek lebih besar dari aset lancar. Perusahaan perlu pendanaan baru atau arus kas kuat untuk menutup kewajiban setahun ke depan.`,
    });
  }
  if (!financial && fin(f?.der) && f.der >= 200) {
    terms.add("der");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `DER ${num(f.der, 0)}%: utang dua kali lipat lebih dari modal sendiri. Saat bunga naik atau penjualan melambat, beban bunga bisa menggerus laba dengan cepat.`,
    });
  }

  if (!points.length) {
    points.push({ tone: "info", text: "Data kinerja harga dan fundamental belum cukup untuk dibandingkan." });
  }

  return { key: "realita", title: "Realita Fundamental & Kinerja Harga", points, terms: [...terms] };
}

// ── 3. Sinyal bahaya lainnya ──────────────────────────────────────────────
function bahaya(s: Stock, ctx: BedahContext): BedahSection {
  const points: BedahPoint[] = [];
  const terms = new Set<TermId>();
  const r = s.returns;
  let riskCount = 0;

  if (fin(s.freeFloat) && s.freeFloat > 0 && s.freeFloat < 15) {
    terms.add("free-float");
    riskCount += s.freeFloat < 10 ? 1 : 0;
    points.push(
      s.freeFloat < 10
        ? {
            tone: "danger",
            lead: "Waspada",
            text: `Free float hanya ${num(s.freeFloat)}%. Hanya sedikit saham yang benar-benar beredar di publik, sehingga harga lebih mudah digerakkan oleh segelintir pihak, baik naik maupun turun.`,
          }
        : {
            tone: "warn",
            lead: "Perhatikan",
            text: `Free float ${num(s.freeFloat)}%, di bawah median saham BEI (sekitar 20%). Porsi saham yang beredar di publik agak terbatas, jadi harga bisa bergerak lebih tajam saat ada aksi beli atau jual besar.`,
          },
    );
  }

  if (s.value > 0 && s.value < 1e9) {
    terms.add("nilai-transaksi");
    riskCount++;
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Nilai transaksi terakhir hanya Rp${formatCompact(s.value)}. Likuiditas setipis ini membuat saham sulit dijual dalam jumlah besar tanpa menurunkan harga, seperti pintu keluar yang sempit saat semua orang ingin keluar.`,
    });
  }

  if (s.marketCap > 0 && s.marketCap < 1e12) {
    terms.add("kapitalisasi");
    riskCount++;
    points.push({
      tone: "info",
      lead: "Perhatikan",
      text: `Kapitalisasi pasar Rp${formatCompact(s.marketCap)} tergolong kecil. Saham kecil bisa bergerak cepat ke dua arah dan lebih rentan terhadap aksi segelintir pelaku pasar.`,
    });
  }

  if (fin(s.beta) && s.beta >= 1.5) {
    terms.add("beta");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Beta ${num(s.beta, 2)}: secara historis, saham ini bergerak sekitar ${num(s.beta, 1)} kali lebih tajam dari IHSG. Saat pasar turun 5%, saham ini bisa turun sekitar ${num(s.beta * 5, 0)}%.`,
    });
  } else if (fin(s.beta) && s.beta < 0) {
    terms.add("beta");
    points.push({
      tone: "info",
      text: `Beta ${num(s.beta, 2)} bernilai negatif, artinya pergerakannya cenderung berlawanan dengan IHSG. Pada saham kecil, ini lebih sering karena pergerakan harga yang tidak beraturan daripada sifat defensif.`,
    });
  }

  if (fin(ctx.volumeRatio) && ctx.volumeRatio >= 3) {
    terms.add("volume");
    riskCount++;
    points.push({
      tone: "warn",
      lead: "Waspada",
      text: `Volume hari terakhir ${num(ctx.volumeRatio)} kali rata-rata 20 hari. Ada minat mendadak. Jika tidak ada berita yang jelas, lonjakan volume pada saham kecil sering menjadi tanda awal pergerakan yang digerakkan pihak tertentu.`,
    });
  }

  const longDown = (fin(r.ytd) && r.ytd < -10) || (fin(r.threeMonth) && r.threeMonth < -10);
  if (longDown && fin(r.week) && r.week >= 15) {
    terms.add("fomo");
    riskCount++;
    points.push({
      tone: "danger",
      lead: "Jebakan FOMO",
      text: `Harga masih turun ${abs(Math.min(r.ytd ?? 0, r.threeMonth ?? 0))} dalam jangka menengah, tetapi melonjak ${pct(r.week)} dalam sepekan. Pantulan tajam seperti ini memancing rasa takut ketinggalan, padahal tren besarnya belum berubah.`,
    });
  } else if (fin(r.month) && r.month >= 50) {
    terms.add("fomo");
    riskCount++;
    points.push({
      tone: "danger",
      lead: "Jebakan FOMO",
      text: `Harga naik ${pct(r.month)} hanya dalam sebulan. Membeli setelah lonjakan sebesar ini berarti masuk ketika sebagian besar kenaikan sudah dinikmati orang lain, dan risikonya berbalik paling besar.`,
    });
  } else if (fin(s.high52) && s.high52 > 0 && s.price >= s.high52 * 0.95 && fin(r.month) && r.month >= 20) {
    terms.add("fomo");
    points.push({
      tone: "warn",
      lead: "Perhatikan",
      text: `Harga berada dekat titik tertinggi 52 minggu setelah naik ${pct(r.month)} sebulan. Tentukan dulu di harga berapa kamu akan mengaku salah sebelum ikut masuk.`,
    });
  }

  if (s.price > 0 && s.price < 200) {
    terms.add("ara-arb");
    const t = tickSize(s.price);
    points.push({
      tone: "info",
      lead: "Perhatikan",
      text: `Harga Rp${num(s.price, 0)} per lembar. Satu langkah harga (Rp${t}) setara ${num((t / s.price) * 100, 1)}%, jadi pergerakan persentasenya mudah terlihat besar dan saham harga rendah lebih sering menyentuh batas ARA/ARB.`,
    });
  }

  if (riskCount >= 2) {
    terms.add("saham-gorengan");
    points.unshift({
      tone: "danger",
      lead: "Waspada",
      text: `Beberapa ciri yang sering dikaitkan dengan saham gorengan muncul bersamaan (lihat poin di bawah). Ini tanda risiko, bukan bukti manipulasi. Jika tetap ingin masuk, batasi porsinya dan tentukan batas rugi sejak awal.`,
    });
  }

  if (!points.length) {
    points.push({
      tone: "good",
      text: "Tidak ada sinyal risiko perdagangan yang mencolok: likuiditas cukup, free float memadai, volatilitas wajar, dan tidak ada lonjakan harga atau volume yang ekstrem.",
    });
  }

  return { key: "bahaya", title: "Sinyal Bahaya Lainnya", points, terms: [...terms] };
}

export function bedahData(stock: Stock, f: Fundamentals | null, ctx: BedahContext): BedahSection[] {
  return [paradoks(stock, f), realita(stock, f, ctx), bahaya(stock, ctx)];
}
