/**
 * Saham High Shareholding Concentration (HSC): 10 pemegang saham terbesar menguasai
 * ≥ 92,5% saham (per 30 Oktober 2026). Tidak lagi dihitung di IHSG mulai 13 November 2026.
 *
 * Sumber: Pengumuman BEI & KSEI No. Peng-HSC-00088/BEI.WAS/11-2026 (11 November 2026),
 * daftar 300 saham HSC baru per sektor, ditambah 83 saham HSC sebelumnya (HSC_EARLIER) — total 383.
 * Perbarui daftar ini setiap BEI menerbitkan pengumuman HSC baru.
 */
export const HSC_ANNOUNCEMENT = {
  number: "Peng-HSC-00088/BEI.WAS/11-2026",
  date: "2026-11-11",
  effective: "2026-11-13",
};

const HSC_BY_SECTOR: Record<string, string[]> = {
  "Barang Konsumen Non-Primer": [
    "ARTA", "BABY", "BATA", "BIMA", "BLTZ", "BOLT", "BRAM", "CNMA", "CSAP", "DEPO", "ECII", "ENAK", "ERTX",
    "ESTA", "ESTI", "FAST", "FORU", "GDYR", "GLOB", "GOLF", "GWSA", "HOTL", "IMAS", "INDR", "INDS", "JSPT",
    "KLIN", "LFLO", "LMPI", "MAPB", "MAPI", "MGNA", "MYTX", "NETV", "PANR", "PDES", "PJAA", "PMJS", "PMUI",
    "PNSE", "RAAM", "SCNP", "SHID", "SONA", "SSTM", "SWID", "TRIO", "TRIS", "TYRE", "UFOE", "VERN", "ZONE",
  ],
  "Barang Konsumen Primer": [
    "ANJT", "BOBA", "BUAH", "BUDI", "CAMP", "CBUT", "CEKA", "CLEO", "CRAB", "CSRA", "DAYA", "DLTA", "FISH",
    "FOOD", "FORE", "GUNA", "HERO", "HMSP", "JARR", "JAWA", "KEJU", "KINO", "MKTR", "MLBI", "NEST", "PNGO",
    "PSDN", "PSGO", "RANC", "ROTI", "SDPC", "SGRO", "SIPD", "SKBM", "SKLT", "STAA", "TCID", "TGKA", "TLDN",
    "TRGU", "VICI", "WICO",
  ],
  Keuangan: [
    "ABDA", "ADMF", "AGRS", "AMAG", "AMAR", "AMOR", "ASBI", "ASDM", "ASRM", "BBLD", "BCIC", "BDMN", "BKSW",
    "BNBA", "BNGA", "BPFI", "BPII", "BRIS", "DNAR", "GSMF", "HDFA", "LPGI", "MASB", "MCOR", "MTWI", "NISP",
    "NOBU", "OCAP", "PALM", "PNBS", "RELI", "SDRA", "SRTG", "SUPA", "TIFA", "TRUS", "VINS", "VRNA", "WOMF",
  ],
  "Barang Baku": [
    "ADMG", "AKPI", "ALMI", "APLI", "BATR", "BLES", "BRNA", "BTON", "CTBN", "DAAZ", "EKAD", "ETWA", "FASW",
    "FPNI", "GDST", "GGRP", "IFII", "IGAR", "INRU", "INTD", "IPOL", "KDSI", "KMTR", "MDKI", "MINE", "MOLI",
    "NCKL", "NICE", "PBID", "PDPP", "PTMR", "SAMF", "SMCB", "SMKL", "TALF", "TBMS", "TKIM", "YPAS",
  ],
  "Properti & Real Estat": [
    "ADCP", "AMAN", "ARGO", "BBSS", "BIKA", "CBPE", "CITY", "DART", "EMDE", "FMII", "GMTD", "GRIA", "HOMI",
    "IPAC", "JRPT", "KSIX", "LPCK", "MMLP", "MTSM", "NZIA", "OMRE", "PANI", "PLIN", "POLI", "POLL", "RDTX",
    "RODA", "SMDM", "UANG", "URBN", "VAST",
  ],
  Perindustrian: [
    "AMFG", "APII", "BINO", "BLUE", "CAKK", "CCSI", "CRSN", "HYGN", "IKBI", "JECC", "KBLM", "KIAS", "KOBX",
    "KOIN", "LION", "MFMI", "MLIA", "SCCO", "SKRN", "SMIL", "SOSS", "TIRA", "TOTO", "VOKS", "ZBRA",
  ],
  Infrastruktur: [
    "ACST", "BUKK", "CASS", "CDIA", "CENT", "GHON", "GMFI", "GOLD", "IBST", "IDPR", "IPCM", "LINK", "META",
    "PBSA", "PGEO", "PORT", "PTPW", "RONY", "SUPR", "WIKA",
  ],
  Energi: [
    "BBRM", "BESS", "BOAT", "BSSR", "CANI", "DWGL", "GTBO", "HITS", "KOPI", "MBAP", "MBSS", "MKAP", "MYOH",
    "PSAT", "PSSI", "PTIS", "SUNI", "SURE", "TAMU",
  ],
  Kesehatan: [
    "DVLA", "HALO", "IKPM", "INAF", "KAEF", "MDLA", "MERK", "MTMH", "OMED", "PEVE", "RSCH", "RSGK", "SCPI", "TSPC",
  ],
  "Transportasi & Logistik": [
    "AKSI", "BLOG", "BPTR", "CMPP", "GIAA", "GTRA", "IMJS", "LRNA", "MPXL", "NELY", "SAPX", "TRJA",
  ],
  Teknologi: ["AREA", "AWAN", "AXIO", "CASH", "EDGE", "MSTI", "PTSN", "ZYRX"],
};

/**
 * 83 saham HSC yang sudah ditetapkan sebelum pengumuman 11 November 2026 (dikeluarkan dari
 * IHSG mulai 2 November 2026), termasuk MKNT yang ditambahkan 6 November 2026.
 * Sumber: CNBC Indonesia (7 Nov 2026) & Kontan (9 Nov 2026), keduanya memuat 83 kode yang sama.
 */
const HSC_EARLIER = [
  "ADES", "AGAR", "AGII", "ALII", "ALKA", "BAJA", "BALI", "BBHI", "BBMD", "BBSI", "BDKR", "BELI", "BIKE",
  "BINA", "BKDP", "BMAS", "BNII", "BNLI", "BREN", "BSWD", "BTPN", "BYAN", "CITA", "CLAY", "CMNP", "CMNT",
  "DCII", "DGWG", "DMND", "DNET", "DSSA", "DUTI", "ELPI", "EPMT", "FAPA", "FILM", "FITT", "GEMS", "HATM",
  "IFSH", "INDO", "INPP", "KING", "KONI", "LIFE", "MAYA", "MCOL", "MDIA", "MEGA", "MGRO", "MKNT", "MKPI",
  "MLPT", "MORA", "MPRO", "MSJA", "MTEL", "NICK", "PGUN", "POLU", "PRAY", "PSAB", "RISE", "RLCO", "ROCK",
  "SAFE", "SAME", "SATU", "SHIP", "SILO", "SMAR", "SMMT", "SOHO", "SOTS", "SRAJ", "SSMS", "STTP", "TBIG",
  "TCPI", "TFCO", "TMAS", "WBSA", "YUPI",
];

const HSC_SET = new Set([...Object.values(HSC_BY_SECTOR).flat(), ...HSC_EARLIER]);

export function isHsc(symbol: string) {
  return HSC_SET.has(symbol.toUpperCase());
}
