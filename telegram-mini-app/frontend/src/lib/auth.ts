// ============================================================================
// Auth слой — хранение JWT и Telegram initData
// ============================================================================

const TOKEN_KEY = "nbeauty_access_token"
const INIT_DATA_KEY = "nbeauty_init_data"

/** Сохранить JWT токен */
export function setAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

/** Получить JWT токен */
export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

/** Удалить JWT токен (logout) */
export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

/** Сохранить Telegram initData */
export function setInitData(data: string): void {
  localStorage.setItem(INIT_DATA_KEY, data)
}

/** Получить Telegram initData */
export function getInitData(): string | null {
  return localStorage.getItem(INIT_DATA_KEY)
}

/** Проверить, авторизован ли пользователь */
export function isAuthenticated(): boolean {
  return !!getAccessToken()
}

/** Проверить, истёк ли JWT токен (без decode) */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    const exp = payload.exp * 1000 // → ms
    return Date.now() >= exp
  } catch {
    return true // Если не распарсить — считаем истёкшим
  }
}

/** Обновить токен через Telegram initData */
export async function refreshAuth(): Promise<string | null> {
  const { apiAuth } = await import("./api")

  // Берём initData из Telegram WebApp или localStorage
  const tg = (window as any).Telegram?.WebApp
  const initData = tg?.initData || getInitData()

  if (!initData) return null

  try {
    const res = await apiAuth.telegram(initData)
    setAccessToken(res.accessToken)
    setInitData(initData)
    return res.accessToken
  } catch {
    return null
  }
}
