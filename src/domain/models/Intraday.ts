export interface IntradayBar {
  /** Unix seconds (UTC) — render with timeZone: 'Asia/Jakarta'. */
  time: number;
  price: number;
  volume: number;
}

export interface IntradaySession {
  /** Unix seconds (UTC), from meta.currentTradingPeriod.regular. */
  regularStart: number;
  regularEnd: number;
}

export interface IntradayResponse {
  code: string;
  ok: boolean;
  bars: IntradayBar[];
  previousClose?: number;
  session?: IntradaySession;
  source?: 'yahoo';
  reason?: 'not_found' | 'error';
  message?: string;
}
