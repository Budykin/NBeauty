"use client"

import { useState, useCallback } from "react"
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

const CURRENT_MASTER_ID = "m1" // Текущий пользователь-мастер

export default function TelegramCRM() {
  const [role, setRole] = useState<Role>("client")       // Статус из БД (client/master)
  const [viewMode, setViewMode] = useState<Role>("client")  // Режим просмотра
  const [screen, setScreen] = useState<Screen>("dashboard")
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
    s.members.some((m) => m.masterId === CURRENT_MASTER_ID)
  ) || null

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

  const handleBecomeMaster = useCallback(() => {
    // TODO: POST /api/me/become-master → обновить роль в БД
    setRole("master")
    setViewMode("master")
    setScreen("dashboard")
    setSelectedSalon(null)
  }, [])

  const handleAddAppointment = useCallback((apt: Appointment) => {
    setAppointments((prev) => [...prev, apt])
  }, [])

  const handleCancelAppointment = useCallback((id: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "cancelled" as const } : a))
    )
  }, [])

  const handleSelectMaster = useCallback((master: Master) => {
    setSelectedMaster(master)
    setScreen("booking-wizard")
  }, [])

  const handleBookFromWizard = useCallback((apt: Appointment) => {
    setAppointments((prev) => [...prev, apt])
    setScreen("my-bookings")
    setSelectedMaster(null)
  }, [])

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

  const handleDeleteResource = useCallback((resourceId: string) => {
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
  }, [selectedSalon])

  // Записи текущего мастера
  const masterAppointments = appointments.filter((a) => a.masterId === CURRENT_MASTER_ID)

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
                currentMasterId={CURRENT_MASTER_ID}
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
                appointments={appointments.filter((a) => a.clientId === "client-self")}
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
                currentMasterId={CURRENT_MASTER_ID}
                onToggleRole={handleToggleRole}
                onBecomeMaster={handleBecomeMaster}
                onNavigate={(s) => setScreen(s)}
                onSelectSalon={handleSelectSalon}
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
