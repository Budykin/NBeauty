"use client"

import { useDeferredValue, useEffect, useState } from "react"
import type { MouseEvent } from "react"
import { motion } from "framer-motion"
import { ChevronRight, Share2, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { apiAuth } from "@/lib/api"
import type { Master } from "@/lib/types"

type TelegramWebAppWithShare = {
  openTelegramLink?: (url: string) => void
  openLink?: (url: string) => void
}

interface DiscoveryScreenProps {
  masters: Master[]
  onSelectMaster: (master: Master) => void
  profileMasterId?: string | null
}

export function DiscoveryScreen({ masters, onSelectMaster, profileMasterId }: DiscoveryScreenProps) {
  const [query, setQuery] = useState("")
  const [profileMaster, setProfileMaster] = useState<Master | null>(null)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const deferredQuery = useDeferredValue(query.trim().toLowerCase())

  const filteredMasters = masters.filter((master) => {
    if (!deferredQuery) return true

    const searchIndex = [
      master.name,
      master.specialty,
      ...master.services.map((service) => service.name),
    ]
      .join(" ")
      .toLowerCase()

    return searchIndex.includes(deferredQuery)
  })

  useEffect(() => {
    if (!profileMasterId) return

    const deepLinkedMaster = masters.find((master) => master.id === profileMasterId)
    if (!deepLinkedMaster) return

    setShareFeedback(null)
    setProfileMaster(deepLinkedMaster)
  }, [masters, profileMasterId])

  function isAvatarImage(value: string): boolean {
    return value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")
  }

  function openMasterProfile(event: MouseEvent, master: Master) {
    event.stopPropagation()
    setShareFeedback(null)
    setProfileMaster(master)
  }

  function startBooking(master: Master) {
    onSelectMaster(master)
    setProfileMaster(null)
  }

  async function shareMaster(master: Master) {
    let masterLink: string | null = null

    try {
      const botLink = await apiAuth.getTelegramBotLink()
      const botUsername = botLink.botUrl
        .replace(/^https?:\/\/t\.me\//, "")
        .replace(/^@/, "")
        .replace(/\/+$/, "")

      if (!botUsername) {
        throw new Error("Missing bot username")
      }

      masterLink = `https://t.me/${botUsername}/app?startapp=master_${master.id}`
      const lines = [
        `Мастер: ${master.name}`,
        master.username ? `@${master.username}` : null,
        `Рейтинг: ${master.rating} / 5`,
        masterLink,
      ].filter(Boolean) as string[]
      const text = lines.join("\n")
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(masterLink)}&text=${encodeURIComponent(text)}`

      const telegramWebApp = (window as Window & { Telegram?: { WebApp?: TelegramWebAppWithShare } }).Telegram?.WebApp
      if (telegramWebApp?.openTelegramLink) {
        telegramWebApp.openTelegramLink(shareUrl)
        setShareFeedback("Открылся шаринг Telegram")
        return
      }

      if (telegramWebApp?.openLink) {
        telegramWebApp.openLink(shareUrl)
        setShareFeedback("Открылся шаринг Telegram")
        return
      }

      if (navigator.share) {
        await navigator.share({
          title: `Мастер ${master.name}`,
          text,
        })
        setShareFeedback("Профиль отправлен")
        return
      }

      await navigator.clipboard.writeText(masterLink)
      setShareFeedback("Ссылка на мастера скопирована")
    } catch {
      setShareFeedback("Ссылка на мастера скопирована")
      try {
        await navigator.clipboard.writeText(masterLink ?? `${window.location.origin}/?startapp=master_${master.id}`)
      } catch {}
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Мастера</h1>
        <p className="text-sm text-muted-foreground">
          {filteredMasters.length > 0
            ? "Выберите специалиста для записи"
            : "Подходящие мастера пока не найдены"}
        </p>
      </div>

      {/* Строка поиска */}
      <div className="relative">
        <input
          id="master-search"
          name="master-search"
          type="text"
          placeholder="Поиск мастеров..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Список мастеров */}
      <div className="flex flex-col gap-2.5">
        {filteredMasters.map((master, i) => (
          <motion.div
            key={master.id}
            role="button"
            tabIndex={0}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onSelectMaster(master)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelectMaster(master)
              }
            }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
          >
            {/* Аватар */}
            <button
              type="button"
              onClick={(event) => openMasterProfile(event, master)}
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-offset-background transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              aria-label={`Открыть карточку мастера ${master.name}`}
            >
              {isAvatarImage(master.avatar) ? (
                <img
                  src={master.avatar}
                  alt={master.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                master.avatar
              )}
            </button>

            {/* Инфо */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={(event) => openMasterProfile(event, master)}
                className="block max-w-full truncate text-sm font-semibold text-card-foreground underline-offset-2 hover:underline focus:outline-none focus:underline"
              >
                {master.name}
              </button>
              {master.username ? (
                <a
                  href={`https://t.me/${master.username}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-0.5 block truncate text-xs font-medium text-primary"
                >
                  @{master.username}
                </a>
              ) : null}
              <p className="text-xs text-muted-foreground">{master.specialty}</p>
              <div className="mt-1 flex items-center gap-1">
                <Star className="h-3 w-3 fill-[var(--tg-warning)] text-[var(--tg-warning)]" />
                <span className="text-xs font-medium text-foreground">{master.rating}</span>
                <span className="text-xs text-muted-foreground">({master.reviewCount} отзывов)</span>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        ))}

        {filteredMasters.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Измени запрос или вернись позже, когда мастера добавят услуги.
          </div>
        ) : null}
      </div>

      <Dialog open={profileMaster !== null} onOpenChange={(open) => !open && setProfileMaster(null)}>
        {profileMaster ? (
          <DialogContent className="max-h-[90svh] overflow-y-auto p-4">
            <DialogHeader className="items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
                {isAvatarImage(profileMaster.avatar) ? (
                  <img src={profileMaster.avatar} alt={profileMaster.name} className="h-full w-full object-cover" />
                ) : (
                  profileMaster.avatar
                )}
              </div>
              <DialogTitle className="text-xl">{profileMaster.name}</DialogTitle>
              {profileMaster.username ? (
                <a
                  href={`https://t.me/${profileMaster.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary"
                >
                  @{profileMaster.username}
                </a>
              ) : null}
              {profileMaster.specialty ? (
                <p className="text-sm text-muted-foreground">{profileMaster.specialty}</p>
              ) : null}
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-[var(--tg-warning)] text-[var(--tg-warning)]" />
                <span className="font-medium">{profileMaster.rating} / 5</span>
                <span className="text-muted-foreground">({profileMaster.reviewCount} отзывов)</span>
              </div>
            </DialogHeader>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Отзывы</p>
              {profileMaster.reviews.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {profileMaster.reviews.map((review) => (
                    <div key={review.id} className="min-w-[240px] rounded-xl border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-card-foreground">
                          {review.clientName || "Клиент"}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground">⭐ {review.rating}/5</span>
                      </div>
                      {review.clientUsername ? (
                        <a
                          href={`https://t.me/${review.clientUsername}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-0.5 block truncate text-xs font-medium text-primary"
                        >
                          @{review.clientUsername}
                        </a>
                      ) : null}
                      {review.comment ? (
                        <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{review.comment}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">{formatReviewDate(review.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                  Пока нет отзывов
                </div>
              )}
            </div>

            <DialogFooter className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto]">
              <Button onClick={() => startBooking(profileMaster)}>Записаться</Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void shareMaster(profileMaster)}
                aria-label="Поделиться профилем"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </DialogFooter>
            {shareFeedback ? <p className="text-center text-xs text-muted-foreground">{shareFeedback}</p> : null}
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}

function formatReviewDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}
