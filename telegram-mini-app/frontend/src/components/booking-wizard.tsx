"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Check, Star, CalendarDays, Clock as ClockIcon } from "lucide-react"
import type { Master, Service, Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BookingWizardProps {
  master: Master
  onBack: () => void
  onBook: (apt: Appointment) => void
}

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]
const WEEKDAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]

function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)
  return days
}

function generateTimeSlots() {
  const slots: string[] = []
  for (let h = 9; h <= 18; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`)
    if (h < 18) slots.push(`${String(h).padStart(2, "0")}:30`)
  }
  return slots
}

export function BookingWizard({ master, onBack, onBook }: BookingWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewYear, viewMonth])
  const timeSlots = useMemo(() => generateTimeSlots(), [])

  function isDateDisabled(day: number) {
    const d = new Date(viewYear, viewMonth, day)
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return d < t
  }

  function handleBook() {
    if (!selectedService || !selectedDate || !selectedSlot) return
    const [h, m] = selectedSlot.split(":").map(Number)
    const endMin = h * 60 + m + selectedService.duration
    const endTime = `${String(Math.floor(endMin / 60)).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`

    onBook({
      id: `a-${Date.now()}`,
      clientName: "Вы",
      clientId: "client-self",
      masterId: master.id,
      masterName: master.name,
      service: selectedService,
      date: dateStr,
      startTime: selectedSlot,
      endTime,
      status: "upcoming",
    })
  }

  const steps = [
    { label: "Услуга", icon: Star },
    { label: "Дата", icon: CalendarDays },
    { label: "Время", icon: ClockIcon },
  ]

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      {/* Шапка */}
      <div className="flex items-center gap-3">
        <button
          onClick={step > 0 ? () => setStep(step - 1) : onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Запись к {master.name}</p>
          <p className="text-xs text-muted-foreground">{master.specialty}</p>
        </div>
      </div>

      {/* Прогресс */}
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s.label}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all",
              i <= step
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground"
            )}
          >
            <s.icon className="h-3 w-3" />
            {s.label}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Шаг 1: Услуга */}
        {step === 0 && (
          <motion.div
            key="wiz-step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-2"
          >
            {master.services.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedService(s)
                  setStep(1)
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  selectedService?.id === s.id
                    ? "border-primary bg-accent"
                    : "border-border bg-card"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.duration} мин</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{s.price} &#8381;</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Шаг 2: Дата */}
        {step === 1 && (
          <motion.div
            key="wiz-step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-3"
          >
            {/* Навигация месяца */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11)
                    setViewYear(viewYear - 1)
                  } else {
                    setViewMonth(viewMonth - 1)
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-foreground">
                {MONTHS_RU[viewMonth]} {viewYear}
              </span>
              <button
                onClick={() => {
                  if (viewMonth === 11) {
                    setViewMonth(0)
                    setViewYear(viewYear + 1)
                  } else {
                    setViewMonth(viewMonth + 1)
                  }
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Следующий месяц"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            {/* Дни недели */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS_SHORT.map((d) => (
                <span key={d} className="text-[10px] font-medium text-muted-foreground">{d}</span>
              ))}
            </div>

            {/* Дни */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />
                const disabled = isDateDisabled(day)
                const isSelected = selectedDate?.getDate() === day && selectedDate?.getMonth() === viewMonth && selectedDate?.getFullYear() === viewYear
                const todayMatch = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear
                return (
                  <button
                    key={day}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedDate(new Date(viewYear, viewMonth, day))
                      setStep(2)
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-all",
                      disabled && "text-muted-foreground/40",
                      !disabled && !isSelected && "text-foreground hover:bg-secondary",
                      isSelected && "bg-primary text-primary-foreground",
                      todayMatch && !isSelected && "bg-accent text-accent-foreground"
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* Шаг 3: Время */}
        {step === 2 && (
          <motion.div
            key="wiz-step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs font-medium text-muted-foreground">Выберите время</p>
            <div className="grid grid-cols-4 gap-2">
              {timeSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => setSelectedSlot(slot)}
                  className={cn(
                    "rounded-lg border py-2.5 text-sm font-medium transition-all",
                    selectedSlot === slot
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-secondary"
                  )}
                >
                  {slot}
                </button>
              ))}
            </div>

            {selectedSlot && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                {/* Сводка */}
                <div className="rounded-xl border border-border bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">Сводка записи</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedService?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDate?.getDate()}.{selectedDate && String(selectedDate.getMonth() + 1).padStart(2, "0")}.{selectedDate?.getFullYear()} в {selectedSlot}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-primary">{selectedService?.price} &#8381;</p>
                </div>

                <button
                  onClick={handleBook}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
                >
                  <Check className="h-4 w-4" />
                  Записаться
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
