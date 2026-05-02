// ============================================================================
// Mappers — конвертация API → Frontend types
// ============================================================================

import type {
  Resource,
  Service,
  Appointment,
  Master,
  SalonMember,
  Salon,
  WorkingHours,
} from "./types"
import type {
  ApiMaster,
  ApiResource,
  ApiService,
  ApiAppointment,
  ApiSalon,
  ApiSalonMember,
  ApiSchedule,
} from "./api"

const DAY_NAMES = [
  { full: "Понедельник", short: "Пн" },
  { full: "Вторник", short: "Вт" },
  { full: "Среда", short: "Ср" },
  { full: "Четверг", short: "Чт" },
  { full: "Пятница", short: "Пт" },
  { full: "Суббота", short: "Сб" },
  { full: "Воскресенье", short: "Вс" },
]

// ============================================================================
// Resource
// ============================================================================

export function mapResource(api: ApiResource): Resource {
  return {
    id: String(api.id),
    name: api.name,
    salonId: api.salonId,
    isActive: api.isActive,
  }
}

// ============================================================================
// Service
// ============================================================================

export function mapService(api: ApiService): Service {
  return {
    id: String(api.id),
    name: api.name,
    price: api.price,
    duration: api.duration,
    resourceId: api.resourceId ? String(api.resourceId) : undefined,
  }
}

// ============================================================================
// Appointment
// ============================================================================

export function mapAppointment(
  api: ApiAppointment,
): Appointment {
  // Извлекаем дату из startTime (ISO string → YYYY-MM-DD)
  const start = new Date(api.startTime)
  const end = new Date(api.endTime)
  const dateStr = start.toISOString().split("T")[0]

  // Создаём заглушку Service из названия
  const service: Service = {
    id: "api-service",
    name: api.serviceName,
    price: 0,
    duration: Math.round((end.getTime() - start.getTime()) / 60000),
  }

  return {
    id: String(api.id),
    clientName: api.clientName,
    clientId: String(api.clientId),
    masterId: String(api.masterId),
    masterName: api.masterName,
    service,
    date: dateStr,
    startTime: start.toTimeString().slice(0, 5), // HH:MM
    endTime: end.toTimeString().slice(0, 5),
    status: api.status === "cancelled" ? "cancelled"
      : api.status === "completed" ? "completed"
      : "upcoming",
    resourceId: api.resourceId ? String(api.resourceId) : undefined,
  }
}

// ============================================================================
// Master
// ============================================================================

export function mapMaster(master: ApiMaster): Master {
  return {
    id: master.id,
    name: master.name,
    avatar: master.avatar || master.name.slice(0, 2).toUpperCase(),
    specialty: master.specialty || "Мастер",
    rating: master.rating,
    reviewCount: master.reviewCount,
    services: master.services.map((service) => ({
      id: service.id,
      name: service.name,
      price: service.price,
      duration: service.duration,
      resourceId: service.resourceId ?? undefined,
    })),
    workingHours: master.schedules
      ? mergeSchedulesWithDefaultWeek(master.schedules)
      : undefined,
    salonId: master.salonId ?? undefined,
  }
}

// ============================================================================
// SalonMember
// ============================================================================

export function mapSalonMember(api: ApiSalonMember): SalonMember {
  return {
    id: api.id,
    masterId: api.masterId,
    masterName: api.masterName,
    masterAvatar: api.masterAvatar,
    role: api.role,
    joinedAt: api.joinedAt,
  }
}

// ============================================================================
// Salon
// ============================================================================

export function mapSalon(api: ApiSalon): Salon {
  return {
    id: api.id,
    name: api.name,
    ownerId: api.ownerId,
    inviteCode: api.inviteCode,
    members: api.members.map(mapSalonMember),
    resources: api.resources.map(mapResource),
  }
}

// ============================================================================
// WorkingHours (из Schedule)
// ============================================================================

export function mapScheduleToHours(api: ApiSchedule): WorkingHours {
  const dayInfo = DAY_NAMES[api.dayOfWeek] || { full: "Неизвестно", short: "?" }
  return {
    scheduleId: api.id,
    salonId: api.salonId,
    dayOfWeek: api.dayOfWeek,
    day: dayInfo.full,
    dayShort: dayInfo.short,
    enabled: api.isEnabled,
    start: api.startTime,
    end: api.endTime,
  }
}

export function mergeSchedulesWithDefaultWeek(schedules: ApiSchedule[]): WorkingHours[] {
  const defaults = createDefaultWorkingHours()
  const byDay = new Map(schedules.map((schedule) => [schedule.dayOfWeek, mapScheduleToHours(schedule)]))

  return defaults.map((defaultDay) => byDay.get(defaultDay.dayOfWeek) ?? defaultDay)
}

export function createDefaultWorkingHours(): WorkingHours[] {
  return DAY_NAMES.map((dayInfo, dayOfWeek) => {
    if (dayOfWeek === 4) {
      return {
        dayOfWeek,
        day: dayInfo.full,
        dayShort: dayInfo.short,
        enabled: true,
        start: "09:00",
        end: "17:00",
      }
    }

    if (dayOfWeek === 5) {
      return {
        dayOfWeek,
        day: dayInfo.full,
        dayShort: dayInfo.short,
        enabled: true,
        start: "10:00",
        end: "15:00",
      }
    }

    if (dayOfWeek === 6) {
      return {
        dayOfWeek,
        day: dayInfo.full,
        dayShort: dayInfo.short,
        enabled: false,
        start: "10:00",
        end: "15:00",
      }
    }

    return {
      dayOfWeek,
      day: dayInfo.full,
      dayShort: dayInfo.short,
      enabled: true,
      start: "09:00",
      end: "18:00",
    }
  })
}

// ============================================================================
// Array mappers
// ============================================================================

export function mapResources(arr: ApiResource[]): Resource[] {
  return arr.map(mapResource)
}

export function mapServices(arr: ApiService[]): Service[] {
  return arr.map(mapService)
}

export function mapAppointments(arr: ApiAppointment[]): Appointment[] {
  return arr.map((a) => mapAppointment(a))
}

export function mapSalons(arr: ApiSalon[]): Salon[] {
  return arr.map(mapSalon)
}

export function mapMasters(arr: ApiMaster[]): Master[] {
  return arr.map(mapMaster)
}
