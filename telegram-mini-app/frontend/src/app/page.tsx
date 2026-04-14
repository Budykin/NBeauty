"use client"

import { useState, useCallback, useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import type { Screen, Role, Appointment, Service, WorkingHours, Master, Salon, Resource } from "@/lib/types"
import {
  MOCK_APPOINTMENTS,
  MOCK_SERVICES,
  MOCK_WORKING_HOURS,
  MOCK_MASTERS,
  MOCK_SALONS,
  MOCK_RESOURCES,
} from "@/lib/mock-data"
import { apiAuth, apiProfile, apiSalons, apiAppointments, apiServices, apiResources, ApiError } from "@/lib/api"
import { setAccessToken, setInitData, getInitData, isAuthenticated } from "@/lib/auth"
import { mapSalons, mapServices, mapResources, mapAppointments, mapScheduleToHours } from "@/lib/mappers"
import { BottomNav } from "@/components/bottom-nav"
import { MasterDashboard } from "@/components/master-dashboard"
import { AddBookingDrawer } from "@/components/add-booking-drawer"
import { ServiceManagement } from "@/components/service-management"
import { WorkingHoursScreen } from "@/components/working-hours"
import { DiscoveryScreen } from "@/components/discovery-screen"
import { BookingWizard } from "@/components/booking-wizard"
import { MyBookingsScreen } from "@/components/my-bookings"
import { ProfileScreen } from "@/components/profile-screen"
import { SalonDashboard } from "@/components/salon-dashboard"

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export default function TelegramCRM() {
  const [role, setRole] = useState<Role>("client")       // Статус из БД (client/master)
  const [viewMode, setViewMode] = useState<Role>("client")  // Режим просмотра
  const [screen, setScreen] = useState<Screen>("dashboard")
  const [currentUserId, setCurrentUserId] = useState<string>("client-self")
  const [appointments, setAppointments] = useState<Appointment[]>(MOCK_APPOINTMENTS)
  const [services, setServices] = useState<Service[]>(MOCK_SERVICES)
  const [resources, setResources] = useState<Resource[]>(MOCK_RESOURCES)
  const [salons, setSalons] = useState<Salon[]>(MOCK_SALONS)
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>(MOCK_WORKING_HOURS)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedMaster, setSelectedMaster] = useState<Master | null>(null)
  const [selectedSalon, setSelectedSalon] = useState<Salon | null>(null)

  const currentSalon = salons.find((s) =>
    s.members.some((m) => m.masterId === currentUserId)
  ) || null

  // === AUTH: при первом запуске — логин через Telegram initData ===
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (!tg) return

    const initData = tg.initData || ""
    if (!initData) return

    // Если уже авторизованы — пропускаем
    if (isAuthenticated()) return

    // Отправляем initData на бэкенд → получаем JWT
    apiAuth.telegram(initData)
      .then((res) => {
        setAccessToken(res.accessToken)
        setInitData(initData)
        setCurrentUserId(String(res.userId))
        setRole(res.role as Role)
        setViewMode(res.role as Role)
      })
      .catch((err) => {
        console.error("Auth failed:", err)
      })
  }, [])

  // === LOAD USER DATA: загружаем профиль и данные салона ===
  useEffect(() => {
    if (!isAuthenticated()) return

    const loadData = async () => {
      try {
        const [me, mySalonsRes, myServicesRes, masterAppts] = await Promise.allSettled([
          apiProfile.getMe(),
          apiSalons.my(),
          apiServices.my(),
          apiAppointments.my("master"),
        ])

        // Устанавливаем роль из профиля
        if (me.status === "fulfilled") {
          setCurrentUserId(String(me.value.tgId))
          setRole(me.value.role as Role)
          setViewMode(me.value.role as Role)
        }

        // Загружаем салоны
        if (mySalonsRes.status === "fulfilled") {
          setSalons(mapSalons(mySalonsRes.value))
        }

        // Загружаем услуги
        if (myServicesRes.status === "fulfilled") {
          setServices(mapServices(myServicesRes.value))
        }

        // Загружаем записи мастера
        if (masterAppts.status === "fulfilled") {
          setAppointments(mapAppointments(masterAppts.value))
        }
      } catch (err) {
        console.error("Load data failed:", err)
      }
    }

    loadData()
  }, [])

  const handleNavigate = useCallback((s: Screen) => {
    setScreen(s)
    setSelectedMaster(null)
    if (s !== "salon-dashboard") {
      setSelectedSalon(null)
    }
  }, [])

  const handleToggleRole = useCallback(() => {
    setViewMode((prev) => {
      const next = prev === "master" ? "client" : "master"
      setScreen(next === "master" ? "dashboard" : "discovery")
      setSelectedSalon(null)
      return next
    })
  }, [])

  const handleBecomeMaster = useCallback(async () => {
    try {
      await apiProfile.becomeMaster()
      setRole("master")
      setViewMode("master")
      setScreen("dashboard")
      setSelectedSalon(null)
    } catch (err) {
      console.error("Become master failed:", err)
    }
  }, [])

  const handleAddAppointment = useCallback((apt: Appointment) => {
    setAppointments((prev) => [...prev, apt])
  }, [])

  const handleCancelAppointment = useCallback(async (id: string) => {
    try {
      await apiAppointments.cancel(Number(id))
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
      )
    } catch (err) {
      console.error("Cancel appointment failed:", err)
    }
  }, [])

  const handleSelectMaster = useCallback((master: Master) => {
    setSelectedMaster(master)
    setScreen("booking-wizard")
  }, [])

  const handleBookFromWizard = useCallback(async (apt: Appointment) => {
    try {
      await apiAppointments.create({
        masterId: Number(apt.masterId),
        clientId: Number(currentUserId),
        serviceId: Number(apt.service.id),
        startTime: new Date(`${apt.date}T${apt.startTime}`).toISOString(),
      })

      // Обновляем локальный state
      setAppointments((prev) => [...prev, apt])
      setScreen("my-bookings")
      setSelectedMaster(null)
    } catch (err) {
      console.error("Book appointment failed:", err)
    }
  }, [currentUserId])

  const handleSelectSalon = useCallback((salon: Salon) => {
    setSelectedSalon(salon)
    setScreen("salon-dashboard")
  }, [])

  const handleUpdateSalon = useCallback((updatedSalon: Salon) => {
    setSalons((prev) =>
      prev.map((s) => (s.id === updatedSalon.id ? updatedSalon : s))
    )
    setSelectedSalon(updatedSalon)
  }, [])

  const handleRemoveMember = useCallback((memberId: string) => {
    if (!selectedSalon) return
    const updated = {
      ...selectedSalon,
      members: selectedSalon.members.filter((m) => m.id !== memberId),
    }
    handleUpdateSalon(updated)
  }, [selectedSalon, handleUpdateSalon])

  const handleUpdateResource = useCallback((resource: Resource) => {
    setResources((prev) =>
      prev.map((r) => (r.id === resource.id ? resource : r))
    )
    if (selectedSalon) {
      const updated = {
        ...selectedSalon,
        resources: selectedSalon.resources.map((r) =>
          r.id === resource.id ? resource : r
        ),
      }
      setSelectedSalon(updated)
      setSalons((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
    }
  }, [selectedSalon])

  const handleAddResource = useCallback((resource: Resource) => {
    setResources((prev) => [...prev, resource])
    if (selectedSalon) {
      const updated = {
        ...selectedSalon,
        resources: [...selectedSalon.resources, resource],
      }
      setSelectedSalon(updated)
      setSalons((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      )
    }
  }, [selectedSalon])

  const handleDeleteResource = useCallback(async (resourceId: string) => {
    try {
      await apiResources.delete(Number(resourceId))
      setResources((prev) => prev.filter((r) => r.id !== resourceId))
      if (selectedSalon) {
        const updated = {
          ...selectedSalon,
          resources: selectedSalon.resources.filter((r) => r.id !== resourceId),
        }
        setSelectedSalon(updated)
        setSalons((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s))
        )
      }
    } catch (err) {
      console.error("Delete resource failed:", err)
    }
  }, [selectedSalon])

  // Записи текущего мастера
  const masterAppointments = appointments.filter((a) => a.masterId === currentUserId)

  return (
    <div className="mx-auto flex min-h-svh max-w-[430px] flex-col bg-background">
      {/* Контент */}
      <main className="flex-1 overflow-y-auto pb-20">
        <AnimatePresence mode="wait">
          {/* === МАСТЕР (viewMode) === */}
          {viewMode === "master" && screen === "dashboard" && (
            <motion.div key="master-dash" {...pageVariants} transition={{ duration: 0.2 }}>
              <MasterDashboard
                appointments={masterAppointments}
                allAppointments={appointments}
                resources={resources}
                salon={currentSalon}
                currentMasterId={currentUserId}
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                onAddBooking={() => setDrawerOpen(true)}
              />
            </motion.div>
          )}

          {viewMode === "master" && screen === "service-management" && (
            <motion.div key="master-services" {...pageVariants} transition={{ duration: 0.2 }}>
              <ServiceManagement
                services={services}
                resources={resources}
                onUpdate={setServices}
              />
            </motion.div>
          )}

          {viewMode === "master" && screen === "working-hours" && (
            <motion.div key="master-hours" {...pageVariants} transition={{ duration: 0.2 }}>
              <WorkingHoursScreen
                hours={workingHours}
                onUpdate={setWorkingHours}
                onBack={() => setScreen("profile")}
              />
            </motion.div>
          )}

          {viewMode === "master" && screen === "salon-dashboard" && selectedSalon && (
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
          )}

          {/* === КЛИЕНТ (viewMode) === */}
          {viewMode === "client" && screen === "discovery" && (
            <motion.div key="client-disc" {...pageVariants} transition={{ duration: 0.2 }}>
              <DiscoveryScreen masters={MOCK_MASTERS} onSelectMaster={handleSelectMaster} />
            </motion.div>
          )}

          {viewMode === "client" && screen === "booking-wizard" && selectedMaster && (
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
          )}

          {viewMode === "client" && screen === "my-bookings" && (
            <motion.div key="client-bookings" {...pageVariants} transition={{ duration: 0.2 }}>
              <MyBookingsScreen
                appointments={appointments.filter((a) => a.clientId === currentUserId)}
                onCancel={handleCancelAppointment}
              />
            </motion.div>
          )}

          {/* === ПРОФИЛЬ === */}
          {screen === "profile" && (
            <motion.div key="profile" {...pageVariants} transition={{ duration: 0.2 }}>
              <ProfileScreen
                role={role}
                salons={salons}
                currentMasterId={currentUserId}
                onToggleRole={handleToggleRole}
                onBecomeMaster={handleBecomeMaster}
                onNavigate={(s) => setScreen(s)}
                onSelectSalon={handleSelectSalon}
                onSalonsChange={setSalons}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Drawer для ручного бронирования */}
      <AddBookingDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        services={services}
        selectedDate={selectedDate}
        onAdd={handleAddAppointment}
      />

      {/* Нижняя навигация */}
      <BottomNav currentScreen={screen} role={viewMode} onNavigate={handleNavigate} />
    </div>
  )
}
