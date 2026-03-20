"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronRight, Check } from "lucide-react"
import type { Service, Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

interface AddBookingModalProps {
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

const START_TIMES = Array.from({ length: 19 }, (_, i) =>
  minutesToTime(9 * 60 + i * 30)
)

export function AddBookingModal({
  open,
  onClose,
  services,
  selectedDate,
  onAdd,
}: AddBookingModalProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [durationOverride, setDurationOverride] = useState<number>(0)
  const [clientName, setClientName] = useState("")

  const effectiveDuration =
    durationOverride || selectedService?.duration || 30

  const endTime = useMemo(() => {
    if (!selectedTime) return ""
    return minutesToTime(
      timeToMinutes(selectedTime) + effectiveDuration
    )
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

    const dateStr = `${selectedDate.getFullYear()}-${String(
      selectedDate.getMonth() + 1
    ).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`

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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-4xl rounded-2xl bg-background shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-lg font-semibold">Новая запись</h2>
            <p className="text-sm text-muted-foreground">
              {step === 0 && "Выберите услугу"}
              {step === 1 && "Выберите время"}
              {step === 2 && "Данные клиента"}
            </p>
          </div>

          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Закрыть
          </button>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">

          {/* LEFT */}
          <div>
            <AnimatePresence mode="wait">

              {/* STEP 1 */}
              {step === 0 && (
                <motion.div
                  key="step0"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  {services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedService(s)
                        setDurationOverride(s.duration)
                        setStep(1)
                      }}
                      className="flex items-center justify-between rounded-xl border p-4 text-left hover:shadow-md"
                    >
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {s.duration} мин — {s.price} ₽
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                </motion.div>
              )}

              {/* STEP 2 */}
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <div className="grid grid-cols-3 gap-2">
                    {START_TIMES.map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-sm",
                          selectedTime === t
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  {selectedTime && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>{selectedTime}</span>
                        <span className="text-primary">{endTime}</span>
                      </div>

                      <button
                        onClick={() => setStep(2)}
                        className="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
                      >
                        Далее
                      </button>
                    </>
                  )}
                </motion.div>
              )}

              {/* STEP 3 */}
              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-4"
                >
                  <input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Имя клиента"
                    className="rounded-xl border px-4 py-3"
                  />

                  <button
                    onClick={handleSubmit}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                  >
                    <Check className="h-4 w-4" />
                    Создать запись
                  </button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* RIGHT (summary panel) */}
          <div className="hidden lg:flex flex-col gap-4 border-l pl-6">
            <h3 className="font-semibold">Детали</h3>

            {selectedService && (
              <div>
                <p className="text-sm text-muted-foreground">Услуга</p>
                <p className="font-medium">{selectedService.name}</p>
              </div>
            )}

            {selectedTime && (
              <div>
                <p className="text-sm text-muted-foreground">Время</p>
                <p className="font-medium">
                  {selectedTime} — {endTime}
                </p>
              </div>
            )}

            {clientName && (
              <div>
                <p className="text-sm text-muted-foreground">Клиент</p>
                <p className="font-medium">{clientName}</p>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
