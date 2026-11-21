import Link from "next/link";
import type { Stock } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { ChangeText } from "./ChangeText";

/** Pita berjalan berisi saham-saham berkapitalisasi terbesar. */
export function MarketTicker({ stocks }: { stocks: Stock[] }) {
  if (!stocks.length) return null;
  const items = [...stocks, ...stocks];
  return (
    <div className="group relative -mx-4 overflow-hidden border-y bg-card sm:mx-0 sm:rounded-xl sm:border">
      <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
        {items.map((s, i) => (
          <Link
            key={`${s.symbol}-${i}`}
            href={`/stock/${s.symbol}`}
            aria-hidden={i >= stocks.length}
            tabIndex={i >= stocks.length ? -1 : undefined}
            className="flex items-center gap-2 border-r px-4 py-2.5 text-sm whitespace-nowrap hover:bg-accent"
          >
            <span className="font-semibold">{s.symbol}</span>
            <span className="tabular-nums">{formatPrice(s.price)}</span>
            <ChangeText value={s.change} className="text-xs" />
          </Link>
        ))}
      </div>
    </div>
  );
}
