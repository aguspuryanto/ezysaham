'use client';

import { SCORE_FACTOR_LABEL, ScoreFactor } from '@/domain/models/Signal';
import { cn } from '@/lib/format';
import { TONE_TEXT } from '../../screener/detail/components/ui';
import { scoreTone } from '../signalUi';
import { ScoreBar } from './SignalBadge';

/** Per-factor bars that make up the SARA Score. */
export function ScoreBreakdown({ factors, showNotes = true }: { factors: ScoreFactor[]; showNotes?: boolean }) {
  return (
    <ul className="space-y-3">
      {factors.map((f) => (
        <li key={f.key}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium text-(--sv-text)">
              {SCORE_FACTOR_LABEL[f.key]}
              <span className="ml-1.5 text-[11px] font-normal text-(--sv-muted)">bobot {Math.round(f.weight * 100)}%</span>
            </span>
            <span className={cn('font-semibold tabular-nums', TONE_TEXT[scoreTone(f.score)])}>{f.score}</span>
          </div>
          <ScoreBar score={f.score} className="mt-1" />
          {showNotes && <p className="mt-1 text-xs text-(--sv-muted)">{f.note}</p>}
        </li>
      ))}
    </ul>
  );
}
