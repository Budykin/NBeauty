"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  ShieldCheck,
  Star,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"

import { AppointmentStatusBadge } from "@/components/appointment-status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AppointmentStatus } from "@/lib/appointment-status"
import {
  apiPlatformAdmin,
  type ApiAdminAnalytics,
  type ApiAdminSalon,
  type ApiAdminUser,
} from "@/lib/api"

interface PlatformAdminScreenProps {
  onBack: () => void
}

type StatusKey = AppointmentStatus

export function PlatformAdminScreen({ onBack }: PlatformAdminScreenProps) {
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null)
  const [users, setUsers] = useState<ApiAdminUser[]>([])
  const [salons, setSalons] = useState<ApiAdminSalon[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAdminData() {
    setLoading(true)
    setError(null)
    try {
      const [analyticsResult, usersResult, salonsResult] = await Promise.all([
        apiPlatformAdmin.analytics(),
        apiPlatformAdmin.users(),
        apiPlatformAdmin.salons(),
      ])

      setAnalytics(analyticsResult)
      setUsers(usersResult)
      setSalons(salonsResult)
    } catch (err) {
      console.error("Load platform admin data failed:", err)
      setError("Не удалось загрузить админ-данные")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdminData(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function deleteUser(user: ApiAdminUser) {
    const impact = await apiPlatformAdmin.userDeleteImpact(user.tgId)
    const details = Object.entries(impact.counts).map(([key, value]) => `${key}: ${value}`).join("\n")
    if (!confirm(`Удалить пользователя ${user.fullName}?\n\n${details}\n\n${impact.warnings.join("\n")}`)) return
    await apiPlatformAdmin.deleteUser(user.tgId)
    await loadAdminData()
  }

  async function deleteSalon(salon: ApiAdminSalon) {
    const impact = await apiPlatformAdmin.salonDeleteImpact(salon.id)
    const details = Object.entries(impact.counts).map(([key, value]) => `${key}: ${value}`).join("\n")
    if (!confirm(`Удалить салон ${salon.name}?\n\n${details}\n\n${impact.warnings.join("\n")}`)) return
    await apiPlatformAdmin.deleteSalon(salon.id)
    await loadAdminData()
  }

  const totals: Record<string, number> = analytics?.totals ?? {}
  const appointmentsByStatus: Partial<Record<StatusKey, number>> = analytics?.appointmentsByStatus ?? {}
  const totalUsers = totals.users ?? 0
  const clients = totals.clients ?? 0
  const masters = totals.masters ?? 0
  const activePlatformAdmins = totals.activePlatformAdmins ?? 0
  const totalAppointmentsFromStatuses = Object.values(appointmentsByStatus).reduce((sum, count) => sum + count, 0)
  const totalAppointments = totalAppointmentsFromStatuses || totals.appointments || 0
  const pendingAppointments = appointmentsByStatus.pending ?? 0
  const confirmedAppointments = appointmentsByStatus.confirmed ?? 0
  const upcomingAppointments = appointmentsByStatus.upcoming ?? 0
  const cancelledAppointments = appointmentsByStatus.cancelled ?? 0
  const completedAppointments = appointmentsByStatus.completed ?? 0
  const activeAppointments = pendingAppointments + confirmedAppointments + upcomingAppointments
  const cancellationRate = Math.round((cancelledAppointments / (totalAppointments || 1)) * 100)
  const averageMasterRating = analytics?.averageMasterRating ?? 0

  const overviewCards = [
    {
      label: "Пользователи",
      value: totals.users ?? 0,
      subtitle: "всего",
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Клиенты",
      value: totals.clients ?? 0,
      subtitle: "всего",
      icon: <UserCheck className="h-4 w-4" />,
    },
    {
      label: "Мастера",
      value: totals.masters ?? 0,
      subtitle: "активных",
      icon: <Star className="h-4 w-4" />,
    },
    {
      label: "Админы",
      value: totals.activePlatformAdmins ?? 0,
      subtitle: "активных",
      icon: <ShieldCheck className="h-4 w-4" />,
    },
    {
      label: "Салоны",
      value: totals.salons ?? 0,
      subtitle: "всего",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      label: "Записи",
      value: totals.appointments ?? 0,
      subtitle: "всего",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      label: "Отзывы",
      value: totals.reviews ?? 0,
      subtitle: "всего",
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      label: "Средний рейтинг",
      value: formatRating(averageMasterRating),
      subtitle: "среднее",
      icon: <Star className="h-4 w-4" />,
    },
  ]

  const roleMetrics = [
    { label: "Клиенты", value: clients, percent: getPercent(clients, totalUsers) },
    { label: "Мастера", value: masters, percent: getPercent(masters, totalUsers) },
    { label: "Глобальные админы", value: activePlatformAdmins, percent: getPercent(activePlatformAdmins, totalUsers) },
  ]

  const statusMetrics: Array<{ status: StatusKey; label: string; value: number; percent: number }> = [
    {
      status: "pending",
      label: "Ожидают",
      value: pendingAppointments,
      percent: getPercent(pendingAppointments, totalAppointments),
    },
    {
      status: "confirmed",
      label: "Подтверждены",
      value: confirmedAppointments,
      percent: getPercent(confirmedAppointments, totalAppointments),
    },
    {
      status: "upcoming",
      label: "Скоро",
      value: upcomingAppointments,
      percent: getPercent(upcomingAppointments, totalAppointments),
    },
    {
      status: "cancelled",
      label: "Отменены",
      value: cancelledAppointments,
      percent: getPercent(cancelledAppointments, totalAppointments),
    },
    {
      status: "completed",
      label: "Завершены",
      value: completedAppointments,
      percent: getPercent(completedAppointments, totalAppointments),
    },
  ]

  const activityCards = [
    { label: "Всего записей", value: totalAppointments },
    { label: "Активные записи", value: activeAppointments },
    { label: "Завершённые", value: completedAppointments },
    { label: "Отменённые", value: cancelledAppointments },
  ]

  return (
    <div className="flex flex-col gap-4 px-4 pb-4 pt-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Глобальный админ</h1>
          <p className="text-sm text-muted-foreground">Аналитика и управление сервисом</p>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Загрузка...</p> : null}
      {error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-secondary">
          <TabsTrigger value="analytics" className="text-xs">Аналитика</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Пользователи</TabsTrigger>
          <TabsTrigger value="salons" className="text-xs">Салоны</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-4">
          <DashboardSection title="Обзор сервиса">
            <div className="grid grid-cols-2 gap-2">
              {overviewCards.map((card) => (
                <StatCard key={card.label} {...card} />
              ))}
            </div>
          </DashboardSection>

          <DashboardSection title="Пользователи по ролям">
            <div className="space-y-3">
              {roleMetrics.map((metric) => (
                <ProgressMetric key={metric.label} {...metric} />
              ))}
            </div>
          </DashboardSection>

          <DashboardSection title="Статусы записей">
            <div className="space-y-3">
              {statusMetrics.map((metric) => (
                <ProgressMetric
                  key={metric.status}
                  label={metric.label}
                  value={metric.value}
                  percent={metric.percent}
                  badge={<AppointmentStatusBadge status={metric.status} className="text-[10px]" />}
                />
              ))}
            </div>
          </DashboardSection>

          <DashboardSection title="Качество сервиса">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-end gap-2">
                <p className="text-3xl font-semibold text-card-foreground">{formatRating(averageMasterRating)}</p>
                <p className="pb-1 text-sm text-muted-foreground">/ 5</p>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <QualityMetric label="Отзывы" value={totals.reviews ?? 0} />
                <QualityMetric label="Завершены" value={completedAppointments} />
                <QualityMetric label="Доля отмен" value={`${cancellationRate}%`} />
              </div>
            </div>
          </DashboardSection>

          <DashboardSection title="Активность записей">
            <div className="grid grid-cols-2 gap-2">
              {activityCards.map((card) => (
                <SmallMetric key={card.label} label={card.label} value={card.value} />
              ))}
            </div>
          </DashboardSection>
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-2">
          {users.map((user) => (
            <div key={user.tgId} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{getUserRoleLabel(user.role)} · {user.tgId}</p>
              </div>
              <Button
                aria-label="Удалить пользователя"
                variant="destructive"
                size="sm"
                onClick={() => void deleteUser(user)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="salons" className="mt-4 space-y-2">
          {salons.map((salon) => (
            <div key={salon.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">{salon.name}</p>
                <p className="text-xs text-muted-foreground">владелец: {salon.ownerId}</p>
              </div>
              <Button
                aria-label="Удалить салон"
                variant="destructive"
                size="sm"
                onClick={() => void deleteSalon(salon)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DashboardSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

function StatCard({
  icon,
  label,
  value,
  subtitle,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
  subtitle: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className="mt-2 text-xl font-semibold text-card-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function ProgressMetric({
  label,
  value,
  percent,
  badge,
}: {
  label: string
  value: number
  percent: number
  badge?: ReactNode
}) {
  const safePercent = clampPercent(percent)

  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-card-foreground">{label}</p>
          {badge ? <div className="mt-1">{badge}</div> : null}
        </div>
        <p className="shrink-0 text-sm font-semibold text-card-foreground">{value}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${safePercent}%` }} />
      </div>
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-card-foreground">{value}</p>
    </div>
  )
}

function QualityMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-secondary p-2">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}

function getPercent(value: number, base: number) {
  return Math.round((value / (base || 1)) * 100)
}

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function formatRating(value: number) {
  if (!Number.isFinite(value)) return "0"
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function getUserRoleLabel(role: ApiAdminUser["role"]) {
  return role === "master" ? "Мастер" : "Клиент"
}
