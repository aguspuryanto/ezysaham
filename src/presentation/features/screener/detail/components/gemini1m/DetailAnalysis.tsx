'use client';

/**
 * Level 3 — "Detail Analisis": every step of the v3 pipeline (trend, momentum, setups, liquidity, risk,
 * hot money, horizon rules, fundamentals/valuation context, sizing, consistency). Collapsed by default.
 */

import {
  DecisionV3Report,
  ENTRY_QUALITY_TEXT,
  MOMENTUM_STRENGTH_TEXT,
  QUALITY_TEXT,
  SETUP_STATE_TEXT,
  SETUP_TEXT,
  SetupEvaluation,
  STAGE_TEXT,
  STRENGTH_TEXT,
  TREND_TEXT,
} from '@/domain/analysis/decisionEngineV3';
import { fmtIdrValue, RiskItem } from '@/domain/analysis/momentumSpeculation';
import { cn } from '@/lib/format';
import { fmtNum, fmtPct, fmtRp, Tone } from '../../format';
import { Badge } from '../ui';
import {
  Bullets, Callout, Caption, CheckList, DecisionBadge, LevelBadge, riskLevelOf, RuleList, scoreTone, Section, SIGNAL_EMOJI, SIGNAL_TONE, Stat,
} from './primitives';

const GATE_TONE: Record<'PASS' | 'LIMITED' | 'FAIL', Tone> = { PASS: 'positive', LIMITED: 'warning', FAIL: 'negative' };
const STATE_TONE: Record<SetupEvaluation['state'], Tone> = { VALID: 'positive', FORMING: 'warning', INVALID: 'neutral' };
const pctOr = (n: number | null, dec = 1) => (n == null ? '—' : fmtPct(n, dec));

function SetupCard({ s, primary }: { s: SetupEvaluation; primary: boolean }) {
  return (
    <div className={cn('space-y-2 rounded-lg border bg-(--sv-surface) p-3 text-sm', primary ? 'border-(--sv-primary)/50' : 'border-(--sv-border)')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-(--sv-text)">{SETUP_TEXT[s.kind]}{primary && <span className="ml-1 text-xs font-normal text-(--sv-muted)">(dipakai)</span>}</span>
        <Badge tone={STATE_TONE[s.state]}>{SETUP_STATE_TEXT[s.state]}</Badge>
      </div>
      <p className="text-xs text-(--sv-muted)">{s.note}</p>
      {s.entryLow != null && s.entryHigh != null && (
        <p className="text-xs tabular-nums text-(--sv-text)">
          Entry {fmtRp(s.entryLow)}{s.entryHigh !== s.entryLow && `–${fmtRp(s.entryHigh).replace('Rp ', '')}`}
          {s.sl != null && <> · SL {fmtRp(s.sl)} ({fmtPct(-(s.riskPct ?? 0), 1)})</>}
          {s.targets[0] && <> · {s.targets[0].label} {fmtRp(s.targets[0].price)}</>}
          {s.riskReward != null && <> · R:R 1:{fmtNum(s.riskReward, 1)}</>}
        </p>
      )}
      {s.slBasis && <p className="text-[11px] text-(--sv-muted)">SL: {s.slBasis}</p>}
      <RuleList rules={s.checks} className="text-xs sm:grid-cols-1" />
    </div>
  );
}

function RiskCard({ title, item }: { title: string; item: RiskItem }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-(--sv-surface) p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-(--sv-text)">{title}</span>
        <LevelBadge level={riskLevelOf(item.level)} />
      </div>
      <Bullets items={item.reasons} className="text-xs text-(--sv-muted)" />
    </div>
  );
}

export function DetailAnalysis({ report, vwapLoading }: { report: DecisionV3Report; vwapLoading: boolean }) {
  const { trend, momentum, liquidity, risk, hotMoney, scores, setups, primarySetup, decisions, evidence: ev } = report;
  const scoreTiles: Array<[string, number | null, string?]> = [
    ['Trend', scores.trend],
    ['Momentum', scores.momentum],
    ['Entry', scores.entry],
    ['Risiko', scores.risk, 'makin tinggi makin aman'],
    ['Likuiditas', scores.liquidity],
    ['R:R', scores.rr],
  ];
  const plan = report.simple.plan;

  return (
    <details className="rounded-xl border border-(--sv-border) bg-(--sv-bg)/40 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-(--sv-text)">🔬 Detail Analisis</summary>
      <div className="mt-3 space-y-4">
        {!report.dataOk && <Callout tone="negative">{report.dataNote}</Callout>}

        <Section title="🧮 Skor Komponen" verdict={<span className="text-xs text-(--sv-muted)">Keputusan pakai rule/gate, bukan total skor</span>}>
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {scoreTiles.map(([label, v, hint]) => (
              <Stat key={label} label={<>{label}{hint && <span className="text-[10px]"> ({hint})</span>}</>}>
                <Badge tone={scoreTone(v)}>{v == null ? '—' : `${v}/100`}</Badge>
              </Stat>
            ))}
          </div>
        </Section>

        <Section title="📈 Trend & Momentum" verdict={<Badge tone={momentum.stage === 'PARABOLIC' ? 'negative' : momentum.stage === 'EXTENDED' ? 'warning' : 'info'}>{STAGE_TEXT[momentum.stage]}</Badge>}>
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Arah trend"><span className="font-semibold text-(--sv-text)">{TREND_TEXT[trend.direction]}{trend.pullbackDip && ' (koreksi sejenak)'}</span></Stat>
            <Stat label="Kekuatan trend"><span className="font-semibold text-(--sv-text)">{STRENGTH_TEXT[trend.strength]}</span></Stat>
            <Stat label="Slope EMA 20 / 50 (5 hari)"><span className="tabular-nums text-(--sv-text)">{pctOr(trend.ema20Slope, 2)} / {pctOr(trend.ema50Slope, 2)}</span></Stat>
            <Stat label="Kekuatan momentum"><span className="font-semibold text-(--sv-text)">{momentum.strength ?? '—'}/100 · {MOMENTUM_STRENGTH_TEXT[momentum.strengthLabel]}</span></Stat>
            <Stat label="Kualitas momentum"><Badge tone={momentum.quality === 'GOOD' ? 'positive' : momentum.quality === 'POOR' ? 'negative' : 'warning'}>{QUALITY_TEXT[momentum.quality]}</Badge></Stat>
            <Stat label="Jarak dari EMA 20"><span className="tabular-nums text-(--sv-text)">{pctOr(momentum.distEma20)}</span></Stat>
            <Stat label="Risiko momentum"><LevelBadge level={momentum.risk} /></Stat>
            <Stat label="Kualitas entry"><Badge tone={report.entryQuality === 'GOOD' ? 'positive' : report.entryQuality === 'FAIR' ? 'warning' : 'negative'}>{ENTRY_QUALITY_TEXT[report.entryQuality]}</Badge></Stat>
            <Stat label="Early momentum"><span className="text-(--sv-text)">{report.earlyMomentum ? '🟢 Ya' : '—'}</span></Stat>
          </div>
          {momentum.chaseFlags.length > 0 && (
            <Callout tone="negative">
              <Caption className="text-current">🚫 Chase risk (top gainer protection)</Caption>
              <Bullets items={momentum.chaseFlags} className="mt-1" />
            </Callout>
          )}
          {momentum.qualityNotes.length > 0 && momentum.chaseFlags.length === 0 && <Bullets items={momentum.qualityNotes} className="text-xs text-(--sv-muted)" />}
          <div className="rounded-lg bg-(--sv-surface) p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-(--sv-text)">{ev.candle.emoji} {ev.candle.pattern}</span>
              {ev.candle.buyerPower != null && (
                <span className="text-xs text-(--sv-muted)">Buyer {fmtNum(ev.candle.buyerPower, 0)}% · Seller {fmtNum(100 - ev.candle.buyerPower, 0)}%</span>
              )}
            </div>
            {ev.candle.buyerPower != null && (
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-rose-500/70" aria-hidden="true">
                <div className="bg-emerald-500" style={{ width: `${ev.candle.buyerPower}%` }} />
              </div>
            )}
            <p className="mt-2 text-(--sv-muted)">{ev.candle.note}</p>
          </div>
          <CheckList checks={[ev.rvolCheck, ...ev.positionChecks]} />
          <p className="text-xs text-(--sv-muted)">
            MACD histogram & RSI ikut dihitung di kekuatan momentum.
            {vwapLoading ? ' Memuat VWAP intraday…' : ev.positionChecks[0].signal === 'na' ? ' VWAP tidak tersedia (feed intraday kosong).' : ''}
          </p>
        </Section>

        <Section title="🎯 Deteksi Setup" verdict={<Badge tone={primarySetup?.state === 'VALID' ? 'positive' : 'neutral'}>{primarySetup ? `${SETUP_TEXT[primarySetup.kind]} · ${SETUP_STATE_TEXT[primarySetup.state]}` : 'Tidak ada'}</Badge>}>
          <div className="grid gap-2 lg:grid-cols-3">
            {setups.map((s) => <SetupCard key={s.kind} s={s} primary={s === primarySetup} />)}
          </div>
        </Section>

        <Section title="💧 Likuiditas" verdict={<Badge tone={GATE_TONE[liquidity.trading]}>Trading {liquidity.trading} · Swing {liquidity.swing}</Badge>}>
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <Stat label="Transaksi hari ini"><span className="font-semibold tabular-nums text-(--sv-text)">{fmtIdrValue(liquidity.todayValue)}</span></Stat>
            <Stat label="Rata-rata 20 hari"><span className="font-semibold tabular-nums text-(--sv-text)">{fmtIdrValue(liquidity.avgValue20D)}</span></Stat>
            <Stat label="RVOL"><span className="font-semibold tabular-nums text-(--sv-text)">{liquidity.rvol != null ? `${fmtNum(liquidity.rvol, 2)}x` : '—'}</span></Stat>
            <Stat label="1 tick (spread)"><span className="tabular-nums text-(--sv-text)">{liquidity.tickPct != null ? `${fmtNum(liquidity.tickPct, 2)}%` : '—'}</span></Stat>
            <Stat label="Maks posisi (1% transaksi harian)"><span className="tabular-nums text-(--sv-text)">{fmtIdrValue(liquidity.maxPositionValue)}</span></Stat>
          </div>
          <p className="text-xs text-(--sv-muted)">{liquidity.note}</p>
        </Section>

        <Section title="🛡️ Risiko" verdict={<Badge tone={risk.gate === 'PASS' ? 'positive' : 'negative'}>Risk Gate {risk.gate}</Badge>}>
          {risk.flags.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {risk.flags.map((f) => (
                <li key={f.label} className={f.severity === 'block' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}>
                  {f.severity === 'block' ? '⛔' : '⚠️'} {f.label}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-(--sv-muted)">🟢 Tidak ada tanda risiko yang menonjol.</p>}
          <div className="grid gap-2 lg:grid-cols-3">
            <RiskCard title="Fundamental Risk" item={ev.risk.fundamental} />
            <RiskCard title="Market Risk" item={ev.risk.market} />
            <RiskCard title="Execution Risk" item={ev.risk.execution} />
          </div>
          <p className="text-xs text-(--sv-muted)">Risiko yang ditampilkan ke user = terburuk dari Risk Gate, Market/Execution risk, dan risiko momentum. Fundamental bagus tidak menurunkan risiko trading.</p>
        </Section>

        <Section title="⚡ Hot Money & Pendorong" verdict={<span className="flex gap-1.5"><LevelBadge level={hotMoney.strength}>Kekuatan {hotMoney.strength}</LevelBadge><LevelBadge level={hotMoney.risk}>Risiko {hotMoney.risk}</LevelBadge></span>}>
          <p className="text-sm text-(--sv-text)">{SIGNAL_EMOJI[ev.driver.signal]} {ev.driver.label}</p>
          {ev.driver.reasons.length > 0 && <p className="text-xs text-(--sv-muted)">{ev.driver.reasons.join(' · ')}</p>}
          {hotMoney.flags.length > 0 ? <Bullets items={hotMoney.flags} className="text-(--sv-muted)" /> : <p className="text-sm text-(--sv-muted)">🟢 Tidak ada tanda hot money yang menonjol.</p>}
          <p className="text-xs text-(--sv-muted)">Hot money bukan berarti momentum buruk — yang dinilai adalah risikonya.</p>
        </Section>

        <Section title="🧭 Rule per Horizon">
          <div className="grid gap-2 lg:grid-cols-3">
            {[decisions.trading, decisions.swing, decisions.investing].map((d) => (
              <div key={d.horizon} className="space-y-2 rounded-lg bg-(--sv-surface) p-3">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-(--sv-text)">{d.label}</span>
                  <DecisionBadge status={d.status} />
                </div>
                <RuleList rules={d.rules} className="text-xs sm:grid-cols-1" />
              </div>
            ))}
          </div>
          <p className="text-xs text-(--sv-muted)">BUY = semua rule terpenuhi · WAIT = menarik, tetapi entry belum terkonfirmasi · AVOID = mandatory gate gagal / mengejar harga.</p>
        </Section>

        <Section title="🏢 Fundamental & Valuasi (konteks)" verdict={<Badge tone={SIGNAL_TONE[ev.valuationSignal]}>{ev.valuationLabel}</Badge>}>
          <p className="text-sm text-(--sv-text)">{ev.businessVerdict}</p>
          <CheckList checks={ev.valuationChecks} />
          {ev.valuationWarnings.length > 0 && <Bullets items={ev.valuationWarnings} className="text-xs text-(--sv-muted)" />}
          <p className="text-xs text-(--sv-muted)">Valuasi murah tidak pernah menyelamatkan setup trading yang buruk.</p>
        </Section>

        {plan && (
          <Section title="📐 Ukuran Posisi (berbasis risiko)" verdict={<Badge tone="info">Risiko {fmtNum(plan.sizing.riskPerTradePct, 2)}% modal</Badge>}>
            <p className="text-xs text-(--sv-muted)">Lot = (Modal × Risiko%) ÷ (Entry − SL) — {plan.sizing.reason}.</p>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {plan.sizing.rows.map((row) => (
                <Stat key={row.capital} label={`Modal ${fmtIdrValue(row.capital)}`}>
                  <span className="text-right tabular-nums text-(--sv-text)">
                    rugi maks {fmtIdrValue(row.maxLoss)} → <strong>{row.lots != null ? `${fmtNum(row.lots)} lot` : '—'}</strong>
                  </span>
                </Stat>
              ))}
            </div>
          </Section>
        )}

        <details className="rounded-lg bg-(--sv-surface) px-3 py-2 text-xs text-(--sv-muted)">
          <summary className="cursor-pointer font-semibold">
            Validasi konsistensi · {report.consistency.every((c) => c.passed) ? '✅ semua lolos' : `❌ ${report.consistency.filter((c) => !c.passed).length} gagal`}
          </summary>
          <ul className="mt-2 space-y-0.5">
            {report.consistency.map((c) => <li key={c.label}>{c.passed ? '✅' : '❌'} {c.label}</li>)}
          </ul>
        </details>
      </div>
    </details>
  );
}
