"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, Loader2 } from "lucide-react"

import { apiSchedules, type ApiSchedule } from "@/lib/api"
import { createDefaultWorkingHours, mapScheduleToHours } from "@/lib/mappers"
import type { WorkingHours as WorkingHoursType } from "@/lib/types"
import { Switch } from "@/components/ui/switch"

interface WorkingHoursProps {
  hours: WorkingHoursType[]
  onUpdate: (hours: WorkingHoursType[]) => void
  onBack: () => void
}

function toApiPayload(day: WorkingHoursType) {
  return {
    salonId: day.salonId,
    dayOfWeek: day.dayOfWeek,
    isEnabled: day.enabled,
    startTime: day.start,
    endTime: day.end,
  }
}

export function WorkingHoursScreen({ hours, onUpdate, onBack }: WorkingHoursProps) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [savingDay, setSavingDay] = useState<number | null>(null)

  useEffect(() => {
    if (loaded) return

    let cancelled = false

    const load = async () => {
      setLoading(true)

      try {
        const schedules = await apiSchedules.my()
        if (cancelled) return

        onUpdate(
          schedules.length > 0
            ? schedules.map(mapScheduleToHours)
            : createDefaultWorkingHours(),
        )
        setLoaded(true)
      } catch (error) {
        console.error("Load schedules failed:", error)
        if (!cancelled) {
          onUpdate(createDefaultWorkingHours())
          setLoaded(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [loaded, onUpdate])

  function updateLocalDay(index: number, nextDay: WorkingHoursType) {
    const updated = [...hours]
    updated[index] = nextDay
    onUpdate(updated)
  }

  function applySavedDay(index: number, savedDay: ApiSchedule) {
    const updated = [...hours]
    updated[index] = mapScheduleToHours(savedDay)
    onUpdate(updated)
  }

  async function persistDay(index: number, previousDay: WorkingHoursType, nextDay: WorkingHoursType) {
    if (nextDay.start >= nextDay.end) {
      updateLocalDay(index, previousDay)
      return
    }

    setSavingDay(nextDay.dayOfWeek)

    try {
      if (nextDay.scheduleId) {
        const saved = await apiSchedules.update(nextDay.scheduleId, toApiPayload(nextDay))
        applySavedDay(index, saved)
      } else if (nextDay.enabled) {
        const saved = await apiSchedules.create(toApiPayload(nextDay))
        applySavedDay(index, saved)
      }
    } catch (error) {
      console.error("Save schedule failed:", error)
      updateLocalDay(index, previousDay)
    } finally {
      setSavingDay(null)
    }
  }

  async function handleToggle(index: number) {
    const previousDay = hours[index]
    const nextDay = { ...previousDay, enabled: !previousDay.enabled }
    updateLocalDay(index, nextDay)
    await persistDay(index, previousDay, nextDay)
  }

  async function handleTimeChange(index: number, field: "start" | "end", value: string) {
    const previousDay = hours[index]
    const nextDay = { ...previousDay, [field]: value }
    updateLocalDay(index, nextDay)
    await persistDay(index, previousDay, nextDay)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Назад"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Рабочие часы</h1>
          <p className="text-sm text-muted-foreground">Настройте расписание</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {hours.map((day, index) => {
            const isSaving = savingDay === day.dayOfWeek

            return (
              <motion.div
                key={`${day.dayOfWeek}-${day.scheduleId ?? "default"}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Switch
                  checked={day.enabled}
                  onCheckedChange={() => void handleToggle(index)}
                  disabled={isSaving}
                />

                <span className={`w-24 text-sm font-medium ${day.enabled ? "text-card-foreground" : "text-muted-foreground"}`}>
                  {day.day}
                </span>

                {day.enabled ? (
                  <div className="flex flex-1 items-center gap-1.5">
                    <input
                      type="time"
                      value={day.start}
                      onChange={(event) => void handleTimeChange(index, "start", event.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      disabled={isSaving}
                    />
                    <span className="text-xs text-muted-foreground">-</span>
                    <input
                      type="time"
                      value={day.end}
                      onChange={(event) => void handleTimeChange(index, "end", event.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                      disabled={isSaving}
                    />
                  </div>
                ) : (
                  <span className="flex-1 text-xs text-muted-foreground">Выходной</span>
                )}

                {isSaving ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
