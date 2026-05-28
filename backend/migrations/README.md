# Database init / future migration reference

`001_initial_schema.sql` is kept as a consolidated reference/fresh-init script
for future rebuilds, new developer machines, CI databases, or emergency schema
comparison. The current local PostgreSQL database and schema may already exist
outside Docker; in that case do not run this script automatically against it.

The script is based on
`/Users/nic_piter/Desktop/nbeauty_dump_last.sql`. The target database is
`postgres`; application tables live in schema `nbeauty`.

If you intentionally want a disposable Docker database from this schema:

```bash
docker compose --profile docker-db up -d db
```

Docker publishes PostgreSQL on `localhost:5433` by default to avoid conflicting
with a native PostgreSQL server on `localhost:5432`.

Primary native local database expected by the app:

- Host: `localhost`
- Port: `5432`
- Database: `postgres`
- Schema: `nbeauty`
- Role: `nbeauty_app`
- Password: `app_password`

DBeaver connection for Docker database:

- Host: `localhost`
- Port: `5433`
- Database: `postgres`
- User/password: values from root `.env` or `.env.example`
- Schema to inspect: `nbeauty`
