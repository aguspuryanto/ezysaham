"use client";
import { useSyncExternalStore } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export interface WatchItem {
  symbol: string;
  /** Catatan pribadi (fitur Pro) */
  note?: string | null;
  /** Target harga (fitur Pro) */
  targetPrice?: number | null;
  addedAt?: string;
}

const LOCAL_KEY = "ezysaham.watchlist.v1";
const TABLE = "watchlist_items";

export interface WatchlistState {
  /** "local" = tamu (localStorage), "remote" = login (Supabase) */
  mode: "local" | "remote";
  userId: string | null;
  items: WatchItem[];
  ready: boolean;
  syncing: boolean;
  error: string | null;
}

const SERVER_STATE: WatchlistState = { mode: "local", userId: null, items: [], ready: false, syncing: false, error: null };

// ---------- localStorage ----------
function readLocal(): WatchItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? (JSON.parse(raw) as WatchItem[]) : [];
    return Array.isArray(parsed) ? parsed.filter((w) => w && typeof w.symbol === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(next: WatchItem[]) {
  try {
    if (next.length) localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    else localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* storage penuh / diblokir */
  }
}

// ---------- store ----------
let state: WatchlistState | null = null;
const listeners = new Set<() => void>();
let loadSeq = 0;

function getState(): WatchlistState {
  state ??= { ...SERVER_STATE, items: isSupabaseConfigured ? [] : readLocal(), ready: !isSupabaseConfigured };
  return state;
}

function setState(patch: Partial<WatchlistState>) {
  state = { ...getState(), ...patch };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === LOCAL_KEY && getState().mode === "local") setState({ items: readLocal() });
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

interface Row {
  symbol: string;
  note: string | null;
  target_price: number | string | null;
  created_at: string;
}

const toRow = (uid: string, w: WatchItem) => ({
  user_id: uid,
  symbol: w.symbol,
  note: w.note || null,
  target_price: w.targetPrice || null,
});

async function loadRemote(uid: string) {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const seq = ++loadSeq;
  setState({ syncing: true, error: null });

  // Watchlist tamu di browser ini otomatis dipindah ke akun (risiko rendah, tak perlu konfirmasi)
  const local = readLocal();
  if (local.length) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(local.map((w) => toRow(uid, w)), { onConflict: "user_id,symbol", ignoreDuplicates: true });
    if (!error) writeLocal([]);
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("symbol, note, target_price, created_at")
    .order("created_at", { ascending: true });
  if (seq !== loadSeq || getState().userId !== uid) return; // user sudah berganti
  if (error) {
    setState({ syncing: false, ready: true, error: `Gagal memuat watchlist: ${error.message}` });
    return;
  }
  const items = (data as Row[]).map((r) => ({
    symbol: r.symbol,
    note: r.note,
    targetPrice: r.target_price == null ? null : Number(r.target_price),
    addedAt: r.created_at,
  }));
  setState({ items, ready: true, syncing: false });
}

/** Dijalankan saat status login berubah (lihat PortfolioSync). */
export function attachWatchlistUser(userId: string | null) {
  const cur = getState();
  if (!userId) {
    if (cur.mode === "local" && cur.ready) return;
    loadSeq++;
    setState({ mode: "local", userId: null, items: readLocal(), ready: true, syncing: false, error: null });
    return;
  }
  if (cur.mode === "remote" && cur.userId === userId) return;
  setState({ mode: "remote", userId, items: [], ready: false, error: null });
  void loadRemote(userId);
}

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
  has(symbol: string) {
    return getState().items.some((w) => w.symbol === symbol.toUpperCase());
  },

  add(symbol: string) {
    const s = getState();
    const sym = symbol.toUpperCase();
    if (s.items.some((w) => w.symbol === sym)) return;
    const item: WatchItem = { symbol: sym, addedAt: new Date().toISOString() };
    const next = [...s.items, item];
    setState({ items: next });
    if (s.mode === "local") return writeLocal(next);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).upsert(toRow(uid, item), { onConflict: "user_id,symbol" }));
  },

  remove(symbol: string) {
    const s = getState();
    const sym = symbol.toUpperCase();
    const next = s.items.filter((w) => w.symbol !== sym);
    setState({ items: next });
    if (s.mode === "local") return writeLocal(next);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).delete().eq("user_id", uid).eq("symbol", sym));
  },

  toggle(symbol: string) {
    if (actions.has(symbol)) actions.remove(symbol);
    else actions.add(symbol);
  },

  /** Ubah catatan / target harga (fitur Pro, hanya untuk akun login). */
  update(symbol: string, patch: Pick<WatchItem, "note" | "targetPrice">) {
    const s = getState();
    const next = s.items.map((w) => (w.symbol === symbol ? { ...w, ...patch } : w));
    setState({ items: next });
    if (s.mode === "local") return writeLocal(next);
    void remote((uid) =>
      getSupabaseBrowser()!
        .from(TABLE)
        .update({ note: patch.note || null, target_price: patch.targetPrice || null })
        .eq("user_id", uid)
        .eq("symbol", symbol),
    );
  },

  clear() {
    const s = getState();
    setState({ items: [] });
    if (s.mode === "local") return writeLocal([]);
    void remote((uid) => getSupabaseBrowser()!.from(TABLE).delete().eq("user_id", uid));
  },

  retry() {
    const { userId } = getState();
    if (userId) void loadRemote(userId);
  },
};

export function useWatchlist() {
  const s = useSyncExternalStore(subscribe, getState, () => SERVER_STATE);
  return { ...s, ...actions };
}
