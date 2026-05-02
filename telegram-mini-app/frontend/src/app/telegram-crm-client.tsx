"use client"

import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { BottomNav } from "@/components/bottom-nav"
import { BookingWizard } from "@/components/booking-wizard"
import { DevLoginScreen } from "@/components/dev-login-screen"
import { DiscoveryScreen } from "@/components/discovery-screen"
import { MasterDashboard } from "@/components/master-dashboard"
import { MyBookingsScreen } from "@/components/my-bookings"
import { ProfileScreen } from "@/components/profile-screen"
import { RuntimeErrorBoundary } from "@/components/runtime-error-boundary"
import { SalonDashboard } from "@/components/salon-dashboard"
import { ServiceManagement } from "@/components/service-management"
import { WorkingHoursScreen } from "@/components/working-hours"
import {
  ApiError,
  apiAppointments,
  apiMasters,
  apiProfile,
  apiResources,
  apiSalons,
  apiSchedules,
  apiServices,
} from "@/lib/api"
import { IS_DEV_AUTH_BYPASS, isAuthenticated } from "@/lib/auth"
import {
  createDefaultWorkingHours,
  mapAppointment,
  mapAppointments,
  mapMasters,
  mapResource,
  mapSalons,
  mergeSchedulesWithDefaultWeek,
  mapServices,
} from "@/lib/mappers"
import {
  MOCK_APPOINTMENTS,
  MOCK_MASTERS,
  MOCK_RESOURCES,
  MOCK_SALONS,
  MOCK_SERVICES,
  MOCK_WORKING_HOURS,
} from "@/lib/mock-data"
import type {
  Appointment,
  Master,
  Resource,
  Role,
  Salon,
  Screen,
  Service,
  WorkingHours,
} from "@/lib/types"
import { useAuthSession } from "@/hooks/use-auth-session"

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

const PRESERVED_SCREENS = new Set<Screen>([
  "profile",
  "booking-wizard",
  "my-bookings",
  "salon-dashboard",
  "working-hours",
  "service-management",
])

function dedupeAppointments(appointments: Appointment[]) {
  const unique = new Map<string, Appointment>()
  appointments.forEach((appointment) => {
    unique.set(appointment.id, appointment)
  })

  return Array.from(unique.values()).sort((left, right) => {
    const leftKey = `${left.date}T${left.startTime}`
    const rightKey = `${right.date}T${right.startTime}`
    return leftKey.localeCompare(rightKey)
  })
}

function collectResources(salons: Salon[]) {
  const unique = new Map<string, Resource>()
  salons.forEach((salon) => {
    salon.resources.forEach((resource) => {
      unique.set(resource.id, resource)
    })
  })
  return Array.from(unique.values())
}

export default function TelegramCRMClient() {
  const { state: authState, retry: retryAuth } = useAuthSession()
  const [role, setRole] = useState<Role>("client")
  const [viewMode, setViewMode] = useState<Role>("client")
  const [screen, setScreen] = useState<Screen>("discovery")
  const [currentUserId, setCurrentUserId] = useState<string>("client-self")
  const [currentUserName, setCurrentUserName] = useState("Мой аккаунт")
  const [currentUserSpecialty, setCurrentUserSpecialty] = useState<string | undefined>()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [resources, setResources] = useState<Resource[]>([])
  const [salons, setSalons] = useState<Salon[]>([])
  const [masters, setMasters] = useState<Master[]>([])
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(createDefaultWorkingHours())
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null)
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null)
  const [appLoading, setAppLoading] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)

  const currentSalon = salons.find((salon) =>
    salon.members.some((member) => member.masterId === currentUserId),
  ) || null

  const syncSalonInState = useCallback((updatedSalon: Salon) => {
    setSalons((previous) =>
      previous.map((salon) => (salon.id === updatedSalon.id ? updatedSalon : salon)),
    )
  }, [])

  const loadAppData = useCallback(async () => {
    if (!isAuthenticated()) return

    if (IS_DEV_AUTH_BYPASS) {
      const isMasterAccount = role === "master"

      setCurrentUserId(isMasterAccount ? "m1" : "c1")
      setCurrentUserName(isMasterAccount ? "Анна Петрова" : "Ольга Козлова")
      setCurrentUserSpecialty(isMasterAccount ? "Стилист-колорист" : undefined)
      setScreen((current) => {
        if (PRESERVED_SCREENS.has(current)) {
          return current
        }

        return viewMode === "master" ? "dashboard" : "discovery"
      })
      setMasters(MOCK_MASTERS)
      setSalons(isMasterAccount ? MOCK_SALONS : [])
      setServices(isMasterAccount ? MOCK_SERVICES : [])
      setResources(isMasterAccount ? MOCK_RESOURCES : [])
      setWorkingHours(MOCK_WORKING_HOURS)
      setAppointments(MOCK_APPOINTMENTS)
      setDataError(null)
      return
    }

    setAppLoading(true)
    setDataError(null)

    try {
      const me = await apiProfile.getMe()

      setCurrentUserId(String(me.tgId))
      setCurrentUserName(me.fullName)
      setCurrentUserSpecialty(me.specialty)
      setRole(me.role as Role)
      setViewMode((current) => {
        if (me.role !== "master") {
          return "client"
        }

        return current === "client" && currentUserId === "client-self" ? "master" : current
      })
      setScreen((current) => {
        if (PRESERVED_SCREENS.has(current)) {
          return current
        }

        if (me.role === "master" && currentUserId === "client-self") {
          return "dashboard"
        }

        return me.role === "master" && viewMode === "master" ? "dashboard" : "discovery"
      })

      const [
        mastersResult,
        salonsResult,
        servicesResult,
        schedulesResult,
        masterAppointmentsResult,
        clientAppointmentsResult,
      ] = await Promise.allSettled([
        apiMasters.list(),
        apiSalons.my(),
        apiServices.my(),
        apiSchedules.my(),
        apiAppointments.my("master"),
        apiAppointments.my("client"),
      ])

      const rejectedResults = [
        mastersResult,
        salonsResult,
        servicesResult,
        schedulesResult,
        masterAppointmentsResult,
        clientAppointmentsResult,
      ].filter((result) => result.status === "rejected")

      const unauthorizedResult = rejectedResults.find(
        (result) => result.reason instanceof ApiError && result.reason.status === 401,
      )
      if (unauthorizedResult) {
        retryAuth()
        return
      }

      if (mastersResult.status === "fulfilled") {
        setMasters(mapMasters(mastersResult.value))
      }

      if (salonsResult.status === "fulfilled") {
        setSalons(mapSalons(salonsResult.value))
      } else {
        setSalons([])
      }

      if (servicesResult.status === "fulfilled") {
        setServices(mapServices(servicesResult.value))
      } else {
        setServices([])
      }

      if (schedulesResult.status === "fulfilled" && schedulesResult.value.length > 0) {
        setWorkingHours(mergeSchedulesWithDefaultWeek(schedulesResult.value))
      } else {
        setWorkingHours(createDefaultWorkingHours())
      }

      const nextAppointments = dedupeAppointments([
        ...(masterAppointmentsResult.status === "fulfilled" ? mapAppointments(masterAppointmentsResult.value) : []),
        ...(clientAppointmentsResult.status === "fulfilled" ? mapAppointments(clientAppointmentsResult.value) : []),
      ])
      setAppointments(nextAppointments)

      if (rejectedResults.length > 0 && rejectedResults.length < 6) {
        setDataError("Часть данных не загрузилась. Основные функции доступны, но стоит проверить backend-логи.")
      }
    } catch (error) {
      console.error("Load data failed:", error)

      if (error instanceof ApiError && error.status === 401) {
        retryAuth()
        return
      }

      setDataError("Не удалось загрузить данные приложения. Проверь доступность backend и авторизацию.")
    } finally {
      setAppLoading(false)
    }
  }, [currentUserId, retryAuth, role, viewMode])

  useEffect(() => {
    if (authState.status !== "ready" || !authState.auth) return

    setCurrentUserId(String(authState.auth.userId))
    setCurrentUserName(authState.auth.fullName)
    setRole(authState.auth.role)
    setViewMode(authState.auth.role)
    setScreen(authState.auth.role === "master" ? "dashboard" : "discovery")
  }, [authState])

  useEffect(() => {
    if (authState.status !== "ready" || !isAuthenticated()) return
    void loadAppData()
  }, [authState.status, loadAppData])

  useEffect(() => {
    setResources(collectResources(salons))
    setSelectedSalon((current) => (current ? salons.find((salon) => salon.id === current.id) ?? null : null))
  }, [salons])

  const handleNavigate = useCallback((nextScreen: Screen) => {
    setScreen(nextScreen)
    setSelectedMaster(null)
    if (nextScreen !== "salon-dashboard") {
      setSelectedSalon(null)
    }
  }, [])

  const handleToggleRole = useCallback(() => {
    setViewMode((current) => {
      const next = current === "master" ? "client" : "master"
      setScreen(next === "master" ? "dashboard" : "discovery")
      setSelectedMaster(null)
      setSelectedSalon(null)
      return next
    })
  }, [])

  const handleBecomeMaster = useCallback(async () => {
    if (IS_DEV_AUTH_BYPASS) {
      setCurrentUserId("m1")
      setCurrentUserName("Анна Петрова")
      setCurrentUserSpecialty("Стилист-колорист")
      setRole("master")
      setViewMode("master")
      setScreen("dashboard")
      setSelectedSalon(null)
      setSalons(MOCK_SALONS)
      setServices(MOCK_SERVICES)
      setResources(MOCK_RESOURCES)
      return
    }

    try {
      await apiProfile.becomeMaster()
      setRole("master")
      setViewMode("master")
      setScreen("dashboard")
      setSelectedSalon(null)
      await loadAppData()
    } catch (error) {
      console.error("Become master failed:", error)
      setDataError("Не удалось переключить аккаунт в режим мастера.")
    }
  }, [loadAppData])

  const handleCancelAppointment = useCallback(async (id: string) => {
    if (IS_DEV_AUTH_BYPASS) {
      setAppointments((previous) =>
        previous.map((appointment) =>
          appointment.id === id ? { ...appointment, status: "cancelled" } : appointment,
        ),
      )
      return
    }

    try {
      const cancelled = await apiAppointments.cancel(Number(id))
      const mapped = mapAppointment(cancelled)

      setAppointments((previous) =>
        previous.map((appointment) => (appointment.id === id ? mapped : appointment)),
      )
    } catch (error) {
      console.error("Cancel appointment failed:", error)
      setDataError("Не удалось отменить запись.")
    }
  }, [])

  const handleSelectMaster = useCallback((master: Master) => {
    setSelectedMaster(master)
    setScreen("booking-wizard")
  }, [])

  const handleBookFromWizard = useCallback(async (appointment: Appointment) => {
    if (IS_DEV_AUTH_BYPASS) {
      setAppointments((previous) =>
        dedupeAppointments([
          ...previous,
          {
            ...appointment,
            clientId: currentUserId,
            clientName: currentUserName,
          },
        ]),
      )
      setScreen("my-bookings")
      setSelectedMaster(null)
      return
    }

    try {
      // Формируем ISO string с timezone браузера
      // startTime уже имеет формат "14:00", date имеет "2026-05-02"
      // Создаём временное Date только для получения timezone offset
      const tempDate = new Date(`${appointment.date}T${appointment.startTime}:00`)
      
      // Вычисляем timezone offset (+03:00 или -05:00)
      const offset = tempDate.getTimezoneOffset() // offset in minutes
      const absOffset = Math.abs(offset)
      const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, "0")
      const offsetMinutes = String(absOffset % 60).padStart(2, "0")
      const tzSign = offset <= 0 ? "+" : "-"
      const tzString = `${tzSign}${offsetHours}:${offsetMinutes}`

      // Отправляем с явной timezone информацией: 2026-05-02T14:00:00+03:00
      const created = await apiAppointments.create({
        masterId: Number(appointment.masterId),
        clientId: Number(currentUserId),
        serviceId: Number(appointment.service.id),
        startTime: `${appointment.date}T${appointment.startTime}:00${tzString}`,
      })

      setAppointments((previous) => dedupeAppointments([...previous, mapAppointment(created)]))
      setScreen("my-bookings")
      setSelectedMaster(null)
      void loadAppData()
    } catch (error) {
      console.error("Book appointment failed:", error)
      setDataError("Не удалось создать запись. Проверь свободный слот и попробуй ещё раз.")
    }
  }, [currentUserId, loadAppData])

  const handleSelectSalon = useCallback((salon: Salon) => {
    setSelectedSalon(salon)
    setScreen("salon-dashboard")
  }, [])

  const handleUpdateSalon = useCallback((updatedSalon: Salon) => {
    syncSalonInState(updatedSalon)
  }, [syncSalonInState])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    if (!selectedSalon) return

    try {
      await apiSalons.removeMember(selectedSalon.id, memberId)

      handleUpdateSalon({
        ...selectedSalon,
        members: selectedSalon.members.filter((member) => member.id !== memberId),
      })
    } catch (error) {
      console.error("Remove member failed:", error)
      setDataError("Не удалось удалить мастера из салона.")
    }
  }, [handleUpdateSalon, selectedSalon])

  const handleUpdateResource = useCallback(async (resource: Resource) => {
    try {
      const saved = await apiResources.update(Number(resource.id), {
        name: resource.name,
        isActive: resource.isActive,
      })
      const mapped = mapResource(saved)

      setResources((previous) =>
        previous.map((existing) => (existing.id === mapped.id ? mapped : existing)),
      )

      if (selectedSalon) {
        handleUpdateSalon({
          ...selectedSalon,
          resources: selectedSalon.resources.map((existing) =>
            existing.id === mapped.id ? mapped : existing,
          ),
        })
      }
    } catch (error) {
      console.error("Update resource failed:", error)
      setDataError("Не удалось обновить ресурс салона.")
    }
  }, [handleUpdateSalon, selectedSalon])

  const handleAddResource = useCallback(async (resourceDraft: { name: string; isActive: boolean }) => {
    if (!selectedSalon) return

    try {
      const created = await apiResources.create(selectedSalon.id, resourceDraft)
      const mapped = mapResource(created)

      setResources((previous) => [...previous, mapped])
      handleUpdateSalon({
        ...selectedSalon,
        resources: [...selectedSalon.resources, mapped],
      })
    } catch (error) {
      console.error("Create resource failed:", error)
      setDataError("Не удалось добавить ресурс салона.")
    }
  }, [handleUpdateSalon, selectedSalon])

  const handleDeleteResource = useCallback(async (resourceId: string) => {
    try {
      await apiResources.delete(Number(resourceId))
      setResources((previous) => previous.filter((resource) => resource.id !== resourceId))

      if (selectedSalon) {
        handleUpdateSalon({
          ...selectedSalon,
          resources: selectedSalon.resources.filter((resource) => resource.id !== resourceId),
        })
      }
    } catch (error) {
      console.error("Delete resource failed:", error)
      setDataError("Не удалось удалить ресурс салона.")
    }
  }, [handleUpdateSalon, selectedSalon])

  const masterAppointments = appointments.filter((appointment) => appointment.masterId === currentUserId)
  const clientAppointments = appointments.filter((appointment) => appointment.clientId === currentUserId)

  if (authState.status === "loading") {
    return (
      <div className="mx-auto flex min-h-svh max-w-[430px] items-center justify-center bg-background px-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-sm text-muted-foreground">Проверяем авторизацию...</p>
        </div>
      </div>
    )
  }

  if (authState.status === "login-required") {
    return (
      <DevLoginScreen
        botLink={authState.botLink}
        expiresAt={authState.expiresAt}
        error={authState.error}
        onRetry={retryAuth}
      />
    )
  }

  if (authState.status === "error") {
    return (
      <div className="mx-auto flex min-h-svh max-w-[430px] items-center justify-center bg-background px-6">
        <div className="w-full rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-left">
          <p className="text-sm font-semibold text-destructive">Ошибка авторизации</p>
          <p className="mt-2 text-sm text-foreground">{authState.message}</p>
        </div>
      </div>
    )
  }

  if (appLoading) {
    return (
      <div className="mx-auto flex min-h-svh max-w-[430px] items-center justify-center bg-background px-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <p className="text-sm text-muted-foreground">Загружаем данные приложения...</p>
        </div>
      </div>
    )
  }

  return (
    <RuntimeErrorBoundary>
      <div className="mx-auto flex min-h-svh max-w-[430px] flex-col bg-background">
        <main className="flex-1 overflow-y-auto pb-20">
          {dataError ? (
            <div className="px-4 pt-3">
              <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {dataError}
              </div>
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {viewMode === "master" && screen === "dashboard" ? (
              <motion.div key="master-dash" {...pageVariants} transition={{ duration: 0.2 }}>
                <MasterDashboard
                  appointments={masterAppointments}
                  allAppointments={appointments}
                  resources={resources}
                  salon={currentSalon}
                  currentMasterId={currentUserId}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />
              </motion.div>
            ) : null}

            {viewMode === "master" && screen === "service-management" ? (
              <motion.div key="master-services" {...pageVariants} transition={{ duration: 0.2 }}>
                <ServiceManagement
                  services={services}
                  resources={resources}
                  onUpdate={setServices}
                />
              </motion.div>
            ) : null}

            {viewMode === "master" && screen === "working-hours" ? (
              <motion.div key="master-hours" {...pageVariants} transition={{ duration: 0.2 }}>
                <WorkingHoursScreen
                  hours={workingHours}
                  onUpdate={setWorkingHours}
                  onBack={() => setScreen("profile")}
                />
              </motion.div>
            ) : null}

            {viewMode === "master" && screen === "salon-dashboard" && selectedSalon ? (
              <motion.div key="salon-dash" {...pageVariants} transition={{ duration: 0.2 }}>
                <SalonDashboard
                  salon={selectedSalon}
                  appointments={appointments}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  onUpdateSalon={handleUpdateSalon}
                  onRemoveMember={handleRemoveMember}
                  onUpdateResource={handleUpdateResource}
                  onAddResource={handleAddResource}
                  onDeleteResource={handleDeleteResource}
                />
              </motion.div>
            ) : null}

            {viewMode === "client" && screen === "discovery" ? (
              <motion.div key="client-disc" {...pageVariants} transition={{ duration: 0.2 }}>
                <DiscoveryScreen masters={masters} onSelectMaster={handleSelectMaster} />
              </motion.div>
            ) : null}

            {viewMode === "client" && screen === "booking-wizard" && selectedMaster ? (
              <motion.div key="client-wizard" {...pageVariants} transition={{ duration: 0.2 }}>
                <BookingWizard
                  master={selectedMaster}
                  onBack={() => {
                    setScreen("discovery")
                    setSelectedMaster(null)
                  }}
                  onBook={handleBookFromWizard}
                />
              </motion.div>
            ) : null}

            {viewMode === "client" && screen === "my-bookings" ? (
              <motion.div key="client-bookings" {...pageVariants} transition={{ duration: 0.2 }}>
                <MyBookingsScreen
                  appointments={clientAppointments}
                  onCancel={handleCancelAppointment}
                />
              </motion.div>
            ) : null}

            {screen === "profile" ? (
              <motion.div key="profile" {...pageVariants} transition={{ duration: 0.2 }}>
                <ProfileScreen
                  role={role}
                  viewMode={viewMode}
                  salons={salons}
                  currentMasterId={currentUserId}
                  currentUserName={currentUserName}
                  currentUserSpecialty={currentUserSpecialty}
                  onToggleRole={handleToggleRole}
                  onBecomeMaster={handleBecomeMaster}
                  onNavigate={(nextScreen) => setScreen(nextScreen)}
                  onSelectSalon={handleSelectSalon}
                  onSalonsChange={setSalons}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>

        <BottomNav currentScreen={screen} role={viewMode} onNavigate={handleNavigate} />
      </div>
    </RuntimeErrorBoundary>
  )
}
