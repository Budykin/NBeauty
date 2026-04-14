"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { apiSchedules } from "@/lib/api"
import { mapScheduleToHours } from "@/lib/mappers"
import type { WorkingHours as WorkingHoursType } from "@/lib/types"

interface WorkingHoursProps {
  hours: WorkingHoursType[]
  onUpdate: (hours: WorkingHoursType[]) => void
  onBack: () => void
}

export function WorkingHoursScreen({ hours, onUpdate, onBack }: WorkingHoursProps) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Загружаем расписание с сервера при первом открытии
  useEffect(() => {
    if (loaded) return
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const schedules = await apiSchedules.my()
        if (!cancelled) {
          const mapped = schedules.map(mapScheduleToHours)
          onUpdate(mapped)
          setLoaded(true)
        }
      } catch (err) {
        console.error("Load schedules failed:", err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [loaded, onUpdate])

  async function handleToggle(index: number) {
    const updated = [...hours]
    updated[index] = { ...updated[index], enabled: !updated[index].enabled }
    onUpdate(updated)

    // TODO: синхронизация с API когда будет schedule_id в WorkingHours
  }

  async function handleTimeChange(index: number, field: "start" | "end", value: string) {
    const updated = [...hours]
    updated[index] = { ...updated[index], [field]: value }
    onUpdate(updated)

    // TODO: синхронизация с API когда будет schedule_id в WorkingHours
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
        {hours.map((h, i) => (
          <motion.div
            key={h.day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
          >
            <Switch checked={h.enabled} onCheckedChange={() => handleToggle(i)} />

            <span className={`w-24 text-sm font-medium ${h.enabled ? "text-card-foreground" : "text-muted-foreground"}`}>
              {h.day}
            </span>

            {h.enabled ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  type="time"
                  value={h.start}
                  onChange={(e) => handleTimeChange(i, "start", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <span className="text-xs text-muted-foreground">-</span>
                <input
                  type="time"
                  value={h.end}
                  onChange={(e) => handleTimeChange(i, "end", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            ) : (
              <span className="flex-1 text-xs text-muted-foreground">Выходной</span>
            )}
          </motion.div>
        ))}
      </div>
      )}
    </div>
  )
}
