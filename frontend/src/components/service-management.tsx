"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Plus, Trash2, Scissors, Box, Info } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Service, Resource } from "@/lib/types"

interface ServiceManagementProps {
  services: Service[]
  resources: Resource[]
  onUpdate: (services: Service[]) => void
}

export function ServiceManagement({ services, resources, onUpdate }: ServiceManagementProps) {
  const [editingId, setEditingId] = useState<string | null>(null)

  function handleAdd() {
    const newService: Service = {
      id: `s-${Date.now()}`,
      name: "",
      price: 0,
      duration: 30,
    }
    onUpdate([...services, newService])
    setEditingId(newService.id)
  }

  function handleUpdate(id: string, field: keyof Service, value: string | number) {
    onUpdate(
      services.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  function handleDelete(id: string) {
    onUpdate(services.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Услуги</h1>
          <p className="text-sm text-muted-foreground">{services.length} услуг</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground transition-all active:scale-95"
        >
          <Plus className="h-3.5 w-3.5" />
          Добавить
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {services.map((service, i) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-xl border border-border bg-card p-3"
          >
            {editingId === service.id ? (
              <div className="flex flex-col gap-2.5">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => handleUpdate(service.id, "name", e.target.value)}
                  placeholder="Название услуги"
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  autoFocus
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Цена (&#8381;)</label>
                    <input
                      type="number"
                      value={service.price || ""}
                      onChange={(e) => handleUpdate(service.id, "price", Number(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Длительность (мин)</label>
                    <input
                      type="number"
                      value={service.duration || ""}
                      onChange={(e) => handleUpdate(service.id, "duration", Number(e.target.value))}
                      placeholder="30"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Выбор ресурса */}
                {resources.length > 0 && (
                  <div>
                    <div className="mb-1 flex items-center gap-1">
                      <label className="text-[10px] font-medium text-muted-foreground">
                        Требуемый ресурс
                      </label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <p className="text-xs">
                              Доступность услуги будет зависеть от расписания выбранного ресурса
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Select
                      value={service.resourceId || "none"}
                      onValueChange={(value) =>
                        handleUpdate(service.id, "resourceId", value === "none" ? undefined : value)
                      }
                    >
                      <SelectTrigger className="w-full rounded-lg border border-border bg-background">
                        <SelectValue placeholder="Не требуется" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Не требуется</SelectItem>
                        {resources.filter(r => r.isActive).map((resource) => (
                          <SelectItem key={resource.id} value={resource.id}>
                            <div className="flex items-center gap-2">
                              <Box className="h-3 w-3" />
                              {resource.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {service.resourceId && (
                      <p className="mt-1.5 flex items-center gap-1 text-[10px] text-[color:var(--tg-warning)]">
                        <Info className="h-3 w-3" />
                        Доступность зависит от расписания ресурса
                      </p>
                    )}
                  </div>
                )}

                <button
                  onClick={() => setEditingId(null)}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                >
                  Готово
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setEditingId(service.id)}
                  className="flex flex-1 items-center gap-3 text-left"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                    <Scissors className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{service.name || "Без названия"}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-muted-foreground">{service.duration} мин - {service.price} &#8381;</p>
                      {service.resourceId && (
                        <span className="flex items-center gap-0.5 rounded bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                          <Box className="h-2.5 w-2.5" />
                          {resources.find(r => r.id === service.resourceId)?.name || "Ресурс"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(service.id)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Удалить"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  )
}
