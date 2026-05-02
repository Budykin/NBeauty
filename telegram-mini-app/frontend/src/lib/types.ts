export type Role = "master" | "client" | "admin"

export interface Resource {
  id: string
  name: string
  salonId: string
  isActive: boolean
}

export interface Service {
  id: string
  name: string
  price: number
  duration: number // в минутах
  resourceId?: string // ID ресурса, если требуется
}

export interface Appointment {
  id: string
  clientName: string
  clientId: string
  masterId: string
  masterName: string
  service: Service
  date: string // YYYY-MM-DD
  startTime: string // HH:MM
  endTime: string // HH:MM
  status: "upcoming" | "completed" | "cancelled"
  resourceId?: string // ID занятого ресурса
}

export interface Master {
  id: string
  name: string
  avatar: string
  specialty: string
  rating: number
  reviewCount: number
  services: Service[]
  workingHours?: WorkingHours[]
  salonId?: string
}

export interface SalonMember {
  id: string
  masterId: string
  masterName: string
  masterAvatar: string
  role: "admin" | "master"
  joinedAt: string
}

export interface Salon {
  id: string
  name: string
  ownerId: string
  inviteCode: string
  members: SalonMember[]
  resources: Resource[]
}

export interface WorkingHours {
  scheduleId?: number
  salonId?: string
  dayOfWeek: number
  day: string
  dayShort: string
  enabled: boolean
  start: string
  end: string
}

export type Screen =
  | "dashboard"
  | "services"
  | "profile"
  | "add-booking"
  | "service-management"
  | "working-hours"
  | "discovery"
  | "booking-wizard"
  | "my-bookings"
  | "salon-dashboard"
  | "salon-members"
  | "salon-resources"
  | "my-salons"
