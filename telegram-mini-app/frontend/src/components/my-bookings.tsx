"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CalendarDays, Clock, X, User as UserIcon } from "lucide-react"
import type { Appointment } from "@/lib/types"

interface MyBookingsProps {
  appointments: Appointment[]
  onCancel: (id: string) => void
}

const MONTHS_RU_SHORT = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
]

function formatDate(dateStr: string) {
  const [, m, d] = dateStr.split("-").map(Number)
  return `${d} ${MONTHS_RU_SHORT[m - 1]}`
}

export function MyBookingsScreen({ appointments, onCancel }: MyBookingsProps) {
  const upcoming = appointments.filter((a) => a.status === "upcoming").sort((a, b) => {
    const da = `${a.date}${a.startTime}`
    const db = `${b.date}${b.startTime}`
    return da.localeCompare(db)
  })
  const cancelled = appointments.filter((a) => a.status === "cancelled")

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Мои записи</h1>
        <p className="text-sm text-muted-foreground">
          {upcoming.length > 0 ? `${upcoming.length} предстоящих` : "Нет предстоящих записей"}
        </p>
      </div>

      {/* Предстоящие */}
      <AnimatePresence>
        {upcoming.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-12"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <CalendarDays className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Нет предстоящих записей</p>
            <p className="text-xs text-muted-foreground">Запишитесь к мастеру из каталога</p>
          </motion.div>
        )}

        {upcoming.map((apt, i) => (
          <motion.div
            key={apt.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
          >
            {/* Дата блок */}
            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-accent">
              <span className="text-xs font-semibold text-accent-foreground">{formatDate(apt.date)}</span>
            </div>

            {/* Детали */}
            <div className="flex-1">
              <p className="text-sm font-semibold text-card-foreground">{apt.service.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserIcon className="h-3 w-3" />
                <span>{apt.masterName}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{apt.startTime} - {apt.endTime}</span>
              </div>
            </div>

            {/* Отмена */}
            <button
              onClick={() => onCancel(apt.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              aria-label="Отменить запись"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Отменённые */}
      {cancelled.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">Отменённые</p>
          {cancelled.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 opacity-50"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <X className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-card-foreground line-through">{apt.service.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(apt.date)}, {apt.startTime}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
