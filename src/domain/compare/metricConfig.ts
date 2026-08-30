/**
 * metricConfig.ts
 *
 * Single declarative source of truth for every metric shown on the Compare
 * page: which field it reads, whether higher or lower is better, how it's
 * formatted, and which scoring category it feeds. The comparison table, the
 * decision engine, and the per-metric explanations all derive from this list
 * instead of each hardcoding their own copy — a new metric (or sector) is
 * added here once and shows up everywhere consistently.
 */
import { StockSummary } from '@/domain/models/Stock';
import { FundamentalDetail } from '@/domain/models/Fundamentals';
import { formatCompact } from '@/lib/format';

export interface CombinedStockData {
  summary: StockSummary;
  fundamentals: FundamentalDetail | null;
}

export type MetricDirection = 'higher' | 'lower';
export type MetricCategory = 'quality' | 'value' | 'growth' | 'dividend' | 'momentum' | 'risk';
export type SectorCategory = 'bank' | 'mining' | 'property' | 'default';

export interface MetricConfig {
  key: string;
  label: string;
  description: string;
  category: MetricCategory;
  direction: MetricDirection;
  /** Raw numeric value, or null when genuinely unavailable — never coerced to 0. */
  getValue: (d: CombinedStockData) => number | null;
  format: (value: number) => string;
}

const pct = (v: number) => `${v.toFixed(2)}%`;
const multiple = (v: number) => `${v.toFixed(2)}×`;

export const METRICS: MetricConfig[] = [
  {
    key: 'marketCap',
    label: 'Market Cap',
    description: 'Total nilai pasar perusahaan',
    category: 'quality',
    direction: 'higher',
    getValue: (d) => (d.summary.capitalization > 0 ? d.summary.capitalization : null),
    format: (v) => formatCompact(v),
  },
  {
    key: 'per',
    label: 'PER',
    description: 'Price to Earnings Ratio',
    category: 'value',
    direction: 'lower',
    getValue: (d) => (d.summary.per > 0 ? d.summary.per : null),
    format: (v) => `${v.toFixed(1)}×`,
  },
  {
    key: 'pbv',
    label: 'PBV',
    description: 'Price to Book Value',
    category: 'value',
    direction: 'lower',
    getValue: (d) => (d.summary.pbv > 0 ? d.summary.pbv : null),
    format: multiple,
  },
  {
    key: 'roe',
    label: 'ROE',
    description: 'Return on Equity',
    category: 'quality',
    direction: 'higher',
    getValue: (d) => (d.summary.roe !== 0 ? d.summary.roe : null),
    format: pct,
  },
  {
    key: 'netMargin',
    label: 'Net Margin',
    description: 'Profit margin',
    category: 'quality',
    direction: 'higher',
    getValue: (d) => d.fundamentals?.netMargin ?? null,
    format: pct,
  },
  {
    key: 'dividendYield',
    label: 'Dividend Yield',
    description: 'Annual dividend yield',
    category: 'dividend',
    direction: 'higher',
    getValue: (d) => d.fundamentals?.dividendYield ?? null,
    format: pct,
  },
  {
    key: 'revenueGrowth',
    label: 'Revenue Growth (YoY)',
    description: 'Year-over-year revenue growth',
    category: 'growth',
    direction: 'higher',
    getValue: (d) => d.fundamentals?.revenueGrowth ?? null,
    format: pct,
  },
  {
    key: 'currentRatio',
    label: 'Current Ratio',
    description: 'Liquidity ratio',
    category: 'risk',
    direction: 'higher',
    getValue: (d) => d.fundamentals?.currentRatio ?? null,
    format: multiple,
  },
  {
    key: 'der',
    label: 'Debt to Equity Ratio (DER)',
    description: 'Debt to equity ratio',
    category: 'risk',
    direction: 'lower',
    // debtToEquity arrives from Yahoo already scaled as a percentage (18.1 == 0.181x)
    getValue: (d) => (d.fundamentals?.debtToEquity != null ? d.fundamentals.debtToEquity / 100 : null),
    format: multiple,
  },
];

export function getMetric(key: string): MetricConfig | undefined {
  return METRICS.find((m) => m.key === key);
}

/** Which side wins a metric row — null when either side is N/A or the values tie. */
export function winner(direction: MetricDirection, valueA: number | null, valueB: number | null): 'a' | 'b' | null {
  if (valueA == null || valueB == null || valueA === valueB) return null;
  const aWins = direction === 'higher' ? valueA > valueB : valueA < valueB;
  return aWins ? 'a' : 'b';
}

// ─── Sector-aware metric selection ─────────────────────────────────────────
// IDX sector/sub-sector names (from Pasardana) drive which of the metrics
// above are actually meaningful to show — e.g. DER/Current Ratio are
// routinely null or meaningless for banks, so they're dropped for that
// sector rather than shown as a wall of N/A. Metrics this app doesn't have
// data for yet (NIM, NPL, CASA, CAR, Presales, Net Debt, ...) are simply
// left out — the sector map below only ever references keys that exist in
// METRICS, so adding a new sector or a new data source is additive.
export function getSectorCategory(sector: string, subSector: string): SectorCategory {
  const text = `${sector} ${subSector}`.toLowerCase();
  if (/\bbank/.test(text)) return 'bank';
  if (/(tambang|mining|coal|batu\s?bara|metal|mineral)/.test(text)) return 'mining';
  if (/(propert|real\s?estat|realty)/.test(text)) return 'property';
  return 'default';
}

const DEFAULT_METRIC_KEYS = METRICS.map((m) => m.key);

export const SECTOR_METRIC_KEYS: Record<SectorCategory, string[]> = {
  // Banks: DER/Current Ratio don't map to a bank's balance sheet shape and
  // are near-always null from Yahoo — leave them out entirely rather than
  // showing dead rows.
  bank: ['marketCap', 'roe', 'netMargin', 'per', 'pbv', 'dividendYield', 'revenueGrowth'],
  mining: ['marketCap', 'revenueGrowth', 'netMargin', 'roe', 'der', 'dividendYield', 'per', 'pbv'],
  property: ['marketCap', 'revenueGrowth', 'roe', 'netMargin', 'der', 'per', 'pbv'],
  default: DEFAULT_METRIC_KEYS,
};

/** Resolves the metric list to display for a comparison — falls back to the
 *  full default set when the two tickers aren't in the same sector, since a
 *  sector-specific subset only makes sense for an apples-to-apples pair. */
export function resolveComparisonMetrics(sectorA: SectorCategory, sectorB: SectorCategory): MetricConfig[] {
  const sector = sectorA === sectorB ? sectorA : 'default';
  const keys = SECTOR_METRIC_KEYS[sector];
  return keys.map(getMetric).filter((m): m is MetricConfig => m != null);
}
