# Frontend Telegram Mini App

Frontend реализован на Next.js и находится в `telegram-mini-app/frontend`.

## Локальный запуск

1. Установите зависимости:

```bash
npm install
```

2. Убедитесь, что backend доступен (обычно через ngrok, если нужен доступ из Telegram):

```bash
ngrok http 8000
```

3. Пропишите API-адрес в окружении (в корневом `.env` проекта):

```env
NEXT_PUBLIC_API_URL=https://<ваш-ngrok-url>
NEXT_PUBLIC_DEV_AUTH_BYPASS=false
```

4. Запустите фронтенд:

```bash
npm run dev
```

Приложение будет доступно на `http://localhost:3000`.

## Деплой на Vercel

1. Из каталога `telegram-mini-app/frontend` выполните:

```bash
vercel
vercel --prod
```

2. В настройках проекта Vercel добавьте переменные окружения:
- `NEXT_PUBLIC_API_URL=https://<ваш-ngrok-url>`
- `NEXT_PUBLIC_DEV_AUTH_BYPASS=false`

3. После публикации обновите в корневом `.env` переменную:
- `WEBAPP_URL=https://<ваш-домен-vercel>`

Это значение используется ботом для кнопки открытия Mini App.
