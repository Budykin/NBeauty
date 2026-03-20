"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { UserPlus, Trash2, Crown, QrCode, X, Share2 } from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import type { Salon } from "@/lib/types"

interface SalonMembersPanelProps {
  salon: Salon
  onRemoveMember: (memberId: string) => void
  onCopyInvite: () => void
}

export function SalonMembersPanel({ salon, onRemoveMember, onCopyInvite }: SalonMembersPanelProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-3">
      {/* Кнопка приглашения */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/50 bg-primary/5 py-3 text-sm font-medium text-primary transition-all active:scale-[0.98]">
            <UserPlus className="h-4 w-4" />
            Пригласить мастера
          </button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Пригласить мастера</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-8">
            {/* QR код (placeholder) */}
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-2xl border border-border bg-card">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="h-16 w-16" />
                <span className="text-xs">QR-код приглашения</span>
              </div>
            </div>

            {/* Код и ссылка */}
            <div className="rounded-xl border border-border bg-secondary/50 p-4 text-center">
              <p className="text-xs text-muted-foreground">Код приглашения</p>
              <p className="mt-1 text-2xl font-bold tracking-widest text-foreground">
                {salon.inviteCode}
              </p>
            </div>

            <button
              onClick={() => {
                onCopyInvite()
                setDrawerOpen(false)
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all active:scale-[0.98]"
            >
              <Share2 className="h-4 w-4" />
              Скопировать ссылку
            </button>

            <p className="text-center text-xs text-muted-foreground">
              Мастер перейдёт по ссылке и будет добавлен в ваш салон
            </p>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Список мастеров */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {salon.members.map((member, i) => (
            <motion.div
              key={member.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {member.masterAvatar}
                  {member.role === "admin" && (
                    <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--tg-warning)]">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-card-foreground">{member.masterName}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === "admin" ? "Владелец" : "Мастер"}
                  </p>
                </div>
              </div>

              {member.role !== "admin" && (
                <>
                  {confirmDelete === member.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onRemoveMember(member.id)
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
                      onClick={() => setConfirmDelete(member.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Удалить мастера"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
