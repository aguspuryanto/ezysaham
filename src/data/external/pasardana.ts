import { StockSummary } from '@/domain/models/Stock';

export const PASARDANA_LIST_URL =
  'https://pasardana.id/api/StockSearchResult/GetAll?pageBegin=0&pageLength=1000&sortField=Code&sortOrder=ASC';

export interface PasardanaStockItem {
  Code: string;
  Name: string;
  SectorName: string;
  SubSectorName: string;
  Last: number;
  PrevClosingPrice: number;
  AdjustedHighPrice: number;
  AdjustedLowPrice: number;
  Volume: number;
  Value: number;
  Frequency: number;
  Capitalization: number;
  OneDay: number;
  OneWeek: number;
  OneMonth: number;
  Per: number;
  Pbr: number;
  Roe: number;
  AdjustedAnnualHighPrice: number;
  AdjustedAnnualLowPrice: number;
}

export function mapToStockSummary(item: PasardanaStockItem): StockSummary {
  const last = item.Last || 0;
  return {
    ticker: item.Code,
    name: item.Name || item.Code,
    sector: item.SectorName || 'Unknown',
    subSector: item.SubSectorName || '',
    lastClose: last,
    prevClose: item.PrevClosingPrice || last,
    percentChange1D: (item.OneDay || 0) * 100,
    percentChange1W: (item.OneWeek || 0) * 100,
    percentChange1M: (item.OneMonth || 0) * 100,
    high: item.AdjustedHighPrice || last,
    low: item.AdjustedLowPrice || last,
    volume: item.Volume || 0,
    value: item.Value || 0,
    frequency: item.Frequency || 0,
    capitalization: item.Capitalization || 0,
    per: item.Per || 0,
    pbv: item.Pbr || 0,
    roe: (item.Roe || 0) * 100,
    annualHigh: item.AdjustedAnnualHighPrice || last,
    annualLow: item.AdjustedAnnualLowPrice || last * 0.7,
  };
}
