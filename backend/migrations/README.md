# Database migrations

PostgreSQL init scripts live here. `docker-compose.yml` mounts this directory to
`/docker-entrypoint-initdb.d`, so `*.sql` files run automatically when a fresh
`db_data` volume is created.

For an existing database, apply the schema manually:

```bash
psql "$DATABASE_URL" -f backend/migrations/001_initial_schema.sql
```

If the database was already initialized with an older schema, prefer creating a
proper incremental migration instead of editing `001_initial_schema.sql`.
