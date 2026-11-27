import { TrendingDown, TrendingUp } from "lucide-react";
import { changeColor, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ChangeText({
  value,
  className,
  icon = false,
  digits = 2,
}: {
  value: number | null | undefined;
  className?: string;
  icon?: boolean;
  digits?: number;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", changeColor(value), className)}>
      {icon && value != null && value !== 0 && (value > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />)}
      {formatPercent(value, digits)}
    </span>
  );
}

export function ChangePill({ value, className }: { value: number | null | undefined; className?: string }) {
  const v = value ?? 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-16 justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums",
        v > 0 ? "bg-up-soft text-up" : v < 0 ? "bg-down-soft text-down" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatPercent(value)}
    </span>
  );
}
