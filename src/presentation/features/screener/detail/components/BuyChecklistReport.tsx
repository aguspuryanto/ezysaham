'use client';

/**
 * BuyChecklistReport.tsx
 *
 * "Checklist Kapan Waktu Beli" (docs/features_checklist_buy.md) on the detail page's `.sv-theme`:
 * keputusan & skor → syarat wajib → skenario beli → konfirmasi tambahan → rencana trading
 * (with a capital/risk input for lot sizing) → ringkasan data & data yang perlu dilengkapi → disclaimer.
 * Every verdict comes from domain/analysis/buyChecklist.ts — this file only lays it out.
 */

import { ChevronRight, ListChecks } from 'lucide-react';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import {
  BuyChecklistReport as Report,
  BuyDecision,
  buildBuyChecklist,
  CheckStatus,
  ConfirmStatus,
  ScenarioCriterion,
  ScenarioStatus,
} from '@/domain/analysis/buyChecklist';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { OHLCVBar } from '@/domain/models/History';
import { StockNewsItem } from '@/domain/models/News';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtNum, fmtPct, fmtRp, Tone } from '../format';
import { Bullets, Caption } from './gemini1m/primitives';
import { CopyShareButton } from './TradingModesReport';
import { Badge, Card, PanelTitle, Skeleton, TONE_TEXT } from './ui';

const DECISION_TONE: Record<BuyDecision, Tone> = { 'BELI BERTAHAP': 'positive', WATCHLIST: 'warning', 'JANGAN BELI': 'negative' };
const DECISION_EMOJI: Record<BuyDecision, string> = { 'BELI BERTAHAP': '🟢', WATCHLIST: '🟡', 'JANGAN BELI': '🔴' };
const CHECK_TONE: Record<CheckStatus, Tone> = { LOLOS: 'positive', TIDAK: 'negative', 'TIDAK CUKUP DATA': 'neutral' };
const SCENARIO_TONE: Record<ScenarioStatus, Tone> = { COCOK: 'positive', 'TIDAK COCOK': 'neutral', 'TIDAK CUKUP DATA': 'neutral' };
const CONFIRM_TONE: Record<ConfirmStatus, Tone> = { YA: 'positive', TIDAK: 'negative', 'TIDAK CUKUP DATA': 'neutral' };
const NO_DATA = 'TIDAK CUKUP DATA';
const DISCLAIMER = 'Analisis ini bersifat edukatif dan bukan nasihat investasi. Keputusan investasi sepenuhnya tanggung jawab pengguna.';

const rrText = (rr: number | null) => (rr == null ? 'N/A' : `1:${fmtNum(rr, 2)}`);
const critIcon = (ok: boolean | null) => (ok == null ? '⚪' : ok ? '✅' : '❌');
const zoneText = (lo: number, hi: number) => (lo === hi ? fmtRp(lo) : `${fmtRp(lo)} – ${fmtNum(hi)}`);

function ScoreTile({ label, children, sub, tone = 'neutral' }: { label: string; children: ReactNode; sub?: string; tone?: Tone }) {
  return (
    <div className="rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
      <Caption>{label}</Caption>
      <div className={cn('mt-1 font-semibold tabular-nums', TONE_TEXT[tone])}>{children}</div>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-(--sv-muted)">{sub}</p>}
    </div>
  );
}

/** Collapsed by default; the summary row keeps the verdict visible so it's clear when opening is worth it. */
function Collapsible({ title, verdict, defaultOpen = false, children }: { title: string; verdict?: ReactNode; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-(--sv-border) bg-(--sv-bg)/40">
      <summary className="flex cursor-pointer select-none list-none flex-wrap items-center justify-between gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-semibold text-(--sv-text)">
          <ChevronRight className="size-4 shrink-0 text-(--sv-muted) transition-transform group-open:rotate-90" />
          {title}
        </span>
        {verdict}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

/** Table on ≥ sm, stacked rows on phones — no horizontal page scroll. */
function StatusTable({ head, rows }: { head: string[]; rows: Array<{ key: string; cells: ReactNode[] }> }) {
  return (
    <div className="overflow-hidden rounded-lg border border-(--sv-border)">
      <table className="w-full text-sm">
        <thead className="hidden bg-(--sv-surface) text-left text-[11px] uppercase tracking-wide text-(--sv-muted) sm:table-header-group">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-(--sv-border)/70">
          {rows.map((r) => (
            <tr key={r.key} className="flex flex-col gap-1 px-3 py-2 sm:table-row sm:p-0">
              {r.cells.map((c, i) => (
                <td key={i} className={cn('align-top sm:px-3 sm:py-2', i === 0 && 'font-medium text-(--sv-text)', i > 1 && 'text-xs text-(--sv-muted) sm:text-sm')}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CriteriaList({ criteria }: { criteria: ScenarioCriterion[] }) {
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {criteria.map((c) => (
        <li key={c.label} className={cn('flex items-start gap-2', c.ok !== true && 'text-(--sv-muted)')}>
          <span className="shrink-0">{critIcon(c.ok)}</span>
          <span className="min-w-0">
            <span className={c.ok ? 'text-(--sv-text)' : undefined}>{c.label}</span>
            <span className="block text-[11px] leading-snug">{c.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PositionSizer({ entry, riskPerShare }: { entry: number; riskPerShare: number }) {
  const [capital, setCapital] = useState(1_000_000);
  const [riskPct, setRiskPct] = useState(1);
  const maxRisk = (capital * riskPct) / 100;
  const byRisk = riskPerShare > 0 ? Math.floor(maxRisk / (riskPerShare * 100)) : 0;
  const byCapital = entry > 0 ? Math.floor(capital / (entry * 100)) : 0;
  const lots = Math.max(0, Math.min(byRisk, byCapital));
  const first = Math.ceil(lots / 2);

  return (
    <div className="space-y-2 rounded-lg border border-(--sv-border) bg-(--sv-surface) p-3">
      <Caption>Ukuran posisi</Caption>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] text-(--sv-muted)">Modal (Rp)</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1_000_000}
            value={capital}
            onChange={(e) => setCapital(Math.max(0, Number(e.target.value) || 0))}
            className="h-9 w-40 rounded-lg border border-(--sv-border) bg-(--sv-bg) px-2 tabular-nums text-(--sv-text)"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-(--sv-muted)">Risiko per posisi</span>
          <div className="flex gap-1">
            {[1, 2].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRiskPct(p)}
                aria-pressed={riskPct === p}
                className={cn(
                  'h-9 rounded-lg border px-3 font-medium',
                  riskPct === p ? 'border-(--sv-primary) bg-(--sv-primary) text-(--sv-primary-fg)' : 'border-(--sv-border) text-(--sv-text)',
                )}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className="text-sm text-(--sv-text)">
        Maks. risiko <span className="font-semibold tabular-nums">{fmtRp(maxRisk)}</span> ÷ risiko/lembar {fmtRp(riskPerShare)} →{' '}
        <span className="font-semibold tabular-nums">{fmtNum(lots)} lot</span>
        {lots > 0 && <> ({fmtNum(first)} lot di trigger + {fmtNum(lots - first)} lot setelah konfirmasi)</>}
      </p>
      {byCapital < byRisk && <p className="text-[11px] text-(--sv-muted)">Dibatasi oleh modal, bukan oleh risiko.</p>}
    </div>
  );
}

function buildShareText(ticker: string, r: Report): string {
  const p = r.plan;
  return [
    `✅ Checklist Kapan Waktu Beli — ${ticker}`,
    `Tanggal ${r.asOf} · candle ${r.lastBarDate ?? 'N/A'} · harga ${fmtRp(r.price)}`,
    '',
    `Keputusan: ${DECISION_EMOJI[r.decision]} ${r.decision}`,
    `Syarat wajib: ${r.mandatoryPassed}/${r.mandatory.length} · Skenario: ${r.selected ?? 'tidak ada'} · Konfirmasi: ${r.confirmCount}/5 · R:R ${rrText(r.riskReward)}`,
    '',
    'SYARAT WAJIB:',
    ...r.mandatory.map((m, i) => `${i + 1}. ${m.label}: ${m.status}`),
    '',
    'SKENARIO:',
    ...r.scenarios.map((s) => `${s.id}. ${s.name}: ${s.status}`),
    '',
    'KONFIRMASI:',
    ...r.confirmations.map((c) => `- ${c.label}: ${c.status}`),
    ...(p
      ? ['', `Rencana (${p.source}):`, `Entry ${zoneText(p.entryLow, p.entryHigh)} · SL ${fmtRp(p.sl)} · TP1 ${p.tp1 != null ? fmtRp(p.tp1) : 'N/A'} · TP2 ${p.tp2 != null ? fmtRp(p.tp2) : 'N/A'}`]
      : []),
    '',
    'Alasan:',
    ...r.reasons.map((s) => `- ${s}`),
    '',
    DISCLAIMER,
  ].join('\n');
}

export function BuyChecklistReport({
  summary,
  bars,
  longBars,
  analysis,
  fundamentals,
  news,
  newsLoading,
  ihsgBars,
}: {
  summary: StockSummary;
  bars: OHLCVBar[];
  longBars?: OHLCVBar[];
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  news: StockNewsItem[];
  newsLoading: boolean;
  ihsgBars: OHLCVBar[];
}) {
  const ticker = summary.ticker;
  const [asOf] = useState(() => new Date());
  const r = useMemo(
    () => buildBuyChecklist({ summary, bars, longBars, analysis, fundamentals, news, newsLoading, ihsgBars, asOf }),
    [summary, bars, longBars, analysis, fundamentals, news, newsLoading, ihsgBars, asOf],
  );
  const getShareText = useCallback(() => buildShareText(ticker, r), [ticker, r]);
  const tone = DECISION_TONE[r.decision];
  const p = r.plan;

  return (
    <Card aria-labelledby="buy-checklist-title">
      <PanelTitle icon={ListChecks} id="buy-checklist-title" action={<CopyShareButton getText={getShareText} />}>
        Checklist Kapan Waktu Beli — {ticker}
      </PanelTitle>

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--sv-muted)">
          <span>Timeframe <span className="font-medium text-(--sv-text)">Harian</span></span>
          <span>Candle terakhir <span className="font-medium text-(--sv-text)">{r.lastBarDate ?? 'N/A'}</span></span>
          <span>Analisis <span className="font-medium text-(--sv-text)">{r.asOf}</span></span>
        </div>

        {/* 5. Skor & keputusan */}
        <div
          className={cn(
            'space-y-3 rounded-xl border-2 p-4',
            tone === 'positive' ? 'border-emerald-300/70 dark:border-emerald-400/30'
              : tone === 'negative' ? 'border-rose-300/70 dark:border-rose-400/30'
                : 'border-amber-300/70 dark:border-amber-400/30',
          )}
        >
          <Badge tone={tone} className="px-3 py-1 text-base">{DECISION_EMOJI[r.decision]} {r.decision}</Badge>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ScoreTile label="Syarat wajib" tone={r.mandatoryPassed === r.mandatory.length ? 'positive' : 'negative'} sub="Semua harus lolos">
              {r.mandatoryPassed}/{r.mandatory.length}
            </ScoreTile>
            <ScoreTile label="Skenario" tone={r.selected ? 'positive' : 'neutral'} sub={r.selected ? r.scenarios.find((s) => s.id === r.selected)?.name : 'Belum ada yang cocok'}>
              {r.selected ?? 'Tidak ada'}
            </ScoreTile>
            <ScoreTile label="Konfirmasi" tone={r.confirmCount >= 2 ? 'positive' : 'warning'} sub="Minimal 2">
              {r.confirmCount}/5
            </ScoreTile>
            <ScoreTile label="Risk–reward" tone={r.riskReward == null ? 'neutral' : r.riskReward >= 2 ? 'positive' : 'negative'} sub="Ke TP1, minimal 1:2">
              {rrText(r.riskReward)}
            </ScoreTile>
          </div>
          <Bullets items={r.reasons} className="text-(--sv-text)" />
        </div>

        {/* 6. Rencana trading */}
        <Collapsible
          defaultOpen
          title="Rencana trading"
          verdict={p ? <span className="text-xs text-(--sv-muted)">Entry {zoneText(p.entryLow, p.entryHigh)} · SL {fmtRp(p.sl)}</span> : <Badge tone="neutral">{NO_DATA}</Badge>}
        >
          {p ? (
            <div className="space-y-3">
              {r.decision !== 'BELI BERTAHAP' && (
                <p className="text-xs text-(--sv-muted)">Keputusan belum BELI — level di bawah adalah rencana bersyarat, bukan sinyal entry sekarang.</p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <ScoreTile label="Area entry" sub="50% trigger · 50% konfirmasi">{zoneText(p.entryLow, p.entryHigh)}</ScoreTile>
                <ScoreTile label="Stop loss" tone="negative" sub={p.slBasis}>{fmtRp(p.sl)}</ScoreTile>
                <ScoreTile label="Target 1" tone="positive" sub={p.tp1Basis ?? undefined}>
                  {p.tp1 != null ? <>{fmtRp(p.tp1)} <span className="text-xs font-normal">({fmtPct(((p.tp1 - p.entryHigh) / p.entryHigh) * 100, 1)})</span></> : NO_DATA}
                </ScoreTile>
                <ScoreTile label="Target 2" tone="positive" sub={p.tp2Basis ?? undefined}>
                  {p.tp2 != null ? <>{fmtRp(p.tp2)} <span className="text-xs font-normal">({fmtPct(((p.tp2 - p.entryHigh) / p.entryHigh) * 100, 1)})</span></> : NO_DATA}
                </ScoreTile>
              </div>
              <p className="text-xs text-(--sv-muted)">Risiko {fmtRp(p.riskPerShare)}/lembar ({fmtNum(p.riskPct, 1)}% dari entry atas) · R:R {rrText(p.riskReward)}</p>
              {/* <PositionSizer entry={p.entryHigh} riskPerShare={p.riskPerShare} /> */}
              <div className="space-y-1">
                <Caption>Trigger tambahan yang perlu ditunggu</Caption>
                <Bullets items={p.triggers} className="text-(--sv-text)" />
              </div>
            </div>
          ) : (
            <p className="text-sm text-(--sv-muted)">{NO_DATA} — belum ada level entry & stop loss yang valid. Tunggu struktur harga yang lebih jelas.</p>
          )}
          {p && <p className="mt-2 text-[11px] text-(--sv-muted)">Sumber: {p.source}</p>}
        </Collapsible>

        {/* 2. Syarat wajib */}
        <Collapsible
          title="A. Syarat wajib"
          verdict={<Badge tone={r.mandatoryPassed === r.mandatory.length ? 'positive' : 'negative'}>{r.mandatoryPassed}/{r.mandatory.length} lolos</Badge>}
        >
          <StatusTable
            head={['Syarat', 'Status', 'Bukti / data', 'Catatan']}
            rows={r.mandatory.map((m, i) => ({
              key: m.key,
              cells: [`${i + 1}. ${m.label}`, <Badge key="s" tone={CHECK_TONE[m.status]}>{m.status}</Badge>, m.evidence, m.note || '–'],
            }))}
          />
          <p className="mt-2 text-[11px] text-(--sv-muted)">1 syarat gagal ⇒ keputusan tidak boleh BELI.</p>
        </Collapsible>

        {/* 3. Skenario beli */}
        <Collapsible title="B. Skenario beli" verdict={<Badge tone={r.selected ? 'positive' : 'neutral'}>{r.selected ? `Skenario ${r.selected}` : 'Tidak ada yang cocok'}</Badge>}>
          <div className="grid gap-2 md:grid-cols-3">
            {r.scenarios.map((s) => (
              <div
                key={s.id}
                className={cn('rounded-lg border bg-(--sv-surface) p-3', s.id === r.selected ? 'border-emerald-300 dark:border-emerald-400/40' : 'border-(--sv-border)')}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold text-(--sv-text)">{s.id}. {s.name}</span>
                  <Badge tone={SCENARIO_TONE[s.status]} className="shrink-0">{s.status}</Badge>
                </div>
                <CriteriaList criteria={s.criteria} />
                <p className="mt-2 text-[11px] leading-snug text-(--sv-muted)">{s.note}</p>
              </div>
            ))}
          </div>
        </Collapsible>

        {/* 4. Konfirmasi tambahan */}
        <Collapsible title="C. Konfirmasi tambahan" verdict={<Badge tone={r.confirmCount >= 2 ? 'positive' : 'warning'}>{r.confirmCount}/5 terpenuhi</Badge>}>
          <StatusTable
            head={['Konfirmasi', 'Status', 'Bukti']}
            rows={r.confirmations.map((c) => ({
              key: c.key,
              cells: [c.label, <Badge key="s" tone={CONFIRM_TONE[c.status]}>{c.status}</Badge>, c.evidence],
            }))}
          />
        </Collapsible>

        {/* 1 & 7. Ringkasan data + data yang perlu dilengkapi */}
        {/* <details className="group rounded-xl border border-(--sv-border)">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-(--sv-text)">
            Ringkasan data
            <span className="ml-2 text-xs font-normal text-(--sv-muted)">{r.missing.length} data perlu dilengkapi</span>
          </summary>
          <div className="space-y-3 p-4 pt-0">
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {r.data.map((d) => (
                <div key={d.label} className="flex justify-between gap-3 border-b border-(--sv-border)/50 py-1">
                  <dt className="shrink-0 text-(--sv-muted)">{d.label}</dt>
                  <dd className={cn('min-w-0 text-right tabular-nums', d.value == null ? 'text-xs text-(--sv-muted)' : 'font-medium text-(--sv-text)')}>
                    <span className="line-clamp-2">{d.value ?? NO_DATA}</span>
                    {d.value != null && d.assumption && <span className="text-[11px] font-normal text-(--sv-muted)"> (asumsi)</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="space-y-1">
              <Caption>Data yang perlu dilengkapi</Caption>
              <Bullets items={r.missing} className="text-(--sv-muted)" />
            </div>
          </div>
        </details> */}

        {/* 8. Disclaimer */}
        <p className="text-xs leading-relaxed text-(--sv-muted)">
          Aturan eksekusi: entry bertahap, stop loss ditentukan sebelum beli, risiko per posisi maks. 1–2% modal, tidak menambah posisi
          hanya karena harga turun. Indikator dihitung dari candle harian aplikasi. {DISCLAIMER}
        </p>
      </div>
    </Card>
  );
}

export function BuyChecklistReportSkeleton() {
  return (
    <Card as="div" className="space-y-4 p-4">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-36" />
      <Skeleton className="h-48" />
    </Card>
  );
}
