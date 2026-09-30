import { StockSummary } from '@/domain/models/Stock';

export interface Breadth {
  up: number;
  flat: number;
  down: number;
}

export interface SectorGroup {
  sector: string;
  stocks: StockSummary[];
  subSectorCount: number;
  avgChange1D: number;
  totalCapitalization: number;
  /** Share of the whole market's capitalization, 0–100. */
  capShare: number;
  breadth: Breadth;
  topGainer: StockSummary | null;
  topLoser: StockSummary | null;
}

export type SectorSortKey = 'cap' | 'change' | 'count';

export function computeBreadth(stocks: StockSummary[]): Breadth {
  const b: Breadth = { up: 0, flat: 0, down: 0 };
  for (const s of stocks) {
    if (s.percentChange1D > 0) b.up += 1;
    else if (s.percentChange1D < 0) b.down += 1;
    else b.flat += 1;
  }
  return b;
}

export function buildSectorGroups(summaries: StockSummary[]): SectorGroup[] {
  const bySector = new Map<string, StockSummary[]>();
  for (const s of summaries) {
    const key = s.sector || 'Lainnya';
    const list = bySector.get(key);
    if (list) list.push(s);
    else bySector.set(key, [s]);
  }

  const marketCap = summaries.reduce((sum, s) => sum + s.capitalization, 0);
  const groups: SectorGroup[] = [];
  for (const [sector, stocks] of bySector) {
    const totalCapitalization = stocks.reduce((sum, s) => sum + s.capitalization, 0);
    const byChange = [...stocks].sort((a, b) => b.percentChange1D - a.percentChange1D);
    const gainer = byChange[0];
    const loser = byChange[byChange.length - 1];
    groups.push({
      sector,
      stocks,
      subSectorCount: new Set(stocks.map((s) => s.subSector).filter(Boolean)).size,
      avgChange1D: stocks.reduce((sum, s) => sum + s.percentChange1D, 0) / stocks.length,
      totalCapitalization,
      capShare: marketCap > 0 ? (totalCapitalization / marketCap) * 100 : 0,
      breadth: computeBreadth(stocks),
      topGainer: gainer && gainer.percentChange1D > 0 ? gainer : null,
      topLoser: loser && loser.percentChange1D < 0 ? loser : null,
    });
  }
  return groups;
}

export function sortSectorGroups(groups: SectorGroup[], key: SectorSortKey): SectorGroup[] {
  const value = (g: SectorGroup) => (key === 'cap' ? g.totalCapitalization : key === 'change' ? g.avgChange1D : g.stocks.length);
  return [...groups].sort((a, b) => value(b) - value(a));
}
