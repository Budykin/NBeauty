"use client"

import { useDeferredValue, useState } from "react"
import { motion } from "framer-motion"
import { Star, ChevronRight } from "lucide-react"
import type { Master } from "@/lib/types"

interface DiscoveryScreenProps {
  masters: Master[]
  onSelectMaster: (master: Master) => void
}

export function DiscoveryScreen({ masters, onSelectMaster }: DiscoveryScreenProps) {
  const [query, setQuery] = useState("")
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

  function isAvatarImage(value: string): boolean {
    return value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://")
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
          <motion.article
            key={master.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onSelectMaster(master)}
            className="rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {isAvatarImage(master.avatar) ? (
                  <img
                    src={master.avatar}
                    alt={master.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  master.avatar
                )}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold text-card-foreground">{master.name}</h2>
                {master.username ? (
                  <a
                    href={`https://t.me/${master.username}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-0.5 block truncate text-sm font-medium text-primary"
                  >
                    @{master.username}
                  </a>
                ) : null}
                <p className="mt-0.5 text-xs text-muted-foreground">ID: {master.telegramId}</p>
                {master.specialty ? (
                  <p className="mt-1 text-xs text-muted-foreground">{master.specialty}</p>
                ) : null}
                <div className="mt-1 flex items-center gap-1">
                  <Star className="h-3 w-3 fill-[var(--tg-warning)] text-[var(--tg-warning)]" />
                  <span className="text-xs font-medium text-foreground">{master.rating} / 5</span>
                  <span className="text-xs text-muted-foreground">({master.reviewCount} отзывов)</span>
                </div>
              </div>

              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </div>

            {master.recentReviews.length > 0 ? (
              <div className="mt-3 space-y-2 border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground">Последние отзывы</p>
                {master.recentReviews.map((review) => (
                  <div key={review.id} className="rounded-lg bg-secondary p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-foreground">{review.clientName}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">⭐ {review.rating}/5</span>
                    </div>
                    {review.comment ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{review.comment}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </motion.article>
        ))}

        {filteredMasters.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Измени запрос или вернись позже, когда мастера добавят услуги.
          </div>
        ) : null}
      </div>
    </div>
  )
}
