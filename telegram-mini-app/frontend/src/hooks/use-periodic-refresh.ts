"use client"

import { useEffect, useRef } from "react"

/**
 * Хук для периодического выполнения функции
 * @param callback - Функция для выполнения
 * @param interval - Интервал в миллисекундах (0 = отключено)
 * @param enabled - Включен ли рефреш
 */
export function usePeriodicRefresh(
  callback: () => void | Promise<void>,
  interval: number = 30000, // 30 секунд по умолчанию
  enabled: boolean = true
) {
  const intervalRef = useRef<number | null>(null)
  const callbackRef = useRef(callback)

  // Обновляем ref когда callback меняется
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    if (!enabled || interval <= 0) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = window.setInterval(() => {
      void callbackRef.current()
    }, interval)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [interval, enabled])
}
