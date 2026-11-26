import type { Candle, Fundamentals, Stock } from "./types";
import type { BedahContext, BedahPoint } from "./bedahData";
import type { PeerMultiples } from "./valuation";
import { isFinancial } from "./entrySignal";
import { isHsc } from "./hsc";
import { capTier } from "./screener";
import { formatCompact, formatDate, formatNumber, formatPercent, formatPrice } from "./format";

/**
 * "Fundamental Anomaly Detector" (docs/ANOMALY_FUNDAMENTAL.md), versi berbasis aturan.
 * Dipakai langsung bila AI tidak tersedia, dan sebagai sumber bagian yang deterministik
 * (data yang hilang & tingkat keyakinan) untuk versi AI.
 */

export type AnomalySectionKey = "data" | "fundamental" | "valuasi" | "harga" | "pasar";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
export type ActionVerdict = "BUY" | "WATCH" | "AVOID";

export interface AnomalySection {
  key: AnomalySectionKey;
  title: string;
  points: BedahPoint[];
}

export interface AnomalyReport {
  /** Bagian 1–5 */
  sections: AnomalySection[];
  /** 6. Data yang tidak tersedia */
  missing: string[];
  /** 7. Klasifikasi risiko */
  risk: { level: RiskLevel; reasons: string[] };
  /** 8. Sikap + alasan + kondisi pembatalan */
  action: { verdict: ActionVerdict; reason: string; invalidation: string[] };
  /** Berdasarkan kelengkapan data (bukan keyakinan arah harga) */
  confidence: { level: "Tinggi" | "Sedang" | "Rendah"; pct: number };
}

export const ANOMALY_TITLES: Record<AnomalySectionKey, string> = {
  data: "Data Anomaly Check",
  fundamental: "Fundamental Reality",
  valuasi: "Valuation Assessment",
  harga: "Price vs Performance",
  pasar: "Market Risk Signals",
};
export const ANOMALY_KEYS = Object.keys(ANOMALY_TITLES) as AnomalySectionKey[];

export interface AnomalyContext extends BedahContext {
  peers: PeerMultiples | null;
  /** Median estimasi harga wajar (valuation.median) */
  fairMedian: number | null;
  /** Rata-rata nilai transaksi 20 hari (Rp) dari data historis */
  avgValue20: number | null;
}

const fin = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
const pct = (v: number, d = 1) => formatPercent(v, d);
const lvl = (v: number, d = 1) => formatPercent(v, d, false);
const num = (v: number, d = 1) => formatNumber(v, d);

/** Rata-rata nilai transaksi 20 hari terakhir (close × volume). */
export function avgTradedValue(history: Candle[], days = 20): number | null {
  const last = history.slice(-days).filter((c) => c.volume > 0 && c.close > 0);
  if (last.length < Math.min(10, days)) return null;
  return last.reduce((a, c) => a + c.close * c.volume, 0) / last.length;
}

// ── 1. Data anomaly check ────────────────────────────────────────────────
function dataCheck(s: Stock, f: Fundamentals | null): BedahPoint[] {
  const out: BedahPoint[] = [];
  const per = s.peRatio;
  const pbv = s.pbv;
  const roe = s.roe;

  if (s.lastDate) {
    const ageDays = (Date.now() - new Date(s.lastDate).getTime()) / 86_400_000;
    if (ageDays > 6) {
      out.push({ tone: "warn", lead: "Perhatikan", text: `Data harga terakhir per ${formatDate(s.lastDate)} (${Math.floor(ageDays)} hari lalu). Saham mungkin jarang ditransaksikan atau sedang disuspensi, sehingga rasio berbasis harga bisa basi.` });
    } else {
      out.push({ tone: "info", text: `Harga per ${formatDate(s.lastDate)}. Rasio PER/PBV/ROE memakai laporan keuangan terakhir (umumnya TTM) dari Pasardana; rasio lain (DER, margin, pertumbuhan) dari ${f?.source === "yahoo" ? "Yahoo Finance" : (f?.source ?? "sumber lain")}, jadi periodenya bisa berbeda.` });
    }
  }

  // PBV ≈ PER × ROE, berlaku bila laba & ekuitas memakai basis yang sama
  if (fin(per) && fin(pbv) && fin(roe) && per > 0 && pbv > 0 && roe > 0) {
    const implied = (per * roe) / 100;
    const gap = pbv / implied - 1;
    if (Math.abs(gap) > 0.35) {
      out.push({
        tone: "warn",
        lead: "Tidak konsisten",
        text: `PER ${num(per)}x × ROE ${lvl(roe)} menghasilkan PBV ±${num(implied, 2)}x, tetapi PBV tercatat ${num(pbv, 2)}x (selisih ${pct(gap * 100, 0)}). Kemungkinan periode laba/ekuitas berbeda, ada laba satu kali, atau perubahan modal (rights issue, buyback) yang belum tercermin.`,
      });
    } else {
      out.push({ tone: "good", text: `PER ${num(per)}x × ROE ${lvl(roe)} ≈ PBV ${num(implied, 2)}x, sejalan dengan PBV tercatat ${num(pbv, 2)}x. Data valuasi konsisten secara matematis.` });
    }
  }

  if (fin(per) && fin(roe) && Math.sign(per) !== Math.sign(roe) && per !== 0 && roe !== 0) {
    out.push({ tone: "danger", lead: "Anomali", text: `PER ${num(per)}x dan ROE ${lvl(roe)} bertanda berlawanan. Laba yang negatif seharusnya membuat keduanya negatif; angka ini kemungkinan berasal dari periode laporan yang berbeda atau ekuitas negatif.` });
  }
  if (fin(pbv) && pbv < 0) {
    out.push({ tone: "danger", lead: "Waspada", text: `PBV negatif (${num(pbv, 2)}x) berarti ekuitas perusahaan negatif: utang lebih besar dari total aset.` });
  }
  if (fin(f?.netMargin) && fin(roe) && Math.sign(f.netMargin) !== Math.sign(roe) && f.netMargin !== 0 && roe !== 0) {
    out.push({ tone: "warn", lead: "Tidak konsisten", text: `Net margin ${lvl(f.netMargin)} tetapi ROE ${lvl(roe)}. Arah laba berbeda antar-sumber, kemungkinan karena periode laporan tidak sama.` });
  }
  for (const [label, v] of [["pendapatan", f?.revenueGrowth], ["laba", f?.earningsGrowth]] as const) {
    if (fin(v) && Math.abs(v) >= 300) {
      out.push({ tone: "warn", lead: "Efek low-base", text: `Pertumbuhan ${label} ${pct(v)} tidak wajar untuk dibaca mentah. Angka sebesar ini biasanya karena basis periode lalu sangat kecil/negatif atau ada pos satu kali.` });
    }
  }
  if (fin(s.high52) && fin(s.low52) && s.high52 > 0 && (s.price > s.high52 * 1.02 || s.price < s.low52 * 0.98)) {
    out.push({ tone: "info", text: `Harga ${formatPrice(s.price)} berada di luar rentang 52 minggu (${formatPrice(s.low52)}–${formatPrice(s.high52)}). Rentang tersebut mungkin belum diperbarui atau sudah disesuaikan aksi korporasi.` });
  }
  return out;
}

// ── 2. Fundamental reality ───────────────────────────────────────────────
function fundamentalReality(s: Stock, f: Fundamentals | null): BedahPoint[] {
  const out: BedahPoint[] = [];
  const rev = f?.revenueGrowth;
  const earn = f?.earningsGrowth;
  const bank = isFinancial(s);

  if (fin(rev) && fin(earn)) {
    if (rev < 0 && earn > 10) {
      out.push({ tone: "warn", lead: "Perhatikan", text: `Laba naik ${pct(earn)} padahal pendapatan turun ${pct(rev)}. Kenaikan laba tanpa dukungan penjualan biasanya dari efisiensi, penjualan aset, atau pos satu kali, yang belum tentu berulang.` });
    } else if (rev > 5 && earn < -10) {
      out.push({ tone: "warn", lead: "Margin tertekan", text: `Pendapatan tumbuh ${pct(rev)} tetapi laba turun ${pct(earn)}. Biaya naik lebih cepat dari penjualan; perhatikan apakah tekanan margin bersifat sementara.` });
    } else if (rev > 0 && earn > 0) {
      out.push({ tone: "good", text: `Pendapatan (${pct(rev)}) dan laba (${pct(earn)}) sama-sama tumbuh.` });
    } else if (rev < 0 && earn < 0) {
      out.push({ tone: "danger", lead: "Waspada", text: `Pendapatan (${pct(rev)}) dan laba (${pct(earn)}) sama-sama menyusut. Bisnis sedang melemah, bukan sekadar tekanan biaya.` });
    }
  }
  if (fin(s.roe)) {
    if (s.roe < 0) out.push({ tone: "danger", lead: "Rugi", text: `ROE ${lvl(s.roe)}: perusahaan sedang merugi sehingga menggerus ekuitas pemegang saham.` });
    else if (s.roe < 8) out.push({ tone: "warn", text: `ROE ${lvl(s.roe)} rendah; modal pemegang saham belum menghasilkan imbal hasil yang memadai.` });
    else if (s.roe >= 15) out.push({ tone: "good", text: `ROE ${lvl(s.roe)} tergolong kuat.` });
    else out.push({ tone: "info", text: `ROE ${lvl(s.roe)} tergolong sedang.` });
  }
  if (fin(f?.netMargin)) {
    if (f.netMargin < 0) out.push({ tone: "danger", text: `Net margin ${lvl(f.netMargin)}: setiap penjualan masih menghasilkan rugi.` });
    else if (f.netMargin < 5) out.push({ tone: "warn", text: `Net margin tipis (${lvl(f.netMargin)}); laba rentan tergerus bila biaya naik sedikit saja.` });
  }
  if (!bank && fin(f?.der) && f.der >= 150) {
    out.push({ tone: f.der >= 250 ? "danger" : "warn", lead: "Utang tinggi", text: `DER ${num(f.der, 0)}%: utang ${num(f.der / 100, 1)} kali ekuitas. Beban bunga dan risiko gagal bayar meningkat saat laba melemah.` });
  }
  if (!bank && fin(f?.currentRatio) && f.currentRatio < 1) {
    out.push({ tone: "warn", lead: "Likuiditas ketat", text: `Current ratio ${num(f.currentRatio, 2)}x: aset lancar lebih kecil dari utang jangka pendek.` });
  }
  out.push({ tone: "info", text: "Kualitas laba belum bisa diuji: arus kas operasi (OCF) tidak tersedia, sehingga belum diketahui apakah laba benar-benar menjadi kas." });
  if (bank) out.push({ tone: "info", text: "Sektor keuangan: DER dan current ratio tidak dipakai karena struktur neraca bank memang didominasi dana pihak ketiga." });
  return out;
}

// ── 3. Valuation assessment ──────────────────────────────────────────────
function valuation(s: Stock, ctx: AnomalyContext): BedahPoint[] {
  const out: BedahPoint[] = [];
  const per = s.peRatio;
  const pbv = s.pbv;
  const peers = ctx.peers;

  if (fin(per) && per <= 0) {
    out.push({ tone: "danger", lead: "Tidak bisa dinilai", text: `PER ${num(per)}x (laba negatif). Valuasi berbasis laba tidak berlaku; harga saat ini bertumpu pada harapan pemulihan.` });
  } else if (fin(per) && peers?.per) {
    const r = per / peers.per;
    if (r > 2) out.push({ tone: "warn", lead: "Premium tinggi", text: `PER ${num(per)}x, ${num(r, 1)} kali median ${peers.group} (${num(peers.per)}x). Pasar sudah memasang ekspektasi pertumbuhan tinggi.` });
    else if (r < 0.5) out.push({ tone: "info", lead: "Diskon dalam", text: `PER ${num(per)}x jauh di bawah median ${peers.group} (${num(peers.per)}x). Bisa peluang, bisa juga value trap bila labanya sedang di puncak siklus.` });
    else out.push({ tone: "info", text: `PER ${num(per)}x dibanding median ${peers.group} ${num(peers.per)}x.` });
  }
  if (fin(pbv) && pbv > 0 && peers?.pbv) {
    out.push({ tone: pbv > peers.pbv * 2.5 ? "warn" : "info", text: `PBV ${num(pbv, 2)}x dibanding median ${peers.group} ${num(peers.pbv, 2)}x.` });
  }
  if (fin(pbv) && pbv > 0 && pbv < 1 && fin(s.roe) && s.roe < 8) {
    out.push({ tone: "warn", lead: "Value trap?", text: `PBV di bawah 1 terlihat murah, tetapi ROE hanya ${lvl(s.roe)}. Ekuitas yang tidak produktif memang biasanya dihargai di bawah nilai buku.` });
  }
  if (fin(pbv) && pbv > 5 && fin(s.roe) && s.roe < 15) {
    out.push({ tone: "danger", lead: "Mahal tanpa dukungan", text: `PBV ${num(pbv, 2)}x tidak didukung ROE ${lvl(s.roe)}. Valuasi setinggi ini umumnya hanya wajar untuk ROE di atas 20%.` });
  }
  if (fin(ctx.fairMedian) && ctx.fairMedian > 0) {
    const diff = (s.price / ctx.fairMedian - 1) * 100;
    out.push({ tone: diff > 50 ? "warn" : diff < -30 ? "good" : "info", text: `Harga ${formatPrice(s.price)} vs median estimasi harga wajar ${formatPrice(ctx.fairMedian)}: ${diff > 0 ? "premium" : "diskon"} ${num(Math.abs(diff), 0)}%.` });
  }
  return out;
}

// ── 4. Price vs performance ──────────────────────────────────────────────
function pricePerformance(s: Stock, f: Fundamentals | null, ctx: AnomalyContext): BedahPoint[] {
  const out: BedahPoint[] = [];
  const r = s.returns;
  const earn = f?.earningsGrowth;
  const y = r.year;

  if (fin(y) && fin(earn)) {
    if (y > 50 && earn < 0) out.push({ tone: "danger", lead: "Divergensi", text: `Harga naik ${pct(y)} setahun sementara laba turun ${pct(earn)}. Kenaikan harga tidak didukung kinerja; risikonya koreksi tajam bila narasi memudar.` });
    else if (y < -30 && earn > 10) out.push({ tone: "info", lead: "Tertinggal", text: `Harga turun ${pct(y)} setahun padahal laba tumbuh ${pct(earn)}. Bisa karena sentimen sektor; cek apakah ada risiko yang belum terlihat di laporan.` });
    else out.push({ tone: "info", text: `Harga 1 tahun ${pct(y)} dengan pertumbuhan laba ${pct(earn)}.` });
  } else if (fin(y)) {
    out.push({ tone: "info", text: `Harga 1 tahun ${pct(y)}; pertumbuhan laba tidak tersedia untuk pembanding.` });
  }
  if (fin(r.threeMonth) && fin(ctx.sectorMedian3m)) {
    const gap = r.threeMonth - ctx.sectorMedian3m;
    if (Math.abs(gap) >= 20) {
      out.push({ tone: gap > 0 ? "warn" : "info", text: `3 bulan ${pct(r.threeMonth)} vs median sektor ${pct(ctx.sectorMedian3m)} (selisih ${pct(gap)}). Pergerakan ini spesifik saham, bukan arus sektor.` });
    }
  }
  if (fin(r.week) && fin(r.ytd) && r.week > 15 && r.ytd < 0) {
    out.push({ tone: "warn", lead: "FOMO", text: `Melonjak ${pct(r.week)} sepekan padahal YTD masih ${pct(r.ytd)}. Lonjakan singkat setelah tren turun sering cepat berbalik.` });
  }
  return out;
}

// ── 5. Market risk signals ───────────────────────────────────────────────
function marketRisk(s: Stock, ctx: AnomalyContext): BedahPoint[] {
  const out: BedahPoint[] = [];
  const tier = capTier(s.marketCap);
  if (tier) out.push({ tone: tier.key === "third" ? "warn" : "info", text: `${tier.label} (kapitalisasi Rp${formatCompact(s.marketCap)}).` });

  const v = ctx.avgValue20;
  if (fin(v)) {
    if (v < 1e9) out.push({ tone: "danger", lead: "Tidak likuid", text: `Rata-rata nilai transaksi 20 hari hanya Rp${formatCompact(v)}/hari. Posisi sulit dijual tanpa menekan harga, dan selisih bid-offer cenderung lebar.` });
    else if (v < 5e9) out.push({ tone: "warn", text: `Rata-rata nilai transaksi 20 hari Rp${formatCompact(v)}/hari: likuiditas terbatas.` });
    else out.push({ tone: "good", text: `Rata-rata nilai transaksi 20 hari Rp${formatCompact(v)}/hari: cukup likuid.` });
  }
  if (fin(ctx.volumeRatio) && ctx.volumeRatio >= 3) {
    out.push({ tone: "warn", lead: "Lonjakan volume", text: `Volume terakhir ${num(ctx.volumeRatio, 1)} kali rata-rata 20 hari. Ini sinyal perhatian, bukan bukti manipulasi; cari berita atau aksi korporasi penyebabnya.` });
  }
  if (s.frequency > 0 && s.frequency < 100) {
    out.push({ tone: "warn", text: `Frekuensi hanya ${num(s.frequency, 0)} transaksi sehari: harga mudah digerakkan oleh sedikit order.` });
  }
  if (fin(s.freeFloat) && s.freeFloat < 15) {
    out.push({ tone: "warn", lead: "Free float rendah", text: `Free float ${lvl(s.freeFloat)}: saham yang beredar di publik sedikit, sehingga harga lebih mudah bergejolak. Bukan bukti manipulasi dengan sendirinya.` });
  }
  if (isHsc(s.symbol)) {
    out.push({ tone: "danger", lead: "HSC", text: "Masuk daftar High Shareholding Concentration BEI: ≥ 92,5% saham dikuasai 10 pemegang terbesar." });
  }
  if (fin(s.beta) && s.beta > 1.5) out.push({ tone: "warn", text: `Beta ${num(s.beta, 2)}: lebih volatil dari pasar.` });
  if (fin(s.high52) && fin(s.low52) && s.low52 > 0 && s.high52 / s.low52 >= 3) {
    out.push({ tone: "warn", lead: "Volatil", text: `Rentang 52 minggu ${formatPrice(s.low52)}–${formatPrice(s.high52)} (${num(s.high52 / s.low52, 1)} kali). Ayunan harga ekstrem.` });
  }
  return out;
}

// ── 6. Missing data & keyakinan ──────────────────────────────────────────
export function missingData(s: Stock, f: Fundamentals | null, ctx: AnomalyContext) {
  const bank = isFinancial(s);
  const fields: [string, unknown][] = [
    ["PER", s.peRatio],
    ["PBV", s.pbv],
    ["ROE", s.roe],
    ["Net margin", f?.netMargin],
    ["Pertumbuhan pendapatan", f?.revenueGrowth],
    ["Pertumbuhan laba", f?.earningsGrowth],
    ...(bank ? [] : ([["DER", f?.der], ["Current ratio", f?.currentRatio]] as [string, unknown][])),
    ["Beta", s.beta],
    ["Free float", s.freeFloat],
    ["Rentang 52 minggu", s.high52 && s.low52 ? 1 : null],
    ["Rata-rata nilai transaksi 20 hari", ctx.avgValue20],
    ["Median valuasi sektor", ctx.peers?.per ?? ctx.peers?.pbv],
    ["Kinerja harga 1 tahun", s.returns.year],
  ];
  const missing = fields.filter(([, v]) => v == null).map(([k]) => k);
  // Selalu tidak tersedia di sumber data aplikasi
  const never = ["Arus kas operasi (OCF)", "Bid-ask spread", "Konsentrasi transaksi per broker"];
  const pctAvail = Math.round(((fields.length - missing.length) / fields.length) * 100);
  const level: AnomalyReport["confidence"]["level"] = pctAvail >= 85 ? "Tinggi" : pctAvail >= 60 ? "Sedang" : "Rendah";
  return { missing: [...missing, ...never], confidence: { level, pct: pctAvail } };
}

// ── 7 & 8. Risiko & sikap ───────────────────────────────────────────────
function classify(sections: AnomalySection[], s: Stock, f: Fundamentals | null, ctx: AnomalyContext): Pick<AnomalyReport, "risk" | "action"> {
  const flagged = sections.flatMap((sec) => sec.points.filter((p) => p.tone === "danger" || p.tone === "warn"));
  const dangers = flagged.filter((p) => p.tone === "danger");
  const score = dangers.length * 3 + (flagged.length - dangers.length);
  const illiquid = fin(ctx.avgValue20) && ctx.avgValue20 < 1e9;
  const loss = (fin(s.peRatio) && s.peRatio <= 0) || (fin(s.roe) && s.roe < 0);

  let level: RiskLevel = score >= 13 || (dangers.length >= 3 && illiquid) ? "EXTREME" : score >= 8 ? "HIGH" : score >= 4 ? "MEDIUM" : "LOW";
  if (level === "LOW" && dangers.length) level = "MEDIUM";
  // Kalimat pertama tiap temuan (bukan kata pembuka seperti "Waspada" yang tidak informatif sendirian)
  const reasons = dangers
    .concat(flagged.filter((p) => p.tone === "warn"))
    .slice(0, 4)
    .map((p) => {
      const first = p.text.split(/(?<=[^\d])[.:;](?=\s|$)/)[0].trim();
      return first.length > 110 ? `${first.slice(0, 107).trimEnd()}…` : first;
    });
  if (!reasons.length) reasons.push("Tidak ada anomali signifikan pada data yang tersedia");

  const discount = fin(ctx.fairMedian) && ctx.fairMedian > 0 && s.price < ctx.fairMedian * 0.9;
  const growing = (f?.earningsGrowth ?? 0) >= 0;
  const low52 = fin(s.low52) ? formatPrice(s.low52) : null;

  let action: AnomalyReport["action"];
  if (level === "EXTREME" || (level === "HIGH" && (loss || illiquid))) {
    action = {
      verdict: "AVOID",
      reason: `Risiko ${level} ${loss ? "dengan laba negatif" : illiquid ? "dengan likuiditas sangat tipis" : ""}`.trim() + ". Ketidakpastian lebih besar dari potensi yang bisa diukur dari data.",
      invalidation: [
        loss ? "Laporan berikutnya kembali mencetak laba positif" : "Rasio fundamental kembali normal pada laporan berikutnya",
        "Rata-rata nilai transaksi naik di atas Rp5 M/hari secara konsisten",
        ...(isHsc(s.symbol) ? ["Saham keluar dari daftar HSC"] : []),
      ],
    };
  } else if (level === "LOW" && discount && growing && !loss) {
    action = {
      verdict: "BUY",
      reason: `Risiko rendah, harga di bawah median estimasi harga wajar (${formatPrice(ctx.fairMedian!)}), dan laba tidak sedang menyusut.`,
      invalidation: [
        "Pertumbuhan laba berbalik negatif pada laporan berikutnya",
        `Harga naik melewati estimasi harga wajar ${formatPrice(ctx.fairMedian!)} (diskon hilang)`,
        ...(low52 ? [`Harga menembus di bawah level terendah 52 minggu ${low52}`] : []),
      ],
    };
  } else {
    action = {
      verdict: "WATCH",
      reason:
        level === "LOW"
          ? "Risiko rendah, tetapi valuasi belum memberi diskon yang cukup atau laba sedang menyusut."
          : `Ada ${flagged.length} sinyal yang perlu dipantau (risiko ${level}); belum cukup alasan untuk masuk maupun menghindari sepenuhnya.`,
      invalidation: [
        "Naik ke BUY bila anomali utama teratasi dan harga turun di bawah estimasi harga wajar",
        "Turun ke AVOID bila laba berbalik rugi atau likuiditas mengering",
      ],
    };
  }
  return { risk: { level, reasons }, action };
}

export function anomalyRules(stock: Stock, f: Fundamentals | null, ctx: AnomalyContext): AnomalyReport {
  const build: Record<AnomalySectionKey, BedahPoint[]> = {
    data: dataCheck(stock, f),
    fundamental: fundamentalReality(stock, f),
    valuasi: valuation(stock, ctx),
    harga: pricePerformance(stock, f, ctx),
    pasar: marketRisk(stock, ctx),
  };
  const sections = ANOMALY_KEYS.map((key) => ({
    key,
    title: ANOMALY_TITLES[key],
    points: build[key].length ? build[key] : [{ tone: "info" as const, text: "Tidak cukup data untuk menilai bagian ini." }],
  }));
  return { sections, ...missingData(stock, f, ctx), ...classify(sections, stock, f, ctx) };
}
