"""Tram Backend - Core Configuration."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigModel


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    app_env: str = "development"
    app_debug: bool = False
    app_name: str = "Tram API"
    app_version: str = "0.1.0"
    cors_origins: str = "http://localhost:3000"

    # Database - Supabase (for Auth only)
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    # Database - Oracle Autonomous Database (Primary Data)
    oracle_db_user: str = "admin"
    oracle_db_password: str = ""
    oracle_db_dsn: str = ""  # e.g., "tradingdb_high?TNS_ADMIN=/opt/oracle_wallet"
    oracle_wallet_path: str = "/opt/oracle_wallet"

    # Binance
    binance_api_key: str = ""
    binance_api_secret: str = ""
    binance_rest_base_url: str = "https://data-api.binance.vision/api/v3"
    binance_ws_base_url: str = "wss://data-stream.binance.vision/stream"
    binance_proxy_url: str = ""

    # Telegram
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""

    # JWT
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24

    # Scanner
    scanner_symbols: str = "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,ADAUSDT,XRPUSDT,DOTUSDT,DOGEUSDT,AVAXUSDT,MATICUSDT"
    scanner_timeframes: str = "1h,4h,1d"

    # Redis
    redis_url: str = "redis://redis:6379"

    # Monitoring
    prometheus_enabled: bool = True
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_development(self) -> bool:
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def database_url(self) -> str:
        """Primary database URL for Oracle Autonomous Database."""
        if not self.oracle_db_password or not self.oracle_db_dsn:
            # Fallback to Supabase for development
            return f"postgresql+asyncpg://postgres:{self.supabase_service_role_key}@{self.supabase_url.replace('https://', '').replace('http://', '')}:5432/postgres"
        return f"postgresql+asyncpg://{self.oracle_db_user}:{self.oracle_db_password}@{self.oracle_db_dsn}"

    @property
    def supabase_database_url(self) -> str:
        """Supabase database URL (for auth/admin operations)."""
        return f"postgresql+asyncpg://postgres:{self.supabase_service_role_key}@{self.supabase_url.replace('https://', '').replace('http://', '')}:5432/postgres"

    @property
    def scanner_symbol_list(self) -> list[str]:
        return [s.strip().upper() for s in self.scanner_symbols.split(",") if s.strip()]

    @property
    def scanner_timeframe_list(self) -> list[str]:
        return [tf.strip() for tf in self.scanner_timeframes.split(",") if tf.strip()]

    @property
    def oracle_wallet_path_obj(self) -> Path:
        return Path(self.oracle_wallet_path).expanduser()


@lru_cache
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()
