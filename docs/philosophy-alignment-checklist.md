# Checklist: Kesesuaian Screener vs Filosofi EzySaham

> Audit read-only. Tidak ada perubahan kode dalam dokumen ini.

## Filosofi yang diaudit

> **"Apakah saham ini layak dibeli hari ini?"** — dijawab dalam bahasa manusia, bukan 50 indikator.
>
> Setiap kali dibuka, AI menganalisis hampir 1.000 saham BEI dan memilih sekitar 20–30 saham
> dengan setup terbaik untuk dipantau. Untuk tiap pilihan, AI menjelaskan alasan pemilihannya,
> level support–resistance, potensi risiko, serta skenario bullish maupun bearish — keputusan
> akhir tetap di tangan investor.
>
> — sumber: `src/presentation/features/screener/components/PhilosophyBanner.tsx`

## Ringkasan

| Status | Jumlah |
| --- | --- |
| ✅ Sesuai | 1 |
| ⚠️ Sebagian | 4 |
| ❌ Belum | 4 |

## Detail checklist

### a. Satu jawaban sederhana "layak dibeli hari ini?" per saham (bahasa manusia, bukan angka mentah)

**Status: ❌ Belum**

`ResultsTable.tsx` menampilkan per baris terutama angka mentah: skor komposit, % perubahan,
harga, volume, kap pasar, P/E, sektor (`ResultsTable.tsx:677-755`). Tidak ada satu kalimat
kesimpulan bahasa manusia per saham di list/kartu screener.

- Bukti: `src/presentation/features/screener/components/ResultsTable.tsx:677-755`

### b. AI memilih ~20-30 dari ~1000 saham (kurasi otomatis, bukan filter manual)

**Status: ❌ Belum**

Tidak ditemukan implementasi kurasi otomatis "20-30 saham terbaik hari ini". Pencarian untuk
"top pick / rekomendasi hari ini / curated / default preset" hanya match di teks marketing
banner, bukan di kode fungsional. User harus memilih preset/filter secara manual dari seluruh
saham.

- Bukti: `src/presentation/features/screener/components/PhilosophyBanner.tsx:103` (klaim, teks saja)
- Tidak ada file implementasi yang cocok ditemukan di `src/presentation/features/screener/` atau `src/domain/screener/`

### c. Alasan pemilihan dijelaskan (bahasa manusia, per kondisi terpenuhi)

**Status: ⚠️ Sebagian**

`TriggerChecklist` sudah menyurfacekan `reasons[]`/`failed[]` sebagai checklist
"X/Y kondisi terpenuhi" — searah dengan filosofi. Tapi hanya muncul untuk preset rule-based
(mis. momentum/ara/bpjs) yang menghasilkan `reasons`/`failed`, dan **tidak muncul** di view
"Semua" tanpa filter.

- Bukti: `src/presentation/features/screener/components/ResultsTable.tsx:153-178`
- Bukti gap (tidak muncul di view tanpa filter): `ResultsTable.tsx:574-577`

### d. Level support-resistance ditampilkan

**Status: ⚠️ Sebagian**

Dihitung lengkap (`SupportResistanceAnalysis.resistances`/`supports`) oleh
`stockAnalysisEngine.ts`, tapi hanya tampil di halaman detail per-ticker
(`/screener/[ticker]`), tidak muncul di baris/kartu screener list.

- Bukti model: `src/domain/models/StockAnalysis.ts:20-30`
- Bukti konsumsi hanya di detail page: `src/presentation/features/analysis/StockAnalysisPage.tsx` (via `useStockAnalysis.ts`)

### e. Potensi risiko dijelaskan

**Status: ⚠️ Sebagian**

`ConclusionAnalysis.watchOut` (peringatan risiko naratif) dan `objectiveConclusion.ts`
(cross-check divergensi fundamental-vs-teknikal, Bandar Detector, berita UMA/regulasi) sudah
ada, tapi lagi-lagi hanya di halaman detail. Di list screener, hanya `BreakoutBadge` yang punya
field `distributionRisk` — itu pun angka/label singkat, bukan narasi risiko.

- Bukti: `src/domain/models/StockAnalysis.ts:103-109` (`watchOut`)
- Bukti: `src/domain/analysis/objectiveConclusion.ts`
- Bukti partial di list: `BreakoutBadge` (`src/presentation/features/screener/components/ResultsTable.tsx`, field `distributionRisk`)

### f. Skenario bullish & bearish ditampilkan

**Status: ⚠️ Sebagian**

`TradingPlanAnalysis.bullish`/`.bearish` (entry/TP/SL/RR untuk kedua skenario) dihitung lengkap
di `stockAnalysisEngine.ts`, tapi hanya di halaman detail. Di screener list, `TradingPlanBadge`
hanya menampilkan satu rencana (buy area, avg-down, SL, TP1, R/R) tanpa memisahkan skenario
bullish vs bearish secara eksplisit.

- Bukti: `src/domain/models/StockAnalysis.ts:85-100`
- Bukti list hanya 1 skenario: `TradingPlanBadge` di `ResultsTable.tsx`

### g. Kesimpulan aksi eksplisit (mis. "cocok swing, kurang ideal scalping")

**Status: ❌ Belum**

Contoh chip "💬 Kesimpulan" di banner adalah hardcoded (`EXAMPLE_POINTS`,
`PhilosophyBanner.tsx:17-42`, chip di baris 137-148) — bukan data live. `ConclusionAnalysis`
di `stockAnalysisEngine.ts` menghasilkan `summary`/`tradingNote` yang mirip, tapi hanya
tersedia di halaman detail per-ticker, tidak ada kesimpulan swing-vs-scalping di list screener.

- Bukti hardcoded: `src/presentation/features/screener/components/PhilosophyBanner.tsx:17-42, 137-148`
- Bukti live tapi hanya di detail: `src/domain/models/StockAnalysis.ts:103-109`

### h. Konsistensi satu jawaban (tidak berubah-ubah tergantung preset yang dipilih)

**Status: ❌ Belum**

Ditemukan 5 mesin skor independen dengan bobot & label verdict berbeda:

- `technicalScore.ts` → `computeTechnicalScore()`: STRONG BUY/BUY/WATCHLIST/HOLD/AVOID (ambang 70/60/50/40)
- `presets.ts` → `computeBreakoutScores()`: BUY_WATCH/WATCH (ambang 68/55)
- `presets.ts` → `computeTradingPlanScore()`: skor "Opportunity" (ambang 90/80/70/60)
- `presets.ts` → `computeAraProbability()`: probabilitas 4-dimensi
- `aiStockEngine.ts` → `computeAiStockAdvisor()`: SANGAT_BELI/BELI/TAHAN/HINDARI (ambang 78/62/45, bobot Teknikal 35%/Fundamental 30%/Breakout 20%/Berita 15%)

Saham yang sama bisa mendapat label berbeda tergantung preset yang dipilih user — bertolak
belakang dengan janji "satu pertanyaan sederhana, satu jawaban".

- Bukti: `src/domain/analysis/technicalScore.ts:40-142`, `src/domain/screener/presets.ts:631-906`, `src/domain/analysis/aiStockEngine.ts:267-459`

### i. Transparansi soal "AI" vs logika rule-based

**Status: ✅ Sesuai (fungsional), catatan copy**

Tidak ada masalah fungsional — seluruh scoring/narasi adalah logika deterministik rule-based
TypeScript yang bisa diaudit dan konsisten (bukan LLM yang bisa halusinasi). Namun penamaan
"AI menganalisis... AI menjelaskan alasan" di banner, serta byline artikel blog
"Tim EzySaham AI", tidak mencerminkan adanya integrasi AI/LLM yang sebenarnya — tidak
ditemukan pemanggilan API AI/LLM di seluruh `src/` maupun `package.json`. Ini bukan gap
fungsional, tapi berpotensi menyesatkan ekspektasi user soal bagaimana analisis dihasilkan.

- Bukti: pencarian menyeluruh untuk `openai`/`anthropic`/`gpt`/`claude`/`llm`/`gemini` di `src/` dan `package.json` — nihil.

## Catatan tambahan (di luar checklist inti)

Artikel `content/blog/analisa-saham-*.md` (PTBA, PPRI, DSSA, DMAS, dll.) sebenarnya memenuhi
sebagian besar janji filosofi secara naratif (ringkasan, S/R, bullish/bearish, kesimpulan) —
tapi ditulis manual per artikel, tidak auto-generated dari ~1000 saham, dan tidak
type-linked ke live engine (`stockAnalysisEngine.ts`), sehingga angka/level di artikel bisa
drift dari data real-time yang dihitung ulang setiap hari.

- Bukti: `src/lib/blog.ts` (parsing Markdown via `gray-matter`/`marked`, schema `BlogPostMeta` hanya `title, description, date, author?, cover?, embedTicker?`)
