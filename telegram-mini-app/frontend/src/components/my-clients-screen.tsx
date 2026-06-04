"use client"

import { useDeferredValue, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { motion } from "framer-motion"
import { ChevronRight, Phone, Plus, StickyNote, UserRound } from "lucide-react"

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
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    void loadClients()
  }, [deferredQuery])

  useEffect(() => {
    setNoteDraft(selectedClient?.note ?? "")
  }, [selectedClient])

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

  async function handleSaveNote() {
    if (!selectedClient) return

    try {
      setSavePending(true)
      const updated = await apiClients.updateNote(selectedClient.type, selectedClient.id, noteDraft)
      const mapped = mapClient(updated)
      setSelectedClient(mapped)
      setClients((previous) =>
        previous.map((client) => (client.id === mapped.id && client.type === mapped.type ? { ...client, note: mapped.note } : client)),
      )
    } catch (err) {
      console.error("Update client note failed:", err)
      setError(err instanceof ApiError ? err.message : "Не удалось обновить заметку.")
    } finally {
      setSavePending(false)
    }
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
            <motion.button
              key={`${client.type}-${client.id}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              onClick={() => void openDetails(client)}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-card-foreground">{client.fullName}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${client.type === "registered" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {client.type === "registered" ? "зарегистрированный" : "незарегистрированный"}
                  </span>
                </div>
                {client.telephoneNumber ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{client.telephoneNumber}</p>
                ) : null}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{client.appointmentsCount} записей</span>
                  <span>{client.lastAppointmentAt ? `Последний визит: ${formatDate(client.lastAppointmentAt)}` : "Без визитов"}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.button>
          ))}

          {clients.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
              Клиенты по этому запросу не найдены.
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="p-4">
          <DialogHeader>
            <DialogTitle>Новый незарегистрированный клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="Имя" />
            <Input value={draftPhone} onChange={(event) => setDraftPhone(event.target.value)} placeholder="Телефон" />
            <Textarea value={draftNote} onChange={(event) => setDraftNote(event.target.value)} placeholder="Заметка мастера (необязательно)" rows={4} />
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} disabled={savePending}>Отмена</Button>
            <Button onClick={() => void handleCreateGuest()} disabled={savePending || !draftName.trim()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={selectedClient !== null} onOpenChange={(open) => !open && setSelectedClient(null)}>
        {selectedClient ? (
          <DialogContent className="max-h-[90svh] overflow-y-auto p-4">
            <DialogHeader>
              <DialogTitle>{selectedClient.fullName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="space-y-2 text-sm">
                  <InfoRow icon={<UserRound className="h-4 w-4" />} label="Статус" value={statusLabel[selectedClient.type]} />
                  {selectedClient.telephoneNumber ? (
                    <InfoRow icon={<Phone className="h-4 w-4" />} label="Телефон" value={selectedClient.telephoneNumber} />
                  ) : null}
                  {selectedClient.username ? (
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 text-primary">@</div>
                      <div>
                        <p className="text-xs text-muted-foreground">Username</p>
                        <a
                          href={`https://t.me/${selectedClient.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-primary"
                        >
                          @{selectedClient.username}
                        </a>
                      </div>
                    </div>
                  ) : null}
                  <InfoRow label="Последний визит" value={selectedClient.lastAppointmentAt ? formatDateTime(selectedClient.lastAppointmentAt) : "Нет визитов"} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <StickyNote className="h-4 w-4 text-primary" />
                  Заметка мастера
                </div>
                <Textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} rows={5} />
                <Button onClick={() => void handleSaveNote()} disabled={savePending}>Сохранить заметку</Button>
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

function InfoRow({ icon, label, value }: { icon?: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      {icon ? <div className="mt-0.5 text-primary">{icon}</div> : null}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value}</p>
      </div>
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
