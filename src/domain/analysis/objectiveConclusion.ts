/**
 * objectiveConclusion.ts
 *
 * "Kesimpulan Objektif" — a cross-check synthesis layer, separate from the AI
 * Stock Advisor (aiStockEngine.ts). Where the advisor blends scores into one
 * composite verdict, this looks specifically for the kind of mismatches a
 * blended score can hide: an abnormal short-term price move, a fundamental-vs-
 * technical divergence, a Bandar Detector distribution warning, and regulatory
 * red flags (UMA/suspension/notasi khusus) sitting unnoticed inside ordinary
 * news headlines. Surfaced once per ticker, above the tab content.
 */

import { OHLCVBar } from '@/domain/models/History';
import { StockSummary } from '@/domain/models/Stock';
import { StockNewsItem } from '@/domain/models/News';
import { FundamentalScreeningResult, TechnicalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { BandarScoreResult } from '@/domain/analysis/bandarScore';

export type ConclusionTone = 'caution' | 'neutral' | 'supportive';

export interface ObjectiveConclusionFlag {
  key: string;
  label: string;
  detail: string;
  tone: ConclusionTone;
}

export interface ObjectiveConclusionNewsRef {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

export interface ObjectiveConclusionResult {
  tone: ConclusionTone;
  headline: string;
  summary: string;
  flags: ObjectiveConclusionFlag[];
  regulatoryNews: ObjectiveConclusionNewsRef[];
}

const REGULATORY_KEYWORDS = [
  'uma',
  'unusual market activity',
  'gembok',
  'suspensi',
  'disuspensi',
  'penghentian sementara',
  'penghentian perdagangan',
  'ara beruntun',
  'notasi khusus',
  'cooling down',
];

function calcPriceMoveFlag(summary: StockSummary, bars: OHLCVBar[]): ObjectiveConclusionFlag | null {
  const LOOKBACK = 20;
  if (bars.length <= LOOKBACK) return null;
  const base = bars[bars.length - 1 - LOOKBACK].close;
  if (base <= 0) return null;
  const pct = ((summary.lastClose - base) / base) * 100;

  if (pct >= 150) {
    return {
      key: 'priceMove',
      label: 'Kenaikan Harga Ekstrem',
      detail: `Harga naik ${pct.toFixed(0)}% dalam ~20 hari bursa terakhir — jauh di atas pergerakan wajar, waspadai risiko koreksi tajam begitu momentum spekulatif mereda.`,
      tone: 'caution',
    };
  }
  if (pct >= 60) {
    return {
      key: 'priceMove',
      label: 'Kenaikan Harga Signifikan',
      detail: `Harga naik ${pct.toFixed(0)}% dalam ~20 hari bursa terakhir — signifikan, perhatikan apakah ada berita/aksi korporasi yang menjustifikasi.`,
      tone: 'neutral',
    };
  }
  if (pct <= -40) {
    return {
      key: 'priceMove',
      label: 'Penurunan Harga Tajam',
      detail: `Harga turun ${Math.abs(pct).toFixed(0)}% dalam ~20 hari bursa terakhir — tekanan jual besar, cek penyebabnya sebelum menganggap ini "harga murah".`,
      tone: 'caution',
    };
  }
  return null;
}

function calcDivergenceFlag(
  fundamentalScreening: FundamentalScreeningResult,
  technicalScreening: TechnicalScreeningResult
): ObjectiveConclusionFlag {
  const fundOk = fundamentalScreening.passed;
  const techOk = technicalScreening.passed;

  if (!fundOk && techOk) {
    return {
      key: 'divergence',
      label: 'Divergensi Fundamental vs Teknikal',
      detail: `Screening Fundamental gagal (${fundamentalScreening.score}/100) sementara Teknikal justru kuat (${technicalScreening.score}/100) — kenaikan harga tidak didukung perbaikan bisnis, ciri khas pergerakan spekulatif.`,
      tone: 'caution',
    };
  }
  if (fundOk && !techOk) {
    return {
      key: 'divergence',
      label: 'Fundamental Kuat, Momentum Belum Terbentuk',
      detail: `Fundamental solid (${fundamentalScreening.score}/100) tapi Teknikal belum mengonfirmasi (${technicalScreening.score}/100) — berpotensi undervalued, tapi butuh kesabaran menunggu momentum harga.`,
      tone: 'neutral',
    };
  }
  if (fundOk && techOk) {
    return {
      key: 'divergence',
      label: 'Fundamental & Teknikal Sejalan',
      detail: `Screening Fundamental (${fundamentalScreening.score}/100) dan Teknikal (${technicalScreening.score}/100) sama-sama lolos — kenaikan/tren harga punya dukungan bisnis, bukan sekadar spekulasi.`,
      tone: 'supportive',
    };
  }
  return {
    key: 'divergence',
    label: 'Fundamental & Teknikal Sama-sama Lemah',
    detail: `Screening Fundamental (${fundamentalScreening.score}/100) dan Teknikal (${technicalScreening.score}/100) sama-sama gagal — belum ada alasan kuat untuk masuk dari kedua sisi.`,
    tone: 'caution',
  };
}

function calcBandarFlag(bandarScore: BandarScoreResult): ObjectiveConclusionFlag | null {
  if (bandarScore.hiddenDistributionWarning) {
    const obvFactor = bandarScore.factors.find((f) => f.key === 'obvDivergence');
    return {
      key: 'bandar',
      label: 'Indikasi Hidden Distribution',
      detail: obvFactor?.detail ?? 'Harga naik/flat tapi OBV melemah — smart money bisa jadi menjual ke pembeli baru.',
      tone: 'caution',
    };
  }
  if (bandarScore.phase === 'distribution' || bandarScore.phase === 'markdown') {
    return {
      key: 'bandar',
      label: 'Fase Wyckoff Berisiko',
      detail: `Bandar Detector membaca fase saat ini sebagai "${bandarScore.phaseLabel}" (skor ${bandarScore.total}/100) — bukan fase akumulasi yang ideal untuk masuk baru.`,
      tone: 'caution',
    };
  }
  if (bandarScore.phase === 'accumulation' && bandarScore.total >= 65) {
    return {
      key: 'bandar',
      label: 'Fase Accumulation Terkonfirmasi',
      detail: `Bandar Detector membaca fase saat ini sebagai "${bandarScore.phaseLabel}" dengan skor ${bandarScore.total}/100 — pola volume & OBV mendukung tesis akumulasi.`,
      tone: 'supportive',
    };
  }
  return null;
}

function calcRegulatoryFlag(newsItems: StockNewsItem[]): {
  flag: ObjectiveConclusionFlag | null;
  regulatoryNews: ObjectiveConclusionNewsRef[];
} {
  const matches = newsItems.filter((n) => {
    const text = `${n.title} ${n.snippet}`.toLowerCase();
    return REGULATORY_KEYWORDS.some((kw) => text.includes(kw));
  });

  if (matches.length === 0) return { flag: null, regulatoryNews: [] };

  const regulatoryNews = matches.slice(0, 5).map((n) => ({
    title: n.title,
    publisher: n.publisher,
    publishedAt: n.publishedAt,
    url: n.url,
  }));

  return {
    flag: {
      key: 'regulatory',
      label: 'Terdeteksi Sinyal Regulator',
      detail: `Ditemukan ${matches.length} berita yang menyinggung UMA/suspensi/notasi khusus — bursa atau OJK kemungkinan sudah memantau saham ini secara resmi.`,
      tone: 'caution',
    },
    regulatoryNews,
  };
}

function overallTone(flags: ObjectiveConclusionFlag[]): ConclusionTone {
  if (flags.some((f) => f.tone === 'caution')) return 'caution';
  if (flags.some((f) => f.tone === 'supportive')) return 'supportive';
  return 'neutral';
}

const HEADLINE_BY_TONE: Record<ConclusionTone, string> = {
  caution: '⚠️ Perlu Kehati-hatian Ekstra',
  supportive: '✅ Sinyal Saling Mendukung',
  neutral: '◻ Sinyal Campuran / Netral',
};

const RISK_MANAGEMENT_SENTENCE =
  'Ini bukan rekomendasi beli/jual — tetap terapkan manajemen risiko sendiri sebelum mengambil keputusan.';

export function computeObjectiveConclusion(params: {
  summary: StockSummary;
  bars: OHLCVBar[];
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
  bandarScore: BandarScoreResult;
  newsItems: StockNewsItem[];
}): ObjectiveConclusionResult {
  const { summary, bars, fundamentalScreening, technicalScreening, bandarScore, newsItems } = params;

  const { flag: regulatoryFlag, regulatoryNews } = calcRegulatoryFlag(newsItems);
  const priceMoveFlag = calcPriceMoveFlag(summary, bars);
  const divergenceFlag = calcDivergenceFlag(fundamentalScreening, technicalScreening);
  const bandarFlag = calcBandarFlag(bandarScore);

  // Priority order: regulatory > price move > divergence > bandar phase.
  const flags = [regulatoryFlag, priceMoveFlag, divergenceFlag, bandarFlag].filter(
    (f): f is ObjectiveConclusionFlag => f !== null
  );

  if (flags.length === 0) {
    flags.push({
      key: 'baseline',
      label: 'Tidak Ada Anomali Signifikan',
      detail: 'Tidak ditemukan pergerakan harga ekstrem, divergensi fundamental/teknikal yang tajam, sinyal distribusi dari Bandar Detector, atau sinyal regulator dari berita — analisis mengikuti pola wajar.',
      tone: fundamentalScreening.passed && technicalScreening.passed ? 'supportive' : 'neutral',
    });
  }

  const tone = overallTone(flags);
  const summary_ = `${flags.map((f) => f.detail).join(' ')} ${RISK_MANAGEMENT_SENTENCE}`;

  return {
    tone,
    headline: HEADLINE_BY_TONE[tone],
    summary: summary_,
    flags,
    regulatoryNews,
  };
}
