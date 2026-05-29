# Миграции базы данных

Файл `001_initial_schema.sql` — это эталонный скрипт полной инициализации схемы.
Используется для:
- первичного развёртывания на новой машине;
- проверки соответствия схемы;
- поднятия чистой тестовой БД в Docker.

## Важно

Если вы уже работаете с локальной PostgreSQL вне Docker (`localhost:5432`), не
запускайте этот скрипт автоматически поверх рабочей базы.

## Поднятие чистой Docker-БД

```bash
docker compose --profile docker-db up -d db
```

По умолчанию Docker-БД публикуется на `localhost:5433`, чтобы не конфликтовать
с локальной PostgreSQL на `localhost:5432`.

## Параметры основной локальной БД

- Host: `localhost`
- Port: `5432`
- Database: `postgres`
- Schema: `nbeauty`
- User: `nbeauty_app`
- Password: `app_password`

## Параметры Docker-БД

- Host: `localhost`
- Port: `5433`
- Database: `postgres`
- User/Password: из корневого `.env` (`POSTGRES_USER`, `POSTGRES_PASSWORD`)
- Schema: `nbeauty`
