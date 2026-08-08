import { StockSummary } from '@/domain/models/Stock';

export const PASARDANA_LIST_URL =
  'https://pasardana.id/api/StockSearchResult/GetAll?pageBegin=0&pageLength=1000&sortField=Code&sortOrder=ASC';

/*
{
    "Id": 8,
    "Name": "Akasha Wira International Tbk.",
    "Code": "ADES",
    "StockSubSectorId": 51,
    "SubSectorName": "Food & Beverages",
    "StockSectorId": 4,
    "SectorName": "CONSUMER GOODS INDUSTRY",
    "NewSubIndustryId": 43,
    "NewSubIndustryName": "Minuman Ringan",
    "NewIndustryId": 20,
    "NewIndustryName": "Minuman",
    "NewSubSectorId": 8,
    "NewSubSectorName": "Makanan & Minuman",
    "NewSectorId": 4,
    "NewSectorName": "Barang Konsumen Primer",
    "Last": 35000.0,
    "PrevClosingPrice": 35000.0,
    "AdjustedClosingPrice": 35000.0,
    "AdjustedOpenPrice": 35000.0,
    "AdjustedHighPrice": 35000.0,
    "AdjustedLowPrice": 35000.0,
    "Volume": 31900.0,
    "Frequency": 65.0,
    "Value": 1116500000.0,
    "OneDay": 0.0,
    "OneWeek": 0.02941176,
    "OneMonth": 0.04712042,
    "ThreeMonth": 0.56599553,
    "SixMonth": 1.29132570,
    "OneYear": 1.50447227,
    "ThreeYear": 1.93501048,
    "FiveYear": 13.76793249,
    "TenYear": 22.56902357,
    "Mtd": 0.02941176,
    "Ytd": 1.26904376,
    "Per": 21.61185000,
    "Pbr": 5.8473,
    "Capitalization": 20646388000000.0,
    "BetaOneYear": 0.16061842,
    "StdevOneYear": 0.46126065,
    "PerAnnualized": 19.46942000,
    "PsrAnnualized": 5.09243000,
    "PcfrAnnualized": 33.41294000,
    "AdjustedAnnualHighPrice": 40000.0,
    "AdjustedAnnualLowPrice": 12900.0,
    "LastDate": "2026-08-07T00:00:00",
    "LastUpdate": "2026-08-07T00:00:00",
    "Roe": 0.3003322921531420,
    "FreeFloatPct": 8.1100
  }
*/
export interface PasardanaStockItem {
  Code: string;
  Name: string;
  SectorName: string;
  NewSectorName: string;
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
  ThreeMonth: number;
  SixMonth: number;
  Ytd: number;
  OneYear: number;
  ThreeYear: number;
  FiveYear: number;
  TenYear: number;
  Per: number;
  Pbr: number;
  Roe: number;
  FreeFloatPct: number;
  AdjustedAnnualHighPrice: number;
  AdjustedAnnualLowPrice: number;
}

export function mapToStockSummary(item: PasardanaStockItem): StockSummary {
  const last = item.Last || 0;
  return {
    ticker: item.Code,
    name: item.Name || item.Code,
    sector: item.NewSectorName || 'Unknown',
    subSector: item.SubSectorName || '',
    lastClose: last,
    prevClose: item.PrevClosingPrice || last,
    percentChange1D: (item.OneDay || 0) * 100,
    percentChange1W: (item.OneWeek || 0) * 100,
    percentChange1M: (item.OneMonth || 0) * 100,
    percentChange3M: (item.ThreeMonth || 0) * 100,
    percentChange6M: (item.SixMonth || 0) * 100,
    percentChangeYtd: (item.Ytd || 0) * 100,
    percentChange1Y: (item.OneYear || 0) * 100,
    percentChange3Y: (item.ThreeYear || 0) * 100,
    percentChange5Y: (item.FiveYear || 0) * 100,
    percentChange10Y: (item.TenYear || 0) * 100,
    high: item.AdjustedHighPrice || last,
    low: item.AdjustedLowPrice || last,
    volume: item.Volume || 0,
    value: item.Value || 0,
    frequency: item.Frequency || 0,
    capitalization: item.Capitalization || 0,
    per: item.Per || 0,
    pbv: item.Pbr || 0,
    roe: (item.Roe || 0) * 100,
    freeFloat: (item.FreeFloatPct || 0) * 100,
    annualHigh: item.AdjustedAnnualHighPrice || last,
    annualLow: item.AdjustedAnnualLowPrice || last * 0.7,
  };
}
