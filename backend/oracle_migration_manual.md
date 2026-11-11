Oracle Cloud Free Tier Backend Migration Manual
for Tram Trading System

This manual provides a step-by-step guide to migrate the Tram backend to Oracle Cloud Free Tier.
It covers environment setup, database migration, code adjustments, scanner/strategy compatibility,
and mathematical mechanism verification. The core mathematical mechanism was previously verified by
Nemotron 3 Ultra Free and should be re-validated after migration.

1. Oracle Cloud Free Tier Account & Compute Instance
   - Sign up at https://www.oracle.com/cloud/free/ using an Oracle account.
   - Verify Always Free eligibility: 2 ARM Ampere cores, 24 GB RAM, 200 GB storage.
   - Create a new Always Free compute instance:
     * Select Oracle Linux or Ubuntu (ARM64 recommended).
     * Choose "Always Free" category.
     * Set a strong SSH key for access.
     * Note the public IP address assigned.

2. Networking & Security Configuration
   - In the Oracle Cloud Console, create a Virtual Cloud Network (VCN) with a public subnet.
   - Configure Security Lists to allow:
     * Inbound: SSH (port 22) from your IP.
     * Inbound: HTTP/8080 (backend API) from 0.0.0.0/0 or your domain.
     * Inbound: HTTPS/443 if using a reverse proxy or Oracle Load Balancer.
     * Outbound: All internet (required for Binance WS, Telegram, dependency downloads).
   - If using a custom domain, map it to the Oracle instance IP via DNS (Oracle DNS or external provider).
   - Optional: Set up an Oracle Load Balancer or NGINX reverse proxy for TLS termination.

3. Environment & Configuration Migration (config.py)
   - SSH into the Oracle instance and clone your backend repository.
   - Update `backend/app/core/config.py`:
     * Set `oracle_db_user`, `oracle_db_password`, `oracle_db_dsn`, `oracle_wallet_path`.
       - Oracle Always Free uses Oracle Autonomous Database Free Tier or Oracle MySQL HeatWave.
       - Generate an Oracle Wallet (TSN file) from the Autonomous Database console and copy to the instance at `/opt/oracle_wallet/`.
       - `oracle_db_dsn` format: `tradingdb_high?TNS_ADMIN=/opt/oracle_wallet`
     * Update `supabase_url`, `supabase_anon_key`, `supabase_service_role_key` if Supabase will remain for auth only.
     * Set `oracle_wallet_path` to the absolute path where the wallet is stored.
     * Adjust `cors_origins` to your new domain or `http://localhost:3000` for development.
     * If using ARM64, ensure `requirements.txt`/`pyproject.toml` compiles cleanly:
       - Some C-extensions (e.g., `psycopg2-binary`, `numpy`) may need rebuilding: `pip install --force-reinstall --no-binary :all: psycopg2-binary`.
     * Set environment variables (or in a `.env` file):
       ```bash
       export ORACLE_DB_URL="postgresql+asyncpg://admin:PASSWORD@tradingdb_high?TNS_ADMIN=/opt/oracle_wallet"
       export SECRET_KEY="your-jwt-secret"
       export TELEGRAM_BOT_TOKEN="..."
       export TELEGRAM_CHAT_ID="..."
       ```
   - Test the configuration:
     ```bash
     cd backend
     python -c "from app.core.config import get_settings; s = get_settings(); print(s.database_url); print(s.is_production)"
     ```

4. Database Migration (Supabase/PostgreSQL → Oracle Always Free)
   - **Option A: Oracle Autonomous Database Free Tier**
     * In Oracle Cloud, create an Autonomous Database (Free tier: shared CPU, 20GB storage).
     * Generate a wallet (download `wallet_path.zip`) and extract to `/opt/oracle_wallet/` on the instance.
     * Update `oracle_db_dsn` and `oracle_db_password` in `config.py`.
     * Export your Supabase/PostgreSQL data:
       ```bash
       pg_dump -Fc -U postgres -h <supabase-host> your_db > backup.dump
       ```
     * Import into Oracle:
       ```bash
       oraclepdb=your_pdb
       sqlplus admin/wallet_password @backup.dump
       ```
       *Or use Oracle Data Pump (expdp/impdp) if familiar.*
   - **Option B: Oracle MySQL HeatWave Free Tier**
     * Create a MySQL HeatWave instance (Always Free eligible).
     * Export MySQL data from Supabase:
       ```bash
       mysqldump -u user -p your_db > backup.sql
       ```
     * Import into Oracle MySQL:
       ```bash
       mysql -u admin -p your_db < backup.sql
       ```
     * Update `config.py` `oracle_db_dsn` to MySQL format: `mysql+asyncpg://user:password@host:3306/db_name` (note: asyncpg works with MySQL URLs, but consider `aiomysql` if issues arise).
   - **Option C: Keep Supabase for auth, Oracle for data**
     * Set `oracle_db_user`, `oracle_db_password`, `oracle_db_dsn` to point to an Oracle MySQL/PostgreSQL instance.
     * Keep `supabase_*` vars for `/auth`, `/jwt`, and user metadata.
     * Update `config.py` `database_url` property to switch based on env: if `oracle_db_password` set → use Oracle; else fallback to Supabase.
   - After import, verify schema matches expectations (tables: `users`, `signals`, `trades`, `journals`, `alerts`, `strategies`).
   - Test connection from the instance:
     ```bash
     python -c "from app.core.config import get_settings; s = get_settings(); engine = create_engine(s.database_url); with engine.connect() as conn: conn.execute(text('SELECT 1'))"
     ```

5. Binance WebSocket & Scanner Engine Compatibility
   - `backend/app/scanner/binance_ws.py` and `backend/app/scanner/engine.py` should work unchanged as they use public Binance WS URLs (`wss://data-stream.binance.vision/stream`).
   - Oracle Free Tier has outbound bandwidth limits; monitor usage during scanner runs.
   - Ensure Security Lists allow outbound traffic to `*.binance.vision` on port 443.
   - If behind a proxy, set `binance_proxy_url` in `config.py` or environment variable.
   - The `_backfill_buffers` function in `engine.py` uses `fetch_historical_klines` via Binance REST; this works on Oracle ARM instances.
   - Test the scanner start:
     ```bash
     cd backend
     python -m app.main  # or your entry point
     # Then: curl http://localhost:8000/scanner/status
     ```

6. Strategy Math Verification (EMA Crossover & RSI Divergence)
   - The strategies `ema_crossover.py` and `rsi_divergence.py` contain the core signal logic.
   - Nemotron 3 Ultra Free verification note: "The mathematical system mechanism has previously been verified by Nemotron 3 Ultra Free, so it may need to be re-checked during migration."
   - Post-migration, run the existing test suite to confirm no regression:
     ```bash
     cd backend
     python -m pytest tests/test_scanner.py -v
     ```
   - Pay attention to:
     * Floating-point precision differences on ARM64 (unlikely to shift results significantly, but verify).
     * ATR/EMA/RSI calculations — compare outputs on identical candle data before and after migration.
     * Confidence scoring logic — ensure `_calculate_confidence` methods in both strategies still produce expected 0-100 ranges.
   - If using Oracle MySQL instead of PostgreSQL, verify JSON/JSONB column handling for `metadata` in signal/trade records, as Oracle MySQL's JSON support differs slightly from PostgreSQL.

7. Notification Service (Telegram) on Oracle
   - `backend/app/services/notification_service.py` sends Telegram messages via `send_telegram_message`.
   - Oracle Free Tier allows outbound HTTP/HTTPS; Telegram Bot API (`api.telegram.org`) should work without restrictions.
   - Set `telegram_bot_token` and `telegram_chat_id` in `config.py`/`.env`.
   - Test:
     ```bash
     cd backend
     python -c "
from app.services.notification_service import get_notification_service, NotificationService
svc = NotificationService()
asyncio.run(svc.test_telegram_connection('YOUR_CHAT_ID'))
     "
     ```
   - If Telegram fails, check:
     * Oracle Security Lists allow outbound 443 to `api.telegram.org`.
     * `httpx.AsyncClient` timeout not hit (increase if needed).
     * Bot token and Chat ID correct.

8. Testing & Validation Checklist
   - [ ] Health endpoints respond: `GET /health`, `GET /health/ready`
   - [ ] JWT auth (`verify_jwt`, `get_current_user`) works with new DB/domain.
   - [ ] Signal generation: run `test_scanner.py`; compare signal outputs to pre-migration baselines.
   - [ ] Trade CRUD operations (`list_trades`, `create_trade`, `update_trade`, `delete_trade`) functional.
   - [ ] Journal entry lifecycle (`list_entries`, `create_entry`, `get_entry`, `update_entry`, `delete_entry`) works.
   - [ ] Scanner engine starts, processes candles, and generates signals without errors.
   - [ ] Notification service sends test Telegram message successfully.
   - [ ] Candle buffer indicators (`_ema`, `_rsi`, `_atr`, `_sma`) compute correctly on ARM64.
   - [ ] Oracle resource monitoring: CPU, RAM, bandwidth within Free Tier limits (2 OCPU, 24GB RAM, 200GB storage).
   - [ ] Database connectivity stable; no dropped connections during scanner loops.

9. Rollback Plan
   - Keep your existing Supabase/on-prem PostgreSQL deployment intact until full validation.
   - Snapshot the Oracle Compute Instance before making major config changes (Oracle Cloud allows instant snapshots).
   - Document all `ALTER TABLE`, `UPDATE`, and connection-string changes for quick reversal.
   - Test rollback in an isolated environment (e.g., a second Free Tier instance) before pointing production traffic.
   - If using Option C (Supabase for auth, Oracle for data), you can switch `config.py` `database_url` back to Supabase URL instantly.

10. Post-Migration Monitoring
    - Set up basic resource monitoring via Oracle Cloud Observations or a simple cron job:
      ```bash
      # Check running processes, memory, disk
      top -bn1 | grep Cpu
      free -h
      df -h /opt
      ```
    - Log scanner stats via the `/scanner/status` endpoint.
    - Monitor Telegram notification failures in the Oracle logs.
    - Keep a copy of the pre-migration `requirements.txt` pip output for reproducibility.

---
Migration Complete Checklist
- [ ] Oracle Free Tier account & ARM compute instance running
- [ ] VCN, Security Lists, and networking configured
- [ ] Oracle Database (Autonomous or MySQL HeatWave) created & wallet imported
- [ ] `config.py` updated with correct DSN, wallet path, and credentials
- [ ] Supabase auth vars adjusted (if switching to Oracle for data)
- [ ] `requirements.txt` compiles on ARM64; C-extensions reinstalled if needed
- [ ] Database migration tested; all required tables accessible
- [ ] `/health`, `/health/ready` pass
- [ ] Signal math verified via `pytest tests/test_scanner.py`
- [ ] Trade, journal, and signal CRUD functional
- [ ] Telegram test message sent successfully
- [ ] Scanner engine runs end-to-end without errors
- [ ] Rollback plan documented and tested
- [ ] Resource limits monitored; staying within Always Free quotas

*End of Manual. Verify all environment-specific values (passwords, IPs, wallet paths) before applying changes.*
