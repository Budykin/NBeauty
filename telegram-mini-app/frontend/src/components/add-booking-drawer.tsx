"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Clock3, Loader2, Plus, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
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

function generateMockSlots(durationMinutes: number): TimeSlot[] {
  const slots: TimeSlot[] = []
  for (let cursor = 9 * 60; cursor + durationMinutes <= 18 * 60; cursor += 15) {
    const start = `${String(Math.floor(cursor / 60)).padStart(2, "0")}:${String(cursor % 60).padStart(2, "0")}`
    slots.push({ start, end: addMinutes(start, durationMinutes) })
  }
  return slots
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
  const [clientMode, setClientMode] = useState<ClientMode>("existing")
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [clientsError, setClientsError] = useState<string | null>(null)
  const [clientQuery, setClientQuery] = useState("")
  const [selectedClientKey, setSelectedClientKey] = useState<string | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>("")
  const [selectedDateValue, setSelectedDateValue] = useState("")
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsError, setSlotsError] = useState<string | null>(null)
  const [selectedSlotStart, setSelectedSlotStart] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftPhone, setDraftPhone] = useState("")
  const [draftPhoneTouched, setDraftPhoneTouched] = useState(false)
  const [draftNote, setDraftNote] = useState("")
  const [submitPending, setSubmitPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [selectedServiceId, services],
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
  const selectedSlot = useMemo(
    () => availableSlots.find((slot) => slot.start === selectedSlotStart) ?? null,
    [availableSlots, selectedSlotStart],
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
    if (!open) return

    setClientMode("existing")
    setClientQuery("")
    setSelectedClientKey(null)
    setSelectedServiceId("")
    setSelectedDateValue(formatDateInput(selectedDate))
    setAvailableSlots([])
    setSlotsError(null)
    setSelectedSlotStart(null)
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
  }, [loadClients, open, selectedDate])

  useEffect(() => {
    if (!open || !selectedService || !selectedDateValue) {
      setAvailableSlots([])
      setSlotsError(null)
      setSelectedSlotStart(null)
      return
    }

    let cancelled = false

    const loadSlots = async () => {
      setSlotsLoading(true)
      setSlotsError(null)

      try {
        if (IS_DEV_AUTH_BYPASS) {
          if (cancelled) return
          setAvailableSlots(generateMockSlots(selectedService.duration))
          return
        }

        const slots = await apiMasters.slots(
          Number(masterId),
          Number(selectedService.id),
          selectedDateValue,
          15,
        )

        if (cancelled) return

        setAvailableSlots(
          slots.map((slot) => ({
            start: formatSlotTime(slot.start),
            end: formatSlotTime(slot.end),
          })),
        )
      } catch (error) {
        if (cancelled) return

        console.error("Load master slots failed:", error)
        setAvailableSlots([])
        setSlotsError("Не удалось загрузить свободное время. Попробуй другую дату или услугу.")
      } finally {
        if (!cancelled) {
          setSlotsLoading(false)
        }
      }
    }

    setSelectedSlotStart(null)
    void loadSlots()

    return () => {
      cancelled = true
    }
  }, [masterId, open, selectedDateValue, selectedService])

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
          bookingTarget = mapClient(
            await apiClients.createGuest({
              fullName: draftName.trim(),
              telephoneNumber: draftPhone.trim(),
              note: draftNote.trim() || "",
            }),
          )
          setClients((previous) => {
            const next = previous.filter((client) => !(client.type === bookingTarget.type && client.id === bookingTarget.id))
            return [bookingTarget, ...next]
          })
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

  return (
    <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DrawerContent className="max-h-[92svh]">
        <DrawerHeader>
          <DrawerTitle>Новая запись</DrawerTitle>
          <DrawerDescription>Выбери клиента, услугу, дату и свободное время.</DrawerDescription>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6">
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
                {services.length > 0 ? (
                  services.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
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
                onChange={(event) => setSelectedDateValue(event.target.value)}
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
                availableSlots.length > 0 ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.start}
                        type="button"
                        onClick={() => setSelectedSlotStart(slot.start)}
                        className={`rounded-lg border px-2 py-2 text-sm font-medium transition-all ${
                          selectedSlotStart === slot.start
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-foreground"
                        }`}
                      >
                        {slot.start}
                      </button>
                    ))}
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
                  {selectedDateValue} · {selectedSlot.start} - {selectedSlot.end} · {selectedService.name}
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
      </DrawerContent>
    </Drawer>
  )
}
