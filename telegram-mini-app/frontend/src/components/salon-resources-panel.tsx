"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus, Box, Pencil, Check, X, Trash2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerClose,
} from "@/components/ui/drawer"
import type { Resource } from "@/lib/types"

interface SalonResourcesPanelProps {
  resources: Resource[]
  onUpdateResource: (resource: Resource) => void
  onAddResource: (resource: { name: string; isActive: boolean }) => void
  onDeleteResource: (resourceId: string) => void
  salonId: string
}

export function SalonResourcesPanel({
  resources,
  onUpdateResource,
  onAddResource,
  onDeleteResource,
  salonId,
}: SalonResourcesPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [newResourceName, setNewResourceName] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const handleAdd = () => {
    if (!newResourceName.trim()) return
    onAddResource({
      name: newResourceName.trim(),
      isActive: true,
    })
    setNewResourceName("")
    setDrawerOpen(false)
  }

  const handleStartEdit = (resource: Resource) => {
    setEditingId(resource.id)
    setEditingName(resource.name)
  }

  const handleSaveEdit = (resource: Resource) => {
    if (editingName.trim()) {
      onUpdateResource({ ...resource, name: editingName.trim() })
    }
    setEditingId(null)
    setEditingName("")
  }

  const activeCount = resources.filter((r) => r.isActive).length

  return (
    <div className="flex flex-col gap-3">
      {/* Кнопка добавления */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 py-3 text-sm font-medium text-primary transition-all active:scale-[0.98]">
            <Plus className="h-4 w-4" />
            Добавить ресурс
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Новый ресурс</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-8">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Название
              </label>
              <input
                type="text"
                value={newResourceName}
                onChange={(e) => setNewResourceName(e.target.value)}
                placeholder="Например: Массажный кабинет 1"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                autoFocus
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Ресурс - это помещение или оборудование, которое могут использовать несколько мастеров (массажный кабинет, кресло для педикюра и т.д.)
            </p>

            <div className="flex gap-2">
              <DrawerClose asChild>
                <button className="flex-1 rounded-xl border border-border bg-secondary py-3 text-sm font-medium text-foreground transition-all active:scale-[0.98]">
                  Отмена
                </button>
              </DrawerClose>
              <button
                onClick={handleAdd}
                disabled={!newResourceName.trim()}
                className="flex-1 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all active:scale-[0.98] disabled:opacity-50"
              >
                Добавить
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Статистика */}
      <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2">
        <span className="text-xs text-muted-foreground">Всего ресурсов</span>
        <span className="text-xs font-medium text-foreground">
          {activeCount} активных из {resources.length}
        </span>
      </div>

      {/* Список ресурсов */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {resources.map((resource, i) => (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    resource.isActive ? "bg-accent" : "bg-muted"
                  }`}
                >
                  <Box
                    className={`h-5 w-5 ${
                      resource.isActive ? "text-accent-foreground" : "text-muted-foreground"
                    }`}
                  />
                </div>

                {editingId === resource.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-32 rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground focus:border-primary focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(resource)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-primary"
                    >
                      <Check className="h-3.5 w-3.5 text-primary-foreground" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit(resource)}
                    className="flex items-center gap-1.5 text-left"
                  >
                    <span
                      className={`text-sm font-medium ${
                        resource.isActive ? "text-card-foreground" : "text-muted-foreground line-through"
                      }`}
                    >
                      {resource.name}
                    </span>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={resource.isActive}
                  onCheckedChange={(checked) =>
                    onUpdateResource({ ...resource, isActive: checked })
                  }
                />

                {confirmDelete === resource.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onDeleteResource(resource.id)
                        setConfirmDelete(null)
                      }}
                      className="flex h-8 items-center gap-1 rounded-lg bg-destructive px-2.5 text-xs font-medium text-white"
                    >
                      Удалить
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(resource.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Удалить ресурс"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
