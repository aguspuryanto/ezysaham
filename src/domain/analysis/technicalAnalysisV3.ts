/**
 * technicalAnalysisV3.ts — "📊 CORE TECHNICAL" EzySaham v3
 *
 * Mandatory order:
 *   1. FASE → 2. TREND (short · medium · long) → 3. TENAGA (volume/RVOL) → 4. MOMENTUM (RSI/MACD)
 *   → 5. POSISI HARGA (S/R) → 6. ENTRY (safe zone now?) → 7. RISIKO (SL · R:R) → 8. KEPUTUSAN
 *
 * Consistency with the headline card is by construction, not by coincidence:
 *   • Trend per horizon comes from the engine (PRICE + EMA + STRUCTURE, never one indicator):
 *     short = EMA 9/21, medium = EMA 50 (= the headline trend & the BUY gate), long = EMA 200.
 *   • TERLALU JAUH ⇔ the engine's chase guard ⇔ AVOID CHASING.
 *   • Entry ADA ⇔ the engine has an executable BUY plan. A good R:R alone is only potential.
 *   • Keputusan IS the engine's Trading verdict (which already refuses BUY on conflicting indicators).
 *   • Trend ≠ Tenaga ≠ Momentum ≠ Posisi ≠ Entry. Good R:R / big volume / strong momentum alone ≠ BUY;
 *     when readings disagree, `decision.conflicts` says so in one short line each.
 * Plain words throughout; each step shows only the reading that drives the decision. Pure & deterministic.
 */

import { DecisionV3Report, HorizonTrend, LEVEL_TEXT, MIN_RR, PriceStructure } from '@/domain/analysis/decisionEngineV3';
import { MomentumInput } from '@/domain/analysis/momentumSpeculation';
import { ema, lastValid } from '@/domain/indicators/movingAverages';
import { OHLCVBar } from '@/domain/models/History';

export { priceStructure } from '@/domain/analysis/decisionEngineV3';

export type Phase = 'AKUMULASI' | 'MARKUP' | 'DISTRIBUSI' | 'MARKDOWN' | 'RECOVERY' | 'SIDEWAYS';
export type TrendCall = 'BULLISH' | 'RECOVERY' | 'NETRAL' | 'MELEMAH' | 'BEARISH' | 'N/A';
export type PowerCall = 'KUAT' | 'CUKUP' | 'LEMAH' | 'N/A';
export type MomentumCall = 'KUAT' | 'NETRAL' | 'LEMAH' | 'N/A';
export type PositionCall = 'DEKAT SUPPORT' | 'TENGAH' | 'DEKAT RESISTANCE' | 'BREAKOUT' | 'TERLALU JAUH';
export type EntryCall = 'ADA' | 'BELUM ADA';
export type RiskCall = 'RENDAH' | 'SEDANG' | 'TINGGI';
export type FinalCall = 'BUY' | 'WAIT' | 'AVOID' | 'AVOID CHASING';
export type RiskFlagKey = 'OVEREXTENDED' | 'VOLUME LEMAH' | 'RESISTANCE KUAT' | 'TREND BEARISH' | 'RISK/REWARD BURUK';
export type TaTone = 'positive' | 'warning' | 'negative' | 'neutral';

export interface TaStep<T extends string> {
  value: T;
  tone: TaTone;
  /** The "→" line: only the readings behind the value. */
  detail: string;
  /** One plain sentence. */
  explain: string;
}

export interface TechnicalIndicators {
  price: number;
  structure: PriceStructure;
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  volume: number | null;
  rvol: number | null;
  rsi: number | null;
  macdHist: number | null;
  support: number | null;
  resistance: number | null;
  /** % from price down to support / up to resistance (both positive). */
  distSupportPct: number | null;
  distResistancePct: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  sl: number | null;
  target: number | null;
  rr: number | null;
}

export interface TechnicalAnalysisV3 {
  phase: TaStep<Phase>;
  trend: TaStep<TrendCall> & { short: TrendCall; medium: TrendCall; long: TrendCall };
  power: TaStep<PowerCall>;
  momentum: TaStep<MomentumCall>;
  position: TaStep<PositionCall>;
  entry: TaStep<EntryCall>;
  risk: TaStep<RiskCall> & { flags: Array<{ key: RiskFlagKey; text: string }> };
  decision: TaStep<FinalCall> & { checks: Array<{ label: string; ok: boolean }>; conflicts: string[] };
  /** "Saham bagus" ≠ "waktu beli bagus". */
  stockVsTiming: { stock: string; timing: string; note: string };
  indicators: TechnicalIndicators;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const ok = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;
const finite = (n: number | null | undefined): n is number => n != null && Number.isFinite(n);
const pos = (n: number): number | null => (Number.isFinite(n) && n > 0 ? n : null);
const n1 = (n: number, dec = 1) => n.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const rpZone = (lo: number, hi: number) => (lo === hi ? rp(lo) : `${rp(lo)}–${Math.round(hi).toLocaleString('id-ID')}`);
const pct = (a: number, b: number) => ((a - b) / b) * 100;
/** Within this % of support / resistance counts as "dekat". */
const NEAR_PCT = 3;

const emaOf = (bars: OHLCVBar[], period: number) => (bars.length >= period ? pos(lastValid(ema(bars.map((b) => b.close), period))) : null);
export const trendTone = (t: TrendCall): TaTone => (t === 'BULLISH' ? 'positive' : t === 'BEARISH' ? 'negative' : t === 'NETRAL' || t === 'N/A' ? 'neutral' : 'warning');
const up = (t: TrendCall) => t === 'BULLISH' || t === 'RECOVERY';
const down = (t: TrendCall) => t === 'BEARISH' || t === 'MELEMAH';
const call = (h: HorizonTrend): TrendCall => (h === 'NA' ? 'N/A' : h);
/** "5,6 jt lbr". */
const shares = (v: number) => (v >= 1e9 ? `${n1(v / 1e9)} M lbr` : v >= 1e6 ? `${n1(v / 1e6)} jt lbr` : `${Math.round(v).toLocaleString('id-ID')} lbr`);

// ─── Builder ────────────────────────────────────────────────────────────────────

/** EMA 21 / EMA 200 and the long-term structure come from `i.ema21` / `i.ema200` / `i.longBars` (see decisionInput). */
export function buildTechnicalAnalysis(i: MomentumInput, r: DecisionV3Report): TechnicalAnalysisV3 {
  const price = i.price;
  const bars = i.bars;
  const history = i.longBars && i.longBars.length > bars.length ? i.longBars : bars;
  const structure = r.trend.structure;
  const ema9 = ok(i.ema9) ? i.ema9 : emaOf(bars, 9);
  const ema21 = ok(i.ema21) ? i.ema21 : emaOf(history, 21);
  const ema50 = ok(i.ema50) ? i.ema50 : emaOf(history, 50);
  const ema200 = ok(i.ema200) ? i.ema200 : emaOf(history, 200);
  const rvol = ok(i.rvol) ? i.rvol : null;
  const rsi = finite(i.rsi14) ? i.rsi14 : null;
  const macdHist = finite(i.macdHistogram) ? i.macdHistogram : null;
  const lastBar = bars[bars.length - 1];
  const volume = lastBar && lastBar.volume > 0 ? lastBar.volume : null;
  const chase = r.momentum.chaseFlags.length > 0;
  const extended = r.momentum.stage === 'EXTENDED';
  const status = r.simple.status;
  const plan = r.simple.plan;
  const setup = r.primarySetup;

  // ── 2. TREND — the engine's per-horizon read (price + EMA + structure) ──
  const h = r.trend.horizons;
  const short = call(h.short.trend);
  const medium = call(h.medium.trend);
  const long = call(h.long.trend);
  const longNote = long === 'N/A' ? ' (jangka panjang belum bisa dinilai)' : '';
  const trendExplain = short === 'BULLISH' && medium === 'BULLISH' && long === 'BULLISH' ? 'Naik di jangka pendek, menengah, dan panjang — arahnya sehat.'
    : up(short) && up(medium) && (long === 'BEARISH' || long === 'RECOVERY') ? 'Sedang bangkit, tetapi masih di bawah EMA 200 — belum pulih total.'
      : up(short) && up(medium) ? `Naik di jangka pendek dan menengah${longNote}.`
        : down(short) && up(medium) ? 'Arah utamanya naik, tetapi jangka pendek sedang melemah (koreksi).'
          : up(short) && !up(medium) ? 'Baru mulai membaik dalam jangka pendek; arah besarnya belum berubah.'
            : down(medium) && long === 'BULLISH' ? 'Jangka panjang masih naik, tetapi jangka menengah sedang melemah.'
              : down(short) && down(medium) ? `Turun di jangka pendek dan menengah — jangan melawan arus${longNote}.`
                : medium === 'NETRAL' ? 'Harga dekat garis rata-rata dan polanya campur — arahnya belum jelas.'
                  : 'Arahnya berbeda di tiap jangka waktu — belum jelas.';
  const trend: TechnicalAnalysisV3['trend'] = {
    value: medium,
    tone: trendTone(medium),
    detail: `Pendek ${short} · Menengah ${medium} · Panjang ${long}`,
    explain: trendExplain,
    short, medium, long,
  };

  // ── 1. FASE — read from the same horizons, so phase and trend never disagree ──
  const closes = bars.map((b) => b.close);
  const priorMove = closes.length >= 61 ? pct(closes[closes.length - 21], closes[closes.length - 61]) : null;
  const phaseValue: Phase = medium === 'BEARISH' ? 'MARKDOWN'
    : medium === 'MELEMAH' || (down(short) && priorMove != null && priorMove >= 15) ? 'DISTRIBUSI'
      : short === 'RECOVERY' || medium === 'RECOVERY' || (up(medium) && (long === 'BEARISH' || long === 'RECOVERY')) ? 'RECOVERY'
        : medium === 'BULLISH' ? 'MARKUP'
          : priorMove != null && priorMove <= -15 && !down(short) ? 'AKUMULASI'
            : 'SIDEWAYS';
  const PHASE_TEXT: Record<Phase, string> = {
    AKUMULASI: 'setelah lama turun, harga berhenti turun — seperti ada yang diam-diam mengumpulkan.',
    MARKUP: 'harga naik bertahap, puncak dan lembahnya makin tinggi — seperti naik tangga.',
    DISTRIBUSI: 'setelah naik tinggi, harga mulai tertahan — bisa jadi ada yang mulai menjual.',
    MARKDOWN: 'harga turun, puncak dan lembahnya makin rendah — seperti turun tangga.',
    RECOVERY: 'harga mulai bangkit lagi setelah melemah, tetapi belum kembali kuat sepenuhnya.',
    SIDEWAYS: 'harga bolak-balik di tempat yang sama dan belum memilih arah.',
  };
  const phase: TaStep<Phase> = {
    value: phaseValue,
    tone: phaseValue === 'MARKUP' ? 'positive' : phaseValue === 'MARKDOWN' || phaseValue === 'DISTRIBUSI' ? 'negative'
      : phaseValue === 'SIDEWAYS' ? 'neutral' : 'warning',
    detail: structure.label,
    explain: PHASE_TEXT[phaseValue],
  };

  // ── 3. TENAGA (Volume + RVOL) ──
  const upDay = lastBar ? lastBar.close >= lastBar.open : (i.change1D ?? 0) >= 0;
  const powerValue: PowerCall = rvol == null ? 'N/A' : rvol >= 1.5 ? (upDay ? 'KUAT' : 'LEMAH') : rvol >= 0.7 ? 'CUKUP' : 'LEMAH';
  const power: TaStep<PowerCall> = {
    value: powerValue,
    tone: powerValue === 'KUAT' ? 'positive' : powerValue === 'CUKUP' ? 'warning' : powerValue === 'LEMAH' ? 'negative' : 'neutral',
    detail: rvol == null ? 'Data volume belum tersedia'
      : `${volume != null ? `Volume ${shares(volume)} · ` : ''}RVOL ${n1(rvol)}× rata-rata${rvol >= 1.5 && !upDay ? ' (didominasi penjual)' : ''}`,
    explain: powerValue === 'KUAT' ? 'Banyak pembeli datang hari ini.'
      : powerValue === 'CUKUP' ? 'Pembeli ada, jumlahnya biasa saja.'
        : powerValue === 'LEMAH' ? (rvol != null && rvol >= 1.5 ? 'Ramai, tetapi yang ramai justru penjual.' : 'Sepi — sedikit yang ikut membeli.')
          : 'Belum bisa dinilai.',
  };

  // ── 4. MOMENTUM (RSI + MACD) ──
  const momentumValue: MomentumCall = rsi == null && macdHist == null ? 'N/A'
    : (rsi != null && rsi < 45) || (macdHist != null && macdHist < 0 && (rsi == null || rsi < 50)) ? 'LEMAH'
      : (rsi == null || rsi >= 55) && (macdHist == null || macdHist > 0) ? 'KUAT'
        : 'NETRAL';
  const momentum: TaStep<MomentumCall> = {
    value: momentumValue,
    tone: momentumValue === 'KUAT' ? 'positive' : momentumValue === 'LEMAH' ? 'negative' : momentumValue === 'NETRAL' ? 'warning' : 'neutral',
    detail: [rsi != null ? `RSI ${n1(rsi, 0)}` : null, macdHist != null ? `MACD ${macdHist > 0 ? 'POSITIF' : 'NEGATIF'}` : null].filter(Boolean).join(' · ') || 'RSI / MACD belum tersedia',
    explain: momentumValue === 'KUAT' ? (rsi != null && rsi > 70 ? 'Tenaga naiknya besar, tetapi sudah "kepanasan".' : 'Dorongan naiknya masih terasa.')
      : momentumValue === 'NETRAL' ? 'Dorongannya sedang-sedang saja.'
        : momentumValue === 'LEMAH' ? 'Dorongan naiknya melemah.'
          : 'Belum bisa dinilai.',
  };

  // ── 5. POSISI HARGA ──
  const support = i.supports.filter((s) => ok(s) && s < price).sort((a, b) => b - a)[0] ?? null;
  const resistance = [...i.resistances, ...(ok(i.annualHigh) ? [i.annualHigh] : [])].filter((x) => ok(x) && x > price).sort((a, b) => a - b)[0] ?? null;
  const distSupportPct = support != null ? pct(price, support) : null;
  const distResistancePct = resistance != null ? pct(resistance, price) : null;
  const breakout = r.setups.find((s) => s.kind === 'BREAKOUT');
  const where = support != null && resistance != null ? (price - support) / (resistance - support) : null;
  const positionValue: PositionCall = chase ? 'TERLALU JAUH'
    : breakout?.triggered ? 'BREAKOUT'
      : where != null ? (where <= 1 / 3 ? 'DEKAT SUPPORT' : where >= 2 / 3 ? 'DEKAT RESISTANCE' : 'TENGAH')
        : distSupportPct != null && distSupportPct <= NEAR_PCT ? 'DEKAT SUPPORT'
          : distResistancePct != null && distResistancePct <= NEAR_PCT ? 'DEKAT RESISTANCE'
            : 'TENGAH';
  const POSITION_TEXT: Record<PositionCall, string> = {
    'DEKAT SUPPORT': 'Harga dekat "lantai" (support) — tempat harga biasanya berhenti turun.',
    TENGAH: 'Harga ada di tengah — tidak dekat lantai, tidak dekat atap.',
    'DEKAT RESISTANCE': 'Harga dekat "atap" (resistance) — tempat harga biasanya tertahan.',
    BREAKOUT: 'Harga baru menembus "atap". Kalau bertahan, atap lama bisa jadi lantai baru.',
    'TERLALU JAUH': 'Harga sudah lari terlalu jauh dari lantainya — rawan turun kembali.',
  };
  const position: TaStep<PositionCall> = {
    value: positionValue,
    tone: positionValue === 'DEKAT SUPPORT' || positionValue === 'BREAKOUT' ? 'positive'
      : positionValue === 'TERLALU JAUH' ? 'negative' : positionValue === 'DEKAT RESISTANCE' ? 'warning' : 'neutral',
    detail: `Support ${support != null ? rp(support) : '—'} · Resistance ${resistance != null ? rp(resistance) : '— (dekat harga tertinggi)'}`,
    explain: POSITION_TEXT[positionValue] + (extended && positionValue !== 'TERLALU JAUH' ? ' Harga juga sudah agak jauh dari rata-ratanya.' : ''),
  };

  // ── 6. ENTRY — only an executable BUY plan counts as a safe entry now ──
  const entryNow = status === 'BUY' && plan != null && !plan.conditional;
  const better = r.simple.betterEntry;
  const entry: TaStep<EntryCall> = {
    value: entryNow ? 'ADA' : 'BELUM ADA',
    tone: entryNow ? 'positive' : status === 'AVOID' ? 'negative' : 'warning',
    detail: entryNow ? `Entry ${rpZone(plan.entryLow, plan.entryHigh)}`
      : better ? `Tunggu pullback ke ± ${rp(better.price)}`
        : plan?.conditional ? `Tunggu konfirmasi — area ${rpZone(plan.entryLow, plan.entryHigh)}`
          : chase || extended ? 'Tunggu pullback' : 'Tunggu konfirmasi',
    explain: entryNow ? 'Harga sekarang ada di zona beli yang aman.'
      : up(medium) ? 'Arahnya membaik, tetapi titik masuknya belum aman — sabar dulu.'
        : 'Belum ada titik masuk yang aman.',
  };

  // ── 7. RISIKO (support · SL · R:R) — same levels the engine uses ──
  const target = plan?.targets[0]?.price ?? setup?.targets[0]?.price ?? resistance;
  const sl = plan?.sl ?? setup?.sl ?? support;
  const upside = target != null ? pct(target, price) : null;
  const downside = sl != null ? pct(price, sl) : null;
  const rr = plan?.riskReward ?? (upside != null && downside != null && downside > 0 ? Math.max(0, upside) / downside : null);
  const flags: Array<{ key: RiskFlagKey; text: string }> = [];
  if (chase || extended) flags.push({ key: 'OVEREXTENDED', text: 'Harga sudah naik terlalu jauh.' });
  if (powerValue === 'LEMAH') flags.push({ key: 'VOLUME LEMAH', text: 'Pembelinya sedikit.' });
  if (distResistancePct != null && distResistancePct < NEAR_PCT && positionValue !== 'BREAKOUT') flags.push({ key: 'RESISTANCE KUAT', text: '"Atap" dekat di atas harga.' });
  if (medium === 'BEARISH') flags.push({ key: 'TREND BEARISH', text: 'Arah harga sedang turun.' });
  if (rr != null && rr < MIN_RR) flags.push({ key: 'RISK/REWARD BURUK', text: 'Untungnya tidak sebanding dengan risikonya.' });
  const riskValue = LEVEL_TEXT[r.simple.risk].toUpperCase() as RiskCall;
  const risk: TechnicalAnalysisV3['risk'] = {
    value: riskValue,
    tone: riskValue === 'RENDAH' ? 'positive' : riskValue === 'SEDANG' ? 'warning' : 'negative',
    detail: `SL ${sl != null ? `${rp(sl)}${downside != null ? ` (−${n1(downside)}%)` : ''}` : '—'} · R:R ${rr != null ? `1 : ${n1(rr)}` : '—'}`
      + (rr != null && rr >= MIN_RR && status !== 'BUY' ? ' (potensi, bukan sinyal beli)' : ''),
    explain: rr != null && rr >= MIN_RR && status !== 'BUY'
      ? 'R:R bagus baru berarti POTENSI untung — bukan sinyal beli.'
      : flags.length ? flags.map((f) => f.text).join(' ') : 'Tidak ada tanda bahaya besar.',
    flags,
  };

  // ── 8. KEPUTUSAN — the engine's Trading verdict ──
  const finalValue: FinalCall = status === 'AVOID' && r.simple.tag === 'AVOID CHASING' ? 'AVOID CHASING' : status;
  const checks = [
    { label: 'Trend naik', ok: medium === 'BULLISH' },
    { label: 'Tenaga cukup', ok: powerValue === 'KUAT' || powerValue === 'CUKUP' },
    { label: 'Momentum tidak lemah', ok: momentumValue === 'KUAT' || momentumValue === 'NETRAL' },
    { label: 'Entry aman', ok: entryNow },
    { label: `R:R ≥ 1 : ${n1(MIN_RR)}`, ok: rr != null && rr >= MIN_RR },
  ];
  const missing = checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
  // Disagreeing readings, one short line each (max 3) — explained, never forced into a BUY.
  const strongButNoEntry = [powerValue === 'KUAT' && 'volume besar', momentumValue === 'KUAT' && 'momentum kuat'].filter(Boolean).join(' & ');
  const conflicts = [
    up(short) && down(long) ? 'Jangka pendek naik, tetapi jangka panjang masih turun.' : null,
    down(short) && up(medium) ? 'Jangka pendek melemah di dalam arah naik.' : null,
    up(medium) && powerValue === 'LEMAH' ? 'Arahnya naik, tetapi transaksinya sepi.' : null,
    up(medium) && momentumValue === 'LEMAH' ? 'Arahnya naik, tetapi momentumnya melemah.' : null,
    strongButNoEntry && !entryNow ? `Ada ${strongButNoEntry}, tetapi belum ada entry aman.` : null,
    rr != null && rr >= MIN_RR && !entryNow ? 'R:R bagus, tetapi baru potensi — bukan sinyal beli.' : null,
  ].filter((x): x is string => Boolean(x)).slice(0, 3);
  const decision: TechnicalAnalysisV3['decision'] = {
    value: finalValue,
    tone: finalValue === 'BUY' ? 'positive' : finalValue === 'WAIT' ? 'warning' : 'negative',
    detail: r.simple.conclusion,
    explain: finalValue === 'BUY' ? 'Arah, tenaga, momentum, titik masuk, dan untung-ruginya sama-sama mendukung.'
      : finalValue === 'AVOID CHASING' ? 'Sahamnya sedang kencang, tetapi harganya sudah lari terlalu jauh. Kalau dikejar sekarang, gampang "nyangkut" di atas.'
        : finalValue === 'AVOID' ? 'Terlalu banyak tanda bahaya — lebih baik menjauh dulu.'
          : `Ada yang bagus, tetapi belum semuanya cocok${missing.length ? ` (${missing.join(', ')} belum terpenuhi)` : ''}. Sabar dulu.`,
    checks,
    conflicts,
  };

  // Saham bagus ≠ waktu beli bagus.
  const fl = r.evidence.fundamentalLabel;
  const stock = fl === 'Fundamental Solid' ? 'Bagus' : fl === 'Fundamental Mixed' ? 'Cukup' : fl === 'Fundamental Lemah' ? 'Lemah' : 'Belum bisa dinilai';
  const timing = status === 'BUY' ? 'Bagus' : status === 'WAIT' ? 'Belum' : 'Tidak bagus';
  const stockVsTiming = {
    stock,
    timing,
    note: stock === 'Bagus' && status !== 'BUY' ? 'Perusahaannya bagus, tetapi waktu belinya belum tepat.'
      : stock !== 'Bagus' && status === 'BUY' ? 'Waktu belinya bagus untuk trading singkat, tetapi perusahaannya belum tentu bagus untuk disimpan lama.'
        : 'Saham bagus belum tentu waktu belinya bagus — keduanya dinilai terpisah.',
  };

  return {
    phase, trend, power, momentum, position, entry, risk, decision, stockVsTiming,
    indicators: {
      price, structure, ema9, ema21, ema50, ema200, volume, rvol, rsi, macdHist,
      support, resistance, distSupportPct, distResistancePct,
      entryLow: entryNow ? plan.entryLow : null,
      entryHigh: entryNow ? plan.entryHigh : null,
      sl, target, rr,
    },
  };
}
