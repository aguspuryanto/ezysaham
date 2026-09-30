'use client';

/**
 * JournalTable.tsx
 *
 * Journal entries in the Screener's `.sv-theme` language — desktop table with
 * sticky header + a mobile card list, both with inline edit / delete.
 */

import { Check, Loader2, NotebookPen, Pencil, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { ChangeEvent, useState } from 'react';
import type { JournalEntryEditableFields } from '@/data/repositories/JournalRepository';
import { JournalEntry, JournalStatus } from '@/domain/models/JournalEntry';
import { SCREENER_PRESETS } from '@/domain/screener/presets';
import { cn, formatPercent, formatRupiah } from '@/lib/format';
import { Badge, Skeleton } from '../../screener/detail/components/ui';
import { Tone } from '../../screener/detail/format';

export const STATUS_LABEL: Record<JournalStatus, string> = {
  open: 'Open',
  tp_hit: 'Exit TP',
  sl_hit: 'Exit SL',
  sideways: 'Sideways',
};

const STATUS_TONE: Record<JournalStatus, Tone> = {
  open: 'warning',
  tp_hit: 'positive',
  sl_hit: 'negative',
  sideways: 'neutral',
};

const RESULT_LABEL: Partial<Record<JournalStatus, string>> = { tp_hit: 'WIN', sl_hit: 'LOSS' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function gainTone(v: number | null): string {
  return v == null ? 'text-(--sv-muted)' : v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
}

function toEditableFields(entry: JournalEntry): JournalEntryEditableFields {
  return { entry: entry.entry, tp1: entry.tp1, tp2: entry.tp2, sl: entry.sl, reasonBuy: entry.reasonBuy, reasonAvoid: entry.reasonAvoid };
}

type SaveFn = (patch: JournalEntryEditableFields) => Promise<boolean>;

/** Edit state shared by the desktop row and the mobile card. */
function useEntryEditor(entry: JournalEntry, onSave: SaveFn) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<JournalEntryEditableFields>(() => toEditableFields(entry));
  return {
    editing,
    saving,
    draft,
    start: () => { setDraft(toEditableFields(entry)); setEditing(true); },
    cancel: () => setEditing(false),
    setNumber: (field: 'entry' | 'tp1' | 'tp2' | 'sl') => (e: ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [field]: Number(e.target.value) })),
    setText: (field: 'reasonBuy' | 'reasonAvoid') => (e: ChangeEvent<HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [field]: e.target.value })),
    save: async () => {
      setSaving(true);
      const ok = await onSave(draft);
      setSaving(false);
      if (ok) setEditing(false);
    },
  };
}
type Editor = ReturnType<typeof useEntryEditor>;

const inputClass = 'h-8 w-full min-w-0 rounded-md border border-(--sv-border) bg-(--sv-bg) px-2 text-right text-sm tabular-nums text-(--sv-text) outline-none focus:border-(--sv-primary) focus:bg-(--sv-surface) focus:ring-2 focus:ring-(--sv-primary)/15';
const textareaClass = 'w-full min-w-[12rem] resize-y rounded-md border border-(--sv-border) bg-(--sv-bg) px-2 py-1.5 text-sm text-(--sv-text) outline-none focus:border-(--sv-primary) focus:bg-(--sv-surface) focus:ring-2 focus:ring-(--sv-primary)/15';
const iconBtn = 'flex size-8 items-center justify-center rounded-lg border border-(--sv-border) bg-(--sv-surface) text-(--sv-muted) transition-colors disabled:opacity-50';

function TickerCell({ entry }: { entry: JournalEntry }) {
  return (
    <div className="flex flex-col gap-1">
      <Link href={`/screener/${entry.ticker}`} className="font-semibold text-(--sv-text) hover:text-(--sv-primary)">{entry.ticker}</Link>
      {entry.presetId && <span className="text-[11px] text-(--sv-muted)">{SCREENER_PRESETS[entry.presetId]?.label ?? entry.presetId}</span>}
    </div>
  );
}

function StatusCell({ entry }: { entry: JournalEntry }) {
  const result = RESULT_LABEL[entry.status];
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
      <span className="text-[11px] text-(--sv-muted)">
        {result ? <b className={cn('font-semibold', entry.status === 'tp_hit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>{result}</b> : `${entry.daysTracked} hari dipantau`}
        {entry.exitPrice != null && ` · exit ${formatRupiah(entry.exitPrice)}`}
      </span>
    </div>
  );
}

function Reasons({ entry, editor }: { entry: JournalEntry; editor: Editor }) {
  if (editor.editing) {
    return (
      <div className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          Alasan membeli
          <textarea value={editor.draft.reasonBuy} onChange={editor.setText('reasonBuy')} rows={2} className={textareaClass} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Alasan menghindari
          <textarea value={editor.draft.reasonAvoid} onChange={editor.setText('reasonAvoid')} rows={2} className={textareaClass} />
        </label>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 text-[13px] leading-snug">
      <p className="line-clamp-2 text-(--sv-text)" title={entry.reasonBuy}>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">Beli: </span>{entry.reasonBuy || '–'}
      </p>
      <p className="line-clamp-2 text-(--sv-muted)" title={entry.reasonAvoid}>
        <span className="font-semibold text-amber-700 dark:text-amber-400">Hindari: </span>{entry.reasonAvoid || '–'}
      </p>
    </div>
  );
}

function Actions({ entry, editor, onDelete }: { entry: JournalEntry; editor: Editor; onDelete: () => void }) {
  return editor.editing ? (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={editor.save} disabled={editor.saving} aria-label={`Simpan entri ${entry.ticker}`} className={cn(iconBtn, 'border-(--sv-primary) bg-(--sv-primary) text-(--sv-primary-fg)')}>
        {editor.saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={2} />}
      </button>
      <button type="button" onClick={editor.cancel} disabled={editor.saving} aria-label={`Batal edit ${entry.ticker}`} className={cn(iconBtn, 'hover:text-(--sv-text)')}>
        <X className="size-4" strokeWidth={2} />
      </button>
    </div>
  ) : (
    <div className="flex items-center justify-end gap-1.5">
      <button type="button" onClick={editor.start} aria-label={`Edit entri ${entry.ticker}`} className={cn(iconBtn, 'hover:text-(--sv-primary)')}>
        <Pencil className="size-4" strokeWidth={2} />
      </button>
      <button type="button" onClick={onDelete} aria-label={`Hapus entri ${entry.ticker}`} className={cn(iconBtn, 'hover:text-rose-600')}>
        <Trash2 className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}

function PriceField({ editor, field, value, className }: { editor: Editor; field: 'entry' | 'tp1' | 'tp2' | 'sl'; value: number; className?: string }) {
  return editor.editing
    ? <input type="number" aria-label={field.toUpperCase()} value={editor.draft[field]} onChange={editor.setNumber(field)} className={inputClass} />
    : <span className={cn('tabular-nums', className)}>{formatRupiah(value)}</span>;
}

function Row({ entry, onDelete, onSave }: { entry: JournalEntry; onDelete: () => void; onSave: SaveFn }) {
  const editor = useEntryEditor(entry, onSave);
  const td = 'border-b border-(--sv-border) px-3 py-3.5 align-top';
  return (
    <tr className={cn('group', editor.editing ? 'bg-(--sv-primary-soft)/40' : 'hover:bg-(--sv-bg)')}>
      <td className={cn(td, 'whitespace-nowrap text-(--sv-muted)')}>{formatDate(entry.addedAt)}</td>
      <td className={td}><TickerCell entry={entry} /></td>
      <td className={cn(td, 'w-28 text-right font-semibold text-(--sv-text)')}><PriceField editor={editor} field="entry" value={entry.entry} /></td>
      <td className={cn(td, 'w-28 text-right text-emerald-700 dark:text-emerald-400')}>
        <div className="flex flex-col items-end gap-1">
          <PriceField editor={editor} field="tp1" value={entry.tp1} />
          <PriceField editor={editor} field="tp2" value={entry.tp2} className="text-xs text-(--sv-muted)" />
        </div>
      </td>
      <td className={cn(td, 'w-28 text-right text-rose-600 dark:text-rose-400')}><PriceField editor={editor} field="sl" value={entry.sl} /></td>
      <td className={cn(td, 'text-right tabular-nums text-(--sv-text)')}>{entry.riskRewardPlanned > 0 ? `1 : ${entry.riskRewardPlanned.toFixed(1)}` : '–'}</td>
      <td className={td}><StatusCell entry={entry} /></td>
      <td className={cn(td, 'text-right font-semibold tabular-nums', gainTone(entry.gainLossPct))}>{entry.gainLossPct == null ? '–' : formatPercent(entry.gainLossPct)}</td>
      <td className={cn(td, 'min-w-[16rem] max-w-md')}><Reasons entry={entry} editor={editor} /></td>
      <td className={td}><Actions entry={entry} editor={editor} onDelete={onDelete} /></td>
    </tr>
  );
}

function MobileCard({ entry, onDelete, onSave }: { entry: JournalEntry; onDelete: () => void; onSave: SaveFn }) {
  const editor = useEntryEditor(entry, onSave);
  const cell = 'flex flex-col gap-1 text-sm';
  const label = 'text-[11px] text-(--sv-muted)';
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-(--sv-border) bg-(--sv-surface) p-4 shadow-(--sv-shadow)">
      <div className="flex items-start justify-between gap-3">
        <div>
          <TickerCell entry={entry} />
          <span className="text-xs text-(--sv-muted)">{formatDate(entry.addedAt)}</span>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={STATUS_TONE[entry.status]}>{STATUS_LABEL[entry.status]}</Badge>
          <span className={cn('text-sm font-semibold tabular-nums', gainTone(entry.gainLossPct))}>{entry.gainLossPct == null ? '–' : formatPercent(entry.gainLossPct)}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 rounded-lg bg-(--sv-bg) p-2.5">
        <div className={cell}><span className={label}>Entry</span><PriceField editor={editor} field="entry" value={entry.entry} className="font-semibold text-(--sv-text)" /></div>
        <div className={cell}><span className={label}>TP1</span><PriceField editor={editor} field="tp1" value={entry.tp1} className="text-emerald-700 dark:text-emerald-400" /></div>
        <div className={cell}><span className={label}>TP2</span><PriceField editor={editor} field="tp2" value={entry.tp2} className="text-emerald-700 dark:text-emerald-400" /></div>
        <div className={cell}><span className={label}>SL</span><PriceField editor={editor} field="sl" value={entry.sl} className="text-rose-600 dark:text-rose-400" /></div>
      </div>
      <Reasons entry={entry} editor={editor} />
      <div className="flex items-center justify-between gap-2 border-t border-(--sv-border) pt-3">
        <span className="text-xs text-(--sv-muted)">R:R {entry.riskRewardPlanned > 0 ? `1 : ${entry.riskRewardPlanned.toFixed(1)}` : '–'}</span>
        <Actions entry={entry} editor={editor} onDelete={onDelete} />
      </div>
    </li>
  );
}

export function JournalTable({ entries, loading, onDelete, onSave }: {
  entries: JournalEntry[];
  loading: boolean;
  onDelete: (entry: JournalEntry) => void;
  onSave: (id: string, patch: JournalEntryEditableFields) => Promise<boolean>;
}) {
  const th = 'sticky top-0 z-10 whitespace-nowrap border-b border-(--sv-border) bg-(--sv-surface) px-3 py-3 text-xs font-semibold text-(--sv-muted)';
  return (
    <>
      <div className="hidden max-h-[calc(100vh-9rem)] overflow-auto rounded-xl border border-(--sv-border) bg-(--sv-surface) shadow-(--sv-shadow) md:block">
        <table className="w-full min-w-[1080px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th scope="col" className={cn(th, 'text-left')}>Tanggal</th>
              <th scope="col" className={cn(th, 'text-left')}>Kode</th>
              <th scope="col" className={cn(th, 'text-right')}>Entry</th>
              <th scope="col" className={cn(th, 'text-right')}>TP1 / TP2</th>
              <th scope="col" className={cn(th, 'text-right')}>Stop Loss</th>
              <th scope="col" className={cn(th, 'text-right')}>R:R</th>
              <th scope="col" className={cn(th, 'text-left')}>Status</th>
              <th scope="col" className={cn(th, 'text-right')}>Gain/Loss</th>
              <th scope="col" className={cn(th, 'text-left')}>Alasan</th>
              <th scope="col" className={cn(th, 'text-right')}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 10 }, (_, j) => (
                      <td key={j} className="border-b border-(--sv-border) px-3 py-4"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              : entries.map((e) => <Row key={e.id} entry={e} onDelete={() => onDelete(e)} onSave={(p) => onSave(e.id, p)} />)}
          </tbody>
        </table>
      </div>

      <ul className="grid gap-3 md:hidden">
        {loading
          ? Array.from({ length: 3 }, (_, i) => <li key={i} className="h-48 animate-pulse rounded-xl border border-(--sv-border) bg-(--sv-surface)" />)
          : entries.map((e) => <MobileCard key={e.id} entry={e} onDelete={() => onDelete(e)} onSave={(p) => onSave(e.id, p)} />)}
      </ul>
    </>
  );
}

export function JournalEmptyState({ title, hint, action }: { title: string; hint: string; action?: { label: string; onClick?: () => void; href?: string } }) {
  const btn = 'mt-1 rounded-lg border border-(--sv-border) px-3.5 py-2 text-sm font-medium text-(--sv-text) hover:bg-(--sv-bg)';
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-(--sv-border) bg-(--sv-surface) px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-(--sv-primary-soft) text-(--sv-primary)">
        <NotebookPen className="size-6" strokeWidth={2} />
      </span>
      <p className="text-base font-semibold text-(--sv-text)">{title}</p>
      <p className="max-w-sm text-sm text-(--sv-muted)">{hint}</p>
      {action && (action.href
        ? <Link href={action.href} className={btn}>{action.label}</Link>
        : <button type="button" onClick={action.onClick} className={btn}>{action.label}</button>)}
    </div>
  );
}
