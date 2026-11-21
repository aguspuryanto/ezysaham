"use client";
import { useState } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePortfolio } from "@/hooks/usePortfolio";
import { PortfolioForm } from "./PortfolioForm";

export function AddToPortfolioButton({ symbol, price }: { symbol: string; price: number }) {
  const [open, setOpen] = useState(false);
  const [added, setAdded] = useState(false);
  const { holdings, ready } = usePortfolio();
  const owned = ready && holdings.some((h) => h.symbol === symbol);

  return (
    <>
      <div className="flex items-center gap-2">
        {owned && (
          <Link href="/portfolio" className="text-xs font-medium text-primary hover:underline">
            Ada di portofolio
          </Link>
        )}
        <Button size="sm" variant={open ? "outline" : "default"} onClick={() => { setOpen((o) => !o); setAdded(false); }}>
          {open ? <X /> : <Plus />} {open ? "Tutup" : "Portofolio"}
        </Button>
      </div>
      {open && (
        <Card className="w-full basis-full p-4">
          {added ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-medium text-up">
                <Check className="size-4" /> {symbol} ditambahkan ke portofolio.
              </p>
              <Link href="/portfolio" className="text-sm font-medium text-primary hover:underline">
                Lihat portofolio →
              </Link>
            </div>
          ) : (
            <PortfolioForm defaultSymbol={symbol} defaultPrice={price} lockSymbol onDone={() => setAdded(true)} />
          )}
        </Card>
      )}
    </>
  );
}
