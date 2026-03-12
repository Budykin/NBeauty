"use client"

import { useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Clock, User, Box } from "lucide-react"
import type { Salon, Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SalonScheduleViewProps {
  salon: Salon
  appointments: Appointment[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

function getDaysAround(center: Date, range = 14) {
  const days: Date[] = []
  for (let i = -3; i <= range; i++) {
    const d = new Date(center)
    d.setDate(d.getDate() + i)
    days.push(d)
  }
  return days
}

const WEEKDAYS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const MONTHS_RU = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
]

function formatDateRu(date: Date) {
  return `${date.getDate()} ${MONTHS_RU[date.getMonth()]}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function isToday(d: Date) {
  return isSameDay(d, new Date())
}

export function SalonScheduleView({ salon, appointments, selectedDate, onSelectDate }: SalonScheduleViewProps) {
  const days = useMemo(() => getDaysAround(new Date()), [])
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
  
  // Получаем записи всех мастеров салона на выбранный день
  const salonMasterIds = salon.members.map((m) => m.masterId)
  const dayAppointments = appointments
    .filter((a) => a.date === selectedStr && a.status !== "cancelled" && salonMasterIds.includes(a.masterId))
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector("[data-active=true]")
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [])

  // Группировка по мастерам
  const byMaster = useMemo(() => {
    const grouped: Record<string, Appointment[]> = {}
    dayAppointments.forEach((apt) => {
      if (!grouped[apt.masterId]) {
        grouped[apt.masterId] = []
      }
      grouped[apt.masterId].push(apt)
    })
    return grouped
  }, [dayAppointments])

  return (
    <div className="flex flex-col gap-4">
      {/* Выбор даты */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{formatDateRu(selectedDate)}</p>
          <p className="text-xs text-muted-foreground">
            {isToday(selectedDate) ? "Сегодня" : WEEKDAYS_RU[selectedDate.getDay()]}
          </p>
        </div>
        <span className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
          {dayAppointments.length} записей
        </span>
      </div>

      {/* Горизонтальный выбор дат */}
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {days.map((day, i) => {
          const active = isSameDay(day, selectedDate)
          const today = isToday(day)
          return (
            <button
              key={i}
              data-active={active}
              onClick={() => onSelectDate(day)}
              className={cn(
                "flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2.5 py-2 text-xs transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : today
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-secondary"
              )}
            >
              <span className="text-[10px] font-medium uppercase">{WEEKDAYS_RU[day.getDay()]}</span>
              <span className="text-base font-semibold">{day.getDate()}</span>
            </button>
          )
        })}
      </div>

      {/* Расписание по мастерам */}
      <AnimatePresence mode="wait">
        {dayAppointments.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center gap-2 py-8 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Нет записей</p>
          </motion.div>
        ) : (
          <motion.div
            key={selectedStr}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-4"
          >
            {Object.entries(byMaster).map(([masterId, apts]) => {
              const masterName = apts[0]?.masterName || "Мастер"
              const member = salon.members.find((m) => m.masterId === masterId)
              return (
                <div key={masterId} className="flex flex-col gap-2">
                  {/* Заголовок мастера */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {member?.masterAvatar || masterName.slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium text-foreground">{masterName}</span>
                    <span className="text-xs text-muted-foreground">({apts.length})</span>
                  </div>

                  {/* Записи мастера */}
                  <div className="ml-9 flex flex-col gap-1.5">
                    {apts.map((apt) => {
                      const resource = apt.resourceId
                        ? salon.resources.find((r) => r.id === apt.resourceId)
                        : null
                      return (
                        <div
                          key={apt.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">
                              {apt.startTime}
                            </span>
                            <span className="text-xs text-muted-foreground">-</span>
                            <span className="text-xs text-muted-foreground">{apt.endTime}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{apt.service.name}</span>
                            {resource && (
                              <span className="flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                                <Box className="h-2.5 w-2.5" />
                                {resource.name}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
