"use client"

import { ExternalLink, RefreshCcw } from "lucide-react"

import { Button } from "@/components/ui/button"

type DevLoginScreenProps = {
  botLink: string
  expiresAt: string
  error?: string
  onRetry: () => void
}

export function DevLoginScreen({
  botLink,
  expiresAt,
  error,
  onRetry,
}: DevLoginScreenProps) {
  return (
    <div className="mx-auto flex min-h-svh max-w-[430px] items-center justify-center bg-background px-6 py-10">
      <div className="w-full rounded-[28px] border border-border/60 bg-card p-6 shadow-sm">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
              Browser Fallback
            </p>
            <h1 className="text-2xl font-semibold text-foreground">Открыто вне Telegram</h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Внутри Telegram Mini App вход выполняется автоматически по данным пользователя Telegram.
              Этот экран нужен только для запуска в обычном браузере во время разработки.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          <Button asChild className="w-full">
            <a href={botLink} target="_blank" rel="noreferrer">
              Открыть бота
              <ExternalLink />
            </a>
          </Button>

          <Button variant="outline" className="w-full" onClick={onRetry}>
            Запросить новую ссылку
            <RefreshCcw />
          </Button>

          <p className="text-xs leading-5 text-muted-foreground">
            Сессия активна до {new Date(expiresAt).toLocaleTimeString()}.
          </p>
        </div>
      </div>
    </div>
  )
}
