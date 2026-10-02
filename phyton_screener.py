import io
import requests
import pandas as pd
import yfinance as yf
from datetime import datetime

# ==========================================
# 1. AMBIL DAFTAR SAHAM BEI DARI PASARDANA API
# ==========================================
def get_idx_stock_list():
    url = "https://pasardana.id/api/StockSearchResult/GetAll?pageBegin=0&pageLength=1000&sortField=Code&sortOrder=ASC"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()
            # Ekstrak kode saham dan tambahkan '.JK' untuk format Yahoo Finance
            stocks = [item['Code'] + '.JK' for item in data.get('Data', [])]
            return stocks
    except Exception as e:
        print(f"Gagal mengambil daftar saham dari Pasardana: {e}")
    
    # Fallback daftar saham utama jika API gagal
    return ["BBCA.JK", "BBRI.JK", "BMRI.JK", "BBNI.JK", "ADRO.JK", "PTBA.JK", "ASII.JK", "TLKM.JK"]

# ==========================================
# 2. FUNGSI ANALISIS TEKNIKAL & EOD SCREENER
# ==========================================
def analyze_stock(ticker):
    try:
        # Tarik data EOD 6 bulan terakhir via Yahoo Finance
        stock = yf.Ticker(ticker)
        df = stock.history(period="6mo", interval="1d")
        
        if df.empty or len(df) < 50:
            return None
        
        # Hitung indikator teknikal
        df['EMA_20'] = df['Close'].ewm(span=20, adjust=False).mean()
        df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
        df['Volume_MA20'] = df['Volume'].rolling(window=20).mean()
        df['RVOL'] = df['Volume'] / df['Volume_MA20']
        df['Daily_Return'] = df['Close'].pct_change() * 100
        
        # Ambil data hari terakhir (EOD)
        latest = df.iloc[-1]
        prev = df.iloc[-2]
        
        # Range harian & posisi close
        daily_range = latest['High'] - latest['Low']
        close_position = (latest['Close'] - latest['Low']) / daily_range if daily_range > 0 else 0
        
        # Info Fundamental sederhana dari info yfinance (jika tersedia)
        info = stock.info
        dividend_yield = info.get('dividendYield', 0) or 0
        dividend_yield_pct = dividend_yield * 100
        roe = info.get('returnOnEquity', 0) or 0
        roe_pct = roe * 100
        per = info.get('trailingPE', 999) or 999
        pbv = info.get('priceToBook', 999) or 999

        data_row = {
            "Ticker": ticker.replace(".JK", ""),
            "Close": latest['Close'],
            "Volume": latest['Volume'],
            "RVOL": latest['RVOL'],
            "Close_Range_Pct": close_position * 100,
            "Daily_Change_Pct": latest['Daily_Return'],
            "EMA_20": latest['EMA_20'],
            "EMA_50": latest['EMA_50'],
            "Dividend_Yield": dividend_yield_pct,
            "ROE": roe_pct,
            "PER": per,
            "PBV": pbv
        }
        return data_row
    except Exception as e:
        return None

# ==========================================
# 3. UTAMA: RUN SCREENING & PEMISAHAN AKUN
# ==========================================
def main():
    print("🔄 Mengambil daftar saham BEI...")
    tickers = get_idx_stock_list()
    print(f"Total emiten ditemukan: {len(tickers)}. Memulai analisis EOD...\n")
    
    results = []
    # Batasi sampel untuk pengujian cepat (bisa dihapus [[:50]] jika ingin scan seluruh BEI)
    # for ticker in tickers[:50]: 
    for ticker in tickers: 
        res = analyze_stock(ticker)
        if res:
            results.append(res)
            
    df_all = pd.DataFrame(results)
    if df_all.empty:
        print("Tidak ada data yang berhasil dianalisis.")
        return

    # ------------------------------------------
    # 🎯 KATEGORI 1: POTENSI LONJAKAN HARIAN (>10%, dll)
    # ------------------------------------------
    df_spike = df_all[
        (df_all['RVOL'] >= 2.5) & 
        (df_all['Close_Range_Pct'] >= 80) &
        (df_all['Daily_Change_Pct'] > 3.0)
    ]
    
    # ------------------------------------------
    # 🎯 KATEGORI 2: SWING TRADING (1-5 HARI)
    # ------------------------------------------
    df_swing = df_all[
        (df_all['Close'] >= df_all['EMA_20']) & 
        (df_all['Close'] >= df_all['EMA_50']) &
        (df_all['Daily_Change_Pct'] > -3.0) & 
        (df_all['Daily_Change_Pct'] < 3.0) # Konsolidasi/Pullback sehat
    ]

    # ------------------------------------------
    # 🎯 KATEGORI 3: DIVIDEND INVESTING (Target Yield Tinggi)
    # ------------------------------------------
    df_dividend = df_all[
        (df_all['Dividend_Yield'] >= 5.0) & 
        (df_all['ROE'] >= 12.0) & 
        (df_all['PER'] > 0) & (df_all['PER'] <= 15.0) &
        (df_all['PBV'] <= 2.5)
    ]

    # ==========================================
    # 📋 LAPORAN & DISIPLIN SEKTOR / AKUN
    # ==========================================
    print("=" * 60)
    print("🚨 [AKUN 1] TRADING HARIAN & SWING (Fokus Likuiditas & Volatilitas)")
    print("=" * 60)
    print("\n--- Potensi Lonjakan / Breakout (RVOL Tinggi & Close Kuat) ---")
    print(df_spike[['Ticker', 'Close', 'RVOL', 'Daily_Change_Pct']].to_string(index=False) if not df_spike.empty else "Tidak ada saham yang memenuhi kriteria.")
    
    print("\n--- Kandidat Swing Trading (Trend Sehat / Pullback Support) ---")
    print(df_swing[['Ticker', 'Close', 'EMA_20', 'Daily_Change_Pct']].head(5).to_string(index=False) if not df_swing.empty else "Tidak ada saham yang memenuhi kriteria.")

    print("\n" + "=" * 60)
    print("💰 [AKUN 2] DIVIDEND INVESTING (Fokus Arus Kas & Fundamental Jangka Panjang)")
    print("=" * 60)
    print(df_dividend[['Ticker', 'Close', 'Dividend_Yield', 'ROE', 'PER', 'PBV']].to_string(index=False) if not df_dividend.empty else "Tidak ada saham yang memenuhi kriteria.")

if __name__ == "__main__":
    main()