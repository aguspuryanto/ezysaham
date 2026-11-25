const idInt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export function formatPrice(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return idInt.format(Math.round(v));
}

/** Harga rata-rata: 2 desimal bila ada pecahan (mis. 212,31), bulat bila tidak. */
export function formatAvg(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  return Math.abs(v - Math.round(v)) < 0.005 ? formatPrice(v) : formatNumber(v, 2);
}

export function formatNumber(v: number | null | undefined, digits = 2) {
  if (v == null || !Number.isFinite(v)) return "-";
  const f = 10 ** digits;
  const r = Math.round(v * f) / f || 0; // hindari "-0"
  return r.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(v: number | null | undefined, digits = 2, withSign = true) {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = withSign && v > 0 ? "+" : "";
  return `${sign}${formatNumber(v, digits)}%`;
}

/** Angka ringkas gaya Indonesia: rb, jt, M, T */
export function formatCompact(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return "-";
  const abs = Math.abs(v);
  const units: [number, string][] = [
    [1e12, " T"],
    [1e9, " M"],
    [1e6, " jt"],
    [1e3, " rb"],
  ];
  for (const [n, s] of units) {
    if (abs >= n) return `${formatNumber(v / n, abs / n >= 100 ? 0 : 1)}${s}`;
  }
  return formatNumber(v, 0);
}

export function formatRupiah(v: number | null | undefined, compact = false) {
  if (v == null || !Number.isFinite(v)) return "-";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return `${sign}Rp${compact ? formatCompact(abs) : formatPrice(abs)}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function changeColor(v: number | null | undefined) {
  if (v == null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-up" : "text-down";
}
