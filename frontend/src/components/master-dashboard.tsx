"use client"

import { useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Clock, User, Box, Ban } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Appointment, Resource, Salon } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MasterDashboardProps {
  appointments: Appointment[]
  allAppointments: Appointment[] // все записи салона для проверки занятости ресурсов
  resources: Resource[]
  salon: Salon | null
  currentMasterId: string
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onAddBooking: () => void
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

export function MasterDashboard({
  appointments,
  allAppointments,
  resources,
  salon,
  currentMasterId,
  selectedDate,
  onSelectDate,
  onAddBooking,
}: MasterDashboardProps) {
  const days = useMemo(() => getDaysAround(new Date()), [])
  const scrollRef = useRef<HTMLDivElement>(null)

  const selectedStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
  const dayAppointments = appointments
    .filter((a) => a.date === selectedStr && a.status !== "cancelled")
    .sort((a, b) => a.startTime.localeCompare(b.startTime))

  // Записи других мастеров, занимающие ресурсы
  const resourceOccupiedByOthers = useMemo(() => {
    if (!salon || resources.length === 0) return []
    
    return allAppointments
      .filter((a) => 
        a.date === selectedStr && 
        a.status !== "cancelled" && 
        a.masterId !== currentMasterId &&
        a.resourceId
      )
      .map((a) => ({
        ...a,
        resource: resources.find((r) => r.id === a.resourceId),
      }))
      .filter((a) => a.resource)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
  }, [allAppointments, selectedStr, currentMasterId, salon, resources])

  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector("[data-active=true]")
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
      }
    }
  }, [])

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Заголовок */}
      <div className="flex items-center justify-between px-4 pt-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Мои записи</h1>
          <p className="text-sm text-muted-foreground">{formatDateRu(selectedDate)}, {isToday(selectedDate) ? "сегодня" : WEEKDAYS_RU[selectedDate.getDay()]}</p>
        </div>
        <button
          onClick={onAddBooking}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
          aria-label="Добавить запись"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Горизонтальный выбор дат */}
      <div ref={scrollRef} className="flex gap-1.5 overflow-x-auto px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
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

      {/* Таймлайн записей */}
      <div className="flex flex-col gap-2.5 px-4">
        <AnimatePresence mode="wait">
          {dayAppointments.length === 0 && resourceOccupiedByOthers.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-2 py-12 text-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
                <Clock className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Нет записей на этот день</p>
              <button onClick={onAddBooking} className="mt-1 text-sm font-medium text-primary">
                Добавить запись
              </button>
            </motion.div>
          ) : (
            <motion.div
              key={selectedStr}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-2.5"
            >
              {/* Мои записи */}
              {dayAppointments.map((apt, i) => (
                <motion.div
                  key={apt.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex gap-3"
                >
                  {/* Время слева */}
                  <div className="flex w-12 shrink-0 flex-col items-end pt-3">
                    <span className="text-sm font-semibold text-foreground">{apt.startTime}</span>
                    <span className="text-[10px] text-muted-foreground">{apt.endTime}</span>
                  </div>

                  {/* Линия таймлайна */}
                  <div className="flex flex-col items-center">
                    <div className="mt-3.5 h-2.5 w-2.5 rounded-full bg-primary" />
                    {i < dayAppointments.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border" />
                    )}
                  </div>

                  {/* Карточка */}
                  <div className="mb-2 flex-1 rounded-xl border border-border bg-card p-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-card-foreground">{apt.service.name}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                          <User className="h-3 w-3" />
                          <span className="text-xs">{apt.clientName}</span>
                        </div>
                      </div>
                      <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                        {apt.service.duration} мин
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}

              {/* Занятые ресурсы другими мастерами */}
              {resourceOccupiedByOthers.length > 0 && (
                <>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Занятые ресурсы
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  {resourceOccupiedByOthers.map((apt, i) => (
                    <motion.div
                      key={`occupied-${apt.id}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: (dayAppointments.length + i) * 0.05 }}
                      className="flex gap-3"
                    >
                      {/* Время слева */}
                      <div className="flex w-12 shrink-0 flex-col items-end pt-3">
                        <span className="text-sm font-medium text-muted-foreground">{apt.startTime}</span>
                        <span className="text-[10px] text-muted-foreground">{apt.endTime}</span>
                      </div>

                      {/* Линия таймлайна */}
                      <div className="flex flex-col items-center">
                        <div className="mt-3.5 h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                        {i < resourceOccupiedByOthers.length - 1 && (
                          <div className="w-0.5 flex-1 bg-border" />
                        )}
                      </div>

                      {/* Карточка занятого ресурса */}
                      <div className="mb-2 flex-1 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/50 p-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                              <Ban className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <Box className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground">
                                  {apt.resource?.name}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Занято: {apt.masterName}
                              </p>
                            </div>
                          </div>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {apt.service.duration} мин
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
