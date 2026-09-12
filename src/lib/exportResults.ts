import { StockSummary } from '@/domain/models/Stock';

export interface ExportRow {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  score: number;
  volume: number;
  value: number;
}

export function toExportRows(
  results: Array<{ summary: StockSummary; score: number }>
): ExportRow[] {
  return results.map(({ summary: s, score }) => ({
    ticker: s.ticker,
    name: s.name,
    sector: s.sector,
    price: s.lastClose,
    changePct: Number(s.percentChange1D.toFixed(2)),
    score,
    volume: s.volume,
    value: s.value,
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportResultsAsCsv(rows: ExportRow[], filename = 'screener-results.csv') {
  const header = ['Ticker', 'Nama', 'Sektor', 'Harga', 'Perubahan %', 'Skor AI', 'Volume', 'Nilai Transaksi'];
  const lines = rows.map((r) =>
    [r.ticker, `"${r.name.replace(/"/g, '""')}"`, `"${r.sector.replace(/"/g, '""')}"`, r.price, r.changePct, r.score, r.volume, r.value].join(',')
  );
  const csv = [header.join(','), ...lines].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
}

export function exportResultsAsJson(rows: ExportRow[], filename = 'screener-results.json') {
  downloadBlob(new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }), filename);
}
