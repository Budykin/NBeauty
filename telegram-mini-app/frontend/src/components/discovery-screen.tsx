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
          <motion.button
            key={master.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            onClick={() => onSelectMaster(master)}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
          >
            {/* Аватар */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {master.avatar}
            </div>

            {/* Инфо */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-card-foreground">{master.name}</p>
              <p className="text-xs text-muted-foreground">{master.specialty}</p>
              <div className="mt-1 flex items-center gap-1">
                <Star className="h-3 w-3 fill-[var(--tg-warning)] text-[var(--tg-warning)]" />
                <span className="text-xs font-medium text-foreground">{master.rating}</span>
                <span className="text-xs text-muted-foreground">({master.reviewCount} отзывов)</span>
              </div>
            </div>

            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </motion.button>
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
