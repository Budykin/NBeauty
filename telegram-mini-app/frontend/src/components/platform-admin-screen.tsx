"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import { ArrowLeft, Building2, CalendarDays, Star, Trash2 } from "lucide-react"

import { AppointmentStatusBadge } from "@/components/appointment-status-badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  apiPlatformAdmin,
  type ApiAdminAnalytics,
  type ApiAdminSalon,
  type ApiAdminUser,
  type ApiAppointment,
  type ApiResource,
  type ApiReview,
  type ApiService,
} from "@/lib/api"

interface PlatformAdminScreenProps {
  onBack: () => void
}

export function PlatformAdminScreen({ onBack }: PlatformAdminScreenProps) {
  const [analytics, setAnalytics] = useState<ApiAdminAnalytics | null>(null)
  const [users, setUsers] = useState<ApiAdminUser[]>([])
  const [salons, setSalons] = useState<ApiAdminSalon[]>([])
  const [appointments, setAppointments] = useState<ApiAppointment[]>([])
  const [reviews, setReviews] = useState<ApiReview[]>([])
  const [resources, setResources] = useState<ApiResource[]>([])
  const [services, setServices] = useState<ApiService[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadAdminData() {
    setLoading(true)
    setError(null)
    try {
      const [
        analyticsResult,
        usersResult,
        salonsResult,
        appointmentsResult,
        reviewsResult,
        resourcesResult,
        servicesResult,
      ] = await Promise.all([
        apiPlatformAdmin.analytics(),
        apiPlatformAdmin.users(),
        apiPlatformAdmin.salons(),
        apiPlatformAdmin.appointments(),
        apiPlatformAdmin.reviews(),
        apiPlatformAdmin.resources(),
        apiPlatformAdmin.services(),
      ])

      setAnalytics(analyticsResult)
      setUsers(usersResult)
      setSalons(salonsResult)
      setAppointments(appointmentsResult)
      setReviews(reviewsResult)
      setResources(resourcesResult)
      setServices(servicesResult)
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

  const statCards = analytics
    ? [
        ["Пользователи", analytics.totals.users],
        ["Клиенты", analytics.totals.clients],
        ["Мастера", analytics.totals.masters],
        ["Админы", analytics.totals.activePlatformAdmins],
        ["Салоны", analytics.totals.salons],
        ["Записи", analytics.totals.appointments],
        ["Отзывы", analytics.totals.reviews],
        ["Средний рейтинг", analytics.averageMasterRating],
      ]
    : []

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
        <TabsList className="grid w-full grid-cols-4 bg-secondary">
          <TabsTrigger value="analytics" className="text-xs">Аналитика</TabsTrigger>
          <TabsTrigger value="users" className="text-xs">Users</TabsTrigger>
          <TabsTrigger value="salons" className="text-xs">Салоны</TabsTrigger>
          <TabsTrigger value="data" className="text-xs">Данные</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {statCards.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-lg font-semibold text-card-foreground">{value}</p>
              </div>
            ))}
          </div>
          {analytics ? (
            <div className="rounded-xl border border-border bg-card p-3">
              <p className="text-sm font-medium">Статусы записей</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(analytics.appointmentsByStatus).map(([status, count]) => (
                  <span key={status} className="rounded-md bg-secondary px-2 py-1 text-xs">{status}: {count}</span>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-2">
          {users.map((user) => (
            <div key={user.tgId} className="flex items-center justify-between rounded-xl border border-border bg-card p-3">
              <div>
                <p className="text-sm font-medium">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">{user.role} · {user.tgId}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => void deleteUser(user)}>
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
                <p className="text-xs text-muted-foreground">owner: {salon.ownerId}</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => void deleteSalon(salon)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="data" className="mt-4 space-y-3">
          <DataSection title="Записи" icon={<CalendarDays className="h-4 w-4" />}>
            {appointments.map((appointment) => (
              <div key={appointment.id} className="rounded-lg border border-border p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>{appointment.serviceName} · {appointment.startTime.slice(0, 16)}</span>
                  <AppointmentStatusBadge status={appointment.status} />
                </div>
              </div>
            ))}
          </DataSection>
          <DataSection title="Отзывы" icon={<Star className="h-4 w-4" />}>
            {reviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-border p-2 text-xs">
                appointment #{review.appointmentId} · {review.rating}/5 {review.comment ? `· ${review.comment}` : ""}
              </div>
            ))}
          </DataSection>
          <DataSection title="Ресурсы и услуги" icon={<Building2 className="h-4 w-4" />}>
            <p className="text-xs text-muted-foreground">{resources.length} ресурсов · {services.length} услуг</p>
          </DataSection>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DataSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}
