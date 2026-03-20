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
import { AddBookingModal } from "@/components/add-booking-drawer"
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

const screenMeta: Record<Screen, { title: string; description: string }> = {
  dashboard: {
    title: "Мои записи",
    description: "Следите за расписанием, загрузкой дня и новыми бронированиями.",
  },
  services: {
    title: "Услуги",
    description: "Управляйте каталогом услуг и условиями записи.",
  },
  profile: {
    title: "Профиль",
    description: "Меняйте режим работы, открывайте настройки и управляйте салонами.",
  },
  "add-booking": {
    title: "Новая запись",
    description: "Быстро оформите бронирование вручную.",
  },
  "service-management": {
    title: "Услуги",
    description: "Редактируйте цены, длительность и связанные ресурсы.",
  },
  "working-hours": {
    title: "Рабочие часы",
    description: "Настройте график и доступность на неделю.",
  },
  discovery: {
    title: "Каталог мастеров",
    description: "Выбирайте специалиста и переходите к записи без мобильного shell.",
  },
  "booking-wizard": {
    title: "Онлайн-запись",
    description: "Подберите мастера, услугу и время в одном потоке.",
  },
  "my-bookings": {
    title: "Мои записи",
    description: "Просматривайте предстоящие и отменённые визиты.",
  },
  "salon-dashboard": {
    title: "Салон",
    description: "Контролируйте команду, ресурсы и общее расписание.",
  },
  "salon-members": {
    title: "Команда салона",
    description: "Управляйте составом мастеров и приглашениями.",
  },
  "salon-resources": {
    title: "Ресурсы салона",
    description: "Следите за кабинетами, оборудованием и доступностью.",
  },
  "my-salons": {
    title: "Мои салоны",
    description: "Переходите между площадками и рабочими контекстами.",
  },
}

export default function TelegramCRM() {
  const [role, setRole] = useState<Role>("master")
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
    setRole((prev) => {
      const next = prev === "master" ? "client" : "master"
      setScreen(next === "master" ? "dashboard" : "discovery")
      setSelectedSalon(null)
      return next
    })
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

  // Записи текущего мастера
  const masterAppointments = appointments.filter((a) => a.masterId === CURRENT_MASTER_ID)
  const activeMeta = screenMeta[screen]

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(21,128,61,0.12),_transparent_24%),linear-gradient(180deg,_#f6fbf7_0%,_#eef6f0_100%)]">
      <div className="mx-auto flex min-h-svh max-w-[1600px] gap-6 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-72 shrink-0 lg:block">
          <div className="sticky top-6 flex h-[calc(100svh-3rem)] flex-col rounded-[32px] border border-white/70 bg-background/88 p-6 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur">
            <div className="space-y-4 border-b border-border/70 pb-6">
              <div>
                <h1 className="text-2xl font-semibold text-foreground">CRM Мастер</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Управляйте записями, услугами, графиком и салонами в одном кабинете.
                </p>
              </div>
            </div>

            <div className="py-6">
              <BottomNav currentScreen={screen} role={role} onNavigate={handleNavigate} mode="desktop" />
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="hidden lg:block">
            <div className="rounded-[32px] border border-white/70 bg-background/92 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur">
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">{activeMeta.title}</h2>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{activeMeta.description}</p>
                </div>
                <div className="hidden rounded-2xl border border-border/70 bg-secondary/60 px-4 py-3 xl:block">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Дата</p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {selectedDate.toLocaleDateString("ru-RU", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden rounded-[32px] border border-white/70 bg-background/94 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur">
            {/* Контент */}
            <main className="flex-1 overflow-y-auto pb-20 lg:pb-8">
              <AnimatePresence mode="wait">
                {/* === МАСТЕР === */}
                {role === "master" && screen === "dashboard" && (
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

                {role === "master" && screen === "service-management" && (
                  <motion.div key="master-services" {...pageVariants} transition={{ duration: 0.2 }}>
                    <ServiceManagement
                      services={services}
                      resources={resources}
                      onUpdate={setServices}
                    />
                  </motion.div>
                )}

                {role === "master" && screen === "working-hours" && (
                  <motion.div key="master-hours" {...pageVariants} transition={{ duration: 0.2 }}>
                    <WorkingHoursScreen
                      hours={workingHours}
                      onUpdate={setWorkingHours}
                      onBack={() => setScreen("profile")}
                    />
                  </motion.div>
                )}

                {role === "master" && screen === "salon-dashboard" && selectedSalon && (
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
                    />
                  </motion.div>
                )}

                {/* === КЛИЕНТ === */}
                {role === "client" && screen === "discovery" && (
                  <motion.div key="client-disc" {...pageVariants} transition={{ duration: 0.2 }}>
                    <DiscoveryScreen masters={MOCK_MASTERS} onSelectMaster={handleSelectMaster} />
                  </motion.div>
                )}

                {role === "client" && screen === "booking-wizard" && selectedMaster && (
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

                {role === "client" && screen === "my-bookings" && (
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
                      onNavigate={(s) => setScreen(s)}
                      onSelectSalon={handleSelectSalon}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>

      {/* Drawer для ручного бронирования */}
      <AddBookingModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        services={services}
        selectedDate={selectedDate}
        onAdd={handleAddAppointment}
      />

      {/* Нижняя навигация */}
      <BottomNav currentScreen={screen} role={role} onNavigate={handleNavigate} />
    </div>
  )
}
