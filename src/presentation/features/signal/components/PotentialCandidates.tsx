'use client';

/**
 * PotentialCandidates.tsx
 *
 * UI for the POTENTIAL X% CANDIDATE scans (10/20/25/30) inside SARA AI Signals: status
 * badges, summary strip, candidate card, table and detail drawer. Every value
 * comes from `evaluatePotential` on real EOD bars.
 */

import { ArrowUpRight, Check, ChevronRight, Flame, Lightbulb, ShieldAlert, TriangleAlert, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useEffect } from 'react';
import { MarketRegime } from '@/domain/analysis/marketRegimeEngine';
import { POT_FACTOR_LABEL, PotAction, PotClass, PotTone, PotentialResult } from '@/domain/analysis/potentialUpside';
import { cn } from '@/lib/format';
import { Badge, Card, TONE_TEXT } from '../../screener/detail/components/ui';
import { fmtNum, fmtPct, Tone, toneOf } from '../../screener/detail/format';
import { fmtDateLong, fmtRR, SCORE_BAR } from '../signalUi';
import { PotentialCandidate, PotentialScan } from '../usePotential';

export const POT_CLASS_META: Record<PotClass, { label: string; tone: Tone }> = {
  POTENTIAL: { label: '🔥 POTENTIAL', tone: 'positive' },
  MOMENTUM_CANDIDATE: { label: '🟢 MOMENTUM CANDIDATE', tone: 'info' },
  WATCHLIST: { label: '🟡 WATCHLIST', tone: 'warning' },
  SKIP: { label: 'SKIP', tone: 'neutral' },
};

export const POT_ACTION_META: Record<PotAction, { label: string; tone: Tone }> = {
  BUY_CANDIDATE: { label: 'BUY CANDIDATE', tone: 'positive' },
  WAIT: { label: 'WAIT FOR BREAKOUT', tone: 'warning' },
  NO_TRADE: { label: 'NO TRADE', tone: 'neutral' },
};

const CHECK_TONE: Record<PotTone, { dot: string; text: string }> = {
  good: { dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' },
  fair: { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400' },
  bad: { dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-400' },
};

const MARKET_LABEL: Record<MarketRegime, string> = { bullish: 'IHSG Bullish', neutral: 'IHSG Netral', bearish: 'IHSG Bearish' };
const SECTION_TITLE = 'text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';

function potScoreTone(score: number): Tone {
  return score >= 80 ? 'positive' : score >= 60 ? 'warning' : 'negative';
}

export function PotClassBadge({ value, target, className }: { value: PotClass; target: number; className?: string }) {
  const m = POT_CLASS_META[value];
  return <Badge tone={m.tone} className={cn('whitespace-nowrap', className)}>{value === 'POTENTIAL' ? `${m.label} ${target}%` : m.label}</Badge>;
}

export function PotActionBadge({ value, className }: { value: PotAction; className?: string }) {
  const m = POT_ACTION_META[value];
  return <Badge tone={m.tone} className={cn('whitespace-nowrap tracking-wide', className)}>{m.label}</Badge>;
}

function PotScore({ score, size = 'md' }: { score: number; size?: 'md' | 'lg' }) {
  const tone = potScoreTone(score);
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1">
        <span className={cn('font-bold tabular-nums', TONE_TEXT[tone], size === 'lg' ? 'text-3xl' : 'text-xl')}>{score}</span>
        <span className="text-xs text-(--sv-muted)">/100</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={cn('h-full rounded-full', SCORE_BAR[tone])} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function CheckRow({ label, value, tone }: { label: string; value: string; tone: PotTone }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="text-(--sv-muted)">{label}</span>
      <span className={cn('inline-flex items-center gap-1.5 font-semibold', CHECK_TONE[tone].text)}>
        <span className={cn('inline-block size-2 rounded-full', CHECK_TONE[tone].dot)} aria-hidden="true" />
        {value}
      </span>
    </li>
  );
}

function BulletList({ items, icon: Icon, iconClass }: { items: string[]; icon: typeof Check; iconClass: string }) {
  if (items.length === 0) return <p className="text-sm text-(--sv-muted)">—</p>;
  return (
    <ul className="space-y-1">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-1.5 text-sm text-(--sv-text)">
          <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} strokeWidth={2.25} />
          {t}
        </li>
      ))}
    </ul>
  );
}

function Levels({ r }: { r: PotentialResult }) {
  const cell = 'min-w-0 rounded-lg bg-(--sv-bg) px-2.5 py-2';
  const lab = 'text-[11px] font-medium uppercase tracking-wide text-(--sv-muted)';
  const val = 'mt-0.5 truncate text-sm font-semibold tabular-nums';
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <div className={cell}><div className={lab}>Entry Zone</div><div className={cn(val, 'text-(--sv-primary)')}>{fmtNum(r.entryLow)}–{fmtNum(r.entryHigh)}</div></div>
      <div className={cell}><div className={lab}>Breakout</div><div className={cn(val, 'text-(--sv-text)')}>{fmtNum(r.resistance)}</div></div>
      <div className={cell}><div className={lab}>Stop Loss</div><div className={cn(val, 'text-rose-600 dark:text-rose-400')}>{fmtNum(r.stopLoss)} <span className="text-xs font-normal text-(--sv-muted)">(-{r.riskPct.toFixed(1)}%)</span></div></div>
      {[0, 1, 2].map((i) => (
        <div key={i} className={cell}>
          <div className={lab}>TP{i + 1}</div>
          <div className={cn(val, 'text-emerald-600 dark:text-emerald-400')}>
            {r.targets[i] ? <>{fmtNum(r.targets[i].price)} <span className="text-xs font-normal text-(--sv-muted)">+{r.targets[i].upsidePct.toFixed(0)}%</span></> : '—'}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Summary strip ───────────────────────────────────────────────────────────
export function PotentialSummary({ scan, target, shown }: { scan: PotentialScan; target: number; shown: number }) {
  const count = (c: PotClass) => scan.candidates.filter((x) => x.result.classification === c).length;
  const buy = scan.candidates.filter((x) => x.result.action === 'BUY_CANDIDATE').length;
  const tiles: Array<{ label: string; value: number; tone: Tone }> = [
    { label: `🔥 Potential ${target}%`, value: count('POTENTIAL'), tone: 'positive' },
    { label: '🟢 Momentum', value: count('MOMENTUM_CANDIDATE'), tone: 'info' },
    { label: '🟡 Watchlist', value: count('WATCHLIST'), tone: 'warning' },
    { label: 'Buy Candidate', value: buy, tone: 'positive' },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Card as="div" key={t.label} className="p-4">
            <div className="text-xs font-medium text-(--sv-muted)">{t.label}</div>
            <div className={cn('mt-1 text-2xl font-bold tabular-nums', t.value > 0 ? TONE_TEXT[t.tone] : 'text-(--sv-text)')}>{t.value}</div>
          </Card>
        ))}
      </div>
      <p className="text-xs text-(--sv-muted)">
        {scan.scanned} saham Rp50–999 dipindai · {scan.candidates.length} lolos filter utama · {shown} tampil
        {scan.market && <> · {MARKET_LABEL[scan.market]}</>}
        {scan.dataDate && <> · data EOD {fmtDateLong(scan.dataDate)}</>}
      </p>
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────
export function PotentialCard({ candidate, onSelect }: { candidate: PotentialCandidate; onSelect: (c: PotentialCandidate) => void }) {
  const r = candidate.result;
  return (
    <article
      className="group flex cursor-pointer flex-col gap-4 rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow) transition-colors hover:border-(--sv-primary)/40"
      onClick={() => onSelect(candidate)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <PotClassBadge value={r.classification} target={r.targetPct} />
          <div className="mt-1.5 text-lg font-bold text-(--sv-text)">{candidate.ticker}</div>
          <p className="truncate text-xs text-(--sv-muted)">{candidate.companyName}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg font-bold tabular-nums text-(--sv-text)">Rp{fmtNum(r.price)}</div>
          <div className={cn('text-xs font-semibold tabular-nums', TONE_TEXT[toneOf(r.changePct)])}>{fmtPct(r.changePct)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><div className={SECTION_TITLE}>Score</div><div className="mt-1"><PotScore score={r.score} /></div></div>
        <div>
          <div className={SECTION_TITLE}>Potential</div>
          <div className={cn('mt-1 text-xl font-bold tabular-nums', r.potentialUpsidePct >= r.targetPct ? 'text-emerald-600 dark:text-emerald-400' : 'text-(--sv-text)')}>+{r.potentialUpsidePct.toFixed(0)}%</div>
          <div className="text-xs text-(--sv-muted)">Breakout {fmtNum(r.resistance)}</div>
        </div>
      </div>

      <ul className="space-y-1.5 rounded-lg bg-(--sv-bg) p-3">
        {r.checks.slice(0, 6).map((c) => <CheckRow key={c.label} {...c} />)}
      </ul>

      <div className="rounded-lg border border-(--sv-border) px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={SECTION_TITLE}>Status</span>
          <PotActionBadge value={r.action} />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-sm text-(--sv-text)">
          <Zap className="mt-0.5 size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
          <span><span className="text-(--sv-muted)">Trigger:</span> <span className="font-medium">{r.trigger}</span></span>
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" strokeWidth={2} />{r.fomoWarning}
        </p>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onSelect(candidate); }}
        className="mt-auto inline-flex items-center justify-center gap-1 rounded-lg border border-(--sv-border) py-2 text-sm font-medium text-(--sv-primary) group-hover:bg-(--sv-primary-soft)"
      >
        Lihat trade plan <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </article>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────
const TH = 'whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)';
const TD = 'whitespace-nowrap px-3 py-3 tabular-nums';

export function PotentialTable({ candidates, onSelect }: { candidates: PotentialCandidate[]; onSelect: (c: PotentialCandidate) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow)">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-(--sv-border) bg-(--sv-bg)">
            <tr>
              <th className={TH}>Ticker</th>
              <th className={cn(TH, 'text-right')}>Harga</th>
              <th className={TH}>Score</th>
              <th className={TH}>Status</th>
              <th className={cn(TH, 'text-right')}>RVOL</th>
              <th className={cn(TH, 'text-right')}>EMA8 / EMA18</th>
              <th className={cn(TH, 'text-right')}>Resistance</th>
              <th className={cn(TH, 'text-right')}>Breakout Dist.</th>
              <th className={cn(TH, 'text-right')}>Target 1 / 2 / 3</th>
              <th className={cn(TH, 'text-right')}>Potential</th>
              <th className={TH}>Risk</th>
              <th className={TH}>Trigger</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-(--sv-border)">
            {candidates.map((c) => {
              const r = c.result;
              return (
                <tr
                  key={c.ticker}
                  tabIndex={0}
                  onClick={() => onSelect(c)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(c); } }}
                  className="cursor-pointer align-top outline-none hover:bg-(--sv-bg) focus-visible:bg-(--sv-primary-soft)"
                >
                  <td className="px-3 py-3">
                    <div className="font-semibold text-(--sv-text)">{c.ticker}</div>
                    <div className="max-w-40 truncate text-xs text-(--sv-muted)">{c.companyName}</div>
                  </td>
                  <td className={cn(TD, 'text-right')}>
                    <div className="font-semibold text-(--sv-text)">{fmtNum(r.price)}</div>
                    <div className={cn('text-xs', TONE_TEXT[toneOf(r.changePct)])}>{fmtPct(r.changePct)}</div>
                  </td>
                  <td className={TD}>
                    <div className={cn('font-semibold', TONE_TEXT[potScoreTone(r.score)])}>{r.score}</div>
                    <PotClassBadge value={r.classification} target={r.targetPct} className="mt-1 text-[10px]" />
                  </td>
                  <td className={TD}><PotActionBadge value={r.action} /></td>
                  <td className={cn(TD, 'text-right font-semibold', r.rvol >= 1.5 ? 'text-emerald-600 dark:text-emerald-400' : 'text-(--sv-muted)')}>{r.rvol.toFixed(1)}x</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtNum(r.ema8)} / {fmtNum(r.ema18)}</td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{fmtNum(r.resistance)}</td>
                  <td className={cn(TD, 'text-right', r.breakoutDistancePct <= 0 ? 'text-emerald-600 dark:text-emerald-400' : r.breakoutDistancePct <= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-(--sv-muted)')}>
                    {r.breakoutDistancePct <= 0 ? `Tembus (+${Math.abs(r.breakoutDistancePct).toFixed(1)}%)` : `${r.breakoutDistancePct.toFixed(1)}%`}
                  </td>
                  <td className={cn(TD, 'text-right text-(--sv-text)')}>{r.targets.length ? r.targets.map((t) => fmtNum(t.price)).join(' / ') : '—'}</td>
                  <td className={cn(TD, 'text-right font-semibold', r.potentialUpsidePct >= r.targetPct ? 'text-emerald-600 dark:text-emerald-400' : 'text-(--sv-text)')}>+{r.potentialUpsidePct.toFixed(0)}%</td>
                  <td className="max-w-56 px-3 py-3 text-xs text-(--sv-muted)"><span className="line-clamp-2">{r.headlineRisk}</span></td>
                  <td className="max-w-56 px-3 py-3 text-xs text-(--sv-text)"><span className="line-clamp-2">{r.trigger}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Drawer ──────────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-(--sv-border) px-5 py-4">
      <h3 className={cn(SECTION_TITLE, 'mb-2.5')}>{title}</h3>
      {children}
    </section>
  );
}

export function PotentialDrawer({ candidate, onClose }: { candidate: PotentialCandidate | null; onClose: () => void }) {
  const open = candidate != null;

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  const r = candidate?.result;
  return (
    <>
      <div className={cn('fixed inset-0 z-50 bg-slate-900/40 transition-opacity', open ? 'opacity-100' : 'pointer-events-none opacity-0')} onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={candidate ? `Potential ${candidate.result.targetPct}% ${candidate.ticker}` : 'Potential'}
        className={cn('fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-(--sv-surface) shadow-xl transition-transform duration-300 ease-out', open ? 'translate-x-0' : 'translate-x-full')}
      >
        {candidate && r && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 py-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-(--sv-muted)"><Flame className="size-3.5 text-orange-500" />Potential {r.targetPct}% · EOD {fmtDateLong(r.date)}</span>
              <button type="button" onClick={onClose} aria-label="Tutup detail" className="flex size-8 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text) hover:bg-(--sv-bg)">
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
              <div className="space-y-4 px-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <PotClassBadge value={r.classification} target={r.targetPct} />
                    <div className="mt-1.5 text-xl font-bold text-(--sv-text)">{candidate.ticker}</div>
                    <p className="truncate text-xs text-(--sv-muted)">{candidate.companyName} · {candidate.sector}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-xl font-bold tabular-nums text-(--sv-text)">Rp{fmtNum(r.price)}</div>
                    <div className={cn('text-xs font-semibold tabular-nums', TONE_TEXT[toneOf(r.changePct)])}>{fmtPct(r.changePct)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-xl bg-(--sv-bg) p-3">
                  <div><div className={SECTION_TITLE}>Score</div><div className="mt-1"><PotScore score={r.score} size="lg" /></div></div>
                  <div>
                    <div className={SECTION_TITLE}>Potential Upside</div>
                    <div className={cn('mt-1 text-3xl font-bold tabular-nums', r.potentialUpsidePct >= r.targetPct ? 'text-emerald-600 dark:text-emerald-400' : 'text-(--sv-text)')}>+{r.potentialUpsidePct.toFixed(0)}%</div>
                    <div className="text-xs text-(--sv-muted)">{r.phase} · {r.base}</div>
                  </div>
                </div>

                <div className={cn('rounded-lg border px-3 py-2.5', r.action === 'BUY_CANDIDATE' ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-400/25 dark:bg-emerald-400/5' : 'border-(--sv-border) bg-(--sv-bg)')}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={SECTION_TITLE}>Status</span>
                    <PotActionBadge value={r.action} />
                  </div>
                  <p className="mt-1.5 text-sm text-(--sv-muted)">{r.actionReason}</p>
                  <p className="mt-2 flex items-start gap-1.5 text-sm text-(--sv-text)">
                    <Zap className="mt-0.5 size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
                    <span><span className="text-(--sv-muted)">Breakout trigger:</span> <span className="font-medium">{r.trigger}</span></span>
                  </p>
                </div>
              </div>

              <Section title="Checklist">
                <ul className="space-y-1.5">{r.checks.map((c) => <CheckRow key={c.label} {...c} />)}</ul>
              </Section>

              <Section title="Trade Plan">
                <Levels r={r} />
                <p className="mt-2 text-xs text-(--sv-muted)">
                  R:R ke TP1 <b className="text-(--sv-text)">{r.riskReward > 0 ? fmtRR(r.riskReward) : '—'}</b> · holding 1–5 hari
                  {r.targets.length > 0 && <> · target: {r.targets.map((t) => t.source).join(', ')}</>}
                </p>
              </Section>

              {r.action !== 'NO_TRADE' && (
                <Section title="BUY hanya jika">
                  <BulletList items={r.buyOnlyIf} icon={Check} iconClass="text-emerald-600 dark:text-emerald-400" />
                </Section>
              )}

              <Section title="FOMO Warning">
                <p className="flex items-start gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 dark:bg-rose-400/10 dark:text-rose-300">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} />{r.fomoWarning}
                </p>
              </Section>

              <Section title="Why Potential">
                {r.whyPotential.length > 0 ? (
                  <div className="flex gap-2.5 rounded-lg bg-(--sv-primary-soft) p-3">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-(--sv-primary)" strokeWidth={2} />
                    <BulletList items={r.whyPotential} icon={Check} iconClass="text-(--sv-primary)" />
                  </div>
                ) : <p className="text-sm text-(--sv-muted)">—</p>}
              </Section>

              <Section title="Risk Gate">
                <BulletList items={r.riskGate} icon={TriangleAlert} iconClass="text-amber-500" />
              </Section>

              <Section title="Score Breakdown">
                <ul className="space-y-3">
                  {r.factors.map((f) => {
                    const ratio = (f.points / f.max) * 100;
                    return (
                      <li key={f.key}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <span className="font-medium text-(--sv-text)">{POT_FACTOR_LABEL[f.key]}</span>
                          <span className="font-semibold tabular-nums text-(--sv-text)">{f.points}<span className="text-xs font-normal text-(--sv-muted)">/{f.max}</span></span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                          <div className={cn('h-full rounded-full', SCORE_BAR[potScoreTone(ratio)])} style={{ width: `${ratio}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-(--sv-muted)">{f.note}</p>
                      </li>
                    );
                  })}
                </ul>
              </Section>

              <Section title="Catatan">
                <p className="text-xs leading-relaxed text-(--sv-muted)">
                  &ldquo;Potential {r.targetPct}%&rdquo; berarti ada ruang teknikal ≥{r.targetPct}% ke resistance/target berikutnya — <b>bukan jaminan return {r.targetPct}%</b>.
                  Dihitung dari data EOD untuk swing 1–5 hari. Faktor akumulasi memakai proxy OBV &amp; volume naik/turun karena data foreign flow
                  tidak tersedia. Selalu pasang stop loss.
                </p>
              </Section>
            </div>

            <div className="border-t border-(--sv-border) p-4">
              <Link href={`/screener/${candidate.ticker}`} className="flex items-center justify-center gap-1.5 rounded-lg bg-(--sv-primary) py-2.5 text-sm font-semibold text-(--sv-primary-fg)">
                Analisa lengkap {candidate.ticker} <ArrowUpRight className="size-4" strokeWidth={2} />
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
