"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Users, Box, CalendarDays, Building2 } from "lucide-react"
import type { Salon, Resource, Appointment } from "@/lib/types"
import { SalonMembersPanel } from "./salon-members-panel"
import { SalonResourcesPanel } from "./salon-resources-panel"
import { SalonScheduleView } from "./salon-schedule-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface SalonDashboardProps {
  salon: Salon
  appointments: Appointment[]
  selectedDate: Date
  onSelectDate: (date: Date) => void
  onUpdateSalon: (salon: Salon) => void
  onRemoveMember: (memberId: string) => void
  onUpdateResource: (resource: Resource) => void
  onAddResource: (resource: Resource) => void
  onDeleteResource: (resourceId: string) => void
}

export function SalonDashboard({
  salon,
  appointments,
  selectedDate,
  onSelectDate,
  onUpdateSalon,
  onRemoveMember,
  onUpdateResource,
  onAddResource,
  onDeleteResource,
}: SalonDashboardProps) {
  const [activeTab, setActiveTab] = useState<"schedule" | "members" | "resources">("schedule")

  const handleCopyInvite = async () => {
    await navigator.clipboard.writeText(`https://t.me/crmbot?start=${salon.inviteCode}`)
  }

  const tabs = [
    { id: "schedule" as const, label: "Расписание", icon: CalendarDays },
    { id: "members" as const, label: "Мастера", icon: Users },
    { id: "resources" as const, label: "Ресурсы", icon: Box },
  ]

  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* Заголовок салона */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 pt-3"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">{salon.name}</h1>
            <p className="text-sm text-muted-foreground">{salon.members.length} мастеров</p>
          </div>
        </div>
      </motion.div>

      {/* Табы */}
      <div className="px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-secondary">
            <TabsTrigger value="schedule" className="text-xs">
              Расписание
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs">
              <Users className="mr-1 h-3 w-3" />
              Мастера
            </TabsTrigger>
            <TabsTrigger value="resources" className="text-xs">
              <Box className="mr-1 h-3 w-3" />
              Ресурсы
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="mt-4">
            <SalonScheduleView
              salon={salon}
              appointments={appointments}
              selectedDate={selectedDate}
              onSelectDate={onSelectDate}
            />
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <SalonMembersPanel
              salon={salon}
              onRemoveMember={onRemoveMember}
              onCopyInvite={handleCopyInvite}
            />
          </TabsContent>

          <TabsContent value="resources" className="mt-4">
            <SalonResourcesPanel
              resources={salon.resources}
              onUpdateResource={onUpdateResource}
              onAddResource={onAddResource}
              onDeleteResource={onDeleteResource}
              salonId={salon.id}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
