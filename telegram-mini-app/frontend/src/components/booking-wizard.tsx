"use client"

import { useEffect, useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Check, Loader2, Star, CalendarDays, Clock as ClockIcon } from "lucide-react"

import { apiMasters } from "@/lib/api"
import { IS_DEV_AUTH_BYPASS } from "@/lib/auth"
import type { Appointment, Master, Service } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BookingWizardProps {
  master: Master
  onBack: () => void
  onBook: (apt: Appointment) => void
}

type TimeSlot = {
  start: string
  end: string
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

  for (let i = 0; i < firstDay; i += 1) days.push(null)
  for (let i = 1; i <= daysInMonth; i += 1) days.push(i)

  return days
}

function formatSlotTime(value: string) {
  // Сначала попробуем извлечь время напрямую из ISO формата
  // Форматы: "2026-05-02T14:00:00+03:00" или "2026-05-02T14:00:00Z"
  const timeMatch = value.match(/T(\d{2}):(\d{2})/)
  if (timeMatch) {
    return `${timeMatch[1]}:${timeMatch[2]}`
  }

  // Fallback - если это просто "HH:MM"
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value
  }

  // Последний resort - парсим как Date (но это менее надёжно)
  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    // Извлекаем локальные часы и минуты, избегаем toTimeString() для consistency
    const hours = String(parsed.getHours()).padStart(2, "0")
    const minutes = String(parsed.getMinutes()).padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return value
}

// Функция для добавления/вычитания минут к времени
function addMinutesToTime(timeStr: string, minutes: number): string {
  const [hours, mins] = timeStr.split(":").map(Number)
  let totalMinutes = hours * 60 + mins + minutes
  
  // Обработка перехода через границы часов
  const newHours = Math.floor(totalMinutes / 60) % 24
  const newMins = totalMinutes % 60
  
  return `${String(newHours).padStart(2, "0")}:${String(newMins).padStart(2, "0")}`
}

// Функция для создания соседних слотов с шагом 10 минут
function generateAdjacentSlots(
  slot: TimeSlot,
  allSlots: TimeSlot[],
  stepMinutes: number = 10
): TimeSlot[] {
  const result: TimeSlot[] = []
  const currentIndex = allSlots.findIndex(s => s.start === slot.start)
  
  if (currentIndex === -1) return [slot]
  
  const isFirst = currentIndex === 0
  const isLast = currentIndex === allSlots.length - 1
  
  // Добавляем слот слева (если не первый)
  if (!isFirst) {
    const prevSlot: TimeSlot = {
      start: addMinutesToTime(slot.start, -stepMinutes),
      end: slot.start,
    }
    result.push(prevSlot)
  }
  
  // Добавляем выбранный слот
  result.push(slot)
  
  // Добавляем слот справа (если не последний)
  if (!isLast) {
    const nextSlot: TimeSlot = {
      start: slot.end,
      end: addMinutesToTime(slot.end, stepMinutes),
    }
    result.push(nextSlot)
  }
  
  return result
}

export function BookingWizard({ master, onBack, onBook }: BookingWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotError, setSlotError] = useState<string | null>(null)

  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const calendarDays = useMemo(() => getCalendarDays(viewYear, viewMonth), [viewMonth, viewYear])
  const selectedDateString = selectedDate
    ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    : null
  const selectedWorkingDay = selectedDate
    ? master.workingHours?.find((day) => day.dayOfWeek === ((selectedDate.getDay() + 6) % 7))
    : undefined
  const selectedDateIsWorking = selectedWorkingDay?.enabled ?? true

  useEffect(() => {
    if (!selectedService || !selectedDateString || !selectedDateIsWorking) {
      setAvailableSlots([])
      setSelectedSlot(null)
      setSlotError(null)
      return
    }

    let cancelled = false

    const loadSlots = async () => {
      setSlotsLoading(true)
      setSlotError(null)

      try {
        if (IS_DEV_AUTH_BYPASS) {
          setAvailableSlots([
            { start: "09:00", end: "10:00" },
            { start: "10:30", end: "11:30" },
            { start: "12:00", end: "13:00" },
            { start: "15:00", end: "16:00" },
            { start: "17:00", end: "18:00" },
          ])
          return
        }

        const slots = await apiMasters.slots(
          Number(master.id),
          Number(selectedService.id),
          selectedDateString,
        )

        if (cancelled) return

        setAvailableSlots(
          slots.map((slot) => ({
            start: formatSlotTime(slot.start),
            end: formatSlotTime(slot.end),
          })),
        )
      } catch {
        if (!cancelled) {
          setAvailableSlots([])
          setSlotError("Не удалось получить свободные слоты. Попробуй выбрать другую дату.")
        }
      } finally {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      }
    }

    void loadSlots()

    return () => {
      cancelled = true
    }
  }, [master.id, selectedDateIsWorking, selectedDateString, selectedService])

  function isDateDisabled(day: number) {
    const date = new Date(viewYear, viewMonth, day)
    const cutoff = new Date()
    cutoff.setHours(0, 0, 0, 0)
    if (date < cutoff) return true

    const workingDay = master.workingHours?.find(
      (hours) => hours.dayOfWeek === ((date.getDay() + 6) % 7),
    )
    return workingDay ? !workingDay.enabled : false
  }

  function handleBook() {
    if (!selectedService || !selectedDateString || !selectedSlot) return

    onBook({
      id: `a-${Date.now()}`,
      clientName: "Вы",
      clientId: "client-self",
      masterId: master.id,
      masterName: master.name,
      service: selectedService,
      date: selectedDateString,
      startTime: selectedSlot.start,
      endTime: selectedSlot.end,
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

      <div className="flex gap-1.5">
        {steps.map((stepItem, index) => (
          <div
            key={stepItem.label}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium transition-all",
              index <= step
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground",
            )}
          >
            <stepItem.icon className="h-3 w-3" />
            {stepItem.label}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div
            key="wiz-step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-2"
          >
            {master.services.length > 0 ? master.services.map((service) => (
              <button
                key={service.id}
                onClick={() => {
                  setSelectedService(service)
                  setSelectedDate(null)
                  setSelectedSlot(null)
                  setStep(1)
                }}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                  selectedService?.id === service.id
                    ? "border-primary bg-accent"
                    : "border-border bg-card",
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{service.name}</p>
                  <p className="text-xs text-muted-foreground">{service.duration} мин</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{service.price} &#8381;</span>
              </button>
            )) : (
              <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                У этого мастера пока нет опубликованных услуг.
              </div>
            )}
          </motion.div>
        ) : null}

        {step === 1 ? (
          <motion.div
            key="wiz-step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (viewMonth === 0) {
                    setViewMonth(11)
                    setViewYear(viewYear - 1)
                    return
                  }

                  setViewMonth(viewMonth - 1)
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
                    return
                  }

                  setViewMonth(viewMonth + 1)
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Следующий месяц"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAYS_SHORT.map((weekday) => (
                <span key={weekday} className="text-[10px] font-medium text-muted-foreground">
                  {weekday}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} />
                }

                const disabled = isDateDisabled(day)
                const isSelected = selectedDate?.getDate() === day
                  && selectedDate?.getMonth() === viewMonth
                  && selectedDate?.getFullYear() === viewYear
                const isToday = today.getDate() === day
                  && today.getMonth() === viewMonth
                  && today.getFullYear() === viewYear

                return (
                  <button
                    key={day}
                    disabled={disabled}
                    onClick={() => {
                      setSelectedDate(new Date(viewYear, viewMonth, day))
                      setSelectedSlot(null)
                      setStep(2)
                    }}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg text-sm font-medium transition-all",
                      disabled && "text-muted-foreground/40",
                      !disabled && !isSelected && "text-foreground hover:bg-secondary",
                      isSelected && "bg-primary text-primary-foreground",
                      isToday && !isSelected && "bg-accent text-accent-foreground",
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </motion.div>
        ) : null}

        {step === 2 ? (
          <motion.div
            key="wiz-step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex flex-col gap-4"
          >
            <p className="text-xs font-medium text-muted-foreground">Выберите время</p>

            {slotsLoading ? (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ищем свободные слоты...
              </div>
            ) : null}

            {!slotsLoading && slotError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {slotError}
              </div>
            ) : null}

            {!slotsLoading && !slotError && availableSlots.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                {selectedDateIsWorking
                  ? "На выбранную дату нет свободных слотов."
                  : "Мастер не работает в выбранный день."}
              </div>
            ) : null}

            {!slotsLoading && availableSlots.length > 0 ? (
              <div className="flex flex-col gap-3">
                {/* Основная сетка слотов */}
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      onClick={() => setSelectedSlot(slot)}
                      className={cn(
                        "rounded-lg border py-2.5 text-sm font-medium transition-all",
                        selectedSlot?.start === slot.start
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                    >
                      {slot.start}
                    </button>
                  ))}
                </div>

                {/* Уточненное время - соседние слоты с шагом 10 минут */}
                {selectedSlot ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-2"
                  >
                    <p className="text-xs font-medium text-muted-foreground">Уточните время</p>
                    <div className="flex gap-2 justify-center">
                      {generateAdjacentSlots(selectedSlot, availableSlots).map((slot) => {
                        const isSelected = selectedSlot.start === slot.start
                        const isAdjacent = selectedSlot.start !== slot.start
                        
                        return (
                          <button
                            key={`${slot.start}-${slot.end}`}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              "rounded-lg border px-3 py-2 text-xs font-medium transition-all",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-card text-foreground hover:bg-secondary",
                              isAdjacent && "opacity-70 hover:opacity-100",
                            )}
                          >
                            {slot.start}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </div>
            ) : null}

            {selectedSlot ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3"
              >
                <div className="rounded-xl border border-border bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">Сводка записи</p>
                  <p className="mt-1 text-sm font-medium text-foreground">{selectedService?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedDate?.getDate()}.{selectedDate && String(selectedDate.getMonth() + 1).padStart(2, "0")}.{selectedDate?.getFullYear()} в {selectedSlot.start}
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
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
