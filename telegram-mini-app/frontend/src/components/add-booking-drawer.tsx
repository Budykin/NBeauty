"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Clock, Check } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer"
import { Slider } from "@/components/ui/slider"
import type { Service, Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AddBookingDrawerProps {
  open: boolean
  onClose: () => void
  services: Service[]
  selectedDate: Date
  onAdd: (apt: Appointment) => void
}

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number)
  return h * 60 + m
}

function minutesToTime(m: number) {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`
}

const START_TIMES = Array.from({ length: 19 }, (_, i) => minutesToTime(9 * 60 + i * 30))

export function AddBookingDrawer({ open, onClose, services, selectedDate, onAdd }: AddBookingDrawerProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [durationOverride, setDurationOverride] = useState<number>(0)
  const [clientName, setClientName] = useState("")

  const effectiveDuration = durationOverride || selectedService?.duration || 30

  const endTime = useMemo(() => {
    if (!selectedTime) return ""
    return minutesToTime(timeToMinutes(selectedTime) + effectiveDuration)
  }, [selectedTime, effectiveDuration])

  function handleReset() {
    setStep(0)
    setSelectedService(null)
    setSelectedTime(null)
    setDurationOverride(0)
    setClientName("")
  }

  function handleSubmit() {
    if (!selectedService || !selectedTime || !clientName.trim()) return
    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`
    onAdd({
      id: `a-${Date.now()}`,
      clientName: clientName.trim(),
      clientId: `c-${Date.now()}`,
      masterId: "m1",
      masterName: "Анна Петрова",
      service: selectedService,
      date: dateStr,
      startTime: selectedTime,
      endTime,
      status: "upcoming",
    })
    handleReset()
    onClose()
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          handleReset()
          onClose()
        }
      }}
    >
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Новая запись</DrawerTitle>
          <DrawerDescription>
            {step === 0 && "Выберите услугу"}
            {step === 1 && "Выберите время начала"}
            {step === 2 && "Укажите имя клиента"}
          </DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
          <AnimatePresence mode="wait">
            {/* Шаг 1: Выбор услуги */}
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-2"
              >
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelectedService(s)
                      setDurationOverride(s.duration)
                      setStep(1)
                    }}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
                  >
                    <div>
                      <p className="text-sm font-medium text-card-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.duration} мин - {s.price} &#8381;</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
              </motion.div>
            )}

            {/* Шаг 2: Время */}
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4"
              >
                {/* Время начала */}
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Время начала</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {START_TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          "rounded-lg border px-2 py-2 text-sm font-medium transition-all",
                          selectedTime === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-card-foreground hover:bg-secondary"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Слайдер длительности */}
                {selectedTime && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Длительность</p>
                      <div className="flex items-center gap-1 text-sm font-semibold text-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {effectiveDuration} мин
                      </div>
                    </div>
                    <Slider
                      min={15}
                      max={240}
                      step={5}
                      value={[effectiveDuration]}
                      onValueChange={([v]) => setDurationOverride(v)}
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{selectedTime}</span>
                      <span className="font-medium text-primary">{endTime}</span>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="mt-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98]"
                    >
                      Далее
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Шаг 3: Имя клиента */}
            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-4"
              >
                <div className="rounded-xl border border-border bg-secondary/50 p-3">
                  <p className="text-xs text-muted-foreground">Услуга</p>
                  <p className="text-sm font-medium text-foreground">{selectedService?.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selectedTime} - {endTime} ({effectiveDuration} мин)</p>
                </div>
                <div>
                  <label htmlFor="client-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Имя клиента
                  </label>
                  <input
                    id="client-name"
                    name="client-name"
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Введите имя"
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!clientName.trim()}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                  Создать запись
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
