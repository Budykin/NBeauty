"use client"

import { motion } from "framer-motion"
import {
  LayoutDashboard,
  Search,
  User,
  CalendarDays,
  Scissors,
  Users,
} from "lucide-react"
import type { Screen, Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface BottomNavProps {
  currentScreen: Screen
  role: Role
  onNavigate: (screen: Screen) => void
}

const masterTabs = [
  { id: "dashboard" as Screen, label: "Записи", icon: CalendarDays },
  { id: "service-management" as Screen, label: "Услуги", icon: Scissors },
  { id: "profile" as Screen, label: "Профиль", icon: User },
]

const clientTabs = [
  { id: "discovery" as Screen, label: "Мастера", icon: Users },
  { id: "my-bookings" as Screen, label: "Записи", icon: CalendarDays },
  { id: "profile" as Screen, label: "Профиль", icon: User },
]

export function BottomNav({ currentScreen, role, onNavigate }: BottomNavProps) {
  const tabs = role === "master" ? masterTabs : clientTabs

  const isActive = (tabId: Screen) => {
    if (tabId === "dashboard" && (currentScreen === "dashboard" || currentScreen === "add-booking" || currentScreen === "working-hours")) return true
    if (tabId === "service-management" && currentScreen === "service-management") return true
    if (tabId === "discovery" && (currentScreen === "discovery" || currentScreen === "booking-wizard")) return true
    if (tabId === "my-bookings" && currentScreen === "my-bookings") return true
    if (tabId === "profile" && currentScreen === "profile") return true
    return currentScreen === tabId
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[430px] items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const active = isActive(tab.id)
          return (
            <button
              key={tab.id}
              onClick={() => onNavigate(tab.id)}
              className={cn(
                "relative flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary"
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
              <tab.icon className="h-5 w-5" />
              <span className="font-medium">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
