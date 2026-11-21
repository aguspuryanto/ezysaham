"use client";
import { useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface Holding {
  symbol: string;
  /** Harga beli rata-rata per lembar */
  avgPrice: number;
  /** Jumlah lembar saham (1 lot = 100 lembar) */
  shares: number;
  addedAt?: string;
}

export const LOT_SIZE = 100;
const LOCAL_KEY = "ezysaham.portfolio.v1";
const DISMISS_KEY = (uid: string) => `ezysaham.import-dismissed.${uid}`;
const TABLE = "portfolio_holdings";

export interface PortfolioState {
  /** "local" = tamu (localStorage), "remote" = login (Supabase) */
  mode: "local" | "remote";
  userId: string | null;
  holdings: Holding[];
  /** false sampai data pertama selesai dimuat */
  ready: boolean;
  syncing: boolean;
  error: string | null;
  /** Holding lokal yang bisa diimpor ke akun setelah login */
  pendingImport: Holding[];
}

const SERVER_STATE: PortfolioState = {
  mode: "local",
  userId: null,
  holdings: [],
  ready: false,
  syncing: false,
  error: null,
  pendingImport: [],
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

// ---------- store ----------
let state: PortfolioState | null = null;
const listeners = new Set<() => void>();
let loadSeq = 0;

function getState(): PortfolioState {
  // Tanpa Supabase langsung pakai localStorage; dengan Supabase tunggu attach() dari PortfolioSync
  state ??= { ...SERVER_STATE, holdings: isSupabaseConfigured ? [] : readLocal(), ready: !isSupabaseConfigured };
  return state;
}

function setState(patch: Partial<PortfolioState>) {
  state = { ...getState(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_KEY && getState().mode === "local") setState({ holdings: readLocal() });
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
  const { data, error } = await supabase
    .from(TABLE)
    .select("symbol, avg_price, shares, created_at")
    .order("created_at", { ascending: true });
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
  setState({ holdings, ready: true, syncing: false, pendingImport: dismissed ? [] : readLocal() });
}

/** Dijalankan saat status login berubah (lihat PortfolioSync). */
export function attachPortfolioUser(userId: string | null) {
  const cur = getState();
  if (!userId) {
    if (cur.mode === "local" && cur.ready) return;
    loadSeq++;
    setState({ mode: "local", userId: null, holdings: readLocal(), ready: true, syncing: false, error: null, pendingImport: [] });
    return;
  }
  if (cur.mode === "remote" && cur.userId === userId) return;
  setState({ mode: "remote", userId, holdings: [], ready: false, error: null, pendingImport: [] });
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

  clear() {
    const s = getState();
    setState({ holdings: [] });
    if (s.mode === "local") return writeLocal([]);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).delete().eq("user_id", uid));
  },

  /** Pindahkan portofolio lokal (tamu) ke akun, digabung dengan yang sudah ada. */
  async importLocal() {
    const s = getState();
    if (s.mode !== "remote" || !s.pendingImport.length) return;
    const next = s.pendingImport.reduce(merge, s.holdings);
    const touched = new Set(s.pendingImport.map((h) => h.symbol.toUpperCase()));
    setState({ holdings: next, pendingImport: [] });
    await remote((uid) =>
      getSupabaseBrowser()!
        .from(TABLE)
        .upsert(next.filter((h) => touched.has(h.symbol)).map((h) => toRow(uid, h)), { onConflict: "user_id,symbol" }),
    );
    if (!getState().error) writeLocal([]);
  },

  dismissImport() {
    const { userId } = getState();
    if (userId) {
      try {
        localStorage.setItem(DISMISS_KEY(userId), "1");
      } catch {}
    }
    setState({ pendingImport: [] });
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
