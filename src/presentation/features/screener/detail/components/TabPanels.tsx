'use client';

/**
 * Content for the non-"Ringkasan" tabs. Every panel only displays outputs the
 * existing pipeline already computes (StockAnalysis, FundamentalDetail,
 * BandarScoreResult, BrokerActivityDetail, news) — no new calculations.
 */

import { CalendarDays, ExternalLink, Newspaper, ScrollText, Users } from 'lucide-react';
import { BandarScoreResult } from '@/domain/analysis/bandarScore';
import { BrokerActivityDetail, BrokerSummaryRow } from '@/domain/models/BrokerSummary';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { StockNewsItem } from '@/domain/models/News';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { cn } from '@/lib/format';
import { fmtCompact, fmtNum, fmtPctPlain, fmtRp, fmtRpCompactSigned, toneOf } from '../format';
import { Badge, Card, EmptyNote, PanelTitle, Skeleton, TONE_TEXT } from './ui';

export function TechnicalDetail({ analysis, price }: { analysis: StockAnalysis; price: number }) {
  const { trendEma, indicators, volume, priceAction, supportResistance } = analysis;
  const rows: Array<[string, string, string?]> = [
    ['EMA 20', fmtRp(trendEma.ema20), price > trendEma.ema20 ? 'Harga di atas' : 'Harga di bawah'],
    ['EMA 50', fmtRp(trendEma.ema50), price > trendEma.ema50 ? 'Harga di atas' : 'Harga di bawah'],
    ['EMA 200', fmtRp(trendEma.ema200), Number.isFinite(trendEma.ema200) ? (price > trendEma.ema200 ? 'Harga di atas' : 'Harga di bawah') : 'Histori belum cukup'],
    ['RSI (14)', fmtNum(indicators.rsi14, 1), indicators.rsiNote],
    ['MACD', `${fmtNum(indicators.macdValue, 1)} / ${fmtNum(indicators.macdSignal, 1)}`, indicators.macdNote],
    ['Stochastic', `${fmtNum(indicators.stochK, 1)} / ${fmtNum(indicators.stochD, 1)}`, indicators.stochNote],
    ['Relative Volume', `${fmtNum(volume.relativeVolume, 2)}x`, `MA20 ${fmtCompact(volume.volumeMa20)}`],
    ['Pola Candle', priceAction.patternLabel, undefined],
  ];
  const notes = [trendEma.trendDescription, ...priceAction.notes, ...volume.notes].filter(Boolean);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <PanelTitle icon={ScrollText}>Indikator</PanelTitle>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-(--sv-border)">
            {rows.map(([k, v, note]) => (
              <tr key={k}>
                <th scope="row" className="px-4 py-2.5 text-left font-medium text-(--sv-muted)">{k}</th>
                <td className="px-4 py-2.5 text-right">
                  <span className="font-semibold tabular-nums text-(--sv-text)">{v}</span>
                  {note && <span className="block text-[11px] text-(--sv-muted)">{note}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <div className="flex flex-col gap-4">
        <Card>
          <PanelTitle icon={ScrollText}>Support &amp; Resistance</PanelTitle>
          <ul className="divide-y divide-(--sv-border) text-sm">
            {[...supportResistance.resistances].reverse().map((l) => (
              <li key={`r-${l.label}`} className="flex justify-between px-4 py-2"><span className={TONE_TEXT.negative}>{l.label} · {l.description}</span><span className="font-semibold tabular-nums">{fmtRp(l.price)}</span></li>
            ))}
            <li className="flex justify-between bg-(--sv-bg) px-4 py-2 font-semibold"><span>Harga saat ini</span><span className="tabular-nums">{fmtRp(price)}</span></li>
            {supportResistance.supports.map((l) => (
              <li key={`s-${l.label}`} className="flex justify-between px-4 py-2"><span className={TONE_TEXT.positive}>{l.label} · {l.description}</span><span className="font-semibold tabular-nums">{fmtRp(l.price)}</span></li>
            ))}
          </ul>
        </Card>
        {notes.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-(--sv-text)">Catatan Teknikal</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-(--sv-muted)">
              {notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

export function FundamentalDetailPanel({ fundamentals, loading, roe, per, pbv }: {
  fundamentals: FundamentalDetail | null;
  loading: boolean;
  roe: number | null;
  per: number | null;
  pbv: number | null;
}) {
  const rows: Array<[string, string]> = [
    ['ROE', fmtPctPlain(roe)],
    ['PER', per != null ? `${fmtNum(per, 1)}x` : '—'],
    ['PBV', pbv != null ? `${fmtNum(pbv, 1)}x` : '—'],
    ['DER', fundamentals?.debtToEquity != null ? `${fmtNum(fundamentals.debtToEquity / 100, 2)}x` : '—'],
    ['Current Ratio', fundamentals?.currentRatio != null ? `${fmtNum(fundamentals.currentRatio, 2)}x` : '—'],
    ['Net Margin', fmtPctPlain(fundamentals?.netMargin)],
    ['Revenue Growth (YoY)', fmtPctPlain(fundamentals?.revenueGrowth)],
    ['Net Profit Growth (YoY)', fmtPctPlain(fundamentals?.earningsGrowth)],
    ['Dividend Yield', fmtPctPlain(fundamentals?.dividendYield, 2)],
    ['Payout Ratio', fmtPctPlain(fundamentals?.dividendPayoutRatio)],
  ];
  return (
    <Card>
      <PanelTitle icon={ScrollText}>Rasio Fundamental</PanelTitle>
      <dl className="grid gap-px bg-(--sv-border) sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between bg-(--sv-surface) px-4 py-3 text-sm">
            <dt className="text-(--sv-muted)">{k}</dt>
            <dd className="font-semibold tabular-nums text-(--sv-text)">{loading && v === '—' ? <Skeleton className="h-4 w-12" /> : v}</dd>
          </div>
        ))}
      </dl>
      <p className="px-4 py-2.5 text-[11px] text-(--sv-muted)">Sumber: ringkasan EOD &amp; Yahoo Finance. &quot;—&quot; berarti data tidak tersedia, bukan nol.</p>
    </Card>
  );
}

function BrokerTable({ title, rows, tone }: { title: string; rows: BrokerSummaryRow[]; tone: 'positive' | 'negative' }) {
  return (
    <div>
      <h3 className={cn('px-4 pt-3 text-xs font-semibold uppercase tracking-wide', TONE_TEXT[tone])}>{title}</h3>
      <ul className="divide-y divide-(--sv-border) text-sm">
        {rows.map((r) => (
          <li key={r.code} className="flex justify-between px-4 py-2">
            <span className="font-semibold">{r.code}</span>
            <span className={cn('tabular-nums', TONE_TEXT[toneOf(r.netValue)])}>{fmtRpCompactSigned(r.netValue)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BandarmologyPanel({ bandar, broker, loading }: { bandar: BandarScoreResult | null; broker: BrokerActivityDetail | null; loading: boolean }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <PanelTitle icon={Users} action={bandar && <Badge tone="info">{bandar.total}/{bandar.max}</Badge>}>Estimasi Bandar (Proxy)</PanelTitle>
        {bandar ? (
          <ul className="divide-y divide-(--sv-border)">
            {bandar.factors.map((f) => (
              <li key={f.key} className="px-4 py-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-(--sv-text)">{f.label}</span>
                  <span className="tabular-nums text-(--sv-muted)">{f.score}/{f.max}</span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-(--sv-primary)" style={{ width: `${(f.score / f.max) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-(--sv-muted)">{f.detail}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>Histori harga belum cukup untuk estimasi.</EmptyNote>
        )}
      </Card>
      <Card>
        <PanelTitle icon={Users}>Broker Summary</PanelTitle>
        {loading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
        ) : broker ? (
          <>
            <p className="px-4 pt-3 text-xs text-(--sv-muted)">Periode {broker.rangeFrom} – {broker.rangeTo}</p>
            <div className="grid sm:grid-cols-2">
              <BrokerTable title="Top Net Buy" rows={broker.topBuyers} tone="positive" />
              <BrokerTable title="Top Net Sell" rows={broker.topSellers} tone="negative" />
            </div>
          </>
        ) : (
          <EmptyNote>Data broker (Index Alpha) belum tersedia.</EmptyNote>
        )}
      </Card>
    </div>
  );
}

export function CorporateActionPanel({ fundamentals, loading }: { fundamentals: FundamentalDetail | null; loading: boolean }) {
  const history = fundamentals?.dividendHistory;
  return (
    <Card>
      <PanelTitle icon={CalendarDays}>Riwayat Dividen</PanelTitle>
      {loading ? (
        <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-5 w-full" />)}</div>
      ) : history == null ? (
        <EmptyNote>Data corporate action belum dapat dimuat.</EmptyNote>
      ) : history.length === 0 ? (
        <EmptyNote>Belum ada riwayat dividen tercatat.</EmptyNote>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-(--sv-muted)">
              <th className="px-4 py-2 text-left font-medium">Ex-Date</th>
              <th className="px-4 py-2 text-right font-medium">Dividen / Saham</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {history.slice(0, 12).map((d) => (
              <tr key={d.date}>
                <td className="px-4 py-2.5">{new Date(d.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{fmtRp(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

const SENTIMENT_TONE = { bullish: 'positive', bearish: 'negative', neutral: 'neutral' } as const;

export function NewsPanel({ items, loading }: { items: StockNewsItem[]; loading: boolean }) {
  return (
    <Card>
      <PanelTitle icon={Newspaper}>Berita Terkait</PanelTitle>
      {loading ? (
        <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : items.length === 0 ? (
        <EmptyNote>Belum ada berita terbaru.</EmptyNote>
      ) : (
        <ul className="divide-y divide-(--sv-border)">
          {items.slice(0, 15).map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="flex gap-3 px-4 py-3 hover:bg-(--sv-bg)">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-(--sv-text)">{n.title}</p>
                  <p className="mt-0.5 text-xs text-(--sv-muted)">{n.publisher} · {n.publishedAt}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={SENTIMENT_TONE[n.sentiment]}>{n.sentiment}</Badge>
                  <ExternalLink className="size-3.5 text-(--sv-muted)" />
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
