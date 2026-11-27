import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { formatPercent } from "@/lib/format";
import { sectorHref, type SectorPerf } from "@/lib/screener";
import { cn } from "@/lib/utils";

/** Bar perubahan harian per sektor; tiap baris menuju daftar saham sektor tersebut. */
export function SectorBars({ sectors, active }: { sectors: SectorPerf[]; active?: string }) {
  const max = Math.max(...sectors.map((s) => Math.abs(s.change)), 0.5);
  return (
    <ul className="-mx-2 space-y-0.5">
      {sectors.map((s) => {
        const w = (Math.abs(s.change) / max) * 50;
        return (
          <li key={s.sector}>
            <Link
              href={sectorHref(s.sector)}
              aria-current={active === s.sector ? "page" : undefined}
              title={`Lihat ${s.count} saham sektor ${s.sector}`}
              className={cn(
                "group grid grid-cols-[minmax(0,9rem)_1fr_4.5rem_1rem] items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-accent sm:grid-cols-[14rem_1fr_5rem_1rem]",
                active === s.sector && "bg-accent",
              )}
            >
              <span className="truncate text-muted-foreground group-hover:text-foreground">{s.sector}</span>
              <div className="relative h-2.5 rounded-full bg-muted" aria-hidden>
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div
                  className={cn("absolute inset-y-0 rounded-full", s.change >= 0 ? "left-1/2 bg-up" : "right-1/2 bg-down")}
                  style={{ width: `${w}%` }}
                />
              </div>
              <span className={cn("text-right font-medium tabular-nums", s.change >= 0 ? "text-up" : "text-down")}>
                {formatPercent(s.change)}
              </span>
              <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
