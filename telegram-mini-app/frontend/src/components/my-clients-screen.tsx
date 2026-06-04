"use client"

import { useDeferredValue, useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { ChevronRight, Plus, StickyNote } from "lucide-react"

import { AppointmentStatusBadge } from "@/components/appointment-status-badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, apiClients } from "@/lib/api"
import { mapClient, mapClients } from "@/lib/mappers"
import type { ClientRecord } from "@/lib/types"

const statusLabel = {
  registered: "Зарегистрированный",
  guest: "Незарегистрированный",
} as const

type NoteSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"

export function MyClientsScreen() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [draftName, setDraftName] = useState("")
  const [draftPhone, setDraftPhone] = useState("")
  const [draftNote, setDraftNote] = useState("")
  const [savePending, setSavePending] = useState(false)
  const [noteDraft, setNoteDraft] = useState("")
  const [noteSaveStatus, setNoteSaveStatus] = useState<NoteSaveStatus>("idle")
  const lastSavedNoteRef = useRef("")
  const deferredQuery = useDeferredValue(query)
  const selectedClientKey = selectedClient ? `${selectedClient.type}-${selectedClient.id}` : null

  useEffect(() => {
    void loadClients()
  }, [deferredQuery])

  useEffect(() => {
    const note = selectedClient?.note ?? ""
    lastSavedNoteRef.current = note
    setNoteDraft(note)
    setNoteSaveStatus("idle")
  }, [selectedClientKey])

  useEffect(() => {
    if (!selectedClient) return

    if (noteDraft === lastSavedNoteRef.current) {
      setNoteSaveStatus("idle")
      return
    }

    setNoteSaveStatus("dirty")
    const timeoutId = window.setTimeout(() => {
      void saveNoteNow(noteDraft)
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [noteDraft, selectedClientKey])

  async function loadClients() {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClients.list(deferredQuery)
      setClients(mapClients(response))
    } catch (err) {
      console.error("Load clients failed:", err)
      setError("Не удалось загрузить список клиентов.")
    } finally {
      setLoading(false)
    }
  }

  async function openDetails(client: ClientRecord) {
    try {
      setError(null)
      const response = await apiClients.getById(client.type, client.id)
      setSelectedClient(mapClient(response))
    } catch (err) {
      console.error("Load client detail failed:", err)
      setError("Не удалось загрузить карточку клиента.")
    }
  }

  async function handleCreateGuest() {
    if (!draftName.trim()) return

    try {
      setSavePending(true)
      const created = await apiClients.createGuest({
        fullName: draftName.trim(),
        telephoneNumber: draftPhone.trim() || undefined,
        note: draftNote.trim() || "",
      })
      const mapped = mapClient(created)
      setIsAddOpen(false)
      setDraftName("")
      setDraftPhone("")
      setDraftNote("")
      await loadClients()
      setSelectedClient(mapped)
    } catch (err) {
      console.error("Create guest client failed:", err)
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить клиента.")
    } finally {
      setSavePending(false)
    }
  }

  async function saveNoteNow(nextNote: string) {
    if (!selectedClient) return
    if (nextNote === lastSavedNoteRef.current) return

    try {
      setNoteSaveStatus("saving")
      const updated = await apiClients.updateNote(selectedClient.type, selectedClient.id, nextNote)
      const mapped = mapClient(updated)
      lastSavedNoteRef.current = mapped.note
      setSelectedClient((current) =>
        current?.type === mapped.type && current.id === mapped.id ? mapped : current,
      )
      setClients((previous) =>
        previous.map((client) => (client.id === mapped.id && client.type === mapped.type ? { ...client, note: mapped.note } : client)),
      )
      setNoteSaveStatus("saved")
      window.setTimeout(() => {
        setNoteSaveStatus((current) => (current === "saved" ? "idle" : current))
      }, 1500)
    } catch (err) {
      console.error("Update client note failed:", err)
      setError(err instanceof ApiError ? err.message : "Не удалось обновить заметку.")
      setNoteSaveStatus("error")
    }
  }

  function closeClientDetails() {
    if (selectedClient && noteDraft !== lastSavedNoteRef.current) {
      void saveNoteNow(noteDraft)
    }
    setSelectedClient(null)
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Мои клиенты</h1>
          <p className="text-sm text-muted-foreground">Зарегистрированные и гостевые клиенты мастера</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-all active:scale-95"
          aria-label="Добавить клиента"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить
        </button>
      </div>

      <div>
        <Input
          id="client-search"
          name="client-search"
          type="text"
          placeholder="Поиск клиентов..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 pl-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Загружаем клиентов...
        </div>
      ) : null}

      {!loading ? (
        <div className="flex flex-col gap-2.5">
          {clients.map((client, index) => (
            <motion.div
              key={`${client.type}-${client.id}`}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => void openDetails(client)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  void openDetails(client)
                }
              }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {getInitials(client.fullName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-card-foreground">{client.fullName}</p>
                {client.telephoneNumber ? (
                  <p className="mt-0.5 truncate text-xs font-medium text-primary">{client.telephoneNumber}</p>
                ) : null}
                <p className="text-xs text-muted-foreground">{statusLabel[client.type]}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {client.appointmentsCount} записей
                  {client.lastAppointmentAt ? ` · последний визит: ${formatDate(client.lastAppointmentAt)}` : " · без визитов"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          ))}

          {clients.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Клиенты по этому запросу не найдены.
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto p-4">
          <DialogHeader className="text-center">
            <DialogTitle className="text-xl">Новый незарегистрированный клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Имя" className="rounded-xl border-border bg-background px-4 py-3 text-sm focus-visible:border-primary focus-visible:ring-primary/20" />
            <Input value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} placeholder="Телефон" className="rounded-xl border-border bg-background px-4 py-3 text-sm focus-visible:border-primary focus-visible:ring-primary/20" />
            <Textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Заметка мастера (необязательно)" rows={4} className="rounded-xl border-border bg-background px-4 py-3 text-sm focus-visible:border-primary focus-visible:ring-primary/20" />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={savePending}>Отмена</Button>
            <Button onClick={() => void handleCreateGuest()} disabled={savePending || !draftName.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && closeClientDetails()}>
        {selectedClient ? (
          <DialogContent className="max-h-[90svh] overflow-y-auto p-4">
            <DialogHeader className="items-center text-center">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
                {getInitials(selectedClient.fullName)}
              </div>
              <DialogTitle className="text-xl">{selectedClient.fullName}</DialogTitle>
              {selectedClient.username ? (
                <a
                  href={`https://t.me/${selectedClient.username}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary"
                >
                  @{selectedClient.username}
                </a>
              ) : null}
              {selectedClient.telephoneNumber ? (
                <p className="text-sm text-muted-foreground">{selectedClient.telephoneNumber}</p>
              ) : null}
              <p className="text-sm text-muted-foreground">{statusLabel[selectedClient.type]}</p>
              <p className="text-sm text-muted-foreground">
                {selectedClient.lastAppointmentAt ? `Последний визит: ${formatDateTime(selectedClient.lastAppointmentAt)}` : "Нет визитов"}
              </p>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <StickyNote className="h-4 w-4 text-primary" />
                    Заметка мастера
                  </div>
                  <p className="text-xs text-muted-foreground">{noteStatusText(noteSaveStatus)}</p>
                </div>
                <Textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  rows={5}
                  className="rounded-xl border-border bg-background text-sm focus-visible:border-primary focus-visible:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">История записей</p>
                {selectedClient.history && selectedClient.history.length > 0 ? (
                  <div className="space-y-2">
                    {selectedClient.history.map((item) => (
                      <div key={item.id} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-card-foreground">{item.serviceName}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.startTime)} - {formatTime(item.endTime)}</p>
                          </div>
                          <AppointmentStatusBadge status={item.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-3 text-sm text-muted-foreground">
                    У этого клиента пока нет записей у мастера.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function getInitials(value: string) {
  const initials = value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("")

  return initials || "КЛ"
}

function noteStatusText(status: NoteSaveStatus) {
  if (status === "dirty") return "Есть изменения"
  if (status === "saving") return "Сохраняем..."
  if (status === "saved") return "Сохранено"
  if (status === "error") return "Не сохранено"
  return ""
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
