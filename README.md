# NBeauty

## Local PostgreSQL

The application uses the native PostgreSQL running on this computer at
`localhost:5432`. Database `postgres` and schema `nbeauty` are expected to
already exist. Use this role for the app:

```sql
CREATE ROLE nbeauty_app
LOGIN
PASSWORD 'app_password';
```

Start a disposable Docker database when you need a fresh rebuild:

```bash
cp .env.example .env
docker compose --profile docker-db up -d db
```

The Docker database is optional and exists only for future fresh rebuilds from
`backend/migrations/001_initial_schema.sql`. It publishes PostgreSQL on
`localhost:5433` by default so it does not conflict with native PostgreSQL.

Default native DBeaver connection settings:

- Host: `localhost`
- Port: `5432`
- Database: `postgres`
- User: `nbeauty_app`
- Password: `app_password`
- Schema: `nbeauty`

Do not commit real production credentials. Override local values in ignored
`.env` when needed.
