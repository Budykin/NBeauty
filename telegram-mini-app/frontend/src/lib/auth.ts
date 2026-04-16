// ============================================================================
// Auth слой — хранение JWT и Telegram initData
// ============================================================================

import type { ApiAuthResponse } from "./api"

const TOKEN_KEY = "nbeauty_access_token"
const INIT_DATA_KEY = "nbeauty_init_data"
const LOGIN_SESSION_KEY = "nbeauty_login_session"

type TelegramWebApp = {
  initData?: string
  initDataUnsafe?: {
    user?: {
      first_name?: string
      last_name?: string
    }
  }
  ready?: () => void
  expand?: () => void
}

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

export function clearInitData(): void {
  localStorage.removeItem(INIT_DATA_KEY)
}

export function setLoginSessionToken(token: string): void {
  localStorage.setItem(LOGIN_SESSION_KEY, token)
}

export function getLoginSessionToken(): string | null {
  return localStorage.getItem(LOGIN_SESSION_KEY)
}

export function clearLoginSessionToken(): void {
  localStorage.removeItem(LOGIN_SESSION_KEY)
}

export function getTelegramWebApp(): TelegramWebApp | undefined {
  return (window as Window & { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp
}

export function getTelegramInitData(): string | null {
  return getTelegramWebApp()?.initData || getInitData()
}

export function persistAuth(response: ApiAuthResponse, initData?: string): void {
  setAccessToken(response.accessToken)
  if (initData) {
    setInitData(initData)
  }
}

/** Проверить, авторизован ли пользователь */
export function isAuthenticated(): boolean {
  const token = getAccessToken()
  return !!token && !isTokenExpired(token)
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

  const initData = getTelegramInitData()

  if (!initData) {
    clearAccessToken()
    return null
  }

  try {
    const res = await apiAuth.telegram(initData)
    persistAuth(res, initData)
    return res.accessToken
  } catch {
    clearAccessToken()
    return null
  }
}
