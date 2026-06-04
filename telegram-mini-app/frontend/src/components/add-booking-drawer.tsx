"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CalendarDays, Check, Clock3, Loader2, Plus, UserRound, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiAppointments, apiClients, apiMasters } from "@/lib/api"
import { IS_DEV_AUTH_BYPASS } from "@/lib/auth"
import { mapAppointment, mapClient, mapClients } from "@/lib/mappers"
import type { Appointment, ClientRecord, Service } from "@/lib/types"

interface AddBookingDrawerProps {
  open: boolean
  onClose: () => void
  masterId: string
  services: Service[]
  selectedDate: Date
  onCreated: (appointment: Appointment) => void
}

type ClientMode = "existing" | "new"
type TimeSlot = {
  start: string
  end: string
}

const PHONE_ALLOWED_PATTERN = /^\+?[0-9\s()-]+$/

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function formatSlotTime(value: string) {
  if (/^\d{2}:\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`
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

function generateMockSlots(durationMinutes: number, stepMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let cursor = 9 * 60; cursor + durationMinutes <= 18 * 60; cursor += stepMinutes) {
    const start = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`
    slots.push({ start, end: addMinutes(start, durationMinutes) })
  }
  return slots
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

function getTelephoneNumberError(value: string) {
  const normalized = value.trim()
  if (!normalized) return "Укажи номер телефона"

  const digitsCount = normalized.replace(/\D/g, "").length
  const hasValidChars = PHONE_ALLOWED_PATTERN.test(normalized)
  const hasValidPlusPlacement =
    normalized.indexOf("+") <= 0 &&
    (normalized.match(/\+/g)?.length || 0) <= 1

  if (!hasValidChars || !hasValidPlusPlacement || digitsCount < 5 || digitsCount > 15) {
    return "Укажи корректный номер телефона"
  }

  return null
}

function sanitizeTelephoneInput(value: string) {
  let result = ""

  for (const char of value) {
    if (/\d/.test(char) || char === " " || char === "(" || char === ")" || char === "-") {
      result += char
      continue
    }

    if (char === "+" && result.length === 0 && !value.slice(0, value.indexOf(char)).includes("+")) {
      result += char
    }
  }

  return result
}

function toOffsetDateTime(date: string, time: string) {
  const localDate = new Date(`${date}T${time}:00`)
  const offset = localDate.getTimezoneOffset()
  const absOffset = Math.abs(offset)
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0")
  const offsetMinutes = String(absOffset % 60).padStart(2, "0")
  const sign = offset <= 0 ? "+" : "-"

  return `${date}T${time}:00${sign}${offsetHours}:${offsetMinutes}`
}

export function AddBookingDrawer({
  open,
  onClose,
  masterId,
  services,
  selectedDate,
  onCreated,
}: AddBookingDrawerProps) {
  const [drawerServices, setDrawerServices] = useState<Service[]>([])
  const [clientMode, setClientMode] = useState<ClientMode>("existing")
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError, setClientsError] = useState<string | null>(null)
  const [clientQuery, setClientQuery] = useState("")
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [selectedDateValue, setSelectedDateValue] = useState("")
  const [availableSlots15, setAvailableSlots15] = useState<TimeSlot[]>([])
  const [availableSlots5, setAvailableSlots5] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedBaseStart, setSelectedBaseStart] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftPhone, setDraftPhone] = useState("")
  const [draftPhoneTouched, setDraftPhoneTouched] = useState(false)
  const [draftNote, setDraftNote] = useState("")
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const refineContainerRef = useRef<HTMLDivElement | null>(null)
  const wasOpenRef = useRef(false)

  const selectedService = useMemo(
    () => drawerServices.find((service) => service.id === selectedServiceId) ?? null,
    [drawerServices, selectedServiceId],
  )
  const selectedClient = useMemo(
    () => clients.find((client) => `${client.type}-${client.id}` === selectedClientKey) ?? null,
    [clients, selectedClientKey],
  )
  const filteredClients = useMemo(() => {
    const query = clientQuery.trim().toLowerCase()
    if (!query) return clients

    return clients.filter((client) => {
      const haystack = `${client.fullName} ${client.telephoneNumber ?? ""}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [clientQuery, clients])
  const refinedSlots = useMemo(() => {
    if (!selectedBaseStart) return []

    const baseMinutes = toMinutes(selectedBaseStart)
    return availableSlots5
      .filter((slot) => Math.abs(toMinutes(slot.start) - baseMinutes) <= 30)
      .sort((left, right) => toMinutes(left.start) - toMinutes(right.start))
  }, [availableSlots5, selectedBaseStart])
  const selectedSlotSummary = useMemo(
    () => (selectedSlot ? `${selectedDateValue} · ${selectedSlot.start} - ${selectedSlot.end}` : null),
    [selectedDateValue, selectedSlot],
  )
  const draftPhoneError = getTelephoneNumberError(draftPhone)
  const shouldShowDraftPhoneError = draftPhoneTouched && draftPhoneError !== null

  const loadClients = useCallback(async () => {
    try {
      setClientsLoading(true)
      setClientsError(null)
      const response = await apiClients.list()
      const mapped = mapClients(response)
      setClients(mapped)
      if (mapped.length === 0) {
        setClientMode("new")
      }
    } catch (error) {
      console.error("Load clients for booking failed:", error)
      setClients([])
      setClientsError("Не удалось загрузить список клиентов.")
      setClientMode("new")
    } finally {
      setClientsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false
      return
    }
    if (wasOpenRef.current) return

    wasOpenRef.current = true

    setDrawerServices(services.map((service) => ({ ...service })))
    setClientMode("existing")
    setClientQuery("")
    setSelectedClientKey(null)
    setSelectedServiceId("")
    setSelectedDateValue(formatDateInput(selectedDate))
    setAvailableSlots15([])
    setAvailableSlots5([])
    setSlotsError(null)
    setSelectedBaseStart(null)
    setSelectedSlot(null)
    setDraftName("")
    setDraftPhone("")
    setDraftPhoneTouched(false)
    setDraftNote("")
    setSubmitPending(false)
    setSubmitError(null)

    if (IS_DEV_AUTH_BYPASS) {
      setClients([])
      setClientsLoading(false)
      setClientsError(null)
      setClientMode("new")
      return
    }

    void loadClients()
  }, [loadClients, open, selectedDate, services])

  useEffect(() => {
    if (!open || !selectedService || !selectedDateValue) {
      setAvailableSlots15([])
      setAvailableSlots5([])
      setSlotsError(null)
      setSelectedBaseStart(null)
      setSelectedSlot(null)
      return
    }

    let cancelled = false

    const loadSlots = async () => {
      setSlotsLoading(true)
      setSlotsError(null)

      try {
        if (IS_DEV_AUTH_BYPASS) {
          const duration = Math.max(1, selectedService.duration)
          if (cancelled) return
          setAvailableSlots15(filterFutureSlots(generateMockSlots(duration, 15), selectedDateValue))
          setAvailableSlots5(filterFutureSlots(generateMockSlots(duration, 5), selectedDateValue))
          return
        }

        const [slots15Raw, slots5Raw] = await Promise.all([
          apiMasters.slots(
            Number(masterId),
            Number(selectedService.id),
            selectedDateValue,
            15,
          ),
          apiMasters.slots(
            Number(masterId),
            Number(selectedService.id),
            selectedDateValue,
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

        setAvailableSlots15(filterFutureSlots(mapped15, selectedDateValue))
        setAvailableSlots5(filterFutureSlots(mapped5, selectedDateValue))
      } catch (error) {
        if (cancelled) return

        console.error("Load master slots failed:", error)
        setAvailableSlots15([])
        setAvailableSlots5([])
        setSlotsError("Не удалось загрузить свободное время. Попробуй другую дату или услугу.")
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
  }, [masterId, open, selectedDateValue, selectedServiceId, selectedService])

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

  useEffect(() => {
    if (!selectedSlot?.start || !refineContainerRef.current) return

    const element = refineContainerRef.current.querySelector<HTMLButtonElement>(
      `[data-slot="${selectedSlot.start}"]`,
    )
    element?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [selectedSlot?.start, refinedSlots.length])

  async function handleSubmit() {
    if (!selectedService || !selectedDateValue || !selectedSlot) return

    setSubmitError(null)
    setDraftPhoneTouched(true)

    try {
      setSubmitPending(true)

      let bookingTarget: ClientRecord
      if (clientMode === "existing") {
        if (!selectedClient) {
          setSubmitError("Выбери клиента для записи.")
          return
        }
        bookingTarget = selectedClient
      } else {
        if (!draftName.trim()) {
          setSubmitError("Укажи имя клиента.")
          return
        }
        if (draftPhoneError) {
          setSubmitError(draftPhoneError)
          return
        }

        if (IS_DEV_AUTH_BYPASS) {
          bookingTarget = {
            id: `guest-${Date.now()}`,
            type: "guest",
            fullName: draftName.trim(),
            telephoneNumber: draftPhone.trim(),
            note: draftNote.trim(),
            appointmentsCount: 0,
          }
        } else {
          const createdGuest = mapClient(
            await apiClients.createGuest({
              fullName: draftName.trim(),
              telephoneNumber: draftPhone.trim(),
              note: draftNote.trim() || "",
            }),
          )
          bookingTarget = createdGuest
        }
      }

      if (IS_DEV_AUTH_BYPASS) {
        onCreated({
          id: `a-${Date.now()}`,
          clientName: bookingTarget.fullName,
          clientId: bookingTarget.type === "registered" ? bookingTarget.id : undefined,
          guestClientId: bookingTarget.type === "guest" ? bookingTarget.id : undefined,
          masterId,
          masterName: "Анна Петрова",
          service: selectedService,
          date: selectedDateValue,
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
          status: "pending",
          resourceId: selectedService.resourceId,
        })
        onClose()
        return
      }

      const created = await apiAppointments.create({
        masterId: Number(masterId),
        serviceId: Number(selectedService.id),
        startTime: toOffsetDateTime(selectedDateValue, selectedSlot.start),
        ...(bookingTarget.type === "registered"
          ? { clientId: Number(bookingTarget.id) }
          : { guestClientId: Number(bookingTarget.id) }),
      })

      onCreated(mapAppointment(created))
      onClose()
    } catch (error) {
      console.error("Create appointment as master failed:", error)
      setSubmitError(error instanceof ApiError ? error.message : "Не удалось создать запись.")
    } finally {
      setSubmitPending(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex h-svh flex-col bg-background">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 pb-4 pt-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Новая запись</h2>
          <p className="text-sm text-muted-foreground">Выбери клиента, услугу, дату и свободное время.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
          aria-label="Закрыть форму создания записи"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
          <div className="flex flex-col gap-4">
            {submitError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {submitError}
              </div>
            ) : null}

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-card-foreground">Клиент</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setClientMode("existing")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    clientMode === "existing"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  Существующий
                </button>
                <button
                  type="button"
                  onClick={() => setClientMode("new")}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                    clientMode === "new"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  Новый гость
                </button>
              </div>

              {clientMode === "existing" ? (
                <div className="mt-3 flex flex-col gap-3">
                  <Input
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Поиск по имени или телефону"
                    className="rounded-xl border-border bg-background"
                  />

                  {clientsError ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                      {clientsError}
                    </div>
                  ) : null}

                  {clientsLoading ? (
                    <div className="rounded-xl border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                      Загружаем клиентов...
                    </div>
                  ) : null}

                  {!clientsLoading ? (
                    filteredClients.length > 0 ? (
                      <div className="flex max-h-52 flex-col gap-2 overflow-y-auto pr-1">
                        {filteredClients.map((client) => {
                          const isSelected = selectedClientKey === `${client.type}-${client.id}`
                          return (
                            <button
                              key={`${client.type}-${client.id}`}
                              type="button"
                              onClick={() => setSelectedClientKey(`${client.type}-${client.id}`)}
                              className={`rounded-xl border p-3 text-left transition-all ${
                                isSelected
                                  ? "border-primary bg-accent"
                                  : "border-border bg-background"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-foreground">{client.fullName}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {client.telephoneNumber || "Телефон не указан"}
                                  </p>
                                </div>
                                <span className="rounded-md bg-secondary px-2 py-1 text-[11px] font-medium text-secondary-foreground">
                                  {client.type === "registered" ? "registered" : "guest"}
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                        Клиенты не найдены. Можно добавить нового гостя.
                      </div>
                    )
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-3">
                  <Input
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    placeholder="Имя клиента"
                    className="rounded-xl border-border bg-background"
                  />
                  <div className="space-y-1.5">
                    <Input
                      value={draftPhone}
                      onBlur={() => setDraftPhoneTouched(true)}
                      onChange={(event) => {
                        setDraftPhone(sanitizeTelephoneInput(event.target.value))
                        setDraftPhoneTouched(true)
                      }}
                      placeholder="Телефон"
                      inputMode="tel"
                      className={`rounded-xl border-border bg-background ${
                        shouldShowDraftPhoneError
                          ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20"
                          : ""
                      }`}
                    />
                    {shouldShowDraftPhoneError ? (
                      <p className="px-1 text-xs text-destructive">{draftPhoneError}</p>
                    ) : null}
                  </div>
                  <Textarea
                    value={draftNote}
                    onChange={(event) => setDraftNote(event.target.value)}
                    placeholder="Заметка (необязательно)"
                    rows={4}
                    className="rounded-xl border-border bg-background"
                  />
                </div>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-card-foreground">Услуга</p>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {drawerServices.length > 0 ? (
                  drawerServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(service.id)
                        setSelectedBaseStart(null)
                        setSelectedSlot(null)
                      }}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        selectedServiceId === service.id
                          ? "border-primary bg-accent"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">{service.name}</p>
                          <p className="text-xs text-muted-foreground">{service.duration} мин</p>
                        </div>
                        <span className="text-sm font-semibold text-foreground">{service.price} &#8381;</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="rounded-xl border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                    Сначала добавь хотя бы одну услугу.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-card-foreground">Дата</p>
              </div>
              <Input
                type="date"
                value={selectedDateValue}
                min={formatDateInput(new Date())}
                onChange={(event) => {
                  setSelectedDateValue(event.target.value)
                  setSelectedBaseStart(null)
                  setSelectedSlot(null)
                }}
                className="mt-3 rounded-xl border-border bg-background"
              />
            </section>

            <section className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-card-foreground">Время</p>
              </div>

              {slotsError ? (
                <div className="mt-3 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {slotsError}
                </div>
              ) : null}

              {slotsLoading ? (
                <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Загружаем свободные слоты...
                </div>
              ) : null}

              {!slotsLoading ? (
                availableSlots15.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <div className="grid grid-cols-3 gap-2">
                      {availableSlots15.map((slot) => (
                        <button
                          key={`${slot.start}-${slot.end}`}
                          type="button"
                          onClick={() => setSelectedBaseStart(slot.start)}
                          className={`rounded-lg border py-2.5 text-sm font-medium transition-all ${
                            selectedBaseStart === slot.start
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-foreground"
                          }`}
                        >
                          {slot.start}
                        </button>
                      ))}
                    </div>

                    <AnimatePresence>
                      {selectedBaseStart && refinedSlots.length > 0 ? (
                        <motion.div
                          key="refine-slots"
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex flex-col gap-3"
                        >
                          <p className="text-xs font-medium text-muted-foreground">Уточни время</p>
                          <div
                            ref={refineContainerRef}
                            className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {refinedSlots.map((slot) => (
                              <button
                                key={`${slot.start}-${slot.end}`}
                                type="button"
                                data-slot={slot.start}
                                onClick={() => setSelectedSlot(slot)}
                                className={`min-w-24 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                                  selectedSlot?.start === slot.start
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background text-foreground"
                                }`}
                              >
                                {slot.start}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
                    {selectedService && selectedDateValue
                      ? "На выбранную дату нет свободных слотов."
                      : "Сначала выбери услугу и дату."}
                  </div>
                )
              ) : null}

              {selectedSlot && selectedService ? (
                <div className="mt-3 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-secondary-foreground">
                  {selectedSlotSummary} · {selectedService.name}
                </div>
              ) : null}
            </section>

            <Button
              onClick={() => void handleSubmit()}
              disabled={submitPending || !selectedService || !selectedSlot}
              className="h-11 rounded-xl text-sm font-semibold"
            >
              {submitPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Сохраняем...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Создать запись
                </>
              )}
            </Button>
          </div>
      </div>
    </div>
  )
}
