"use client";
import { useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { saleFees } from "@/lib/fees";

export interface Holding {
  symbol: string;
  /** Harga beli rata-rata per lembar */
  avgPrice: number;
  /** Jumlah lembar saham (1 lot = 100 lembar) */
  shares: number;
  addedAt?: string;
}

/** Satu transaksi jual (riwayat untung/rugi terealisasi). */
export interface Sale {
  id: string;
  symbol: string;
  shares: number;
  /** Harga beli rata-rata saat dijual (tanpa fee) */
  buyPrice: number;
  sellPrice: number;
  buyFee: number;
  sellFee: number;
  soldAt: string;
}

export const LOT_SIZE = 100;
const LOCAL_KEY = "ezysaham.portfolio.v1";
const LOCAL_SALES_KEY = "ezysaham.portfolio.sales.v1";
const SALES_TABLE = "portfolio_sales";
const DISMISS_KEY = (uid: string) => `ezysaham.import-dismissed.${uid}`;
const TABLE = "portfolio_holdings";

export interface PortfolioState {
  /** "local" = tamu (localStorage), "remote" = login (Supabase) */
  mode: "local" | "remote";
  userId: string | null;
  holdings: Holding[];
  /** Riwayat penjualan, terbaru di atas */
  sales: Sale[];
  /** false sampai data pertama selesai dimuat */
  ready: boolean;
  syncing: boolean;
  error: string | null;
  /** Holding lokal yang bisa diimpor ke akun setelah login */
  pendingImport: Holding[];
  /** Riwayat penjualan lokal yang ikut diimpor */
  pendingSales: Sale[];
}

const SERVER_STATE: PortfolioState = {
  mode: "local",
  userId: null,
  holdings: [],
  sales: [],
  ready: false,
  syncing: false,
  error: null,
  pendingImport: [],
  pendingSales: [],
};

// ---------- localStorage ----------
function readLocal(): Holding[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as Holding[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((h) => h && typeof h.symbol === "string" && h.shares > 0 && h.avgPrice > 0)
      : [];
  } catch {
    return [];
  }
}

function writeLocal(next: Holding[]) {
  try {
    if (next.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage penuh / diblokir */
  }
}

const bySoldAtDesc = (a: Sale, b: Sale) => b.soldAt.localeCompare(a.soldAt);

function readLocalSales(): Sale[] {
  try {
    const raw = localStorage.getItem(LOCAL_SALES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Sale[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => x && typeof x.id === "string" && x.shares > 0 && x.sellPrice > 0).sort(bySoldAtDesc)
      : [];
  } catch {
    return [];
  }
}

function writeLocalSales(next: Sale[]) {
  try {
    if (next.length) localStorage.setItem(LOCAL_SALES_KEY, JSON.stringify(next));
    else localStorage.removeItem(LOCAL_SALES_KEY);
  } catch {
    /* storage penuh / diblokir */
  }
}

// ---------- store ----------
let state: PortfolioState | null = null;
const listeners = new Set<() => void>();
let loadSeq = 0;

function getState(): PortfolioState {
  // Tanpa Supabase langsung pakai localStorage; dengan Supabase tunggu attach() dari PortfolioSync
  state ??= {
    ...SERVER_STATE,
    holdings: isSupabaseConfigured ? [] : readLocal(),
    sales: isSupabaseConfigured ? [] : readLocalSales(),
    ready: !isSupabaseConfigured,
  };
  return state;
}

function setState(patch: Partial<PortfolioState>) {
  state = { ...getState(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (getState().mode !== "local") return;
    if (e.key === LOCAL_KEY) setState({ holdings: readLocal() });
    if (e.key === LOCAL_SALES_KEY) setState({ sales: readLocalSales() });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

/** Gabungkan pembelian ke daftar holding (harga rata-rata tertimbang). */
function merge(list: Holding[], h: Holding): Holding[] {
  const symbol = h.symbol.toUpperCase();
  const existing = list.find((x) => x.symbol === symbol);
  if (!existing) return [...list, { ...h, symbol, addedAt: h.addedAt ?? new Date().toISOString() }];
  const shares = existing.shares + h.shares;
  const avgPrice = (existing.avgPrice * existing.shares + h.avgPrice * h.shares) / shares;
  return list.map((x) => (x.symbol === symbol ? { ...x, shares, avgPrice } : x));
}

interface Row {
  symbol: string;
  avg_price: number | string;
  shares: number | string;
  created_at: string;
}

interface SaleRow {
  id: string;
  symbol: string;
  shares: number | string;
  buy_price: number | string;
  sell_price: number | string;
  buy_fee: number | string;
  sell_fee: number | string;
  sold_at: string;
}

const fromSaleRow = (r: SaleRow): Sale => ({
  id: r.id,
  symbol: r.symbol,
  shares: Number(r.shares),
  buyPrice: Number(r.buy_price),
  sellPrice: Number(r.sell_price),
  buyFee: Number(r.buy_fee),
  sellFee: Number(r.sell_fee),
  soldAt: r.sold_at,
});

const toSaleRow = (uid: string, s: Sale) => ({
  id: s.id,
  user_id: uid,
  symbol: s.symbol,
  shares: s.shares,
  buy_price: s.buyPrice,
  sell_price: s.sellPrice,
  buy_fee: s.buyFee,
  sell_fee: s.sellFee,
  sold_at: s.soldAt,
});

const toRow = (uid: string, h: Holding) => ({
  user_id: uid,
  symbol: h.symbol,
  avg_price: h.avgPrice,
  shares: h.shares,
});

async function loadRemote(uid: string) {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const seq = ++loadSeq;
  setState({ syncing: true, error: null });
  const [{ data, error }, salesRes] = await Promise.all([
    supabase.from(TABLE).select("symbol, avg_price, shares, created_at").order("created_at", { ascending: true }),
    supabase
      .from(SALES_TABLE)
      .select("id, symbol, shares, buy_price, sell_price, buy_fee, sell_fee, sold_at")
      .order("sold_at", { ascending: false }),
  ]);
  if (seq !== loadSeq || getState().userId !== uid) return; // user sudah berganti
  if (error) {
    setState({ syncing: false, ready: true, error: `Gagal memuat portofolio: ${error.message}` });
    return;
  }
  const holdings = (data as Row[]).map((r) => ({
    symbol: r.symbol,
    avgPrice: Number(r.avg_price),
    shares: Number(r.shares),
    addedAt: r.created_at,
  }));
  let dismissed = false;
  try {
    dismissed = localStorage.getItem(DISMISS_KEY(uid)) === "1";
  } catch {}
  setState({
    holdings,
    sales: salesRes.error ? [] : (salesRes.data as SaleRow[]).map(fromSaleRow),
    ready: true,
    syncing: false,
    // Tabel riwayat yang belum dibuat (migrasi 0005) tidak boleh menghalangi portofolio tampil
    ...(salesRes.error ? { error: `Gagal memuat riwayat penjualan: ${salesRes.error.message}` } : {}),
    pendingImport: dismissed ? [] : readLocal(),
    pendingSales: dismissed ? [] : readLocalSales(),
  });
}

/** Dijalankan saat status login berubah (lihat PortfolioSync). */
export function attachPortfolioUser(userId: string | null) {
  const cur = getState();
  if (!userId) {
    if (cur.mode === "local" && cur.ready) return;
    loadSeq++;
    setState({
      mode: "local",
      userId: null,
      holdings: readLocal(),
      sales: readLocalSales(),
      ready: true,
      syncing: false,
      error: null,
      pendingImport: [],
      pendingSales: [],
    });
    return;
  }
  if (cur.mode === "remote" && cur.userId === userId) return;
  setState({ mode: "remote", userId, holdings: [], sales: [], ready: false, error: null, pendingImport: [], pendingSales: [] });
  void loadRemote(userId);
}

/** Jalankan operasi Supabase secara optimistis; bila gagal, tampilkan error & muat ulang dari server. */
async function remote(op: (uid: string) => PromiseLike<{ error: { message: string } | null }>) {
  const { userId } = getState();
  if (!userId) return;
  setState({ syncing: true, error: null });
  const { error } = await op(userId);
  if (error) {
    setState({ error: `Gagal menyimpan: ${error.message}` });
    await loadRemote(userId);
  } else {
    setState({ syncing: false });
  }
}

const actions = {
  /** Tambah pembelian. Bila saham sudah ada, harga rata-rata dihitung ulang. */
  addHolding(h: Holding) {
    const s = getState();
    const next = merge(s.holdings, h);
    setState({ holdings: next });
    if (s.mode === "local") return writeLocal(next);
    const row = next.find((x) => x.symbol === h.symbol.toUpperCase())!;
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).upsert(toRow(uid, row), { onConflict: "user_id,symbol" }));
  },

  updateHolding(symbol: string, patch: Partial<Omit<Holding, "symbol">>) {
    const s = getState();
    const next = s.holdings.map((x) => (x.symbol === symbol ? { ...x, ...patch } : x));
    setState({ holdings: next });
    if (s.mode === "local") return writeLocal(next);
    const row = next.find((x) => x.symbol === symbol);
    if (!row) return;
    void remote((uid) =>
      getSupabaseBrowser()!.from(TABLE).update({ avg_price: row.avgPrice, shares: row.shares }).eq("user_id", uid).eq("symbol", symbol),
    );
  },

  removeHolding(symbol: string) {
    const s = getState();
    const next = s.holdings.filter((x) => x.symbol !== symbol);
    setState({ holdings: next });
    if (s.mode === "local") return writeLocal(next);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).delete().eq("user_id", uid).eq("symbol", symbol));
  },

  /**
   * Jual sebagian/seluruh saham. Penjualan dicatat ke riwayat (dengan fee beli & jual) lalu
   * jumlah lembar dikurangi; bila terjual semua, saham hilang dari daftar kepemilikan.
   * Mengembalikan pesan error, atau null bila berhasil.
   */
  sellHolding(symbol: string, shares: number, sellPrice: number, soldAt: string): string | null {
    const s = getState();
    const h = s.holdings.find((x) => x.symbol === symbol);
    if (!h) return `Saham ${symbol} tidak ada di portofolio.`;
    if (!(shares > 0) || shares > h.shares) return "Jumlah jual melebihi kepemilikan.";
    if (!(sellPrice > 0)) return "Harga jual harus lebih dari 0.";
    const sale: Sale = {
      id: crypto.randomUUID(),
      symbol,
      shares,
      buyPrice: h.avgPrice,
      sellPrice,
      ...saleFees(shares, h.avgPrice, sellPrice),
      soldAt,
    };
    const holdings =
      shares === h.shares
        ? s.holdings.filter((x) => x.symbol !== symbol)
        : s.holdings.map((x) => (x.symbol === symbol ? { ...x, shares: x.shares - shares } : x));
    const sales = [sale, ...s.sales].sort(bySoldAtDesc);
    setState({ holdings, sales });
    if (s.mode === "local") {
      writeLocal(holdings);
      writeLocalSales(sales);
      return null;
    }
    // Atomik di server: catat penjualan + kurangi holding dalam satu transaksi
    void remote(() =>
      getSupabaseBrowser()!.rpc("sell_holding", {
        p_id: sale.id,
        p_symbol: symbol,
        p_shares: shares,
        p_sell_price: sellPrice,
        p_buy_fee: sale.buyFee,
        p_sell_fee: sale.sellFee,
        p_sold_at: soldAt,
      }),
    );
    return null;
  },

  /** Hapus satu catatan penjualan (mis. salah input). Kepemilikan tidak dikembalikan. */
  removeSale(id: string) {
    const s = getState();
    const sales = s.sales.filter((x) => x.id !== id);
    setState({ sales });
    if (s.mode === "local") return writeLocalSales(sales);
    void remote((uid) => getSupabaseBrowser()!.from(SALES_TABLE).delete().eq("user_id", uid).eq("id", id));
  },

  clear() {
    const s = getState();
    setState({ holdings: [] });
    if (s.mode === "local") return writeLocal([]);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).delete().eq("user_id", uid));
  },

  /** Pindahkan portofolio lokal (tamu) ke akun, digabung dengan yang sudah ada. */
  async importLocal() {
    const s = getState();
    if (s.mode !== "remote" || (!s.pendingImport.length && !s.pendingSales.length)) return;
    const next = s.pendingImport.reduce(merge, s.holdings);
    const touched = new Set(s.pendingImport.map((h) => h.symbol.toUpperCase()));
    const known = new Set(s.sales.map((x) => x.id));
    const newSales = s.pendingSales.filter((x) => !known.has(x.id));
    setState({ holdings: next, sales: [...newSales, ...s.sales].sort(bySoldAtDesc), pendingImport: [], pendingSales: [] });
    if (touched.size) {
      await remote((uid) =>
        getSupabaseBrowser()!
          .from(TABLE)
          .upsert(next.filter((h) => touched.has(h.symbol)).map((h) => toRow(uid, h)), { onConflict: "user_id,symbol" }),
      );
      if (getState().error) return;
    }
    if (newSales.length) {
      await remote((uid) =>
        getSupabaseBrowser()!
          .from(SALES_TABLE)
          .upsert(newSales.map((x) => toSaleRow(uid, x)), { onConflict: "id", ignoreDuplicates: true }),
      );
      if (getState().error) return;
    }
    writeLocal([]);
    writeLocalSales([]);
  },

  dismissImport() {
    const { userId } = getState();
    if (userId) {
      try {
        localStorage.setItem(DISMISS_KEY(userId), "1");
      } catch {}
    }
    setState({ pendingImport: [], pendingSales: [] });
  },

  retry() {
    const { userId } = getState();
    if (userId) void loadRemote(userId);
  },
};

export function usePortfolio() {
  const s = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  return { ...s, ...actions };
}
