"use client"

import { useCallback, useEffect, useState } from "react"

import { apiAuth, type ApiAuthResponse, type ApiLoginSessionStatusResponse } from "@/lib/api"
import {
  clearAccessToken,
  clearInitData,
  clearLoginSessionToken,
  getAccessToken,
  getInitData,
  getLoginSessionToken,
  getTelegramInitData,
  getTelegramWebApp,
  isAuthenticated,
  isTokenExpired,
  persistAuth,
  setLoginSessionToken,
} from "@/lib/auth"

type AuthSessionState =
  | { status: "loading" }
  | { status: "ready"; auth: ApiAuthResponse | null }
  | { status: "login-required"; botLink: string; expiresAt: string; error?: string }
  | { status: "error"; message: string }

const TELEGRAM_BOOTSTRAP_ATTEMPTS = 20
const TELEGRAM_BOOTSTRAP_DELAY_MS = 250
const LOGIN_SESSION_POLL_INTERVAL_MS = 1500

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

export function useAuthSession() {
  const [state, setState] = useState<AuthSessionState>({ status: "loading" })
  const [retryKey, setRetryKey] = useState(0)

  const retry = useCallback(() => {
    clearAccessToken()
    clearInitData()
    clearLoginSessionToken()
    setState({ status: "loading" })
    setRetryKey((value) => value + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    let pollTimeout: number | null = null

    const setReady = (auth: ApiAuthResponse | null) => {
      if (!cancelled) {
        setState({ status: "ready", auth })
      }
    }

    const schedulePoll = (token: string) => {
      pollTimeout = window.setTimeout(() => {
        void pollLoginSession(token)
      }, LOGIN_SESSION_POLL_INTERVAL_MS)
    }

    const handleLoginSessionStatus = (
      token: string,
      loginSession: ApiLoginSessionStatusResponse
    ) => {
      if (loginSession.status === "completed" && loginSession.auth) {
        clearLoginSessionToken()
        persistAuth(loginSession.auth)
        setReady(loginSession.auth)
        return
      }

      if (loginSession.status === "expired") {
        clearLoginSessionToken()
        setState({
          status: "login-required",
          botLink: loginSession.botLink,
          expiresAt: loginSession.expiresAt,
          error: "Ссылка устарела. Запроси новую и подтверди вход ещё раз.",
        })
        return
      }

      setState({
        status: "login-required",
        botLink: loginSession.botLink,
        expiresAt: loginSession.expiresAt,
      })
      schedulePoll(token)
    }

    const pollLoginSession = async (token: string) => {
      if (cancelled) return

      try {
        const loginSession = await apiAuth.getLoginSession(token)
        if (cancelled) return
        handleLoginSessionStatus(token, loginSession)
      } catch {
        if (!cancelled) {
          setState((currentState) => {
            if (currentState.status === "login-required") {
              return {
                ...currentState,
                error: "Не удалось проверить статус входа. Можно попробовать ещё раз.",
              }
            }
            return {
              status: "error",
              message: "Не удалось проверить статус авторизации.",
            }
          })
        }
      }
    }

    const startDeveloperLogin = async () => {
      const storedSessionToken = getLoginSessionToken()

      if (storedSessionToken) {
        try {
          const existingSession = await apiAuth.getLoginSession(storedSessionToken)
          if (cancelled) return
          handleLoginSessionStatus(storedSessionToken, existingSession)
          if (existingSession.status !== "expired") {
            return
          }
        } catch {
          clearLoginSessionToken()
        }
      }

      const createdSession = await apiAuth.createLoginSession()
      if (cancelled) return

      setLoginSessionToken(createdSession.token)
      setState({
        status: "login-required",
        botLink: createdSession.botLink,
        expiresAt: createdSession.expiresAt,
      })
      schedulePoll(createdSession.token)
    }

    const bootstrap = async () => {
      try {
        for (let attempt = 0; attempt < TELEGRAM_BOOTSTRAP_ATTEMPTS && !cancelled; attempt += 1) {
          if (getTelegramWebApp() || getInitData() || getAccessToken()) {
            break
          }
          await sleep(TELEGRAM_BOOTSTRAP_DELAY_MS)
        }

        const accessToken = getAccessToken()
        if (accessToken && isTokenExpired(accessToken)) {
          clearAccessToken()
        }

        const telegramWebApp = getTelegramWebApp()
        telegramWebApp?.ready?.()
        telegramWebApp?.expand?.()

        const liveInitData = telegramWebApp?.initData || ""
        if (liveInitData) {
          try {
            const auth = await apiAuth.telegram(liveInitData)
            if (cancelled) return
            persistAuth(auth, liveInitData)
            setReady(auth)
          } catch {
            if (!cancelled) {
              setState({
                status: "error",
                message: "Не удалось авторизоваться через Telegram Mini App.",
              })
            }
          }
          return
        }

        if (isAuthenticated()) {
          setReady(null)
          return
        }

        const storedInitData = getTelegramInitData()
        if (storedInitData) {
          try {
            const auth = await apiAuth.telegram(storedInitData)
            if (cancelled) return
            persistAuth(auth, storedInitData)
            setReady(auth)
            return
          } catch {
            clearInitData()
          }
        }

        await startDeveloperLogin()
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message: "Не удалось инициализировать авторизацию. Проверь доступность backend.",
          })
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      if (pollTimeout !== null) {
        window.clearTimeout(pollTimeout)
      }
    }
  }, [retryKey])

  return {
    state,
    retry,
  }
}
