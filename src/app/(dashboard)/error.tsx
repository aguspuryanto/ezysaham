"use client";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-down-soft text-down">
        <TriangleAlert className="size-6" />
      </span>
      <h1 className="text-lg font-semibold">Gagal memuat data</h1>
      <p className="text-sm text-muted-foreground">
        {error.message || "Server data saham sedang tidak dapat dihubungi."} Coba beberapa saat lagi.
      </p>
      <Button onClick={reset} variant="outline">
        <RefreshCw /> Coba lagi
      </Button>
    </div>
  );
}
