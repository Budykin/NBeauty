# NBeauty

Проект включает:
- `backend` (FastAPI API);
- `bot` (Telegram-бот);
- `telegram-mini-app/frontend` (Next.js Mini App).

## Требования

- Docker и Docker Compose
- Node.js 18+
- `ngrok`
- аккаунт Vercel
- заполненный файл `.env` (можно начать с `.env.example`)

## Быстрый запуск для курсовой

1. Подготовьте окружение:

```bash
cp .env.example .env
```

2. Поднимите backend и bot в Docker:

```bash
docker compose up -d --build backend bot
```

3. Проверьте backend локально:

```bash
curl http://localhost:8000/health
```

4. Поднимите туннель на backend через ngrok:

```bash
ngrok http 8000
```

Возьмите `https`-URL из ngrok, например:
`https://example.ngrok-free.app`

5. Обновите переменные для фронтенда/бота:
- `NEXT_PUBLIC_API_URL=https://<ваш-ngrok-url>`
- `WEBAPP_URL=https://<домен-vercel>`
- `TELEGRAM_BOT_URL=https://t.me/<username_бота>`

6. Разверните Mini App на Vercel из каталога `telegram-mini-app/frontend`.

## Деплой фронтенда на Vercel

1. Перейдите в каталог фронтенда:

```bash
cd telegram-mini-app/frontend
```

2. Свяжите проект с Vercel и задеплойте:

```bash
vercel
vercel --prod
```

3. В настройках проекта Vercel добавьте переменные:
- `NEXT_PUBLIC_API_URL=https://<ваш-ngrok-url>`
- `NEXT_PUBLIC_DEV_AUTH_BYPASS=false`

4. После деплоя пропишите `WEBAPP_URL` в `.env` как адрес прод-домена Vercel.

## Локальная база данных

По умолчанию приложение использует PostgreSQL на `localhost:5432`, БД `postgres`,
схема `nbeauty`, роль `nbeauty_app`.

Опционально можно поднять отдельную Docker-БД (порт `5433`) для чистой инициализации:

```bash
docker compose --profile docker-db up -d db
```
