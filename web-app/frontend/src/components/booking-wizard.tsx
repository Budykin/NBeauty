"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, Check } from "lucide-react"
import type { Master, Service, Appointment } from "@/lib/types"
import { cn } from "@/lib/utils"

const MONTHS_RU = [
  "Январь","Февраль","Март","Апрель","Май","Июнь",
  "Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь",
]
const WEEKDAYS_SHORT = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"]

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

interface BookingWizardProps {
  master: Master
  onBack: () => void
  onBook: (appointment: Appointment) => void
}

export function BookingWizard({ master, onBack, onBook }: BookingWizardProps) {
  const [step, setStep] = useState(0)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const today = new Date()
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const viewYear = today.getFullYear()

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

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary">
          <ChevronLeft />
        </button>

        <div>
          <h1 className="text-xl font-semibold">
            Запись к {master.name}
          </h1>
          <p className="text-sm text-muted-foreground">{master.specialty}</p>
        </div>
      </div>

      {/* LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT (main flow) */}
        <div className="lg:col-span-2">

          <AnimatePresence mode="wait">

            {/* STEP 1 */}
            {step === 0 && (
              <motion.div key="step0" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <h2 className="mb-4 font-semibold">Выберите услугу</h2>

                <div className="grid sm:grid-cols-2 gap-4">
                  {master.services.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedService(s)
                        setStep(1)
                      }}
                      className="border rounded-xl p-4 text-left hover:shadow-md transition"
                    >
                      <p className="font-medium">{s.name}</p>
                      <p className="text-sm text-muted-foreground">{s.duration} мин</p>
                      <p className="mt-2 font-semibold">{s.price} ₽</p>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 1 && (
              <motion.div key="step1" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <h2 className="mb-4 font-semibold">Выберите дату</h2>

                {/* calendar */}
                <div className="border rounded-xl p-4">
                  <div className="flex justify-between mb-3">
                    <button onClick={() => setViewMonth((prev) => Math.max(prev - 1, 0))}>‹</button>
                    <span>{MONTHS_RU[viewMonth]} {viewYear}</span>
                    <button onClick={() => setViewMonth((prev) => Math.min(prev + 1, 11))}>›</button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center">
                    {WEEKDAYS_SHORT.map((d) => <span key={d}>{d}</span>)}
                    {calendarDays.map((day,i)=>(
                      <button
                        key={i}
                        disabled={!day || isDateDisabled(day)}
                        onClick={()=>{
                          if (!day) return
                          setSelectedDate(new Date(viewYear,viewMonth,day))
                          setStep(2)
                        }}
                        className="h-10 rounded-lg hover:bg-secondary"
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 3 */}
            {step === 2 && (
              <motion.div key="step2" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
                <h2 className="mb-4 font-semibold">Выберите время</h2>

                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {timeSlots.map(slot => (
                    <button
                      key={slot}
                      onClick={()=>setSelectedSlot(slot)}
                      className={cn(
                        "border rounded-lg py-2",
                        selectedSlot === slot && "bg-primary text-white"
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>

                {selectedSlot && (
                  <button
                    onClick={handleBook}
                    className="mt-6 w-full lg:w-auto px-6 py-3 rounded-xl bg-primary text-white"
                  >
                    <Check className="inline mr-2 h-4 w-4"/>
                    Записаться
                  </button>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* RIGHT (sticky summary) */}
        <div className="hidden lg:block">
          <div className="sticky top-6 border rounded-xl p-4 space-y-3">
            <h3 className="font-semibold">Детали записи</h3>

            {selectedService && (
              <div>
                <p className="text-sm text-muted-foreground">Услуга</p>
                <p>{selectedService.name}</p>
              </div>
            )}

            {selectedDate && (
              <div>
                <p className="text-sm text-muted-foreground">Дата</p>
                <p>{selectedDate.toLocaleDateString()}</p>
              </div>
            )}

            {selectedSlot && (
              <div>
                <p className="text-sm text-muted-foreground">Время</p>
                <p>{selectedSlot}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
