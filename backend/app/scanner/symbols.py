"""Curated symbol watchlist for the Tram Scanner Engine."""

MAJORS = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT", "XRPUSDT",
    "ADAUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "TRXUSDT",
]

LAYER_1_2 = [
    "SUIUSDT", "APTUSDT", "NEARUSDT", "TONUSDT", "ATOMUSDT",
    "ARBUSDT", "OPUSDT", "POLUSDT", "SEIUSDT", "INJUSDT",
    "TIAUSDT", "STXUSDT", "IMXUSDT", "HBARUSDT", "LTCUSDT",
    "BCHUSDT", "XLMUSDT", "ETCUSDT", "ALGOUSDT",
]
AI_AND_DEPIN = [
    "RENDERUSDT", "FETUSDT", "TAOUSDT", "ARUSDT", "GRTUSDT",
    "FILUSDT", "WLDUSDT", "ICPUSDT",
]

DEFI_AND_RWA = [
    "ONDOUSDT", "PENDLEUSDT", "AAVEUSDT", "UNIUSDT", "LDOUSDT",
    "JUPUSDT", "ENAUSDT",
]

MEME_AND_HIGH_BETA = [
    "DOGEUSDT", "PEPEUSDT", "WIFUSDT", "SHIBUSDT", "BONKUSDT",
    "FLOKIUSDT",
]

# Gabungkan semua kategori & hapus duplikat tanpa mengubah urutan
SCANNER_SYMBOLS: list[str] = list(
    dict.fromkeys(
        MAJORS
        + LAYER_1_2
        + AI_AND_DEPIN
        + DEFI_AND_RWA
        + MEME_AND_HIGH_BETA
    )
)