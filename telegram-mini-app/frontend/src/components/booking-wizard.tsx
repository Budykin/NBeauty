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
const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

function getCalendarDays(year: number, month: number) {
  let firstDay = new Date(year, month, 1).getDay() - 1
  if (firstDay < 0) firstDay = 6

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = []

  for (let i = 0; i < firstDay; i += 1) days.push(null)
  for (let i = 1; i <= daysInMonth; i += 1) days.push(i)

  return days
}

function formatSlotTime(value: string) {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)
  if (!Number.isNaN(parsed.getTime())) {
    const hours = String(parsed.getHours()).padStart(2, "0")
    const minutes = String(parsed.getMinutes()).padStart(2, "0")
    return `${hours}:${minutes}`
  }

  return value
}

function toMinutes(timeStr: string) {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return hours * 60 + minutes
}

function addMinutes(timeStr: string, deltaMinutes: number) {
  const total = toMinutes(timeStr) + deltaMinutes
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function isFutureSlot(dateStr: string, timeStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number)
  const [hours, minutes] = timeStr.split(":").map(Number)
  const slotDate = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return slotDate.getTime() > Date.now()
}

function filterFutureSlots(slots: TimeSlot[], dateStr: string) {
  return slots.filter((slot) => isFutureSlot(dateStr, slot.start))
}

function pickNearestSlot(reference: string, slots: TimeSlot[]): TimeSlot | null {
  if (slots.length === 0) return null

  const referenceMinutes = toMinutes(reference)
  return slots.reduce((best, slot) => {
    const bestDiff = Math.abs(toMinutes(best.start) - referenceMinutes)
    const nextDiff = Math.abs(toMinutes(slot.start) - referenceMinutes)
    if (nextDiff < bestDiff) return slot
    if (nextDiff === bestDiff && toMinutes(slot.start) < toMinutes(best.start)) return slot
    return best
  })
}

function generateMockSlots(start: string, end: string, stepMinutes: number, durationMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  let cursor = toMinutes(start)
  const endMinutes = toMinutes(end)

  while (cursor + durationMinutes <= endMinutes) {
    const slotStart = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`
    slots.push({
      start: slotStart,
      end: addMinutes(slotStart, durationMinutes),
    })
    cursor += stepMinutes
  }

  return slots
}

export function BookingWizard({ master, onBack, onBook }: BookingWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedBaseStart, setSelectedBaseStart] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [availableSlots15, setAvailableSlots15] = useState<TimeSlot[]>([])
  const [availableSlots5, setAvailableSlots5] = useState<TimeSlot[]>([])
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

  const refinedSlots = useMemo(() => {
    if (!selectedBaseStart) return []

    const baseMinutes = toMinutes(selectedBaseStart)
    return availableSlots5
      .filter((slot) => Math.abs(toMinutes(slot.start) - baseMinutes) <= 30)
      .sort((left, right) => toMinutes(left.start) - toMinutes(right.start))
  }, [availableSlots5, selectedBaseStart])

  useEffect(() => {
    if (!selectedService || !selectedDateString || !selectedDateIsWorking) {
      setAvailableSlots15([])
      setAvailableSlots5([])
      setSelectedBaseStart(null)
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
          const duration = Math.max(1, selectedService.duration)
          const dev15 = generateMockSlots("09:00", "18:00", 15, duration)
          const dev5 = generateMockSlots("09:00", "18:00", 5, duration)
          if (cancelled) return
          setAvailableSlots15(filterFutureSlots(dev15, selectedDateString))
          setAvailableSlots5(filterFutureSlots(dev5, selectedDateString))
          return
        }

        const [slots15Raw, slots5Raw] = await Promise.all([
          apiMasters.slots(
            Number(master.id),
            Number(selectedService.id),
            selectedDateString,
            15,
          ),
          apiMasters.slots(
            Number(master.id),
            Number(selectedService.id),
            selectedDateString,
            5,
          ),
        ])

        if (cancelled) return

        const mapped15 = slots15Raw.map((slot) => ({
          start: formatSlotTime(slot.start),
          end: formatSlotTime(slot.end),
        }))
        const mapped5 = slots5Raw.map((slot) => ({
          start: formatSlotTime(slot.start),
          end: formatSlotTime(slot.end),
        }))

        setAvailableSlots15(filterFutureSlots(mapped15, selectedDateString))
        setAvailableSlots5(filterFutureSlots(mapped5, selectedDateString))
      } catch {
        if (!cancelled) {
          setAvailableSlots15([])
          setAvailableSlots5([])
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

  useEffect(() => {
    setSelectedBaseStart((previous) => {
      if (!previous) return previous
      return availableSlots15.some((slot) => slot.start === previous) ? previous : null
    })

    setSelectedSlot((previous) => {
      if (!previous) return previous
      return availableSlots5.some((slot) => slot.start === previous.start && slot.end === previous.end)
        ? previous
        : null
    })
  }, [availableSlots15, availableSlots5])

  useEffect(() => {
    if (!selectedBaseStart) {
      setSelectedSlot(null)
      return
    }

    if (refinedSlots.length === 0) {
      setSelectedSlot(null)
      return
    }

    setSelectedSlot((previous) => {
      if (previous && refinedSlots.some((slot) => slot.start === previous.start && slot.end === previous.end)) {
        return previous
      }
      return pickNearestSlot(selectedBaseStart, refinedSlots)
    })
  }, [refinedSlots, selectedBaseStart])

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
                  setSelectedBaseStart(null)
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
                      setSelectedBaseStart(null)
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

            {!slotsLoading && !slotError && availableSlots15.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                {selectedDateIsWorking
                  ? "На выбранную дату нет свободных слотов."
                  : "Мастер не работает в выбранный день."}
              </div>
            ) : null}

            {!slotsLoading && availableSlots15.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2">
                  {availableSlots15.map((slot) => (
                    <button
                      key={`${slot.start}-${slot.end}`}
                      onClick={() => setSelectedBaseStart(slot.start)}
                      className={cn(
                        "rounded-lg border py-2.5 text-sm font-medium transition-all",
                        selectedBaseStart === slot.start
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card text-foreground hover:bg-secondary",
                      )}
                    >
                      {slot.start}
                    </button>
                  ))}
                </div>

                {selectedBaseStart && refinedSlots.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col gap-3"
                  >
                    <p className="text-xs font-medium text-muted-foreground">Уточните время</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {refinedSlots.map((slot) => (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          onClick={() => setSelectedSlot(slot)}
                          className={cn(
                            "min-w-24 rounded-lg border px-4 py-3 text-sm font-medium transition-all",
                            selectedSlot?.start === slot.start
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card text-foreground hover:bg-secondary",
                          )}
                        >
                          {slot.start}
                        </button>
                      ))}
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
