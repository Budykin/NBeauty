"use client"

import { motion } from "framer-motion"
import { Clock, Settings, ChevronRight, ArrowLeftRight, UserCheck, Building2, Users, Crown, Sparkles, Plus, LogIn } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { apiSalons } from "@/lib/api"
import { mapSalons } from "@/lib/mappers"
import type { Role, Salon } from "@/lib/types"

interface ProfileScreenProps {
  role: Role
  salons: Salon[]
  currentMasterId: string
  onToggleRole: () => void
  onBecomeMaster: () => void
  onNavigate: (screen: "working-hours" | "salon-dashboard") => void
  onSelectSalon: (salon: Salon) => void
  onSalonsChange: (salons: Salon[]) => void
}

export function ProfileScreen({
  role,
  salons,
  currentMasterId,
  onToggleRole,
  onBecomeMaster,
  onNavigate,
  onSelectSalon,
  onSalonsChange,
}: ProfileScreenProps) {
  const isMaster = role === "master"
  const mySalons = salons.filter((s) =>
    s.members.some((m) => m.masterId === currentMasterId)
  )

  async function handleCreateSalon() {
    const name = prompt("Название салона:")
    if (!name) return

    try {
      const created = await apiSalons.create(name)
      onSalonsChange([...salons, mapSalons([created])[0]])
    } catch (err) {
      console.error("Create salon failed:", err)
      alert("Не удалось создать салон")
    }
  }

  async function handleJoinSalon() {
    const code = prompt("Код приглашения:")
    if (!code) return

    try {
      const joined = await apiSalons.join(code)
      onSalonsChange([...salons, mapSalons([joined])[0]])
      alert(`Вы вступили в салон "${joined.name}"!`)
    } catch (err) {
      console.error("Join salon failed:", err)
      alert("Неверный код приглашения")
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 pb-4 pt-3">
      {/* Аватар и имя */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 py-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
          {isMaster ? "АП" : "ВЫ"}
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">
            {isMaster ? "Анна Петрова" : "Мой аккаунт"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isMaster ? "Стилист-колорист" : "Клиент"}
          </p>
        </div>
      </motion.div>

      {/* Переключатель ролей (для мастера) */}
      {isMaster && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-primary/20 bg-accent p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ArrowLeftRight className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Режим клиента</p>
                <p className="text-xs text-muted-foreground">Записаться к мастеру</p>
              </div>
            </div>
            <Switch checked={isMaster} onCheckedChange={onToggleRole} />
          </div>
        </motion.div>
      )}

      {/* Кнопка "Стать мастером" (для клиента) */}
      {!isMaster && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={onBecomeMaster}
            className="group flex w-full items-center justify-between rounded-xl border border-primary/30 bg-gradient-to-r from-primary/10 to-primary/5 p-4 transition-all active:scale-[0.98] hover:border-primary/50 hover:from-primary/15 hover:to-primary/10"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Стать мастером</p>
                <p className="text-xs text-muted-foreground">
                  Добавляйте услуги, принимайте записи
                </p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-primary" />
          </button>
        </motion.div>
      )}

      {/* Мои салоны */}
      {isMaster && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs font-medium text-muted-foreground">Мои салоны</p>

          {/* Кнопки создать/вступить */}
          <div className="flex gap-2">
            <button
              onClick={handleCreateSalon}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground transition-all active:scale-[0.98] hover:bg-accent"
            >
              <Plus className="h-4 w-4 text-primary" />
              Создать
            </button>
            <button
              onClick={handleJoinSalon}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground transition-all active:scale-[0.98] hover:bg-accent"
            >
              <LogIn className="h-4 w-4 text-primary" />
              Вступить
            </button>
          </div>

          {mySalons.map((salon) => {
            const myMembership = salon.members.find((m) => m.masterId === currentMasterId)
            const isAdmin = myMembership?.role === "admin"
            return (
              <button
                key={salon.id}
                onClick={() => onSelectSalon(salon)}
                className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                    {isAdmin && (
                      <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--tg-warning)]">
                        <Crown className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-card-foreground">{salon.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span>{salon.members.length} мастеров</span>
                      {isAdmin && (
                        <span className="ml-1 rounded bg-accent px-1 py-0.5 text-[10px] text-accent-foreground">
                          Владелец
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )
          })}
        </motion.div>
      )}

      {/* Настройки мастера */}
      {isMaster && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="flex flex-col gap-2"
        >
          <p className="text-xs font-medium text-muted-foreground">Настройки мастера</p>
          <button
            onClick={() => onNavigate("working-hours")}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-3 transition-all active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <span className="text-sm font-medium text-card-foreground">Рабочие часы</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </motion.div>
      )}

      {/* Общие настройки */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col gap-2"
      >
        <p className="text-xs font-medium text-muted-foreground">Общие</p>
        <div className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Settings className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-card-foreground">Настройки</span>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </motion.div>

      {/* Инфо */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-xs text-muted-foreground"
      >
        CRM Мастер v1.0 - Telegram Mini App
      </motion.p>
    </div>
  )
}
