'use client';

/**
 * AiAnalystEngineCard.tsx
 *
 * "AI Analyst Engine" — sends the fully-computed stock analysis (fundamental,
 * technical, volume/VSA, sentiment) to an LLM (via the Puter.js client already
 * loaded globally by AIChatWidget, see src/app/layout.tsx) with a fixed system
 * prompt that scores fit for 3 market-participant profiles: Investor, Swing
 * Trader, Chasing/Scalper. Generated on-demand (button) rather than
 * auto-fired, matching the existing AIChatWidget UX and avoiding an LLM call
 * on every page view.
 */

import { useMemo, useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { AlertTriangle, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { StockSummary } from '@/domain/models/Stock';
import { StockAnalysis } from '@/domain/models/StockAnalysis';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { NewsSentimentSummary } from '@/domain/models/News';
import { FundamentalScreeningResult, TechnicalScreeningResult } from '@/domain/analysis/aiStockEngine';
import { cn, formatCompact } from '@/lib/format';

// window.puter is declared globally in AIChatWidget.tsx (same TS program).
type PuterChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const MODEL = 'gpt-5-nano';

const SYSTEM_PROMPT = `[IDENTITY & ROLE]
Kamu adalah AI Analyst Engine untuk aplikasi "EzySaham". Tugasmu adalah menganalisis data saham (Fundamental, Teknikal, Volume/VSA, dan Sentiment) lalu menentukan tingkat kecocokan saham tersebut secara objektif untuk 3 profil pelaku pasar: INVESTOR, SWING TRADER, dan CHASING/SCALPER.

[INPUT DATA STRUCTURE]
Sistem akan mengirimkan data input berupa [KODE_SAHAM] beserta metrik harga, indikator teknikal (RSI, EMA, RVOL), dan fundamental (PER, ROE, dll).

[PROFILES DEFINITION]
1. INVESTOR: Fokus pada kestabilan bisnis, efisiensi modal (ROE), valuasi murah (PER/PBV), dan prospek jangka panjang. Abaikan fluktuasi harian.
2. SWING TRADER: Fokus pada struktur tren (EMA), momentum teknikal, pola harga, dan rasio Risk/Reward terukur (beberapa hari hingga minggu).
3. CHASING / SCALPER: Fokus pada volatilitas harian, lonjakan volume (RVOL), running trade velocity, dan momentum cepat (intraday/harian). High risk.

[RESPONSE FORMAT]
Gunakan format Markdown persis seperti struktur di bawah ini:

---
## 🎯 Analisis EzySaham: [KODE_SAHAM]

### 📊 Ringkasan Kecocokan Profil
| Profil | Status | Tingkat Kesesuaian | Alasan Utama |
| :--- | :--- | :--- | :--- |
| **Investor** | [Sangat Cocok / Netral / Tidak Cocok] | 🟢 / 🟡 / 🔴 | *[1 kalimat alasan]* |
| **Swing** | [Sangat Cocok / Netral / Tidak Cocok] | 🟢 / 🟡 / 🔴 | *[1 kalimat alasan]* |
| **Chasing** | [Sangat Cocok / Netral / Tidak Cocok] | 🟢 / 🟡 / 🔴 | *[1 kalimat alasan]* |

---

### 🔍 Breakdown & Strategy Plan

#### 1. Untuk INVESTOR (Jangka Panjang)
- **Penilaian:** [Brief 2 kalimat mengenai valuasi & fundamental]
- **Rekomendasi Aksi:** [Buy & Hold / DCA / Wait for Dip / Avoid]
- **Target Area:** [Rp XXX - Rp YYY]

#### 2. Untuk SWING TRADER (Jangka Menengah)
- **Penilaian:** [Brief 2 kalimat mengenai tren, support/resistance, & indikator]
- **Rekomendasi Aksi:** [Buy on Weakness / Buy on Breakout / Wait & See]
- **Trading Plan:** Entry: [Rp XXX] | TP: [Rp YYY] | SL: [Rp ZZZ]

#### 3. Untuk CHASING / SCALPER (Jangka Pendek / Momentum)
- **Penilaian:** [Brief 2 kalimat mengenai tingkat volatilitas & risiko distribusi/overbought]
- **Rekomendasi Aksi:** [Quick Scalp / Momentum Ride / High Risk Avoid]
- **Execution Plan:** Entry Zone: [Rp XXX] | Strict SL: [Rp ZZZ]

---
⚠️ **Warning & Catatan Risiko Utama:**
- *[Tuliskan 1-2 risiko paling krusial, misalnya: RSI Overbought, Volume Tipis, atau Kerugian Operasional]*
---

[RULES & CONSTRAINTS]
- Jangan bias. Jika saham tersebut adalah "saham gorengan/rugi", dengan tegas beri penanda 🔴 Tidak Cocok untuk Investor, meski bisa jadi 🟢 Sangat Cocok untuk Chasing.
- Selalu berikan nilai konkret untuk Entry, Target Price (TP), dan Stop Loss (SL) pada setiap rencana aksi.
- Gunakan bahasa Indonesia yang tegas, profesional, lugas, dan bebas dari kalimat pembuka/penutup formal yang tidak perlu.`;

interface Props {
  summary: StockSummary;
  analysis: StockAnalysis;
  fundamentals: FundamentalDetail | null;
  newsSummary: NewsSentimentSummary;
  fundamentalScreening: FundamentalScreeningResult;
  technicalScreening: TechnicalScreeningResult;
}

function fmtOrNa(value: number | null | undefined, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1)}${suffix}`;
}

function buildUserPrompt({
  summary,
  analysis,
  fundamentals,
  newsSummary,
  fundamentalScreening,
  technicalScreening,
}: Props): string {
  const { trendEma, indicators, volume, priceAction, supportResistance } = analysis;
  const nearestResistance = supportResistance.resistances[0];
  const nearestSupport = supportResistance.supports[0];

  return `[KODE_SAHAM]: ${summary.ticker} — ${summary.name}
Sektor: ${summary.sector} / ${summary.subSector}
Harga Terakhir: Rp ${summary.lastClose} (${summary.percentChange1D >= 0 ? '+' : ''}${summary.percentChange1D.toFixed(2)}% hari ini)

=== TEKNIKAL ===
- Tren EMA: ${trendEma.trend} — ${trendEma.trendDescription}
- EMA20: Rp ${trendEma.ema20.toFixed(0)} | EMA50: Rp ${trendEma.ema50.toFixed(0)} | EMA200: Rp ${trendEma.ema200.toFixed(0)}
- Harga vs EMA20: ${trendEma.priceVsEma20} | vs EMA50: ${trendEma.priceVsEma50}
- RSI14: ${indicators.rsi14.toFixed(1)} (${indicators.rsiZone}) — ${indicators.rsiNote}
- MACD: value ${indicators.macdValue.toFixed(2)}, signal ${indicators.macdSignal.toFixed(2)}, histogram ${indicators.macdHistogram.toFixed(2)} → ${indicators.macdSignalType}
- Stochastic: K ${indicators.stochK.toFixed(1)}, D ${indicators.stochD.toFixed(1)} (${indicators.stochZone})
- Price Action Terakhir: ${priceAction.patternLabel} (candle ${priceAction.lastCandleColor})
- Resistance Terdekat: ${nearestResistance ? `Rp ${nearestResistance.price.toFixed(0)} (${nearestResistance.label})` : 'tidak terdeteksi'}
- Support Terdekat: ${nearestSupport ? `Rp ${nearestSupport.price.toFixed(0)} (${nearestSupport.label})` : 'tidak terdeteksi'}
- RVOL (Relative Volume): ${volume.relativeVolume.toFixed(2)}x
- Tren Volume: ${volume.volumeTrend} ${volume.isHighVolume ? '(volume tinggi)' : ''}

=== FUNDAMENTAL ===
- PER: ${summary.per > 0 ? `${summary.per.toFixed(1)}x` : 'N/A'}
- PBV: ${summary.pbv > 0 ? `${summary.pbv.toFixed(2)}x` : 'N/A'}
- ROE: ${summary.roe !== 0 ? `${summary.roe.toFixed(1)}%` : 'N/A'}
- Market Cap: ${formatCompact(summary.capitalization)}
- Dividend Yield: ${fmtOrNa(fundamentals?.dividendYield ?? null, '%')}
- Debt to Equity: ${fmtOrNa(fundamentals?.debtToEquity ?? null, '%')}
- Net Margin: ${fmtOrNa(fundamentals?.netMargin ?? null, '%')}
- Revenue Growth YoY: ${fmtOrNa(fundamentals?.revenueGrowth ?? null, '%')}

=== SENTIMEN BERITA ===
- Total Berita: ${newsSummary.totalNews} (Bullish ${newsSummary.bullishCount} / Bearish ${newsSummary.bearishCount} / Netral ${newsSummary.neutralCount})
- Skor Sentimen Bersih: ${newsSummary.netSentimentScore}/100 (${newsSummary.overallSentiment})

=== SKOR SCREENING INTERNAL (referensi tambahan) ===
- Skor Fundamental: ${fundamentalScreening.score}/100 — ${fundamentalScreening.statusText}
- Skor Teknikal: ${technicalScreening.score}/100 — ${technicalScreening.statusText}

Analisis saham ${summary.ticker} di atas sesuai format yang telah ditentukan.`;
}

export function AiAnalystEngineCard(props: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [markdown, setMarkdown] = useState('');
  const [error, setError] = useState('');

  const html = useMemo(() => {
    if (!markdown) return '';
    const raw = marked.parse(markdown, { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown]);

  async function generate() {
    const puter = typeof window !== 'undefined' ? window.puter : undefined;
    if (!puter) {
      setError('AI belum siap dimuat, coba lagi sesaat.');
      setState('error');
      return;
    }

    setState('loading');
    setMarkdown('');
    setError('');

    try {
      const messages: PuterChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(props) },
      ];

      const stream = await puter.ai.chat(messages, { model: MODEL, stream: true });

      let fullText = '';
      for await (const part of stream) {
        if (part.type === 'text' && part.text) {
          fullText += part.text;
          setMarkdown(fullText);
        } else if (part.type === 'error') {
          throw new Error(part.message || 'Terjadi kesalahan pada AI.');
        }
      }

      if (!fullText) throw new Error('Tidak ada respons dari AI. Coba lagi.');
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Coba lagi.');
      setState('error');
    }
  }

  return (
    <section className="neo-border neo-shadow overflow-hidden bg-white dark:bg-zinc-900 rounded-xl sm:rounded-none">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b-[3px] border-(--neo-line)">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex size-9 shrink-0 items-center justify-center neo-border bg-violet-500 text-white text-sm">
            <Sparkles className="size-4" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <h2 className="font-bold uppercase tracking-wide text-zinc-800 dark:text-zinc-100">
              AI Analyst Engine
            </h2>
            <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 truncate">
              Kecocokan profil Investor · Swing Trader · Chasing/Scalper
            </p>
          </div>
        </div>
        {state !== 'idle' && (
          <button
            type="button"
            onClick={generate}
            disabled={state === 'loading'}
            title="Analisa ulang"
            aria-label="Analisa ulang"
            className="neo-press flex size-8 shrink-0 items-center justify-center neo-border bg-white dark:bg-zinc-800 disabled:opacity-50"
          >
            <RefreshCw className={cn('size-3.5', state === 'loading' && 'animate-spin')} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {state === 'idle' && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Minta AI menilai kecocokan <strong>{props.summary.ticker}</strong> secara objektif untuk 3 gaya
              trading — lengkap dengan target harga, entry, dan stop loss untuk masing-masing profil.
            </p>
            <button
              type="button"
              onClick={generate}
              className="neo-press inline-flex items-center gap-2 neo-border neo-shadow-sm bg-violet-500 px-4 py-2 text-sm font-bold text-white"
            >
              <Sparkles className="size-4" strokeWidth={2.5} />
              Analisa 3 Profil Trader
            </button>
          </div>
        )}

        {state === 'loading' && !markdown && (
          <div className="flex items-center gap-2 py-4 text-sm font-semibold text-zinc-400">
            <Loader2 className="size-4 animate-spin" strokeWidth={2.5} /> AI sedang menganalisis {props.summary.ticker}…
          </div>
        )}

        {state === 'error' && (
          <div className="flex items-start gap-2.5 neo-border bg-rose-50 dark:bg-rose-400/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" strokeWidth={2.5} />
            <div className="space-y-2">
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              <button
                type="button"
                onClick={generate}
                className="neo-press inline-flex items-center gap-1.5 neo-border bg-white dark:bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200"
              >
                <RefreshCw className="size-3.5" strokeWidth={2.5} /> Coba Lagi
              </button>
            </div>
          </div>
        )}

        {html && (
          <div
            className="prose prose-zinc prose-sm max-w-none prose-headings:font-bold prose-headings:uppercase prose-headings:tracking-tight prose-table:text-sm prose-th:text-left dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </section>
  );
}
