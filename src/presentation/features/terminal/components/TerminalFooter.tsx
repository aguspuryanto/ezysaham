export function TerminalFooter({ lastUpdatedAt }: { lastUpdatedAt: Date | null }) {
  return (
    <div className="flex flex-col items-center justify-between gap-1 border-t border-(--term-border) px-4 py-3 text-[11px] text-(--term-muted) sm:flex-row sm:px-5">
      <span>© {new Date().getFullYear()} EzySaham. Data EOD Bursa Efek Indonesia — bukan rekomendasi jual/beli.</span>
      {lastUpdatedAt && (
        <span className="font-terminal-mono">
          Data diperbarui {lastUpdatedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
        </span>
      )}
    </div>
  );
}
