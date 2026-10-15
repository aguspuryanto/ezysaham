'use client';

import { AlertCircle, ArrowUpRight, CheckCircle2, CircleHelp, Download, Loader2, X, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { SmartMoneyResult, SMART_MONEY_CONFIG } from '@/domain/analysis/smartMoneyHunter';
import { cn } from '@/lib/format';
import { Badge, TONE_TEXT } from '../../screener/detail/components/ui';
import { fmtNum, fmtPct, toneOf } from '../../screener/detail/format';
import { fmtDateLong } from '../../signal/signalUi';
import { FlowState } from '../useSmartMoney';
import { fmtRatio, GATE_TONE, STATUS_TONE, statusLabel } from '../smartMoneyUi';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`sm-${id}`} className="border-t border-(--sv-border) pt-4">
      <h3 id={`sm-${id}`} className="text-[11px] font-semibold uppercase tracking-wide text-(--sv-muted)">{id}. {title}</h3>
      <div className="mt-2 text-sm text-(--sv-text)">{children}</div>
    </section>
  );
}

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-(--sv-muted)">{label}</span>
      <span className={cn('text-right tabular-nums', tone)}>{value}</span>
    </div>
  );
}

const GATE_ICON = { PASS: CheckCircle2, FAIL: XCircle, UNKNOWN: CircleHelp } as const;

export function SmartMoneyDetail({ result, flow, onFetchFlows, onClose }: {
  result: SmartMoneyResult | null;
  flow: FlowState | undefined;
  onFetchFlows: (ticker: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!result) return;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [result, onClose]);

  if (!result) return null;
  const m = result.measures;
  const p = result.plan;
  const ind = (key: string) => result.categories.flatMap((c) => c.indicators).find((i) => i.key === key)!;
  const show = (key: string) => {
    const i = ind(key);
    return i.available ? i.display : <span className="text-(--sv-muted)">N/A</span>;
  };
  const flowsKnown = m.flowsAsOf != null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="sm-detail-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-(--sv-surface) shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-(--sv-border) bg-(--sv-surface) px-5 py-4">
          <div className="min-w-0">
            <h2 id="sm-detail-title" className="flex items-center gap-2 text-lg font-bold text-(--sv-text)">
              {m.ticker}
              <Badge tone={STATUS_TONE[result.status]}>{statusLabel(result.status)}</Badge>
            </h2>
            <p className="truncate text-xs text-(--sv-muted)">{m.name} · {m.sector}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-(--sv-border) text-(--sv-text)">
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <Section id="A" title="Identitas & waktu data">
            <Row label="Harga terakhir" value={<>{fmtNum(m.close)} <span className={TONE_TEXT[toneOf(m.change1D)]}>{fmtPct(m.change1D != null ? m.change1D * 100 : null)}</span></>} />
            <Row label="Bar harga (Yahoo, EOD)" value={m.priceDate ? fmtDateLong(m.priceDate) : 'N/A'} />
            <Row label="Foreign & broker (Index Alpha)" value={m.flowsAsOf ? `s/d ${fmtDateLong(m.flowsAsOf)}` : 'Belum diambil'} />
            <Row label="Fundamental (Yahoo)" value={m.fundamentalsFetchedAt ? new Date(m.fundamentalsFetchedAt).toLocaleString('id-ID') : 'N/A'} />
          </Section>

          <Section id="B" title="Smart Money Score">
            <div className="flex items-end gap-3">
              <span className="text-3xl font-bold tabular-nums">{result.score}</span>
              <span className="pb-1 text-sm text-(--sv-muted)">/ 100 · coverage {result.coverage}% · confidence {result.confidence}</span>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2 text-center text-xs">
              {result.categories.map((c) => (
                <div key={c.key} className="rounded-lg bg-(--sv-bg) px-1 py-2">
                  <div className="font-semibold tabular-nums">{c.knownMax ? `${c.earned}/${c.knownMax}` : 'N/A'}</div>
                  <div className="text-(--sv-muted)">{c.label.split(' ')[0]}</div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-(--sv-muted)">Skor = poin ÷ poin maksimum indikator yang datanya tersedia × 100. Bukan probabilitas keuntungan.</p>
          </Section>

          {!flowsKnown && (
            <div className="rounded-xl border border-(--sv-border) bg-(--sv-bg) p-3 text-sm">
              <p className="text-(--sv-text)">Foreign flow & broker summary belum diambil, jadi skor hanya memakai {result.coverage}% indikator.</p>
              <p className="mt-1 text-xs text-(--sv-muted)">Memakai 4 permintaan Index Alpha (paket Free: maks 5 per hari, reset 00.00 WIB). Gratis bila saham ini sudah diambil untuk tanggal data yang sama.</p>
              {flow?.status === 'error' && <p className="mt-2 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400"><AlertCircle className="size-3.5" />{flow.message}</p>}
              <button
                type="button"
                disabled={flow?.status === 'loading'}
                onClick={() => onFetchFlows(m.ticker)}
                className="mt-2 inline-flex h-9 items-center gap-2 rounded-lg bg-(--sv-primary) px-3 text-sm font-medium text-(--sv-primary-fg) disabled:opacity-60"
              >
                {flow?.status === 'loading' ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                Ambil data foreign & broker
              </button>
            </div>
          )}

          {flow?.status === 'done' && flow.note && (
            <p className="flex items-start gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-400/5 dark:text-amber-200">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />{flow.note}
            </p>
          )}

          <Section id="C" title="Foreign Flow">
            <Row label="Net buy asing 5 hari" value={show('foreignIntensity')} />
            <Row label="Konsistensi 5 hari" value={show('foreignDays')} />
            <Row label="Tren 20 hari" value={show('foreign20')} />
          </Section>

          <Section id="D" title="Broker Flow">
            <Row label="Broker net buy terbesar" value={show('brokerConcentration')} />
            <Row label="Net buy top-3 ÷ net sell top-3" value={show('brokerImbalance')} />
            <Row label="Konsistensi 5 & 20 hari" value={show('brokerConsistency')} />
            <p className="mt-1 text-xs text-(--sv-muted)">Kode broker mewakili banyak nasabah. Net buy satu broker bukan bukti pembelian oleh satu bandar atau satu investor.</p>
          </Section>

          <Section id="E" title="Market Activity">
            <Row label="Volume relatif (RVOL 5/20)" value={show('rvol')} />
            <Row label="Jumlah transaksi relatif" value={show('relTx')} />
            <Row label="Nilai transaksi relatif" value={show('relValue')} />
            <Row label="Nilai rata-rata 20 sesi" value={show('adtv')} />
          </Section>

          <Section id="F" title="Momentum">
            <Row label="Penutupan menguat" value={show('upCloses')} />
            <Row label="Close di atas MA20" value={show('aboveMa20')} />
            <Row label="MA60" value={show('ma60')} />
            <Row label="EMA8 / EMA18" value={m.ema8 != null && m.ema18 != null ? `${fmtNum(m.ema8)} / ${fmtNum(m.ema18)}` : 'N/A'} />
            <Row label="EMA200" value={show('ema200')} />
            <Row label="Jarak ke high 52 minggu" value={show('high52')} />
            <Row label="Support (low 20 sesi) / Resistance (high 60 sesi)" value={`${fmtNum(m.low20)} / ${fmtNum(m.high60)}`} />
          </Section>

          <Section id="G" title="Fundamental">
            <Row label="Laba bersih" value={show('profit')} />
            <Row label="DER" value={show('der')} />
            <Row label="PBV" value={show('pbv')} />
            <Row label="Dividen 2 tahun" value={show('dividend')} />
            <Row label="Status bursa" value={<span className="text-(--sv-muted)">N/A — cek idx.co.id</span>} />
          </Section>

          <Section id="H" title="Risk Gate">
            <ul className="flex flex-col gap-2">
              {result.gates.map((g) => {
                const Icon = GATE_ICON[g.result];
                return (
                  <li key={g.key} className="flex items-start gap-2">
                    <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_TEXT[GATE_TONE[g.result]])} />
                    <div>
                      <span className="font-medium">{g.label}</span> <span className={cn('text-xs font-semibold', TONE_TEXT[GATE_TONE[g.result]])}>{g.result}</span>
                      <p className="text-xs text-(--sv-muted)">{g.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section id="I" title="Keputusan">
            <Badge tone={STATUS_TONE[result.status]}>{statusLabel(result.status)}</Badge>
            <p className="mt-1.5">{result.statusReason}</p>
          </Section>

          <Section id="J" title="Trading plan">
            {p ? (
              <>
                <p className="mb-1 text-xs text-(--sv-muted)">{p.triggerNote}</p>
                <Row label="Entry / trigger" value={fmtNum(p.entry)} />
                <Row label="Stop-loss" value={`${fmtNum(p.stop)} (−${fmtNum(p.riskPct * 100, 1)}%)`} tone={TONE_TEXT.negative} />
                <Row label={`Target (${p.targetBasis})`} value={`${fmtNum(p.target)} (+${fmtNum(p.returnPct * 100, 1)}%)`} tone={TONE_TEXT.positive} />
                <Row label="Risk/reward" value={fmtRatio(p.rr, 1)} tone={p.rr >= SMART_MONEY_CONFIG.minRR ? TONE_TEXT.positive : TONE_TEXT.warning} />
                <Row label="Invalidasi" value={p.invalidation} />
                <p className="mt-1 text-xs text-(--sv-muted)">Stop = max(low 10 sesi, close − 2×ATR14). Level dibulatkan ke fraksi harga BEI.</p>
              </>
            ) : (
              <p className="text-(--sv-muted)">Data tidak cukup untuk menghitung level. Tidak ada level yang dikarang.</p>
            )}
          </Section>

          <Section id="K" title="Kesimpulan">
            <p><b>Alasan utama:</b> {result.conclusion.reason}</p>
            <p className="mt-1"><b>Risiko utama:</b> {result.conclusion.risk}</p>
            <p className="mt-1"><b>Perlu dikonfirmasi:</b> {result.conclusion.confirm}</p>
          </Section>

          <details className="border-t border-(--sv-border) pt-4 text-xs text-(--sv-muted)">
            <summary className="cursor-pointer font-semibold text-(--sv-text)">Rumus skor & sumber data</summary>
            <table className="mt-2 w-full">
              <tbody className="divide-y divide-(--sv-border)">
                {result.categories.flatMap((c) => c.indicators.map((i) => (
                  <tr key={i.key}>
                    <td className="py-1.5 pr-2 align-top"><span className="font-medium text-(--sv-text)">{i.label}</span><br />{i.formula} · {i.period} · {i.source}</td>
                    <td className="py-1.5 text-right align-top tabular-nums">{i.available ? `${i.points}/${i.max}` : `N/A/${i.max}`}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </details>

          {result.positives.length + result.negatives.length > 0 && (
            <div className="grid gap-3 border-t border-(--sv-border) pt-4 text-xs sm:grid-cols-2">
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Alasan positif</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-(--sv-text)">{result.positives.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-rose-700 dark:text-rose-400">Alasan negatif</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-(--sv-text)">{result.negatives.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            </div>
          )}

          <Link href={`/screener/${m.ticker}`} className="inline-flex items-center gap-1 text-sm font-medium text-(--sv-primary) hover:underline">
            Buka analisa lengkap {m.ticker} <ArrowUpRight className="size-3.5" />
          </Link>
          <p className="text-xs text-(--sv-muted)">Alat screening probabilistik dari data EOD. Bukan bukti aktivitas bandar dan bukan jaminan keuntungan.</p>
        </div>
      </div>
    </div>
  );
}
