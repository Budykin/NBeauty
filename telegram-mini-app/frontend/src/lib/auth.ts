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
  localStorage.removeItem(INIT_DATA_KEY)
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
