# Database migrations

PostgreSQL init scripts live here. `docker-compose.yml` mounts this directory to
`/docker-entrypoint-initdb.d`, so `*.sql` files run automatically when a fresh
`db_data_v2` volume is created.

The Compose volume is intentionally versioned. If you still have an older local
`db_data` volume with incompatible Postgres credentials or an outdated cluster,
Docker Compose will now create a fresh `db_data_v2` volume instead of trying to
reuse the stale one.

For an existing database in Docker Compose, apply the missing migration files
manually. For the current auth flow, at minimum:

```bash
docker compose exec -T db \
  psql -U postgres -d nbeauty \
  -f /docker-entrypoint-initdb.d/002_telegram_login_sessions.sql
```

If you apply migrations from the host instead of Docker, use a regular Postgres
DSN for `psql` (without `+asyncpg`), for example:

```bash
psql "postgresql://postgres:postgres@localhost:5432/nbeauty" \
  -f backend/migrations/002_telegram_login_sessions.sql
```

If the database was already initialized with an older schema, prefer creating
proper incremental migrations instead of editing `001_initial_schema.sql`.
